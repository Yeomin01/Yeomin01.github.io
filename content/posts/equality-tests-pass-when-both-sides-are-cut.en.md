---
title: "An Equality Test Passes Even When Both Sides Are Cut Together"
date: 2026-10-06
draft: false
tags: ["testing", "CI", "pipeline", "regression", "NER"]
categories: ["CICD"]
summary: "There was a parity test checking that the evaluation chain matches the serving chain. If someone cuts the later stages off the serving chain, the evaluation chain is cut along with it and the test still passes. A failure of exactly that shape actually happened in another deployment environment. I separately pinned, with cases, that the later stages actually change the result."
---

## A test that only checks sameness

The PII detection pipeline is made of several stages: model inference, merging in the regex results (the overlay), and the post-processing stages after that. If the evaluation script produces results through a different path from serving, the performance table becomes false, so I had a parity test checking that the outputs of the evaluation chain and the serving chain are the same.

This test only checks whether the two chains are the same. If someone cuts the later stages out of the serving chain, the evaluation chain calls the serving function as is, so it gets cut too. The two results are still the same and the test passes. It sees a state where both sides are broken together as normal.

## A failure of that shape actually happened

The post-processing function in another deployment environment ended at the overlay merge. The four stages after it were missing: the amount policy, propagation of repeated mentions of the same name, recovery of listed names, and the common noun filter. That environment's tests were passing. Our parity test could not have caught this failure either. It would have been the same if this had happened in our chain.

## Pin that the later stages change the result

Separately from equality, I pinned with tests that the later stages actually do work. For each stage there is one case where the result stopped at the overlay and the final result must differ.

| Case | Stage that must change it |
|---|---|
| 경복궁 입장료는 3,000원입니다 ("Admission to Gyeongbokgung Palace is 3,000 won") | Amount policy (amounts not attributable to an individual are released) |
| 김철수 … 김철수 고객님 맞으신가요 ("Kim Cheol-su … Am I speaking with Mr. Kim Cheol-su?") | Re-mention propagation (a name caught once is applied at other positions in the same document) |
| 공주 이야기를 들려주세요 ("Tell me a princess story") | Common noun filter (common nouns that look like names are released) |
| 홍길동+김영희 두 분 예약해 주세요 ("Please book for two, Hong Gil-dong+Kim Yeong-hui") | Listed-name recovery (names joined by symbols are split and caught) |

If someone cuts off the later stages, these cases fail because the result does not change. This test sees the failure the equality test cannot.

The cases had to be chosen separately for each chain. At first I brought over as is the case that had been the problem in the other environment, but in our chain the result did not change. The organization name policy that handles that case sits before the overlay in our chain, so it was already reflected in the partial result. Even when testing the same layer, the cases have to fit what each chain actually does.

## Keep the head-side cases too

I did not delete that organization name case; I kept it, marked "not changed by the later stages." If the table has only cases that belong to the later stages, then when the next person mistakes something the earlier stages handle for the later stages' share, the table says nothing. Only with cases that must not change does the boundary between front and back show up in the table.

Along the way I also corrected one wrong inference. When that case failed on our side, I first read it as "the two environments have different chain orders." When I checked, the other environment also had the organization name policy in the earlier stages. Its test baseline was leaving out the earlier stages and calling only the overlay, so that case had been passing falsely. Our baseline included the earlier stages, and so it failed honestly. When a case fails on only one side, before concluding it is a chain difference, first check that each side's baseline matches what its own chain actually does.

## Actually trigger the safeguard

After adding the tests, I deliberately cut the serving chain at the overlay and ran the full test suite. 5 failed: the 4 later-stage cases and 1 equality test. The head-side case still passed. It is right that it does not change when the tail is cut.

Having test code is different from that test catching the failure. You can only say the safeguard works after you inject the failure it is supposed to catch and see it fail.

## Takeaways

An equality test only guarantees that two paths are the same. Both being broken is also the same state. To catch a failure where a pipeline stage goes missing, you have to separately pin cases where each stage actually changes the result. Keeping cases that must not change alongside them leaves the boundary between stages on record like documentation. And for a new test, deliberately create the failure and confirm that it fails.
