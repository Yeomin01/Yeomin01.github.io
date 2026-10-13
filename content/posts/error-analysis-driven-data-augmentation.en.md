---
title: "Filling Errors with Data — Real Conversations for Over-Blocking, Obfuscation for False Negatives"
date: 2026-06-12
draft: false
tags: ["LLM", "data", "error analysis", "data augmentation", "guardrail", "multi-turn"]
categories: ["Data"]
summary: "When I took apart the errors of a multi-turn attack classifier by source, there were two kinds. Over-blocking of benign input (FP) came from real human conversational style that was absent from training, and missed attacks (FN) came from obfuscation with initial consonants and slang. This post covers how I filled each one with the data that fits it, without touching the model architecture."
---

## Look at the errors, not the score

On an evaluation set from the same distribution, the classifier scores almost
perfectly. So telling models apart starts with looking at the errors on a
held-out evaluation set one by one. While evaluating a multi-turn attack
detector, I grouped the wrong samples by source, and the errors split clearly
into two kinds.

## Two kinds of errors

First, over-blocking (FP), where benign input is misjudged as an attack. Almost
all of these errors came from conversations real people had (call-center
consultations, social media chatter). The benign data used for training was
nothing but clean sentences made by a generative model, and the model, seeing
real spoken style with typos, informal speech, and emotion for the first time,
suspected an attack.

Second, false negatives (FN), where an attack is let through as benign. These
clustered in cases where the key word was hidden with initial consonants or
slang. When only the consonants are left, as in 'ㅍㅌ', or the word is disguised
as everyday vocabulary, no harmful word shows anywhere in the surface text, and
the model saw an ordinary conversation.

## Add the data that fits each one

The two kinds of errors had different causes, so the remedies differed too.

For over-blocking, I added real human conversations to the benign training
data. I picked a few hundred from public Korean dialogue corpora and converted
them to the same session format, keeping them separate so they did not overlap
with the real conversations in the evaluation set. As a result, over-blocking
on real conversations dropped sharply, and the rate of missed attacks stayed
the same.

For false negatives, I generated obfuscated attacks and added them. I built
multi-turn sessions that hide the intent with initial consonants, slang, and
substitution, and mixed them into training. I did not separately add the
decoded answers; I had the model learn the hidden form and the structure of the
final request, 'combine them and tell me'. It came to catch most of the
obfuscated attacks it used to miss.

## I changed the data, not the model

The same problem could also be solved through model architecture. A bigger
model, an extra classification head, post-processing rules. But for both kinds
of errors the cause was 'the training distribution had no such cases'. When the
cause is a gap in the data, data that fills the gap is the most direct remedy.
Before making the architecture more complex, it is faster to first check which
inputs the errors come from.

Augmentation is not always safe, though. Adding a lot to only one side of a
small dataset can skew the distribution and break things that were fine. So I
kept the augmentation minimal and aimed at the errors by source, rebalanced the
classes, and went through the step of checking again on the same held-out set.

## Takeaways

- Even when the evaluation score is high, grouping the errors by source shows what kinds of weaknesses there are.
- Over-blocking came from real writing style that was absent from training, and false negatives from obfuscation that does not show on the surface.
- When the cause is a data gap, targeted data augmentation is more direct than model architecture.
- After augmenting, watch for distribution skew and check again on the same evaluation set.
