---
title: "The Component Looked Broken on Its Own, but It Was Fine in the Pipeline"
date: 2026-08-20
draft: false
tags: ["evaluation", "multi-turn", "pipeline", "calibration"]
categories: ["ML"]
summary: "Measured on its own, the combiner had an AUROC of 0.22, worse than random. I thought it was broken, but measured along the deployed path it was 0.98. I had been measuring the component on data that was not the input it actually receives."
---

## The combiner was worse than random

I added a new session-cumulative signal to the multi-turn classifier and measured whether that signal helped, using the combiner (gradient boosting) on its own. I put the attack sets together with everyday benign traffic (LMSYS), computed AUROC, and got these numbers.

    RED QUEEN holdout  AUROC 0.22
    MHJ                AUROC 0.36

0.5 is random. 0.22 is worse than random — it means the combiner was rating benign sessions as more attack-like than attacks. The version from before the session signal was similarly low. The problem was not the signal; the combiner itself was inverted.

## Why it was inverted

I understood it once I looked at what the negatives (benign) were that the combiner saw in training. This combiner's negatives were **paired benign** sessions — hard negatives with exactly the same structure as an attack, where only the last turn is a legitimate request. They are benign sessions whose role declaration and context are identical to the attack's. The combiner was trained to separate those hard benign sessions from attacks.

But I had just fed the combiner **everyday benign** traffic (real-usage LMSYS conversations) as negatives. That is a distribution it never saw in training. Measured against paired benign, this combiner works fine on RED QUEEN, with an AUROC of 0.75. Feeding it everyday benign traffic threw the calibration off and produced the inverted number. I had been measuring the component on data that was not the input it actually receives.

## There is a gate in front

More importantly, in the deployed pipeline everyday benign traffic never reaches the combiner in the first place. The pipeline has a first-stage BERT gate at the front. When the score is low (most everyday benign traffic), the session ends there as benign, and only sessions with a suspicious structure move on to the combiner.

    Everyday benign, LMSYS, 400 items
      ended early at the gate   97%
      reached the combiner       3%

97% of everyday benign traffic never sees the combiner. Even if the combiner is inverted on everyday benign traffic, that is not a problem in deployment, because that traffic is filtered out in front of the combiner. The number from measuring the combiner alone on raw everyday benign traffic was not the deployed path.

## Measuring along the deployed path

So instead of pulling the component out, I ran the data through the deployed path as is — through the gate and on to the combiner — and measured again.

    RED QUEEN vs everyday benign   combiner alone 0.22  →  pipeline 0.978
    MHJ       vs everyday benign   combiner alone 0.36  →  pipeline 0.910

Same data, same combiner, and the result flipped completely. Because the gate filters out everyday benign traffic first, the combiner receives only the distribution it was trained on (suspicious sessions), and the separation from benign traffic comes out at 0.98. The earlier 0.75 against paired benign also reproduced as is — the combiner itself was fine from the start.

## Zooming out

Measuring a component on its own is fast and convenient. But if the input the component actually receives in deployment differs from the training and evaluation input, the standalone number does not represent deployment. Here there was a gate in front of the combiner, so the input the combiner sees had already been filtered once. Ignoring the gate and feeding it raw benign traffic made it look broken.

The question that belongs in front of "this component's metric looks wrong" is "what does this component receive as input in deployment?" If the output path and the monitoring path differ, that in itself is a bug; this time I learned the same thing again for the input path.

## Notes

- The combiner-alone AUROC of 0.22 was not a failure but an evaluation artifact. I measured with negatives (everyday benign) that differed from the training negatives (paired benign).
- In deployment the gate filters out 97% of everyday benign traffic in front of the combiner. The combiner does not see that traffic.
- Measured along the deployed path as is (gate + combiner), the same data flipped from 0.22 to 0.978.
- When a component's metric looks wrong, first check the input that component actually receives in deployment.
