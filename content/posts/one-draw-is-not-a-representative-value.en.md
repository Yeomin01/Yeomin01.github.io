---
title: "I Drew Once and Called It the Representative Value"
date: 2026-09-09
draft: false
tags: ["measurement", "random numbers", "reproducibility", "sample", "baseline"]
categories: ["ML"]
summary: "I measured an experiment involving random numbers only once and put it in a report. Changing the seed six times made the value swing by nearly a factor of two, and the first value was at the lucky end. In the same week I skipped the baseline and produced wrong numbers three more times."
---

## Continuing

I was running an experiment that changes the weights very slightly. The key metric was how many model verdicts that change flips, and running 2 million sentences gave me a value of **21**. I wrote it into the comparison table as it was.

Later I ran the same condition six times, changing only the seed. **28, 30, 34, 35, 41, 49.** The median was 34.5, and the range spread to nearly a factor of two. The 21 I got first was a low value that did not even fall inside that distribution.

The experiment involves one random matrix. The result depended on which direction that matrix pushes the weights, but I treated it as a **fixed property** and measured only once.

## If the variation is larger than the effect, nothing has been measured

What came next was worse. I ran an experiment that varied the signature length over 4, 8, 12, 14, and 28 characters with two seeds, and **4 characters came out with more flips than 8 characters**. A longer signature should change more, and it was the other way round.

When I raised the seeds to six, the trend showed — 27 → 31.5 → 34.5 → 40 → 43.5. It was gentle, but it increased monotonically. **The random variation was about the same size as the length effect, so with two samples the effect was covered up.**

Unless the size of the effect being measured is compared with the size of the variation first, a graph drawn from a couple of samples gets even its direction reversed.

## When using a sample instead of the full set — baseline first

Running 2 million items per build takes 1 hour 25 minutes for one build, so 42 builds was impossible. So I picked out **only the sentences whose verdict could flip**. A verdict changes only when the score crosses the threshold, so a sentence far enough from the threshold does not change however hard it is pushed.

When setting the band width, I first validated it against the existing full-set result — ±0.05 caught only 18 of the 21, and from ±0.2 on it caught all 21. I picked ±0.45 to leave margin, and the sentences came down to 1,603. 20 seconds per build.

What came next was the important part. **I ran the original, with no watermark embedded, through the same path again.** It matched the full-set baseline, with 0 flips and a maximum score difference of 5e-06. Had I not taken this, I would have misread every difference between my inference path and the baseline-generation path as the effect.

## What actually happened when I did not take it

When I extended the same experiment to another target, I skipped this step. The result was strange — the build with the change scaled up 100 times and the original build gave **almost the same value** (15,571 versus 15,570).

When I took the baseline, even the original disagreed with the stored values on 464 of 800 sentences. The cause was neither the model nor the code. **The input file used to build the baseline was different for each target**, but I was using a single one for all of them. The sentences were misaligned wholesale.

After fixing it and running again, they split into 5 and 531. Only now is it the effect of the change.

Since then I have made the script **stop right there** when the baseline does not match. Leave it to human attention and it gets skipped when things are busy.

## Zooming out

Measurement mistakes do not crash. They produce a plausible number, that number goes into a report, and it is overturned much later. The three from this week — drawing only once, skipping the baseline, mismatched input files — did not raise a single exception among them.

So the checks have to be built **into the code**. Put the seed loop into the experiment design, make the baseline check a gate before the run, and if a sampling method is used, monitor during the run whether its assumption breaks. A check that depends on a person remembering it ends up not being done.

## Notes

- When random numbers are involved, run 5–6 seeds and report as `median (range)`. A single value is not a representative value.
- If the variation is larger than the effect being measured, the experiment has not measured anything yet. Increase the sample.
- When reducing the full set to a sample, ① validate the sample range against an existing full-set result, ② take the untreated baseline first, and ③ make it stop if the assumption breaks.

### References

- Henderson, P. et al. (2018). _Deep Reinforcement Learning that Matters._ AAAI. (quantifies cases where results from a few seeds overturn the conclusion)
- Bouthillier, X. et al. (2021). _Accounting for Variance in Machine Learning Benchmarks._ MLSys. (separates the sources of variance and calculates how many repetitions are needed)
- Dodge, J. et al. (2019). _Show Your Work: Improved Reporting of Experimental Results._ EMNLP. (proposes a procedure for reporting a distribution instead of a single number)
