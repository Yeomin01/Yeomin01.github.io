---
title: "After I Grew the Batch, the GPU Memory Did Not Come Back"
date: 2026-10-13
draft: false
tags: ["GPU memory", "batching", "serving", "concurrency", "PyTorch", "load testing"]
categories: ["Systems"]
summary: "After switching to batch processing and adding processes, a 48GB card filled to 42GB. Shrinking the batch cuts memory but also halves throughput. Limiting the number of batches on the GPU at the same time left throughput where it was and cut only memory, to a third."
---

## Continuing

When the code that switched to batching and fixed the decoding bottleneck went into a load test on a GPU machine, a different number jumped out. GPU memory filled to 42GB of 48GB. The detection model is an encoder whose weights are under 0.5GB. The first thing to find out was where tens of GB were coming from.

## It was working space, not weights

I put one process on the GPU, applied load, and measured the memory the framework had reserved.

| Load | Reserved GPU memory |
|---|---|
| Right after loading only the model | 0.5GB |
| Batches of 64 short sentences, 16 concurrent | 1.8GB |
| Batches of 64 long sentences, 4 concurrent | 4.1GB |
| Batches of 64 long sentences, 16 concurrent | 7.4GB |

After the load ended, the 7.4GB stayed. The framework does not give back GPU memory once it has obtained it; it holds on to it for next time. It is designed that way because allocation is slow, and normally that is a gain. In exchange, **the peak, once hit, becomes that process's resident size**.

What sets the peak is a product of three things: batch size, sentence length (attention costs the square of the length), and **the number of batches on the GPU at the same time**. Before batching, sentences went up one at a time, so it was small even at 16 concurrent. After batching, 16 batches of 64 sentences go up all at once.

The number of processes multiplies on top of this. Each process has its own cache, and they cannot borrow from one another. With five processes hosting this layer, that is 7.4GB five times.

## Shrink the batch and throughput shrinks too

The first thing that comes to mind is reducing the batch size. Dropping 64 to 16 turns 7.4GB into 4.3GB. It is one setting, so it is easy.

It has a price. Throughput on requests of 64 short sentences went from 869 sentences per second to 422, **half**. That amounts to giving back about half of what batching gained. And 4.3GB is still large, because the 16 concurrent requests still go up as before.

## Capping how many go up at once

I touched a different term of the product. The number running through the encoder at the same time is capped at one or two per process. The rest wait briefly on the CPU side.

![Limiting the number of batches loaded at once cut memory and left throughput unchanged](/images/gpu_reserved_vs_concurrent_batches_en.png)

Capped at 1 concurrent, 7.4GB became 2.4GB. Throughput did not drop. Long sentences went from 85 to 92 per second, and short 64-sentence requests from 869 to 889. If anything it went up a little.

The reason is that the GPU processes batches one after another anyway. Put 16 up at once and they are not computed simultaneously; they queue. Whether the queue stands inside the GPU or outside it, the time taken is the same, and **standing inside just means every queued batch is holding memory**.

I also measured emptying the cache after the load. 7.4GB comes back down to 1.1GB. But the next large request has to obtain the memory again and is slower by that much. It is not for constant use; it only fits after a rare very large request.

## A cap is a different kind of remedy

There is also the option of putting a cap on GPU memory per process. It is needed to protect other jobs. But a cap does not reduce memory. **It fails the requests that go over.** They do not get slower; they error out. Once a cap is set, the failure count has to be read next to throughput in the load test.

In practice, shrinking the batch and setting a cap went in first, because they need only settings. The concurrent-batch limit was left as the next move, to bring out when throughput starts to fall short.

## Zooming out

Batching gets talked about only as a knob for raising throughput. But batching **also changes the shape of the memory peak.** The amount one request takes gets larger, and concurrent requests multiply it. Roll it out looking only at the throughput number, and the first time you see the memory is in production.

And the question "where does the queue stand" turns out to be the answer more often than expected. Queue inside the resource, and whatever is queued holds the resource. Queue outside, and it only waits. If the processing order is the same, outside is cheaper.

## Notes

- Look at GPU memory as peak working space, not weights: batch size × length² × number of concurrent batches, and then the number of processes.
- Before shrinking the batch, try capping how many go up at once. As long as the GPU processes them in turn, throughput does not drop.
- A memory cap is a failure condition, not a saving. If you set one, put the failure count into the metrics.

### References

- Paszke, A. et al. (2019). _PyTorch: An Imperative Style, High-Performance Deep Learning Library._ NeurIPS. (why it has a caching allocator that reuses GPU memory instead of returning it)
- Gao, Y. et al. (2020). _Estimating GPU Memory Consumption of Deep Learning Models._ ESEC/FSE. (an analysis of how intermediate tensors and the framework's share take up memory beyond the weights)
- Kwon, W. et al. (2023). _Efficient Memory Management for Large Language Model Serving with PagedAttention._ SOSP. (a study showing that how per-request working memory is shared in serving determines throughput)
