---
title: "Knobs for Reducing Load, by Request Shape"
date: 2026-10-13
draft: false
tags: ["load testing", "serving", "throughput", "latency", "measurement", "trade-offs"]
categories: ["Systems"]
summary: "I spent a few days on a load bottleneck in the detection server and collected the knobs I turned onto one page. Each knob works for a different request shape, and all of them had side effects. And what overturned the conclusions was usually not a knob but the way of measuring."
---

## Continuing

The previous six posts were things I ran into one at a time. The decoding bottleneck, the shared GPU, the thread count, the lock, GPU memory, the number of processes. This time I gather them into one table. The next time I do the same kind of work, I plan to look at this table first.

## Knobs and side effects

| Knob | Works well when | Effect I measured | Side effect |
|---|---|---|---|
| Batch the sentences within a request into one call | Requests with many sentences | 16 sentences 1.6–4.8x, 1 sentence 1.2x | Peak GPU memory grows |
| Cut GPU round trips | The model is on the GPU | Decoding 271ms → 11ms | Whether the results are the same has to be checked separately |
| Move to the GPU | Long requests, a GPU used alone | 16-sentence latency 284ms → 62ms | On a shared GPU, 1 sentence is twice as slow. Fails if someone else fills the memory |
| Reduce the compute thread count | Many concurrent requests | At concurrency 16, 226 → 357 sentences/s | A large request arriving alone goes 119ms → 284ms |
| Remove the request-level lock | A layer that ran only one at a time | At concurrency 8, 1.3 → 4.5 requests/s | Per-thread copies eat memory and first-request latency |
| Dedicated processes for a layer | Short requests, when the Python section is the ceiling | Ceiling 5.4 → 9–10 requests/s | Memory multiplies by the number of processes. More things to operate |
| Reduce the batch size | GPU memory is tight | 7.4GB → 4.3GB | Throughput halves |
| Limit the number of batches on the GPU at once | GPU memory is tight | 7.4GB → 2.4GB, throughput unchanged | Requires a code change |

One last row is missing: **collecting sentences from multiple requests and sending them as one batch**. It is the best-fitting remedy when one- or two-sentence requests pile up, but the latency floor rises by the length of the waiting window, and the implementation is complex. I did not try it this time, and I did not put anything I had not measured into the table.

## Reading it again by request shape

Cut the same table vertically and it comes out like this.

- **If most requests are one- or two-sentence chat requests.** Batching has little effect. The Python section that each request costs is the ceiling. Dedicated processes work, and the GPU is a loss as long as it is shared.
- **If most requests are responses or documents of tens of sentences.** Batching works best here. Moving to the GPU is worth it, and in that case peak memory has to be watched along with it.
- **If the two are mixed.** The first thing is to keep one large request from holding up the small ones. If there is a request-level lock, look at that first.

Turning the knobs without knowing which kind of traffic you have wastes half of them. I never did learn the request length distribution. So I could only answer with the conditions split out.

## What overturned the conclusions was the way of measuring

There were four places this time where a conclusion was overturned or nearly was. All four were on the measurement side, not the knob side.

- **I measured at only one request size.** I measured with 16 sentences and said the GPU was three times faster. At 1 sentence it was the opposite.
- **I measured under a condition that does not exist in production.** I brought up a single layer and measured with 24 threads. On the server it was 4.
- **I measured without warming up the threads.** Per-thread setup time fell inside the measurement window, and concurrent processing came out slow.
- **I nearly read the processing time in the logs as latency.** That time is measured from after the lock is taken, so the share spent waiting in line is missing. Compare on that value and the side with the lock looks faster.

One more thing: all my measurements were closed-loop. Each of the N concurrent clients sends the next request only after it has received a response. When the server slows down, the sending side slows down with it and goes easy on the server. Real traffic arrives regardless of the server's circumstances. So I read my numbers **only as multiples**, and not as an arrival rate the server can withstand.

## Zooming out

There are not many knobs, and most of them are well known. The hard part is knowing which knob works **for this traffic, right now**, and that is only known by measuring. But measuring is easier to get wrong than turning a knob. Turn a knob the wrong way and the numbers get worse, so it shows. Measure the wrong way and plausible numbers come out.

So I fixed an order. Look at the request length distribution first. Measure in the same process shape as production. Measure at two or more request sizes. Then pick a knob.

## Notes

- Look at the request length distribution before picking a knob. Short requests and long requests call for opposite remedies.
- When writing down an effect, write the side effect on the same row. This time there was not a single knob without a side effect.
- Throughput measured in a closed loop is used only as a multiple. Whether the server withstands the real arrival rate is a different test.

### References

- Schroeder, B., Wierman, A., Harchol-Balter, M. (2006). _Open Versus Closed: A Cautionary Tale._ NSDI. (an analysis showing that closed-loop load generators make a server look better than it really is)
- Dean, J., Barroso, L. A. (2013). _The Tail at Scale._ Communications of the ACM. (why to look at tail latency rather than the average, and techniques for reducing it)
- Crankshaw, D. et al. (2017). _Clipper: A Low-Latency Online Prediction Serving System._ NSDI. (how adaptive batching, which collects requests into batches, trades throughput against latency)
