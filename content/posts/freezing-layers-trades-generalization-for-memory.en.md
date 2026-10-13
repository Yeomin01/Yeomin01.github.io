---
title: "Frozen Layers Save Memory and Cut Generalization"
date: 2026-07-28
draft: false
tags: ["fine-tuning", "GPU", "memory", "troubleshooting", "NER", "optimizer"]
categories: ["Engineering"]
summary: "While fine-tuning a token classification model on a GPU shared with other processes, memory got tight. I shrank the batch, tried bf16, and in the end solved the problem by freezing the lower layers, but recall on a real-usage text benchmark turned out to have been cut sharply. It was a regression I would have let through had I not diversified the kinds of benchmarks."
---

I was fine-tuning a Korean named entity recognition (NER) model with a BERT-family encoder + CRF head. There was one GPU, and another service process already held most of its memory, so the headroom left was less than 2GB. The usual batch size hit OOM right away. This is the story of the things I tried in order to squeeze training into that headroom, and of picking one of them wrongly along the way.

## Why shrinking the batch did not work

The first thing I did was reduce the batch size. Going from 8 to 2, the forward and backward passes got through, but the optimizer step hit OOM again. At first I did not understand why it was stuck here even though I had shrunk the batch.

The cause was that optimizer state is a fixed cost that has nothing to do with batch size. AdamW holds first and second moments (exp_avg, exp_avg_sq) separately for every parameter. With 100 million parameters, the two moments alone, even in fp32, need twice the size of the parameters themselves, and with the gradients added, close to three times, as fixed memory. This cost is the same whether the batch is 1 or 8. Shrinking the batch reduces activation memory, but the optimizer state stays as it is, gets allocated all at once on the first step, and that is where it fails.

## Cutting with bf16 turned the loss into NaN

To cut the memory in half, I switched the model, the gradients, and the optimizer state all to bf16. This runs in pure bf16 without fp32 master weights. Memory clearly went down, but within a few hundred steps the loss diverged to NaN.

The cause was in AdamW's denominator calculation. The update size is divided by `sqrt(exp_avg_sq) / bias_correction + eps`, and the default eps (1e-8) is a value for fp32. bf16 has only a 7-bit mantissa, so its relative precision is much lower, and in the early steps where the denominator is small, eps is buried in rounding error and is treated as effectively close to 0. When the denominator collapses, the update momentarily gets large, and that one step makes the whole run diverge. It reproduced even with a larger eps (1e-5). The memory fit, but the accuracy risk was too large, so I dropped this direction.

## Why gradient checkpointing did not help

Next I turned on gradient checkpointing. It does not store activations for the backward pass and recomputes them when needed, so it cuts activation memory substantially. But the point of the OOM and the amount of memory requested were almost the same as before.

It was the expected result. The point where the OOM happened was the optimizer step, after the activations had all been cleaned up, and the memory needed there was optimizer state, not activations. Checkpointing works well on activation memory problems, but it is a technique that does not touch the fixed cost of optimizer state in the first place. Without pinning down the cause of the memory shortage exactly, turning on a well-known saving technique may have no effect at all.

## In the end I made it fit by freezing the lower layers

The remaining option was to reduce the trainable parameters themselves. I froze the embeddings and the lower half of the encoder layers, and trained only the upper layers and the classification head as before. Frozen parameters need neither gradients nor optimizer state, so the fixed cost shrinks by that much. When I simulated it with full 512-token sequences, including the evaluation batch, it fit with room to spare, and the actual training also ran normally without NaN.

Had I stopped here, it would have ended as "solved the memory problem".

## But recall had collapsed on real-usage text

After training finished, I evaluated on several benchmarks. On the clean synthetic test set there was no big difference from the previous version. But on one benchmark close to real conversational text, recall for person-name entities had dropped from 0.43 to 0.13, and recall for address entities had dropped by nearly half too. The other entity types, which are handled by fixed-format rules, were completely identical between the two versions. The problem appeared only in the entity types the model has to judge itself, and only in natural sentences.

Even with layers frozen, the upper layers and the head are still trained, so the loss went down normally and the metrics on the clean test set were not bad either. The lower layers stayed fixed at the representations from pre-training time, so the model did not generalize well to the varied expressions of real conversational text, but what was lost barely showed on the clean test set. Had I not run one more benchmark, I would have moved on with "memory solved and the metrics are fine".

Later the other process released the GPU and there was headroom, so I trained again on the same data without freezing layers. This time that recall drop was not there. In the end, layer freezing was a stopgap made by the memory constraint, and removing it as soon as the constraint lifted was the right choice.

## Takeaways

- Even if you shrink the batch, the optimizer state (a fixed cost proportional to the parameter count) stays as it is. If the OOM point is the optimizer step, look here rather than at the batch.
- Pure bf16 training can diverge because AdamW's default eps is too small and the denominator collapses. Even if memory goes down, stability has to be checked along with it.
- Gradient checkpointing only works on activation memory. If the cause of the OOM is optimizer state, it has no effect.
- When a memory problem is solved by freezing layers, the training loss and the clean test set metrics can look normal. What was actually lost showed only on a benchmark of natural real-usage text. A workaround chosen because of a memory constraint should have its results doubted again first, once that constraint is gone.
