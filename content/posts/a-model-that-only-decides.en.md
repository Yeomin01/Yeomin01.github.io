---
title: "A Model That Only Decides, Without Generating — Jev and kev"
date: 2026-10-13
draft: false
tags: ["decision model", "guardrail", "second-stage verification", "calibration", "LoRA", "small models"]
categories: ["ML"]
summary: "Last month a decision model came out that 'writes no text and only outputs probabilities', and a model rebuilt with open weights soon followed. From public material, I summarized the architecture and how to use it, the limits the author wrote down, and the outside evaluation. I also note what to look at if it goes into the second-stage verifier slot of a detection pipeline."
---

## Continuing

An earlier post covered using a small generative model as a second-stage verifier. That is the slot that receives only what the first-stage detector caught and asks again, "is this verdict right?" A generative model writes its answer as a sentence, and that sentence is read back and turned into a true positive or a false positive.

In September a model came out that removes that middle step. It writes no text. **It outputs only probabilities over the options.** Everything below is read from public material.

## Jev and kev

**Jev** is a hosted-only model that a startup released in early access in mid-September. It takes one document and several typed questions. The questions come in three kinds: yes/no, choose one of several, and a graded score. The answer is the probability of each option. It generates no text. The architecture and training data are not public, and there are no weights.

**kev** is a model that a developer released right after that. It implements the same input/output contract with open weights, under the Apache-2.0 license. The setup described in the 4B model's card is as follows.

- A 4B-class pretrained model is **kept frozen**, with LoRA (rank 16) on top of it.
- A small **decision head** is attached in place of the vocabulary head. It takes the dot product of the hidden states of each option's last token and the question's last token and applies a softmax.
- Probabilities are calibrated with a single temperature (the card's value is 2.41).
- Each question runs as an independent row of "document + that question", and the document part is computed once and reused.

One thing to note. kev does not port a published Jev architecture. Jev's architecture has never been published, and what kev followed is **an architecture a third party estimated by probing from outside**. The person who wrote that estimate also noted that much of it is guesswork. The figures comparing the two models also come from the kev author's own evaluation.

## What fits the second-stage verifier slot

The reason the decision model caught my eye is the shape of its output.

- **You get a probability directly.** There is no step of re-interpreting a sentence. The threshold can be moved to fit the operating point.
- **Latency is not tied to output length.** With the generative model, the stricter the prompt, the longer the answer and the slower it got. A decision model is done in one pass. The repository gives a figure in the 40 ms range for six questions on a short text on a 48GB-class card.
- **It asks several questions at once.** The document is read only once and it branches per question.
- **The fine-tuning path is open.** A row in the same shape as a request, with just the answer attached, becomes training data. It says to continue training from the released weights, and that starting fresh from the base loses the original capability.

## What to check before using it

These are the limits the author wrote down in the card and the repository.

- **It is English-only.** Other languages are out of scope and fine-tuning is recommended. It is not something to feed Korean policy documents into as is.
- **The calibration temperature is a value fitted on the author's dev set.** It may not fit when moved to a different task, so the author says to refit it on your own data. That means 0.5 must not be assumed as the threshold.
- **The answer can change with the order of the options.**
- **Date arithmetic is its weakest point.** Accuracy goes down on long documents.

The hosted-only one has a different constraint. It can only be tested with data that can be sent outside. Measuring against internal standards requires weights that can be downloaded and run. That is probably one reason the open reimplementation spread quickly.

## The outside evaluation

In early October, engineers at an open-source company published a post comparing Jev with existing guardrails. On prompt injection detection Jev was 4th at 86.4%, behind a small classifier (89.0%, 54 ms latency) and LLM-as-judge with a large model. On harmful content it was 1st at 86.2%, but the gap to the next was under 1 point. The conclusion is that decision models **do not consistently beat** LLM-as-judge or existing classifiers. Only English was measured, and the latency includes network time.

In short, there is no evidence yet for "it is more accurate because the architecture is new". What there is, is an advantage of form: "the same job, as a probability, fast".

## Zooming out

Using a generative model for decisions was the long way around. You have it write the decision as a sentence, and then pull the decision back out of that sentence. Format errors, length, and interpretation rules get in between. A decision model straightens that road.

In exchange, there is less room to explain a policy at length. A generative model reads and follows an instruction with twenty examples attached. A decision model takes a short question and options. It will probably fit well in a slot where the policy reduces to one sentence, and in a slot with many exceptions it will probably need fine-tuning. Then it becomes a data problem again. You need data that carries not only "what must be blocked" but also **the answers for "what must not be blocked"**.

## Notes

- With a model that outputs probabilities, do not assume 0.5 is the threshold. Pick the threshold on your own dev set and redo the calibration.
- When swapping the second-stage verifier, measure each slot separately. A slot with a short policy and a slot with many exceptions can give different results.
- For a new model's comparison figures, first look at who measured them and under what conditions. Check whether the author's own evaluation and the outside evaluation say the same thing.

### References

- Guo, C., Pleiss, G., Sun, Y., Weinberger, K. Q. (2017). _On Calibration of Modern Neural Networks._ ICML. (how to calibrate probabilities with a single temperature, and the point that calibration is tied to the data distribution)
- Hu, E. J. et al. (2022). _LoRA: Low-Rank Adaptation of Large Language Models._ ICLR. (a method that keeps a large model frozen and trains only low-rank matrices)
- Vinyals, O., Fortunato, M., Jaitly, N. (2015). _Pointer Networks._ NeurIPS. (an architecture that answers by pointing at a position in the input instead of choosing from a vocabulary)
- Model and evaluation sources: [kev repository](https://github.com/jaredpalmer/kev) · [kev-4b model card](https://huggingface.co/jaredpalmer/kev-4b) · [Jev introduction post](https://typesafe.ai/blog/introducing-system-one-models-and-jev) · [architecture estimate post](https://archerhume.com/posts/jevs-architecture-unmasked/) · [guardrail comparison evaluation](https://developers.redhat.com/articles/2026/10/02/benchmarking-ai-decision-models-against-traditional-guardrails)
