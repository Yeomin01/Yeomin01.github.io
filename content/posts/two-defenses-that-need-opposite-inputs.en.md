---
title: "Two Defenses That Needed Opposite Inputs"
date: 2026-08-20
draft: false
tags: ["PII", "evasion", "normalization", "Unicode", "regression", "pipeline"]
categories: ["ML"]
summary: "Korean numeral evasion is caught only in converted text; markdown evasion only where the markers are still alive. Every time I fixed one, the other broke silently. It took three regressions of the same class in three days before I changed the shape of the test."
---

## Continuing

PII evasion leaves the value alone and shakes only the surface. Write digits as Korean numeral syllables, wedge markdown emphasis into the middle of a digit run, mix in fullwidth digits or zero-width characters. A person reads all of it; the pattern misses all of it.

Blocking them one at a time, something odd kept repeating. Every new defense quietly unlocked the previous one.

## Where does normalization live

The pipeline used a dual-text design. The model predicts on Unicode-normalized text and maps spans back to original coordinates; the patterns match on the original. A code comment justified it:

> Structured PII is ASCII, so normalization has no effect

That was true when the fullwidth and zero-width defenses were built. But Korean numeral syllables are not ASCII. They become digits only after normalization. The premise had broken while the comment stayed, and I read that comment and still did not verify along that path.

So when I moved Korean numeral conversion into the normalization layer, only the model input changed; the patterns still saw Korean. Card numbers were misclassified as phone numbers, and national ID numbers were not caught at all.

## Deletion and preservation collide

Markdown evasion creates the opposite problem.

The existing defense replaces emphasis markers with **spaces of the same length**, to preserve coordinates. Deleting `**` shifts every following span by two, so instead of deleting it paints over.

That strategy breaks the pattern.

    YYMMDD-123**4567**   →   YYMMDD-123  4567

A space now sits in the middle of a digit group. Patterns tolerate separators *between* groups but cannot cross whitespace *inside* one. Zero-width insertion is the same failure mode. The very choice of "blank instead of delete," made to protect coordinates, was the cause.

The fix was to delete and map back. Strip evasion characters right before matching, then translate found spans to original coordinates through an index map. The stretch where coordinates break is confined inside one function, and only original coordinates leave it.

## And then they broke each other

Here the two defenses collide.

    Korean numerals   need converted text
    markdown          need text with markers intact

Once markers become spaces there is nothing left to delete. So the pattern has to see the original — and the original still holds Korean syllables. Satisfy one and the other breaks.

It broke three times.

    moved Korean numerals into normalization   → did not check markdown
    made patterns read the original            → Korean numerals came back
    (the other team's harness)                 → passed original only, then normalized only

All three were the same thing: verifying only the side just fixed. Each time I had written the dual-text structure into the commit message myself and still had not tested along that path.

The final shape put both into one normalization function. Delete markers and zero-width characters, and convert Korean numerals **after** the deletion. Order matters — removing markers rejoins digit runs that were split, which increases what needs converting.

## The test now fixes the call shape

Since the cause lay in how I verified, I changed the test. Both variants must pass **in one call shape**.

```python
raw = f"please confirm {mutate(value)}"
got = overlay(normalize(raw), [], raw)
assert label in got
```

It crosses Korean numerals × markdown × five labels. Verifying against the original alone would miss the same gap again. I also took the other team's mutation spec as a file and had the test read it directly, so all fifteen operators run automatically whenever normalization changes.

One more guard went in. If the number of items checked is zero, that counts as **failure to verify, not a pass**. A span key mismatch once left the check with nothing to inspect, and it passed. A zero-item pass gives only the illusion of verification.

## Zooming out

The normalization layer is a resource several defenses share. Each defense demands "this character must be removed" or "this form must be rewritten," and those demands can be mutually exclusive. Add them one at a time and the later ones silently void the earlier.

They stay silent because each defense's test looks only at its own case. The test proving the new evasion is blocked passes, and nobody watches the old evasion come undone. Evasion defense cannot be managed by appending cases; it has to run the whole set every time.

Coordinate preservation and exact matching also collide often. Choosing substitution over deletion to protect coordinates lets that substitution break the pattern. Carrying a coordinate map is the proper answer, but it is fiddly enough that "length-preserving substitution" is the easy detour. That detour bills you later.

## Notes

- When touching a normalization layer, check whether other evasion defenses depend on that input. Defenses can require opposite forms.
- Run evasion tests as a whole set in one call shape, not case by case. Watch one side only and the other breaks quietly.
- If the check inspected zero items, treat it as a failed verification, not a pass. Zero-item passes give only the illusion of coverage.

### References

- Boucher, N., Shumailov, I., Anderson, R., & Papernot, N. (2022). *Bad Characters: Imperceptible NLP Attacks.* IEEE Symposium on Security and Privacy.
- Davis, M., & Suignard, M. (2023). *Unicode Technical Report #39: Unicode Security Mechanisms.* Unicode Consortium.
- Whittaker, C., Ryner, B., & Nazif, M. (2010). *Large-Scale Automatic Classification of Phishing Pages.* NDSS. (On surface mutation to dodge detection, and normalization as defense)
