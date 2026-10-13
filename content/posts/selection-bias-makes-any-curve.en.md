---
title: "Measure Only the Failures, and Anything Can Be Explained"
date: 2026-09-09
draft: false
tags: ["evaluation", "measurement", "selection bias", "control group", "NER"]
categories: ["Data"]
summary: "I collected only the detection failures and measured them while varying a condition, and a perfect monotonic curve came out. I thought I had found the cause, but the sample itself had been selected by that condition. In the same session, four hypotheses fell one after another against a control group."
---

## A perfect curve

I collected 86 cases where a Korean named entity recognition model missed a person's name. To find the cause, I widened the context around the name a little at a time in each case and had the model judge it again.

| Context window | Detected |
|---|---|
| ±20 chars | 81.4% |
| ±40 chars | 69.8% |
| ±80 chars | 57.0% |
| ±160 chars | 39.5% |
| ±320 chars | 4.7% |
| Full original text | 0.0% |

It decreases monotonically. The conclusion that the name gets buried as the context grows longer looks natural.

But this sample was selected as "cases where detection failed on the full original text." Getting 0% on the original text is not a finding but the definition of the sample. The right end of the curve was a selection condition, not a measurement result.

## Measuring again without the bias

I split all 2,005 names in the same dataset by document length. I included everything, successes and failures alike.

| Document length | Spans | Detection rate |
|---|---|---|
| 0–100 chars | 70 | 88.6% |
| 100–200 chars | 406 | 95.8% |
| 200–300 chars | 786 | 97.3% |
| 300–400 chars | 579 | 94.8% |
| 400–600 chars | 143 | 88.8% |
| 600 chars or more | 21 | 81.0% |

It is almost flat. The detection rate does not collapse as the length grows. What the earlier curve showed was not the effect of length but the way the sample was chosen.

In both measurements the code is correct and the numbers are accurate. The only thing that differs is the denominator.

## A circular filter

A different kind of trap came up in the same session. I built a list of names to count which names are labeled in the corpus, and common words like '고객' (customer) and '이상' (abnormal, or "or more") got mixed into the list. That was because there really were cases where those strings had been wrongly labeled as names.

To clean it up, I applied the condition "labeled as a name in at least 80% of all occurrences." The common words were filtered out. But this filter also filters out names with many missing labels. A name that occurs 165 times and is labeled only 89 times has a label rate of 54% and is dropped.

What I was trying to measure was "names whose labels are often missing," so this filter first removes the thing being looked for and then reports "almost none." In the measurement with the filter applied, the unlabeled rate came out under 1% in every bin, and when I removed the filter and measured again, the actual scale was 8,717 cases.

## Observation and a controlled experiment can come out opposite

When I measured the detection failure rate by the name's relative position in the document, a clear gradient came out. It rose monotonically from an odds ratio of 0.75 in the first 25% to 2.71 in the last 25%. The values another team measured independently went the same way, from 0.77 to 2.12.

These are numbers one wants to read as causal. To check, I ran a controlled experiment. I made 480 characters of neutral text with no PII and inserted the same name-bearing sentence at the 0%, 25%, 50%, 75%, and 95% positions. With 8 names, I ran it 40 times.

All 40 were detected. There is no position effect.

The observed gradient is real, but it was not the effect of position alone. When I ran the controlled experiment again on real documents, just moving the sentence to the document boundary, at the same length and with the same content, raised the detection rate from 0% to 50%. Position only comes into play when other PII is dense nearby. It was an interaction of two conditions, not position by itself.

## The controlled result has to be doubted too

When the result "moving the sentence takes it from 0% to 50%" came out, I first had to check the possibility that it was itself an artifact of the manipulation, because the whitespace or line breaks could have changed in the process of cutting the sentence out and putting it back.

I checked two things. First, the original text with every line break replaced by a space was still 0%. Second, the version that used the same split-and-rejoin procedure but put the sentence back in its original place was also 0%. These two checks settled that the cause was the position, not the way the text was assembled.

Without this procedure I could have been wrong in either direction: building a causal claim from observation alone, or mistaking the controlled result for an artifact.

## Takeaways

In the same session, four hypotheses fell one after another against a control group: co-occurring labels, corpus label rate, tokenizer boundaries, document length. All four gave plausible numbers when first measured, and once a control group was added, every one of them was at the base-rate level or pointed the opposite way.

Measurement mistakes do not throw exceptions. The code exits normally and the numbers look plausible down to the digits. So they are not caught unless I doubt them myself. At least three things are worth keeping as habits: writing down the condition the sample was selected by, measuring the successes along with the failures instead of the failures alone, and calling an observed gradient only a correlation until a controlled experiment has been run.
