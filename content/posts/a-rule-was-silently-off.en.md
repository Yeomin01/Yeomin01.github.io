---
title: "Numbers Were Coming Out with One Rule Silently Turned Off"
date: 2026-10-06
draft: false
tags: ["CI", "reproducibility", "gitignore", "testing", "measurement"]
categories: ["CICD"]
summary: "The deterministic rules in the evaluation harness were wrapped so that if a module could not be found, only that rule was turned off and the run carried on. In another environment, a single .gitignore pattern meant a file had never been committed, yet the file existed locally, so every test passed. I changed the harness to print the enabled rules at the head of the measurement log and warn if any are off."
---

## A silent fallback

The evaluation harness for PII detection layers several deterministic rules on top of the model output. There is a rule that tracks names within a conversation, a second pass that recovers names broken up by symbols, and others like them. All of these rules were wrapped like this.

```python
try:
    from pipeline.rules import scope_names
except ImportError:
    scope_names = None   # if the module is missing, skip this rule
```

Originally this was a device to let the harness run on branches where a rule had not been merged yet. Time passed, every rule was merged, and the wrapper stayed. Now this code does one thing. If the module cannot be found, it finishes the measurement with only that rule off and no error. The numbers come out looking normal.

## A real incident: a file that was never committed

Something similar actually happened in another deployment environment. One evaluation script had never once been committed to the repository. The cause was a single line in `.gitignore`.

```
[Ss]cripts
```

A pattern without a leading `/` matches paths of that name at every depth in the repository. So even the `scripts/` folder inside a tree of code brought in wholesale from elsewhere (vendored) was being excluded.

The file existed on the developer's local machine, so every test passed. The problem showed up only on a fresh clone of the repository or a container build. There it stopped right away with an import error. If the same thing had happened in our harness, the wrapper would have swallowed the error, and numbers with just that rule off would have quietly come out.

## Print the enabled rules in the measurement header

I made it so that whoever reads a number can tell what configuration it came from. When the harness starts, it prints each rule's status at the head of the log, and attaches a warning if any rule is off.

```
[rules] binding routing=ON · conversation scope=OFF · … · syllable second pass=ON
[rules] ⚠ 1 rule off — these numbers are the values for that state
```

I split this output into its own function, and deliberately turned one flag off to confirm that the warning actually appears. The check was not whether the warning string exists in the code, but whether it actually fires in that situation.

## What to check in CI

These are the checklist items I took from this.

- Do not catch import failures for required components. Have a fallback only for optional features, and when the fallback fires, record that fact in the run output.
- A test that passed locally passed "with the files present." Problems that lean on untracked files only show up when you run from install through tests in a freshly cloned directory or a clean container.
- Anchor directory patterns in `.gitignore` at the intended location (`/scripts/`). Which file was excluded and why can be checked with `git check-ignore -v <path>`.
- Record, alongside a measurement result, the settings that can change the result. Even with the same model and the same data, different enabled rules give a different number.

## Takeaways

A fallback that silently carries on when a module is missing can outlive the reason it was made and contaminate measurements. A number that comes out without an error does not get questioned. So when producing a number, leave in the same output what configuration it came from, and make it announce loudly when the configuration differs from what was expected.
