---
title: "Does It Catch Only What It Learned, or Also What It Was Never Taught — Generalization and Memorization"
date: 2026-05-28
draft: false
tags: ["paper review", "LLM", "generalization", "memorization"]
categories: ["Learning Theory"]
summary: "Unlike rule-based methods, which match only a predefined list exactly, an LLM has room to generalize to inputs it was not trained on. But whether that is always generalization or is memorization has to be told apart. Based on a memorization paper, this post lays out the boundary between the two."
---

## The difference between rule-based and learned approaches

A problem of detecting some kind of item can be solved in two ways.

1. Rule-based (regex, dictionary matching) — catches only what exactly matches the defined list or pattern. If it is not on the list, it is missed.
2. Learned (LLM) — learns patterns from data. It has room to generalize, through context, to inputs it was not trained on.

The rule-based approach is deterministic and predictable but powerless outside the list. The learned approach has the potential to generalize, but that behavior is not always guaranteed.

![Coverage of rule-based vs learned approaches](/images/generalization_coverage.png)

## Preconditions for generalization

For a learned approach to handle inputs it was not trained on, a few conditions are needed.

- The model must have seen the token during pretraining. A completely new coinage is hard to infer.
- There must be context cues. It needs surrounding information that tells what kind of thing sits in that position.
- The patterns in the training data must be diverse enough. Train on only a few specific forms and the model memorizes those few; it does not generalize to a pattern.

So what the model learns is not the individual items themselves but the pattern "what appears in this kind of position and form is this kind of thing." Once it learns the pattern, it can also handle items it was not trained on when they appear in the same position and form.

## The boundary between memorization and generalization

A learned approach getting an untrained input right is not always generalization. It may have memorized the training data. Telling the two apart is a research topic of its own.

Carlini et al. (2022), *Quantifying Memorization Across Neural Language Models*, quantified memorization in LLMs.

- LLMs memorize parts of their training data verbatim and, when prompted appropriately, output them verbatim.
- Memorization grows log-linearly with three factors: (1) model capacity, (2) the number of times an example is duplicated in the data, (3) the length of the context used in the prompt.
- Memorization tends to increase as models get larger.

The important implication here is that "the more an example is duplicated, the stronger the memorization." Put the same item into the data many times and that item gets memorized, but that is different from generalization ability growing.

So if generalization is what you want, the right approach is to train on varied items in varied contexts rather than put the same item in repeatedly. Diversity drives pattern learning, and repetition drives memorization.

## How to verify

To check whether a learned approach actually generalizes, evaluate on items that were not used in training.

- Put items that were never in the training data into context and test.
- If it gets those right, generalization happened. If it gets only the trained items right and misses the untrained ones, it is closer to memorization.

A rule-based approach can never get an item right that is not in its definitions, so whether this generalization happens is the reason to choose a learned approach. But a verification step is needed to confirm that generalization actually happened.

## Takeaways

- Rule-based catches only what is defined, and learned has room to generalize to inputs it was not trained on.
- Generalization has preconditions: pretraining knowledge, context cues, and diversity in the training data.
- Getting an untrained input right is not always generalization. It may be memorization. Repetition drives memorization, and diversity drives generalization (Carlini et al. 2022).
- Whether generalization happened is checked by evaluating on items not used in training.

---

### References

- Carlini, N. et al. (2022). *Quantifying Memorization Across Neural Language Models.* arXiv:2202.07646.
