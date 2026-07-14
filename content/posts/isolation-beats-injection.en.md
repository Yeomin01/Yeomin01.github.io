---
title: "Isolation Beats Injection"
date: 2026-07-14
draft: false
tags: ["LLM", "security", "agent", "prompt-injection", "workshop", "notes"]
categories: ["Security"]
summary: "The first talk I heard at the 2026 AI Security Workshop was about stopping prompt injection with isolation rather than filtering — about not repeating the history where we tried to block SQL injection and XSS with string matching and kept getting through. It was the same shape as what I had learned in the multi-turn work. Detection is mitigation; isolation is design."
---

## Opening

This is a participant's note on the talk "Agent Design for Prompt Injection Defense" by Prof. Byoungyoung Lee (Seoul National University), from Session 2: Agent Security at the 2026 AI Security Workshop (hosted by KIISC), with my own reading added. I carry the design perspective, not the implementation details.

## Filtering does not stop it

The talk started from a familiar history. We first tried to block SQL injection and XSS with string patterns — find the dangerous strings, block and filter them. And that approach always got through. Attackers always found a new form that slipped past the filter. What actually closed the hole was not filtering but separation: SQL with parameterized queries, XSS with structures like CSP that split data from code. Only after that did the problem close.

Prompt injection sits in the same spot. An agent runs by attaching externally fetched data — web pages, email, documents, comments — into its context. If "ignore the previous instructions and …" hides inside that data, the LLM can follow the attacker instead of the user. Adding a guardrail here is, in the end, just another LLM-based filter: a probabilistic model guarding a probabilistic model. Blocking five out of ten and getting through the other five is not something we call security.

## Isolation stops it

The direction the talk offered was isolation, not filtering. Split the LLM in two: a Trusted LLM that sees only what can be trusted, and an Untrusted LLM that processes untrusted external data. The user prompt goes only to the Trusted side, and the external data an attacker can plant goes to the Untrusted side.

The key is that the Trusted LLM never sees the attacker's raw data at all. Needed values are handed over substituted as symbols (variable names). So the Trusted side has no surface to be injected through. It cannot follow an attack string it never reads. This is security-by-design: not lowering the odds of a breach, but removing the path of one.

The presenter's group went one step further, applying the same principle to persistent data like files — a Dual View. When the agent writes a file, it keeps both a symbol view and a raw view. The side the agent reads (agent view) gets only symbols; the side shown to the user (the screen) gets the raw content. So it satisfies security and utility together. Stored prompt injection — planting a malicious prompt inside a file, the agent-world version of persistent XSS — is closed inside this structure too.

## Where it overlapped with my own work

Listening, my own work kept overlapping. I detect multi-turn attacks with a first-stage classifier and re-verify the rest with a second-stage generative model. But the first stage has families it cannot see, and the second stage goes blind in front of encoded attacks. No amount of stacked detection crossed the wall of probability.

The frame this talk gave clarified the nature of that wall. Detection is mitigation; it only lowers the odds of a breach. Isolation is design; it removes the path of one. However strictly I wrote the prompt, it was still mitigation, and the root was in splitting data from instruction by structure. The old lesson that what filtering cannot stop, separation can, came back intact in the age of agents.

## Notes

- Prompt injection cannot be stopped by filtering. As with SQL injection and XSS, the root is separating data from instruction.
- Isolation does not lower the odds of a breach; it removes the path of one. If the Trusted side never sees attacker data, there is no surface to inject.
- Detection is mitigation; isolation is design. They are defenses at different layers, and the root fix is the latter.
