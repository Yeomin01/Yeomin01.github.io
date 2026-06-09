---
title: "어절 여러 개에 걸친 ADDRESS — BIO 와 CRF, 그리고 LLM 의 출력 통합"
date: 2026-06-09
draft: false
tags: ["NER", "PII", "ADDRESS", "BIO", "CRF", "LLM"]
categories: ["학습 이론"]
summary: "한국어 ADDRESS 는 광역시·도 + 구 + 도로명 + 건물번호 + 건물명 + 층/호 까지 여러 어절에 걸쳐 나오는 경우가 흔하다. BERT NER 에서는 BIO 시퀀스 위에 CRF 가 일관성을 강제해 처리하고, LLM SFT 에서는 첫 어절 인덱스 한 자리에 통합 텍스트로 출력하기로 정했다. 두 처리 방식의 차이와 평가에서 마주치는 매칭 룰을 정리한다."
---

PII 가드레일에서 한국어 ADDRESS 는 까다로운 카테고리다. 다른 정형 PII (전화·이메일·계좌·주민번호 같은) 는 한 토큰 또는 짧은 토큰 묶음 안에서 끝나지만, ADDRESS 는 여러 어절에 걸쳐 길게 늘어진다. 이 글은 BERT NER 의 BIO + CRF 와 LLM SFT 의 어절 인덱스 형식이 각각 어떻게 이걸 다루는지를 정리한다.

## 한국어 ADDRESS 의 길이

회사 본사 주소 하나를 보면 이렇다.

```
서울특별시 영등포구 여의대로 108, 파크원타워2 47-48층(여의도동)
```

어절 단위로 끊으면 6~7 개. BERT 토크나이저 (WordPiece) 로 sub-word 까지 쪼개면 15~20 토큰이 된다. NER 의 한 라벨이 이렇게 긴 토큰 시퀀스에 걸치는 경우는 정형 PII 중에는 ADDRESS 가 거의 유일하다.

도로명 일부만 나오는 약식 표현도 흔하다.

```
서울에 / 서울시 영등포구 / 여의대로 / 강남구 테헤란로 123
```

어디까지가 ADDRESS 이고 어디부터가 다른 텍스트인지 — 모델이 양 끝의 경계를 정확히 찾아야 한다.

## BERT 의 BIO — 시퀀스로 표현

NER 의 표준은 BIO 태깅이다. 한 라벨이 여러 토큰에 걸치면 첫 토큰은 B-X, 그 이후는 I-X 가 같은 카테고리로 이어진다.

```
서울특별시  →  B-ADDRESS
영등포구    →  I-ADDRESS
여의대로    →  I-ADDRESS
108         →  I-ADDRESS
,           →  I-ADDRESS
파크원타워2  →  I-ADDRESS
47          →  I-ADDRESS
##-48       →  I-ADDRESS
##층        →  I-ADDRESS
(여의도동)  →  I-ADDRESS
```

학습 데이터에서 char span (start, end) 를 BIO 토큰 시퀀스로 변환할 때 토크나이저의 offset_mapping 을 기준으로 정렬한다. 같은 char span 이라도 토크나이저 분할이 다르면 BIO 길이가 달라진다.

## 모델이 잘못 끊는 경우 — 중간에 O 가 들어가면

BIO 의 단점은 모델이 토큰별로 독립적으로 분류할 경우 중간이 깨질 수 있다는 점이다.

```
서울특별시  →  B-ADDRESS
영등포구    →  I-ADDRESS
여의대로    →  O          ← 깨짐
108         →  I-ADDRESS  ← B 없이 I 시작 (시퀀스 불일치)
```

이런 출력은 BIO 룰 위반이다. 그래서 토큰별 분류 위에 시퀀스 제약을 강제하는 디코딩 단계가 필요하다. 우리가 쓰는 게 CRF다.

## CRF — 라벨 사이의 전이 확률을 학습한다

CRF (Conditional Random Field) 는 토큰별 분류 점수에 라벨 간 전이 확률 (transition matrix) 을 더한 점수로 시퀀스 전체 점수를 계산한다. 학습은 NLL (negative log-likelihood) 이고, 추론은 Viterbi.

전이 확률은 학습 데이터에서 자동으로 익혀진다. 자연스럽게 잡히는 룰들:

- `O → B-X`: 자주 발생, 큰 확률.
- `O → I-X`: 거의 없음. 학습 데이터에서 본 적 없는 시퀀스라 확률 낮음.
- `B-ADDRESS → I-ADDRESS`: 흔함.
- `B-ADDRESS → I-NAME`: 같은 라벨이 아닌 I 로 이어지는 경우. 데이터에 없으므로 거의 0.

이 전이가 토큰별 logits 와 함께 시퀀스 점수가 되고, Viterbi 디코딩이 가장 점수가 높은 일관된 시퀀스를 뽑는다. 위 예시처럼 중간이 O 로 끊긴 출력은 전이 확률 페널티 때문에 자연스럽게 배제된다.

```python
# pytorch-crf 의 사용 예
import torch
from torchcrf import CRF

crf = CRF(num_labels, batch_first=True)
# 학습 시 — 음의 로그우도 계산
loss = -crf(logits, labels, mask=attention_mask, reduction='mean')
# 추론 시 — Viterbi 디코딩
best_seq = crf.decode(logits, mask=attention_mask)  # list[list[int]]
```

CRF 의 효과는 토큰별 분류만 했을 때와 비교해 명확하다. BIO 룰 위반 (O 뒤 I, 다른 카테고리 I) 출력이 거의 사라지고, 길이가 긴 ADDRESS 의 경계가 안정된다.

## 평가에서 마주치는 매칭 룰

LIVE 평가셋의 ADDRESS 결과를 표 안에서 비교할 때 두 가지 매칭 룰을 쓴다.

- **exact**: gold span 의 (start, end, label) 이 pred 와 완전히 일치하는 경우만 TP.
- **overlap**: gold 와 pred 가 한 글자라도 겹치고 라벨이 같으면 partial 로 인정.

ADDRESS 는 길어서 양 끝 한두 토큰 차이로 exact 가 부분 일치로 빠지는 경우가 잦다.

```
gold:  서울특별시 영등포구 여의대로 108, 파크원타워2 47-48층(여의도동)
pred:  서울특별시 영등포구 여의대로 108, 파크원타워2 47-48층
       (gold 가 한 글자 더 많은 ")" 까지 포함)
```

이런 경우는 exact 에서는 미스, overlap 에서는 hit 다. 우리 v4 모델의 LIVE 평가는 exact precision/recall 이 97.3 %, overlap 으로는 99.8 % 였다. 의미 있는 정보 손실은 없지만, 평가 metric 으로 어떤 걸 쓰느냐가 모델 비교에서 0.5~2 % 의 숫자 차이를 만든다.

## LLM SFT — 어절 인덱스 한 자리에 통합

LLM 으로 같은 ADDRESS 를 처리할 때는 BIO 가 자연스럽지 않다. LLM 의 출력은 토큰별 라벨이 아니라 자유 생성 텍스트이기 때문이다. 우리는 어절 인덱스 + 라벨 + 텍스트 형식으로 출력 형식을 잡았다 (한 글 전에 자세히 다뤘다).

같은 ADDRESS 를 LLM SFT 데이터로 표현하면 이렇다.

```
입력: [0] 서울특별시 [1] 영등포구 [2] 여의대로 [3] 108, [4] 파크원타워2 [5] 47-48층(여의도동)

출력:
[{"idx": 0, "label": "ADDRESS",
  "text": "서울특별시 영등포구 여의대로 108, 파크원타워2 47-48층(여의도동)"}]
```

이어진 어절 (`[0]` 부터 `[5]` 까지) 을 모두 따로 출력하지 않고 **첫 어절 idx 한 자리에** label 과 통합 text 로 적는다. `[1]`, `[2]` 같이 중간 어절에 대해 따로 출력하지 않는다 — 후처리 코드가 첫 idx 와 text 를 보고 원문 위치를 복원하므로 중복이다.

이렇게 하면:

- 출력 토큰 수가 한 ADDRESS 당 한 줄. 짧다.
- 평가도 단순 — gold 의 첫 idx 와 통합 text 가 일치하면 TP.
- BIO 시퀀스 일관성 같은 복잡함이 없다 — LLM 의 자유 생성 안에서 텍스트 자체가 출력이라.

## 두 처리 방식의 차이 — 정리

| | BERT (BIO + CRF) | LLM SFT (어절 idx) |
|---|---|---|
| 단위 | 토큰 | 어절 |
| 표현 | B-X / I-X 시퀀스 | 첫 idx + 통합 text |
| 일관성 보장 | CRF transition matrix | 후처리 룰 (이어진 어절 합치기) |
| 평가 매칭 | char-level span (exact / overlap) | idx + text 매칭 |
| ADDRESS 의 길이 부담 | 시퀀스 길수록 CRF 부담 | 한 줄 출력 |

ADDRESS 처럼 긴 라벨은 BIO 가 시퀀스 길이만큼 부담을 지고, LLM 출력은 그 길이가 단일 text 안으로 흡수되어 평가가 단순해진다. 한편 BERT 는 토크나이저 분할에 맞춰 정확한 경계를 잡고, LLM 은 어절 정의에 맞춰 잡는다 — 양쪽 모두 경계 정확도가 중요한 metric 이다.

## 정리

- 한국어 ADDRESS 는 여러 어절·여러 토큰에 걸친다. NER 모델에게는 평균보다 긴 시퀀스다.
- BERT 에서는 BIO 로 표현하고 CRF 가 시퀀스 일관성을 강제한다. CRF 없으면 중간에 O 가 끼는 깨진 시퀀스가 나온다.
- 평가 metric 으로 exact / overlap 둘 다 보는 게 안전하다. 길이가 길수록 exact 만 보면 의미 없는 경계 미스로 점수가 깎인다.
- LLM SFT 에서는 첫 어절 idx 에 통합 text 로 출력. 이어진 어절을 따로 적지 않는다 — 후처리에서 동일하게 풀린다.

같은 task 라도 모델 종류에 따라 ADDRESS 의 표현이 달라진다. 어떤 표현이 평가에 유리한지, 모델의 디코딩 부담을 줄이는지를 함께 봐야 학습 데이터 형식이 정해진다.
