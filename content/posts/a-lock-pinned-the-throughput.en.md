---
title: "A Single Lock Pinned the Throughput in Place"
date: 2026-10-13
draft: false
tags: ["concurrency", "lock", "tokenizer", "memory", "serving", "measurement"]
categories: ["Systems"]
summary: "The layer that judges multi-turn conversations could not get past two requests per second no matter how many concurrent requests I added. The entire verdict sat inside a single lock. Removing the lock was easy, but the way it was removed sent a separate bill, in memory and in first-request latency."
---

## Continuing

A colleague running load tests asked me: the tokenizer is apparently locked, so why was it built that way? When I looked, it was not just the tokenizer. The conversation-judging layer **wrapped the entire verdict in a single lock**, from tokenization through the encoder, the combiner, and the neighbor search. That means one process runs only one conversation at a time.

Measure it and that is exactly what shows. At 1, 4, and 16 concurrent requests: 1.7, 1.8, and 1.9 per second. Throughput stayed the same and only the wait grew, from 0.5 s to 5.8 s.

## A lock that did not inherit its reason

I traced back through the commit history. The person who first built this layer put the lock in as a "thread-safe wrapper", and later, when I attached a new verdict path, I followed that structure as it was. My commit had not one line on why the lock was there. I had not put it in after thinking it through; I put it in **because it was right there beside it**.

The original purpose was sound. A fast tokenizer re-applies its truncation and padding settings to internal state on every call. When several threads call the same object at once, they collide over this state and errors result. It does need guarding. But the scope to guard was the tokenizer call, not the whole inference.

The same lock existed in another layer, and that one was fixed after an incident in which one large request held the lock for several minutes. The one with no incident stayed as it was.

## With a copy per thread

The fix is well known. Share the weights and keep **a per-thread copy of only the tokenizer**. My colleague made that change and replaced the lock with a concurrency cap. Running 1,200 conversations concurrently also confirmed that every label and score matched sequential execution.

But two numbers were odd. With concurrency opened up, the result said it was slower than sequential, and memory grew a lot.

![With a copy per thread, memory grows with the thread count, and throughput shows only after the threads are warmed up](/images/per_thread_tokenizer_memory_en.png)

One copy was large. This layer uses two multilingual tokenizers with a vocabulary of 250,000 entries. One set of copies was 0.25–0.57GB, and once 17 threads had each handled one request, the process went from 2.9GB to 12.4GB. With 64 worker threads, the arithmetic puts it past 30GB.

There was also the time to build them. Built alone, a copy took 0.9 s; with 16 threads building at once, about 10 s each. And this copying happens **inside each thread's first request**.

## Why it looked slow

At first my measurements also showed concurrent processing slower than sequential. That was because I created new threads for every measurement. Most of the 8-second measurement window went into building copies.

Measured after running the threads once to warm them up, it was the opposite. On CPU, at concurrency caps of 1, 2, 4, and 8: 1.3, 2.3, 2.8, and 4.5 per second. The results were all identical to sequential. But this was measured on CPU. On GPU the compute is short, so contention in the Python sections may show up larger, and I do not promise the same conclusion holds.

## Only as many copies as the cap

A copy per thread is more than is needed. The verdicts running at the same time only go up to the cap anyway. So the copies only need to number as many as the cap. Keep them in a pool, borrow one when a verdict starts, and return it when it ends.

- Memory scales with the cap, not the thread count. With a cap of 1, it is one set of copies.
- The copies are built when the server starts, so the first request does not slow down.

I have only proposed this change; it has not gone in yet.

## Zooming out

A lock has a reason when it is put in. The problem is that the reason does not stay in the code and **only the shape gets copied**. Then the lock becomes "something that was always there", and nobody narrows its scope even when it is wider than needed. It gets fixed only after an incident.

Removing it was not free either. Get rid of sharing in order to get rid of the lock, and copies appear, and copies eat memory and setup time. If that cost hides in the first request, the measurement lies.

## Notes

- When carrying a lock over, write one line on what it protects. If you cannot write it, you do not know whether the scope is right.
- For per-thread copies, first measure the size of one copy × the number of threads. If concurrency has a cap, a pool is enough.
- Measure a concurrency change after warming up the threads. Setup time riding on the first request flips the conclusion.

### References

- Amdahl, G. M. (1967). _Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities._ AFIPS. (the classic showing that the sequential portion sets the upper bound on overall speedup)
- Dean, J., Barroso, L. A. (2013). _The Tail at Scale._ Communications of the ACM. (how waiting in front of shared resources creates tail latency, and how to respond to it)
- Crankshaw, D. et al. (2017). _Clipper: A Low-Latency Online Prediction Serving System._ NSDI. (a serving architecture that gives each model its own queue and batch size so that models do not block one another)
