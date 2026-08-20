---
title: "The Pattern Matched, the Validator Dropped It"
date: 2026-08-20
draft: false
tags: ["PII", "regex", "validation", "evasion", "false negatives", "design"]
categories: ["ML"]
summary: "To block separator-substitution evasion I added the period to the pattern, and it still did not detect. Matching was working. The function validating the value did not treat a period as a separator and dropped it. Encoding one rule in two places lets them drift apart silently."
---

## Continuing

Separator substitution is a cheap evasion against PII detection. Turn `YYMMDD-1234567` into `YYMMDD.1234567` and the digits are unchanged; only the hyphen became a period. Humans and machines read the same value, but a pattern that accepts only hyphens misses it. So I added the period to the pattern. It still did not detect.

## Matching was working

Debugging found the split.

    'YYMMDD.1234567'   pattern match = True   validation = False
    '000.00.00000'     pattern match = True   validation = False

The pattern was matching fine. The function validating the value behind it was dropping the result. The validator read like this.

```python
digits = value.replace("-", "").replace(" ", "")
if len(digits) != 13 or not digits.isdigit():
    return False
```

It strips separators, then checks length and checksum — but strips only hyphens and spaces. The period survives, so `isdigit()` fails.

The pattern knew "a period is a separator." The validator knew "separators are hyphens and spaces." One rule written in two places, and fixing one side split them.

## Silence was the dangerous part

What makes this failure mode bad is that **there is no signal**.

Had the pattern failed to match, I would have suspected the pattern. Had the validator raised, it would be in the logs. Instead the match succeeds, validation quietly returns `False`, and the candidate disappears from the list. From outside, all you see is "not detected."

So you look for the cause in the pattern. Widen it, still nothing, widen it more. The actual cause sits behind it.

The fix was simple: pull the separator set into one constant so both sides look at the same thing.

```python
# Must be the same character set the patterns (_SEP/_CARD_SEP) accept.
_SEP_STRIP = str.maketrans("", "", "- .\t")
```

The `isdigit()` guard that rejects values with letters mixed in stayed. What was relaxed is separator recognition, not validation strength.

## The same defect had another layer

Preparing training augmentation later, I hit a variant. To teach the model against group-boundary evasion — `010-0000-0000` becoming `0100-0000-000` — I was about to generate data, and checking first showed results split by label.

    national ID, business number, card, health insurance   all pass
    phone number                                           dropped
    account number                                         dropped

Checksum-bearing labels pass because stripping separators yields the same digits. Phone and account numbers have no checksum, and their **format patterns require the group structure itself**. So even when the model catches them from context, post-processing discards them.

Shipping augmentation in that state would have meant **training the model on things post-processing throws away**. I fixed the validators first, then added those labels to the augmentation set.

## Zooming out

When two components each encode the same rule, they drift eventually. The problem is not the moment they drift but that nothing announces it. One side accepts, the other rejects, and from outside the system it just reads as "doesn't work."

Two stages wired in series — match, then validate — have to share their premises: what the first accepts, what the second normalizes. Sharing that in a comment does not survive. It has to be a constant or a function, something the code enforces.

And before teaching anything with data, check that **the output survives to the end of the pipeline**. If the model catches it and post-processing drops it, the training is wasted. That is where "solve with data" and "solve with code" separate.

## Notes

- When the separators a pattern accepts differ from the ones a validator strips, you get a silent miss: it matches, then falls. No exception, no log line.
- If one rule lives in two places, bind them with a single constant so the code enforces it. A comment will not survive the next change.
- Before teaching something with data, verify the output clears post-processing. If it does not, it is a code problem, not a training problem.

### References

- Klensin, J. (2004). *RFC 3696: Application Techniques for Checking and Transformation of Names.* IETF.
- King, A. (2019). *Parse, Don't Validate.* (Separating parsing from validation keeps one rule from scattering across two sites)
- Sculley, D. et al. (2015). *Hidden Technical Debt in Machine Learning Systems.* NeurIPS. (Treats implicit coupling between pipeline stages as debt)
