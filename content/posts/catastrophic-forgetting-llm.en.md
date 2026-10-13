---
title: "Sequential Fine-Tuning of an LLM Degrades Its Earlier Abilities — Catastrophic Forgetting"
date: 2026-05-26
draft: false
tags: ["paper review", "LLM", "fine-tuning", "continual-learning", "catastrophic-forgetting"]
categories: ["Learning Theory"]
summary: "Split the data and fine-tune sequentially, and performance on earlier tasks drops while the model learns the new one. It is an old problem called catastrophic forgetting. This post covers the related papers and the mitigation methods (EWC, rehearsal)."
---

## What I observed in sequential fine-tuning

When fine-tuning an LLM with LoRA, I did not feed all the data at once. I carried the adapter forward and trained cumulatively in stages.

```
train on stage 1 data → further training on stage 2 → add stage 3 → ...
```

With each stage, performance on the task of the newly added data improved, but the kinds of output the earlier stages had handled well gradually got worse. It was not a problem with the data or the learning rate. It was a known phenomenon: catastrophic forgetting.

## A problem defined since 1989

Catastrophic forgetting is an old limitation of neural networks, first formalized in McCloskey & Cohen (1989), *Catastrophic Interference in Connectionist Networks*.

The mechanism is as follows.

- A neural network learning task A adjusts its weights to fit A.
- Training task B on top of that overwrites the weights in the direction that favors B.
- When weights that mattered for A change during the training of B, performance on A drops.

It is interference that arises when the new task's gradients update parameters the earlier task depended on.

## How it shows up in LLMs

One might expect a large model to have enough capacity to suffer less, but the reported results say otherwise.

Luo et al. (2023), *An Empirical Study of Catastrophic Forgetting in LLMs During Continual Fine-tuning*, ran experiments on continual instruction tuning of 1B–7B models.

- Catastrophic forgetting was observed generally across the whole 1B–7B range.
- Forgetting tended to get worse as model scale grew.
- Forgetting appeared in every area: domain knowledge, reasoning, and reading comprehension.
- Models that went through general instruction tuning first showed less forgetting in later fine-tuning.

Earlier tasks dropping during cumulative fine-tuning of a 7B model looks like the same thing. Model size did not prevent forgetting.

## Two families of mitigation

### 1. Regularization — EWC (Elastic Weight Consolidation)

EWC, from Kirkpatrick et al. (2017, PNAS), works by restraining changes to important weights.

- After training task A, estimate how important each weight is to A using Fisher information.
- When training task B, penalize change more the more important the weight is (a regularization term added to the loss).
- Learn B while preserving the parameters that matter for A.

Its advantage is that past data does not need to be stored. But the Fisher estimate costs extra computation, and because it uses a diagonal approximation it has limits on tasks where the representation has to change a lot.

### 2. Rehearsal / replay — reviewing by mixing in past data

Experience Replay from Rolnick et al. (2018) and the iCaRL line from Rebuffi et al. (2017) are the representative examples.

- Keep part of the past data in a buffer.
- When training on new data, mix in past data at a fixed ratio and train on both.
- It is the same idea as experience replay in reinforcement learning: keep exposing the earlier distribution to reduce forgetting.

It is simple to implement and its effect is direct. But past data has to be stored, which brings memory and privacy constraints, and a badly chosen mixing ratio causes sampling bias.

## What I applied: rehearsal

EWC's Fisher estimate was awkward to integrate into a LoRA fine-tuning pipeline, so I chose rehearsal.

When training further on new data, I put in data from the earlier tasks at a fixed ratio.

```
training batch = new data to strengthen (70–80%)
               + earlier-task data to retain (20–30%)
```

Training while continuing to expose the earlier distribution reduced the performance drop on the earlier tasks. This points the same way as what Luo et al. reported: "mixing in general data eases forgetting."

![Earlier-task performance under sequential fine-tuning — with and without rehearsal](/images/catastrophic_forgetting.png)

(I drew the graph above myself to explain the concept. For the actual measured curves, see the original Luo et al. 2023 paper.)

## Takeaways

- Catastrophic forgetting is an old limitation of neural networks, and LLMs are no exception. It does not go away as scale grows, and according to the reports it tends to get worse.
- Splitting the data and fine-tuning sequentially runs into it in most cases.
- Mitigation methods split into regularization (EWC) and rehearsal (replay). EWC fits when past data cannot be stored; rehearsal fits when it can be stored and a simple implementation is preferred.
- Including rehearsal from the start when designing sequential training can reduce performance regressions.

---

### References

- McCloskey, M., & Cohen, N. J. (1989). *Catastrophic Interference in Connectionist Networks: The Sequential Learning Problem.*
- Kirkpatrick, J. et al. (2017). *Overcoming catastrophic forgetting in neural networks.* PNAS.
- Rebuffi, S. et al. (2017). *iCaRL: Incremental Classifier and Representation Learning.* CVPR.
- Rolnick, D. et al. (2018). *Experience Replay for Continual Learning.* NeurIPS.
- Luo, Y. et al. (2023). *An Empirical Study of Catastrophic Forgetting in Large Language Models During Continual Fine-tuning.* arXiv:2308.08747.
