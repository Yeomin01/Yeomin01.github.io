---
title: "Another Component Was Setting the Thread Count"
date: 2026-10-13
draft: false
tags: ["measurement", "threads", "serving", "global state", "load testing", "PyTorch"]
categories: ["Systems"]
summary: "I brought up a single layer, measured its throughput, and went as far as making a recommendation from those numbers. But on the real server, another layer's constructor was setting the compute thread count for the whole process. The condition I measured was one that does not exist in production."
---

## Continuing

While looking at the load bottleneck, I measured the PII detection layer's throughput under several conditions. I used the production image as is, took the environment variables from production, and lifted the CPU limit as in production. From those numbers I reported three things.

- The current code's throughput stays the same even as concurrent requests increase (around 45 sentences per second).
- The new code is 1.3–4.7x faster than that.
- Cutting compute threads from 24 to 4 gives 1.6–2x when there are many concurrent requests.

Two of the three were wrong, and the last recommendation was one that did not need to be made.

## The number 4 was already set

While looking into another layer's lock, I saw one line in that layer's constructor. It is a call that sets the compute thread count to 4.

This setting does not belong to that layer. It is **the process-wide global default**. The documentation only says that it "sets the number of threads used for intra-op parallelism", so the scope does not stand out. The server builds the layers one after another, and once that layer has been built, the threads that handle requests run any layer's operations on 4 threads. When I brought that layer up alongside in the same image, the thread count changing from 24 to 4 was printed plainly. On the production server, the PII layer had been running on 4 threads from the start.

My measurement tool brought up only the one layer I wanted to measure. Since I did not bring up that other layer, that one line never ran, and the thread count stayed at the default, the physical core count of 24. The image and the environment variables were the same as production, but **who else was in the process** was different.

## What changed on measuring again

I set the threads to 4 and measured again. These are sentences per second for 16-sentence requests at concurrency 1, 4, and 16.

| | Concurrency 1 | Concurrency 4 | Concurrency 16 |
|---|---|---|---|
| Old code, 24 threads (wrong condition) | 33 | 44 | 48 |
| Old code, 4 threads (production condition) | 39 | 91 | 74 |
| New code, 4 threads (production condition) | 62 | 201 | 357 |

"Stays the same even as concurrent requests increase" was true only at 24 threads. When 16 requests each try to use 24 threads, 384 threads crowd onto 48 logical cores. It went flat because they were pushing each other out, not because of a property of the code. Under the production condition, the old code also scaled up to concurrency 4.

The conclusion that the new code is faster survived (1.2–4.8x). The multiples changed, though, and the recommendation to cut threads was telling people to cut something that had already been cut.

## The thread count gives up one side to get the other

There is also something I learned thanks to measuring wrong. The thread count is not a knob without a cost.

- 24 threads: a 16-sentence request arriving alone takes 119ms. At concurrency 16, 226 sentences per second.
- 4 threads: a 16-sentence request arriving alone takes 284ms. At concurrency 16, 357 sentences per second.

To finish a single request quickly, give it many threads; to take many at once, give it few. A load test measures the latter, and the latency of a single request that a user feels is the former. If you do not know which number you are looking at, you end up turning the setting the opposite way.

## Zooming out

Code in which a constructor changes a global setting is quiet. There is no error and no warning, and when that component is used alone it is even reasonable. The problem is when several components live together in one process. **The component built last decides everyone's setting.** If the order changes, performance changes, and nothing tells you so.

The lesson on the measurement side is simpler. Measure a single component in isolation and you get that component's numbers, not the server's numbers. Measuring in isolation is necessary in itself. But the first line of the results has to print **the settings actually in effect**. Thread count, device, batch size. I had made my script print those values, and still read the number 24 believing it was the production value.

## Notes

- Before saying anything about the server from numbers measured in isolation, check that the global settings (thread count, device) are the same in the server process.
- Print the settings actually in effect along with the measurement results, and doubt once whether those values are the production values.
- The compute thread count trades single-request latency against concurrent throughput. Decide first which one you are measuring.

### References

- Mytkowicz, T., Diwan, A., Hauswirth, M., Sweeney, P. F. (2009). _Producing Wrong Data Without Doing Anything Obviously Wrong!_ ASPLOS. (experiments showing that harmless-looking differences such as environment variable size or link order overturn measurement conclusions)
- Curtsinger, C., Berger, E. D. (2013). _STABILIZER: Statistically Sound Performance Evaluation._ ASPLOS. (the problem of the incidental layout of a measurement environment being read as a performance difference, and how to control for it)
- Wang, Y. E., Wu, C.-J., Wang, X., Hazelwood, K., Brooks, D. (2021). _Exploiting Parallelism Opportunities with Deep Learning Frameworks._ ACM TACO 18(1). (analyzes how the intra-op thread and inter-op thread settings determine CPU inference performance)
