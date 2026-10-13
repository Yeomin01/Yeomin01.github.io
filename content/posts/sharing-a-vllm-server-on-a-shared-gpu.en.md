---
title: "Another vLLM Server Was Already Using the Shared GPU"
date: 2026-10-06
draft: false
tags: ["MLOps", "vLLM", "GPU", "operations", "LLM"]
categories: ["MLOps"]
summary: "I went to load a 4B model for data generation, and another job's vLLM server was using 13.8GB of the shared GPU's 16GB. Instead of clearing out the process or loading my own model separately, I decided to share that server, which was running the same model. I wrote down how I operated the shared resource along the way, and the mistake of killing my own shell while looking up a process by name."
---

## The model would not load

I was about to rerun the evaluation document generation, and the local 4B model would not load for lack of GPU memory. Until just before, the GPU had been empty.

I checked in this order.

1. I looked at overall and per-process GPU usage with `nvidia-smi`. A single process was using 13.8GB of the 16GB.
2. I followed that process up through its parents and checked the launch command. It was a vLLM server, serving a 4B model of the same family as the one I meant to use through an OpenAI-compatible API. It was running with `--gpu-memory-utilization 0.85`, so a little over 2GB of memory was left.
3. I checked the server log and the connected clients. Another generation job was using this server with 16 concurrent requests, and from that job's progress log I could roughly estimate when it would finish.

## What I did not do

It was not a process I had started, so I did not clean it up. On a shared server, ending someone else's process without checking with the owner can wipe out hours of that person's work.

I also did not write a waiting script that starts automatically when the GPU frees up. Once before, a waiter like that was left behind and, after the user had said to wait, started the job on its own and took more than 15GB of the GPU. Another person's job on the same GPU could have died from running out of memory. Since then, a job that uses the GPU starts only at the moment I am told to start it.

So I reported the situation as it was and asked which option to take: wait until that job finished, or share the server.

## If it is the same model, share the server

The model the server was running was the same family as the one I meant to use, and I got permission to use it. So instead of loading the model once more in my own process, I decided to send requests to that server. The generation code could already swap backends through an OpenAI-compatible interface, so all it took was adding one backend.

| | Loaded directly (transformers, 4bit) | Shared server (vLLM) |
|---|---|---|
| Additional GPU memory | Several GB needed (would not load) | 0 |
| Speed | about 5 seconds per spec | about 1.6 seconds per completion (12 concurrent) |

I set the number of concurrent requests by watching the other job's load. While the other job was running I joined with 6. At that point the KV cache usage in the server log was 55–65%. I confirmed that the other job had finished not by whether its process was alive but by the completion marker recorded in that job's state file, and after that I raised it to 12. When requests pile onto one server they only slow each other down and do not take more memory, because vLLM reserves the KV cache up front at startup.

## Stoppable and resumable at any time

A job that uses a shared resource will have to stop midway at some point. Someone else may need the GPU, or I may need to fix the code. So I built the generation job as follows.

- The seed is fixed per document ID, so the same ID is generated from the same spec whenever it is rerun.
- Results are flushed after every line written, and on restart the IDs already saved are skipped.
- A job that takes more than 5 minutes is launched detached from the terminal with `setsid`, and its log goes to a file.
- After a forced stop, I check that the last line is intact and that there are no duplicate IDs, and then resume.

In practice this job stopped twice: once to fix a bug in the check logic, and once when the other job finished and I raised the concurrency and the number of specs together. Each time I left the saved results as they were and generated only the remaining IDs.

## Stop a process by PID

While stopping my generation process to raise the concurrency, the `pgrep -f` pattern also matched the command line of my own shell running that command, and I terminated the shell too. The restart command I meant to run next never ran. The same trap is written up in [Rules for Long-Running Jobs on a Shared GPU Server](/en/posts/rules-for-long-jobs-on-a-shared-gpu/). Since then I either record the PID at launch or check the `ps` output down to the executable and terminate only the exact PID, and I check whether it has exited with `kill -0 <PID>`.

## The same events seen from the other side

The record from the side that set up this server is in [Load the Model Once and Share It — A Shared vLLM Server](/en/posts/load-the-model-once-share-it-with-vllm/). The "job generating in 4-bit in batches of six" that was holding the GPU at the start of that post is my generation job in this one. The server came up while I had that job stopped to fix the prompt, and from then on the two jobs shared the same server. The general rules for long-running jobs on a shared server are collected in [Rules for Long-Running Jobs on a Shared GPU Server](/en/posts/rules-for-long-jobs-on-a-shared-gpu/).

## Takeaways

When memory runs short on a shared GPU, the first thing to do is find out who is using that memory and why. Do not touch other people's processes, and do not leave behind anything that grabs resources automatically. If the same model is already being served, sharing that server beats loading a separate copy on both memory and throughput. And build any job that uses a shared resource so that it can be stopped and resumed at any time.
