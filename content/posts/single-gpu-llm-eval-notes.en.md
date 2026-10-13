---
title: "What I Ran into Evaluating a 4-Bit LLM on a Single GPU"
date: 2026-05-29
draft: false
tags: ["LLM", "QLoRA", "inference", "GPU", "troubleshooting", "bash"]
categories: ["Engineering"]
summary: "Evaluate a 10B-class model fine-tuned with QLoRA on one GPU for long enough and you lose time to operations rather than to the model itself. This post covers why 4-bit inference is slow, serializing training and evaluation on the GPU, the buffering problem that hid the progress output, and why a running script should not be touched."
---

Evaluating a model that has finished training looks simple. But with only one GPU and jobs that run for days, I lose more time to operations than to the model. Here are four things I ran into this time.

## Why 4-bit inference is slow

QLoRA is a good choice for training. The original weights are loaded squeezed to 4-bit and only a small adapter is trained, so a 10B-class model fits on a single 16GB GPU. But once training is done and evaluation runs, generation is far slower than expected, even though it is the same model.

The reason is in the inference path. Weights stored in 4-bit have to be restored to high precision (dequantized) every time before a matrix multiplication. In training this cost is buried in large batches, but autoregressive generation produces tokens one at a time in sequence, so this restoration repeats at every step. Inference-only engines such as vLLM or exllama have optimized kernels for this, but running generation as it is on a training stack (bitsandbytes and the like) has no such optimization.

That is how a single evaluation ends up taking an hour or two. The model has not stalled; that is about the top speed this setup can reach.

### Match max_new_tokens to the task

The adjustment with the biggest effect is lowering `max_new_tokens` to fit the task. Autoregressive generation produces tokens up to a set cap, and if the model does not emit the end token (EOS) early, every sample runs to the cap. With a cap of 256, even a sample that could finish short runs 256 forward passes in the worst case.

For a task with short output, for example a short structured result as in named-entity extraction, lowering the cap to around 96 does not cut off the correct answer. Fewer output tokens means proportionally less generation time, and the KV cache gets smaller too, which even frees up some memory. After I lowered the cap, evaluation ran two to three times faster and accuracy stayed the same.

## Training and evaluation on the same GPU — serialize instead of running in parallel

With only one GPU, it is tempting to run evaluation on the same GPU while training is going. That is what I did at first. Both ended up slower.

- The two jobs share the GPU's compute, so each one slows down.
- They also hold memory together, which raises the risk of OOM. If evaluation dies with an OOM, training gets shaken too.

I switched to serializing instead. Train 1 epoch → end the training process → run evaluation alone on the freed GPU → train the next epoch. Only one thing uses the GPU at a time, so there are no collisions, and the evaluation batch can be larger. Total wall-clock time was not much different from running in parallel, and the OOM worry went away.

On a single GPU, "one after another" is generally safer and faster than "at the same time."

## Why the progress did not show — stdout buffering

I ran evaluation in the background and looked at the log file, and no progress showed up at all. The script clearly printed `[N/total]` for every batch, yet the log looked frozen.

The cause was output buffering. When standard output is connected to a file or a pipe instead of a terminal, output is collected by the block (usually a few KB) rather than by the line, and written all at once when the buffer fills. When progress prints are sparse (tens of lines, hundreds of bytes), the buffer never fills, and not a single line is written to the file until the job is completely done.

The fix is simple.

- Flush that output (in Python, `print(..., flush=True)`).
- Or run the whole process unbuffered (`python -u`, `PYTHONUNBUFFERED=1`).

Once I added the flush, the progress prints landed in the log immediately, and just reading them and converting to a percentage was enough to see live progress from outside. A good share of background jobs that "look frozen" are in fact buffering.

## Do not touch a running bash script

While running a long pipeline as a bash script, I wanted to change one parameter in a later stage. The script was running. What happens if I simply edit the file?

Bash does not read a script file into memory all at once. It reads the file as it runs, as much as it needs at a time, by byte offset. So if editing a running script file changes the number of bytes in the earlier part, the offset it reads next points to the wrong place. The result is that commands run broken, starting from the middle. On top of that, functions are parsed and loaded into memory when they are defined, so changing a function body in the file does not reach the process that is already running.

So it is safer not to touch the running script itself. I used a workaround instead. If I modify the subprogram the script calls at each stage, the stage already in progress runs to the end on the old code loaded in memory, and only the process newly started at the next stage reads the changed code. Later behavior can be changed without stopping the running job.

As a principle: do not edit the file of a running script; aim at the points the script calls anew.

## Takeaways

Without changing the model, the way I ran things alone made a considerable difference in evaluation time and stability.

- 4-bit generation is inherently slow. If the task has short output, lower `max_new_tokens` first.
- On a single GPU, do not run training and evaluation in parallel; serialize them.
- If a background job seems frozen, suspect output buffering first. A flush fixes it.
- Do not edit a running bash script. If something has to change, fix the sub-call point.
