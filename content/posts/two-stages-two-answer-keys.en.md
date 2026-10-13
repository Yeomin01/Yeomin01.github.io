---
title: "I Was Scoring the Two Stages Against Different Answer Keys"
date: 2026-10-06
draft: false
tags: ["evaluation", "cascade", "measurement", "PII", "NER", "LLM"]
categories: ["ML"]
summary: "Adding second-stage LLM verification behind the first-stage NER showed precision going down. The second stage only releases what the first stage masked, so a number in that direction is hard to get. When I checked, the two stages were being scored against different answer keys."
---

## An odd performance table

The PII detection pipeline has two stages. In the first stage a BERT-family NER model masks candidates. In the second stage a small LLM looks at the context and releases some of them: things that have the form of PII but by policy should not be masked, such as a public figure's name or an organization name not tied to a specific individual. The second stage only picks among what the first stage masked and does not create new spans.

While putting together the per-version performance table, I placed two columns side by side, "first stage only" and "through the second stage". But precision in the column that ran through the second stage came out lower than the first stage's.

## A direction the structure makes unlikely

All the second stage does is release what was masked. If what it released was a false positive, precision goes up; if it was a true positive, recall goes down.

Precision is TP / (TP + FP). If the second stage releases x true positives and y false positives, the new precision is (TP − x) / (TP − x + FP − y). For this to be lower than before, y/x has to be smaller than FP/TP. That is, the false positive to true positive ratio of what the second stage releases has to be lower than the false positive to true positive ratio of what currently remains. For a model with precision near 0.96, that line is about 0.04:1. The second stage would have to release more than 24 times as many true positives as false positives for precision to fall. A judge that bad would have shown up at once in other metrics as well.

There was reason enough to suspect the scoring before suspecting the model.

## There were two answer keys

The gold set used for evaluation holds two expected values for each position: one by the first-stage standard and one by the second-stage standard. I designed the first stage to catch every name regardless of whether it is a public figure's. So a public figure's name is "must mask" on the first-stage answer key and "must not mask" on the second-stage answer key. There were several thousand positions where the two answer keys diverge like this.

The performance table was scoring the first-stage column against the first-stage answer key and the second-stage column against the second-stage answer key. Each is a correct way to score. "Does the first stage behave as designed" is rightly measured with the first-stage key, and "does the final output follow the policy" with the second-stage key.

The problem was putting the two columns side by side and reading the difference as "the effect of adding the second stage". That difference mixes the effect of the second-stage model with the difference between the answer keys. To see how much adding the second stage improves things, both stages have to be measured against one and the same answer key.

## Again, with the same answer key

I measured both stages again against the second-stage answer key alone.

| | Precision | Recall | F1 |
|---|---|---|---|
| First stage only | 0.9585 | 0.9166 | 0.9371 |
| Through the second stage | 0.9631 | 0.9130 | 0.9374 |

Precision goes up and recall goes down a little. The second stage released 169 false positives and 131 true positives, a ratio of 1.29:1. F1 is almost unchanged.

In a detection system, over-blocking is costly. Masking a word in a benign sentence hurts the user experience right away. So for a "release-only" stage like the second stage, it fits the intent better to look at the ratio of released false positives to lost true positives, and at F0.5, which puts the weight on precision, than at F1 alone.

## The same comparison also exposed a flaw in the answer key

On another edition of the gold set, the second stage's effect came out negative even when measured against the same answer key. The release ratio was 0.33:1, meaning it was releasing three times as many true positives.

Breaking the losses down by sentence pattern showed them concentrated in one place: the amounts in sentences like "Spending for this period was tallied at ○○ won". By policy, an organization's amount that is not attributable to an individual is not PII. But the second-stage answer key had these amounts as "must mask". It was counting as wrong what the second stage had released in line with the policy. There were 1,140 such positions.

Correcting these positions to follow the policy and recomputing gives a release ratio of 8.6:1, with F1 at +0.010 and F0.5 at +0.018. I do not edit the gold set file directly. I bump the version and make a new edition. Once you start editing the evaluation standard by hand, you can no longer trace which number came from which standard.

## Takeaways

When comparing per-stage effects in a system of several chained stages, the answer key has to be fixed to one. Keeping a separate answer key per stage that matches its design intent is correct in itself. But that is for verifying that each stage behaves as designed, not for reading the difference between stages.

A stage that only filters the first stage's output, like the second stage, has the direction of its effect fixed by the structure. When a number moves against that direction, I look at the scoring method before the model. This time that check found both a problem in the scoring method and a flaw in the answer key itself.
