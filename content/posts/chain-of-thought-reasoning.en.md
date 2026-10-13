---
title: "If the Answer Comes First, the Model Fits the Reasoning to It — Chain-of-Thought"
date: 2026-06-01
draft: false
tags: ["LLM", "CoT", "reasoning", "fine-tuning", "prompting"]
categories: ["Learning Theory"]
summary: "Ask an LLM to answer a hard problem directly and it often gets it wrong. Add one line to the same problem, 'think through the steps and then answer,' and accuracy rises noticeably. This post covers why autoregressive models are weak to hasty answers, how Chain-of-Thought sidesteps that, and the path that led from prompting to training."
---

Ask an LLM to answer a hard problem directly and it often gets it wrong. But add one line to the same problem, "think through the steps and then answer," and accuracy rises noticeably. That is the starting point of Chain-of-Thought (CoT below).

## Why autoregressive models are weak to hasty answers

The core operation of an LLM is generating tokens one at a time in sequence (autoregressive). The next token is drawn from probabilities conditioned on every token generated so far.

In this structure, emitting the answer early causes two problems.

1. **There is no room to think.** If `A` comes out at the first token, as in "Answer: A," the tokens after it drift toward justifying the answer that is already fixed. There is no deliberation step of the kind a person goes through on a hard problem: "Hmm… A for now, but wait, it could be B… in the end it looks like C."

2. **It commits to the wrong answer.** Once it starts with `A`, it is statistically natural for the following tokens to reinforce that decision rather than overturn it, because for the model the most natural next token is one consistent with the context it has just produced.

These two problems do not resolve automatically because the model is large. They are a structural limitation.

## CoT — the working first, the answer after

Wei et al. (2022), *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*, offers a simple prescription. Through the prompt or the response format, lead the model to **write the reasoning first and the answer after it**.

Direct answer:
```
Q: Jinsu has 5 apples. He ate 2 and bought 3 more. How many?
A: 6
```

CoT:
```
Q: Jinsu has 5 apples. He ate 2 and bought 3 more. How many?
A: 5 at first. Ate 2, so 3 left. Bought 3 more, so 6.
   Answer: 6
```

The latter is longer, but accuracy goes up a lot. The same paper reports cases on math reasoning benchmarks such as GSM8K where the gap widens to nearly 40 percentage points, but only when the model is large enough.

![The effect of CoT is emergent with model scale — GSM8K benchmark](/images/cot_scale_effect.png)

The figure above simplifies the results of the same paper. On a small model (8B), CoT if anything lowers accuracy, or leaves it at a similar level. The effect starts to show as the model passes 60B, and at 540B the gap explodes. This kind of "ability that appears suddenly with scale" is called an emergent ability.

## Why it works

It works because it directly addresses the two problems above.

- **Room to think** — the reasoning tokens give the model "a context in which to organize information before drawing the answer." The model refers back to that context through attention and draws a more accurate answer.
- **Delayed commit** — because the answer comes last, the tokens before it form a flow that derives the answer naturally, as in "putting the thinking so far together…" The hasty commit is blocked.

In terms of attention as well, the reasoning tokens make explicit which parts of the input connect to the answer. A direct answer amounts to jumping from the whole input to the answer in one step, and that jump is hard when the distance is long.

## From prompting to training

CoT started as a prompting technique. Adding just the one line "Let's think step by step" has a large effect (Kojima et al., 2022, *Large Language Models are Zero-Shot Reasoners*). Applications also multiplied quickly: self-consistency (a majority vote over several reasoning paths, Wang et al., 2022), tree-of-thought, and various variants that extend reasoning from a chain into a graph.

The next step is to **build CoT in at training time**. Recent reasoning models such as o1, DeepSeek-R1, and Claude reasoning all exposed the model to large amounts of data in reasoning + answer format during training. A model trained this way goes through reasoning on its own at inference, with no separate instruction. Some also use RL to further optimize the length and accuracy of the reasoning.

## Training it yourself — data synthesis and format

Training CoT for your own task requires training data that contains reasoning text. Usually the reasoning is synthesized with a strong LLM (Claude, GPT, and so on) and attached to existing (input, answer) pairs.

For the format, the DeepSeek-R1 style is becoming the de facto standard.

```
Input: {task input}

Output:
<think>
... reasoning ...
</think>
{final answer}
```

The `<think>` tag makes the boundary between reasoning and answer clear, so at evaluation it is easy to extract only the answer part and score it.

At training time:
- user message: the task input only
- assistant response: `<think>...</think>` + the final answer

At inference time:
- The user gives only the input, and the model generates the reasoning and the answer itself.

One point here is commonly confused. The reasoning is not given in the model's *input*. The point is **teaching the model to *generate the reasoning itself* through training**. Train with the reasoning inserted into the input and, at deployment, the question remains of who will produce that reasoning, because in real inference the user gives only the task input.

## Tradeoffs

CoT is not free.

- **Output gets longer.** What used to be the answer alone now includes the reasoning, so it is usually 3 to 5 times longer. Generation is autoregressive, so time grows in proportion. Where real-time responses are required, the burden can be large.
- **The cost of synthesizing training data.** It takes extra calls to a strong LLM to produce the reasoning. Depending on the volume, the cost is not negligible.
- **It does not help every task.** On intuitive or simple classification tasks, CoT can become noise instead. The effect is large for multi-step reasoning, telling apart ambiguous categories, and handling long context.
- **Dependence on scale.** As in the figure above, on small models the effect of CoT is close to none or negative. Before training CoT at the 7B class or below, it is safer to first check the effect of CoT prompting on the same task with a large model.

## Takeaways

- Have it give the answer first and an autoregressive model goes into justification mode without deliberation.
- CoT avoids that trap by putting the reasoning ahead of the answer.
- It works through prompting too, but exposing the model to reasoning data at training time gives it the habit of going through reasoning on its own (the approach of o1, R1, and Claude reasoning).
- When applying it, weigh the latency increase, the data synthesis cost, and the model scale together.

Related: it is worth reading alongside [the data pruning post](/en/posts/data-pruning-scaling-laws/), on cutting the training data itself, and [the post on plateau and weak forgetting](/en/posts/epoch-plateau-and-weak-forgetting/), on moving to other levers after a plateau.

---

## References

- Wei, J., Wang, X., Schuurmans, D., et al. (2022). *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*. NeurIPS. — the original CoT paper.
- Kojima, T., Gu, S. S., Reid, M., Matsuo, Y., Iwasawa, Y. (2022). *Large Language Models are Zero-Shot Reasoners*. NeurIPS. — showed that zero-shot CoT is possible with the single line "Let's think step by step."
- Wang, X., Wei, J., Schuurmans, D., et al. (2022). *Self-Consistency Improves Chain-of-Thought Reasoning in Language Models*. ICLR. — improves accuracy by drawing several reasoning paths for the same problem and taking a majority vote.
- DeepSeek-AI. (2025). *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*. — the modern way of training reasoning models (SFT + RL).
