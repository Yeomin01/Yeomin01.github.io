---
title: "A Detection Model Should Emit a Probability, Not a Label"
date: 2026-06-30
draft: false
tags: ["LLM", "security", "detection", "serving", "threshold", "design"]
categories: ["Model Design"]
summary: "The multi-turn guard returned a (label, probability) tuple, but that probability was already dampened by a post-processing rule. In an architecture where the gateway tunes the threshold, this hides two things. The guard should emit the raw probability, the adjusted value, and which adjustments fired, and leave the final threshold decision to the gateway."
---

## What the Guard Returned

The inference function of the multi-turn attack classifier returned a `(label, attack_prob)` tuple. It takes a session, runs the model once, pulls the attack-class value out of the softmax, decides a label by a threshold, and returns both.

It looks sufficient. The label tells you whether to block; the probability gives a confidence. But this guard is one slot in a layered security stack, and the actual block decision is made by the gateway in front of it. The gateway collects outputs from several guards (PII, toxicity, multi-turn), applies policy, and tunes the threshold during operation.

In that setup, the output above was hiding two things.

## Hidden Thing 1 — The Probability Was Dampened

The returned `attack_prob` was not the model's raw probability. To reduce false positives on normal technical conversations (coding, DevOps, security defense), a domain-dampening post-process had been baked in.

```python
attack_prob = softmax(logits)[ATTACK]
if domain_dampen:
    score = _coding_domain_score(dialogue)   # coding/defense signal strength
    attack_prob = attack_prob * (1 - score) ** 2
```

So the emitted probability was `raw model probability × dampening`. When the gateway receives 0.15, it has no way to tell whether the model saw 0.15 to begin with, or saw 0.9 and got knocked down to 0.15 because the dialogue looked like coding. Those two cases mean very different things, yet the output is identical.

Dampening is a heuristic. It guesses the domain from keyword lists and morphological patterns, and it can be wrong. If the gateway could see the raw probability, it could factor in "the model flagged this, but the guard dampened it." With only the dampened value, that judgment is gone.

## Hidden Thing 2 — Who Owns the Threshold

The label comes from `attack_prob ≥ threshold`. So should the guard fix that threshold and hand over a label, or emit only the score and let the gateway decide?

If the gateway tunes the threshold to operate, the answer is the latter. A label-only output leaves the gateway unable to shift the operating point. Splitting risk into low/medium/high, or summing scores across guards, both require a continuous score. A label collapses all of that into 0/1.

The threshold itself had a trap, too. The script that auto-calibrates the operating threshold writes values into `thresholds.json`, and the model-decision threshold sitting there was `1.0`. It came from Youden's J on the ROC curve, but because the model is nearly perfect on the in-distribution eval set (F1 0.99), the "optimal" threshold got pushed to an extreme. A threshold of 1.0 means the model path essentially never fires. Calibrating a threshold on a distribution close to your synthetic training data and shipping it as-is produces exactly this kind of degeneracy.

## What Changed

The inference function now returns a structured result.

```python
{
  "raw_prob":   0.93,                    # pure model probability, pre-dampening
  "final_prob": 0.15,                    # after domain dampening / escalation
  "decision":   "BENIGN",                # recommendation at final_prob >= threshold
  "threshold":  0.5,                     # threshold used (for reference)
  "reason":     ["domain_dampen(0.60)"]  # adjustments that fired
}
```

Splitting `raw_prob` and `final_prob` lets the gateway see both the model's original read and the guard's adjustment. `reason` surfaces which adjustment fired and why — an empty list means the raw value passed through untouched. `decision` is only the guard's recommendation; the gateway is free to ignore it and apply its own threshold to `raw_prob` or `final_prob`.

The decision threshold changed too. Instead of the degenerate 1.0 from `thresholds.json`, it uses the value from `gate.json` (0.5), calibrated at the end of training to maximize F1 on the held-out eval. Since the final call belongs to the gateway anyway, the threshold the guard carries is just a recommended reference point.

## Takeaway

If a detection model sits behind a gateway, having the model finalize a label is throwing away information. For the gateway to own the threshold and policy, and to combine multiple guards, it needs the continuous score. And that score should not be a value overwritten by post-processing — it should separate what the model actually saw from what was adjusted, and say what changed and why. Blocking is decided by the gateway, not the guard.
