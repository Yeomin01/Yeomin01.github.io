---
title: "State Product Performance as 'How Many Out of 100'"
date: 2026-10-06
draft: false
tags: ["evaluation", "false positive rate", "traffic weighting", "ship criteria", "metrics"]
categories: ["Evaluation"]
summary: "How many of 100 benign requests get blocked once the guardrail is in is the question users actually ask. To answer it, I put traffic weights into the evaluation set, set ship criteria per format, and narrowed the recall denominator to the items that fit the definition. In the process I also confirmed that the same model's headline number moves by more than a factor of two depending on the assumptions."
---

## The question users ask

Reporting evaluation results as F1 or PR-AUC is enough for research, but the side considering adoption wants to know something else: "If we put this in, how many of 100 benign requests get blocked?" and "How many attacks out of how many does it catch?" I redesigned the evaluation set so that it can answer these questions.

## A small sample cannot decide a criterion

The benign set I used at first had a few hundred items. One false positive moves the rate by 0.4%p. If the criterion is "false positives at 1% or below", this resolution cannot decide it. A difference of one item separates passing from failing. I collected several hundred to several thousand items for each format (everyday, work, document, code), which gave a resolution of 0.1–0.2%p per cell.

## Without a fixed mix, the headline moves

Even with the per-cell false positive rates fixed, producing one overall number requires deciding in what proportions to mix the cells. With the same model and the same per-cell false positive rates, the overall false positive rate differed by more than a factor of two depending on the mix assumption. The composition of the evaluation set effectively becomes the headline, so a number produced without fixing the composition means little.

So I assumed a real usage environment, set a traffic share per cell, and stamped that share on every record as a weight. Assuming internal business use, I put work conversation first, then requests that paste a document and ask for a summary, then everyday conversation, then code. If the assumption changes, only the weights need editing and the data stays as it is. The report states both the plain false positive rate and the weighted false positive rate.

## The bar for shipping

I set a criterion that says "at this level it can go out", not a target line for doing better. Multi-turn detection is one of several security layers, so it does not have to catch every attack by itself. False positives, on the other hand, block benign users and become the reason people in the field turn the layer off. So I set a false positive ceiling and a detection floor separately.

- False positive ceiling per format: 1% or below for everyday and work, 0.5% or below for pasted documents, 2% or below for code
- Detection rate of 0.8 or above on attacks that fit the definition
- A floor of 0.5 per attack type (if one type gets through, attacks concentrate there)
- Met separately per language (not hidden behind a pooled average)
- No cell regresses against the deployed version

Converting the per-cell ceilings with the traffic weights gives one overall criterion. The results table puts this criterion and the per-cell figures side by side and states the number of cells that passed. "6 of 8 cells pass, and the remaining two are these" decides the next task more directly than a single number.

## Fit the denominator to the definition

Recall changes a lot depending on what the denominator is. Among the "attack" labels in public benchmarks, some did not fit our definition. A case that makes a harmful request outright in a single turn belongs to the toxicity layer behind, not the multi-turn layer. Some were labeled as attacks while not being harmful at all. Counting such items as false negatives underestimates the model. When I split the axis so that only the items fitting the definition go into the recall denominator, recall went up by about 7%p for every version. Conversely, without the split, a version that catches many mislabeled benign items can end up looking good.

Precision needed separate care. The ratio of benign to attack in the evaluation set is over 10 to 1, so precision swings widely with that ratio. As the product figure I use the weighted false positive rate instead of precision.

## Takeaways

Evaluation from the product side has to answer "how many out of 100". That takes enough samples per cell, traffic weights, ship criteria per format, and a denominator fitted to the definition. Without these four, the same model's number moves by a factor of two depending on the assumptions, and that number cannot decide whether to release.
