---
title: "When More Epochs Stop Helping — The Plateau and Weak Forgetting in Fine-Tuning"
date: 2026-06-01
draft: false
tags: ["LLM", "fine-tuning", "epoch", "plateau", "forgetting", "QLoRA"]
categories: ["Fine-tuning"]
summary: "In fine-tuning it feels like more epochs should always help, but at some point the curve stops, and past that it starts to get slightly worse. This post covers the plateau, where the ceiling of the training signal is reached, and the weak forgetting / weak overfitting that shows up faintly after it."
---

Surely one more epoch will make it at least a little better. That is an intuition people often fall into when they first work with SFT. In practice fine-tuning stops improving at some point, and running it further starts to make things slightly worse. This post splits that into the plateau and the weak forgetting beyond it.

## The plateau — where the data's training signal ends

The plateau is the stretch where the learning curve flattens. Looking only at the train loss curve, it can feel like "it still seems to be going down slowly," but if you record the downstream evaluation metric per epoch, from some point on there is effectively no change.

The cause is simple. A model can only learn the patterns that are in the training data, and the training signal the data holds is finite. Adding epochs means showing the same data more times, and once the model has absorbed nearly all of that signal there is nothing new left to learn. It is like reading the same textbook a seventh time: no new content appears.

Where the plateau starts depends on the amount and diversity of the data, the model capacity, and the learning rate. In a typical instruction tuning scenario, though, it is observed fairly early, often within 2–4 epochs.

![An example of the plateau + weak forgetting pattern](/images/plateau_pattern.png)

As in the example above, all three classes peak (circle markers) at about the same time, then stay flat beyond that and drift down slightly. A class like class C, where the data is scarce or the model is weak, often tends to peak slightly later and erode faster afterward.

## Weak forgetting — the stretch after the plateau where things get slightly worse

Run more epochs after the plateau and the evaluation metric often drops slightly. The drop is small, around 0.001–0.005, so it looks like noise, but if several metrics move consistently in the same direction it should be read not as noise but as **weak forgetting** or **weak overfitting**.

Two phenomena are mixed together in this stretch.

**Forgetting, from the continual learning view** — When the model trains on the same data repeatedly, it specializes more and more to the current distribution, and in the process the general abilities the base model had, or the things it did well at an earlier stage, weaken little by little. This is an old, well-known problem in neural networks: McCloskey & Cohen (1989) first reported it under the name *catastrophic interference*, and Goodfellow et al. (2014), *An Empirical Investigation of Catastrophic Forgetting in Gradient-Based Neural Networks*, confirmed quantitatively that the same pattern appears in modern neural networks too. When several kinds of output have to be trained at once, it shows up as the metric for one kind slowly eroding. (Related: [the catastrophic forgetting post](/en/posts/catastrophic-forgetting-llm/))

**The classic overfitting view** — Once the model starts memorizing even the fine noise and bias in the training set, the train loss keeps going down while performance on the evaluation set stalls or drops. The more epochs, the wider this gap.

In an actual epoch sweep the two effects do not separate cleanly; they appear together. A common pattern is "everything erodes slightly together, and one or two categories erode a bit faster."

## How to notice it

Almost the only signal for noticing the plateau and weak forgetting is the **per-epoch downstream evaluation metric**. The train loss can keep going down slowly after the plateau, so looking at the loss alone, more training seems worthwhile. The evaluation-set metric does not behave that way.

- Set up a sweep that records evaluation results at epoch 1, 2, 3, ….
- If several categories peak at about the same time and then all decline slightly, treat it as having reached the plateau.
- If only one or two categories keep rising while others fall, that is a trade-off stretch, and when that accumulates until everything starts eroding together, it has moved into the weak forgetting stage.

Evaluation may be too expensive to run a long sweep, but locating the plateau at least once gives you a reference point for later decisions. Without knowing where the plateau is, you cannot tell whether "more epochs do not help" is a data problem, a model problem, or a problem that more training would solve.

## The next lever once you reach the plateau

Epochs no longer helping means "the model has absorbed nearly all of the training signal in the data." To raise that ceiling you have to move to a different lever instead of pulling the same one (epochs).

**On the data side**:
- Increase the share of hard cases and weak categories in the training set. Even at the same volume, more exposure to the areas the model cannot solve gets the metric moving again.
- Data pruning — training on a subset that filters out noise and duplicates while keeping diversity can improve generalization even at the same number of epochs. (Related: [the data pruning and scaling post](/en/posts/data-pruning-scaling-laws/), [the three-stage data selection pipeline](/en/posts/data-selection-pipeline/))

**On the model capacity side**:
- Increase LoRA's `r`. When several kinds of output are trained at once, a small `r` strengthens the trade-off where reinforcing one side erodes another. Raising it from `r=16` to `r=32` gives room to learn them together.

## Takeaways

- The plateau is the point where you have reached "the end of the training signal the data holds."
- Running more epochs beyond it brings weak forgetting and slight overfitting together, and the evaluation metric usually erodes slowly.
- To actually see it you need a per-epoch sweep of the evaluation metric. It does not show in the train loss alone.
- Once you hit the plateau, move the lever from epochs to data quality and diversity, or to model capacity.

---

## References

- McCloskey, M., & Cohen, N. J. (1989). *Catastrophic interference in connectionist networks: The sequential learning problem*.
- Goodfellow, I. J., Mirza, M., Xiao, D., Courville, A., & Bengio, Y. (2014). *An Empirical Investigation of Catastrophic Forgetting in Gradient-Based Neural Networks*. arXiv:1312.6211.
- Kirkpatrick, J., et al. (2017). *Overcoming catastrophic forgetting in neural networks*. PNAS. — EWC, a method for mitigating forgetting.
- Hu, E. J., et al. (2021). *LoRA: Low-Rank Adaptation of Large Language Models*. arXiv:2106.09685. — the role of `r` from a capacity standpoint.
