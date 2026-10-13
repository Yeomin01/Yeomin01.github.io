---
title: "A Shared GPU Taxes Small Requests"
date: 2026-10-13
draft: false
tags: ["GPU", "serving", "latency", "time-slicing", "load testing", "throughput"]
categories: ["Systems"]
summary: "After I fixed the decoding bottleneck, the GPU became faster than the CPU. So I was going to move to the GPU, but when I measured under the same conditions as production, one- or two-sentence requests were actually slower. When a GPU is shared with other jobs, every round trip waits for its turn."
---

## Continuing

In the last post I fixed CRF decoding waiting on the GPU for every token. Batch throughput doubled or tripled, and I thought this layer could now simply move to the GPU. I even had a conditional decision in hand: "if the GPU is faster, switch to the GPU and deploy."

Before moving, I measured once more under the same conditions as production. The results split.

## The winner changed with request size

![Latency by request size — the CPU was faster for one sentence, the GPU for sixteen](/images/request_size_cpu_vs_shared_gpu_en.png)

A 16-sentence request arriving alone took 62ms on the GPU and 284ms on the CPU. More than four times faster. But **a 1-sentence request took 43ms on the GPU and 22ms on the CPU**. Twice as slow.

Throughput with concurrent requests raised to 16 had the same shape. For 1-sentence requests, the CPU did 89 requests per second and the GPU 33. For 16-sentence requests the two were close (CPU 357 sentences/s, GPU 338 sentences/s). Conversational traffic is mostly one or two sentences. That is the range where the GPU loses.

## 4.5ms per round trip

To see the cause, I gave it the smallest job possible. Send a single 8×8 matrix multiplication to the GPU and get the result back. The computation itself is on the order of microseconds, but **the round trip took 4.5ms**. It was steady, with almost no jitter.

This GPU was being shared with two other jobs, and utilization was 93–95%. Work from different processes is run in turns by the GPU's time-slicing scheduler and does not execute simultaneously. Even when my process sends work, it only runs once the other processes' turns are over. Each time I wait to receive a result, I am in effect waiting one full rotation.

A single request goes through the encoder, decoding, and the confidence computation, fetching values from the GPU several times. Dividing the 1-sentence request's 43ms by 4.5ms gives a little over nine. I did not count exactly how many, but there are several places in decoding and the confidence computation where values are pulled out. The computation finishes quickly, but **the time spent waiting for a turn sets the floor**. Even when the sentences grow to 64, the number of round trips is the same, so on large requests this tax is buried.

## So I did not move it

The condition was "if the GPU is faster", and the answer was "depending on request size". For traffic that is mostly short requests, I judged that the condition was not met and left it on the CPU. Applying only the batching and the decoding fix already gave 1.2x to 4.8x on the CPU.

I also wrote down the cases where going to the GPU is right.

- **When most requests are long, like documents.** The round-trip tax is buried and the batching effect is large.
- **When the GPU is used alone.** The round-trip wait disappears. This is not a condition I measured, though. There is recent research on giving priority to inference even when the GPU is shared (Tally, below).
- **When sentences from multiple requests are collected and sent at once.** Nine trips per request become nine trips per batch. To use the GPU for short requests, this is where it ends up.

There is one more thing. On the GPU, my requests fail when someone else's job fills up the memory. On the CPU that does not happen. There was more to put on the scale than speed.

## Zooming out

A GPU is not a fast CPU. It is a device that carries a lot per trip. If the number of trips is fixed, the smaller the load carried, the worse the deal. On a shared GPU, there are traffic lights on the way as well.

So "GPU or CPU" cannot be decided by looking at the model alone. **How many sentences are in one request, and who that GPU is shared with** go into it too. If a benchmark measures only with large batches, the GPU always wins. My first measurement also used only 16 sentences, and looking at that number alone I wrote "three times faster" and then corrected it.

## Notes

- Measure a switch to the GPU per request size. Measured only with large batches, the GPU always wins, and if the real traffic is short the conclusion flips.
- On a shared GPU, measure the round-trip time of a small operation first. That value × the number of round trips is the latency floor.
- If you were given a conditional decision ("switch if it is faster"), check the condition in the same shape as production, and if it does not hold, not switching is the default.

### References

- Yu, P., Chowdhury, M. (2020). _Fine-Grained GPU Sharing Primitives for Deep Learning Applications._ MLSys. (a way to divide a GPU finely through fast switching between jobs and memory sharing. The system's name is Salus)
- Wu, B. et al. (2023). _Transparent GPU Sharing in Container Clouds for Deep Learning Workloads._ NSDI. (covers priority and interference when multiple jobs use one GPU in a container environment)
- Zhao, W., Jayarajan, A., Pekhimenko, G. (2025). _Tally: Non-Intrusive Performance Isolation for Concurrent Deep Learning Workloads._ ASPLOS. (how much inference tail latency slips when inference and training are put on one GPU together, and how to bound it)
