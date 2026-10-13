---
title: "Only Mutations That Preserve the Information Count as Evasion"
date: 2026-08-20
draft: false
tags: ["PII", "evasion", "mutation", "measurement", "Unicode", "false positive"]
categories: ["ML"]
summary: "An evasion experiment has to measure not whether the detector missed, but whether it missed while the information was still intact. Only after verifying that by machine did the baseline, the single effects, and the combinations each show up separately."
---

## Continuing

PII evasion means twisting a value slightly to avoid detection: fullwidth digits, zero-width characters, markdown emphasis, digits spelled out in Hangul, separator substitution. A person reads the same value, but a regex does not catch it.

I built mutation operators to measure this and hit a snag as soon as I started. I could not tell **whether a miss by the detector meant the evasion had succeeded or that I had broken the value**.

## Verify by machine before starting

So I attached `preserves_payload()` to every operator. It passes only if reversing the mutation restores the original digit string **identically, character for character**.

This is where the labels split. Mutations that change the separator are mostly information-preserving, but not for email and IP. There the separator is a **character that carries meaning**, so changing the dot gives a different value. So I excluded these two labels from the separator-family operators.

Only for mutations that pass this check do I count a "miss" as a false negative. That way the excuse "it was missed because the input was hard" does not hold.

## Next, the order of measurement

Even with the machine check attached, the numbers kept coming out wrong. The reason was different each time.

**I did not take a baseline.** The mutated version was not caught, so I counted it as a successful evasion, but the original was not being caught either. If the original already fails, nothing can be measured with that value. Now only values whose original is detected go into the experiment.

**I did not change just one variable at a time.** I tested markdown evasion with `010-1234-5678`, but that was a value the low-entropy placeholder filter blocks anyway. The two effects mixed and produced the number "9/10 false negatives," when the problem actually split by category.

**I only looked at single effects.** This is the biggest one.

```
Amount label
  separator removal alone        0% evasion
  fullwidth conversion alone     0% evasion
  both stacked                 100% evasion
```

Two mutations that are each 0% get through every time when stacked. Stop at "mutations that change one place" and you miss entirely that combinations push a value over the boundary.

## Some evasions cannot be fixed

I blocked every evasion that normalization can reverse: fullwidth, zero-width, markdown emphasis, Hangul digit readings, separator substitution. The approach strips the evasion characters and then maps the coordinates back to the original, so the regex only has to look at the forms it knows.

There is one that does not work. It is **moving the digit-group boundaries**. Write `010-0000-0000` as `0100-0000-000` and the pattern itself is different.

I built a countermeasure that "removes whitespace between digits" and then scrapped it. It produced false positives on international phone numbers in bulk: 16 new false positives against 3 new true positives. This was not a problem to solve with a regex but one to hand over to training, and I built augmentation data with the mutations applied separately.

## Zooming out

The conclusion of an evasion experiment usually comes out as "the detector is weak." But for that sentence to hold, it first has to be guaranteed that **the input still carries the same information**. Do that guarantee by eye and it is bound to leak, because every label has exceptions. It has to be enforced by machine.

And an evasion countermeasure has to be **paid for in false positives**, not in detection rate. A rule that gets 16 new cases wrong in order to catch 3 more is not an improvement. Skip that calculation and the rules keep growing, and the added rules break each other.

## Notes

- Verify by machine that a mutation is information-preserving, and only then count false negatives. For labels where the separator carries meaning (email, IP), the same operator destroys information.
- Take the baseline first. If the original is already not caught, a false negative on the mutated version means nothing.
- The boundary is crossed in combination, not alone. Two mutations that are each 0% stacking to 100% is something that actually happens.
- Judge an evasion countermeasure by counting new true positives and new false positives together.

### References

- Boucher, N. et al. (2022). _Bad Characters: Imperceptible NLP Attacks._ IEEE S&P. (attacks that shake NLP pipelines with characters invisible to the eye, such as zero-width characters and homoglyphs)
- Ribeiro, M.T., Singh, S., Guestrin, C. (2018). _Semantically Equivalent Adversarial Rules for Debugging NLP Models._ ACL.
- Ribeiro, M.T. et al. (2020). _Beyond Accuracy: Behavioral Testing of NLP Models with CheckList._ ACL.
- Unicode Consortium. _UAX #15: Unicode Normalization Forms._ (the standard definition of the normalization that reverses fullwidth and compatibility characters)
