---
title: "Where Were the Checkpoints — The Pointer Was There, the Contents Were Not"
date: 2026-10-06
draft: false
tags: ["MLOps", "DVC", "checkpoint", "model registry", "storage"]
categories: ["MLOps"]
summary: "While sorting out where the evaluation sets, the deployed model, and the previous model versions live, I found that every checkpoint used for version comparison existed only on the training server's local disk. The DVC pointer for the deployed model was committed, but the contents had not been uploaded to the remote storage. Having a pointer and being able to fetch the contents turned out to be two different things."
---

## While sorting out the locations

I took on the job of sorting out the paths of the evaluation sets, the deployed model, and the previous model versions on shared storage. I found the evaluation sets and the deployment bundles quickly. There were two deployment bundles; the model weights were the same and the difference was one config file. I confirmed with a directory comparison that only that one file differed and wrote that down with them.

The previous versions were another matter. Of the checkpoints for the six versions used in the cross-version performance comparison graph, not one was on shared storage. Searching by run id turned up nothing. The training logs that were on the storage belonged to even earlier experiments, and the version numbers in their names overlapped, which made them easy to confuse. The checkpoints were all on the training server's local disk.

## Only the pointer was there

The run directory of the deployed model had a DVC pointer file committed. The pointer records the directory hash, the file count, and the total size. But when I looked for that hash in the remote cache, it was not there. `dvc add` and the commit had been done, but `dvc push` had not. The pointer was pointing at contents that did not exist.

Fortunately the deployment bundle held a copy of the same checkpoint. I confirmed it was the same contents by the file count in the pointer (3) and the total size matching, to the byte, the summed size of the three files in the bundle (weights, training config, data summary). I put on record that I verified by size and file list instead of recomputing the hash.

## The local disk was getting full

The checkpoints left on the local disk came from twelve runs, with 5–15 per-epoch checkpoints each, about 150GB in total. That server's system disk was 88% full. It is a shared server, so when this disk fills up, other people's work stops as well. It had actually happened before that the disk filled completely and every shell command stopped, and the cause was checkpoints left behind by runs that died midway. A run that exits normally deletes the last checkpoint, which holds the optimizer state (about 3 times the size of the model alone), but a run that dies midway never reaches that code.

## What I changed

- Version registration counts as done only once the remote upload is finished. Committing the pointer alone is not registration. The check is not whether the pointer exists but actually downloading the contents from a different location.
- I do not keep every epoch for each version. Only the one selected epoch, the training config, and the data summary go up to shared storage. One model is a little over 1GB, so keeping six versions comes to under 10GB. That is a different size from moving 15GB per run wholesale.
- Discarded versions are recorded in the registry too. The four retrained versions discarded this time had no registry card at all, which made it hard to reconstruct later why they were discarded. I left cards with the run id, the data changes, and the reason for discarding.
- New checkpoints are saved as safetensors instead of pickle, and non-tensor metadata goes in a separate file.

## Takeaways

The most common failure in checkpoint management is "I thought it was there, and it was not". A DVC pointer means something only when the contents are up on the remote. Make the upload and a download check part of version registration, choose which epoch to keep, and record even the discarded versions, and the lineage can be found again later.
