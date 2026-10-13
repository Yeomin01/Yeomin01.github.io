---
title: "When Should You Ask for a Second Opinion?"
date: 2026-08-20
draft: false
tags: ["security", "jailbreak", "cascade", "multi-turn", "routing"]
categories: ["Security"]
summary: "Running the second-stage verifier on every first-stage positive is slow, and it actually erases real attacks. I worked out from measurements a rule for which cases are worth sending. The key was to take the points where the first and second stages share a blind spot out of the routing."
---

## Continuing

In the last post I wrote that running second-stage verification unconditionally on every first-stage positive actually turns encoding attacks back into benign. So I concluded that a cascade is not "covering everything with a smarter model" but gating by family. Then what do you gate on? After setting up a CPU-only classifier, I attached second-stage verification (a small SLM) again to squeeze out more precision, and found that gate in practice.

## The false positives were not ambiguous

The first rule I thought of was simple. Send only the ambiguous scores — those near the 0.5 threshold — to the second stage. I assumed a confident verdict did not need to be asked about again.

Measuring showed the premise was wrong. The classifier split to the two extremes. Benign was mostly below 0.5, attacks were mostly above 0.9, and the band in between held almost nothing. The problem was the false positives. Out of 400 benign items there were 21 false positives, and 18 of those had a score of 0.9 or higher.

    False positives (benign misjudged as attack)   21
      of which in the band [0.5, 0.9)               3
      of which in the confident range ≥0.9         18

86% of the false positives were in the confident range. Sending only the ambiguous ones to the second stage touches just 14% of the false positives. Even when the model was wrong, it was confidently wrong. The size of the score cannot serve as a routing signal.

## Where the first and second stages disagree

I needed a signal other than the score. Besides the first-stage BERT, the pipeline has a kNN stage that looks at the nearest neighbors among confirmed benign and attack sessions. The distance to the neighbors (margin) is a view independent of the BERT score. So I treated sessions where "BERT says attack but kNN is on the benign side (margin>0)," that is, sessions whose internal signals disagree with each other, as the real false positive candidates and sent only those to the second stage.

When I measured the share of margin>0 within the positive group, the signal separated.

    Benign false positives   margin>0  100%
    RED QUEEN attacks        margin>0   33%
    hh-rlhf attacks          margin>0   35%
    MHJ attacks              margin>0   12%

Every false positive had margin>0. Only 1/3 of the real attacks did. Using margin>0 as the gate sends all the false positives to the second stage while cutting the exposure of real attacks to a third. For reference, the share of benign among the neighbors (benign_ratio) was 0.70 for benign and 0.72 for RED QUEEN, overlapping almost entirely, so it could not discriminate. The sign of the distance was a better signal than the ratio.

## Framing is the same blind spot as encoding

With the rule so far — send to the second stage if margin>0 and not in the cipher family, and downgrade if the second stage says benign — I ran the actual SLM. False positives fell from 4.7% to 1.3%. But on some attacks recall collapsed along with them.

    RED QUEEN  recall  0.70 → 0.58
    DukeCEI    recall  0.92 → 0.76

The SLM turned nearly half of the routed RED QUEEN attacks back into benign. The reason had the same structure as the encoding case in the last post. Most real attacks with margin>0 were role-play or fiction framing attacks ("I'm a detective," "as a character in a novel"), and that framing is exactly what the SLM falls for. Handing the ambiguous cases to the second stage did no good, because the second stage closed its eyes in the same place. The first stage's uncertainty and the second stage's weakness overlapped at the same point.

Just as I had taken encoding out of the gate, I took framing out too. If there are cues of role-play, fiction, or impersonated authority, the session is not sent to the second stage and the first-stage verdict is respected. Measuring again, the loss was recovered.

    RED QUEEN  recall  0.58 → 0.70  (fully restored)
    DukeCEI    recall  0.76 → 0.85

RED QUEEN came back completely, because framing detection filtered out everything that had been getting routed. DukeCEI recovered only partly, because the regex could not catch all of the subtle white-collar framing — this part needs more meaning-based detection.

## Looking at five metrics

Looking at recall alone, this routing looks like "break-even at best." Lay out all five metrics and the picture changes, because the effect of removing benign false positives is not captured by recall; it is captured by precision and AUPRC.

    RED QUEEN   AUROC .973→.990  Prec .962→.980  Recall .833→.833
    hh-rlhf     AUROC .969→.974  Prec .964→.982  Recall .892→.883
    tom-gibbs   AUROC .994→.998  Prec .968→.984  Recall 1.00→1.00
    DukeCEI     AUROC .974→.933  Prec .965→.981  Recall .917→.858

Precision and AUPRC rose on all five sets. AUROC and F1 rose where the framing and cipher exclusions work well (RED QUEEN, hh-rlhf, tom-gibbs) and fell only on DukeCEI, where the exclusion is incomplete. It is a signal a single line of recall would have missed.

## Zooming out

A second opinion pays off only when it fills in the first stage's weakness. If the two judges share the same blind spot, handing over the ambiguous cases just means both are wrong in the same place. So the core of routing was not "when is there no confidence?" but "does the first stage's uncertainty overlap with the second stage's strength?" If it overlaps, send it, and the families where the second stage is weak (encoding, framing) have to be left out even when it overlaps.

Think of a cascade as "covering a weak verdict with a strong model" and this distinction does not show. Only after first measuring where the two layers' blind spots overlap is there a region left where running the second stage pays off.

## Notes

- The false positives were concentrated in the confident range, not the ambiguous one. The size of the score cannot serve as a routing signal.
- The real signal was a disagreement from a view independent of the first stage — BERT says attack, kNN says benign. That disagreement was there in 100% of the false positives and 33% of the real attacks.
- The second stage (SLM) shares blind spots with the first stage (encoding, framing). Those families have to be taken out of the gate so that recall does not collapse.
- Recall alone looks like break-even, but by precision and AUPRC second-stage routing is a net gain on most sets.
