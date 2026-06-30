---
title: "Separating the Representations Instead of Shifting the Boundary"
date: 2026-06-30
draft: false
tags: ["LLM", "security", "detection", "contrastive-learning", "representation", "design"]
categories: ["Model Design"]
summary: "Every time we added benign data to cut the multi-turn guard's false positives, attack recall collapsed. After failing the same way six times, the conclusion was that this is not a data-balance problem but an overlap problem: benign and attack sit in the same region of embedding space. If cross-entropy draws a boundary through the overlapping cloud, supervised contrastive pulls the clouds apart. The run is still training; this post records why we got here."
---

## The Repeated Failure

The goal was to cut false positives in the multi-turn attack classifier — cases where a normal conversation gets blocked as an attack. Mining real WildChat conversations into the training set dropped false positives nicely, from around 22% to 1%. The problem was that attack recall collapsed every time it did.

- Benign-only swap, small dose: cipher recall 0.74 → 0.20
- Benign + class weight: 0.74 → 0.05 (worse)
- Benign + same-family attacks: cipher recovered 0.74 → 0.99, but now a *different* attack family (wj_mt) collapsed, 0.75 → 0.20

That last case was the interesting one. When an attack family collapsed under benign injection, **adding training attacks of the same family brought it back.** The cipher eval set is built from English substitution-cipher prompts, so generating training data with the same substitution-cipher structure pushed recall back up to nearly 1.0.

But it could not protect the other families at the same time. Benign data pushes back on *every* attack family whose surface it shares, all at once, while we could only prop up one family at a time. It was whack-a-mole.

## The Diagnosis

After going through this six or so times, the pattern was clear. False positives drop and recall collapses together because the two are a **trade**. And a trade means benign and attack overlap in the model's representation space.

A long, elaborate multi-turn benign conversation (coding help, lesson plans, role-play, knowledge deep-dives) and a long, elaborate multi-turn attack (gradual jailbreak, persona impersonation) look alike on the surface. The model places them near each other in embedding space. Cross-entropy then draws a single boundary through that overlapping cloud. Push the boundary toward benign (fewer false positives), and the attacks that sat inside the same cloud get dragged across it (recall collapses); push it the other way and you get the reverse. Whichever side you add data to, you are only moving the threshold.

This also explains why same-family attacks worked, briefly. That was not moving the boundary — it was **pulling that family's attack representation out of** the benign cloud. Just one family at a time.

## Representation, Not Boundary

So instead of peeling off every family one by one, train so that the representation itself splits into benign and attack. Supervised contrastive loss does exactly that.

Within a batch, it normalizes each sample's CLS embedding and pulls same-label samples together while pushing different-label samples apart. It runs alongside cross-entropy.

```
total_loss = CrossEntropy + λ · SupCon
```

Cross-entropy still learns a decision boundary, but the SupCon term forces the benign and attack embeddings into separate clusters. Once the two clusters actually separate, the threshold between them is no longer a trade. With no overlap, adding more benign no longer drags attacks along.

The implementation is relatively light — pull the last-layer CLS embedding out of the model output and add it to the loss. Contrastive loss gives a better signal when a batch contains more same-class pairs, so we increased the batch size.

## What We Don't Know Yet

Whether this works rests on one assumption: that benign and attack are **separable**. If many of the inputs are genuinely ambiguous — the same multi-turn structure, differing only in intent — then no amount of pulling on the representation will fully separate them. In that case the move would be to change the input representation (include assistant turns, longer context), or to accept that a single model may not be the right tool.

Right now we are training contrastive on top of the exact data (the benign swap) that the plain version collapsed on. If recall holds on the same data, that confirms the cause was representation overlap, not the data. When the numbers come in, I'll write them up.
