---
title: "No Architecture Invents a Signal That Isn't There"
date: 2026-07-01
draft: false
tags: ["LLM", "security", "detection", "representation", "architecture", "generalization"]
categories: ["Model Design"]
summary: "I had diagnosed the false-positive/recall trade-off as benign and attack overlapping in embedding space, so I tried a contrastive loss to pull the representations apart. After that failed, I suspected the architecture. I changed four things: a GRU over per-turn encodings, an asymmetric boundary loss, peak aggregation of risk scores, and a turn Transformer. All of them collapsed at the same spot. The conclusion was neither representation nor architecture, but data."
---

## Continuing

In the last post I diagnosed the false-positive/recall trade-off in a multi-turn attack classifier as an overlap problem: benign and attack sit in the same region of embedding space. I wrote that a supervised contrastive loss, by pulling the two clouds apart, would make the threshold stop being a trade-off.

That run failed. With a weak λ (raw CLS, no projection) cipher recall rose a little, from 0.16 to 0.35, but adding a projection head and increasing λ dropped it to 0.002. The symmetric contrastive loss pulls same-class together and pushes different-class apart, and pushing attacks away dragged the benign representations down with them. The approach meant to separate representations instead collapsed the benign side.

## Suspecting the architecture

If a representation loss wouldn't do it, maybe the problem was structural. Recent papers share one observation: a model encodes a multi-turn jailbreak as benign until the final turn. Concatenate the whole session into one sequence and classify it, and that signal is averaged away. So I moved toward splitting the session into turns and modeling the trajectory, and tried four things in turn.

- **Per-turn encoding + GRU.** Encode each turn separately, accumulate a risk trajectory with a GRU, and classify from the last real turn's hidden state (the DeepContext/TrajGuard family).
- **Asymmetric boundary loss.** Since the contrastive loss was symmetric and broke the benign side, I compressed benign toward a centroid to anchor it and pushed only the attacks past a margin, without pulling attacks together (the X-Boundary family).
- **Peak aggregation of risk.** Emit a scalar risk per turn and aggregate not by mean but by the highest-risk turn (peak), accumulation, and the last turn (the Peak+Accumulation family).
- **Turn Transformer.** Instead of the GRU's sequential compression, put self-attention over the turn embeddings to look at cross-turn references directly.

## Every epoch, asking again with what it used to miss

While changing the architecture I also added one observation tool. The in-domain validation set clears an f1 of 0.98 under any of these structures. That number distinguished nothing. So right after each epoch's validation, I sampled about 100 examples from several out-of-domain sets, balanced across attack and benign, and logged recall and false positives separately. The sample was drawn to prioritize cases the earlier baseline had gotten wrong.

The probe surfaced one thing immediately. The epoch with the highest in-domain f1 was the epoch with the lowest OOD attack recall. The "best" checkpoint that early stopping picked by f1 was, seen from outside, the point that barely caught attacks. The longer training ran, the more it overfit in-domain and the more the OOD attack signal disappeared.

## Collapsing at the same spot

The promotion-gate results for the four structures all pointed the same way. False positives fell nicely. The trajectory model cut benign-conversation false positives from 22% to 2%. But attack recall collapsed with them.

- Trajectory GRU: cipher 0.74 → 0.60, wj_mt 0.75 → 0.13
- Asymmetric boundary loss: cipher 0.74 → 0.03, wj_mt 0.75 → 0.09
- Peak aggregation: cipher at 0 from epoch 3 on

The lower false-positive rate came not from holding the benign side well but from moving to a corner that predicts everything benign. Separate the representations, follow the trajectory, watch the peak, connect turns with attention — the result landed in the same place.

## Diagnosis

The clue was that every structure collapsed to near zero specifically on cipher. The cipher set is an attack built on an English substitution-cipher structure, and the training set contains nothing from that family. In an earlier experiment, when I built training data with the same substitution-cipher structure and added it, cipher recall recovered to nearly 1.0. What stayed at zero under every architecture came back the moment one data family was added.

So this was neither representation overlap nor sequence-aggregation method. It was a data-coverage problem: an attack family absent from the training set does not generalize under any encoder architecture. In the last post I wrote that the approach hinged on whether the representations were separable. There was a prior condition: whether the signal exists in the training data at all. A signal that isn't there cannot be manufactured by a loss or by a structure.

## What's left

So I think the attempt to break the wall with a single encoder should stop here. The one thing that actually worked was adding data for the collapsed attack family, and that is operational work of widening coverage family by family, not a one-shot structural change. Moving the threshold outside the model, to the gateway, and treating false positives as an operational parameter sits on the same realization. The failure of the past few weeks was looking inside the model for something the model never had.
