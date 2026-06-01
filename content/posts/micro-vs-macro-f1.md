---
title: "micro F1과 macro F1 — 어떤 걸 보느냐가 결정을 바꾼다"
date: 2026-06-01
draft: false
tags: ["LLM", "평가", "metric", "F1", "NER", "classification"]
categories: ["학습 이론"]
summary: "분류 결과를 평가할 때 F1 점수가 자주 등장하지만, 클래스가 여러 개인 멀티클래스 문제에서는 'F1 하나'로 끝나지 않는다. 여러 클래스의 F1을 합치는 두 방법(micro · macro)이 무엇이고, 한쪽만 봤을 때 약점 클래스가 어떻게 가려지는지를 정리한다."
---

분류 결과를 평가할 때 F1 점수는 거의 항상 등장한다. 그런데 클래스가 여러 개인 멀티클래스 / 멀티라벨 문제에서는 "F1 하나"로 끝나지 않고, **여러 클래스의 F1을 어떻게 합치느냐**부터가 결정에 영향을 준다. 이 글은 micro F1과 macro F1의 차이와, 어떤 상황에서 어느 쪽을 봐야 하는지를 정리한다.

## 두 가지 평균 방식

3개 클래스(A, B, C)를 분류한다고 하자. 각 클래스마다 TP / FP / FN을 따로 셀 수 있다.

**micro F1** — 모든 클래스의 TP, FP, FN을 하나로 합쳐서 그 위에서 precision · recall · F1을 계산한다.

```
TP_micro = TP_A + TP_B + TP_C
FP_micro = FP_A + FP_B + FP_C
FN_micro = FN_A + FN_B + FN_C
precision = TP_micro / (TP_micro + FP_micro)
recall    = TP_micro / (TP_micro + FN_micro)
F1_micro  = 2·p·r / (p+r)
```

**macro F1** — 클래스별로 F1을 따로 계산한 뒤 단순 평균한다.

```
F1_macro = (F1_A + F1_B + F1_C) / 3
```

겉보기엔 둘 다 "전체 F1"인데, **각 클래스에 부여하는 가중치가 다르다.**

## 무게중심의 차이

- **micro**: 샘플 하나를 1로 본다. 어떤 클래스의 샘플이 1,000개고 다른 클래스가 200개면, 큰 쪽이 5배 영향력을 갖는다.
- **macro**: 클래스를 1로 본다. 샘플 1,000개짜리 클래스든 200개짜리 클래스든, 평균에서 차지하는 비중은 똑같다.

이게 왜 중요한지 구체적 예로 보자.

| 클래스 | support | per-class F1 |
|---|---|---|
| A | 1,000 | 0.97 |
| B | 600 | 0.95 |
| C | 200 | 0.86 |

micro와 macro를 같이 계산해 보면:

- micro F1 ≈ **0.95** (샘플 많은 A, B가 끌어올림)
- macro F1 = (0.97 + 0.95 + 0.86) / 3 ≈ **0.93**

차이는 0.02 정도지만, "이 모델 0.95"라고만 보고하면 **C가 0.86인 사실은 micro만으로는 안 보인다.** 만약 C가 비즈니스적으로 가장 중요한 카테고리거나, 모델이 가장 못하는 약점 클래스라면 micro만 보고 결정하는 순간 그 약점이 가려진다.

![micro 와 macro 가 서로 다른 모델을 가리키는 상황](/images/micro_vs_macro_decision.png)

위 예시처럼 한쪽 지표만 보면 두 모델 중 누가 더 나은지가 뒤집힐 수 있다. micro 만 보면 Model X 가 우위지만, 약점 클래스 C 의 격차(0.85 vs 0.91)가 비즈니스적으로 더 중요하다면 macro 가 가리키는 Model Y 가 옳은 선택이 된다.

## 언제 어느 쪽을 보나

**micro F1이 적합한 경우**
- 클래스가 비슷한 비중으로 분포해 있을 때.
- 오류 하나의 비용이 클래스에 상관없이 같을 때(샘플 단위 평가가 자연스러움).
- NER 표준 벤치마크(CoNLL 등)처럼 관행적으로 micro를 쓰는 도메인.

**macro F1이 적합한 경우**
- 클래스 분포가 불균형하고, 소수 클래스의 성능도 동등하게 평가하고 싶을 때.
- 약점 클래스가 전체 점수에 묻히는 걸 막고 싶을 때.
- "모델이 *모든* 클래스를 골고루 잘하느냐"를 보고 싶을 때.

**weighted F1**(클래스별 F1을 그 클래스의 support로 가중평균)도 있다. macro의 평균을 support 비례로 가중한 것이라, 보통 micro와 비슷한 값이 나온다. 실무에서는 micro와 macro 둘만 보는 게 흔하다.

## 함정 — 한쪽만 보고 결정하면

실제 사례로 흔히 나오는 패턴:

- 새로 학습한 모델 X: micro 0.92, 약점 클래스 F1 0.85
- 비교 모델 Y: micro 0.91, 약점 클래스 F1 0.88

micro만 보면 X가 우세하지만, 약점 클래스가 비즈니스적으로 가장 중요한 카테고리라면 Y가 더 나은 선택일 수 있다. **micro가 0.01 더 높다는 사실이 약점 클래스의 0.03 격차를 상쇄하지 못한다**고 판단할 수 있다.

반대로 macro만 보면, 모든 클래스가 균등하게 중요한 게 아닐 때 잘못된 우선순위가 매겨질 수 있다. 운영상 거의 등장하지 않는 소수 클래스의 F1 변동에 결정이 흔들리는 식이다.

## 실무 권고

지표 하나로 끝내지 않는다. 보통 다음을 같이 본다.

- **micro F1** — 관행적 헤드라인. 다른 모델·벤치마크와의 비교 기준.
- **macro F1** — 클래스 간 균형 확인. micro와 큰 격차가 보이면 클래스 불균형 / 약점 클래스 문제를 의심.
- **per-class F1** — 어떤 클래스에서 강하고 약한지의 진짜 정보가 여기 다 있다. 의사결정 단계에서는 보통 이게 결정적이다.

여러 모델을 비교하는 표를 만들 때도, 한 열에 micro만 두지 말고 **per-class 컬럼을 같이 두는 게** 사후에 "이 선택이 왜 이게 됐는지"를 다시 추적할 수 있게 해준다.

## 정리

- micro F1은 샘플 단위로 평균하고, macro F1은 클래스 단위로 평균한다.
- 클래스 분포가 치우쳤거나 약점 클래스가 중요할 때, micro는 그 약점을 가린다.
- "이 모델이 더 낫다"를 micro 한 숫자로만 판단하지 말고, **per-class F1까지 같이 보는 습관**이 한 번 잘못 고른 모델을 막아준다.

---

## 참고

- Sokolova, M., & Lapalme, G. (2009). *A systematic analysis of performance measures for classification tasks*. Information Processing & Management, 45(4), 427–437. — micro/macro 를 포함한 분류 지표를 체계적으로 비교한 표준 참고문.
- Tjong Kim Sang, E. F., & De Meulder, F. (2003). *Introduction to the CoNLL-2003 Shared Task: Language-Independent Named Entity Recognition*. — NER 에서 micro F1 을 표준 헤드라인으로 쓰는 관행의 출처.
- scikit-learn 문서, [`sklearn.metrics.f1_score`](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html) — `average` 파라미터(`micro`, `macro`, `weighted`)의 정의와 동작.
