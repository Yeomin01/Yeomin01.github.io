---
title: "LLM 을 이어서 파인튜닝하면 이전 능력이 떨어진다 — Catastrophic Forgetting"
date: 2026-05-26
draft: false
tags: ["논문리뷰", "LLM", "파인튜닝", "continual-learning", "catastrophic-forgetting"]
summary: "데이터를 나눠 순차적으로 파인튜닝하면 새 task 를 배우는 동안 이전 task 성능이 떨어진다. catastrophic forgetting 이라 부르는 오래된 문제다. 관련 논문과 완화 기법(EWC, rehearsal)을 정리한다."
---

## 순차 파인튜닝에서 관찰한 현상

LLM 을 LoRA 로 파인튜닝할 때, 데이터를 한 번에 넣지 않고 어댑터를 이어받아 단계적으로 누적 학습하는 방식을 썼다.

```
1단계 데이터 학습 → 2단계 추가 학습 → 3단계 추가 → ...
```

단계가 올라갈수록 새로 추가한 데이터의 task 성능은 개선됐지만, 이전 단계에서 잘 처리하던 종류의 출력이 점차 떨어졌다. 데이터나 학습률의 문제가 아니라, 알려진 현상이었다. catastrophic forgetting 이다.

## 1989년부터 정의된 문제

catastrophic forgetting 은 신경망의 오래된 한계로, McCloskey & Cohen (1989) 의 *Catastrophic Interference in Connectionist Networks* 에서 처음 정식화됐다.

메커니즘은 다음과 같다.

- 신경망은 task A 를 학습하며 가중치를 A 에 맞게 조정한다.
- 그 위에 task B 를 학습하면 B 에 유리한 방향으로 가중치를 덮어쓴다.
- A 에 중요했던 가중치가 B 학습 과정에서 바뀌면 A 성능이 떨어진다.

새 task 의 gradient 가 이전 task 가 의존하던 파라미터를 갱신하면서 생기는 간섭(interference)이다.

## LLM 에서의 양상

모델이 크면 용량이 충분해 덜할 것으로 예상할 수 있으나, 보고된 결과는 다르다.

Luo et al. (2023), *An Empirical Study of Catastrophic Forgetting in LLMs During Continual Fine-tuning* 는 1B~7B 모델의 continual instruction tuning 을 실험했다.

- catastrophic forgetting 은 1B~7B 전 구간에서 일반적으로 관찰됐다.
- 모델 규모가 커질수록 forgetting 이 더 심해지는 경향이 있었다.
- domain knowledge, reasoning, reading comprehension 전 영역에서 망각이 나타났다.
- general instruction tuning 을 먼저 거친 모델은 이후 파인튜닝에서 망각이 완화됐다.

7B 모델에서 누적 파인튜닝 시 이전 task 가 떨어지는 것도 같은 맥락으로 보인다. 모델 크기가 forgetting 을 막아주지는 않았다.

## 완화 기법 두 갈래

### 1. 정규화 — EWC (Elastic Weight Consolidation)

Kirkpatrick et al. (2017, PNAS) 의 EWC 는 중요한 가중치의 변화를 억제하는 방식이다.

- task A 학습 후, 각 가중치가 A 에 얼마나 중요한지를 Fisher information 으로 추정한다.
- task B 학습 시, 중요한 가중치일수록 변화에 페널티를 부여한다(loss 에 regularization term 추가).
- A 에 중요한 파라미터를 보존하면서 B 를 학습한다.

과거 데이터를 저장할 필요가 없다는 장점이 있다. 다만 Fisher 추정에 추가 연산이 들고, diagonal 근사를 쓰기 때문에 표현이 크게 바뀌어야 하는 task 에서는 한계가 있다.

### 2. Rehearsal / Replay — 과거 데이터를 섞어 복습

Rolnick et al. (2018) 의 Experience Replay, Rebuffi et al. (2017) 의 iCaRL 계열이 대표적이다.

- 과거 데이터의 일부를 buffer 에 보관한다.
- 새 데이터를 학습할 때 과거 데이터를 일정 비율 섞어 함께 학습한다.
- 강화학습의 experience replay 와 같은 발상으로, 이전 분포를 계속 노출시켜 망각을 줄인다.

구현이 단순하고 효과가 직접적이다. 다만 과거 데이터를 저장해야 하므로 메모리·프라이버시 제약이 있고, 섞는 비율을 잘못 잡으면 sampling bias 가 생긴다.

## 적용: rehearsal

EWC 의 Fisher 추정은 LoRA 파인튜닝 파이프라인에 통합하기 번거로워, rehearsal 을 택했다.

새 데이터를 추가 학습할 때 이전 task 의 데이터를 일정 비율 함께 넣었다.

```
학습 배치 = 새로 강화할 데이터 (70~80%)
          + 유지해야 할 이전 task 데이터 (20~30%)
```

이전 분포를 계속 노출시키면서 학습한 결과, 이전 task 의 성능 하락이 줄었다. Luo et al. 이 보고한 "general 데이터를 섞으면 망각이 완화된다" 와 같은 방향이다.

## 정리

- catastrophic forgetting 은 신경망의 오래된 한계이며 LLM 도 예외가 아니다. 규모가 커진다고 사라지지 않으며, 보고에 따르면 오히려 심해지는 경향이 있다.
- 데이터를 나눠 순차 파인튜닝하면 대부분 겪는다.
- 완화 기법은 정규화(EWC)와 rehearsal(replay)로 나뉜다. 과거 데이터를 저장할 수 없으면 EWC, 저장 가능하고 구현이 단순한 쪽을 원하면 rehearsal 이 적합하다.
- 순차 학습을 설계할 때 rehearsal 을 처음부터 포함해두면 성능 회귀를 줄일 수 있다.

---

### 참고 문헌

- McCloskey, M., & Cohen, N. J. (1989). *Catastrophic Interference in Connectionist Networks: The Sequential Learning Problem.*
- Kirkpatrick, J. et al. (2017). *Overcoming catastrophic forgetting in neural networks.* PNAS.
- Rebuffi, S. et al. (2017). *iCaRL: Incremental Classifier and Representation Learning.* CVPR.
- Rolnick, D. et al. (2018). *Experience Replay for Continual Learning.* NeurIPS.
- Luo, Y. et al. (2023). *An Empirical Study of Catastrophic Forgetting in Large Language Models During Continual Fine-tuning.* arXiv:2308.08747.
