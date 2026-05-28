---
title: "데이터를 줄여서 더 잘 학습하기 — Beyond Neural Scaling Laws 자세히 읽기"
date: 2026-05-28
draft: false
tags: ["논문리뷰", "데이터선별", "data-pruning", "scaling-law", "효율"]
categories: ["데이터"]
summary: "데이터를 무작정 늘리면 성능은 power law 로, 즉 점점 느리게 오른다. Sorscher et al. (NeurIPS 2022)는 좋은 선별 기준이 있으면 이 한계를 깨고 exponential scaling 에 가까워질 수 있음을 이론과 실험으로 보였다. 100만 건 규모의 데이터를 다 쓰는 대신 효과 큰 부분집합을 고르려는 입장에서, 이 논문을 자세히 정리한다."
---

대규모 합성 데이터를 만들어두고 "이걸 전부 학습시켜야 하나, 일부만 골라도 되나" 를 고민하는 단계에서 읽은 논문이다. 결론부터 말하면, 잘 고른 일부가 전부보다 나을 수 있고, 그 "잘 고름" 에는 원리가 있다.

- 논문: Sorscher, B., Geirhos, R., Shekhar, S., Ganguli, S., Morcos, A. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning.* NeurIPS 2022 (Outstanding Paper Award). arXiv:2206.14486.

## 1. 배경: scaling law 의 한계

신경망의 성능은 데이터·모델·연산을 늘리면 좋아지지만, 그 개선은 **power law** 를 따른다. 오차가 데이터 양 N 에 대해 대략 `error ∝ N^(-α)` 형태로 줄어든다는 것이다.

문제는 이 곡선이 점점 완만해진다는 데 있다. 오차를 절반으로 줄이려면 데이터를 몇 배로 늘려야 하고, 어느 지점부터는 데이터를 크게 늘려도 성능이 거의 안 오른다. 양으로 미는 전략은 비용 대비 효율이 빠르게 나빠진다.

이 논문의 질문은 다음과 같다. **데이터를 더 넣는 대신, 잘 골라서 넣으면 이 power law 자체를 깰 수 있는가.**

## 2. 핵심 주장: 좋은 pruning 기준이 있으면 exponential scaling 이 가능하다

논문의 주장은, 학습 example 을 버리는 순서를 잘 정하는 **data pruning metric** 이 있으면, 성능이 데이터 양에 대해 power law 가 아니라 **exponential 에 가깝게** 개선될 수 있다는 것이다.

즉 데이터를 무작정 늘리는 게 아니라, 가치 순으로 정렬해 덜 중요한 것부터 버리면, 같은 양으로도 훨씬 좋은 성능을 얻을 수 있다. 실제로 ResNet 을 CIFAR-10, SVHN, ImageNet 에서 학습시켜 이 예측을 검증했다.

## 3. 방법: difficulty 로 정렬하고, 통계역학으로 분석

example 마다 **난이도(difficulty)** 를 매겨 정렬한다. 난이도는 보통 "모델이 이 example 을 얼마나 어려워하는가" 로 정의한다(예: teacher margin, 예측 불확실성 등).

논문은 student-teacher 설정에서 **통계역학(statistical mechanics)** 으로 data pruning 을 해석적으로 분석했다. example 을 teacher margin 기준으로 버릴 때, 최적 전략이 초기 데이터 양에 따라 달라진다는 것을 이론적으로 유도하고, exponential scaling 이 가능한 조건을 제시한다.

## 4. 가장 중요한 통찰: 데이터 양에 따라 버릴 것이 달라진다

이 논문에서 가장 실용적인 결론이다.

> 데이터가 **많을 때는 어려운(hard) example 을 남기고**, 데이터가 **적을 때는 쉬운(easy) example 을 남기는** 것이 낫다.

직관적으로 보면,

- 데이터가 적을 때: 모델이 기본 패턴조차 충분히 못 배운 상태다. 이때 어려운 example 만 남기면 학습이 불안정하다. 쉬운(전형적인) example 로 기초를 다지는 게 낫다.
- 데이터가 많을 때: 기본 패턴은 이미 충분히 학습됐다. 쉬운 example 을 더 봐도 새로 배울 게 없다. 이때는 결정 경계 근처의 어려운 example 이 정보량이 크다.

즉 "어려운 데이터가 항상 가치 있다" 가 아니라, **내가 가진 데이터 양에 따라 우선순위가 뒤집힌다.** 대규모 데이터를 다룰수록 hard example 위주로 남기는 것이 유리하다.

![데이터 양에 따라 남길 example 이 뒤집힌다](/images/data_pruning_strategy.png)

(개념 설명용 도식이다. 원문의 실험 그래프와 self-supervised metric 성능은 arXiv:2206.14486 을 참고.)

## 5. 라벨 없이도 가능한 self-supervised pruning

난이도 측정에 라벨이 꼭 필요한 것은 아니다. 논문은 라벨 없는 self-supervised 방식을 제안한다.

- self-supervised 모델의 embedding 공간에서 **k-means clustering** 을 한다.
- 각 example 의 난이도를 **가장 가까운 cluster 중심까지의 거리** 로 정의한다.
- 중심에 가까운 example 이 "전형적인(easy)" 것이고, 먼 example 이 "어려운(hard)" 것이다.

이 self-supervised 기준이, 라벨을 쓰는 최고 성능 supervised 기준(memorization 기반)에 견줄 만한 성능을 — 데이터의 70~80% 를 남기는 구간까지 — 보였다. 라벨링 비용 없이 데이터 선별이 가능하다는 점에서 실용적이다.

## 6. 한계

- difficulty metric 의 품질에 결과가 크게 좌우된다. 좋은 metric 이 없으면 random pruning 보다 나을 게 없다.
- 너무 공격적으로 prune 하면(예: hard example 만 극단적으로 남기면) noise·outlier 까지 남아 오히려 성능이 떨어질 수 있다.
- 주로 vision 분류에서 검증됐다. 텍스트·생성 task 로 옮길 때는 난이도 정의와 효과를 다시 확인해야 한다.

## 7. 우리 상황에 적용

대규모 합성 데이터(슬롯 인젝션으로 만든 수십만~백만 건)를 가진 입장에서 가져갈 점은 다음과 같다.

- **전부 학습은 비효율적일 수 있다.** 합성 데이터는 구조가 반복되어 쉬운(전형적인) example 이 과도하게 많다. 이들은 일정 수준 이상에서는 추가 학습 효과가 작다.
- **데이터가 많은 상황이므로 hard example 위주로 남기는 전략이 맞다.** 전형적인 패턴은 적은 양으로도 학습되고, 경계가 모호한 어려운 case 가 추가 정보량을 갖는다.
- **라벨 없이도 선별할 수 있다.** embedding 공간에서 cluster 중심 거리로 전형성을 측정하면, 중복·전형 example 을 줄이고 다양성·난이도를 확보할 수 있다.
- 다만 합성 데이터는 noise 도 섞이므로, hard 쪽 극단(라벨 오류·비정상 문장)을 따로 걸러야 한다. data pruning 과 품질 필터링은 병행해야 한다.

정리하면, "데이터를 더 만들까" 보다 "지금 가진 데이터에서 무엇을 남길까" 가 먼저다. 데이터가 많을수록 어려운 example 의 비중을 높이는 방향이 이론·실험 양쪽에서 지지된다.

## 8. 한 줄 요약

데이터 양으로 미는 power law 는 비효율적이고, 가치 순으로 선별하면 그 한계를 넘을 수 있다. 핵심 규칙은 "데이터가 많으면 어려운 것을, 적으면 쉬운 것을 남긴다" 이며, 라벨 없이 embedding cluster 거리로도 선별이 가능하다.

---

### 참고 문헌

- Sorscher, B. et al. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning.* NeurIPS 2022 (Outstanding Paper Award). arXiv:2206.14486.
- (관련) Zhou, C. et al. (2023). *LIMA: Less Is More for Alignment.* — 적은 고품질 데이터의 효과.
