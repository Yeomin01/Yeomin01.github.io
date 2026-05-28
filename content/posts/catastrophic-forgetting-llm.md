---
title: "LLM 을 이어서 파인튜닝했더니 예전 걸 까먹었다 — Catastrophic Forgetting 논문 리뷰"
date: 2026-05-28
draft: false
tags: ["논문리뷰", "LLM", "파인튜닝", "continual-learning", "catastrophic-forgetting"]
summary: "데이터를 나눠 순차적으로 파인튜닝했더니, 새 걸 배우면서 이전에 잘하던 게 무너졌다. 이 현상이 catastrophic forgetting 이고, 1989년부터 연구된 오래된 문제다. 논문들이 뭐라 하는지, 그리고 실전에서 어떻게 완화했는지 정리한다."
---

## 발단: 이어서 학습했더니 점수가 떨어졌다

LLM 을 LoRA 로 파인튜닝하는 중이었다. 데이터를 한 번에 다 넣지 않고, 어댑터를 이어받아 **단계적으로 누적 학습**하는 방식을 썼다.

> 1단계 데이터로 학습 → 2단계 데이터 추가 학습 → 3단계 추가 → ...

그런데 단계가 올라갈수록, **이전 단계에서 잘 잡던 종류의 출력이 점점 무너졌다.** 새로 추가한 데이터의 task 는 좋아지는데, 처음에 잘하던 task 의 점수가 눈에 띄게 떨어졌다.

데이터가 잘못된 것도, 학습률이 이상한 것도 아니었다. 이건 이름이 있는 현상이었다 — **catastrophic forgetting (파국적 망각)**.

## 1989년부터 알려진 문제

catastrophic forgetting 은 신경망의 고질적인 문제로, 1989년 McCloskey & Cohen 의 "Catastrophic Interference in Connectionist Networks" 에서 처음 정식화됐다.

핵심 메커니즘은 단순하다:

- 신경망은 task A 를 학습하며 가중치를 A 에 맞게 조정한다
- 그 위에 task B 를 학습하면, **B 에 유리한 방향으로 가중치를 덮어쓴다**
- A 에 중요했던 가중치가 B 학습 중 망가지면 → A 성능 붕괴

사람은 자전거를 배운 뒤 수영을 배워도 자전거를 안 까먹는데, 신경망은 **새 task 의 gradient 가 옛 task 의 흔적을 그냥 밀어버린다.** 이게 "interference(간섭)" 다.

## LLM 도 예외가 아니다 — 오히려 클수록 심하다

"요즘 LLM 은 거대하니까 괜찮지 않나?" 싶었는데, 정반대였다.

Luo et al. (2023), *"An Empirical Study of Catastrophic Forgetting in LLMs During Continual Fine-tuning"* 가 1B~7B 모델에서 continual instruction tuning 을 실험했는데:

- **catastrophic forgetting 은 1B~7B 전 구간에서 일반적으로 관찰됐다**
- **모델이 클수록 forgetting 이 더 심해졌다** (직관과 반대)
- domain knowledge / reasoning / reading comprehension 전 영역에서 망각 발생
- 다만 **general instruction tuning 을 먼저 거치면** 이후 파인튜닝의 망각이 완화됐다

내가 겪은 게 딱 이거였다. 모델이 7B 라서 "용량 충분하겠지" 했지만, 누적 파인튜닝에서 이전 task 가 무너지는 건 모델 크기와 무관하게 일어났다.

## 해결책은 크게 두 갈래

논문들이 제시하는 완화법은 보통 두 진영으로 나뉜다.

### 1. 정규화 — EWC (Elastic Weight Consolidation)

Kirkpatrick et al. (2017, PNAS) 의 EWC 는 **"중요한 가중치는 건드리지 마"** 전략이다.

- task A 학습 후, 각 가중치가 A 에 얼마나 중요한지를 **Fisher information** 으로 추정한다
- task B 를 학습할 때, **중요한 가중치일수록 변화에 페널티**를 준다 (loss 에 regularization term 추가)
- 결과적으로 A 에 critical 한 파라미터는 보존하면서 B 를 배운다

장점: 과거 데이터를 저장 안 해도 된다 (파라미터 스냅샷 + 중요도 벡터만).
단점: Fisher 추정에 추가 연산이 들고, diagonal 근사라 **표현이 크게 바뀌어야 하는 task** 에선 한계가 있다.

### 2. Rehearsal / Replay — 옛 데이터를 섞어서 복습시킨다

Rolnick et al. (2018) 의 Experience Replay, Rebuffi et al. (2017) 의 iCaRL 계열은 더 실용적이다.

- 과거 데이터의 **일부를 buffer 에 보관**한다
- 새 데이터를 학습할 때 **옛 데이터를 일정 비율 섞어서** 같이 학습한다
- 강화학습의 experience replay 와 같은 아이디어 — 옛 분포를 계속 "복습"시켜 잊지 않게 한다

장점: 구현이 단순하고 효과가 직접적이다.
단점: 과거 데이터를 저장해야 한다 (메모리·프라이버시 이슈), 섞는 비율을 잘못 잡으면 sampling bias.

## 실전에서 내가 쓴 것: Rehearsal

EWC 의 Fisher 추정은 LoRA 파인튜닝 파이프라인에 끼워넣기 번거로웠다. 그래서 **rehearsal** 을 택했다.

새 데이터를 추가 학습할 때, **이전에 잘하던 task 의 데이터를 일정 비율 섞었다.** 비유하자면:

```
새 학습 배치 = 새로 강화할 데이터 (70~80%)
             + 잊으면 안 되는 옛 task 데이터 (20~30%)
```

이렇게 하니 새 task 를 배우면서도 옛 task 의 분포를 계속 "복습"해서, 점수 회귀가 눈에 띄게 줄었다. Luo et al. 이 말한 "general 데이터를 섞으면 망각이 완화된다" 와 같은 맥락이다.

## 정리

- **catastrophic forgetting 은 신경망의 1989년부터의 고질병**이고, LLM 도 예외가 아니다 — **오히려 클수록 심해진다** (Luo et al. 2023).
- 데이터를 나눠 순차 파인튜닝하면 거의 반드시 겪는다. "모델이 크니까 괜찮겠지" 는 틀린 직관.
- 완화법은 **정규화(EWC)** vs **rehearsal(replay)** 두 갈래. EWC 는 데이터 저장 불가할 때, rehearsal 은 데이터 저장 가능하고 구현 단순함을 원할 때.
- 실전에선 **옛 데이터를 일정 비율 섞는 rehearsal** 이 가장 손쉬운 첫 수다.

> 교훈: "이어서 학습"은 공짜가 아니다. 새 걸 배우는 만큼 옛 걸 까먹을 각오를 하고, 처음부터 복습(rehearsal)을 설계에 넣자.

---

### 참고 문헌

- McCloskey, M., & Cohen, N. J. (1989). *Catastrophic Interference in Connectionist Networks: The Sequential Learning Problem.*
- Kirkpatrick, J. et al. (2017). *Overcoming catastrophic forgetting in neural networks.* PNAS.
- Rebuffi, S. et al. (2017). *iCaRL: Incremental Classifier and Representation Learning.* CVPR.
- Rolnick, D. et al. (2018). *Experience Replay for Continual Learning.* NeurIPS.
- Luo, Y. et al. (2023). *An Empirical Study of Catastrophic Forgetting in Large Language Models During Continual Fine-tuning.* arXiv:2308.08747.
