---
title: "The Apparent Improvement Came from Memorizing the Evaluation Set's Templates"
date: 2026-10-06
draft: false
tags: ["evaluation", "data leakage", "gold set", "synthetic data", "measurement", "NER"]
categories: ["ML"]
summary: "I augmented the training data after looking at the cases the model missed on the evaluation set. There were 0 sentences identical to the evaluation set, and the score rose a lot. In reality the evaluation set's sentence templates and vocabulary had crossed over into training, and when I removed the contaminated part and measured again, the improvement mostly disappeared."
---

## A result that looked good

While preparing the next version of the PII detection model, I collected the cases the model missed on the evaluation gold set. It was missing a lot of organization names and person names in text shaped like internal business documents. I generated training data aimed at that type.

Before merging, I checked whether the training data contained any sentence identical to the gold set text. There were 0. The training result was good too.

| | Previous version | New version |
|---|---|---|
| Overall F1 | 0.940 | 0.960 |
| Organization name recall | 0.63 | 0.80 |

A few axes had a recall of 1.000. They were defense institution documents, documents with English mixed in, and public institution documents.

## The 1.000 was the signal

At first I read this 1.000 as success. But these axes were where the model had originally been weakest. If one round of data augmentation takes the weakest spots to a perfect score, I should have first checked the possibility that the model had seen the exam paper rather than learned to generalize.

I went back first to the basis on which I had decided there was no leakage because no sentences overlapped. A sentence-level comparison catches only one leakage path. When I checked, there were two other paths.

## It was leaking through templates and vocabulary

Template leakage. I had copied the sentence structure of gold set examples into the generator prompt. For example, a template like "The authoring department is X and the person in charge is Principal Y." The values were changed, so the sentences do not overlap. But with the PII slots blanked out, it is the same sentence. On that axis, 100% of the gold set sentences shared a 5-word template with the training data.

Vocabulary leakage. I had drawn the lists of English names and military unit names from the gold set's false negative values. On the mixed-English axis, 72% of the gold set's organization name and person name values were in the training data verbatim.

Source text from the same origin. Other augmentation data was built from the same public corpus as the gold set's document cell. I filtered out the 60-character windows overlapping the gold set by fingerprint, but the style and vocabulary distribution of the same corpus remained. Template sharing on that axis was 84.5%.

## Removing it and measuring again

I removed the contaminated axes and compared again on the clean axes only.

| | Previous version | New version |
|---|---|---|
| Overall F1 | 0.946 | 0.948 |
| Organization name recall | 0.723 | 0.714 |

F1 was +0.003, and organization name recall actually went down. Nearly all of the apparent improvement was the model memorizing its own templates. That version was not promoted, and the contaminated training data was quarantined separately.

## I rebuilt the audit tool

Instead of sentence comparison, I wrote an audit script that looks at two things.

Template audit. In both the training sentences and the gold set sentences, PII spans are replaced with `<label>` and digits with `#`. Then word 5-grams are compared. At first I counted every 5-gram, but customer support conversations share stock phrases like "Please check once more," so even unrelated axes came up at 5–15%. The contamination signal is the template wrapping a PII value, not ordinary sentences. So only n-grams that contain a placeholder are counted.

Vocabulary audit. It checks whether the organization name, person name, and address values the gold set says must be masked appear verbatim among the training data's values for the same label. Closed sets such as real banks, telecom carriers, and public institutions overlap no matter where the data is made. Common names overlap by chance too. So I do not look at the ratio alone; I look at the overlapping values directly. If synthesized person names or organization names overlap, it is contamination.

## Overlap does not tell you the direction

The audit only shows that there is overlap; it does not tell you who copied whom. What needs fixing depends on the direction.

If the training data came from the gold set, the training data is removed. That was the case this time. Fixing the gold set to fit the training would amount to fitting the ruler to the model.

Conversely, the gold set may have been built from the templates of existing training data. The same audit turned up one such axis. A 300-turn axis had been built entirely from a sentence template of the training set from three months earlier ("The address is listed as ○○"). In this case the training data is fine, and the gold set has to be rebuilt with independent templates and released as a new version.

## The rules I set

The rules I set after this (gap analysis on a dev set rather than the gold set, the generator does not read the gold set, leakage checks at the template and vocabulary level) are written up together in [The Moment You Look into the Gold, It Stops Being Gold for the Next Training Run](/en/posts/looking-at-the-gold-spends-it/), the record of going through the same problem on the multi-turn model side. The multi-turn side audited with character n-gram containment, and the two cases where that tool was wrong are in [The Gold Set Gets Contaminated Even When Not One Sentence Overlaps](/en/posts/gold-leaks-without-a-shared-sentence/). I add two things here. Do not use the same source corpus as the gold set for training. If any axis comes out at 1.000, check for leakage first.

## Takeaways

Passing a sentence-level duplicate check only means one of three leakage paths is closed. If you build training data by looking at the evaluation set, templates and vocabulary cross over even when not a single sentence overlaps. The score that results comes out plausible and without errors, and if you do not know about the contamination, that number carries you all the way to promotion.
