---
title: "Load the Model Once and Share It — A Shared vLLM Server"
date: 2026-10-06
draft: false
tags: ["MLOps", "vLLM", "serving", "GPU", "inference"]
categories: ["MLOps"]
summary: "On one GPU, two jobs each tried to load the same 4B model into their own process. Once one took the memory the other could not even start, and with fixed batching 500 items were on track to take 4 hours. I switched to loading the model once in a vLLM server and having the two jobs share it over HTTP. To leave the training environment untouched, I installed it in a separate virtual environment."
---

## The same model was being loaded twice

On a shared server with a single 16GB GPU, two jobs had to generate data with the same 4B-class model. One job had loaded the model in 4-bit into its own process with transformers and was generating in batches of six, which alone used a little over 10GB. The other job had no room to load a second copy of the same model.

Speed was a problem too. With fixed batching, the next batch cannot start until the longest generation in the current batch finishes. Extrapolating from the progress rate, 500 items were going to take about 4 hours.

## What vLLM does

vLLM is an LLM inference server. It loads the model onto the GPU once and takes requests on an HTTP endpoint in the same format as the OpenAI API. Several processes can send requests to the same server, so there is no need to load the model twice.

It is fast for two reasons. Continuous batching inserts requests into the running batch as they arrive, and fills the slot of a finished request with the next one right away. The GPU no longer sits idle waiting for the longest generation. PagedAttention manages the KV cache during generation in small pages, which cuts the waste of reserving memory for the maximum length on every request. The same memory handles more requests concurrently.

## I installed it separately

The latest vLLM required a newer PyTorch than the training environment had. Installing it into the training virtual environment would change the PyTorch the training code uses. I created a separate virtual environment for serving and installed it there. It took about 8GB. The server runs from that environment, and since clients use only HTTP they can call it from any environment.

For the model I used the 4-bit weights produced with quantization-aware training (QAT). vLLM reads this format as is, and loading the weights took 7 seconds. Because this was an internal-network environment, I turned off hub access (`HF_HUB_OFFLINE=1`) and had it read only the local cache.

## Memory settings

`--gpu-memory-utilization` sets how much of the GPU's total memory the server may use. At 0.85, the roughly 1.4GB left after the weights and the execution graph went to the KV cache, which was about 37,000 tokens. With requests at the 8K maximum length that is 4 to 5 at a time, but most real requests were shorter, so 16 concurrent requests ran without trouble. I left the remaining 15% or so as headroom for other jobs.

## Results

I generated 1,000 multi-turn dialogues in about 23 minutes, retries included. Compared with the 4 hours I had calculated for fixed batching, that was faster by a single-digit multiple or more. Structured output (forcing the output format with a JSON schema) was also available directly as a server feature. Other jobs can use the same endpoint, so there was no longer any reason to fight over the GPU by each loading the model.

## What I watched for in operation

- While it is up, the server holds the configured fraction of GPU memory. If nobody is using it, it blocks other GPU jobs. I share the endpoint, and take the server down when it has not been used for a while.
- The server runs as a background service, and any pipeline that uses it starts with a health check (`/health`). If the server is not there, the pipeline does not move on to the generation stage and records a failed status right away.
- A model loaded in 4-bit inside a process and a model served from QAT weights do not produce exactly the same output. Even under the same model name, I record which one generated each item.

## Takeaways

When several jobs need inference from the same model, load it on one server and share it instead of loading it in each job. vLLM raises throughput a lot on the same GPU with continuous batching and a paged KV cache, and its OpenAI-compatible API keeps the client simple. If dependencies conflict with the training environment, separate the serving environment, and in a shared setting always keep in mind that the server occupies the GPU.
