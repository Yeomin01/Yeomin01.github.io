---
title: "The Same Number Disagreed Four Times — When the Denominator Goes Unstated"
date: 2026-09-09
draft: false
tags: ["evaluation", "collaboration", "measurement", "metrics", "reproducibility"]
categories: ["ML"]
summary: "Two teams were measuring the same data and the numbers kept disagreeing. All four times both sides' values were correct, and every time the denominators differed. It only stopped once the unit was written into the key name."
---

## Continuing

Another team and I were each measuring the same model on the same evaluation set. The numbers kept disagreeing. It took four rounds before I saw the pattern: **every time both values were correct, and every time the denominators differed.**

```
① false negatives     90    vs 125
② false negative rate 3.02% vs 3.98%
③ recall              93.0% vs 88.4%
④ false negatives     86    vs 74
```

Not once was the arithmetic wrong. What was wrong was "not stating what had been counted."

## All four times we were counting different things

**①** The 90 was in units of (conversation × direction × label), and the 125 was in that unit with **turn** added. If the same value leaks in several turns, it is 1 case by field and several by turn. The multiplier differed by label: 1.1x for some labels, 4.0x for others. Without the unit stated, **comparison across labels becomes meaningless altogether.**

**②** One side had removed short sentences from the denominator. The analysis split position into quartiles, and in a 40-character sentence a single value takes up a whole bin. The call was right, but the same filter was **also applied to the overall false negative rate**, so the risk was being reported low.

**③** One side's 93.0% was the pass rate when values were fed directly into the filter function. That number does not assume the upstream model caught the value in the first place. Measured again through the whole pipeline, it was 88.4%.

**④** The 86 was the number of rows in the case file, and the 74 was the number of spans whose coordinates had actually been located. The file mixed in cases that were masked so no coordinates could be located and cases split across several turns. As a list of cases they are all false negatives, but only 74 can be used as the numerator of span-level recall.

## The disagreement ended up finding a bug

Digging into ④, I found something I had not expected. The field-level total was 90 on one side and 80 on the other. The arithmetic did not add up, so I went looking, and **10 cases were missing from the case file entirely.**

They were values that had come in split across several turns. They only hold cumulatively, so no single turn can be pointed to, and the converter was silently skipping those cases. There was no error and no warning.

If the other side had not asked "what is the difference between these two numbers," that omission would have stayed buried. **When numbers do not match, it matters not to wave it off as rounding or a sampling difference.** There is a reason they do not match, and that reason is often a bug.

## The fix was simple

I put the unit into the metric name.

```json
"unit": "turn — (conversation x direction x label x turn). Canonical.",
"total_turn_level": 135,
"total_field_level": 90,
```

And for values with a filter applied, I wrote the denominator down separately.

```json
"denominator": "Only turns of 40 characters or more. Not the same denominator as the overall false negative rate
                — do not try to match the absolute values to each other."
```

The last sentence is the point. During ② I was the first to say "I'll match the values," and the other side talked me out of it. **If one side adopts the other's filter, the filtered value hardens into the canonical one.** False negatives in short sentences are real leaks too, and they would disappear from the metric.

Rather than forcing the two values to match, the right move was to pin down in the name that they are different.

## Zooming out

When sharing metrics, the danger is not a wrong number. A wrong number gets caught when you cross-check. The danger is **numbers that are both correct but measure different things**. Cross-checking does not catch these, and they look plausible enough that you just end up combining them.

Writing down "what unit, over what denominator" before sending a number prevents most of this. The cost of one more line saves four round trips.

And when I hit a disagreement, **doubting my own measurement first** helped. Three of the four times it was my side's definition that was fuzzy. Had I started by assuming the other side was wrong, I would have come close to handing them a bug they did not have.

## Notes

- Put the unit in the metric key name. With `total_turn_level` instead of `total`, you do not make mistakes when combining.
- For a filtered value, write the denominator alongside it, and state that the unfiltered value is the canonical one for reporting. Do not force the two values to match.
- When numbers do not match, do not write it off as rounding; dig until the arithmetic works out. The omission is hiding where they do not match.

### References

- Dodge, J. et al. (2019). _Show Your Work: Improved Reporting of Experimental Results._ EMNLP. (A proposal to state the reporting conditions so the same experiment can be set up again)
- Mitchell, M. et al. (2019). _Model Cards for Model Reporting._ FAT*. (A convention for releasing model metrics with the measurement conditions and intended scope attached)
- Gebru, T. et al. (2021). _Datasheets for Datasets._ Communications of the ACM. (A way of handing over, as a document, how the data was made)
