---
title: "I Changed Two Constants Instead of Retraining"
date: 2026-10-06
draft: false
tags: ["cascade", "threshold", "calibration", "deployment", "false positives"]
categories: ["Engineering"]
summary: "While retraining kept failing, a large share of the false positives was coming from the gate thresholds, not the model. The data used to calibrate the thresholds had no document or code formats. I swept again with benign data per format and changed two constants, and one of the conditions was dead code that had never once fired."
---

## Where the false positives came from

The classifier decides in several stages. The first-stage encoder scores the session, and most low-scoring sessions end as benign. But so as not to miss conversations that score low yet get riskier little by little as turns pile up, I had set it up so that a cumulative gate, which looks at the mean of the per-turn partial scores and at the single-turn score, can raise a session to attack. High-scoring sessions are decided by a tree combiner that pulls several features together.

When I built new benign sets per format and measured false positives, they were concentrated in document and everyday conversations, and a large share of them was coming from the cumulative gate. The gate thresholds had been calibrated earlier on finance and medical consultations and public conversation logs, and that calibration data had no conversations that paste documents and no code conversations. If the distribution where false positives blow up is not in the calibration data, the thresholds cannot hold that side.

## I swept again

I put the per-format benign data and the attacks together and swept the threshold combinations on a grid. For each combination I counted "the number of attacks rescued" and "the number of new false positives" together. In the combination that raises the mean threshold by one step and the single-turn threshold by one step, on that set false positives dropped by 31 and 5 attacks were lost. That is a trade of about 6 to 1, so I adopted it.

One odd thing also came up during the sweep. The gate had one more condition, "if the maximum partial score exceeds the threshold", and whatever value I changed that threshold to, or even when I disabled it entirely, not a single result changed. Under the current model's score distribution, that condition never fires. The only condition actually doing anything was the mean. The code had both conditions, but one was dead code.

## The effect differed by configuration

The same change had different effects depending on the deployment configuration. In the CPU-only configuration with no GPU, the weighted false positive rate fell by about 35%. In the configuration where a small LLM re-judges the sessions caught by the gate, it fell by only about 13%, because the LLM re-verification was already filtering out most of the gate's false positives. So this change was especially valuable in environments where a GPU cannot be used.

Even with the gate turned off entirely, some formats did not reach the ship criteria. The remaining false positives came from the combiner. I tried retraining the combiner with benign data added at three levels of volume. The more I added, the more the detection rate fell, monotonically, and the English document false positives stayed at the same value in all three. I concluded that those false positives are not a problem that combiner training solves.

## A config change ships as a bundle too

The change itself was two constants in one file. Even so, I shipped it as a bundle of code, model weights, and the config spec. I confirmed with a directory comparison that the only difference between the new bundle and the previous one was that one file, and wrote that down with it. The receiving side can tell what changed in one line.

I also realigned the sensitivity tiers (very strict, strict, normal, loose). The tiers have to nest. What the strict tier catches, the normal tier has to catch as well. As the reference value went up, the loose tier's mean threshold became equal to the normal tier's, and then that knob does nothing. I spread the loose tier's value apart again and re-verified the nesting between tiers for all three pairs.

## Takeaways

When retraining keeps failing, the constants outside the model are worth a look first. This time a large share of the false positives came from formats that were not in the calibration data, and it shrank by re-fitting two thresholds. When sweeping, count the trade ratio along with it, and if there is a condition that does not change the result, mark it as dead code. A deployment where only the config changed also ships as a bundle with a list of differences. I later learned that the data used for this calibration partly overlaps the evaluation set, so I removed the overlapping part, measured again, and confirmed that the effect holds.
