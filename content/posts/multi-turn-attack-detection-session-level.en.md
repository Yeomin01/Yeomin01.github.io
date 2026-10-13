---
title: "Multi-Turn Attacks Are Not Caught by Looking at One Turn"
date: 2026-06-12
draft: false
tags: ["LLM", "security", "jailbreak", "guardrail", "multi-turn"]
categories: ["Learning Theory"]
summary: "A classifier that blocks prompt injection and jailbreaks usually judges one input at a time. But when an attack is spread over several turns, each individual turn looks harmless. This post lays out the point that the unit of detection has to match the unit of attack."
---

## The blind spot of single-turn judgment

A guardrail that inspects input usually takes one input and judges whether it is harmful. If the single prompt is harmful it blocks it, and otherwise it lets it through. This works well against attacks whose intent is fully visible in one sentence.

The problem is attacks that spread the intent across several turns. The attacker does not make a harmful request from the first turn. They start with a harmless question, turn the direction little by little, and use the model's previous answer as a foothold to raise the level of the next request. Taken alone, no turn is clearly harmful. A single-turn judge lets every turn through as benign.

## Patterns that become harmful only when accumulated

These attacks appear in a few forms.

- Gradual escalation. It starts from a harmless general question and moves a little toward the sensitive side with each turn. Crescendo by Russinovich et al. laid out this form.
- Intent decomposition. The harmful goal is split into semantically related sub-pieces that are asked about separately, and at the end the attacker asks to combine them.

In both cases the core is not "the content of one turn" but "the accumulation and combination of turns". However accurately the harmfulness of each individual turn is measured, the distributed intent is not caught. Reports that single-turn safety classifiers judge decomposition attacks as benign are in the same vein.

## Matching the unit of detection to the unit of attack

The direction of the solution is simple. If the attack happens at the session level, the judgment has to be made at the session level too. The whole conversation (or the accumulated context), not one turn, is treated as a single input and judged.

When the session is serialized into one sequence and fed to the classifier, the model sees the flow of turns rather than individual turns. The harmless start and the gradual escalation, the decomposition and the request to combine, all arrive together within one input, so there is room to learn the cumulative pattern.

Changing the unit brings some decisions with it, though.

- Observation window. How many turns count as one unit? Set it short and a slow-boiling attack falls outside the window.
- Input representation. How to mark the speakers, and how far to compress.
- Benign data. At the session level, conversations that "resemble an attack in form but are harmless in intent" (games, role-play, and so on) become a major cause of false positives. The model has to be trained on enough of these cases as benign.

## Takeaways

The first question in detection is not "which model to use" but "what is judged as one unit". If the attack ends in one turn, single-turn judgment is enough. But when an attack spreads its intent over several turns, it is invisible by definition unless it is looked at in the same unit. Matching the unit to the attack comes before making the model bigger.
