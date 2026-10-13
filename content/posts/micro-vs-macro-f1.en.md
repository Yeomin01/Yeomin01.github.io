---
title: "Micro F1 and Macro F1 — Which One You Look at Changes the Decision"
date: 2026-06-01
draft: false
tags: ["LLM", "evaluation", "metric", "F1", "NER", "classification"]
categories: ["Learning Theory"]
summary: "The F1 score comes up often when evaluating classification results, but in a multi-class problem with several classes it does not end at 'one F1'. This post covers the two ways of combining F1 across classes (micro · macro) and how a weak class gets hidden when you look at only one of them."
---

The F1 score almost always comes up when evaluating classification results. But in a multi-class / multi-label problem with several classes it does not end at "one F1": **how you combine the F1 of several classes** already affects the decision. This post covers the difference between micro F1 and macro F1, and which one to look at in which situation.

## Two ways of averaging

Say we classify into 3 classes (A, B, C). TP / FP / FN can be counted separately for each class.

**micro F1** — pool the TP, FP, and FN of all classes into one, and compute precision · recall · F1 on top of that.

```
TP_micro = TP_A + TP_B + TP_C
FP_micro = FP_A + FP_B + FP_C
FN_micro = FN_A + FN_B + FN_C
precision = TP_micro / (TP_micro + FP_micro)
recall    = TP_micro / (TP_micro + FN_micro)
F1_micro  = 2·p·r / (p+r)
```

**macro F1** — compute F1 separately per class, then take the simple average.

```
F1_macro = (F1_A + F1_B + F1_C) / 3
```

On the surface both are "overall F1," but **the weight they give each class differs.**

## A different center of gravity

- **micro**: counts each sample as 1. If one class has 1,000 samples and another has 200, the larger one has 5 times the influence.
- **macro**: counts each class as 1. Whether a class has 1,000 samples or 200, its share of the average is the same.

Here is a concrete example of why this matters.

| Class | support | per-class F1 |
|---|---|---|
| A | 1,000 | 0.97 |
| B | 600 | 0.95 |
| C | 200 | 0.86 |

Computing micro and macro together:

- micro F1 ≈ **0.95** (pulled up by A and B, which have many samples)
- macro F1 = (0.97 + 0.95 + 0.86) / 3 ≈ **0.93**

The difference is about 0.02, but if you only report "this model is 0.95," **the fact that C is 0.86 is not visible from micro alone.** If C is the most important category for the business, or the weak class the model does worst on, that weakness is hidden the moment you decide on micro alone.

![A case where micro and macro point to different models](/images/micro_vs_macro_decision.png)

As in the example above, looking at only one metric can flip which of two models is better. By micro alone Model X is ahead, but if the gap on the weak class C (0.85 vs 0.91) matters more to the business, Model Y, the one macro points to, is the right choice.

## When to look at which

**When micro F1 fits**
- When the classes are distributed in similar proportions.
- When one error costs the same regardless of class (per-sample evaluation is the natural fit).
- Domains that use micro by convention, such as the standard NER benchmarks (CoNLL and others).

**When macro F1 fits**
- When the class distribution is imbalanced and you want minority-class performance evaluated on equal terms.
- When you want to keep a weak class from being buried in the overall score.
- When you want to see "does the model do well on *all* classes evenly."

There is also **weighted F1** (per-class F1 averaged with each class's support as the weight). It is the macro average weighted in proportion to support, so it usually comes out close to micro. In practice it is common to look at just micro and macro.

## The trap — deciding on only one

A pattern that often comes up in real cases:

- Newly trained model X: micro 0.92, weak-class F1 0.85
- Comparison model Y: micro 0.91, weak-class F1 0.88

By micro alone X is ahead, but if the weak class is the most important category for the business, Y may be the better choice. You can judge that **micro being 0.01 higher does not offset a 0.03 gap on the weak class**.

Conversely, looking only at macro can set the wrong priorities when the classes are not all equally important. The decision ends up swayed by F1 swings in a minority class that almost never appears in production.

## Practical recommendation

Do not stop at one metric. Usually look at the following together.

- **micro F1** — the conventional headline. The basis for comparison with other models and benchmarks.
- **macro F1** — a check on balance across classes. If there is a large gap from micro, suspect class imbalance / a weak-class problem.
- **per-class F1** — the real information about which classes are strong and which are weak is all here. At the decision stage this is usually what settles it.

When building a table that compares several models, too, do not put only micro in a single column: **keeping per-class columns alongside it** lets you trace back afterward "why this choice came out the way it did."

## Takeaways

- Micro F1 averages per sample, and macro F1 averages per class.
- When the class distribution is skewed or the weak class matters, micro hides that weakness.
- Do not judge "this model is better" by the single micro number; **the habit of looking at per-class F1 as well** is what keeps you from picking the wrong model.

---

## References

- Sokolova, M., & Lapalme, G. (2009). *A systematic analysis of performance measures for classification tasks*. Information Processing & Management, 45(4), 427–437. — a standard reference that systematically compares classification metrics, including micro/macro.
- Tjong Kim Sang, E. F., & De Meulder, F. (2003). *Introduction to the CoNLL-2003 Shared Task: Language-Independent Named Entity Recognition*. — the source of the convention of using micro F1 as the standard headline in NER.
- scikit-learn documentation, [`sklearn.metrics.f1_score`](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html) — the definition and behavior of the `average` parameter (`micro`, `macro`, `weighted`).
