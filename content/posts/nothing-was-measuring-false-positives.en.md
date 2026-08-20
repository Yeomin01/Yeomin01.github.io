---
title: "Nothing Was Measuring False Positives"
date: 2026-08-20
draft: false
tags: ["PII", "evaluation", "false positives", "gate", "NER", "datasets"]
categories: ["ML"]
summary: "Recall on the PII detector was well measured. Precision was measured under the wrong prior, and false positives under domain shift were not measured at all. Counting the evaluation sets made the reason obvious. Every document in them contained PII."
---

## Continuing

I had been running PII detection models version after version, mostly watching recall. Which names got missed, why long documents fell apart. Then someone asked how false positives behave when the domain shifts, and while looking for that number I found it did not exist. Not merely missing — impossible to have, given how the sets were built.

## Every evaluation set was positive

I counted what fraction of documents in each evaluation set contained PII.

    synthetic test set    100%
    counseling transcripts 99.7%
    short social posts     99.1%

There were 1,500 negatives, but they were adversarial hard negatives rather than ordinary traffic — things like "the educational background of CEO so-and-so at some company," which look like PII but are excluded by policy. Median length 19 characters.

Precision measured on that mix is "precision on documents that almost always contain PII." Real traffic mostly contains none. I had been reading a number taken under one prior as if it were the false-positive rate under a very different one.

Splitting the regex path by domain made the gap visible immediately.

    synthetic test set   precision 0.993
    short social posts   precision 1.000
    counseling records   precision 0.704   ← only this one spikes

One domain sits at 0.70 while the average hides it. And even that figure comes from a positive-skewed set.

## The negative corpus existed after all

Months earlier I had written in a doc that the repository had no general Korean corpus unused by training. That judgment was wrong. Another layer of the same project held domain-labeled Korean dialogues, and not one of them had gone into PII training. The domains split cleanly: civil service, education, shopping, tourism, coding, and real chatbot logs.

I sampled 400 per domain for 2,800 documents. The set has no gold labels, so what it measures is not a false-positive rate but a **firing rate** — how often the detector fires per 100 neutral documents — judged only as a delta against a fixed baseline. I wrote that limitation into the script, the artifact, and the doc. If you leave it out, the next person reads the number as a false-positive rate.

The baseline came out like this.

    tourism        12.00 per 100 docs
    general Q&A     6.25
    chatbot logs    5.00
    civil service   3.75
    education/shopping 2.50
    coding          0.00

## The gate caught my own regression within an hour

I opened the firing samples. Five business-registration-number false positives all had the same shape.

    171.77 99205
    178.67 99231

Two columns of a numeric table containing a decimal point. Korean business registration numbers are 3-2-5 digits, so `171`, `77`, and `99205` happen to form that pattern. And the checksum passed.

The problem is that this was **a regression I had introduced hours earlier**. To handle separator-substitution evasion I had widened the pattern to accept a period as a separator, and at that moment decimal points started reading as separators. No numeric tables existed in the old evaluation sets, so nothing caught it.

The cause was allowing periods and spaces to **mix**. Real identifiers use one separator consistently: `000-00-00000` or `000.00.00000`, never `171.77 99205`. Mixing means those characters are not separators at all but two different things — a decimal point and a column gap. Splitting the pattern into a "hyphen/space form" and a "period-only form" removed the false positives while keeping the evasion defense.

An hour after building the gate, the gate caught its author's mistake. That is what building a new metric is worth. Create an axis that did not exist and everything that accumulated along it becomes visible at once.

## Zooming out

Evaluation sets tend to get filled with things you must catch. Labeling budget goes there, and so does the improvement target, which is natural enough. But a set built that way reports only recall honestly. Precision comes out under a mismatched prior, and where false positives break does not come out at all.

An axis you do not measure is not merely un-improved — you **cannot see it degrade**. That is the more dangerous half. Every change that raises recall nibbles at precision, and without eyes on the nibbling the product becomes unusable at some point you never noticed.

Even an unlabeled neutral corpus works for baseline-relative comparison. You cannot derive an absolute false-positive rate, true, but "does the new model fire more on the same text" is answerable without labels. That beats waiting for a perfect metric and having none.

## Notes

- If every evaluation document is positive, only recall is honest. Precision is measured under the wrong prior, and false positives are not measured at all.
- An unlabeled neutral corpus still supports baseline-relative firing rates. Stated limits make it a usable metric.
- Creating a missing axis surfaces everything that piled up along it. The new gate caught a regression of mine within an hour of existing.

### References

- Saito, T., & Rehmsmeier, M. (2015). *The Precision-Recall Plot Is More Informative than the ROC Plot When Evaluating Binary Classifiers on Imbalanced Datasets.* PLoS ONE 10(3).
- Sculley, D. et al. (2015). *Hidden Technical Debt in Machine Learning Systems.* NeurIPS.
- Strathern, M. (1997). *'Improving ratings': audit in the British University system.* European Review 5(3). (Goodhart's law as applied to metric management)
