---
title: "The Evaluation Trap of Synthetic Data — Even When Eval Is 1.0"
date: 2026-06-12
draft: false
tags: ["LLM", "data", "synthetic data", "evaluation", "generalization", "OOD"]
categories: ["Data"]
summary: "When training data is made with a generative model, it is easy to make the evaluation set with the same generator too. Then the classifier gets the evaluation set almost perfectly right from surface artifacts alone, and that score says nothing about generalization. This post lays out why the distribution of the evaluation set matters."
---

## A perfect score that comes too easily

When training data is synthesized with an LLM, it is natural to make the evaluation set with the same pipeline too. Same generator, same prompt, same style.

On an evaluation set made this way, it is common for a classifier to score close to F1 1.0 from the first epoch. At first it is easy to think this is because the model is good, but usually it is the opposite. The training set and the evaluation set are the same distribution, so the classifier learns the generator's surface artifacts (a particular tone, sentence structure, stock phrases) rather than the content, and gets the answers right with those.

This score has two problems.

- It says nothing about generalization. It is only a score within the same distribution, and there is no knowing what happens on inputs outside the distribution.
- It is powerless for model selection. When the candidate models and settings all come out near 1.0, there is no telling which is better. A saturated metric loses its comparative information.

## It shows once you leave the distribution

Real performance shows on a distribution different from training. Evaluate a classifier trained only on synthetic benign data with conversations real people had, and the difference is visible.

In a case I saw directly, a model trained only on synthetic benign conversations had almost no false positives on the same synthetic evaluation set. But when real human conversations (spoken style, typos, emotional expressions, short and fragmentary utterances) were put in as benign, it mistook a considerable number of them for attacks. This is because the model had learned "the benign style of the synthetic generator", not "benign". Had I looked only at the synthetic evaluation set, this weakness would never have shown.

## How to build the evaluation set

Even when training on synthetic data, the evaluation has to include other distributions to mean anything.

- Data from a different source. Mix into the evaluation real data that did not come from the generator, or data made through a different route.
- Blocking leakage. Make sure training and evaluation do not share the same seeds or the same text. Even with the same generator, if the seeds overlap you are in effect measuring memorization.
- Hard cases. Collect separately the boundary cases where benign and attack are similar in form. The weaknesses the average score hides show up here.

Error analysis pairs with this process. Looking at which sources and which types the errors on the out-of-distribution evaluation cluster in tells you right away what data to add next. If false positives come from real conversations, put real conversational text into training, and if a particular attack type is missed, reinforce that type.

## Takeaways

A high score on a synthetic evaluation set is not grounds for reassurance. When training and evaluation are the same distribution, the score measures in-distribution fit, not generalization. The evaluation set has to include the distributions the model will actually meet, especially the ones training did not cover. Only then does the score have meaning, and the places where the model is wrong point to the next piece of work.
