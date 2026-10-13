---
title: "The Thresholds Were Being Derived on a Copied Path, Not on Serving"
date: 2026-10-06
draft: false
tags: ["MLOps", "calibration", "threshold", "training-serving skew", "testing", "NER"]
categories: ["MLOps"]
summary: "The script that derives the production thresholds carried its own copy of inference and post-processing. The copy differed from serving in two places, and an existing test was pinning one of them as correct. I deleted the copy, switched the script to import the serving functions as they are, and derived the thresholds again."
---

## The performance table did not reproduce on the serving side

The per-label confidence thresholds of the NER model are derived by a separate script. It sweeps the threshold on the validation set to draw precision and recall curves, then picks a value for each tier by a fixed rule. These values and a performance table are handed to the serving side.

The serving side got in touch while reproducing the performance table, saying the numbers did not match. When I checked, the derivation script carried its own copy of inference and post-processing. The descriptive comment in the script said "identical to production". The copy differed from serving in two places.

## Difference 1: temperature was applied to decoding

The model uses a CRF output layer, and confidence is calibrated with temperature scaling. Serving runs Viterbi decoding on the original scores when choosing tags, and uses the temperature only for computing confidence (the marginal probability).

The copy divided the emission scores by the temperature and then went on to decode with them. When the temperature is above 1, the emissions flatten relative to the transition scores, and then the path Viterbi chooses can itself change. In 1 of 40 validation documents the tags differed. In effect the threshold curve was being drawn from spans that serving does not emit.

## Difference 2: the steps at the end of the chain were missing

At the end of serving's post-processing sit a common-noun filter and a second pass that re-catches names with symbols inserted between syllables. The copy had neither. Both are steps added to serving after the copy was made. A copy starts diverging from serving the moment it is made, and nothing is in place to report that.

## A test was pinning the breakage as correct

This script had a test too. It checked that the serving result equals "the copy's result + the common-noun filter". It took the fact that the filter was missing from the copy as the baseline and pinned it. The test passed, and because it passed, nobody suspected the copy.

When a test pins the relationship between two paths, the relationship itself needs a second look. This test was pinning "the two paths differ by this much", not "the two paths are the same".

## I deleted the copy and imported the serving functions

I deleted the copy and changed the script to import the model loading, inference, post-processing, and second-pass functions from the serving module as they are. The only thing the derivation script adds is the threshold sweep. In serving the second pass is attached without a confidence cut, so it does not depend on the threshold. So it is computed once per document and merged into every threshold.

After the change, I checked that the result with the threshold set to 0 equals the serving pipeline's detection result span for span. All 41 cases matched, including the syllable-separated ones.

I changed the tests as well. I removed the test that used the copy as its reference and pinned two things: that the functions the derivation script uses are the same objects as the serving module's functions, and that the deleted copy functions have not reappeared. Checking for the same object means the test fails even if someone recreates a copy later.

There was a side effect too. The copy imported another evaluation module, which loaded a list of several million entries into memory at every start. With that import gone, startup time and memory went down.

## The re-derived result

Re-deriving on the serving path changed only one of the 24 values. The "loose" tier value of one label went up by 0.02.

That value was sitting on a boundary. The selection rule for this tier has the condition "recall at least 50% of the maximum", and on the changed path the recall at that threshold cleared the line by 0.002. That is the contribution of the second pass adding names and of the tags being decoded on the original scores.

I took the new value, as the rule says. The old value was derived from spans that serving does not emit. Keeping it would mean overriding the rule by hand. If the boundary is shaky, the right move is to put margin into the rule, not to hold the value in place by hand. A hand-picked value cannot be reproduced by the next person.

I also checked the variables separately. Changing only the path on the same data changed 1 value, and changing only the composition of the validation set on the same path changed 0.

## Sentences inside the artifact are generated from data too

The JSON that gets handed over had explanatory sentences hard-coded in it, such as "only this label was pulled in from the default grid". After the re-derivation that was no longer true. I changed the sentences to be generated from the actual selection result, and ran it on the old curve and on the new curve to confirm that the right sentence comes out for each. I also recorded, as fields, the chain used for the derivation and the reason the previous version differed. I did not delete the previous version's artifact; I kept it with a date attached.

## Takeaways

If an evaluation or calibration script carries a copy of the serving logic, the copy diverges from serving from the moment it is made. Import the serving functions instead of copying them, and pin with a test that the same objects are used. If there is an existing test that pins the relationship between the two paths, first check that the relationship is right. If a re-derivation moves a value across a boundary, follow the rule, and if that feels shaky, fix the rule.
