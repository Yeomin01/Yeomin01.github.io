---
title: "Encoding Is the Judge's Blind Spot"
date: 2026-07-14
draft: false
tags: ["LLM", "security", "jailbreak", "cascade", "encoding", "defense"]
categories: ["Security"]
summary: "The second-stage verifier held jailbreak-prompt recall up to 74%, but cipher-substitution attacks held only 18%. Why encoding alone resisted the fix clarified what a cascade actually is. An LLM judge decides only when meaning sits on the surface. Encoding erases that surface."
---

## Continuing

In the last post, tightening the second-stage verifier's prompt lifted jailbreak-prompt recall to 74%. But one family never came up. Cipher-substitution attacks stayed collapsed from 100% to 18% and barely recovered. Why a second stage that reverses other attacks goes blind in front of encoding is what re-clarified what a cascade is.

## The judge reads meaning

An LLM judge reads the meaning of text and decides harm. It tries to understand whether a request actually asks for a weapon, a drug, or a hacking artifact. A cipher-substitution attack erases exactly that meaning from the surface. By mapping words to other words or scrambling characters, it makes a harmful request look like a meaningless string.

To the judge, the substituted request is just noise it cannot decode. With no harmful intent on the surface, it answers "benign." To a person, too, a ciphertext is just a strange string. The judge loses by trying to understand, because there is nothing on the surface to understand.

## The classifier wins by memorizing

The paradox is that the first stage caught this better. The first-stage BERT does not understand meaning. It memorized the surface pattern of that family — the character distribution peculiar to substitution, the low natural-language probability — from training. Because that family's data went into training, it caught the encoding attack at 100% on surface alone.

The layer that tries to understand loses; the layer that memorized wins. On attacks that hide meaning, "pattern memory" beat "judgment." That is where the two layers show they are complementary. The judge is strong on attacks whose meaning is exposed; the classifier is strong on families whose meaning is hidden. Try to cover both with one, and one side gets through.

## So a cascade is a gate

This asymmetry decides the cascade design. Send every first-stage positive to the second stage unconditionally, and the encoding attacks get reversed back to benign — because the judge sees them as harmless. Re-verifying everything actually weakens the defense on that family.

So the second stage has to be gated by family. Send the false-positive-prone contexts (general help, informational queries) to the second stage to clear false positives, and let the cipher and encoding families skip it and keep the first-stage verdict. A cascade is not "cover everything with a smarter model" but "use each layer only where it is strong."

## Zooming out

Any defense needs both a layer that reads meaning and a layer that memorized the surface. The temptation to block everything with a single generative judge is strong, but in front of attacks that hide meaning, that judge is at its weakest. A defense that leans on understanding is weak against attacks that make themselves impossible to understand — the encoding family keeps reminding me of that.

## Notes

- An LLM judge decides only when meaning sits on the surface. Encoding erases that surface and disarms the judge.
- On attacks that hide meaning, the memorized layer beats the understanding layer. The two are complementary.
- So second-stage re-verification is not a cure-all but a family gate. Run each layer only where it is strong.
