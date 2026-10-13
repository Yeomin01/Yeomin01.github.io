---
title: "Choosing an LLM for Data Generation, Access Blocked Me Before the Model Did"
date: 2026-10-06
draft: false
tags: ["LLM", "cloud", "API", "vLLM", "operations"]
categories: ["Cloud"]
summary: "I was choosing an LLM backend to generate evaluation documents, and access blocked me before any performance comparison. The key was invalid, or the cloud side had not approved model access, or there were no credits. I made the API and local serving swappable under the same code through an OpenAI-compatible interface, and wrote down how I handled keys and how throughput differed."
---

## I tried the candidates one by one

I had to generate several hundred evaluation documents. I decided to mix two kinds of generator, so that the writing style would not lean toward one model. The candidates were a few commercial APIs called directly, a managed model service in the cloud, and an open model run on a local GPU.

Before I could even compare models, I was blocked at the access stage, one candidate after another.

| Candidate | Result | Cause |
|---|---|---|
| Commercial API A | Authentication failed | The key in the environment was not valid |
| Managed cloud service | 403 / 404 | Access to that model was not enabled on the account |
| Commercial API B | 429 | There were no credits |
| Domestic model API | Success | OpenAI-compatible endpoint |

With a managed cloud service, having an account does not mean you can call every model right away. Access has to be enabled per model, and some providers' models require submitting a use-case form. Before approval, a call with a model ID that exists still returns 403 or 404. From the error message alone it can look as if the model name was mistyped.

In short, the first things to check when picking a backend were not the benchmark table but key validity, model access approval, and quota and billing status. If any one of the three is blocked, no other comparison matters.

## Swapping backends through an OpenAI-compatible interface

The two backends I ended up using were the domestic model API and the local open model. I put both behind an OpenAI-compatible interface.

```python
from openai import OpenAI

api   = OpenAI(api_key=os.environ["VENDOR_API_KEY"], base_url=VENDOR_BASE_URL)
local = OpenAI(api_key="EMPTY", base_url="http://localhost:8000/v1")  # vLLM

r = client.chat.completions.create(model=MODEL, messages=msgs, max_tokens=3000)
```

Change only `base_url` and the model name and the same generation code runs. At first I loaded the local model directly with transformers and called `generate`, and when I later switched to serving the same model with vLLM, the generation code did not need to change. I made the backend choice a single command-line argument, and recorded on each record which backend and which implementation produced it.

This layer also absorbed the per-model differences. The local model (gemma family) has no system role in its chat template, so the system instruction is prepended to the first user message. The rule is the same whether I call it through transformers or through vLLM.

## Throughput varied widely with the implementation

Even with the same 4B model, throughput varied widely with how I called it.

| Method | Approximate speed |
|---|---|
| transformers + 4bit quantization, `generate` in batches of 6 | about 5 seconds per spec |
| vLLM serving (4bit), 12 concurrent requests | about 1.6 seconds per completion |
| Commercial API, 6 concurrent requests | about 2 seconds per completion |

In a `generate` batch, the other requests wait until the longest output in the batch finishes. In a serving engine, requests enter and leave individually and share the KV cache. For document generation, where output lengths vary, this difference becomes the throughput difference directly. The gap came from the same 16GB GPU and the same model.

## Keys live only in an environment file

I do not write API keys in code, config files, or logs. They stay only in an environment file that is not committed to the repository, and the example file lists only the key names. The generation code reads the environment file at run time.

There was one small problem. Without a path, `load_dotenv()` from `python-dotenv` looks for `.env` relative to the file location of the calling code. In a run with no file, such as code passed on standard input, that search fails. Calling it with an explicit path, `load_dotenv(".env")`, reads the same file regardless of how the code is run.

I was careful with logs too. If you print the whole client config or headers while debugging a failed request, the key ends up in the log. For errors I logged only the exception type and the status code.

## Takeaways

When choosing an LLM backend, the first thing that blocked me was access, not model performance. Check key validity, cloud model access approval, and quota first. Putting the backends behind an OpenAI-compatible interface lets the same code switch between an API and local serving. For the local model, running it on a serving engine gave much better throughput than calling `generate` directly.
