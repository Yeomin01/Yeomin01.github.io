---
title: "Swapping Only the Checkpoint Is Not a Release"
date: 2026-10-06
draft: false
tags: ["MLOps", "DVC", "reproducibility", "model management", "deployment"]
categories: ["MLOps"]
summary: "When I worked out what one version of an NER model actually consists of, the checkpoint was only part of it. The calibration temperature, per-label thresholds, regex and normalization rule code, and the training config and data all have to be there together for the same behavior to be reproduced. This post lays out what I keep for each version and how."
---

## Most of this improvement was in code

When I promoted a new version, I put this sentence in the version card: "Do not replace the checkpoint alone." A good part of the behavior that improved that week was not in the model weights but in the regex rules and the text normalization code. If the serving side swaps in only the checkpoint file, the numbers in the performance table do not come out.

Listing what produces a detection result gives this.

| Component | If it changes |
|---|---|
| Model weights | The candidate spans change |
| Calibration temperature | The confidence changes, so the same threshold gives a different result |
| Per-label, per-stage thresholds | Where the cut falls changes |
| Regex, normalization, and post-processing rule code | The final spans change |
| Second-stage LLM prompt and policy version | What gets released changes |

Change any one of these and it is a different system. So a version is kept as this bundle, not as a checkpoint.

## What I keep for each version

I keep it as a rule to record the following on every training run. There is one purpose. From the logs and config alone, it should be possible to reconstruct "on what data, in what way, with what changed from the previous version, and from what base model" the training was done.

Config file. Hyperparameters and paths are not hard-coded in the code; they live only in the config file. At the top of the config file, one line states what changed from the previous version. The base model is written as an identifier that shows where it came from.

Data summary at the head of the training log. It always prints the train and eval counts, the label distribution, and the number of records per source. The data generation scripts also record the number generated and the source and language distributions. The point is that in an experiment that changed the data, "what went in" does not have to be recomputed later.

Version card. In each layer's model record document, I add a card per version. It records the run ID, base model, data counts and label ratios, changes from the previous version, the motivation for the change, input representation and loss, results (whether it passed the promotion gate, key metrics, the selected epoch), and whether it was deployed. If the experiment changed only one variable, that fact goes at the top of the card. Versions that were not promoted also get a card, with the reason. The same goes for versions invalidated by evaluation data contamination.

Run folder. The outputs of one training run are gathered in a single run ID folder. It holds a copy of the config, the evaluation results, and per-epoch checkpoints. Checkpoints are kept per epoch because sometimes the epoch is chosen by out-of-distribution evaluation rather than by the validation set best.

## Large artifacts go to DVC

A single run folder is several GB. The run folder of the deployed version was 169 files, 8.1GB. Artifacts like this do not go into git; they are managed with DVC. Only a small pointer file with the content hash, size, and file count is committed to git, and the actual files are pushed to a DVC remote on team storage. The repository currently has 17 pointers, pointing to the training data folder, the deployed run folder, the combiner artifacts, and so on.

Set up this way, reproducing a deployed version takes one command to fetch the artifacts as of that point.

```bash
dvc pull <layer>/out/logs/<run-id>.dvc
```

Because the pointers stay in the commit history, which code commit was paired with which artifacts can also be traced through git history.

That said, a pointer only means something when the contents have been pushed to the remote. On another model, the pointers were committed but `dvc push` was skipped, and the pointers were pointing at contents that did not exist ([Where Were the Checkpoints — The Pointer Was There, the Contents Were Not](/en/posts/where-were-the-checkpoints/)). So I confirm registration not by whether the pointer exists but by whether the files are actually on the remote. While writing this post I compared the remote listings of the two deployed versions file by file, and no files were missing.

## The bundle that gets handed over

When handing over to the serving side, the checkpoint, the calibration values, the threshold table, information on the path by which that table was derived, and the data for reproducing the evaluation go as one bundle, along with a manifest listing the files and their hashes. The receiving side uses the manifest to check that the bundle is intact.

When values are recomputed and the bundle is replaced, the previous edition is not deleted; it is kept with a date attached. There was a time I recomputed the thresholds after learning they had been derived through a different path from serving. Because the previous edition had been kept then too, I could compare and explain which value changed, when, and why.

Which run is the canonical deployment is written in a single pointer file in the config folder. If there are two or more serving configurations, each configuration gets its own pointer. If one configuration's pointer is overwritten with another configuration's new model, there is no longer any way to tell which model the existing configuration is running on.

## Takeaways

The behavior of one model version is produced jointly by the weights, the calibration, the thresholds, the rule code, and the second-stage prompt. So a version is kept as this bundle, and handed over as a bundle too. Large files are managed with DVC, with pointers left in git. And what changed and why gets written down right at training time. By the time you try to reconstruct it later, the memory has usually already faded.
