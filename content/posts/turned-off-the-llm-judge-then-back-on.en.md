---
title: "I Decided to Turn Off the Second-Stage LLM Verification, Then Reversed It the Same Day"
date: 2026-10-06
draft: false
tags: ["LLM", "cascade", "evaluation", "PII", "design"]
categories: ["LLM"]
summary: "In a setup where a second-stage LLM uses context to release names that the first-stage NER masked, I decided to turn the second stage off after looking at only one kind of traffic. That data had almost no names that should be released. I confirmed that with it off, general questions about public figures get masked and cannot be answered, so I reversed the decision, and flipped the verdict default that had caused the problem to 'mask'."
---

## Division of roles

PII detection has two stages. The first-stage NER catches every name, whether or not it belongs to a public figure. Filtering in advance with a list of public figures was abolished some time ago, because the same name should be judged differently depending on context. Picking out the names that must not be masked, as in a general question about a public figure, is the second-stage LLM's job.

## I decided to turn it off after looking at one kind of traffic

Before deploying the new version I had to decide whether the second stage would be on or off. The evaluation set I used as the basis was identity-verification conversations: 300 conversations in which the user states a name and a number directly during a consultation.

| Configuration | Conversation-level block rate |
|---|---|
| First stage + rules | 82.3% |
| First stage + rules + second-stage LLM | 60.3% |

With the second stage on, the block rate fell sharply. Of the 186 names the second stage released, 46% were real PII planted in the evaluation set. On a general corpus with no PII, the second stage's discriminative power also looked weak. With the previous model it released true positives and false positives in equal numbers, so its discriminative power was effectively 0. So I decided to turn the second stage off.

## That data had no names that should be released

After writing the decision down, I looked again from the opposite direction. Identity-verification conversations have almost no names that must not be masked. With only planted PII in it, on that data the second stage can only look like "a stage that removes where nothing needs removing". Public-figure queries, the reason the second stage exists, were not in the evaluation set.

I measured again with probes built for checking each policy clause.

| Configuration | Passed |
|---|---|
| Second stage on | 9 / 10 |
| Second stage off | 7 / 10 |

With the second stage off, the name in a general question about a public figure gets masked and the chatbot cannot answer. The second stage was separating the same name by context. In a question checking who a company's executive is, it released the name as a "public information query", and in a sentence asking for the same person's home address, it masked it as a "request for personal information".

I reversed the decision the same day. To sum up, neither side was complete.

- Off: identity-verification conversations are blocked well, but public-figure queries get masked and cannot be answered.
- On: public-figure queries work, but some real PII is released in identity-verification conversations.

If a single evaluation set holds only one direction, the configuration that works only in that direction wins. A stage that releases, like the second stage, has to be measured on data that has both "things to mask" and "things to release".

## The cause was the verdict default

When I collected the cases where the second stage released real PII, most had the same reason. The last line of the name clause in the second-stage prompt was "if a name appears alone, the context is insufficient, so treat it as a false positive". Because of this one line, employee names in pasted internal documents and customer names in consultation records were released. PII inside exactly that kind of document is what the guardrail is there to block.

I flipped the verdict default.

- The default is mask. Release happens only for "a widely known public figure and publicly known facts about that person". Private information around a public figure, such as a family member's workplace or school, is masked.
- A name that appears together with a numeric private identifier (such as a resident registration number, passport number, or card or account number) is masked by rule, without going through the LLM. A combination that leaves no room for judgment is not handed to the LLM.
- Things that may be the public contact details of a public figure or an institution, such as a main phone number or email, are judged by the LLM from context.

In the serving-side measurement after the change, the second stage wrongly released 0 names across 174 identity-verification conversations (everything that was not blocked was a first-stage false negative). Over-blocking on public-figure queries was 1 of 45, and all 15 policy probes passed.

## Return the reason for the verdict

I fixed one more thing along the way. The serving function returned only the remaining spans and threw away the second stage's verdicts and reasons. What the second stage released and why could not be seen in the serving logs.

I left the existing return value as it was and added a separate function that returns, for each value, the verdict, the reason, whether it was kept, and whether the LLM was called. For values decided by rule, it also marks that the LLM was not called. When the second stage releases PII, the reason has to be on record for me to trace back which clause of the prompt caused it.

## Takeaways

The effect of an LLM verdict stage has to be measured on data where that stage has work to do. Measure a releasing stage on data that has only things to mask, and it looks like nothing but a harmful stage. Set the default for ambiguous verdicts on the safe side for the system's purpose, and handle combinations that leave no room for judgment by rule instead of handing them to the LLM. And a verdict the LLM gives has to be kept together with its reason, or the cause cannot be found later.
