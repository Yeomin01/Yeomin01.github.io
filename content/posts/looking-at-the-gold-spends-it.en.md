---
title: "The Moment You Look into the Gold, It Stops Being Gold for the Next Training Run"
date: 2026-10-06
draft: false
tags: ["evaluation", "gold set", "dev set", "data leakage", "threshold"]
categories: ["Evaluation"]
summary: "When building retraining data, I looked at the types the model missed on the evaluation set and reinforced those types. Not a single sentence overlapped, but the next version's evaluation score became a number measuring whether it had memorized those types. Gap analysis has to be done on a dev set separated from the evaluation set, and threshold calibration had to follow the same rule."
---

## What the problem was

The detection rate for certain attack types came out low on the evaluation set. So I picked those types and generated new training data. I did not copy evaluation-set sentences, and I wrote the generator from scratch. Compared sentence by sentence, the overlap was zero.

This process still contaminates the evaluation set, because I decided what to build by looking at its false negatives. If the next version scores higher on those types, there is no way to tell whether that is a generalized improvement or the result of aiming at the weaknesses the evaluation set exposed. The job of an evaluation set is to measure performance on data never seen before, and the moment I looked into its false negatives, that set became "seen data" for the next training run.

Around the same time the same thing happened in another task. I had confirmed zero sentence matches and moved on, but when I looked again at the template level, the generator was carrying over the sentence templates of evaluation-set examples as they were. When I removed the contaminated axis and measured again, the number that had looked like an improvement almost disappeared.

## Rules

Sorting through these incidents, I set the following as rules.

1. Gap analysis for training data is not done on the evaluation set (gold). Find false negatives on a dev set separated from the gold, and use the gold only for final reporting.
2. The training-data generator does not read the gold. Reading it to filter out overlaps is not allowed either. The moment it is read, the gold's templates and vocabulary are visible to the person writing the generator.
3. Leakage checks are done at the level of templates (n-grams) and vocabulary, not sentences.
4. A dev set wears out with use too. If data is built from looking at a false negative, that dev item is contaminated for the next round. Either build a new one each round, or record the items used for gap analysis and exclude them from the next evaluation.

## Threshold calibration is training too

I went back over another task by the same standard. I had once re-tuned two gate thresholds of a classifier, and part of the benign data used for that calibration (about 14%) was also in the evaluation set I built later. On the attack side, I had swept on the same data as the evaluation set. Thresholds are only two parameters, but choosing their values by looking at data makes it the same as training.

Fortunately a re-measurement was possible. On the benign side, I repeated the same comparison on what remained after removing the items that overlapped with the calibration data. Even without the overlapping items, the false positive reduction was almost the same (about 35% on the whole set, about 34% on the remainder without the overlap). The effect held out of sample. The detection-rate cost, on the other hand, could not be checked out of sample, because all of the attacks were data used in calibration. So in the report I wrote the two separately: "benign-side effect confirmed out of sample, detection cost unverified".

## Building a separate dev set

The dev set should come from the same distribution as the evaluation set, but the process of building it must not look at the evaluation set or the training generator. The prompt contains only the label definitions and the product traffic spec, and generation uses a different model from the one that made the training data. Labels are assigned by a person. After it is built, a template-level audit checks for overlap with both the evaluation set and the training set, and overlapping items are removed from dev.

## Takeaways

Evaluation-set contamination does not come only from copying data. It also happens the moment you decide the next data by looking at evaluation-set results. So decide what to reinforce on a dev set, and keep the evaluation set for a single look at the end. Calibration that looks small, like thresholds, follows the same rule, and if things are already mixed, remove the overlapping part, measure again, and report the out-of-sample effect separately.
