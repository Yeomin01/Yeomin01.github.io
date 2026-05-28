---
title: "대규모 합성 데이터를 선별하는 3단계 파이프라인 — 기법 비교와 설계"
date: 2026-05-28
draft: false
tags: ["데이터선별", "data-selection", "합성데이터", "data-pruning", "효율"]
categories: ["데이터"]
summary: "합성 데이터를 대량으로 만들면 중복·노이즈·분포 편향이 따라온다. 데이터 선별 기법(Sorscher, DEITA, Confident Learning 등)을 비교하고, 합성 데이터의 특성에 맞춘 3단계 선별 파이프라인을 설계한다. 아직 검증 전인 설계안이며, 테스트 후 결과를 추가할 예정이다."
---

> 상태: 설계 단계. 아래 파이프라인은 아직 실험으로 검증하지 않았다. 테스트 후 결과를 이 글에 추가한다.

## 배경: 합성 데이터의 세 가지 문제

LLM 으로 합성 데이터를 대량 생성하면 양은 쉽게 확보되지만, 세 가지 문제가 따라온다.

1. **중복·전형성** — 템플릿이나 슬롯을 재사용하면 구조가 비슷한 문장이 과도하게 많아진다. 양은 많지만 정보량은 그만큼 늘지 않는다.
2. **라벨 노이즈** — 생성 모델이 만든 라벨에는 경계 오류, 조사 처리 오류, 오라벨이 섞인다.
3. **분포 편향** — 특정 카테고리나 도메인이 과대/과소 대표된다.

데이터를 더 만드는 것으로는 이 문제들이 해결되지 않는다. [data pruning 논문](/posts/data-pruning-scaling-laws/) 에서 봤듯, 양을 늘리는 power law 전략은 비효율적이다. 필요한 것은 선별이다.

## 데이터 선별 기법 비교

| 기법 | 핵심 아이디어 | 라벨 필요 | 비용 | 다루는 문제 |
|---|---|---|---|---|
| Sorscher 2022 (data pruning) | embedding cluster 중심거리로 난이도 측정. 데이터가 많으면 hard example 우선 | X | 낮음 | 중복·전형성 |
| DEITA (ICLR 2024) | complexity × quality + diversity 결합. 소량으로 SOTA | LLM judge | 중간 | 품질·다양성 |
| AlpaGasus / IFD / INSTAG | LLM 으로 품질 점수, instruction 난이도, 태깅 다양성 | LLM judge | 중간~높음 | 품질·다양성 |
| Confident Learning (Cleanlab) | 모델 예측 확률로 라벨 오류 탐지 (NER/token 지원) | 모델 예측 | 낮음 | 노이즈 |

선별 연구의 공통 합의는 "좋은 데이터셋 = 품질(quality) × 다양성(diversity) × 적정 난이도(complexity)" 다. DEITA 가 이 셋을 결합해 적은 데이터로 큰 데이터셋에 준하는 성능을 보였다.

## 합성 데이터에 그대로 적용하기 어려운 이유

위 기법들은 대체로 "라벨이 깨끗하다" 를 전제한다. 그러나 합성 데이터는 노이즈가 섞여 있어, 노이즈를 먼저 걸러내지 않으면 문제가 생긴다.

- 난이도 기반 선별(hard example 우선)을 노이즈 제거 없이 적용하면, **오라벨이 "어려운 example" 로 분류돼 살아남는다.** 노이즈가 오히려 강조되는 역효과다.
- 다양성 기반 선별도 노이즈가 "특이한 example" 로 보여 선택될 수 있다.

따라서 합성 데이터에서는 **노이즈 제거가 선별보다 먼저** 와야 한다.

## 설계: 3단계 선별 파이프라인

세 가지 문제(노이즈·중복·편향)를 순서대로 다룬다.

```
1단계 품질 필터 (quality)     — 라벨 노이즈 제거
   ↓
2단계 다양성 선별 (diversity)  — 중복·전형 제거
   ↓
3단계 분포 보정 (importance)   — 약한 카테고리·도메인 비중 조정
```

### 1단계: 품질 필터 (노이즈 제거)

가장 먼저 명백한 라벨 오류를 제거한다.

- 규칙 기반 검증: 라벨 경계가 텍스트와 일치하는지, 조사가 잘못 포함됐는지, 형식 제약을 지키는지.
- Confident Learning: 모델 예측 확률과 라벨이 크게 어긋나는 example 을 오류 후보로 표시.
- 필요 시 LLM judge 로 모호한 경우만 추가 검수.

규칙으로 걸러지는 것을 먼저 제거하면, 비싼 LLM 검수 대상을 줄일 수 있다.

### 2단계: 다양성 선별 (중복 제거)

합성 데이터의 비효율 대부분이 여기서 나온다. Sorscher 방식의 self-supervised 선별을 쓴다.

- 모든 example 을 embedding 으로 변환한다.
- embedding 공간에서 clustering 하고, 각 example 의 cluster 중심까지 거리를 잰다.
- 중심에 가까운(전형적·중복) example 의 비중을 줄이고, 다양한 example 을 남긴다.
- 데이터가 많은 상황이므로 전형적 example 을 공격적으로 줄여도 된다.

이 단계가 양을 크게 줄이면서도 정보량을 유지하는 핵심이다.

### 3단계: 분포 보정 (약점 가중)

균등 선별이 아니라, 약한 카테고리·도메인의 비중을 의도적으로 높인다.

- 현재 성능이 낮은 카테고리·도메인을 파악한다.
- 해당 영역의 example, 특히 경계가 모호한 어려운 case 의 비율을 높여 선별한다.
- 이미 잘하는 영역은 최소한만 유지한다.

DEITA 의 complexity·quality·diversity 를 우리 상황(노이즈 + 중복 + 약점)에 맞게 재배열한 형태다.

## 검증 계획

설계가 실제로 효과 있는지 확인할 비교 실험을 둔다.

- baseline: 전체 데이터 학습
- 비교군: 3단계 파이프라인으로 선별한 부분집합 학습 (예: 전체의 20~30%)
- 측정: 동일 평가셋에서 성능, 그리고 학습 시간

선별군이 전체군과 비슷하거나 더 나은 성능을 더 짧은 시간에 내는지가 판단 기준이다. 단계별 ablation(품질만 / 품질+다양성 / 전체)으로 각 단계의 기여도 확인한다.

## 정리

- 합성 데이터의 문제는 중복·노이즈·편향 세 가지이며, 양을 늘려서는 해결되지 않는다.
- 기존 선별 기법은 대체로 깨끗한 라벨을 전제하므로, 합성 데이터에는 노이즈 제거를 먼저 둔 파이프라인이 필요하다.
- 설계: 품질 필터 → 다양성 선별 → 분포 보정. DEITA 의 quality·diversity·complexity 를 합성 데이터 특성에 맞게 재구성한 것.
- 아직 검증 전 설계안이다. 비교 실험 결과를 이 글에 추가할 예정이다.

---

### 참고 문헌

- Sorscher, B. et al. (2022). *Beyond neural scaling laws: beating power law scaling via data pruning.* NeurIPS 2022.
- Liu, W. et al. (2024). *What Makes Good Data for Alignment? (DEITA).* ICLR 2024. arXiv:2312.15685.
- Northcutt, C. et al. (2021). *Confident Learning: Estimating Uncertainty in Dataset Labels.* (Cleanlab)
- Wang, J. et al. (2024). *A Survey on Data Selection for LLM Instruction Tuning.* arXiv:2402.05123.
