---
title: "Fix the Data Before You Add the Rule"
date: 2026-08-20
draft: false
tags: ["PII", "synthetic data", "label errors", "evaluation", "generators", "ordering"]
categories: ["ML"]
summary: "A filter dropping reserved-domain email addresses was obviously the right rule. Applying it cut evaluation recall in half, because 52% of the gold used those domains. The rule was not wrong; the data did not match reality."
---

## Continuing

Reviewing domain-level false positives, the email firings stood out. All 16 hits in one domain were placeholder addresses built on the reserved documentation domains.

`example.com`, `example.net`, and `example.org` are reserved by RFC 2606 for documentation. Mail does not reach them. Mixed in were conventional fictional company names of the acme-and-globex variety. None of these are worth masking.

The filter would have been five lines. But I counted the gold before writing it, and stopped.

## Fifty-two percent of the gold used reserved domains

    evaluation gold EMAIL   911 spans
    of which reserved       478 (52%)

Applying the filter turns those 478 into misses. Email recall drops below half, and by the metrics alone it reads as "adding the filter broke performance." The rule is right and the metric says the opposite.

I opened the generator.

```python
if random.random() < 0.35:
    # domestic TLD for diversity
    return f"{user}@{domain}{tld}"
return _FAKER_EN.email()
```

The intent is right there in the comment: 35% domestic domains for diversity. The problem is the other 65%. Faker's default `email()` produces only reserved domains. The fallback landing on them was surely not intended.

Another team on the same project measured it independently and confirmed: 65.3% of 2,000 calls returned reserved domains. In training data it was 50%; in one evaluation set, 74%.

## There was an order to this

So the sequence went:

    1. Replace the generator fallback with a pool of real domains
    2. Repair existing data, swapping reserved domains for ordinary ones of equal length
    3. Then apply the filter

Doing step 3 first would have collapsed the metrics, and that collapse would have argued for reverting the filter — abandoning a correct rule because of the data.

After repair, measuring email alone on the same evaluation set:

    pre-repair gold    P 1.000  R 0.258  F1 0.410
    post-repair gold   P 1.000  R 1.000  F1 1.000

Preserving length in step 2 was deliberate. Changing only the value in place leaves span coordinates untouched, which makes verification trivial — swapping an 18-character address for another 18-character one.

## The same class had one more instance

Health insurance numbers had the same shape. The standard is 11 digits with a fixed leading digit, yet the leading digit in the gold was uniformly distributed across 0–9. Spec compliance: 21%.

Here the cost of unrepaired data had already been paid. The pattern had been restricting the leading digit per spec, recall fell to 0.219, and so that constraint had been pulled out of the pattern and replaced with a context condition. The data diverged from reality, so the code gave up on reality.

The generator had been fixed months earlier; only the data made before that fix remained. So this time repairing the data was enough, and compliance went to 100%.

I got one thing wrong here. Assuming email was the same situation, I said "the generator is already fixed" — but that was the health insurance case, and the email generator was still producing reserved domains. Without the other team digging into it, I would have repaired the data and moved on, and the next generation run would have brought it all back.

## Zooming out

Synthetic data carries the generator's conveniences straight into the distribution. Faker defaulting to reserved domains is the right call for Faker; it makes documentation examples. Use it where you need values that look like real personal information and the distribution goes sideways.

A skewed distribution is quiet. Training runs, evaluation runs, metrics come out. They just are not measuring reality. And later, when you try to move a rule toward reality, the metrics argue against the rule.

So when the signal is "the rule is right but the metric got worse," count the gold before doubting the rule. Label errors are known to reshuffle benchmark rankings, and in in-house synthetic data the effect can be far larger — one line in a generator sets the whole distribution.

## Notes

- When a correct rule makes the metric worse, count the gold before doubting the rule. The data may not match reality.
- There is an order: fix the generator, repair existing data, then apply the rule. Reverse it and you abandon a correct rule because of the data.
- Repairing data without fixing the generator brings the problem back on the next run. Always look at both.

### References

- Postel, J., & Reynolds, J. (1999). *RFC 2606: Reserved Top Level DNS Names.* IETF.
- Cheshire, S., & Krochmal, M. (2013). *RFC 6761: Special-Use Domain Names.* IETF.
- Northcutt, C., Athalye, A., & Mueller, J. (2021). *Pervasive Label Errors in Test Sets Destabilize Machine Learning Benchmarks.* NeurIPS Datasets and Benchmarks Track.
