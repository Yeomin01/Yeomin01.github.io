---
title: "A Price Is Not Personal Information"
date: 2026-08-20
draft: false
tags: ["PII", "policy", "false positives", "combination", "masking", "design"]
categories: ["ML"]
summary: "The amount label fired more than any other on neutral text. Admission fees in travel questions were being treated as personal information. I measured which signal separates a price from a personal transaction and rewrote the policy. Firing dropped 85%."
---

## Continuing

After building the domain false-positive gate I counted firings by label. Amount led as a single label — 39 out of 2,800 documents, and 25 of those concentrated in the tourism domain alone. Opening the values showed admission fees and usage charges.

## Belonging to a category does not make it personal

The policy doc opens with this: the test is not "was a word from that category mentioned" but "does this text actually expose a specific individual's information." Yet only the amount label had never had that principle applied. Any number with a currency unit was caught.

"Admission to Gyeongbokgung is 3,000 won" is public information about a service. "Account balance" is a specific individual's transaction record. Both are amounts in form, but only one is personal information. Failing to separate them meant a travel chatbot masked the price whenever someone asked about the price.

## Which signal separates them

I measured three candidates, splitting the neutral corpus against evaluation gold.

| Condition | neutral (prices) | gold (personal info) |
|---|---|---|
| Another PII within the proximity window | **0%** | 43.4% |
| Transaction keyword within the window | 21% | 60.5% |
| Amount precision (below the 100-won unit) | **0%** | 18.3% |

Combination and precision both show zero false positives on the neutral corpus. Prices in travel conversations do not appear alongside other PII, and they are rounded to convenient units. Conversely, amounts precise down to the single-won unit appear zero times in the neutral corpus. People do not quote prices that way.

Transaction context is weak on its own. Twenty-one percent of neutral documents contain words like "payment," "refund," or "remittance" — common in shopping and tourism dialogue.

## I tried to include precision, then removed it

Precision looked discriminative at first: zero false positives on neutral text. But opening the context of the 12 precise amounts that would be discarded without it, they were product prices and business quotes — sentences like "this one costs such-and-such" or "submitted a quote of such-and-such."

**Precision does not make an amount personal if it is not attributable to a person.** Precision correlates with personal transactions but is not the cause. Freezing a statistical correlation into a rule keeps the wrong things alive.

So two conditions remained. Keep the amount only when the proximity window holds another person-identifying PII, or a transaction keyword.

I excluded address and organization from the combining labels. A broad place name or a company name does not settle whose money it is. Counting them as combination loosens the whole judgment.

And combination is judged within **60 characters**, not across the document. In long counseling transcripts, judging over the whole document means an unrelated passage at the end marks every span as combined. The name label had already taught me that.

## Change the policy and you must change the gold

After applying it, firing on the neutral corpus fell from 39 to 6. Tourism went from 25 to 0. Four of the remaining six are subsidy payments and tuition transfers in the education domain, closer to true positives.

In exchange, 25.7% of gold became relabeling work. If amounts that are non-PII under the new policy remain labeled as PII, everything the policy correctly discards is counted as a miss. **The policy change looks like a performance drop.**

The relabeling script does not reimplement the decision; it calls the production policy function directly. Rewriting the criterion there would split the policy from the gold. I had already learned elsewhere what happens when one rule is written in two places.

## Zooming out

When defining a detection category, "what has this shape" and "what serves this purpose" are different questions. An amount pattern is good at the first; a personal-information decision must be the second. Split it into catch-by-shape and filter-by-purpose, and the pattern can stay wide while policy narrows it afterward.

And when choosing rules, separate signals that correlate from signals that cause. Precision correlated strongly with personal transactions, but reading the counterexamples showed it was not causal. Looking only at the numbers would have hidden that. Picking candidate rules needs a step where you read the actual cases alongside the statistics.

## Notes

- Having the shape of a category does not make something personal information. Split it: catch by shape, filter by purpose.
- Judge combination within a proximity window, not the whole document. Over a long document, everything reads as combined.
- Before freezing a well-correlated signal into a rule, read the counterexamples. A precise amount was still not personal information when nothing attributed it to a person.

### References

- McCallister, E., Grance, T., & Scarfone, K. (2010). *NIST SP 800-122: Guide to Protecting the Confidentiality of Personally Identifiable Information (PII).* NIST.
- Sweeney, L. (2000). *Simple Demographics Often Identify People Uniquely.* Carnegie Mellon University, Data Privacy Working Paper 3. (Quasi-identifiers: values that identify nobody alone but do in combination)
- Narayanan, A., & Shmatikov, V. (2008). *Robust De-anonymization of Large Sparse Datasets.* IEEE S&P.
