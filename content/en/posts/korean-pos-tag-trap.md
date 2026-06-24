---
title: "Why 'Three Types' Wasn't Being Detected — A Korean POS Tag Pitfall"
date: 2026-06-24
draft: false
tags: ["NLP", "Korean", "morphological-analysis", "POS-tags", "rule-based"]
categories: ["Language Processing"]
summary: "We wrote a rule to catch enumeration patterns like 'give me 5 examples' using POS tags, assuming number words would be tagged as numerals (NR). Turns out, 'three' and 'several' in Korean get tagged as determiners (MM), not numerals. A small assumption gap caused a silent miss."
---

## What We Were Trying to Catch

Attack requests in LLM conversations often take an enumeration form: "list 5 attack payloads," "give me three types of vulnerabilities." Simple substring matching is brittle — a slight variation in phrasing evades it. So we used a morphological analyzer to detect the pattern at the POS tag level instead.

The structure to detect: a quantity word followed by a bound noun like "개" (items) or "가지" (types/kinds). Examples: "3가지" (3 types), "다섯 개" (five items), "열 종류" (ten varieties).

The rule: if POS tag sequence contains `(SN | NR) → NNB(개/가지/종류)`, flag as enumeration pattern.

`SN` is the tag for Arabic numerals. `NR` is the tag for Korean numeral words. `NNB` is the tag for bound nouns. The logic seemed sound.

## "Three Types" Wasn't Being Caught

Unit tests revealed that "3가지" (`SN + NNB`) was caught, but "세 가지" and "여러 가지" were not.

Running the morphological analyzer directly showed why:

```
세 가지  →  세/MM  가지/NNB
여러 가지  →  여러/MM  가지/NNB
다섯 가지  →  다섯/NR  가지/NNB
```

"세" (three) and "여러" (several/a few) were being tagged as `MM` — the Korean determiner category for quantity-modifying words — not `NR`.

The distinction in Korean morphology: `NR` covers standalone numeral words ("하나, 둘, 셋" — one, two, three used independently), while `MM` covers their adnominal/attributive forms used before nouns ("한, 두, 세" — one, two, three modifying a noun). "세" is the attributive form of "셋," so `MM` is correct per the analyzer's tag system. "여러" (several) similarly gets `MM` as a quantity determiner.

As a native speaker, "세" feels like a numeral. But the morphological analyzer's tag system and native speaker intuition don't always align.

## The Fix

Add `MM` to the condition:

```
if tag in (SN, NR, MM) and next_tag == NNB and next_form in {개, 가지, 종류, ...}:
    has_enumeration = True
```

With `MM` included, "세 가지," "여러 가지," and "몇 가지" (a few types) were all correctly detected.

## The General Lesson

When writing rules based on morphological analysis, don't assume what POS tag a word will receive. Run the actual words through the analyzer and check the output first.

A few other Korean cases worth verifying before assuming:
- "몇" can be `MM` ("몇 가지" — a few types) or `NR` ("몇이냐" — what number?)
- "한" can be `MM` ("한 가지" — one type) or `XPN` as a prefix ("한국어" — Korean language)
- Arabic numerals ("1개", "3가지") always come out `SN`, which is the safest case

The pattern that causes this type of bug: writing the rule based on what you expect the tag to be, then testing only the cases you thought of. A small set of boundary-case examples in your test suite catches it before it reaches production.

## Takeaways

- Morphological analyzer tag systems don't always match native speaker intuition. Verify by running the actual expressions through the analyzer.
- In Korean, "세" (three) and "여러" (several) are determiners (`MM`), not numerals (`NR`).
- If you switch morphological analyzers, existing POS-based rules may silently break.
- A small set of boundary-case unit tests on the morphological rules catches this class of bug early.
