---
title: "Retraining with Only More Attacks Came Back as False Positives"
date: 2026-10-06
draft: false
tags: ["multi-turn", "retraining", "paired data", "false positive", "distribution"]
categories: ["ML"]
summary: "I retrained four times to reinforce weak attack types. The detection rate went up, but each time false positives multiplied several times over on a different form of benign dialogue. The cause was the same. If you add only attacks, with no benign controls that share the same surface form, the model learns the surface form of the attack and not its intent."
---

## Background

The multi-turn jailbreak detection model was weak on certain types: the type that hides intent by changing how the words are written, the type that gets a harmless text and then changes the output through repeated requests to revise it, the type wrapped as a code-debugging question, and so on. I retrained four times to reinforce these types. In the end none of the four versions beat the deployed one.

## The four attempts

In the first, I added several hundred hard attack cases of the weak types. The detection rate clearly went up, especially on English attacks. In exchange, benign false positives became about 5 times as many. When I opened up the added false positives, most were Korean everyday conversations with a way of speaking that keeps asking for alternatives, like "Isn't there another way besides that?" The surface form of the chained-editing attack was "asking again and again", and the model learned that surface form as an attack signal.

In the second, I reinforced the benign side. I added 1,500 long-running financial consultation dialogues. The targeted false positives did not go down, and the detection rate dropped sharply. The benign data I added differed from the distribution where the false positives occurred (consultation dialogues versus everyday re-asking), and there was so much of it that the decision boundary was pushed toward the benign side.

In the third, I added only a small amount (a few hundred) of benign data from the same distribution as the false positives, that is, dialogues on everyday topics that keep asking for alternatives. Those false positives were fixed. But false positives on Korean code dialogues jumped from nearly 0% to about 19%. The model called one in five an attack. Among the hard cases added in the first attempt, the code-context attacks were all in Korean, and there were no benign code dialogues to pair with them. The model learned "Korean + code = attack". That false positives on English code dialogues were much lower pointed the same way.

In the fourth, I added paired attack and benign data that use the same technique and differ only in the goal. I believed this was the right direction, but I stopped the training partway when work began on rebuilding the evaluation criteria themselves.

## The common cause

The same thing happened all four times. The model learns the easiest feature that separates attack data from benign data. If there is a surface form (language, format, way of speaking) that appears only in attacks and not in benign data, that becomes the easiest feature. Intent is harder to learn than surface form.

So when adding attacks, benign data with the same surface form has to go in with them. Add code-context attacks and you add code-context benign data; add attacks in the re-asking form and you add benign data in the re-asking form. Only then can the surface form not serve as a discriminating signal, and the model has to look at the difference in goal.

## What the measurement missed

There was also a reason I saw this problem late. I measured benign false positives on a single benign set. That set had almost no document or code formats, so the third version's false positives on code dialogues were invisible at first. They showed up only after I built separate benign sets per format (everyday, work, document, code). False positives have to be measured per cell.

## Looking back

Later, while rebuilding the evaluation principles, I saw one more thing. In all four retraining runs, I had decided what to reinforce by looking at the false negatives on the evaluation benchmark. That benchmark later became the source of the evaluation set. So I decided to treat the detection-rate gains these versions got in evaluation as contaminated numbers and not to use them as a basis for comparison. The next reinforcement starts from a dev set separated from the evaluation set.

## Takeaways

Retraining that adds only attack data raises the detection rate, and in return comes back as blocking benign inputs that have the surface form of those attacks. Add benign controls with the same surface form alongside, fit both the distribution where the false positives occurred and the amount when adding benign data, and measure false positives separately per format. These three were what the four failures pointed to.
