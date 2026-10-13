---
title: "The Metric Held, but Where the Decision Was Made Had Moved"
date: 2026-09-09
draft: false
tags: ["multi-turn", "cascade", "measurement", "metrics", "robustness"]
categories: ["Engineering"]
summary: "I changed the data once in a two-stage cascade classifier and the final block rate barely moved. But who was making the decision had quietly changed. The sturdy stage sat idle, and a single fragile fallback path was carrying its share. An aggregate metric measures the outcome, not where the robustness lives."
---

## I was only looking at the aggregate metric

There is a two-stage classifier that judges multi-turn attacks. In the first stage a neural network scores the session, and if the score is low the session is treated as ordinary benign traffic and exits early. If the score is high, a second-stage combiner (a tree) gathers trajectory features as well and makes the final decision. So that cumulative attacks are not missed among the sessions the first stage scored low, I added one more auxiliary gate that escalates a session to attack when the max and mean of the per-turn partial scores cross a threshold.

The number I watched every day was the final attack block rate on a public benchmark. To cut false positives on benign traffic I added a particular kind of benign data to training, and the false positives I was targeting dropped as intended. The block rate barely moved either: from 98% to 97%, 1%p. That looked like a trade worth taking.

## What the metric hid

I first sensed a problem with a different family of attacks. The final block rate was holding, but attacks in one particular language felt like they were being caught only narrowly. So instead of the aggregate number, I logged for each session **which stage the decision was finalized at**.

Before the change, most of those attacks were caught by the second-stage combiner. After it, nearly all of them were being caught by the auxiliary gate. For that family the combiner was effectively idle.

Here is what caused it. The benign data I added pushed the first-stage network toward "long, formal sessions are benign," and attacks in that family stopped getting a first-stage score. Without a score they could not reach the combiner stage, and the auxiliary gate just before the early exit took on that entire share. The final block rate held because that auxiliary gate happened to catch them well, not because the decision was robust.

## A single path shows itself at the next change

Why a structure that depends on the auxiliary gate is dangerous became clear when I changed the model one more time. The gate's threshold was a constant, calibrated once against one particular model's score distribution and hard-coded. When I retrained the first-stage model the score scale shifted, and at the same threshold the gate almost never fired. The block rate for that family collapsed immediately. The 97% that had held earlier was only the result of the model and the threshold happening to line up.

So even while the metric was unchanged, the robustness had already concentrated in one place. The aggregate number does not show that concentration. It leads you to read the same outcome as the same process.

## What I should have looked at

I should have looked at who made the decision. Even when the final label is the same, whether a sturdy stage or a fragile fallback path produced it is an entirely different state. Just counting, per stage, "where was this decision finalized" made the concentration visible at once.

The fix in the end was not to adjust the threshold or move the boundary. The root cause was that the first stage could not score that family, so I put the signal for that family, which the first stage had never learned, into the training data. The attacks then got a first-stage score again and reached the combiner, and the decision moved back from the auxiliary gate to the combiner. The final block rate was about the same, but this time the sturdy path was producing that number.

## Takeaways

An aggregate metric measures the outcome, not where the robustness lives. In a system where several stages cooperate, the actual decisions can concentrate in one place even while the final number holds. That concentration only sends the bill at the next change.

If the metric is unchanged but something feels off, the thing to do is not to stare harder at the number but to break down, stage by stage, **who produced that number**. If the outcome is the same but the process has narrowed, that is a warning, not a reason for comfort.
