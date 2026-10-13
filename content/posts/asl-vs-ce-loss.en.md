---
title: "Why ASL Worked for Harmful Content but Not for PII NER — The Difference Between Softmax and Sigmoid"
date: 2026-06-09
draft: false
tags: ["loss", "ASL", "cross-entropy", "NER", "multi-label", "imbalance"]
categories: ["Learning Theory"]
summary: "In multi-label classification of harmful content, ASL (Asymmetric Loss) cleanly solved the sparse-positive problem. When I tried to carry the same remedy over to PII NER token classification, I found that it does not work. The difference comes not from the loss function itself but from the structure of the output layer: softmax and sigmoid handle labels differently."
---

In harmful-content classification (multi-label over the 6 labels CENSURE / DISCRIMINATION / SEXUAL / ABUSE / VIOLENCE / CRIME), ASL (Asymmetric Loss) noticeably helped training on labels with sparse positives. When I tried to apply the same remedy to PII NER (33-class token classification), I realized the operating conditions themselves are different. This post covers the structural difference between the two tasks, and which loss function fits which setting.

## The structure of the two tasks — at a glance

|                 | Harmful content (multi-label classification)   | PII NER (token classification)               |
|-----------------|-----------------------------------------------|---------------------------------------------|
| Unit of classification | 1 sentence                              | 1 token                                      |
| Labels          | 6 labels, each 0/1, **independent**           | **only one** of 33 labels (O + 16×BI)        |
| Output layer    | 6 sigmoids (independent)                      | 33-class softmax                             |
| Default loss    | BCE (Binary Cross-Entropy)                    | Cross-Entropy                                |
| imbalance       | sparse positives — at the sample level (e.g. CRIME positives ~5%) | O tokens at 90% or more — at the token level |

On the surface both look like a "label imbalance" problem. But how the output layer handles labels decides whether a loss function can be applied.

## Why ASL worked for multi-label — per-slot independence

ASL comes down to three things.

- **γ⁻ (suppressing easy negatives)**: lowers the loss contribution of negatives the model confidently predicted as 0, like "this sentence is safe."
- **γ⁺ (suppressing easy positives)**: focusing for positives too. Positives that are too easy get less weight.
- **clip**: ignores extremely easy negatives altogether.

What these mechanisms have in common is that they **look at each label's probability independently**. In the sigmoid setting each of the 6 labels is its own 0/1 Bernoulli distribution: CENSURE being positive does not reduce the probability of SEXUAL. Each slot has **its own separate baseline**, and the positive/negative asymmetry arises separately in each slot.

ASL's asymmetric treatment (γ⁺ on positives, γ⁻ on negatives) operates exactly on top of this "per-slot independence." If positives are sparse in some slot, that slot's γ⁻ corrects the negative bias. There is no interference between slots, so even if the degree of asymmetry differs from label to label, each is adjusted separately.

## In PII NER the operating setting is different

The 33 labels of PII NER become, in the classification of one token, **a single distribution that sums to 1**. Softmax is what guarantees that. The 33 slots, O, B-NAME, I-NAME, B-PHONE …, are **interdependent**: when the probability of B-NAME rises, the other 32 automatically shrink.

In this setting, even if you carry ASL's γ⁻ over in the form of "apply it to the O label," the intent breaks.

- Reduce the loss of O tokens → the probabilities of the other 32 go up automatically (the softmax sum is preserved). Which PII label it goes to cannot be controlled.
- Apply γ⁺ to positives → what the positive is gets decided as one of the 33, so the very notion of "positive/negative for one slot" disappears.

Put simply, ASL's asymmetric treatment is meaningful only when **the slots are independent**. The slots of a softmax are not independent.

## Handling imbalance in the softmax setting

The imbalance in token classification, with O at 90% or more, calls for different remedies.

- **Class weights**: lower the loss weight of O and raise the weight of the PII labels. Simple but effective.
- **Focal Loss**: uses γ to lower the contribution of easy examples (mostly O). An asymmetric remedy that is compatible with softmax.
- **CRF decoding**: enforces sequence consistency (after a B, only an I of the same category) on top of per-token classification. CRF is a remedy at the decoding stage, not a loss.

Our PII NER trains well enough with Cross-Entropy + CRF, and F1 on the hard testset holds steadily in the 0.91 range. There is no motivation to go out of the way to bring ASL over.

## Takeaways

- They get grouped under the same word, "imbalance," but multi-label classification and token classification have completely different output layers.
- ASL is a remedy built on the premise of sigmoid + per-slot independence. It is powerful in multi-label classification but cannot be carried over as is to the softmax setting.
- For imbalance under softmax, the answer is tools fitted to the fact that the distribution is a single one, such as class weights, Focal Loss, and CRF.

A loss function is paired with the model's output layer. When borrowing a remedy from another task, the first thing to check is whether the output layer has the same structure.
