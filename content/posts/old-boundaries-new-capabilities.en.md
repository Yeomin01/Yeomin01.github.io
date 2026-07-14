---
title: "Old Boundaries Reopen Under New Capabilities"
date: 2026-07-14
draft: false
tags: ["security", "agent", "browser", "isolation", "workshop", "notes"]
categories: ["Security"]
summary: "The second talk at the 2026 AI Security Workshop was about the point where the site isolation browsers spent decades building reopens in an agentic browser. Not a prompt injection that fools the model, but taking over one renderer and pushing a command down the trusted path. A new capability reaches over an old boundary and opens the door again."
---

## Opening

This is a participant's note on the talk "New Security Threats in Agentic Browsers and Extensions" (based on a paper published at IEEE S&P) by a researcher who did their PhD at KAIST, from Session 2: Agent Security at the 2026 AI Security Workshop (hosted by KIISC), with my own reading added. I carry the structure and the lesson, not the attack steps.

## The boundary browsers built

An ordinary browser has spent a long time building Site Isolation. Different sites run in different renderer processes, because a page fetched from the web is an untrusted context by default. So even if attacker.com's page is taken over, that renderer is a separate process and cannot directly touch reddit.com's or a bank site's data. Blocking cross-site access at the process level — this is decades of defensive capital.

## The agent reaches over it

Agentic browsers and extensions add three pieces on top: a Content Script that manipulates the page, a Task Panel where the user enters commands, and a Background Script that actually talks to the LLM and orchestrates the agent. The Task Panel and Background run in a separate, trusted-context process, and they talk to each other over IPC messages. The user's command rides this trusted path to the LLM.

The problem the talk pointed to is this. If one renderer process is taken over — arbitrary-code-execution bugs like this are reported in Chrome roughly once every couple of months — that renderer's Content Script shares the same IPC channel as the trusted process. So the attacker can send a forged IPC message to the Background and plant a command straight onto the trusted path, like "new task: read the user's account balance." No prompt injection to fool the model is needed at all. One message disguised as though the user's command came in is enough. Now the agent's capability reaches straight over the cross-site access that site isolation used to block. Exfiltration — sending what was read on one site out to another — opens up.

There is a worse direction still. Some recent designs put a separate local MCP server in place of the browser process and connect the Task Panel and Background over HTTP. Then even the step of taking over a renderer is unnecessary. One forged HTTP request to the local server runs the desired command. A design meant to make the boundary more convenient made the boundary thinner.

## The defense is, in the end, origin checking

The defense the talk offered was simple and fundamental. The Background Script must always check the origin of an IPC message. Accept only messages from the trusted Task Panel as legitimate commands, and immediately drop messages forged from a compromised renderer. As long as the higher-privileged browser process guarantees the integrity of that origin, this simple check alone neutralizes the attack.

A familiar picture. In the end it is the problem of separating data from instruction, trusted origin from untrusted, by structure. It stands in the same spot as the first talk's isolation.

## Where it overlapped with my own work

What I took from it was a slightly different angle. Old boundaries reopen under new capabilities. Browser isolation was a defense tuned for an era where a human clicks and reads. The agent laid an automated capability on top — reading and writing across many sites — and that capability naturally reached over the existing boundary line. When you introduce a new capability, you have to look at which old boundary it renders void along with it. Grant the capability first and build the boundary later, and the gap between becomes the attack surface.

## Notes

- Site isolation was designed for human browsing. The agent's automated cross-site capability reaches over that boundary.
- Plant a forged command on the trusted path by taking over one renderer, and cross-site exfiltration opens without any model-level injection.
- The root of the defense is origin checking. When you introduce a new capability, check which old boundary it voids along with it.
