---
title: "The Data Had Piled Up in Only One Direction"
date: 2026-08-20
draft: false
tags: ["PII", "threat model", "data bias", "evaluation", "red teaming", "deployment"]
categories: ["ML"]
summary: "86% of the PII in the red-team data sat on the chatbot response side. In a real service the more common case is the user putting it in directly. Once I built that direction, a leak surface that was not in the existing data appeared."
---

## Continuing

I counted the red-team data by **direction** instead of by label distribution. Which side's utterances is the PII in?

```
Appears in chatbot responses   86%
Appears in user input          10%
```

Every scenario we had built was "extract information from the chatbot," so the result is no surprise. But in real deployment the more common path is the opposite one: an employee pastes in a customer list and says "put this in a table."

That axis was almost absent from the data. Because it was absent, it had never been measured either.

## I built the opposite direction

I built 48 conversations of scenarios in which the user comes in carrying PII. I planted 288 items across 17 labels, and 238 of them were rendered into actual user utterances.

Running them through the guard gave this.

```
PII leaked                        238
Missed by the guard                38
  of which cumulative              31
  single-message false negatives    7 (all names)
```

Use the 38 as the false negative rate as is and it is 16%. But 31 of them are cases that **arrive split across several turns and only hold cumulatively**. A deployment structure that scans per message cannot catch them in principle. That is a result of the deployment shape, not of detection performance.

Take those out and it is 200/207, 96.6%. The remaining 7 are all names, and names are handled by a separate context-judgment stage, which I had switched off for this measurement.

**Before reporting "not caught," it has to be split into "cannot be caught by structure" and "could have been caught but was missed."** Without the split, you end up trying to fix what cannot be fixed.

## A surface that was not there appeared

One thing came out here that I had not expected. The chatbot takes the values the user gave it and **repeats them in its response.**

```
User-supplied values reappearing in chatbot responses   75
  of which missed by the guard                          10
  card numbers                                           2
```

The user put in their own information, and it comes back out riding on the model response. It spreads to logs, screens, and the next turn's context. The original scenarios only looked at the chatbot leaking values that **were in the system prompt**, so this path was not being observed at all.

## Zooming out

A threat model is not written in a document; it is **engraved in the data distribution.** The shape of the scenarios we built was the range over which we measured defense. An axis we did not build cannot be measured, and what cannot be measured does not exist as far as the metrics go. It is not 0%; there is no cell for it at all.

So when looking at red-team data, the label distribution alone is not enough. Count along the axes of **who said it, where it flowed in from, and where it goes out**, and the empty cells show up. How common each of those cells is in the real service is the priority for the next piece of work.

Here the empty cell was in fact the more common path, and filling it also brought out a leak path that the existing data had not even shown to exist.

## Notes

- Count red-team data by direction, not by label. Counting which utterances hold the PII exposes the blind spots the scenarios created.
- Before reporting false negatives, separate out the cases that are impossible by structure. For a per-message scanner, a value scattered across turns is not a performance problem.
- Count separately the path where PII the user put in comes back out in the model response. Blocking only the input leaves this path open as it is.

### References

- Torralba, A., Efros, A.A. (2011). _Unbiased Look at Dataset Bias._ CVPR. (the classic on how the way a dataset was built is engraved in every conclusion measured with that data)
- Greshake, K. et al. (2023). _Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection._ ACM AISec.
- Shostack, A. (2014). _Threat Modeling: Designing for Security._ Wiley. (the order of first drawing the boundaries assets cross and then counting the threats)
