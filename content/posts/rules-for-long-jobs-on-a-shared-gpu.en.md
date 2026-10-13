---
title: "Rules for Long-Running Jobs on a Shared GPU Server"
date: 2026-10-06
draft: false
tags: ["MLOps", "pipeline", "watchdog", "operations", "GPU"]
categories: ["MLOps"]
summary: "I run training, evaluation, and generation jobs for hours at a time on a server where several people share a single GPU. A job has to survive a dropped session, resume when it dies without restarting forever, and not harm other people's jobs. I wrote down the rules that have accumulated so far, along with two small incidents I caused myself this time."
---

## Surviving a dropped session

A job that takes hours, run in the terminal foreground, dies the moment SSH drops. `nohup ... &` alone still leaves it affected by some signals. I launch the job script in a new session with `setsid`, detach it from the shell with `disown`, and detach all of standard input and output as well. Anything that will take more than 5 minutes is launched this way.

## Stages and a state file

A long pipeline is split into stages, and each time a stage finishes, its number is written to a state file. On restart, the pipeline reads the state file and skips the finished stages. Whether a stage is complete is judged from the completion marker left in the log and from the output artifacts. For work that proceeds item by item, like a generation stage, results are appended one line at a time, and on restart the ids already written are skipped. This way a job that dies midway does not start over from the beginning.

## For a watchdog, stopping is the default over restarting

Alongside the job I keep a watchdog script that checks every 5 minutes whether the master process is alive and relaunches it if it has died. When this watchdog judges wrongly, the cost is large. Once, the training output was written to network storage while the watchdog looked for the completion marker in a local log, so it kept seeing a training run that had exited normally as an "abnormal exit" and relaunched it dozens of times. So I set the rules like this.

- Completion is judged by the output artifacts, and the path being watched must be the same as the output path.
- There is a cap on the number of restarts (3), and past it the watchdog records a failed status and stops.
- If the job to be resumed has already finished, it is not resumed.
- When the judgment is ambiguous, the default is to stop, not to restart.

I do not nest `setsid`. If a child is launched again with `setsid ... &` inside a master that is already detached, `$!` points to an intermediate process that exits immediately, and the watchdog logic wrongly concludes that the child has died. The master writes its own PID to a file, and the watchdog checks liveness by that PID.

## Passing a syntax check is not verification

Once I patched a script by string replacement, the target string did not match, and nothing changed. No exception was raised either. I had verified it with a syntax check and a keyword search, but a single variable declaration line matched the search, so I did not see that the check code itself was entirely missing. Since then, a replacement asserts that the target occurs exactly once, and a safety mechanism such as a deadline is used only after I have actually triggered it on a copy with the time shortened.

## The two small incidents this time

First, I ran `pkill -f <pattern>` to stop a background audit job, but the command line of my own shell running that command contained the same pattern. `pkill` killed its own shell too, and the fix I had chained after it in the same command never ran. Now I either wrap the first character in brackets, as in `pgrep -f '[a]udit'`, so the pattern does not match my own command line, or I check the PID and terminate only that PID.

Second, when I stopped a job manually I wrote "stopped by user" to the state file, but the wait loop waiting for the result was only waiting for "done" or "failed". The wait loop kept running until its time limit. The wait condition has to include the stopped state too.

## The GPU is a shared resource

- A job that uses the GPU starts only at the moment it is requested. A waiting process that "starts on its own when there is room" is launched only after asking. There was a case where a job that had been called off started on its own and took the memory.
- Before starting, I leave headroom for other processes. The memory another person's job uses can grow.
- I do not terminate someone else's process without checking with its owner.
- I stop my own job right away once its result no longer matters. When the version under evaluation was discarded, I stopped the GPU job measuring that version partway and gave the GPU back.

## Takeaways

A long-running job on a shared server has to hold to three things: survive by being detached from the session, resume from a state file with a cap on restarts, and not harm the jobs of the people sharing the GPU. Most of the rules came out of real incidents, and most of the incidents began with "reading an ambiguous signal as a definite one".
