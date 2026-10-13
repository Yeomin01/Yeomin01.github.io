---
title: "Diagnosing Why Korean NER Recall Collapses on Customer-Service Dialogue Outside the Training Distribution"
date: 2026-07-01
draft: false
tags: ["NER", "Korean", "domain-gap", "fine-tuning", "data-augmentation"]
categories: ["Fine-tuning"]
summary: "A Korean PII NER model scores F1 0.92 on our own test set but dropped to half or less on real customer-service data. The cause was that the training distribution is mostly declarative sentences and sat completely outside the context of the `고객:/상담사:` (customer:/agent:) turn markers of customer-service dialogue. BERT missed even the most typical names, confident at 1.00 that they were non-PII. This post records the diagnosis, the redesign of the augmentation, and the list-based whitelist matching logic I cleaned up along the way."
---

## Background

I am training a Korean PII NER model (KoELECTRA-base-v3 + CRF, 16 categories). With it scoring F1 0.98 on our own clean/reviewed test set and F1 0.92 on our own hard/OOD set, I ran a regression evaluation on real data from the customer-service domain. The result was not what I expected.

| Category | Own clean | Own hard | Real customer-service data |
|---|---|---|---|
| NAME  | 0.99 | 0.97 | **0.56** |
| ADDRESS | 0.97 | 0.98 | **0.26** |
| ACCOUNT | 0.98 | 0.99 | **0.64** |

Structured categories like PHONE and EMAIL held, but three context-dependent categories dropped to half or less. Support per category was in the hundreds to thousands, so these were numbers that could not be seen as noise.

## Diagnosis 1 — it was not truncation

The first hypothesis was sample length. The customer-service samples averaged 813 characters with a maximum of 1,325, longer than the training samples. Measured with the tokenizer, they went up to 674 tokens, about 5% exceeded 512, and 26% of spans were at character position 512 or beyond.

But sample #2, at tok=339, was processed without truncation, and the model still missed three of this sample's six gold spans, all three occurrences of NAME 김미영 (Kim Mi-young). Sample length was not the cause.

## Diagnosis 2 — it was not a side effect of the hybrid pipeline either

The second hypothesis was the regex overlay and postprocess that follow the BERT prediction. To check whether this pipeline was erasing BERT spans, I fed in one short sentence whole.

```
"고객: 성함은 김미영이고, 주소는 서울특별시 강남구 테헤란로 123번지입니다."
("Customer: My name is Kim Mi-young, and my address is 123 Teheran-ro, Gangnam-gu, Seoul.")
```

On this sentence the raw BERT prediction caught `김미영` correctly as `B-NAME I-NAME`, and it was still alive in the final hybrid output. The pipeline was not the problem.

## Diagnosis 3 — in a long customer-service context, BERT itself is confident in O

When the same 김미영 sat inside a whole customer-service dialogue, the BERT prediction changed completely. I fed in sample #2 whole and pulled the predicted labels and confidence at the positions of 김미영.

```
First occurrence (char 322)  → 김미:O(0.96) ##영:O(0.98)
Second (char 387)            → 김미:O(1.00) ##영:O(1.00)
Third (char 535)             → 김미:O(0.89) ##영:O(0.83)

Address span "서울특별시 강남구 테헤란로 123번지"
                             → 서울:O(1.00) ##특별:O(1.00) 강남구:O(1.00)
                               테헤란:O(1.00) ##로:O(1.00) 123:O(1.00) ##번:O(1.00) ##지:O(1.00)
```

It is confident in O at confidence 1.00. It does not judge the input to be different from the training distribution and predict with uncertainty; it is fully confident that this is non-PII. It catches `010-9876-5432` correctly. Structured PII with a fixed format is no problem.

I extended this to many samples and pulled the top missed values.

```
Top missed NAME values:
  348x 김민수, 96x 김철수, 93x 홍길동, 37x 김영수, 30x 김영희

Top missed ADDRESS values:
  99x '서울시 강남구 테헤란로 123'
  48x '서울특별시 강남구 테헤란로 123'
  14x '서울시 강남구 역삼동 123-45번지'
```

The most typical Korean names and address templates are missed as they are. These are names that seem likely to be in the training data, so I checked the labeling of the training set and confirmed that these names were often used inside training sentences as "example names" (exposed as they are, without masking).

## Cause

The 460,000 training samples were mostly declarative, sentence-level synthetic data. Dialog turn markers such as `고객:` (customer:) and `상담사:` (agent:) were not in the training set at all. With the labeling of short single sentences containing typical names overlapping with natural example sentences, it is quite likely the model learned the reading "김민수 (Kim Min-su) inside a long dialogue = an example sentence". A short single sentence is close to the training distribution and gets caught, but wrapped in dialog markers the context signal gets stronger and the model becomes confident it is non-PII.

I checked ADDRESS and ACCOUNT the same way. ACCOUNT was caught in a "bank name + account number" context but tended to be missed when there were only digits without a bank name.

## Response — rewriting the augmentation as customer-service turn dialogue

I rebuilt the v7 augmentation with the following rules.

- Every sample must be a 2-4 turn dialogue in which `상담사:` and `고객:` each appear at least once
- Real customer-service contexts (banks, cards, online shops, telecom carriers, hospitals, public agencies, insurance, parcel delivery, and so on)
- For each category, the parts that are weak in the training distribution are stated in the prompt:
  - NAME: "avoid stock example names such as 김민수, 김철수, 홍길동"
  - ACCOUNT: "also include cases where only digits appear without a bank name"
  - ADDRESS: do not make sentences that give only the province/metropolitan city, or go only as far as the city/county/district. Always include one of dong + lot number / road name + unit number / a detailed building name. The `address` value is the whole span running from the province/metropolitan city down to the detail

Five categories × 5,000 samples. I am preparing v7 training with 25K laid on top of the existing 466K training set.

In a dry run, 3-4 out of 5 followed the prompt exactly. There were a few non-compliant cases that gave only the province/metropolitan city, and I raised `max_tokens` to 900 so that the dialogue responses would not be cut off.

```
[address] "고객: 네, 인천광역시 연수구 송도동 12-15, 503호 입니다."
          (Customer: Yes, it is 12-15 Songdo-dong, Yeonsu-gu, Incheon, unit 503.)
[account] "고객: 신한은행 1234-567-8901 입니다."
          (Customer: It is Shinhan Bank 1234-567-8901.)
[amount]  "고객: 이번 달 사용 요금은 87,500원 입니다."
          (Customer: This month's usage charge is 87,500 won.)
[rrn]     "고객: 920722-2541893 입니다."
          (Customer: It is 920722-2541893.)
```

## Cleaned up along the way — list-based whitelist matching

On the same benchmark, ORG recall also came out low. ORG is confirmed with a whitelist based on the business-license list (3.7 million) + the DART unlisted-company list (110,000), but the logic checked only exact matches, so matching was failing often. Taking the cause apart, three things were mixed together.

**First, cases that are in the list but that normalization cannot catch.** `KB국민은행` (KB Kookmin Bank) was not in the list as that string; it existed only in forms with a branch, annex facility, or corporate marker attached, such as `KB국민은행 신관` (the bank's new annex) and `(주)KB국민카드` (KB Kookmin Card with the corporation marker). Ones like `IBK기업은행` and `배달의민족` were the same pattern. As a fix, I built an alias index at load time. For each list entry, it cuts off what comes before the first space/parenthesis and adds that brand-name prefix to the alias set. I keep only those of 4 or more characters so that short person names are not promoted to aliases. The index size is 280,000 after removing entries that overlap with raw/normalized.

**Second, noise in the list itself.** Inside the 3.75 million entries of the business-license list, person names such as `김민수`, `김철수`, `홍길동` and short generic words such as `서울` (Seoul) and `가나` were registered as actual business names. If BERT predicted such text as ORG, it passed on a raw match. I attached two filters in front.

```python
_KOREAN_NAME_RX = re.compile(
    r"^[김이박최정조강윤장임한오서신권황안송전홍고문양손배백허유남심노하][가-힣]{2}$"
)
_ORG_HARD_BLACKLIST = frozenset({
    "서울","부산","대구","인천","광주","대전","울산","세종",
    "경기","강원","충북","충남","전북","전남","경북","경남","제주",
    "한국","미국","일본","중국","북한","남한", ...
})
```

I also filtered out spans of 2 characters or fewer. `DB` is registered in the business-license list as an actual business name (`DB`, `DB Company`, `DB PC방`, `DB 손해보험`, and so on), so there were cases where BERT falsely flagged "DB 서버" (DB server) as ORG. For real 2-character brands (KT, LG, SK), the business-license list had only other companies, so there was no side effect.

**Third, things that are not masking targets by policy were passing.** The 3,846 DART-listed companies and the 204 global big tech companies are supposed to be public negatives and not masked, but this reject was not reflected in the matching logic. 신한은행 (Shinhan Bank), 삼성전자 (Samsung Electronics), 엔비디아 (Nvidia), Microsoft, and others passed as they were. I added lookups of the two lists at the front of the function.

Put together, the matching order became this.

```
A. length 2 characters or fewer → False
B. person-name pattern → False
C. place/country blacklist → False
D. DART-listed company or global big tech → False
1. raw exact match → True
2. normalized match → True
3. alias match → True
```

All 18 cases of a mini validation came out as intended. `KB국민은행`, `IBK기업은행`, `배달의민족` newly passed, and listed companies such as `엔비디아`, `Microsoft`, `신한은행` were all rejected.

## Regression evaluation

I applied the improved list logic to the eight viewer benchmarks and re-measured ORG F1.

| Set | before | after | Δ |
|---|---|---|---|
| clean | 0.411 | 0.591 | **+0.18** |
| inspect | 0.465 | 0.612 | +0.15 |
| ood_det | 0.471 | 0.737 | **+0.27** |
| AIHub OOD | 0.863 | 0.852 | -0.01 |
| KLUE OOD | 0.027 | 0.039 | +0.01 |

Recall rose by 15-28%p while precision dropped only slightly. KLUE's label scheme differs greatly from our policy (companies, institutions, departments), labeling the police, the prosecution, the government, North Korea, and South Korea as ORG, which confirmed again that it is unsuitable as a benchmark.

AIHub OOD regressed slightly, by -1%p, and it looks like the hard filter removed a few valid cases. I plan to measure again after applying the listed-company reject policy strongly.

## What remains

The v7 augmentation training is running in the background. When training finishes, I can check how much NAME, ADDRESS, and ACCOUNT recall recovers on the same real customer-service data. I set strong prompt conditions, but customer-service dialogue itself is a format entering the training data for the first time, so the key question is how much 25K of dialogue augmentation laid on top of a declarative training set of about 400K can override. Depending on the result, I will probably adjust the augmentation size or the prompt again.
