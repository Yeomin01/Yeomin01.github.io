---
title: "Before Comparing, Have We Ever Trained on That Set?"
date: 2026-10-13
draft: false
tags: ["evaluation", "data leakage", "benchmark", "comparison", "contamination", "validation"]
categories: ["ML"]
summary: "I put out a table showing our detector at 0.956 and another model at 0.38 on public sets. A single question, 'is that set not data we trained on?', made me withdraw the table. Two of the three sources were in the training data. I made the same mistake twice in one week."
---

## Continuing

The last post was about a comparison that was wrong because the thresholds were not matched. This one is a step earlier. Before any threshold matching, I got it wrong at **whether that evaluation set could be used at all**.

I compared our detector with another public model on three public multi-turn attack sets. Recall 0.956 versus 0.38. The gap was large, and I reported it in a good mood.

The question that came back was one line. Is that test set not data we trained on? If so, of course we would do well.

## Two of the three sources were in the training data

When I checked, of the three attack sources **two were in the first-stage model's training data**. The remaining one was not in training, but it was the benchmark used to pick the epoch. A set used for model selection is a seen set too. I withdrew the recall comparison in full.

The embarrassing part is that I knew about this possibility. I had written "needs checking with the training side" in a footnote of the report. I wrote that and **put the numbers out first.** The footnote did not excuse it. Tables travel without their footnotes.

## Where to look

When a model has several parts, "training data" is not in one place either. I looked in four.

- The list of training sources for the first-stage classifier. The bundle kept per-source counts.
- The training code for the combiner on top of it. Which sets it was fit on was only in the code.
- The benchmark used to tune the epoch and the levels. It was in the comments.
- **The retrieval index of similar conversations.** The neighbor index used for the verdict also holds data wholesale.

The last one had no list, so I cross-checked it the way I described in an earlier post. Embed the set to be compared with the same embedder as serving and match it against the vectors in the index. One result stood out. The handoff document had a set **labeled an "out-of-distribution evaluation set", and 217 of its 300 items were inside the index**. What a document calls evaluation data and what was actually never seen were different questions.

## Once more in the same week

A few days later I did exactly the same thing on the PII detection side. I ran a comparison on a public Korean PII set, and with the question of whether it had gone into training left as "unverified", I put the full-set numbers into a presentation first. When I checked later, thousands of sentences from the train and validation splits were in our training data, and **only the test split was clean.** I replaced all the numbers.

Both times the order was the same. Unverified → numbers anyway → called out → withdrawn. So I turned the order into a rule. **If it is unverified, I do not put out numbers, and I ask for the check first.**

## Whether the labels measure our problem, too

Leakage was not the only problem. On a set of jailbreak conversations written by people, our recall came out at 0.34, and I put it in the table of weaknesses. This time the objection came from the opposite direction: are that set's labels gold that matches our policy?

They were not. An "attack" label in that set is a record that **a person succeeded in getting past a particular defense model**. The technique distribution mixes direct requests, obfuscation, intent concealment, reframing, and injection. What our detector is responsible for is "hiding a harmful goal across multiple turns", and a single-turn harmful request belongs to another layer. About the only part that fits the definition was the intent-concealing type.

I took the overall recall out of the table and wrote down only the part that fits the definition, separately. Unfavorable or favorable, **a number that measures a different thing is not a number.**

## Zooming out

A public set belongs to everyone, so it can end up in anyone's training. Not only ours. The model we compare against may have seen that set too, and there is no way to check. So a comparison on a public set is uncertain on both sides to begin with.

To be fair, it has to be guaranteed that neither side has seen the data. There are two ways. Pick a set that came out after the other model was released and check it against our training list, or build a new one only for the comparison. Both are a hassle, and so they do not get done.

## Notes

- Once a comparison set is chosen, before running anything, check whether it went into training, tuning, or the retrieval index. If it is unverified, put out no numbers.
- Do not trust a document that says "for evaluation"; cross-check against the data. Embedding matching takes a few minutes.
- Read samples to decide whether an external set's labels match the definition in our policy. A number from outside the definition is used neither as a strength nor as a weakness.

### References

- Kapoor, S., Narayanan, A. (2023). _Leakage and the Reproducibility Crisis in Machine-Learning-Based Science._ Patterns. (classifies the types of leakage between training and evaluation, and collects cases from papers across fields where the conclusions were overturned)
- Chen, S. et al. (2025). _Benchmarking Large Language Models Under Data Contamination: A Survey from Static to Dynamic Evaluation._ EMNLP. (surveys the problem of fixed benchmarks becoming contaminated, and the move toward evaluations that are built fresh each time)
- Golchin, S., Surdeanu, M. (2024). _Time Travel in LLMs: Tracing Data Contamination in Large Language Models._ ICLR. (a method for tracing, from a model's outputs, whether it has seen an evaluation set)
