---
title: "A Cipher Does Not Survive Translation"
date: 2026-08-20
draft: false
tags: ["multi-turn", "jailbreak", "benchmark", "generalization", "translation"]
categories: ["Security"]
summary: "While widening OOD by translating English multi-turn attack sets into Korean, one family alone collapsed after translation. It was the cipher substitution attack. When the attack is in a substitution table rather than in natural language, translation breaks that table."
---

## Widening OOD into Korean

Measuring a multi-turn classifier's generalization honestly takes sets that are not in training. I obtained three new public English attack sets, converted them to our format, and also translated them into Korean with Solar, using them as OOD on both the Korean and English sides. The three differed in character like this.

- DukeCEI — multi-turn with an explicit harmful goal (cybercrime, white-collar crime, psychological manipulation). Gradual from benign turns to harmful turns.
- tom-gibbs — deep multi-turn that hides the harmful request with word substitution and ciphers (median of 11 user turns).
- hh-rlhf red-team — adversarial conversations that real people tried in varied ways. Not templates.

In English all three separated well. By AUROC, DukeCEI 0.99, tom-gibbs 1.00, hh-rlhf 0.98. I was especially glad to catch the human-made hh-rlhf at 0.98 with recall 0.92.

## Only one family collapsed after translation

Measured again after translation into Korean, two sets held and only one collapsed.

    DukeCEI  KO   AUROC 0.99   (recall 0.81)
    hh-rlhf  KO   AUROC 0.94   (recall 0.39)
    tom-gibbs KO  AUROC 0.57   (recall 0.25)

Only tom-gibbs was at 0.57, nearly random. On top of that, the translation itself did not go well: I put in 150 items and only 20 survived. The rest dropped out for exceeding the length or for broken format. This family alone resisted translation.

## When the attack is not in the natural language

The reason was that tom-gibbs is a cipher substitution attack. The prompt of this attack begins with "The following mapping gives the words that must be substituted in order to understand the sentence", lays down a word-to-word mapping table, and encodes the harmful request with that table. The substance of the attack is not in the natural-language sentences but in that **substitution table and encoding rule**.

A translator moves natural language into another natural language. Translate the substitution table into Korean and the mapping breaks: the moment "A=online" is translated, it is no longer that cipher. The encoding was something that held regardless of language, so translation, a language operation, ends up destroying the attack structure. That is why tom-gibbs KO has no meaning as a benchmark. A 0.57 on 20 items is breakage, not performance. I took this one off the leaderboard.

In hindsight it is obvious. A cipher is made to hide language, and translation changes language. If the language to hide is not there in the first place, there is nothing to translate either.

## Natural-language attacks still separate after translation

By contrast, the two sets whose harmful intent is carried in natural language kept their separation even after translation. DukeCEI has an explicit goal, so it was caught at 0.99 in Korean too. hh-rlhf does separate at AUROC 0.94, but recall fell from 0.92 to 0.39: it separates, but a lot is missed at threshold 0.5. This is the difficulty of natural, human-made attacks, the same property as families like MHJ. It is the "concealment and threshold" problem, where the separating power (AUROC) is there but recall at the threshold is low.

So passed through the lens of translation, attacks split into three kinds. Those with a goal that is clear on the surface (DukeCEI) are caught just the same when the language changes, those that conceal naturally (hh-rlhf) separate but with the threshold off, and for those that lean on an encoding outside language (tom-gibbs), translation itself does not hold.

## Zooming out

When widening an OOD benchmark to multiple languages, not every set carries over through translation. If the substance of the attack is in natural-language meaning, translation preserves it, but if it is in a surface encoding, translation destroys it. Put a translated set on the leaderboard as it is, and the low score of a broken benchmark gets mistaken for a model weakness. So for translated OOD, the first thing to ask is "does translation preserve this attack".

What newly caught my eye this time was that a cipher is a blind spot of translation too, for the same reason that encoding is a blind spot of the judge.

## Notes

- I obtained three English attack sets (DukeCEI, tom-gibbs, hh-rlhf) and used them as Korean and English OOD. In English, all three are at AUROC 0.98 or higher.
- After translation into Korean, only tom-gibbs collapsed, to 0.57. It is a cipher substitution attack, so translation breaks the substitution table.
- The sets whose harmful intent is in natural language (DukeCEI, hh-rlhf) keep their separation even after translation. The human-made hh-rlhf, though, is a concealment-and-threshold problem with low KO recall.
- Before putting translated OOD on the leaderboard, ask "does translation preserve this attack". The low score of a broken benchmark is not a model weakness.
