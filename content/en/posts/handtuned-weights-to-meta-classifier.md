---
title: "Replacing Hand-Tuned Scoring Weights with a Small Meta-Classifier"
date: 2026-06-24
draft: false
tags: ["LLM", "security", "detection", "ensemble", "meta-learning", "design"]
categories: ["Model Design"]
summary: "An escalation scoring formula with hand-picked coefficients (0.6 × gradient + ...) is hard to justify and brittle when the data distribution shifts. Replacing it with a logistic regression trained on the same features made the weights data-driven, added interpretability, and made adding new features straightforward."
---

## The Starting Point: Hand-Tuned Coefficients

A multi-turn attack classifier produces a base attack probability from the language model, but we also computed an escalation score from several signals: a gradient signal measuring how much the probability rises across turns, a semantic direction signal from the classifier's own embeddings, and keyword-based signals.

To combine these into a final escalation score, we wrote a formula:

```python
escalation_score = 0.6 * gradient_score

if semantic_score >= 0.18 and gradient_score < 0.3:
    escalation_score = max(escalation_score, semantic_score * 0.7)

if peak_prob >= 0.5 and trigger_in_last_turn:
    escalation_score = max(escalation_score, peak_prob * 0.85)
elif any_trigger and trigger_in_last_turn:
    escalation_score = max(escalation_score, 0.42)
```

The numbers `0.6`, `0.18`, `0.7`, `0.85`, `0.42` were all hand-picked.

## Problems with This Approach

**No principled basis for adjustment.** When a case was miscategorized, deciding which coefficient to change and by how much required re-running evaluation after every tweak. There's no gradient to follow.

**Hidden interaction assumptions.** The formula assumes `semantic_score` only matters when `gradient_score < 0.3`. Whether that conditional actually improves things over just including both signals equally — we don't know without testing it.

**Friction when adding new features.** Adding a morphological attack-intent score meant deciding where to insert it in the existing if/max structure by hand. Not hard, but it required another round of manual tuning.

**Thresholds also hand-picked.** The decision thresholds (0.4 for escalation, 0.5 for the base model) were also set by hand, with no ROC-based justification.

## The Replacement: Logistic Regression as a Meta-Classifier

We treated each of the signals as a feature and trained a logistic regression on the training set.

**Feature vector (9 dimensions):**

| Feature | Source |
|---|---|
| `attack_prob_peak` | Max attack probability across all turns |
| `attack_prob_last` | Attack probability at the final accumulated turn |
| `last_turn_solo_prob` | Attack probability for the last user turn *alone* |
| `gradient_score` | From the existing escalation computation |
| `semantic_score` | CLS embedding projection onto harm direction |
| `morph_attack_intent` | Morphological analysis score (0–1) |
| `has_enumeration` | Enumeration pattern detected (bool → float) |
| `attack_collocate` | Attack noun + output noun adjacent pair (bool → float) |
| `has_trigger` | Explicit attack trigger keyword present (bool → float) |

`last_turn_solo_prob` deserves a note. It's the classifier's attack probability when given only the last user turn, with no prior context. If the final turn alone looks suspicious even without context, that's meaningful — it catches cases like "give me 5 attack payloads for defense purposes" where the request is self-contained. We get this by running a second forward pass through the same classifier, so there's no need for a separate NLI model.

We calibrated the logistic regression output with isotonic regression via `CalibratedClassifierCV` to prevent overconfident probabilities.

## What the Learned Weights Showed

After training, `gradient_score` and `last_turn_solo_prob` had the strongest coefficients. `semantic_score` was weaker than the hand-tuned formula had assumed — we'd given it a conditional role that implied more weight than it was earning in practice.

The morphological features contributed meaningfully when combined with the probability features, even though they were weak in isolation. The logistic regression found an interaction the formula wouldn't have represented.

Decision thresholds were set via Youden's J on the ROC curve, so the 0.4 and 0.5 values we'd been using now had actual justification (and in some cases were adjusted).

## Limitations

**Needs sufficient training data.** Logistic regression on 9 features is lightweight, but the training set needs to cover the relevant attack patterns. If a new attack variant appears in production that wasn't in training, the meta-classifier won't have learned to weight it correctly.

**Adds inference cost.** The extra forward pass for `last_turn_solo_prob` adds latency per session. For batch evaluation this is fine; for real-time serving with tight latency budgets it's a tradeoff to consider.

## Takeaways

- Hand-tuned coefficients in a scoring formula have no principled basis for adjustment and are brittle when the data distribution shifts.
- The same signals as features in a logistic regression produces data-driven weights that are interpretable (via coefficients) and adjustable.
- An NLI-like "last turn solo" signal can be approximated by re-running the base classifier on a single turn — no separate model needed.
- Learned weights reveal which signals are actually doing work, which may differ from your intuitions.
- Calibrated decision thresholds via ROC analysis replace arbitrary hand-set values.
