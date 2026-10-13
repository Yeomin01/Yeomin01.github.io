---
title: "It Was My Sentence, Not the Detector, That Killed the Label"
date: 2026-08-20
draft: false
tags: ["PII", "measurement", "misdiagnosis", "context", "dead code", "evaluation"]
categories: ["ML"]
summary: "The organization-name detection rate came out at 8%, and I suspected the data. I was wrong twice. Once I called a function that was switched off, and once the carrier sentence could not make that label hold. Both produced plausible numbers with no error."
---

## Continuing

I was measuring organization-name detection and the baseline came out at 8%. That was too low. I guessed wrong twice while looking for the cause, and both times **there was no error.** A plausible number came out, and I nearly reported it as it was.

## First — I called a function that was switched off

To check the policy decision, I called `is_org_whitelisted()` directly. The function exists, it runs, and a value comes out. On the basis of that value I concluded that "our data is wrong."

Looking at the call site would have been enough, and I did look, and still missed it. The call site was this.

```python
filter_listed_org(..., check_org=False)
```

**It was switched off by a flag.** In the meantime the policy had changed from list matching to context judgment, and the old function was left behind as dead code. Dead code does not throw an exception. It simply returns the answer under the old policy.

Finding the call site is not enough. **You have to read the arguments too** to know what is switched on right now.

## Second — the carrier sentence killed the label

Even after I rechecked the policy, the baseline was low. This time I wondered whether the values were the problem and changed them. Nothing changed.

The problem was **the sentence I wrote**. The carrier was this.

```
Dear customer, the information we confirmed is {value}. Is that correct?
```

An organization name becomes PII **when it contributes to identifying a specific individual** in that sentence. This sentence has no link to an individual. It is just "some company name." The policy had filtered it out correctly.

I changed it to a sentence that ties the value to an individual.

```
Customer Hong Gil-dong is registered as belonging to {value}.
```

Baseline 8% → 100%. The guard and the data were both fine. My sentence had been killing the label.

## There is an order of suspicion

When measuring context-dependent labels — names, organization names, addresses — the order has to be kept.

1. Is my sentence one that can keep that label alive?
2. Is my value a detection target in the first place?
3. Is the detector broken?

Suspect ③ first and **you end up handing someone a bug that does not exist.** I nearly did.

## Zooming out

Measurement mistakes do not crash. That is all there is to it. A code bug leaves a stack trace, while a measurement bug produces a clean number with two decimal places. And that number goes into a report, and into a decision.

So before producing a number, the first thing to ask is **"is what I measured the thing I meant to measure?"** Concretely, it comes down to these. Did I measure along the path production actually takes? Did I call an internal helper directly? Is that function switched on right now? Does the baseline come out as expected?

It matters most when my number disagrees with one someone else gave me. A disagreement is not a sign that the other side is wrong but **a sign that one of the two measurements is wrong**. Reproduce first, and if it reproduces, look at my own side again. Without this habit, a disagreement turns straight into a bug report against someone else.

## Notes

- A function existing and returning a plausible value does not make it the current policy. Once you have found the call site, read the arguments too — it may be switched off by a flag.
- For context-dependent labels, suspect the carrier sentence first. When the baseline is low, the order is ① my sentence ② my value ③ the detector.
- When my number disagrees with the other side's, reproduce my own measurement first. A disagreement is a sign that one of the two is wrong, not a sign that the other side is wrong.

### References

- Raji, I.D. et al. (2021). _AI and the Everything in the Whole Wide World Benchmark._ NeurIPS Datasets and Benchmarks. (whether a benchmark actually measures what it claims to — the construct validity problem)
- Kapoor, S., Narayanan, A. (2023). _Leakage and the Reproducibility Crisis in Machine-Learning-Based Science._ Patterns.
- Northcutt, C.G., Athalye, A., Mueller, J. (2021). _Pervasive Label Errors in Test Sets Destabilize Machine Learning Benchmarks._ NeurIPS.
