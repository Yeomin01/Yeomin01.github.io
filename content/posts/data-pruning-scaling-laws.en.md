---
title: "Training Better on Less Data — A Close Read of Beyond Neural Scaling Laws"
date: 2026-05-28
draft: false
tags: ["paper review", "data curation", "data-pruning", "scaling-law", "efficiency"]
categories: ["Data"]
summary: "Add data indiscriminately and performance rises by a power law, that is, more and more slowly. Sorscher et al. (NeurIPS 2022) showed with theory and experiments that a good selection criterion can break this limit and come close to exponential scaling. I go through the paper in detail from the standpoint of wanting to pick a high-impact subset instead of using all of a dataset on the order of 1 million examples."
---

I read this paper at the stage where I had built a large synthetic dataset and was asking "do I have to train on all of this, or can I pick just part of it?" The conclusion first: a well-chosen part can be better than the whole, and there is a principle behind "well-chosen."

- Paper: Sorscher, B., Geirhos, R., Shekhar, S., Ganguli, S., Morcos, A. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning.* NeurIPS 2022 (Outstanding Paper Award). arXiv:2206.14486.

## 1. Background: the limits of scaling laws

A neural network's performance improves as data, model, and compute are scaled up, but the improvement follows a **power law**. That is, the error falls with the amount of data N roughly as `error ∝ N^(-α)`.

The problem is that this curve keeps flattening. Halving the error takes several times more data, and past some point even a large increase in data barely raises performance. A strategy of pushing on volume quickly gets worse in cost efficiency.

The paper's question is this. **Instead of adding more data, can choosing the data well break this power law itself?**

## 2. Core claim: with a good pruning criterion, exponential scaling is possible

The paper's claim is that with a **data pruning metric** that sets a good order for discarding training examples, performance can improve with the amount of data not by a power law but **close to exponentially**.

In other words, rather than adding data indiscriminately, sort it by value and discard the less important examples first, and the same amount of data gives much better performance. The authors verified this prediction by training ResNets on CIFAR-10, SVHN, and ImageNet.

## 3. Method: sort by difficulty, analyze with statistical mechanics

Each example is assigned a **difficulty**, and the examples are sorted by it. Difficulty is usually defined as "how hard the model finds this example" (for example, teacher margin or prediction uncertainty).

The paper analyzes data pruning analytically with **statistical mechanics** in a student-teacher setting. It derives theoretically that when examples are discarded by teacher margin, the optimal strategy changes with the initial amount of data, and it gives the conditions under which exponential scaling is possible.

## 4. The most important insight: what to discard depends on the amount of data

This is the most practical conclusion in the paper.

> It is better to **keep the hard examples when data is abundant** and to **keep the easy examples when data is scarce**.

Intuitively:

- When data is scarce: the model has not learned even the basic patterns well enough. Keeping only hard examples at this point makes training unstable. It is better to build the foundation with easy (typical) examples.
- When data is abundant: the basic patterns have already been learned well enough. Seeing more easy examples teaches nothing new. Here the hard examples near the decision boundary carry a lot of information.

So it is not that "hard data is always valuable." **The priority flips with the amount of data I have.** The larger the dataset, the more it pays to keep mostly hard examples.

![Which examples to keep flips with the amount of data](/images/data_pruning_strategy.png)

(This is a schematic to explain the concept. For the paper's experimental graphs and the performance of the self-supervised metric, see arXiv:2206.14486.)

## 5. Self-supervised pruning that works without labels

Measuring difficulty does not strictly require labels. The paper proposes a label-free self-supervised method.

- Run **k-means clustering** in the embedding space of a self-supervised model.
- Define each example's difficulty as **the distance to the nearest cluster center**.
- Examples close to a center are the "typical (easy)" ones, and examples far from one are the "hard" ones.

This self-supervised criterion performed comparably to the best-performing supervised criterion that uses labels (memorization-based), down to the range where 70–80% of the data is kept. It is practical in that data selection becomes possible without labeling cost.

## 6. Limitations

- The result depends heavily on the quality of the difficulty metric. Without a good metric it is no better than random pruning.
- Pruning too aggressively (for example, keeping only hard examples to an extreme) also keeps noise and outliers, and performance can drop instead.
- It was validated mainly on vision classification. When moving to text or generation tasks, the definition of difficulty and the effect have to be checked again.

## 7. Applying it to our situation

For someone holding a large synthetic dataset (several hundred thousand to a million examples made by slot injection), the points to take away are these.

- **Training on all of it can be inefficient.** Synthetic data repeats its structure, so it has far too many easy (typical) examples. Past a certain level these add little to training.
- **Since data is abundant here, the strategy of keeping mostly hard examples is the right one.** Typical patterns are learned from a small amount, and the hard cases with ambiguous boundaries carry the additional information.
- **Selection is possible without labels.** Measuring typicality by the distance to the cluster center in embedding space makes it possible to cut duplicate and typical examples and secure diversity and difficulty.
- However, synthetic data also has noise mixed in, so the extreme of the hard end (label errors, abnormal sentences) has to be filtered out separately. Data pruning and quality filtering have to go together.

In short, "what do I keep from the data I have now" comes before "should I make more data." The more data there is, the more both theory and experiment support raising the share of hard examples.

## 8. One-line summary

Pushing on data volume along the power law is inefficient, and selecting by value can get past that limit. The core rule is "keep the hard ones when data is abundant and the easy ones when it is scarce," and selection is also possible without labels, by embedding cluster distance.

---

### References

- Sorscher, B. et al. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning.* NeurIPS 2022 (Outstanding Paper Award). arXiv:2206.14486.
- (Related) Zhou, C. et al. (2023). *LIMA: Less Is More for Alignment.* — the effect of a small amount of high-quality data.
