---
title: "Train on Instructions and the Model Does Tasks It Was Never Taught — Instruction Tuning"
date: 2026-05-27
draft: false
tags: ["paper review", "LLM", "fine-tuning", "instruction-tuning"]
categories: ["Fine-tuning"]
summary: "Instead of supervised training on label-only data, train in the form of instructions that say 'do this' and the model generalizes to tasks it was not trained on. This post covers the background papers for instruction tuning (FLAN, InstructGPT) and the choice of which format to train the same data in."
---

## Same data, two ways to train

When training an LLM on a task like entity extraction, the same data can be set up in two ways.

1. Supervised format — train directly on pairs of input text and gold label
2. Instruction format — an instruction such as "find X in the following text and return it as JSON" + the input + the answer

Both use the same data, but the latter teaches the model "how to follow instructions" itself. That difference affects generalization.

## FLAN: instruction training produces zero-shot generalization

The key result of Wei et al. (2021), *Finetuned Language Models Are Zero-Shot Learners* (FLAN), is as follows.

- Convert many tasks into instruction format and train on them together.
- Zero-shot performance then rises even on new tasks that were not part of training.

This is because the model is not memorizing individual tasks but learning "the pattern of reading an instruction and responding accordingly." A model that has become used to the instruction format handles instructions it has never seen in a similar way.

## InstructGPT: alignment that makes the model follow instructions

Ouyang et al. (2022), *Training language models to follow instructions with human feedback* (InstructGPT), goes one step further.

- After teaching instruction following with supervised fine-tuning,
- it applies RLHF (Reinforcement Learning from Human Feedback) on human preference data to align the responses.

The important observation here is that the 1.3B InstructGPT was preferred over the 175B GPT-3 in human evaluation. It means that "whether the model was trained to follow instructions" can matter more for real usefulness than model size.

## What I considered when choosing the format

Training in instruction format comes with decisions to make.

- How to describe the task in the system prompt (what to find, the output format, the constraints)
- Whether to fix the output schema (for example, a JSON structure)
- Whether to also train auxiliary fields such as the reason for the decision

The advantage of instruction format is generalization, but it has a premise. The instruction used in training and the instruction used at inference must match. If the format drifts, the model receives input that differs from the pattern it learned, and performance drops. So it is safer to treat the instruction not as a code constant but as part of the learned input distribution.

## Takeaways

- Instruction tuning teaches "how to follow instructions" instead of labels alone. As a result the model generalizes to tasks it was not trained on (FLAN).
- Aligning a model to follow instructions can have an effect that outweighs model size. There is a case where a small InstructGPT was preferred over a large GPT-3 (InstructGPT).
- When using instruction format, the training and inference instructions have to match, because the instruction itself is part of the training distribution.

---

### References

- Wei, J. et al. (2021). *Finetuned Language Models Are Zero-Shot Learners.* arXiv:2109.01652. (FLAN)
- Ouyang, L. et al. (2022). *Training language models to follow instructions with human feedback.* arXiv:2203.02155. (InstructGPT)
