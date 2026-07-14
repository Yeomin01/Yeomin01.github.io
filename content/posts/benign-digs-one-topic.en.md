---
title: "Benign Users Dig One Topic for a Long Time"
date: 2026-07-14
draft: false
tags: ["LLM", "security", "data", "benchmark", "multi-turn", "false-positive"]
categories: ["Data"]
summary: "To measure whether second-stage verification actually cuts false positives, I needed benign multi-turn conversations the model had never trained on. But public data is mostly single-turn Q&A. Stretching single turns into multi-turn ones confirmed one thing again: the benign the first stage misfires on is not a sensitive topic asked once, but one topic dug into across many turns."
---

## Continuing

To measure whether second-stage verification actually reduces false positives, I needed a benchmark. Two conditions: benign conversations never seen in training, and multi-turn. But the public data within reach is mostly single-turn Q&A — one question, one answer. Where to get benign multi-turn data was the first snag.

## Why single-turn is not enough

The benign that a multi-turn detector misfires on is not a single-turn question. Asking "what is the mechanism of an anesthetic" once passes fine. The problem is the same person digging into that topic across several turns. They ask what vaccine efficacy means, then the mechanism of the immune response, then how it differs by age, then how the dosing interval affects it. Each turn is benign on its own. But as they accumulate, the model starts to misread it as someone probing relentlessly.

So the false-positive risk of benign traffic comes not from the sensitivity of the topic but from its persistence. If that is the failure, the benchmark has to have that shape. No amount of single-turn questions surfaces it. A benchmark only means something when the data is built in the shape that reproduces the failure.

## Stretching single turns into a conversation

I kept the method simple. Anchor one single-turn question from the public data as the first user turn, and have a generative model deepen the same topic naturally for 3 to 5 turns. Only follow-up questions inside the bounds of information and education, with no request for harmful or illegal action in any turn. The result is a benign session that digs into one topic from several angles.

I paid attention to two things. One is a sensitivity bias — I preferred questions from domains like medicine, security, law, and chemistry, the ones the first stage is prone to misfire on by topic alone, so the benchmark hits where the false positives cluster. The other is the holdout — I diffed the seed questions against the training data (the same check from the last post), kept only the validation split, and varied the follow-up turns so they did not overlap the templates used in training.

## Stretching it made the problem visible

On this holdout of benign multi-turn conversations, the first stage misfired on 33%, calling them attacks. A real measurement, on conversations never seen in training. Look only at single turns and that number never appears in the first place. Stretching the conversation is what brought the problem to the surface, and only then could I measure how much of that 33% the second stage reverses.

Building a benchmark is less about collecting data than about finding the shape that reproduces the failure. If benign failure comes from persistence, the benchmark has to carry persistence too.

## Notes

- The false-positive risk of benign traffic is persistence, not topic. One topic dug into across many turns is the real false-positive spot.
- Single-turn data does not surface multi-turn failure. A benchmark means something only in the shape that reproduces the failure.
- Even a synthetic benchmark needs the holdout check and the domain bias first. Skip them and what you are measuring goes blurry.
