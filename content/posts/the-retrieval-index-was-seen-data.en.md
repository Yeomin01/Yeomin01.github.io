---
title: "The Retrieval Index Is Also Data the Model Has Seen"
date: 2026-10-06
draft: false
tags: ["evaluation", "data leakage", "kNN", "embeddings", "gold set"]
categories: ["Data"]
summary: "When building the evaluation set I checked the overlap with the training set, but not the kNN index that serving uses for neighbor examples. The index holds only vectors with no source text, so a text audit does not catch it. When I embedded the evaluation set with the same encoder as serving and compared, one whole language segment of the evaluation set was sitting in the index as is."
---

## The scope of data the model has seen

In a classifier pipeline, there is data other than the trained weights that affects the verdict. In the structure I worked on this time, the combiner stage uses "how benign are the nearest neighbors in the index of benign examples" as a feature. This index is tens of thousands of benign conversations embedded ahead of time, and it is queried on every inference.

While building the new evaluation set, I carefully filtered out overlap with the training set. But I did not include this index in the check, because I did not think of it as training data. Yet if an evaluation conversation is in the index as is, then at inference time that conversation finds itself as its nearest benign neighbor. That is no different from the model having seen the conversation.

## Without the source text, a text audit does not catch it

The index file had only vectors and labels, with no source text. So a character n-gram audit has no way to check it. Instead I embedded the evaluation conversations in exactly the same way as serving and measured cosine similarity against the index vectors. What matters here is "the same way". The comparison happens in the same space only if it follows exactly how serving turns a session into a string, which encoder it uses, and which pooling and normalization it goes through to build the query vector. I called the pipeline's query function as it is.

## One whole segment was in there

The results split sharply by axis. Korean work and document conversations were mostly in the 0.7 range. That is about the similarity you get between different conversations in the same domain. The English benign conversation segment, in contrast, was at cosine 1.000 throughout. These were not close vectors; they were the same vectors.

The cause was the source. I had drawn the English benign evaluation data from a public conversation log corpus, and the benign index had been built from the same corpus. The comparison against the training set did not catch it because the conversations that went into the index were not in the training set. By traffic weight, this segment was an axis that accounted for about one fifth of the overall false positive rate, so its effect on the evaluation result was not small either.

On the attack side too, some items exceeded 0.95. There had long been a record that part of a public safety dataset was mixed into the index, and its effect showed up in some of the evaluation attacks.

I set the threshold at 0.95. Identical conversations clustered near 1.0 and different conversations in the same domain at 0.7–0.85, so the range between them was empty. From the 0.90–0.95 range, only a few items were left as ones to check.

## Make the list first

Since this, whenever I build or revise an evaluation set, I start by making a list of "what the model has seen".

- Data used to train the weights
- Data used to calibrate thresholds and gates
- Indexes, examples, and dictionaries queried at inference time
- Examples that go into the prompt

The audit method depends on whether each item survives as text or only as vectors. If it is text, n-grams; if there are only vectors, proximity under the same embedding as serving.

## Takeaways

A leakage check that compares only against the training set misses the data used at inference time. A retrieval index has no source text and so is not caught by a text audit, but it affects the verdict as directly as training data does. If the evaluation set and the index are built from the same corpus, the evaluation on that segment becomes a measurement of items finding themselves as neighbors. This time I decided to take that segment out of the evaluation set and refill it from a different source.
