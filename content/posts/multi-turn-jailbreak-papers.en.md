---
title: "Multi-Turn Jailbreak Attacks and Defenses — Notes on a Few Papers"
date: 2026-06-12
draft: false
tags: ["LLM", "security", "jailbreaking", "jailbreak", "paper review", "guardrail"]
categories: ["Papers"]
summary: "I read and organized papers on multi-turn jailbreaks, which bypass safeguards over several turns rather than with a single prompt. This post groups attacks such as Crescendo, ActorAttack, and MHJ with detection approaches such as M2S, cumulative scoring, and graph-based methods."
---

Attacks that bypass LLM safeguards often do not end with a single prompt.
Pushed in a little at a time over several turns, each individual turn looks
harmless but the accumulation becomes harmful. I read a few papers on this
multi-turn direction and am writing down how they branch.

## The attack side

**Crescendo** (Russinovich et al., 2024) starts with a harmless question and
raises the level gradually, using the model's previous answer as a stepping
stone. The key points are that it reuses the model's own output for the attack,
and that it usually succeeds within a small number of turns. It is often cited
as the starting point that conceptualized multi-turn attacks as "gradual
escalation".

**ActorAttack** ("Derail Yourself", 2024) decomposes a harmful goal into
semantically related sub-elements and asks about them across several turns. It
expands one single-turn harmful question into several branches of multi-turn
paths. The dataset the same authors released (SafeMTData) has attack sessions
but no separate benign sessions, so the practical catch is that training a
classifier means getting benign data separately.

**MHJ** (Multi-turn Human Jailbreaks) collected multi-turn jailbreaks made
directly by people and classified the tactics. The report that human multi-turn
attacks have a much higher success rate than automated single-turn attacks
stood out to me. A tactic like 'Hidden Intention Streamline', where each turn
looks harmless but together they become a harmful request, is exactly the type
that is hard to detect.

What runs through all three is clear. The intent is spread across turns, so a
filter that looks at only one turn does not catch it.

## The defense/detection side

**The limits of single-turn safety classifiers** are confirmed repeatedly
across papers. Put a decomposed multi-turn attack into a single-turn guard (for
example, a classifier that sees only one input) and it passes as benign. So the
papers converge on the conclusion that the unit of detection has to be raised
to the whole conversation session.

The **M2S (Multi-turn to Single-turn)** family compresses the multi-turn
conversation into one sequence and feeds it to a guard model. An interesting
report was that dropping the assistant turns and compressing only the user
turns in a structured form raises recall substantially. The trade-off is that
discarding the assistant turns loses signals such as whether the model has
already partly complied (partial acceptance).

The **cumulative score** approach sums per-turn risk scores at the session
level. A simple average converges to a single-turn score even as the number of
turns grows and so misses long attacks, so non-averaging aggregation that uses
the peak and the accumulation together is proposed. The figure that 71% or more
of attacks became detectable only after the second turn shows well why the
session view is needed.

The **graph/retrieval-augmented** approach (for example, a cross-turn entity
graph + GNN) models the entities and relations that run across turns, and
retrieves known single-turn malicious examples to inject as an auxiliary
signal. I liked the idea of lifting generalization when training data is
scarce.

## Thoughts after reading

- If the attack is "distributed", the defense has to be "integrated". Matching
  the unit of detection to the unit of attack (the session) comes first.
- How the input is fed (full concat / user-turn compression / cumulative score)
  makes a large difference in performance. In many cases, experimenting with the
  input representation came before swapping the backbone.
- Public datasets are attack-heavy and short on benign and real conversational
  text. How the benign distribution is filled decides the actual false
  positives.
- A small encoder classifier is fast and cheap, but weak against attacks that
  hide the intent below the surface, such as obfuscation. Reinforcing the parts
  that need reasoning with a separate stage looks like the realistic direction.

## For reference

For authors, years, and exact figures, it is safer to check the original
papers. Main keywords on arXiv: Crescendo (2404.01833), Derail
Yourself/ActorAttack (2410.10700), Multi-turn Human Jailbreaks, Defensive M2S,
and the lines of work on conversation-level risk scoring and GNN-based input
defense.
