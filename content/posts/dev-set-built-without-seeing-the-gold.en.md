---
title: "I Built a Dev Set for Gap Analysis Without Looking at the Evaluation Set"
date: 2026-10-06
draft: false
tags: ["synthetic data", "data pipeline", "reproducibility", "evaluation", "LLM", "PII"]
categories: ["MLOps"]
summary: "After going through evaluation set contamination, I decided to do gap analysis on a dev set independent of the evaluation set. This post covers how I built it: placeholder generation that structurally prevents missing ground truth, two different LLMs, augmentation targets set from training set statistics instead of the evaluation set, per-ID reproducibility, re-checking at the merge step, and a leakage audit in both directions."
---

## Why build a separate one

I once built training data by looking at the false negatives on the evaluation gold set, and ended up contaminating the gold set at the template and vocabulary level. After that I split the roles. The gold set is used only for final reporting. Gap analysis, which finds what the model misses, is done on a dev set built independently of the gold set. If I build training data from the dev set's false negatives, the dev set becomes contaminated with respect to the next model, but that is fine. I can build a new dev set for the next round. The one thing that has to be protected is the gold set. How this principle came about is in [The Moment You Look into the Gold, It Stops Being Gold for the Next Training Run](/en/posts/looking-at-the-gold-spends-it/) and [The Apparent Improvement Came from Memorizing the Evaluation Set's Templates](/en/posts/eval-set-leaked-without-sharing-a-sentence/).

The target was internal business documents. This is input where an employee pastes a document into a work chatbot and asks for a summary or a translation.

## Guarantee the ground truth by structure

At first I had the generator write names and organization names itself and wrap them as `[[NAME:value]]`. In a pilot of 6 documents, the generator kept every placeholder such as phone numbers, but did not wrap the names it had made up itself. If a name is missing from the ground truth, that position can no longer be measured.

So I changed it to write all PII as placeholders only. The generator produces only slots like `[[NAME]]`, `[[ORG:bank]]`, `[[AMOUNT:salary]]`, `[[RRN]]`, and code fills in the values. The position is known at the moment a value is filled in, so the ground-truth spans are exact regardless of the generator's judgment.

The values were filled in like this.

- Real financial firms, telecom carriers, public institutions, and hospitals are picked from closed lists.
- Person names, company names, addresses, and amounts are synthesized at random.
- For identifiers with a checksum, such as resident registration numbers, card numbers, and business registration numbers, only random numbers that pass the production validator directly are used.
- The same person is tied together by number, as in `[[NAME#1]]`, and filled with the same name.

## I mixed two generators

I used a large model through an API and a 4B model running locally, half and half. The point is to keep the writing style from leaning toward one generator. There is a limitation too. The local 4B model is from the same family as the second-stage verifier model in production, so measuring the second stage on the dev set amounts to having it judge sentences it wrote itself. It does not affect gap analysis of the first-stage model. I noted this in the datasheet.

## What was lacking was decided from the training set

Since it is a set for gap analysis, it has to hold plenty of the places where the model is likely to be weak. But deciding where it is weak from the gold set's false negatives repeats the same contamination. So I decided "what is lacking" only from the training set distribution and the distribution of the half I had built first.

| Item | Training set |
|---|---|
| Median length | 38 characters |
| 600 characters or more | 0.3% |
| Documents with code or logs mixed in | 0.0% |
| English documents | 0.3% |
| Share taken by the top 20 amount values | 23.9% |

In the half built first, names, organization names, phone numbers, and emails were 87% of the spans, and there were only 2 passport numbers and 4 driver's license numbers. Unless told otherwise, a generator writes only the common kinds of PII.

The other half was built from specs aimed at what was lacking. Each spec requires one rare label and comes with a work situation where that label appears naturally. That means a passport number for overseas business trip paperwork, a card number for corporate card settlement, and an IP address for a security incident report. For document form I put in 15% logs, config files, and code snippets, and for language 15% English. I also widened the value lists. I added two-character surnames and rare surnames, single-character given names, foreign names, lot-number addresses and addresses in English, amounts written out in Hangul (금 일천오백만원정, "the sum of fifteen million won"), and foreign currency notation.

## Reproducibility

I built the generation pipeline so it can be rerun like a training pipeline.

- The seed is fixed per document ID. The random numbers that draw the spec are separate from the ones that fill in values, so even if a retry changes the values, the spec stays the same.
- Results are written one line at a time and flushed immediately, and a rerun skips IDs that already exist. Whether it stopped midway or I fixed the code and ran it again, only the IDs that had been rejected are regenerated.
- Each record keeps the generator, the implementation (local quantized / serving engine), and the spec type.
- Quality checks run once at generation time and once more at merge time. The merge step reapplies every check that exists now, so checks added later apply retroactively to earlier outputs. In practice, 152 of the 479 documents built first were dropped by checks added later, and the dropped share was refilled from the specs for what was lacking.
- I put a datasheet in the folder. At the top it says "Not for training, not used for performance reporting," followed by how it was built, known limitations, and the audit results.

## Results

| | Value |
|---|---|
| Documents | 943 (two generators 466 / 477) |
| Ground-truth spans | 12,533 |
| Rare labels | 170–250 per label (previously 2–16) |
| English / Korean+English | 132 / 212 |
| Tables and rosters / logs and code | 96 / 96 |

## The leakage audit ran in two directions

The audit against the gold set checks whether the gold set gets contaminated. If the dev set resembles the gold set, training data built from the dev set's false negatives contaminates the gold set all over again. Template sharing on the business document axes was 0% across the board. Some axes had high vocabulary overlap, but the overlapping values were only real organization names, common names, and generic department names. There was one exception. All 400 gold set turns on one axis had the same form, in the order "name / resident registration number / contact," and 1 dev document happened to use the same order. That axis registered as 100% shared. The generator has never seen the gold set, so it is a coincidence, and the training set did not have that template. I marked this document so that it is not used for generating training data. That a gold set axis built from a single form goes to 100% from one common form is something I left to be addressed when building the next version of the gold set.

The audit against the training set checks measuring power. If the dev set resembles the training set, generalization cannot be measured. Depending on the subset, 8–15% of documents shared at least one template with the training set. For the half built first, there were only 56 shared templates, and all of them were field-listing forms like "name - contact: number." There was no sign of a specific template being reused.

## What is left

While checking the ground truth, I found that the generator had over-labeled the context-dependent labels. It used placeholders even for organization names, addresses, and amounts not tied to a specific individual. I plan to correct this by adding a step that judges, span by span, whether the value is tied to an individual, and until then those three labels are not used for gap analysis. The details are in [What Is Missing from the Answer Key and What Is Wrongly in It Do Not Weigh the Same](/en/posts/missing-and-wrong-labels-weigh-differently/).

## Takeaways

I treated building evaluation data by the same standard as a training data pipeline. It has to be rebuildable from seeds and IDs, the checks have to be reappliable to the whole output, and what it was made with has to remain in the records and the datasheet. And a set for gap analysis must not look at the evaluation set, starting from the step that decides what goes into it.
