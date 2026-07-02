---
title: "Putting the Signal In With Data, Picking It Out By Epoch"
date: 2026-07-02
draft: false
tags: ["LLM", "security", "detection", "data", "generalization", "checkpoint"]
categories: ["Data"]
summary: "Yesterday's conclusion was that the false-positive/recall wall is not a structural problem but a data-coverage one: an attack family absent from the training set did not generalize under any encoder. So I synthesized data for the collapsed family, matched to its distribution, and selected the checkpoint by OOD balance rather than in-domain f1. For the first time, it passed the gate."
---

## Where yesterday left off

I had tried to break the false-positive/recall trade-off in a multi-turn attack classifier with four architectures (a GRU over per-turn encodings, an asymmetric boundary loss, peak aggregation, a turn Transformer), and all of them failed at the same spot. On cipher (a substitution-cipher family) every structure collapsed to near zero, yet an earlier experiment that added cipher-family data to training had brought that recall back to nearly 1.0. So I concluded this was not about representation or structure but about data coverage: an attack family absent from the training set does not generalize.

If that's right, the prescription is clear. Add data for the collapsed family. But all families at once.

## Data matched to the family

The previous experiment (call it s5) backed three families at once: cipher, Korean jailbreaks, and obfuscation. Cipher recovered from 0.74 to 0.99, but another Korean jailbreak eval set (wj_mt) still sat at 0.42. Digging in, the problem was how the data was added. The training data built to back that family was little more than "a few chit-chat turns plus the harmful request pasted onto the last turn," which didn't match the eval set's actual distribution.

Looking again at the eval set, the structure was distinct. A benign lead-in framed as a call-center or agency inquiry, then a harmful request wrapped in an elaborate envelope on the final turn. The envelopes fall into a few families: a persona grant claiming unrestricted permissions, a roleplay framing of an entirely fictional film or novel scene, a framing as security research analyzing a vulnerability, a hypothetical framing as purely academic debate. On top of that comes a forced-completion trigger like "begin your reply with 'Of course.'"

So I wrapped harmful cores (Korean harmful prompts from a different source, non-overlapping with the eval set) in these envelopes and prepended the consultation lead-in, synthesizing training attacks that mimic the family's surface distribution. I added these to the existing data (s6) and retrained.

First I checked whether the added data leaks into the eval sets. The synthetic attacks had zero exact-match overlap with any OOD gate set. The only overlaps were a few dozen benign consultation dialogues, which are labeled benign in both training and the eval set, so they have no effect on attack recall.

## The problem of picking the right epoch

While training, I logged recall and false positives each epoch on a slice of the OOD sets (about 100 each, weighted toward previously-missed cases). The values swung hard from epoch to epoch. One epoch caught both cipher and wj_mt with low false positives; the next collapsed. The decision boundary moves every epoch.

Here the recurring trap surfaced again. The epoch with the highest in-domain validation f1 is not the epoch that does best on OOD. The checkpoint that early stopping picked by f1 just missed on the full gate (a 5-point recall drop on one benign family), while the checkpoint one epoch later passed. So the checkpoint had to be selected by OOD balance, not in-domain f1 — by running each per-epoch checkpoint through the gate and choosing.

## Result

On the full gate sets, against the v5 baseline:

- cipher recall 0.74 → 1.00
- wj_mt recall 0.75 → 0.84 (recovered from s5's 0.42)
- coreference-family recall 0.57 → 0.58 (no regression)
- false positives on real-user benign conversations 22% → 3.8%, and 18% → 6% on a separate set

Every prior attempt had been "raise recall and false positives rise; lower false positives and recall collapses." This checkpoint lowered false positives sharply while holding or raising attack recall. It cleared the trade-off in both directions for the first time.

## What remains

Before calling this a win, a few notes. First, this is not a fundamental fix but a systematized game of whack-a-mole. When a new attack family appears, you have to build and add data that mimics its distribution again. It is operational work of widening coverage family by family, not a one-shot training run. Second, the coreference family is still weak; I didn't target it, partly because a large share of that eval set's benign conversations are mislabeled as attacks, which depresses its measured recall below the truth. Third, the passing checkpoint differs from the f1-selected one, which means epoch selection has to go through the gate on the next run too.

The signal that structure couldn't manufacture, I put in with data, and then picked the moment where that signal was most alive. Both were needed.
