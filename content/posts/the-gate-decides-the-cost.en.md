---
title: "The Gate Decides the Cost"
date: 2026-07-14
draft: false
tags: ["LLM", "security", "serving", "cascade", "quantization", "throughput"]
categories: ["Systems"]
summary: "It is easy to assume that dropping a small generative model into the pipeline as a second-stage verifier will slow it down. It barely did. What decides a cascade's throughput is not the expensive second stage but the gate in front of it. The cost turned out to be a function of the traffic mix, not the model."
---

## Continuing

The last post was about the accuracy of second-stage verification: how to prompt it so that cutting false positives does not cost recall. This one is about the bill. It is easy to assume that stacking a 4B generative model onto a detection pipeline adds latency and cost, but in practice the throughput barely moved. Why it barely moved is the whole cost structure of a cascade.

## The gate decides the cost

The cascade sends only sessions the first stage (BERT) calls an attack to the second stage (gemma). Most benign traffic ends at the first stage as BENIGN and never touches the second. So the overall throughput converges to the first stage's speed, not the second's. The load the second stage carries is (first-stage attack rate) × traffic.

The gap in raw numbers is large. The first stage (multi-turn BERT) does hundreds of requests per second with GPU batching — in the high 800s at batch 32. The second stage (gemma 4bit) does a bit over 8 per second. A hundred-fold difference. And yet the whole thing does not collapse to 8/s, because on benign traffic the first-stage attack rate is low, so the expensive second stage almost never runs. The cascade's savings come from almost never running the expensive step.

Flip it, and if attacks or sensitive queries surge and the first-stage attack rate climbs, the second stage becomes the bottleneck at once. So the cost is set by the traffic mix, not the model spec. Capacity planning should be done against the spike in attack rate, not the average traffic.

## Fitting a big judge on a small card

The second-stage model is about 15GB in bf16. Put the first stage on the same 16GB card and it does not fit; loading bf16 died with an OOM. Drop it to nf4 4bit and it is about 9.4GB, which coexists with the first stage's ~1.2GB. For this task the accuracy loss from 4bit was negligible. So in this stack 4bit is not a choice but a premise. The moment you decide to use a large judge, on a 16GB card the quantization is decided with it.

## Strictness is paid in tokens

The second-stage prompt from the last post that held recall had a role, an injection defense, and JSON output. In exchange the output got longer. Same model, but per-request latency rose from 2.5s to 3.7s on average, and output tokens from 61 to 97. A strict prompt buys accuracy and pays for it in tokens. Recall is not the only thing on the scale; latency belongs there too.

## Where the cost comes down

- **Narrow the gate.** Send only the false-positive-prone contexts (general help, informational queries) to the second stage, and let the cipher and encoding families keep the first-stage verdict. A narrower gate means less second-stage load.
- **Drop the GPU when the first stage is enough.** The first stage does tens of requests per second even on CPU. At small scale, the first stage alone runs the whole thing without a second stage.
- **Move the second stage to continuous batching at scale.** With static batching there was a point where growing the batch actually spiked the latency. A continuous-batching server like vLLM gets past that limit.

## Notes

- A cascade's throughput is decided by the gate, not the expensive stage. The cost is a function of the traffic mix.
- To fit a big judge on a small card, quantization is a premise. If bf16 does not fit, 4bit is the default.
- A strict prompt buys accuracy and pays in tokens. Put accuracy and latency on the same scale.
