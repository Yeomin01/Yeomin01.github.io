---
title: "More Processes, or More Threads?"
date: 2026-10-13
draft: false
tags: ["GIL", "multiprocessing", "serving", "load balancing", "throughput", "Python"]
categories: ["Systems"]
summary: "A proposal came up to put several server processes behind a load balancer. At first I ranked it low, because when measured with 16-sentence requests a single process uses all the cores. Measured again with 1-sentence requests, a single process stalled at around 100 requests per second."
---

## Continuing

When the detection server got stuck in a load test, one proposal came up: put a balancer in front, run several server processes, and split the incoming requests among them. I was asked to see whether there was a better way, and I measured the numbers.

My first answer was "adding processes is low priority". Later I revised half of it.

## First answer: processes do not create cores

I measured with 16-sentence requests. With 8 cores given to one process, throughput was 80–100 sentences per second even as I increased concurrent requests, but with 24 cores it rose to 254 sentences. When three processes split the same 24 cores at 8 each, the total was 110 (measured once, and the machine was busy).

Here is why. For this request, 97% of the time is encoder computation, and that section releases the Python lock (GIL). So even with a single process, the threads really do share the cores. Adding processes only divides the same cores, and there is a price to pay in return.

- Each process loads its own copy of the model. Both RAM and GPU memory multiply.
- Requests arrive split up, so the batches get smaller in each process.
- Model swaps and threshold changes have to be sent to every process, and the metrics have to be merged.

I still think this much is right.

## Revised answer: for short requests, Python is the ceiling

I measured again with 1-sentence requests. A single process's throughput was 118 requests per second at concurrency 4 and 89 at concurrency 16. Whether I gave it more threads or sent more concurrent requests, **it did not climb past around 100.**

For short requests the ratio flips. The encoder finishes quickly, and the sections that run in Python, such as regexes, rules, and post-processing, are a fixed cost on every request. These sections hold the GIL. Even with 48 cores, only one of them runs at a time. In this case, adding processes **actually adds capacity.**

A load test on a different machine showed the same thing. On a machine with 17 cores and a GPU attached, one process saturated while GPU utilization was 3%. The GPU and the cores both had room, and a single strand of Python was blocking. When only the heavy layer was split out into dedicated processes and four of them were started, the ceiling went from 5.4 requests per second to 9–10.

## Split out a layer instead of multiplying the whole server

The approach used in that test is better than replicating the whole server. A process **takes the layers it will serve from configuration.** Four processes that serve only PII detection, and one process that serves the rest. The balancer looks at the call path and routes accordingly.

- A dedicated process loads only that layer's model. Memory multiplies less than with whole-server replication.
- A slow layer does not block the queue of a fast layer.
- The combined scan, which needs every layer, is opened only on the main process.

The multiplication still remains. If four dedicated processes each hold a GPU cache, that becomes the next problem. That is where the GPU memory in the last post came from.

## What decides it

In the end, one measurement is enough. **Where does the time of a single request go?**

- If it is mostly native computation (matrix multiplication, tokenization), threads use the cores. Give one process the cores and the concurrency.
- If it is mostly Python sections, threads are of no use. Add processes or shrink those sections.

Even for the same server, the answer differs by request size. Long documents are the former and short chats are the latter. I measured only with 16 sentences and gave an answer for the whole.

## Zooming out

This distinction may blur going forward. The Python build without the GIL came out as experimental in 3.13 and dropped the experimental label as of 3.14. It is still optional and not the default build. Deep learning frameworks are moving in that direction too. However, whether the libraries I use are safe on that build has to be checked separately, and more code that breaks when several threads call it together, like the tokenizer in an earlier post, will come to light.

Until then, it is not a matter of picking one of processes or threads. **Fill the cores with threads, and if Python is still the ceiling, split only that layer out into processes.** It is a choice with an order.

## Notes

- Before adding processes, measure how much of a single request's time is the Python section. If it is mostly native, threads are enough.
- Change the request size and measure again. The answer from long requests flips for short requests.
- When scaling out, split out only the heavy layer rather than the whole server. The memory multiplication shrinks to that layer's share.

### References

- Beazley, D. (2010). _Understanding the Python GIL._ PyCon. (a talk that showed with measurements how the GIL is fought over when CPU work and I/O work are mixed)
- Gross, S. (2023). _PEP 703 – Making the Global Interpreter Lock Optional in CPython._ (the design of the build without the GIL, and the thread-safety problems existing extension modules will face. The criteria for official support were set by PEP 779 in 2025)
- Gujarati, A. et al. (2020). _Serving DNNs like Clockwork: Performance Predictability from the Bottom Up._ OSDI. (a design that strips out the causes of latency variability in inference serving, starting from the lower layers)
