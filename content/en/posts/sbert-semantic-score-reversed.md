---
title: "Pre-trained Embeddings Pointed the Wrong Way for Toxicity Detection"
date: 2026-06-24
draft: false
tags: ["LLM", "embeddings", "SBERT", "detection", "multi-turn", "security"]
categories: ["Model Design"]
summary: "We used Korean SBERT to measure a 'harmful direction' signal for a multi-turn attack classifier. The AUC came back at 0.375 — the harmless sessions scored higher than the attacks. Here's what went wrong and how switching to the fine-tuned classifier's own CLS embeddings fixed it."
---

## What We Were Trying to Measure

A session-level multi-turn attack classifier produces a base attack probability, but we wanted an additional signal: does the semantic content of the conversation drift toward harmful territory as turns progress?

The intuition was straightforward. Attack sessions tend to start benign and reveal intent in the last turn. If we could measure the directional shift of the utterances in embedding space, we'd have a complementary signal on top of the base model's probability.

The implementation looked reasonable on paper. Take a Korean SBERT model, encode a set of "harmful" anchor sentences and a set of "benign" anchor sentences, compute the average vector for each, and define the unit vector from benign-center to harm-center as the harmful direction. Then for each session, project the difference between the first and last turn's embedding onto that direction. Positive means drifting toward harm; negative means drifting toward benign.

## AUC 0.375

Full-dataset AUC was 0.522. Korean-only was 0.375.

0.5 is random chance. 0.375 means the signal is inversely correlated with the true label — benign sessions were scoring *higher* than attack sessions on our "harmful direction" measure.

We tried swapping the anchor sentences for more explicit ones. Same result. We increased the number of anchors from 8 to 30. Same result. We tried Euclidean distance instead of cosine projection. Same result.

## Why It Failed

Looking back, the root cause is straightforward: the SBERT embedding space isn't organized around "harmfulness." SBERT (and general-purpose sentence embedding models) are trained for semantic similarity — sentences with similar meaning are close, sentences with different meaning are far. Harmfulness isn't a dimension in that space.

Korean multi-turn attacks frequently use benign-looking language to disguise intent. In SBERT space, they end up close to ordinary conversation. Meanwhile, some perfectly benign technical discussions use terminology that happens to sit near the harmful anchors.

DeepContext (arXiv 2602.16935) makes this point directly: intent drift detection works when the embeddings are *fine-tuned for the task*. A pre-trained model has never seen the attack/benign distinction, so unrelated axes dominate and drown out any signal we're trying to extract.

## Switching to the Classifier's Own Embeddings

The fix was to stop using SBERT entirely and use the last-layer [CLS] representation from the classifier itself.

The process: run all training sessions through the classifier and collect [CLS] vectors. Compute the average for attack sessions and the average for benign sessions. The difference vector becomes the harmful direction. For new sessions, extract [CLS] during the regular forward pass and project onto that direction.

This embedding space is *already organized* around the attack/benign distinction — the classifier was trained to separate them. There's no need to hand-craft anchors, and the direction can't accidentally point the wrong way. The anchors are determined by the actual training distribution.

The reverse-correlation problem disappeared immediately after switching.

## Takeaways

- Pre-trained embedding spaces don't contain a "harmful direction" for your specific task.
- Changing anchors or increasing their count doesn't fix the structural mismatch.
- The classifier's own embedding space has already been organized around the task. Computing centroids from training data gives you a direction that's actually aligned with what you're measuring.
- As a side benefit, the anchor-building step can be automated and re-run whenever the model is retrained.
