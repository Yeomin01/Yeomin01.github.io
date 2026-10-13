---
title: "Pruned, and the Same Template Is Still There Dozens of Times — The Limits of Semantic Dedup"
date: 2026-06-01
draft: false
tags: ["LLM", "data-pruning", "dedup", "embedding", "synthetic data"]
categories: ["Data"]
summary: "Prune with embedding-based semantic dedup and the same template can still survive dozens of times. This post covers why that happens, which dedup tools suit slot-synthesized data, and how to choose tools by the data's origin."
---

[The previous post](/en/posts/data-pruning-scaling-laws/) and [the post on the 3-stage data selection pipeline](/en/posts/data-selection-pipeline/) covered the idea that "choosing data well and cutting it down keeps or improves performance," and its implementation. But apply it yourself and you hit an unexpected trap: **the data clearly went through dedup, yet the same template has survived dozens of times.**

This post covers what that trap is, why embedding-based semantic dedup falls short on slot-synthesized data, and which tools to choose.

## The finding — looking inside semantically deduped data

In the 3-stage pipeline, Stage2 uses embeddings + k-means clustering + stratified keep to cut the data in half while preserving diversity. Generate 15K of synthetic data and look inside, and cases like the following are common.

```
21 occurrences: I had no access to the doc link, so I asked [NAME] again.
19 occurrences: I'll have [NAME]'s account permissions sorted out by Friday.
15 occurrences: [NAME], could you check just once whether the QA fix went in?
...
```

The same template with only the NAME slot changed survives as many as 21 times. This is the result after semantic dedup. Why?

## Embedding dedup groups things with the same meaning

First, how semantic dedup works. It usually has two steps.

1. **An embedding model (for example, SBERT)** converts a sentence into a 768-dimensional vector. It is trained so that sentences with similar meaning sit close together in vector space.
2. **Clustering such as k-means** groups nearby vectors, and from each cluster a keep-ratio share of samples is kept.

All the judgment about "meaning" here is done by SBERT. k-means is simply an algorithm that groups nearby points, so it behaves the same whether the input is vectors that carry meaning or random ones.

The problem lies in the nature of slot-synthesized data. Look at these three sentences.

```
"I made the transfer to Hong Gildong"
"I made the transfer to Kim Cheolsu"
"I made the transfer to Lee Sujin"
```

To SBERT these three mean almost the same thing. They share the same semantic structure, "transfer + to + [person's name]," and differ only in the slot. The cosine similarity of the embedding vectors is 0.95 or higher, which is very close. → grouped into the same cluster → with stratified keep at 50%, half survive → the same template is still there many times over.

![Semantic dedup vs surface dedup — different results on the same data](/images/dedup_semantic_vs_surface.png)

The figure above simplifies that situation. When 10 slot variants are packed tightly inside one cluster, semantic dedup keeps 5 of them, but those 5 are still the same template. Surface dedup looks at the surface form within the cluster and keeps only 1 representative.

## Meaning ≠ surface — two kinds of duplication

Data dedup has to distinguish two kinds of duplication.

**Semantic duplication** — sentences that are worded differently but mean the same thing
```
"I'll send you the report by tomorrow."
"The write-up will be delivered to you before the end of tomorrow."
```
→ The surface (word sequence) differs but the meaning is almost identical. They gather close together in embedding space. This is the territory embedding dedup catches.

**Surface duplication** — sentences whose surface is nearly the same and whose meaning is the same too
```
"Transfer to Hong Gildong complete"
"Transfer to Kim Cheolsu complete"
"Transfer to Lee Sujin complete"
```
→ Near-duplicates that differ by only a word or two. The embedding distance is very small, but under a setting like a 50% keep ratio in embedding dedup, many survive.

Which kind of duplication dominates depends on the data's origin.

- **Data written freely by people or by several LLMs** — semantic duplication dominates. The wording varies, but the same thing is said repeatedly. Embedding dedup has a large effect.
- **Slot-injection synthetic data** — surface duplication dominates. It is the result of mass generation from the same template with only the slots changed. Surface dedup is needed.

Handle both with the same tool without telling them apart, and the result falls short on one side.

## Surface dedup tools

There are several tools for surface dedup. Choose by data scale and by how much precision is required.

**Skeleton hash** — the simplest. Replace the entity values with placeholders, then hash. The same hash means the same template.
```python
def skeleton(text, entities):
    t = text
    for e in entities:
        t = t.replace(e["text"], f"[{e['type']}]")
    return hashlib.md5(t.encode()).hexdigest()
```
It fits slot-synthesized data best. Exact and fast.

**n-gram Jaccard / overlap** — judges by the overlap ratio of the two sentences' word n-gram sets. At or above a threshold (for example, 0.8) the pair counts as a duplicate. It also catches near-duplicates whose slots differ slightly.

**MinHash / SimHash** — the standard algorithms for surface dedup in O(N) on large-scale data (hundreds of millions to billions of documents). Proposed by Broder (1997). The standard for cleaning recent LLM pre-training corpora (RefinedWeb, DCLM, and others).

All three are complementary to embedding dedup. One does not replace the other.

## Recommendation — dedup combinations by data origin

| Data origin | Recommended dedup |
|---|---|
| Slot-injection synthetic data | **Surface dedup first (skeleton hash)** → semantic dedup as support |
| High-diversity data such as human-written or generated by several LLMs | Mainly **semantic dedup (embedding + clustering)** |
| Large-scale corpus (hundreds of millions of documents+) | Surface with **MinHash / SimHash** → embedding dedup as support |
| Common to all cases | **Quality filter** first, before dedup. So that noise does not pass itself off as an "unusual sample" in a diversity cluster. |

The key point: for dedup, first look at **which kind of duplication dominates in the data**, then choose the tool. Embeddings are powerful, but against surface duplication they deliver only half the effect.

## Takeaways

- Embedding-based semantic dedup groups items into the same cluster and then keeps a keep-ratio share, so when one cluster holds dozens of surface near-duplicates, as with slot synthesis, many survive.
- Semantic duplication (different wording, same meaning) and surface duplication (nearly the same surface) are different kinds of duplication, and they need different tools.
- For slot-injection synthetic data, **surface dedup first + semantic dedup as support** is the right fit.
- "I ran dedup" does not guarantee "the duplicates are all gone." Open up the output once and check which duplicates survived.

---

## References

- Sorscher, B., Geirhos, R., Shekhar, S., Ganguli, S., Morcos, A. S. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning*. NeurIPS. — the theoretical basis of data pruning. See [the separate post](/en/posts/data-pruning-scaling-laws/).
- Lee, K., Ippolito, D., Nystrom, A., et al. (2021). *Deduplicating Training Data Makes Language Models Better*. ACL. — shows quantitatively the effect of deduplicating training data.
- Broder, A. Z. (1997). *On the resemblance and containment of documents*. Sequences. — the original MinHash paper.
- Reimers, N., Gurevych, I. (2019). *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks*. EMNLP. — the core tool for semantic dedup.
- Penedo, G., Malartic, Q., Hesslow, D., et al. (2023). *The RefinedWeb Dataset for Falcon LLM*. NeurIPS. — a case of applying MinHash to a large-scale corpus.
