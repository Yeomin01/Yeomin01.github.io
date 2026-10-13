---
title: "When a Generative Model Writes Too Few Turns, Force It with a Schema"
date: 2026-10-06
draft: false
tags: ["LLM", "synthetic data", "structured output", "JSON schema", "vLLM"]
categories: ["LLM"]
summary: "I generated 1,000 multi-turn conversations for evaluation with a local 4B-class model. On the first attempt only 1 in 8 followed the spec. The model wrote only about 60% of the requested number of turns, and wrote the documents short. Instead of asking in the prompt, I forced the number of exchanges and the document length with a JSON schema, and in the end 96% passed."
---

## Data that has to be built to spec

I generated multi-turn conversations to fill the empty cells of the evaluation set. Each conversation has a spec: label (attack/benign), evasion technique, domain and job role, language, speech style, format (conversation, list, pasted document, code), and number of user turns (3–7). The goal is to fill cells, so a conversation that violates its spec is useless. For the generator I used a 4B-class open model running locally.

## First attempt: 1 in 8

I put the judging criteria and the spec in the prompt and had the model output the conversation as JSON. Only 1 in 8 passed. When I counted the failure reasons, most were the turn count. Asked for 7 turns it wrote 4, and asked for 5 it wrote 3. It ended the conversation at about 60% of what was requested. Making the prompt wording stronger is one option, but this kind of tendency is not easily fixed with wording.

## I fixed the number of exchanges with a schema

vLLM, which I had been using for serving, can take a JSON schema per request and generate only tokens that satisfy that schema (structured output). I changed the output format. Instead of receiving turns as a list of role and content, I received an array in which one `{"user": …, "assistant": …}` pair is bundled as one exchange. Setting the array's `minItems` and `maxItems` both to the requested turn count makes the number of exchanges exactly right. That the roles alternate is also guaranteed by the structure. This one change made the turn count failures disappear.

## Documents came in as a separate field

The next failure was format. In conversations requested in pasted-document format, the documents were short at 230–520 characters and fell short of the format classifier's document criterion (600 characters or more, paragraphs with few line breaks). For the code format, the model often described code in sentences without a code block.

Instead of having the model write documents and code inside the conversation, I received them as separate fields. The document type gets `minLength: 700` on a `document` field, the code type gets a minimum length on a `snippet` field, and which user turn to paste it into comes as an `attach_turn` integer. After receiving the output, code attaches the document to that turn, or wraps the snippet in a code block and inserts it. Length and format are guaranteed by structure. I also put a maximum length on every string to keep a single field from growing without end.

## My parser was deleting the code blocks

Some of the code type still failed, so I pulled the numbers for the failed items only. There were cases classified as conversation type even though a code block was clearly there. The cause was my parser. To handle the case where the model wraps its output in a code fence, it was removing fence markers from the entire output, and that also removed the code blocks inside the conversation text. Structured output does not produce an outer fence, so I changed it to parse the output as is first and strip the outer fence only when that fails.

## Edges of structured output

There were a few operational problems too.

- If the model tried to emit the end token before the grammar constraint was fully satisfied, that request ended in a server error. It happened rarely, so I treated it as something to retry.
- There were cases where it output nothing but whitespace endlessly until it hit the token limit. I added the option that blocks whitespace (`disable_any_whitespace`) to the request.
- Long 7-turn conversations hit the token limit and the JSON was truncated. I raised the limit.

## Results and remaining weaknesses

After the fixes the first-attempt pass rate became 78%, and by retrying the failures up to three times I got 963 of 1,000 (96%). It took about 23 minutes with 16 concurrent requests. After generation I audited template overlap and embedding proximity against the training data and removed 4 more.

I measured diversity separately too. There were no near-identical conversations among the generated ones (cosine of 0.95 or higher). However, the same opening of the first utterance appeared up to 32 times, and even when casual speech (반말) was requested, the conversation often went back to polite speech (존댓말) partway through. Also, the model used for generation is from the same family as the re-verification model in the pipeline under evaluation, so I decided to mark that stage's numbers separately as "values where it judged its own sentences." Since this is evaluation data, I used the prompt to keep the assistant turns from containing details that could actually be carried out.

## Takeaways

When a generative model does not follow the structure of a spec, forcing it with an output schema is more reliable than asking with wording. Take counts as array length, length as a string minimum length, and position as an integer field, and structural violations cannot occur. What remains are properties a schema cannot express, such as speech style and diversity, and those are checked separately by measurement after generation.
