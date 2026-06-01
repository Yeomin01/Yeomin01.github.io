---
title: "프루닝 했는데 같은 템플릿이 수십 번 — 의미 dedup 의 한계"
date: 2026-06-01
draft: false
tags: ["LLM", "데이터 프루닝", "dedup", "embedding", "합성 데이터"]
categories: ["데이터"]
summary: "임베딩 기반 의미 dedup 으로 프루닝을 했는데 같은 템플릿이 수십 번 살아남는 일이 있다. 왜 그런지, 슬롯 합성 데이터에선 어떤 dedup 도구가 적절한지, 그리고 데이터 origin 에 따라 도구를 어떻게 골라야 하는지 정리한다."
---

[이전 글](/posts/data-pruning-scaling-laws/) 과 [3 단계 데이터 선별 파이프라인 글](/posts/data-selection-pipeline/) 에서 "데이터를 잘 골라 줄이면 성능이 유지 또는 개선된다"는 아이디어와 그 구현을 다뤘다. 그런데 막상 직접 적용해 보면 의외의 함정에 부딪힌다 — **dedup 을 분명히 거쳤는데 같은 템플릿이 수십 번 살아남아 있는 경우** 다.

이 글은 그 함정의 정체와, 왜 임베딩 기반 의미 dedup 이 슬롯 합성 데이터에선 부족한지, 그리고 어떤 도구를 골라야 하는지를 정리한다.

## 발견 — 의미 dedup 을 한 데이터를 뜯어보면

3 단계 파이프라인 중 Stage2 는 임베딩 + k-means 클러스터링 + stratified keep 으로 다양성을 유지하며 절반으로 줄이는 단계다. 합성 데이터 15K 를 만들고 직접 뜯어보면 다음 같은 경우가 흔하다.

```
21회 등장: 문서 링크에 권한 없어서 [NAME]님한테 다시 요청했어요.
19회 등장: 금요일까지 [NAME]님 계정 권한 정리해둘게요.
15회 등장: [NAME]님, QA 픽스 반영됐는지 한 번만 봐주세요.
...
```

NAME 슬롯만 바꾼 같은 템플릿이 21 번까지 살아남는다. 의미 dedup 을 거친 결과인데도 그렇다. 왜 그럴까.

## 임베딩 dedup 은 의미가 같은 걸 묶는다

먼저 의미 dedup 의 동작 원리를 짚자. 보통 두 단계로 구성된다.

1. **임베딩 모델 (예: SBERT)** 이 문장을 768 차원 벡터로 변환. 의미가 비슷한 문장은 벡터 공간에서 가까이 위치하도록 학습돼 있다.
2. **k-means 같은 클러스터링** 이 가까운 벡터끼리 묶고, 각 cluster 에서 keep ratio 만큼 sample 을 남긴다.

여기서 "의미" 판단은 SBERT 가 다 한다. k-means 는 단순히 가까운 점들을 묶는 알고리즘이라 입력이 의미를 담은 벡터든 랜덤이든 똑같이 동작한다.

문제는 슬롯 합성 데이터의 특성에 있다. 다음 세 문장을 보자.

```
"홍길동님께 이체했습니다"
"김철수님께 이체했습니다"
"이수진님께 이체했습니다"
```

SBERT 입장에서 이 셋은 거의 같은 의미다. "[사람 이름] + 께 + 이체" 라는 동일 의미 구조에 슬롯만 다르다. 임베딩 벡터의 cosine 유사도가 0.95 이상으로 매우 가깝다. → 같은 cluster 로 묶임 → stratified keep 50% 라면 절반이 살아남는다 → 같은 템플릿이 여전히 다수.

![의미 dedup vs 표면 dedup — 같은 데이터에 다른 결과](/images/dedup_semantic_vs_surface.png)

위 그림이 그 상황을 단순화한 것이다. 한 cluster 안에 10 개 슬롯 변형이 빽빽이 모여 있을 때, 의미 dedup 은 그 안에서 5 개를 keep 하지만 5 개가 여전히 같은 템플릿이다. 표면 dedup 은 cluster 안의 표면 형태를 보고 대표 1 개만 keep 한다.

## 의미 ≠ 표면 — 두 종류의 중복

데이터 dedup 에선 두 종류의 중복을 구분해야 한다.

**의미 중복** — 표현은 다른데 같은 뜻을 가진 문장
```
"내일까지 보고서 보내드릴게요."
"리포트는 내일 안으로 전달드리겠습니다."
```
→ 표면(단어 시퀀스)이 다르지만 의미는 거의 동일. 임베딩 공간에서 가깝게 모임. 임베딩 dedup 이 잡는 영역.

**표면 중복** — 표면이 거의 같고 의미도 같은 문장
```
"홍길동님께 이체완료"
"김철수님께 이체완료"
"이수진님께 이체완료"
```
→ 단어 단 한두 개만 다른 near-duplicate. 임베딩 거리는 매우 가깝지만, 임베딩 dedup 의 keep ratio 50 % 같은 설정에선 다수가 살아남는다.

데이터 origin 에 따라 어느 쪽 중복이 지배적인지 다르다.

- **사람·여러 LLM 이 자유 작성한 데이터** — 의미 중복이 지배적. 표현은 다양한데 같은 얘기를 반복. 임베딩 dedup 효과가 큼.
- **슬롯 injection 합성 데이터** — 표면 중복이 지배적. 같은 템플릿에 슬롯만 바꿔 대량 생성한 결과. 표면 dedup 이 필요.

이 둘을 구분하지 않고 같은 도구로 처리하면 한쪽에선 부족한 결과가 나온다.

## 표면 dedup 도구들

표면 dedup 에는 여러 도구가 있다. 데이터 규모와 정밀도 요구에 따라 고르면 된다.

**스켈레톤 해시** — 가장 단순. entity 값을 placeholder 로 치환한 후 해시. 같은 해시면 같은 템플릿.
```python
def skeleton(text, entities):
    t = text
    for e in entities:
        t = t.replace(e["text"], f"[{e['type']}]")
    return hashlib.md5(t.encode()).hexdigest()
```
슬롯 합성 데이터엔 가장 잘 맞는다. 정확하고 빠름.

**n-gram Jaccard / overlap** — 두 문장의 단어 n-gram 집합 겹침 비율로 판단. 임계값 (예: 0.8) 이상이면 중복으로 본다. 슬롯이 살짝 다른 near-duplicate 도 잡힘.

**MinHash / SimHash** — 대규모 데이터 (수억 ~ 수십억 문서) 에서 O(N) 으로 표면 dedup 하는 표준 알고리즘. Broder (1997) 가 제안. 최근 LLM pre-training 코퍼스 (RefinedWeb, DCLM 등) 정제 표준.

세 가지 모두 임베딩 dedup 과 보완 관계다. 어느 하나가 다른 걸 대체하지 못한다.

## 권장 — 데이터 origin 별 dedup 조합

| 데이터 origin | 권장 dedup |
|---|---|
| 슬롯 injection 합성 데이터 | **표면 dedup 먼저 (스켈레톤 해시)** → 의미 dedup 보조 |
| 사람 작성, 여러 LLM 생성 등 다양성 큰 데이터 | **의미 dedup (임베딩 + 클러스터링)** 위주 |
| 대규모 corpus (수억 문서+) | **MinHash / SimHash** 로 표면 → 임베딩 dedup 보조 |
| 모든 경우 공통 | dedup 전에 **품질 필터** 먼저. 노이즈가 다양성 cluster 의 "특이 sample" 로 둔갑하지 않도록. |

핵심: dedup 은 **데이터의 어떤 종류의 중복이 지배적인지**를 먼저 보고 도구를 골라야 한다. 임베딩이 강력해도 표면 중복 앞에선 절반의 효과만 낸다.

## 정리

- 임베딩 기반 의미 dedup 은 같은 cluster 로 묶은 뒤 keep ratio 만큼 남기는 방식이라, 슬롯 합성처럼 한 cluster 에 표면 near-duplicate 가 수십 개씩 들어있는 경우 다수가 살아남는다.
- 의미 중복 (표현 다르고 의미 같음) 과 표면 중복 (표면이 거의 같음) 은 다른 종류의 중복이고, 다른 도구가 필요하다.
- 슬롯 injection 합성 데이터엔 **표면 dedup 먼저 + 의미 dedup 보조** 가 적절하다.
- "dedup 을 했다" 가 "중복이 다 빠졌다" 를 보장하지 않는다. 산출물을 한 번 뜯어보고 어떤 중복이 살아남았는지 확인해야 한다.

---

## 참고

- Sorscher, B., Geirhos, R., Shekhar, S., Ganguli, S., Morcos, A. S. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning*. NeurIPS. — data pruning 의 이론적 기반. [별도 글](/posts/data-pruning-scaling-laws/) 참고.
- Lee, K., Ippolito, D., Nystrom, A., et al. (2021). *Deduplicating Training Data Makes Language Models Better*. ACL. — 학습 데이터 dedup 의 효과를 정량적으로 보임.
- Broder, A. Z. (1997). *On the resemblance and containment of documents*. Sequences. — MinHash 의 원전.
- Reimers, N., Gurevych, I. (2019). *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks*. EMNLP. — 의미 dedup 의 핵심 도구.
- Penedo, G., Malartic, Q., Hesslow, D., et al. (2023). *The RefinedWeb Dataset for Falcon LLM*. NeurIPS. — 대규모 corpus 에 MinHash 적용 사례.
