---
title: "PII Guard Input Is a List of Sentences, Not the Whole Text; Output Is Classification + Reasoning"
date: 2026-06-10
draft: false
tags: ["PII", "NER", "guardrail", "sentence splitting", "inference"]
categories: ["Design"]
summary: "I decided to refine how the PII layer of an AI guardrail is called, in two directions. On the input side, the text is no longer thrown in whole but cut into sentences and sent as a list. On the output side, the layer returns per-category classification + threshold + reasoning to the gateway instead of a plain on/off. This post lays out where the model's responsibility and the gateway's responsibility part, and why splitting them this way is natural."
---

The PII guard is a BERT NER-based security layer that detects PII in the text it receives and decides whether to mask it. The gateway calls it, takes the result, and decides the follow-up handling (mask, block, or pass). I decided to refine both ends of that call interface, in two directions.

## Input — a list of sentences, not the whole text

Until now, the text the user entered was handed to the PII layer in one piece, and inside the layer a morphological analyzer (kiwi) cut it into tokens that were fed to NER. This flow has two problems.

First, a NER entity almost always closes within one sentence. Expressions caught as PII, such as names, phone numbers, resident registration numbers, and addresses, do not spill over into another sentence. But when the whole text is turned into one token sequence at once, more than half of the context the model has to process is other sentences unrelated to the entity. With that much noise, the cost of processing a long sequence goes up, and sometimes a word from another sentence gets wrongly pulled into a label like ORG or NAME.

Second, the whole text often exceeds BERT's max_length (usually 512). The part that overflows is either truncated or split with a sliding window, and with both methods an entity that falls on a boundary is easily cut. When one person's address is split across two windows, one side misses it and the other catches only half.

Cutting by sentence solves both problems together.

```python
# Before
result = pii_layer(text)              # text = the whole text

# After
sentences = split_sentences(text)
results = pii_layer(sentences)        # called with a list [s1, s2, ...]
```

Sentence splitting is lighter work than morphological analysis ([. ?! newline + Korean sentence-final endings] is about enough), and the result list keeps the sentence order of the original text as it is. When the gateway takes the results and joins them back into the text, it only has to follow the sentence index.

Another benefit of calling per sentence is caching. Cases where the same user sends the same sentence repeatedly (system prompts, frequently used phrases) are not rare, and with sentence units the hash key is short, so the cache hit rate goes up.

## Output — classification + threshold + reasoning, not on/off

If the layer returns only a binary answer, PII caught or not caught, there is not much the gateway can do. A policy of whether to mask, pass, or block needs finer input than just the detection itself.

- Which category was caught (a name, a resident registration number, a foreign company name)
- How confident the model is (a logit, or a calibrated probability)
- Why it classified it that way (the context of the token, the matched pattern, which entry of the dictionary list)

When these three come out together, the gateway can handle each case by policy. For example, even with the same ORG label,

- "이재용" (Lee Jae-yong) + reasoning "DART list of unlisted externally audited companies + ORG context" — mask
- "LG전자" (LG Electronics) + reasoning "matched the DART listed-company list — public_negative" — pass
- "포레스트병원" (Forest Hospital) + reasoning "licensed business + ORG suffix match" — mask

the branches differ. If the model returns only "ORG caught / not caught", these branches cannot be built, and the gateway has to run the dictionary matching again. That amounts to computing twice the information the model already had at the inference step.

A threshold can also be set within the same category. A token where the trained PII NER has confidence 0.95 and a token where it has 0.55 should be handled differently. If the gateway uses a conservative policy it masks 0.55 too, but under a permissive policy it passes anything at 0.85 or below. If the model applies a threshold uniformly and returns only "caught / not caught", this room for adjustment disappears.

The format of the reasoning is free, but at least the following information has to be in it for the gateway to use it.

```json
{
  "text": "포레스트병원",
  "label": "ORG",
  "confidence": 0.93,
  "reasoning": {
    "matched_pattern": "1-6 Hangul characters + 병원 (hospital)",
    "list_hit": "localdata_health",
    "context": "포레스트병원에서 진료받았다 (I was treated at 포레스트병원)"
  }
}
```

## The responsibility boundary of the two changes

With these two changes, the roles of the model and the gateway separate.

- The model focuses on identifying PII candidates within the input sentence and returning category + confidence + the basis for the classification.
- The gateway combines the result it receives with policy (user permissions, domain, context) and decides the final handling.

Before, the model applied even the threshold uniformly and returned only a plain detection result, and the gateway worked as a simple on/off. So changing the policy meant retraining the model. In the new structure, the model training is left as it is, and changing only the threshold and policy at the gateway changes the behavior.

## Takeaways

I reworked both ends of the PII guard's call interface. The input got lighter, from the whole text to a list of sentences, and the output got richer, from plain detection to category + confidence + reasoning. Both changes are work to separate the roles of the model and the gateway clearly. Classification belongs to the model and policy to the gateway, and I reflected that boundary in the interface itself.
