---
title: "For Gateway Thresholds to Mean Something — CRF Marginal + Temperature Scaling"
date: 2026-06-25
draft: false
tags: ["PII", "NER", "CRF", "calibration", "temperature scaling", "confidence"]
categories: ["Design"]
summary: "The gateway applies a threshold policy (for example NAME 0.85, ORG 0.92) on the premise that the PII NER model also returns a confidence value per category. For these thresholds to have statistical meaning, the model's confidence has to be aligned with its actual accuracy. Right now our model only takes the argmax, and in the CRF case the logits are the viterbi result disguised as a one-hot, so softmax is meaningless too. This post lays out the two-step work of computing the CRF marginal probability directly with forward-backward and calibrating the over-confidence with Temperature Scaling."
---

The gateway of the PII guard decides whether to mask by comparing the confidence of each span the model caught with a per-category threshold. Each category gets a different threshold, such as 0.85 for NAME, 0.92 for ORG, and 0.99 for phone numbers. For this policy to actually mean something, the number 0.85 that the model puts out has to give a statistical guarantee like "85% probability of being the correct answer". The current model has no such guarantee.

## Current state — argmax only, no confidence anywhere

Inference with the trained BERT + CRF token classifier looks like this.

```python
logits = model(**enc).logits          # (1, L, 33)
pred_ids = logits.argmax(-1)          # label IDs only
```

It takes only the label of each token, and no logit value or probability is produced anywhere. The output sent to the gateway has no confidence field at all. Even if you want to filter by threshold, there is no value to compare.

The problem is more complicated because this is a CRF model. The logits output by `BertCRFForTokenClassification.forward` are not real logits but the result of the viterbi decode disguised as a one-hot.

```python
# part of forward in token_classifier.py
best_tags = self.crf.decode(emissions, mask=crf_mask)   # viterbi
logits = torch.full((B, L, num_labels), -1e4, ...)
for i, tags in enumerate(best_tags):
    for j, t in enumerate(tags):
        logits[i, j, t] = 1.0                            # 1.0 only for the predicted label
```

It is a trick made so that the `argmax` in `decode_predictions` agrees with the viterbi result, but apply softmax to these logits and the max prob of every token comes out at almost 1.0. softmax(1.0) / (softmax(1.0) + 32 × softmax(-1e4)) ≈ 1.0. So every confidence becomes ~1.0, a meaningless value.

Whether the gateway sets the threshold to 0.85 or to 0.95, every span passes.

## The real confidence of a CRF — marginal probability

The forward-backward algorithm of a CRF can compute the marginal probability of each token.

```
log α_t(j) = logsumexp_i ( log α_{t-1}(i) + transitions[i, j] ) + emissions[t, j]
log β_t(j) = logsumexp_k ( transitions[j, k] + emissions[t+1, k] + log β_{t+1}(k) )
log Z      = logsumexp_j ( log α_T(j) + end_transitions[j] )

log P(y_t = j | x) = log α_t(j) + log β_t(j) - log Z
```

α is forward, the partial sum over all possible sequences from the start up to time t, and β is backward, the partial sum from time t to the end. Subtract the normalizer (Z) from the sum of the two and the marginal probability of that token comes out.

This value is different from a plain softmax of the emissions. It is a probability that reflects the CRF's transition constraints (forbidden transitions such as B-NAME → I-ORG). Even with the same emission, a low transition score lowers the marginal too.

The pytorch-crf library exposes only `_compute_normalizer` (which computes log Z with the forward algorithm) and does not expose `_compute_log_alpha` / `_compute_log_beta`, so they have to be implemented by hand. Written as a Python loop it runs sequence length × batch times, and with just max_length 512 + batch 8, 200 samples take several hours on CPU. It has to run on GPU to be practical.

A vectorized implementation is possible because the α and β updates at the same time step t are independent across the whole batch. Batch the tensor operations of the inner loop well and the Python loop runs only as many times as the sequence length. Even so, it is two passes, forward + backward, so it costs 2 times as much as the viterbi decode.

## Temperature Scaling — calibration with a single scalar T

Deep learning models are over-parameterized, and as a result of fitting the training data too closely they tend to be self-confident. For example, in 1,000 cases where the model said "probability 0.97 that this is NAME", the share that is actually NAME is only about 0.85. This gap between confidence and accuracy is called Expected Calibration Error (ECE).

Temperature Scaling leaves the trained model as it is and divides the emissions by a single scalar T to flatten the softmax distribution.

```python
calibrated_emissions = emissions / T
calibrated_marginal  = crf_marginal(calibrated_emissions)
```

T is learned as the value that minimizes the NLL on the val set. It usually converges in 50 LBFGS iterations.

```python
T = torch.nn.Parameter(torch.ones(1) * 1.5)
opt = torch.optim.LBFGS([T], lr=0.05, max_iter=50)
def closure():
    opt.zero_grad()
    loss = crf_marginal_nll(emissions / T, labels, mask)
    loss.backward()
    return loss
opt.step(closure)
```

The learned T usually comes out between 1.2 and 2.5. With T > 1 the distribution flattens and the over-confidence eases. With T < 1 it gets sharper.

Only one scalar is learned on the training data and validation set, so the model itself is not changed, and it only has to be applied at inference time.

## A quantitative measure of calibration — ECE

ECE measures, on average, how well the model's confidence matches its actual accuracy. The range from 0 to 1 is divided into 10 to 15 bins, and the difference between each bin's mean confidence and its actual accuracy is averaged with weights given by the sample count.

```
ECE = Σ_bin ( |mean conf - accuracy| × bin sample fraction )
```

ECE 0 is perfect calibration, and trained BERT-family models usually come out at around 0.05 to 0.15. When Temperature Scaling is applied well, it drops to around 0.02. Visualized as a reliability diagram, it shows at a glance how close the per-bin bars of confidence and accuracy are to the diagonal (perfect calibration).

## Takeaways — what the two pieces of work mean together

These two pieces of work (CRF marginal extraction + Temperature Scaling) only mean something when they go together.

- Extract only the marginal without calibrating, and the transition effect is reflected but the values are still over-confident, so the threshold policy is ambiguous.
- Apply only Temperature Scaling and use just the emission softmax instead of the marginal, and the CRF's transition effect does not enter the confidence, so the confidence falls out of line with BIO sequence consistency.

For the gateway to run a filter policy with per-category thresholds, both steps have to be in place before a number like 0.85 has a statistically guaranteed meaning. The model returns classification plus quantified confidence, and the gateway only makes the policy decision on top of that. The separation of responsibility ends up reflected in the interface itself.

The work itself finishes without changing the training code. With just the trained best.pt and the val set, it wraps up as learning one scalar + integrating it into inference. For the v6 KoELECTRA model + 11K val samples, it is about 10 to 30 minutes of work on GPU.
