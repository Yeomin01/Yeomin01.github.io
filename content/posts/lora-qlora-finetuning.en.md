---
title: "Fine-Tuning 7B and 10B Models on a Single 16GB GPU — LoRA / QLoRA"
date: 2026-05-25
draft: false
tags: ["paper review", "LLM", "fine-tuning", "LoRA", "QLoRA", "PEFT"]
categories: ["Fine-tuning"]
summary: "Training a multi-billion-parameter model in full runs out of GPU memory before anything else. LoRA trains only low-rank matrices, and QLoRA adds 4-bit quantization to shrink the problem. This post covers the core of the two papers and the capacity issue I weighed when choosing the rank."
---

## The memory cost of full fine-tuning

Full fine-tuning of a 7B model takes more than loading the model weights.

- Model weights: 7B × 2 bytes (fp16) = 14GB
- Gradients: another 14GB
- Optimizer state (Adam): about 2x per parameter = 28GB+

Together that is over 60GB. A single 16GB GPU cannot even start training. This is where PEFT (Parameter-Efficient Fine-Tuning) becomes necessary.

## LoRA: training only the change, at low rank

The premise of Hu et al. (2021), *LoRA: Low-Rank Adaptation of Large Language Models*, is this: the weight change ΔW produced by fine-tuning can be approximated at low rank.

So instead of updating the huge weight matrix W as a whole, the change ΔW is expressed as the product of two small matrices.

```
W_new = W + ΔW
ΔW = B · A     (B: d×r,  A: r×d,  r ≪ d)
```

![Diagram of the LoRA low-rank decomposition](/images/lora_decomposition.png)

- The original W is frozen, so it needs no gradient or optimizer state.
- Only A and B are trained. At r=16 that is under 1% of the original parameters.
- At inference, merging them into W + BA leaves no extra computation.

When the trainable parameters drop below 1%, the optimizer state memory drops by the same proportion, and it all fits in 16GB.

## QLoRA: quantizing the original to 4-bit

Even with LoRA alone, the 14GB of original weights (fp16) still has to be loaded on the GPU. At the 10B class it gets tight again.

Dettmers et al. (2023), *QLoRA: Efficient Finetuning of Quantized LLMs*, goes one step further from here.

- The original weights are loaded quantized to 4-bit (NF4, NormalFloat). Memory is about 1/4.
- An fp16 LoRA adapter is placed on top and trained.
- Double quantization (quantizing the quantization constants as well) and a paged optimizer save more.

The original is squeezed to 4-bit and only read, and only the trainable part keeps its precision. This combination made it possible to fine-tune multi-billion-parameter models on a single GPU. The paper presents a case of fitting a 65B model on a single 48GB card.

This 4-bit + LoRA combination is also what let me run 7B–10B models on a single 16GB GPU.

## Rank and capacity

LoRA's `r` (rank) sets how expressively the change is approximated. Smaller is better for memory and speed, but the representational capacity shrinks with it.

When several kinds of output had to be learned at the same time, r=16 made it hard to get three kinds right together. A trade-off appeared: strengthening one side made another drop.

- Raising r (32, 64) adds capacity, and joint training improves.
- In exchange, trainable parameters and memory also grow.
- If the distribution of the training data is thin, raising r alone has limited effect. When there is not enough to represent, the added capacity goes unused.

In the end r has to be set to match the diversity of the data and the number of tasks trained together. Neither keeping it small nor always making it large is a general answer.

## Takeaways

- Full fine-tuning has a high memory cost. LoRA approximates the change with low-rank matrices, and QLoRA adds 4-bit quantization to reduce that cost.
- LoRA cuts the trainable parameters to under 1%, and QLoRA's 4-bit cuts the original's memory to about 1/4, which makes single-GPU fine-tuning possible.
- The rank `r` determines representational capacity. When several tasks are trained together, a small r forces a trade-off, so choose it with both the data diversity and the number of tasks in mind.

---

### References

- Hu, E. et al. (2021). *LoRA: Low-Rank Adaptation of Large Language Models.* arXiv:2106.09685.
- Dettmers, T. et al. (2023). *QLoRA: Efficient Finetuning of Quantized LLMs.* arXiv:2305.14314. (NeurIPS 2023)
