---
title: "Every Process Was Loading a 1GB List It Never Used"
date: 2026-10-06
draft: false
tags: ["memory", "containers", "lazy loading", "performance", "cost"]
categories: ["Cloud"]
summary: "A function that checks organization names against a list loaded the list into memory before looking at the flag that says whether to use it. That policy had already been retired and the function was being called with the flag off, so a 1GB list of several million entries sat unused in every process. After the fix, serving container memory went from 2.4GB to 1.7GB."
---

## Found while the serving side was measuring memory

The serving side was measuring container memory (RSS) and let me know it was larger than expected. There was 1GB that the model size did not explain.

Tracing it led to the organization name list. Previously, whether an organization name found in the text was PII was decided by whether it was on the list. That approach was retired a few months ago. Now, whether an organization name is tied to a specific individual is decided from context, and the ambiguous ones are looked at by a second-stage LLM. The function that checks the list was still there, but the current pipeline calls it with the check turned off (`check_list=False`).

## It loaded the list even when called with the check off

The function looked roughly like this.

```python
def filter_listed_org(spans, check_list=True):
    _preload_org_list()          # loads the list before looking at the flag
    if not check_list:
        return spans
    ...
```

It was loading the list before looking at the flag. The list has 3.76 million entries and takes 1GB in memory. So a list that was never used got loaded into every process that called this function. Each process start also took 10 to 30 seconds longer.

The preload code carried a comment saying "index initialization." But the function that actually looks at the list was loading the list itself before using the index. The preload was code that had never been needed in the first place.

## Measurements

| Point | Process memory |
|---|---|
| Right after import | 39 MB |
| Before the fix, one call with the check off | 1,117 MB |
| After the fix, one call with the check off | 39 MB |

At the serving container level it went from 2,383 MB to 1,662 MB. The serving side uses the same file, so this was a cost both sides had been carrying equally.

## Pinned with tests

The fix is simple. Look at the flag first, and load the list only when the check is actually needed. I pinned this behavior with tests.

- Called with the check off, the list is not loaded (the module's list object stays `None`).
- Called with the check on, the list is loaded at that point.
- Even when called with the check on, the list is not loaded if the value is one whose decision finishes before the list is consulted (for example, a name filtered out earlier by a public list, such as a listed company).

Non-functional behavior like memory can break while the functional tests still pass. So there has to be a separate test that directly asserts "when does it load," or the problem comes back.

## In terms of cost

1GB in one process does not end there. Serving starts as many processes as there are workers, times the number of replicas. With 3 replicas of 4 workers each, the unused list takes up 12GB. The container memory limit has to be set that much higher, and that translates directly into instance size and cost. If startup is 10 to 30 seconds slower, the time until a new replica brought up by autoscaling starts taking traffic also grows.

## Takeaways

When a policy changes, the old policy's code often stays on the call path. Turning it off with a flag stops the feature, but whatever happens before the flag is checked keeps costing. Do expensive initialization only after deciding it is actually needed. And since memory does not show up in functional tests, measure it per process and pin the result with a test.
