---
title: "A 3-Stage Pipeline for Selecting Large-Scale Synthetic Data — Method Comparison and Design"
date: 2026-05-28
draft: false
tags: ["data curation", "data-selection", "synthetic data", "data-pruning", "efficiency"]
categories: ["Data"]
summary: "Generate synthetic data in bulk and duplication, noise, and distribution bias come with it. This post compares data selection methods (Sorscher, DEITA, Confident Learning, and others) and designs a 3-stage selection pipeline fitted to the characteristics of synthetic data. It is a design that has not been validated yet, and I plan to add results after testing."
---

> Status: design stage. The pipeline below has not yet been validated by experiment. I will add the results to this post after testing.

## Background: three problems with synthetic data

Generating synthetic data in bulk with an LLM makes volume easy to get, but three problems come with it.

1. **Duplication and typicality** — reusing templates or slots produces far too many sentences with similar structure. The volume is large, but the amount of information does not grow in proportion.
2. **Label noise** — labels produced by a generative model contain boundary errors, particle-handling errors, and mislabels.
3. **Distribution bias** — certain categories or domains are over- or under-represented.

Making more data does not solve these problems. As seen in [the data pruning paper](/en/posts/data-pruning-scaling-laws/), the power-law strategy of adding volume is inefficient. What is needed is selection.

## Comparing data selection methods

| Method | Core idea | Labels needed | Cost | Problem addressed |
|---|---|---|---|---|
| Sorscher 2022 (data pruning) | Measure difficulty by distance to the embedding cluster center. With abundant data, hard examples first | X | Low | Duplication, typicality |
| DEITA (ICLR 2024) | Combines complexity × quality + diversity. SOTA with a small amount | LLM judge | Medium | Quality, diversity |
| AlpaGasus / IFD / INSTAG | Quality scores from an LLM, instruction difficulty, tagging diversity | LLM judge | Medium to high | Quality, diversity |
| Confident Learning (Cleanlab) | Detect label errors from model prediction probabilities (supports NER/token) | Model predictions | Low | Noise |

The common consensus in selection research is "a good dataset = quality × diversity × appropriate difficulty (complexity)." DEITA combined the three and showed performance on par with a large dataset using little data.

## Why they are hard to apply to synthetic data as they are

The methods above mostly assume "the labels are clean." But synthetic data has noise mixed in, and problems arise unless the noise is filtered out first.

- Apply difficulty-based selection (hard examples first) without removing noise, and **mislabels get classified as "hard examples" and survive.** It backfires: the noise ends up emphasized.
- Diversity-based selection can also pick noise, because it looks like an "unusual example."

So with synthetic data, **noise removal has to come before selection**.

## Design: a 3-stage selection pipeline

It handles the three problems (noise, duplication, bias) in order.

```
Stage 1 quality filter (quality)                — remove label noise
   ↓
Stage 2 diversity selection (diversity)         — remove duplicates and typical examples
   ↓
Stage 3 distribution correction (importance)    — adjust the share of weak categories and domains
```

![3-stage selection pipeline for synthetic data](/images/selection_pipeline.png)

### Stage 1: quality filter (noise removal)

First, remove the obvious label errors.

- Rule-based checks: whether the label boundaries match the text, whether a particle was wrongly included, whether the format constraints are met.
- Confident Learning: flag examples whose label disagrees strongly with the model's predicted probability as error candidates.
- Where needed, an additional review by an LLM judge for the ambiguous cases only.

Removing what the rules catch first reduces what has to go to the expensive LLM review.

### Stage 2: diversity selection (deduplication)

Most of the inefficiency of synthetic data comes from here. This stage uses Sorscher-style self-supervised selection.

- Convert every example into an embedding.
- Cluster in the embedding space and measure each example's distance to its cluster center.
- Reduce the share of examples near the center (typical, duplicate) and keep the diverse ones.
- Since data is abundant here, the typical examples can be cut aggressively.

This stage is the key to cutting the volume sharply while keeping the amount of information.

### Stage 3: distribution correction (weighting the weak spots)

Instead of selecting uniformly, deliberately raise the share of weak categories and domains.

- Identify the categories and domains where performance is currently low.
- Select with a higher proportion of examples from those areas, especially the hard cases with ambiguous boundaries.
- Keep only a minimum of the areas that are already handled well.

This is DEITA's complexity, quality, and diversity rearranged to fit our situation (noise + duplication + weak spots).

## Validation plan

I will set up a comparison experiment to check whether the design actually works.

- baseline: train on all the data
- comparison group: train on the subset selected by the 3-stage pipeline (for example, 20–30% of the whole)
- measurement: performance on the same evaluation set, and training time

The criterion is whether the selected group reaches performance similar to or better than the full group in less time. A stage-by-stage ablation (quality only / quality + diversity / all) will also check the contribution of each stage.

## Takeaways

- Synthetic data has three problems, duplication, noise, and bias, and adding volume does not solve them.
- Existing selection methods mostly assume clean labels, so synthetic data needs a pipeline that puts noise removal first.
- Design: quality filter → diversity selection → distribution correction. It is DEITA's quality, diversity, and complexity reorganized to fit the characteristics of synthetic data.
- It is still a design that has not been validated. I plan to add the results of the comparison experiment to this post.

---

### References

- Sorscher, B. et al. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning.* NeurIPS 2022.
- Liu, W. et al. (2024). *What Makes Good Data for Alignment? (DEITA).* ICLR 2024. arXiv:2312.15685.
- Northcutt, C. et al. (2021). *Confident Learning: Estimating Uncertainty in Dataset Labels.* (Cleanlab)
- Wang, J. et al. (2024). *A Survey on Data Selection for LLM Instruction Tuning.* arXiv:2402.05123.
