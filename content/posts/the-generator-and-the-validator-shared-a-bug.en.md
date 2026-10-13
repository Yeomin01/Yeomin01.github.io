---
title: "The Generator and the Validator Shared the Same Mistake"
date: 2026-08-20
draft: false
tags: ["PII", "checksum", "testing", "oracle", "synthetic data", "false negative"]
categories: ["ML"]
summary: "The +2 correction was missing from the alien registration number checksum. The generator and the validator were making the same mistake, so every test passed. Real numbers were being detected 0% of the time, and there was no signal at all."
---

## Continuing

The alien registration number uses the same weights as the resident registration number. Multiply the first 12 digits by `2,3,4,5,6,7,8,9,2,3,4,5`, add them up, and compute `(11 - sum % 11) % 10`. There is one difference. **You add 2 to that result.**

Our code did not have that `+2`. Not in the generator, and not in the validator.

## Every test passed

Why this went uncaught for months is the point.

```
generator → 'alien registration number'  →  validator → valid
synthetic data valid rate                                 100%
```

The validator passes the values the generator made. Valid rate 100%. The round-trip test is green. The dataset statistics look fine too.

But those values were numbers that could never actually be issued. Conversely, **the validator rejected every alien registration number in the real format.** Even when the regex matched, the validator behind it threw the match away, so the detection rate was 0%.

In numbers it was this: a 100% valid rate on our synthetic data, a 0% detection rate on the real format. The two numbers came out of the same pipeline at the same time.

## When the oracle shares a premise with what it tests

A test means something only if it judges "is the result right?" independently. But here the side doing the judging and the side being judged **came from the same reading of the formula.**

The person who left out the `+2` wrote the generator and also wrote the validator. The two implementations sit in separate files, so in form it looks like cross-checking. In reality they were two copies of the same misunderstanding.

A defect like this is silent because there is no mismatch. If two components disagree, the values at least diverge somewhere, but if they are wrong side by side, everything is perfectly consistent inside the system.

The fix was not a code fix but **moving the reference outside**. I rewrote the validator against the published specification of the numbering scheme and re-judged the existing data with that validator.

## So from then on

Recently I had to port the same algorithm to JavaScript for a browser demo. I did not compare by eye; I **compared 160,000 cases against the canonical Python validator**.

At first 97 out of 20,000 disagreed. The cause was that the canonical version also checks the century code and the validity of the birth date before the checksum. My port was passing a `YYMMDD` of `020009` (day 9 of month 0). I would not have found that by eye.

## Zooming out

**Self-consistency is not correctness.** The fact that two components inside a system agree with each other is not evidence that both are right, only evidence that the two use the same premise.

The "generate → validate" pair is especially dangerous. That the round trip passes is almost guaranteed by construction, because the same person read the same document and wrote both in the same week. That test is measuring not the code but **the consistency of a memory**.

So the validation reference should come from outside as far as possible: a public specification, another implementation, real field data. If that is not possible, at least do a bulk comparison. Looking at cases one by one by eye just reproduces the misunderstanding I already have.

## Notes

- A round-trip test (generator → validator) always passes if the two sides share the same premise. The fact that it passed carries almost no information in itself.
- Take the validation reference from outside the system: a public specification, another implementation, real data. If that is not possible, substitute a bulk comparison.
- Defects that are wrong side by side are silent because there is no mismatch signal. "100% on our data" and "0% on the real thing" can both hold at the same time.

### References

- Barr, E.T. et al. (2015). _The Oracle Problem in Software Testing: A Survey._ IEEE TSE.
- Knight, J.C., Leveson, N.G. (1986). _An Experimental Evaluation of the Assumption of Independence in Multiversion Programming._ IEEE TSE. (the classic experiment showing that independently written implementations fail together at the same points)
- Chen, T.Y. et al. (2018). _Metamorphic Testing: A Review of Challenges and Opportunities._ ACM Computing Surveys.
