---
title: "I Could Not Fix the Shipped Model, so I Fixed the Ruler"
date: 2026-10-06
draft: false
tags: ["evaluation", "gold set", "versioning", "coverage", "labeling"]
categories: ["Evaluation"]
summary: "I learned that the training data of an already-deployed model overlapped with the evaluation set. The model could not be retrained right away, so I bumped the version of the evaluation set. I removed the overlapping items, counted the gaps cell by cell across speech style, format, language, technique, and domain, and made a plan to fill them with new data."
---

## Which side to fix

The leakage audit showed that part of the evaluation set overlapped with data the deployed model had seen during training. It came in three kinds: exactly identical conversations, variants of the same template, and conversations that were in the index looked up at inference time.

There are two directions for fixing leakage. Remove the training data and rebuild the model, or remove the overlapping items from the evaluation set. Which is right depends on who copied whom. If the training data was built by looking at the evaluation set, the training data has to go. Conversely, if the evaluation set was built later from the same source as existing training data, rebuilding the evaluation set is the right call.

This time the two cases were mixed. But the deployed model is already out and cannot be changed right away. To measure that model honestly, I had to fix the ruler. I prepared a filtered training set separately for the next training run, and decided to release a new version of the evaluation set.

## Criteria for removal

The evaluation set is not edited; its version is bumped. The existing version stays frozen, and its numbers are not written in the same table as the new version's. There are three criteria for what was removed in the new version.

- Leaks already determined to be exact matches in the previous version
- Character 5-gram containment of 0.3 or higher (against the deployed model's training and combiner data)
- Embedding cosine of 0.95 or higher against the serving kNN index

By these criteria about 40% of the existing evaluation items were removed. I kept the removed items as a list with the reasons, and stored the audit result files and the build script with it. I also confirmed that rerunning the script gives the same result.

## Count by cell

After the removal, the gaps became clear. Looking at the evaluation set as one lump gives only "one F1," and there is no telling whether the model is weak on casual speech or weak on document-style input. So I attached stratum tags to each item and counted by cell.

- Language: Korean / English / translationese
- Speech style: polite (존댓말) / casual (반말) / mixed
- Format: conversation / list or table / pasted document / code or log
- Technique: splitting, gradual escalation, authority impersonation, reframing after refusal, notation disguise, chained edits, and so on
- Domain: public sector, healthcare, defense, telecom, finance, general

Target counts were set by what each cell is for. A primary cell that has to resolve a 1%p difference in false positive rate gets 500 items, a secondary cell that only has to not miss a regression of 5%p or more gets 200, and a cell that only has to tell whether it works or not gets 100. The domain axis is new this time, and on the benign side healthcare, defense, and telecom had 0 items.

Cells can be filled with overlap. One conversation that is casual, document-style, and in the healthcare domain fills three cells at once. So the amount that needs to be generated is set not by the sum of the per-cell shortfalls but somewhere near the shortfall of the largest axis.

## Rules for filling, and labels

The fill data is built on the same principles as the dev set. The prompt gets only the label definitions and the cell spec, and the training data generator and the evaluation set text are not looked at. It is generated with a different model from the one that made the training data, and once made it has to pass the same two audits.

Labels are assigned by people. The generation intent is not used as the label. That said, having people look at all of several hundred items is a heavy load, so I considered a scheme where an item is auto-confirmed if two different judge models and the generation intent all agree, and a person looks at it if any one of them disagrees. If people also check a random sample drawn from the auto-confirmed portion, the error rate of the automatic labels can be written in the report as a number. The model that generated the data and any model inside the pipeline under evaluation are not used as judges. That would amount to a model grading sentences it wrote itself.

The labeler should be someone who does not build training data. If a person who has read the evaluation set text designs the next training data, the gold's templates flow through that person into training.

## Takeaways

When a deployed model cannot be changed right away, bump the evaluation set's version and remove the items that overlap with what the model saw. Once they are removed, the per-cell gaps become visible, and those gaps get filled with independently built data. Manage the evaluation set by freezing and versioning, and keep what was removed and why together with the reproduction script.
