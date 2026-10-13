---
title: "The Gold Set Gets Contaminated Even When Not One Sentence Overlaps"
date: 2026-10-06
draft: false
tags: ["evaluation", "data leakage", "n-gram", "gold set", "multi-turn"]
categories: ["Data"]
summary: "I checked leakage between the evaluation set and the training set with sentence hashes only, and got 'zero overlap'. Variants that fill the same template with different slots are not caught by a hash. While re-auditing with character n-gram containment, the measuring tool itself gave wrong values twice: once because the parse came back empty, and once because a single long document acted like a dictionary."
---

## A hash cannot see a shared template

While building the evaluation set (gold) for a multi-turn dialogue classifier, I filtered out dialogues that overlapped with the training set by hashing the user turns. The model input uses only the user turns, so I treated two dialogues as the same input when the hash of their concatenated user turns matched. The result was clean, and by that criterion there was almost no leakage.

The problem is that a hash only catches things that are "identical character for character". Generated data stamps out many copies from one template, changing only the domain words or the people. Two dialogues with the same template and different slots have completely different hashes, but to the model they are almost the same example. A model that saw the template in training easily gets another copy of it right in evaluation. That score measures template memorization, not generalization.

## I measured again with containment

To look at the template level I used character 5-grams. I normalized the user turns (NFKC, lowercase, collapsed whitespace), cut them into 5-character pieces to build a set of hashes, and computed what fraction of one gold dialogue's n-grams appear in one training dialogue (containment). The same sentence gives 1.0, a template with only the slots changed gives around 0.7, and an unrelated sentence gives close to 0. I checked these three cases on toy data before starting.

I had to remove general vocabulary so that common phrasing ("please tell me", "how do I") would not inflate containment. At first I meant to drop n-grams with high document frequency, but then a template repeated hundreds of times in the training set gets classified as a "common expression" and dropped. That repeated template is exactly what the audit has to catch. So I dropped only the n-grams that were common in both the gold and the training set, and kept the ones common on one side only.

The computation was a sparse matrix product. I built the gold and the training set each as a binary (document × vocabulary) matrix, cut the training side into chunks of a thousand, and multiplied each chunk by the transpose of the gold matrix to get the number of shared n-grams. Tens of thousands of records against thousands finished in under 10 seconds.

## The tool was wrong twice

The first result looked plausible, but two things were off.

First, some training sources showed zero overlap with every gold item. When I checked, those sources stored dialogue turns not as dictionaries but as strings with a `"User: …"` prefix, and my extraction function read only dictionaries, so the user text became an empty string. An empty string overlaps with nothing, so the result is 0. Thousands of records had been left out of the audit entirely. I changed the audit to use the same user-turn extraction function the training code uses. An audit only means something when it measures in the same unit as the model input.

Second, almost all of the English benign dialogues came out with high containment. When I followed each one to its maximum-containment counterpart, they were concentrated on a few training records, and one of those was a very long pasted text that "contained" over a hundred gold items. A long document has most of the common English fragments, so it covers a short document's n-grams the way a dictionary would. Containment is asymmetric and does not prevent this effect. I added a reverse-containment condition so that a pair is counted only when the training record is also explained by that gold item above a certain fraction (0.2). Pairs with the same template have high containment in both directions, so they are still caught, and the long documents drop out.

## I checked against a baseline

I checked whether the fixed tool was right using cases where I knew the answer. The new tool has to re-catch 100% of the exact-match leaks already confirmed by hash. When I had left out the combiner's training data this number was 86%, and after adding it, it became 100%. Also, unrelated sources (such as contrastive-pair data I had written myself) had zero items at containment 0.3 or higher. So I set 0.3 as the removal threshold.

In the end about 7% of the training set shared a template with the gold. None of it was visible by the hash criterion. I built a separate training set with the flagged records removed and audited it again with the same tool to confirm zero. After the removal, the "common on both sides" vocabulary set shifted slightly and one item near the threshold was newly flagged; one more pass of filtering brought it to 0.

## Takeaways

If the leakage check is sentence matching only, it misses template sharing, which is the most common leak in generated data. To look at the template level, use n-gram containment, but remove only the general vocabulary that is common on both sides, and add a reverse-direction condition to block the dictionary effect of long documents.

And an audit tool is a measuring tool too, so it can be wrong. When the result was 0 I suspected the parsing first, and I trusted the numbers only after validating the tool by whether it re-caught leaks whose answer I already knew.
