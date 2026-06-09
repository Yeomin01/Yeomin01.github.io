---
title: "NER 모델이 일반 명사를 ORG 로 잡는 이유 — 토크나이저, OOV, 그리고 vocab 확장"
date: 2026-06-09
draft: false
tags: ["NER", "tokenizer", "OOV", "WordPiece", "KoELECTRA", "vocab"]
categories: ["학습 이론"]
summary: "PII 가드레일의 ORG 오탐 (디바이스·창업지원 같은 단어를 회사명으로 잡는 현상) 을 줄이려고 학습 데이터를 늘려봤지만 잘 안 줄어들었다. 원인을 추적하다 보니 토크나이저가 모델에 보여주는 분할 자체에서 시그널이 약해지는 케이스가 있었다. 토크나이저 동작과 vocab 확장이 NER 정확도에 미치는 영향을 정리한다."
---

PII NER 모델이 "디바이스", "창업지원" 같은 일반 명사를 ORG 로 잡는 패턴이 데이터 보강만으로는 잘 줄지 않았다. 학습 데이터를 비슷한 컨텍스트의 negative 로 채워도 같은 단어가 다시 ORG 로 분류됐다. 원인을 추적하다 보니 토크나이저가 모델에 보여주는 분할이 학습 시그널 전달에 영향을 주는 경우가 있었다.

## NER 의 토크나이저 흐름

KoELECTRA 같은 한국어 BERT 계열 모델은 WordPiece 토크나이저를 쓴다. 토크나이저는 입력 문자열을 vocab 에 있는 가장 긴 sub-word 부터 매칭해 잘게 쪼갠다.

```
입력:   한국인터넷진흥원
vocab:  한국인터넷진흥원 (있으면 1 토큰)
        없으면 "한국인" + "##터" + "##넷" + "##진흥" + "##원"
```

분할 결과는 모델의 첫 임베딩 layer 입력이고, NER 의 라벨 (B-ORG / I-ORG) 도 토큰 단위로 정렬된다. 같은 단어라도 vocab 에 있고 없고에 따라 토큰 길이가 달라진다.

## subword 가 잘게 쪼개지면 학습 시그널이 약해진다

vocab 에 없는 단어가 길게 쪼개지면 모델 입장에서는 다음 부담이 생긴다.

- **BIO 시퀀스 학습 부담**: "한국인 ##터 ##넷 ##진흥 ##원" 이 ORG 라면 B-ORG, I-ORG, I-ORG, I-ORG, I-ORG 의 시퀀스를 학습해야 한다. CRF 가 시퀀스 일관성을 강제하긴 하지만, 학습 데이터에서 이런 긴 BIO 시퀀스를 자주 봐야 안정된다.
- **분할 정렬의 차이**: 같은 단어가 학습 데이터와 추론 입력에서 다르게 쪼개지면 ([UNK] 같은 토큰이 끼면) 일반화가 어려워진다.

KoELECTRA 의 35,000 vocab 은 대다수 한국어 일반 어휘는 통째로 담는다. 하지만 **자사 제품명·보안 도구·내부 용어** 같이 학습 코퍼스 (위키·뉴스·모두의 말뭉치) 에 없던 단어는 잘게 쪼개진다.

```
"OneGaurd"            → 6 토큰  (OG와 별개로 매 글자마다 sub-word)
"malware_mobile"      → 8 토큰
"OG_네비웍스"          → 7 토큰
```

이렇게 잘게 쪼개진 토큰은 학습 데이터에서 보지 못한 패턴이고, 모델 입장에서는 "낯선 토큰 시퀀스가 자주 등장 — 이건 뭔가 식별자다 → ORG 후보" 같이 일반화되기 쉽다. 우리가 본 ORG 오탐 패턴이 이쪽이었다.

## 일반 명사가 ORG 로 잡히는 다른 경로 — 학습 분포의 영향

위 경우와 다르게, vocab 에는 통째로 들어 있는 단어가 일반 명사 위치에서 ORG 로 잡히는 경우도 있다. "다음", "디바이스", "창업지원" 처럼. 이건 토크나이저 문제는 아니다. 학습 데이터에 같은 단어가 회사명·서비스명으로 자주 등장하고 (`다음(Daum)`, `디바이스 매니지먼트`), 일반 명사로 등장하는 빈도가 부족해서 분포가 회사명 쪽으로 쏠린 결과다.

이건 데이터 보강으로 풀린다. 우리는 "다음 주에 회의", "디바이스 로그 확인" 같은 일반 명사 컨텍스트의 negative sample 을 모은 합성 데이터 (urimal_neg) 와 위키 본문 (KoWiki) 으로 분포를 옮기는 작업을 진행 중이다.

## vocab 확장 — 자주 등장하는 자사 용어를 통째로 토큰 한 개로

토크나이저 측 처방은 vocab 에 자주 등장하는 자사 용어를 추가하는 것이다. 추가한 단어는 모델 입장에서 통째로 한 토큰이 되고, 잘게 쪼개지지 않는다. 학습 시그널이 한 자리에 모인다.

```python
from transformers import AutoTokenizer, AutoModel

tok = AutoTokenizer.from_pretrained("monologg/koelectra-base-v3-discriminator")
model = AutoModel.from_pretrained("monologg/koelectra-base-v3-discriminator")

# 새 vocab 추가
new_tokens = ["OneGaurd", "TouchEn", "mVaccine", "OWASP", "SIEM", "EDR"]
n_added = tok.add_tokens(new_tokens)
print(f"추가된 토큰: {n_added}")  # 6

# ★ 모델의 embedding 차원도 같이 늘려야 한다
model.resize_token_embeddings(len(tok))
```

`resize_token_embeddings` 를 빼면 vocab size 와 embedding row 수가 안 맞아서 다음 forward 에서 인덱싱 에러가 난다. 새로 추가된 토큰의 embedding 은 평균값 또는 sub-word embedding 의 평균으로 초기화하는 게 안정적이다 (단순 랜덤 초기화는 학습 초반 불안정).

```python
import torch

# 새 토큰의 embedding 을 기존 sub-word 평균으로 초기화
emb = model.get_input_embeddings()
for new_tok in new_tokens:
    sub_ids = original_tok.encode(new_tok, add_special_tokens=False)  # 원래는 잘게 쪼개진 ID 들
    new_id = tok.convert_tokens_to_ids(new_tok)
    with torch.no_grad():
        emb.weight[new_id] = emb.weight[sub_ids].mean(dim=0)
```

이렇게 하면 새 토큰이 처음부터 의미 있는 embedding 을 가지고 시작한다.

## 확장 후 fine-tuning

vocab 을 늘렸으니 그 토큰이 등장하는 학습 데이터가 어느 정도 필요하다. 확장한 단어가 거의 등장하지 않는 데이터로 학습하면 새 embedding 이 거의 업데이트 안 되고, 우연히 등장한 케이스에서만 시그널이 들어간다.

우리 v6 plan 은 자사 제품·보안 표준·약어 30~50 토큰을 추가하고, 그 토큰이 자주 등장하는 합성 데이터 (Solar 슬롯 합성) 를 따로 만들어 같이 학습하는 것이다. 추가한 단어들이 ORG positive (예: "OneGaurd 운영 매뉴얼") / ORG negative (예: "OneGaurd 라는 단어가 들어간 일반 문장") 양쪽에서 균형 있게 등장해야 한다.

## 정리

- 토크나이저가 잘게 쪼갠 분할은 NER 의 학습 시그널을 분산시킨다. vocab 에 없는 자사 용어가 길게 쪼개지면 일반화가 어렵다.
- 일반 명사가 ORG 로 잡히는 두 가지 경로:
  - vocab 에 없어서 분할 패턴이 식별자처럼 보이는 경우 → vocab 확장 + resize_token_embeddings.
  - 학습 분포가 회사명 쪽으로 쏠린 경우 → 일반 명사 컨텍스트 negative 데이터 보강.
- vocab 추가 후에는 `resize_token_embeddings` 와 새 토큰 embedding 초기화 (sub-word 평균) 가 같이 따라야 한다. 둘 다 빠뜨리면 학습 안정성에 손해를 본다.
- 단어를 추가했다고 끝이 아니다 — 그 단어가 자주 등장하는 학습 데이터가 받쳐줘야 새 embedding 이 의미 있게 학습된다.

토크나이저는 사전 학습 모델의 "입력 layer 모양" 을 결정한다. 우리 도메인에 맞게 다듬을 때 가장 먼저 봐야 할 곳이다.
