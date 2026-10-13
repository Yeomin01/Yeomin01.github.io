---
title: "Give a Small Model All the Conditions at Once and It Drops Them from the Front"
date: 2026-10-06
draft: false
tags: ["LLM", "prompting", "synthetic data", "gemma", "selection bias"]
categories: ["LLM"]
summary: "I generated business documents for evaluation with a 4B model, and 29% of the output was usable. Cutting the task down, adding an allowlist and a bad example next to a good one, and recovering only the format mistakes whose meaning was clear raised that to 71%. Along the way I also confirmed that rejection sampling quietly drops the hard specs first."
---

## Starting point

While building documents for evaluation, I gave a local 4B model (gemma family) this task: write one input in which an employee pastes a document into a chatbot and asks for something, write all PII as placeholders such as `[[NAME]]` and `[[PHONE]]`, and wrap the output in the form `<입력>…</입력>` (an "input" tag). Along with it I gave a spec: organization type, document kind, language, amount of PII, what is requested, and length.

With a large API model, this kind of failure was rare on the same task. With the 4B model, only 7 of 24 (29%) were usable. I sorted the failures.

| Failure | Count |
|---|---|
| Wrote only a one-line request with no document ("Please check the attached file") | 11 |
| Wrote a name directly, without a placeholder | 3 |
| Made up a placeholder that is not on the list | 2 |
| Put PII in a control document that should have none | 1 |

Nearly half did not write the document at all. They missed the first condition of the instruction, "an input with a pasted document". In a long instruction with several conditions stacked together, the small model tended to drop the ones at the front first.

## Step 1: I cut the task down to one — 8%

I split the task. The model writes only one thing, the document body, and the request sentence ("Summarize just the key points of this document") is picked from a list prepared in advance and prepended by code.

It started writing documents. But the pass rate fell to 8%. This time it invented placeholders that were not on the list, such as `[[DATE]]`, `[[PROJECT_NAME]]`, `[[COUNTRY]]`, `[[DOB]]`, and `[[SYSTEM_NAME]]`. Twelve outputs produced 45 kinds. It had generalized the strong instruction "do not write PII values directly" into "write every value as a placeholder". You could say it understood the task as writing a template.

## Step 2: An allowlist and a bad example next to a good one — 50%

I changed two things. I pinned down with a list that there are only 16 fixed placeholders, and added a separate clause saying to write everything else directly, as in a real document. And I added a one-line bad example in exactly the shape the model had actually gotten wrong.

```
- Bad example: Manager [[NAME]] attended the [[DATE]] [[PROJECT_NAME]] meeting after a business trip to [[COUNTRY]]
- Good example: Manager [[NAME]] attended the March 14, 2026 ERP upgrade meeting after a business trip to Vietnam
```

One line showing the failure in its actual shape worked better than a long paragraph of explanation. The pass rate reached 50%.

## Step 3: Ban example names, recover some format mistakes — 71%

Most of the remaining failures wrote example names directly, such as "김철수 팀장" (team lead Kim Cheol-su) and "이영희 사원" (staff member Lee Young-hee). Part of the cause was that I had left out the sentence "do not write even one person's name directly" when I rewrote the instruction. I put that sentence back and banned example names as well.

Format mistakes whose meaning was clear I recovered instead of discarding: `[[IP]` with one closing bracket missing, a closing tag written as `<문서>` instead of `</문서>` (a "document" tag), and `[[NAME_1]]` with the number attached by an underscore instead of `#`. I did not rescue outputs that were cut off and had no closing tag at all, because the document may have been cut in the middle.

The pass rate reached 71%. Later I made the answer check stricter and the pass rate on the same sample went down to 58%, but that part comes from the criterion changing, not the instruction.

## It read the placeholder as a number

The documents that passed had a problem too: a unit added again after the amount placeholder. Writing `[[AMOUNT]]원` (원 is the currency unit, won) puts another "원" after the filled value "1,576만원" (15.76 million won), giving "1576만원원". 31% of the amount spans were like this. The model understood the placeholder as a slot for a number.

The filled value already carries the unit, so at the merge step I deleted the one duplicated unit right after an amount span and shifted the positions of the spans that follow. So that words starting with 원, such as "원장" (ledger) and "원본" (original copy), are not cut, the unit is deleted only when what follows it is a particle, whitespace, or punctuation. That fixed 110 places, and no span value ended up misaligned.

## Rejection sampling drops the hard specs first

Outputs that did not pass the check were discarded and generated again. This approach has a trap. The harder the spec, the more it fails, and a spec that fails to the end drops out of the result. The final distribution ends up different from the spec distribution.

In practice the pass rate differed by document form.

| Form | Spec → pass |
|---|---|
| General business document | 92% |
| Email thread | 94% |
| Logs, config, code | 86% |
| Tables and rosters | 74% |

Table documents often wrote the department column directly, without a placeholder, and got caught by the answer check. I did three things to reduce this skew.

- Raised the number of attempts per spec from 3 to 5.
- Where all 2–3 rare labels used to be required, I made only the first label required. When all were required, the output had sentences with labels forced in, such as "an access attempt using an external IP and a license plate number".
- Added a table-format example (`| [[NAME]] | [[ORG:부서]] |`, where 부서 means department) to the instruction.

I also put the spec distribution and the passed distribution side by side, compared them, and recorded the comparison in the dataset's documentation. With rejection sampling, the resulting distribution can only be interpreted if what dropped out is written down with it.

## The check can be wrong too

At one point the pass rate fell much more than expected. I regenerated the dropped specs with the same seed and printed the rejection reasons one by one, and the fault was the check's, not the model's. The check that looks at form fields was reading the `**` of Markdown bold in `**작성부서:** …` (an "authoring department" field) as a value and rejecting valid documents. When the rejection rate is high, look not only at the model output but also at what the check tripped on.

## Another way to force the format

Another option is to force the output format itself with a JSON schema, using the same server's structured output feature. The record of solving multi-turn dialogue generation that way is in [When a Generative Model Writes Too Few Turns, Force It with a Schema](/en/posts/force-the-shape-with-a-schema/). In this generation the core was the placeholder rules inside the document body, so there was little a schema could force, and I solved it with the instruction and a post-hoc check.

## Takeaways

Give a small model many conditions at once and it drops the ones at the front first. What worked was cutting the task down, closing what is allowed with a list, and showing a bad example in exactly the shape of the failure. For format mistakes, I recovered only the ones whose meaning was clear and discarded the uncertain ones. And when using rejection sampling, check not just the pass rate but also, as a distribution, what dropped out.
