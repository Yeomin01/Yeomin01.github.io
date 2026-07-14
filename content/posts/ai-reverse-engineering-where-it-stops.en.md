---
title: "AI Reverse Engineering: How Far It Goes and Where It Stops"
date: 2026-07-14
draft: false
tags: ["security", "reverse-engineering", "ai-agent", "verification", "workshop", "notes"]
categories: ["Security"]
summary: "The third talk at the 2026 AI Security Workshop was a practitioner's account of doing binary reverse engineering with AI agents. Better than a human at unpacking and long-log analysis; weak at symbolic execution and verifying transformation equivalence. It judges but cannot verify — exactly the same spot as my second-stage verifier story."
---

## Opening

This is a participant's note on the talk "Reverse Engineering Code with AI Agents" by a researcher at the National Security Research Institute, from Session 2: Agent Security at the 2026 AI Security Workshop (hosted by KIISC), with my own reading added. I carry only the defensive and analytical lessons, and leave out details that could be weaponized.

## Where the game changed

The presenter had done code analysis for over a decade. Reverse engineering binaries with AI used to be something they did not expect much from — low reliability, many errors — but at some point AI actually started to be usable. At first it was a copilot style: paste the disassembler and decompiler output and ask "what does this do." Now it has shifted to the agent choosing and using tools on its own to carry the analysis, with a human confirming along the way.

What struck me was the observation that the model gets better every month. Run the same reverse-engineering task on last month's model and this month's, and the results are visibly different. And beyond the model itself, the tooling around it — how the agent uses tools — improving lifts the results as much as the model does.

## Where AI is strong

The areas where AI was clearly strong: unpacking, it does really well. It uses tools like a hypervisor debugger better than a human. It handles crashes and resources sparingly. And long-log analysis — tracing from where a problem surfaced back to its cause, working from the tail forward — is something a human tires of and gives up on, while AI does not tire and pushes to the end. The presenter had watched it repeat, without tiring, iterations that would take a person days, and eventually solve them. It handled code laced with strange execution tricks well too.

## Where AI stops

The weak spots, conversely, were clear. It does not handle symbolic-execution engines well. And decisively, it cannot verify the equivalence of a program transformation. When you undo obfuscation back to the original code, verifying whether that transformation truly behaves the same as the original is a task that needs compiler-level correctness — and here AI confidently asserts wrong things. It calls anything correct, checks a few cases in an emulator, and if they pass it moves on. So in practice, the presenter said, a human has to hold the verification gate in the middle.

Listening, I felt this was the crux. The most important thing in an agentic loop is, after taking an action, verifying whether it went right — and that verification is exactly what is weak. It judges plausibly, but it cannot tell on its own whether its own judgment is correct.

## Where it overlapped with my own work

This was exactly the same spot as my second-stage verifier story. A generative model judges but is weak at verifying. I saw it in multi-turn re-verification, and the same limit showed up in the entirely different domain of reverse engineering. It made clear that the principle for using a generative model — "let it judge, but leave verification to another layer" — does not care about the domain.

One more, a heavier note the presenter added. Attackers too will start making obfuscation and tools with AI, and then provenance analysis — tracing an organization from the code itself, who made this — gets much harder than it is now. A tool that got easier for defenders got just as easy for attackers. How to face that advance-without-asymmetry was left as the next homework.

## Notes

- AI agents are strong at unpacking, debuggers, and long-log analysis. Not tiring is the decisive edge over a human.
- They are weak at symbolic execution and verifying transformation equivalence. They judge, but cannot tell on their own whether the judgment is right. Humans hold verification.
- "Let the generative model judge, but keep verification in another layer" is a principle that ignores the domain. And this tool is used by attackers just the same.
