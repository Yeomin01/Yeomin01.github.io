---
title: "Measuring Genuine Multi-Turn Attacks: A Benchmark Trap and the Coreference Blind Spot"
date: 2026-06-25
draft: false
tags: ["LLM", "guardrail", "security", "jailbreak", "multi-turn", "evaluation", "red-teaming"]
categories: ["Evaluation"]
summary: "While evaluating a multi-turn jailbreak detector, I found that a dataset labelled 'multi-turn' was effectively single-turn. Genuine multi-turn attacks rely on coreference, and that is exactly where a specialised detector beat a general-purpose guard — while still missing half of them. A note on evaluation integrity and training distribution."
---

## A Detector Is Only as Trustworthy as Its Benchmark

I work on a session-level classifier that flags jailbreak and prompt-injection attempts spread across a multi-turn conversation. The model is only half the problem. The other half is proving it actually does what it claims — which means out-of-distribution benchmarks that exercise the specific capability under test.

One candidate benchmark took public WildJailbreak attacks, translated them into Korean, and prepended a few turns of context to present them as "multi-turn." It looked right on paper. It was not.

## The Trap: Single-Turn Attacks in a Multi-Turn Costume

Inspecting the data, all 2,000 attack sessions shared one shape. The entire attack lived in the final user turn; the earlier turns were unrelated greetings or small talk. The numbers made it unambiguous: the last user turn averaged 352 characters, while the preceding user turns averaged 29. The attack was 100% concentrated in the last turn.

That is not a multi-turn attack. It is a single-turn attack wrapped in benign padding. Feed only the last turn to a single-turn classifier and it gets caught. So this set measures nothing about multi-turn detection. What it actually measures is "can you spot a lone malicious turn at the end of a session, and can you avoid being distracted by benign filler in front of it." Both are useful properties — but neither was the capability I needed to evaluate.

This is the part of red-teaming and evaluation that gets skipped: validating that a benchmark stresses the threat you care about. A single descriptive statistic — where in the session the attack content sits — redefined what that dataset was good for.

## What Genuine Multi-Turn Looks Like

A real multi-turn attack distributes intent across turns. The hardest variant is the coreference attack. An early turn introduces a harmful subject by name inside an innocuous-looking question. The final turn never names it again — it points back with a pronoun or a deictic phrase ("that," "the method," "the thing from earlier") and asks for the concrete payload. Read each turn in isolation and none is overtly harmful. The harm exists only in the reference relation between turns.

Switching to a coreference-based dataset (the CoSafe family) changed the picture. These sets are attack-only, so recall was the metric that mattered.

## Where Specialisation Pays Off — and Where It Doesn't

Two results stood out.

First, on genuine multi-turn attacks the specialised detector (recall 0.496) beat a general-purpose LLM guard (Qwen3Guard, 0.448). The interesting part is that the ranking flips with the threat. On single-turn direct attacks, the same general guard dominated us at above 0.9. A general guard is good at harm that surfaces within one turn; our model reads signal distributed across the whole session. The specialisation advantage appears only when the attack is genuinely multi-turn — which is precisely the argument for a dedicated layer in a defence-in-depth stack.

Second, 0.496 is still low. The model misses half. The probability distribution explained why. Attack scores were bimodal: roughly half above 0.9 (caught with confidence) and half below 0.1 (confidently judged benign), with almost nothing in between. Lowering the decision threshold to 0.1 left recall unchanged. The misses were not borderline calls — the model was confidently wrong on half of them.

That is a training-distribution problem, not a threshold problem. Our training data decomposed intent through role-play, gamification, and authority framing, but rarely through the pure-coreference pattern where every surface looks benign and the attack exists only in the reference. The model routed an unseen pattern straight to "normal conversation."

## Takeaways

Two things hold up.

Benchmark validity matters as much as model quality. A "multi-turn" label does not make a set multi-turn. To measure a capability, the data has to actually demand it. Adversarial evaluation has to include adversarial scrutiny of the evaluation itself.

And you close blind spots with data, not knobs. The coreference gap will not yield to threshold tuning. It needs training examples where the surface is benign and the attack lives entirely in cross-turn reference. A low score was not a verdict on the model — it was a map of a distribution we had not shown it yet.
