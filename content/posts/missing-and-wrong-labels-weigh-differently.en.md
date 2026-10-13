---
title: "What Is Missing from the Answer Key and What Is Wrongly in It Do Not Weigh the Same"
date: 2026-10-06
draft: false
tags: ["evaluation", "labeling", "synthetic data", "PII", "NER", "measurement"]
categories: ["ML"]
summary: "While checking the answer keys of LLM-generated evaluation documents, I found two kinds of error. A value missing from the answer key distorted nothing under the scoring rule; it only narrowed what could be measured. A value wrongly included in the answer key turned something the model correctly let through into a false negative. Both are label errors, but the scoring rule decides how much each one weighs."
---

## Two kinds of label error

To find the weak spots of a PII detection model, I generated evaluation documents with an LLM. The generator writes placeholders such as `[[NAME]]` or `[[ORG:bank]]` where PII goes, and when the values are filled in later, their positions are recorded as the answer key. The design was meant to guarantee the answer key by structure, without leaving it to the generator's judgment.

When I checked the generated documents, the answer keys had errors in two directions.

- Missing label: it is PII but not in the answer key. The generator wrote a department attached to a person directly, without a placeholder, as in `Manager [[NAME]] (Finance Team)`. Under the policy, a department name tied to a specific person is organization-name (ORG) PII.
- Over-labeling: it is not PII but went into the answer key. Examples are the counterparty company in a contract between companies, the receiving organization of an official letter, a company's headquarters address, and a department budget.

At first I judged missing labels to be the more dangerous kind. I thought that if the model caught that department name, it would be counted as a false positive because it was not in the answer key. So I built the check that filters out missing labels first, and a little over a quarter of the documents already generated were dropped by it.

## I reread the scoring rule

The scoring code looks like this.

```python
want   = {(it.label, it.start, it.end) for it in items if it.expect == "mask"}
forbid = {(it.label, it.start, it.end) for it in items if it.expect == "keep"}

TP        = len(want & pred)
미탐       = len(want - pred)                # false negatives
과차단     = len(forbid & pred)              # over-blocking
빈턴오탐   = len(pred) if not items else 0   # false positives on empty turns
# in sentences that have items, predictions not in the answer key (pred - want - forbid) are not counted
```

The last line is the key. Generated dialogues contain a lot of incidental PII that was not intended: an agent's name, an organization's main phone number, an account balance. Counting every unlabeled prediction as a false positive lowers precision by close to 10%p. So in sentences that have answer-key items, only the positions designated in the answer key are scored.

Under this rule, the weights of the two errors were the opposite of what I had thought.

| Error | What happens in scoring | Outcome |
|---|---|---|
| Missing label | A prediction at that position is not counted | No distortion. Only the chance to see a false negative at that position is lost |
| Over-labeling | It is entered as "must mask" | If the model lets it through as the policy says, it is counted as a false negative |

A missing label only narrows the measurement range. Over-labeling creates fake false negatives. The purpose of this set was to find what the model misses, so fake false negatives contaminate the analysis directly.

## The generator marked the type, not the binding

To see how much over-labeling there was, I judged a sample by hand.

| Label | Sample | Not a correct answer |
|---|---|---|
| Organization name (no person name nearby) | 30 | 27 |
| Organization name (person name nearby) | 20 | 4 |
| Amount | 15 | 9–10 |
| Address | 15 | 10 |

About a quarter of the organization-name answers were at positions with no person name nearby. Weighted, roughly a third of the organization-name answers are over-labeled.

The generation instructions said, "Use a placeholder only for an organization that a specific individual belongs to or has dealt with, and write unrelated organizations as plain text." The generator often ignored this condition and used a placeholder whenever something had the form of an organization name. The placeholder guaranteed the type of the value, but not whether that value was tied to a specific individual.

Organization name, address, and amount are labels where whether something is PII depends on context. Under the policy they are PII only when tied to a specific individual. In our gold set, the only places where the first-stage model's answer key and the final answer key differ are public figures and cultural heritage. So the first-stage model also has to judge this binding, and over-labeling distorts both stages.

## How I decided to handle it

**I kept the missing-label check but corrected the reason for it.** It is not a device that prevents false positives; it is a device that protects the positions to be measured. A department name attached to a person is a known weak spot the model often misses. If it is missing from the answer key, that weak spot cannot be measured.

**Over-labeling cannot be fixed with a regex.** Whether a value is bound is a contextual judgment, so each position needs its own decision. I decided to have an LLM judge, for each span of a context-dependent label, "is this tied to a specific individual?", and to change the ones that are not to "must not mask". The judge is a different model from the second-stage verifier model in production. With the same model, that model would be writing its own answer sheet. Before applying it, I first check how well it agrees with the hand-judged sample.

This has a side benefit as well. Right now this set has no "must not mask" items, so over-blocking can only be measured with control documents that contain no PII at all. After the judging step there will be organization names, addresses, and amounts that should not be masked in context, so over-blocking can also be measured at the context level.

Until then, I attach "is there a person name nearby?" to each organization-name item as a factual value, and do not use the three labels for gap analysis.

## Takeaways

The cost of a label error is decided by the scoring rule, not by the error itself. This time I built the check first and read the scoring code afterward. As a result I blocked the less harmful kind first, and learned about the more harmful kind only after judging a sample by hand. When checking an answer key, the right order is to first confirm what rule that answer key is scored by.
