---
title: "Code Computes the Value, the LLM Only Writes the Sentence"
date: 2026-08-20
draft: false
tags: ["PII", "synthetic data", "red teaming", "checksum", "generator", "design"]
categories: ["ML"]
summary: "I had to produce conversations containing rule-conforming PII in bulk. Even with the checksum formulas handed to the LLM verbatim, the valid rate was 6–32%, and switching models did not close the gap. Reversing the generation order made it 100%."
---

## Continuing

Red teaming PII detection takes a lot of conversations containing PII whose **format is actually valid**. A value with the right number of digits and a wrong checksum is useless. If the detector misses such a value there is no real harm, so it should not be counted as a false negative.

The first method that comes to mind is to have the LLM write the conversation and make up the values inside it too. I tried it.

## It cannot make them even when given the rules

To measure fairly, I put each label's checksum formula **verbatim in the system prompt**: the weight array, the modulo operation, even the correction term. Then I judged the generated values with the production validator.

```
                              LLM-A    LLM-B
Resident registration number  12.6%    10.3%
Alien registration number      5.7%     6.4%
Business registration number   8.9%     8.9%
Credit card                   31.9%    10.0%
```

Two models from different families did about equally badly. That means this is not a gap a prompt can close. **Explaining** a rule and **computing with it and writing the result** are different jobs.

The card is the only high one because it only has to satisfy Luhn, but even that 32% is unusable once you look inside it. Widely known test card numbers and their variants keep repeating. The unique rate of the values was 74%. The other 26% were the same value coming out again.

## I reversed the order

So I split the roles.

- **Value** — Python code computes the checksum and fixes the value.
- **Conversation** — the LLM writes it. The value is already decided, and it is planted in the chatbot system prompt as "registered customer information."

The valid rate became 100%. Of course it did. Producing a value that satisfies a checksum was a ten-line function all along.

There was one more bonus. **The ground-truth labels are free**. The code knows which value was planted where, so there is no separate labeling. No human effort goes in, so there is no upper limit on the amount generated.

## What changed

What changed was not the model but the **task decomposition**. Before, I was asking one model for "a plausible conversation" and "a value that conforms to the rules" at the same time, even though the two abilities are completely different in nature.

Now code handles the deterministic part and the model handles the part that needs diversity. So **model performance and data quality are decoupled.** Swap in a smaller model and the values are still 100% valid. Only the naturalness of the conversation changes.

## Zooming out

When designing a generation task, the first question tends to be "can the model do this?", but the better question is **"how much of this is deterministic?"** The parts under a verifiable constraint are usually cheaper and more reliable to solve in code.

And pushing that constraint into the prompt is expensive, because it is silent when it fails. A value with a wrong checksum does not throw an exception. It just sits mixed into the data, and later makes the false negative rate measured on that data untrustworthy.

## Notes

- Do not have the model make up values that carry a verifiable constraint; compute them in code. Giving a rule in the prompt is different from the model computing with that rule and writing the result.
- The valid rate alone is misleading. Look at the unique rate of the values that passed as well — if widely known test values repeat, they are valid but still unusable as data.
- Fix the value first and make the sentence afterward, and the ground-truth labels come for free. When the labeling cost is 0, there is no upper limit on the amount generated.

### References

- Dziri, N. et al. (2023). _Faith and Fate: Limits of Transformers on Compositionality._ NeurIPS. (measurements showing that accuracy drops sharply on computations where steps stack up, such as multi-digit arithmetic)
- Nogueira, R., Jiang, Z., Lin, J. (2021). _Investigating the Limitations of Transformers with Simple Arithmetic Tasks._
- ISO/IEC 7812-1. _Identification cards — Identification of issuers._ (the card numbering scheme and Luhn validation)
