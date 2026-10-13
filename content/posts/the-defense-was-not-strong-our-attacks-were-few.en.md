---
title: "The Defense Was Not Strong; Those Were Just the Only Attacks We Had"
date: 2026-08-20
draft: false
tags: ["red teaming", "benchmark", "generalization", "evaluation", "security", "sample"]
categories: ["ML"]
summary: "I fixed the defense prompt and the attack strategies and changed only the model, and structured PII leakage split into 48% and 2%. The 2% model was not safe; those strategies had been built while breaking the 48% model."
---

## Continuing

To see how differently each model holds up against the same attacks, I fixed the defense system prompt, the 20 attack strategies, and the conversation format, and swapped **only the defender model**.

The results split quite a bit.

```
Model A (API)            456 conversations   structured PII leaks 197 (43%)
Model A (open weights)   160 conversations                         77 (48%)
Model B                  160 conversations                          4 (2%)
```

In 160 conversations, Model B **did not leak a single** resident registration number, card number, or passport number. Only a few names and organization names came out.

## It was neither an API issue nor a deployment issue

The first thing I suspected was hosting: either a separate filter behind the API or, the other way round, the open weights being softer.

The API version and the open-weights version of the same family landed close together at 43% and 48%. It is a **difference between families**, not the form of hosting. That was a clean conclusion.

The problem is the sentence I wanted to write next: "Model B is robust against PII leakage."

## Where those 20 came from

The 20 strategies did not fall from the sky. They were written and refined **while breaking Model A**. What did not work was thrown out, and what worked got variants. In other words, this attack set is optimized for a specific defender.

The 2% measured with that set did not measure "Model B is safe" but **"attacks tuned for Model A do not transfer well to Model B."** A failure to transfer may or may not be related to defensive strength. This experiment alone cannot tell them apart.

In fact, when I later attached automated search and evolved the strategies, combinations that had never been broken with the initial list started to break. The 0% of a fixed attack set has a short shelf life.

## Sometimes the sample cannot reach a conclusion

In the same batch I compared two versions of our guard, and 456 conversations could not tell them apart (p = 0.79). That does not mean there is no difference; it means **this sample cannot decide**.

These two are often mixed up. Report it as "no difference" and the reader takes it as equivalence, and that conclusion travels all the way to a deployment decision. In reality it is close to having measured nothing.

## Zooming out

A benchmark number does not measure "is this system safe?" It measures **"how does it do against this attack set?"** The distance between the two sentences widens in proportion to where the attack set came from.

So when writing down defense performance, the origin of the attack set has to be written down with it: who made it, what it was refined against, how many kinds there are. Leave that out and the number walks around on its own and gets cited as a much stronger claim than the evidence supports.

"We could not break it with the attacks we have" is as far as the measurement goes. Everything after that is inference, and it has to be marked as inference.

## Notes

- A comparison that changes only the defender is conditional on the attack set. If that set was built while breaking a specific defender, a low number may be a failure to transfer.
- A 0% measured with a fixed attack list has a short shelf life. Attach search and the cells that had not been broken are the first to break.
- Write "no significant difference" and "no difference" as separate things. Turn something the sample is too small to decide into equivalence, and that misunderstanding travels all the way to the deployment decision.

### References

- Perez, E. et al. (2022). _Red Teaming Language Models with Language Models._ EMNLP.
- Wei, A., Haghtalab, N., Steinhardt, J. (2023). _Jailbroken: How Does LLM Safety Training Fail?_ NeurIPS.
- Zou, A. et al. (2023). _Universal and Transferable Adversarial Attacks on Aligned Language Models._ (deals head-on with the transferability of attacks across models)
- Recht, B. et al. (2019). _Do ImageNet Classifiers Generalize to ImageNet?_ ICML. (adaptive overfitting to a fixed evaluation set)
