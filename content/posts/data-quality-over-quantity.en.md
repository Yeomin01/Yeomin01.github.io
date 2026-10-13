---
title: "Data Quality Over Quantity — LIMA, and What More Epochs Cannot Make Up For"
date: 2026-05-28
draft: false
tags: ["paper review", "LLM", "fine-tuning", "data quality", "LIMA"]
categories: ["Data"]
summary: "When performance falls short, the common response is to add more data or more epochs. But a pattern that is not in the data is not created by repeated training. This post covers the 'quality over quantity' result of the LIMA paper and the limit of epochs I confirmed firsthand."
---

## The common responses when performance falls short

When performance is low on a particular kind of output, two things usually come to mind.

1. Add more data.
2. Add epochs and train longer.

Both look reasonable, but they do not always work. The outcome depends on what is missing.

![Pushing on data volume vs selecting well](/images/scaling_power_vs_exp.png)

## LIMA: 1,000 high-quality examples

Zhou et al. (2023), *LIMA: Less Is More for Alignment*, takes on the conventional wisdom about data volume.

- They ran supervised fine-tuning of a 65B LLaMA model on only 1,000 carefully selected prompt-response pairs.
- They used only this data, with no RLHF or separate preference modeling.
- The result produced responses competitive with a model trained on 52,000 examples and with models aligned by RLHF.

The paper reports a clear quality gap between a model trained on filtered data and a model trained on unfiltered data. That is, the quality of selection can decide the outcome more than the amount of data.

## What more epochs cannot make up for

I have a case I confirmed firsthand. Performance on a particular kind of output was low, so I tried more epochs, and it barely improved.

The cause was simple. The training data had almost no patterns of that kind. A model cannot produce through repeated training what is not in the data. More epochs only memorize the existing data further; they do not teach a distribution that is absent.

If anything, repeated training on the same data sometimes brought a slight performance drop (overfitting) on other kinds of output. The answer was not more epochs but adding the missing patterns to the data. That performance went up only after I supplemented the data.

## In summary

- Data quality can matter more than quantity. LIMA showed that 1,000 well-selected examples can stand comparison with large-scale data.
- More epochs do not teach a pattern that is not in the data. Repeated training only reinforces what is there.
- First tell apart whether the cause of low performance is "not enough training" or "the pattern is not in the data." If it is the latter, what is needed is supplementing the data, not more epochs.

Even when adding data, it is more efficient to select toward filling in the missing distribution than to simply add volume.

---

### References

- Zhou, C. et al. (2023). *LIMA: Less Is More for Alignment.* arXiv:2305.11206. (NeurIPS 2023)
