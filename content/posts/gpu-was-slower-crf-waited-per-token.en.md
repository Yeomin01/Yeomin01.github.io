---
title: "Moving to the GPU Made It Slower — The CRF Waited on the GPU for Every Token"
date: 2026-10-13
draft: false
tags: ["serving", "CRF", "GPU", "batching", "profiling", "NER"]
categories: ["Systems"]
summary: "The token classification layer was the bottleneck in a load test. It had been kept on CPU because it was slower on GPU than on CPU, and nobody knew why. It was not the encoder. CRF decoding was pulling values off the GPU one at a time, for every sentence and every token."
---

## Continuing

So far I have mostly written about whether the detection is right. This series of posts is about that detection under load. When the detection server that sits behind the gateway was put through a load test, a queue formed at the PII detection layer. It is a token classification model with a CRF on top of an encoder.

One thing was odd. This was the only layer running on CPU. It had been left that way because it was **slower** on GPU, but why it was slower was not written down.

## It was running once per sentence

Requests come in split into sentences, and the code called the model once per sentence. With 200 sentences, that is 200 calls. A colleague batched this first: sort the sentences of one request by length and run them 64 at a time. Sorting by length is to reduce padding.

On CPU the effect showed right away. Throughput for 16-sentence requests went up by 1.6x to 4.8x, depending on the number of concurrent requests. On GPU, though, it did not deliver as much as expected. Even batched, it was only a little better than CPU.

## Where the time went

I timed one batch (64 sentences, about 35 tokens per sentence) phase by phase. The GPU runs asynchronously, so the numbers are only right if you synchronize at each phase when timing.

![Per-phase time for one 64-sentence batch — decoding took six times as long as the encoder](/images/crf_decode_gpu_phases_en.png)

The encoder took 43ms and **CRF decoding took 271ms**. Picking one tag sequence took six times longer than a 12-layer encoder.

Viterbi decoding has two steps. The first goes front to back, accumulating scores and writing into a table where each cell came from. The second then follows that table backward from the end and reads off the tags. A widely used CRF implementation does the first step with tensor operations, but in the second step it runs a Python loop per sentence and per token, pulling out one value at a time with `.item()`.

`.item()` is a call that turns a value on the GPU into a Python number, so every time it is called it waits until the GPU has finished its backlog. At 64 sentences × 35 tokens, that is more than 2,000 stops per batch. On CPU there is no such wait, so it did not show, and it surfaced the moment the model moved to the GPU.

## The table stayed the same, only where it is read moved

I changed only the second step. The whole backtrace table is brought to the CPU in one go, and all sentences are followed backward together in NumPy. The table is the same, so the tag sequences that come out are the same. I did not touch the weights, the transition scores, or the first step.

Decoding went from 271ms to 11ms. Per request, 64 sentences went from 344ms to 82ms. I did not edit the library file and only swapped out the decode function on the model instance. Remove one line and it goes back to the original.

## Whether the results are the same

Saying that only the speed changed takes checking. I checked in three ways.

- A test that builds batches of mixed lengths and compares the tag sequences directly against the original function
- Running about 700 test sentences at the four sensitivity levels, to see whether the detected spans and scores before and after the fix are all identical
- Running the same sentences on CPU and GPU, to see whether they are the same to the fourth decimal place

All three matched completely. I added the last one late. "Only the procedure changed" is a statement about the function I fixed, and whether the result is the same after moving devices was a question that had to be measured separately.

## Zooming out

"The GPU is slow" usually does not mean the computation is slow. It is a matter of **how many trips are made between the host and the GPU**. `.item()`, `.cpu()`, `.tolist()`, and putting a tensor in a conditional are all round trips. With even one of them inside a loop, the GPU can become slower than the CPU.

And a bottleneck like this does not show while the profiler is pointed at the encoder. The heavy part of the model and the slow part of serving can be different. Until I timed it phase by phase, I also assumed the bottleneck was obviously the encoder.

## Notes

- If it is slow after moving to the GPU, count round trips, not computation. A single `.item()` inside a loop can cost more than 12 layers.
- Time each phase with synchronization on. Otherwise the waiting time gets attached to the wrong phase.
- "The results are the same" is checked separately for each scope that was changed. The function being the same and the result being the same after moving devices are different questions.

### References

- Lafferty, J., McCallum, A., Pereira, F. (2001). _Conditional Random Fields: Probabilistic Models for Segmenting and Labeling Sequence Data._ ICML. (the starting point for models that score a whole tag sequence, and for Viterbi decoding)
- Huang, Z., Xu, W., Yu, K. (2015). _Bidirectional LSTM-CRF Models for Sequence Tagging._ arXiv:1508.01991. (a paper that lays out the setup of putting a CRF layer on top of a neural encoder)
- Paszke, A. et al. (2019). _PyTorch: An Imperative Style, High-Performance Deep Learning Library._ NeurIPS. (the execution model in which GPU operations run asynchronously and synchronize when a value is pulled out)
