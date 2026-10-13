---
title: "The Function Was Right, but Nobody Called It"
date: 2026-09-09
draft: false
tags: ["pipeline", "integration", "dead code", "evaluation", "debugging"]
categories: ["ML"]
summary: "The reason detection performance was not improving was the wiring, not the model. The capability was already in the code; only the call site was missing. After going through it twice, I changed the order in which I check."
---

## Continuing

One label's false negative rate was 36%, the worst of all labels. That label made up only 0.5% of the training data, so I took it for granted that the model was weak on it, and I was in the middle of writing it up as "add more data in the next training run."

But when I simply fed the 64 false negatives to the regex, **all 64 were caught.**

The pattern and the validation function already existed. That label alone was just not on "the list where the regex overrides the model's verdict." Adding one line to the list took the false negative rate from 36.4% down to 0.8%. Without retraining.

## The second one took longer

Another team sent a patch that fixes over-deletion in the second-stage filter. I ran 8 cases at the function level, confirmed that all of them passed, and started an 85-minute re-evaluation.

The result was **the same as before, down to the decimals.**

The patch had only added a function, and the evaluation code did not call that function. There was one more similar override in the same file, which was connected through a `try: import`, and the newly arrived function had no such wiring.

The 8/8 I verified was **whether the function behaves correctly**. I did not look at **whether it is on the actual path**. The two are separate things, and I checked only the first and moved on.

## One more thing came up while wiring it

As I added the call site, it was unclear which argument to pass. The function looks at "is there a structured identifier together with it in the same utterance?", but the variable the evaluation code was holding was **the context including the turns before and after**.

Had I passed it as it was, the function would have pulled in **someone else's** identifier from an adjacent turn and linked it. The distance limit that the side sending the patch had put in was meant to prevent exactly that situation, and careless wiring would have neutralized that defense.

I added a separate argument that takes only the original text of the turn under verification. If it is an empty string, the override is skipped.

**Attaching a feature and giving it the right input are also separate things.** Only after checking all three can you say it "has been applied."

## Why this kind of thing does not get caught

All three have one thing in common: **there is no error**. A label missing from the list, a function nobody calls, an argument passed with too wide a context: in every case the program runs fine. Only the metric is quietly bad.

So when a metric is bad, **suspecting the model first is the trap.** Blaming the model is plausible, the conclusion to add more data is natural, and verifying that conclusion takes days. Through those days the real cause is one line of wiring.

I changed the order of checks. When a metric is bad, I ask first — **is that capability already in the code? If it is, why is it not being used?**

## Zooming out

An ML system has **far more connecting code** than training code. Preprocessing, postprocessing, overrides, and policy filters stack up layer on layer, and each layer is designed to pass things through quietly. Passing through is the default, so a layer that is not attached cannot be told apart from one that is attached but does nothing.

So the evidence for "applied" has to be taken **from behavior**. A function-level test passing means that the function is right, not that the pipeline uses it. Printing at least one flag to confirm the wiring is live saves the 85 minutes.

The same policy being written in several places in different wording belongs to the same family. In this case the decision rule was in three places — the root of a decision tree, a constant in a fallback function, and a sentence in the prompt — and one item was missing only from the prompt. Which one was the real one could only be found out by reading the code.

## Notes

- When a metric is bad, look at the wiring before the model. It is common for the capability to be in the code already while the list entry or the call site is missing.
- A function test passing and the pipeline applying it are separate things. Print a flag once to see that the wiring is live, and then start the long evaluation.
- When the same policy is written in several places, the copies drift apart. Have them reference a single constant, or at least keep a test that catches the drift.

### References

- Sculley, D. et al. (2015). _Hidden Technical Debt in Machine Learning Systems._ NeurIPS. (an analysis showing that glue code, dead experimental paths, and configuration debt make up most of the code in ML systems)
- Breck, E. et al. (2017). _The ML Test Score: A Rubric for ML Production Readiness and Technical Risk Reduction._ IEEE Big Data. (a checklist that makes pipeline integration, not the model unit, a check item)
- Amershi, S. et al. (2019). _Software Engineering for Machine Learning: A Case Study._ ICSE-SEIP. (lays out, as field cases, the integration and module-boundary problems ML teams actually run into)
