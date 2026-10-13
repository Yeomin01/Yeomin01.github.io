---
title: "I Taught the Name, but Not Where That Name Can Be"
date: 2026-09-09
draft: false
tags: ["data augmentation", "training distribution", "NER", "PII", "bias"]
categories: ["Data"]
summary: "I found the name types where detection was weak and augmented them, and the false negative rate for those types fell from 26% to 2%. But in the actual evaluation the same names were still all false negatives. The augmentation taught the names, but it was teaching only one position where those names could appear."
---

## What the augmentation fixed and what it did not

The named entity recognition model often missed certain types of person names: native Korean names, and names whose first two characters coincide with a common adverb or noun. The latter is closer to a tokenizer segmentation problem. When a name is cut into two pieces and the first piece appears often as an ordinary word, that position is strongly biased toward not being an entity.

I built name lists for the two types and expanded the data by substituting them into existing sentences. The false negative rates of the target types fell from 26.4% to 2.5% and from 14.3% to 4.8%. The control group stayed the same.

But on a separate evaluation set, a few names of the same types were still false negatives in every case. Those names were on the augmentation list. Their corpus label rates were high too, at 88% and 92%. The model had seen them enough in training and still could not catch them.

## Measuring position

I split the false negative cases by relative position in the document. The failure rates of the first 25% and the last 25% differed by more than a factor of three.

Looking at the position distribution of name spans in the training corpus showed why.

| Bin | Names | Non-name entities |
|---|---|---|
| First 25% | 57.4% | 23.6% |
| 25–50% | 25.4% | 43.7% |
| 50–75% | 11.0% | 26.4% |
| Last 25% | 6.2% | 6.3% |

Only names are unusually bunched at the front. Other entities concentrate in the middle, while more than half of the names are in the first quarter of the document.

Splitting by source made the cause clearer. For data that came from real conversations, such as consultation records, the first-25% share was 57%, while for data made by synthesis or augmentation it was 84% to 98%. The augmentation data I made was at 87% and 88%.

The augmentation method makes it that way. Fix the carrier sentence and swap only the name, and the carrier's name slot repeats as it is. In a short carrier the name usually comes at the head. As a result I taught "this name is an entity" but did not teach "this name can come anywhere in the document."

## It was not position alone

Before concluding that position was the cause, I ran a controlled experiment. I made 480 characters of neutral text with no PII at all and inserted a name-bearing sentence at each position. 8 names, five positions, 40 runs.

All were detected. There was no position effect.

I did it again with real false negative documents. In the same document, at the same length and with the same content, I moved only the name-bearing sentence.

| Variant | Detected | Mean length |
|---|---|---|
| Original as is | 0.0% | 291 chars |
| Reassembled in place by the same procedure | 0.0% | 292 chars |
| Sentence moved to the very front | 50.0% | 291 chars |
| Sentence moved to the very end | 39.5% | 291 chars |
| Name-bearing sentence only | 87.2% | 48 chars |

Just moving the sentence to the document boundary turns 0% into 50%. In-place reassembly is 0%, so it is not an artifact made by the split-and-rejoin procedure.

In a neutral context position does not matter, but in real documents position is decisive. The difference is how much other PII there is nearby. It is not position alone but the interaction of position and context density.

## Checking on another label

The same model's license plate number detection served as the control. With the regex overlay attached there are 0 failures, so nothing looks wrong. Turn the overlay off and measure the model alone, and the failure rate in the last 25% is 15.2%, higher than the overall average of 9.5%.

In the training corpus, 80.9% of license plate numbers are in the first 25% and 0.4% are in the last 25%. That is a more severe skew than for names. And in the evaluation data the license plate numbers are bunched toward the back of the document. The evaluation is concentrated in positions hardly seen in training, so the failure rate goes up.

In other words, the front skew was not one label's problem but a problem with the synthetic data generation method as a whole; it just had not shown on labels that a regex fills in for.

## Takeaways

When making augmentation data, it is worth checking what was actually diversified. Increase only the variety of values while keeping the carrier fixed, and the model learns the values but learns only one context in which those values can appear. It shows up as the target metric improving while real performance does not go up.

The check itself is simple. Plot the distribution of where each label's spans sit in the document in the training data, and overlay it on the same distribution for the evaluation data. If the two distributions are out of line, that label is being evaluated in positions it did not see in training.
