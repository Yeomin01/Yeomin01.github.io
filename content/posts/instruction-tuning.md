---
title: "지시문으로 학습시키면 안 배운 일도 한다 — Instruction Tuning"
date: 2026-05-27
draft: false
tags: ["논문리뷰", "LLM", "파인튜닝", "instruction-tuning"]
summary: "라벨만 있는 데이터로 지도학습하는 대신, '무엇을 하라'는 지시문 형태로 학습시키면 학습하지 않은 task 에도 일반화한다. instruction tuning 의 배경 논문(FLAN, InstructGPT)과, 같은 데이터를 어떤 형식으로 학습시킬지에 대한 선택을 정리한다."
---

## 같은 데이터, 두 가지 학습 방식

entity 추출 같은 task 를 LLM 으로 학습시킬 때, 같은 데이터를 두 방식으로 구성할 수 있다.

1. 지도학습(supervised) 형식 — 입력 텍스트와 정답 라벨 쌍을 그대로 학습
2. instruction 형식 — "다음 텍스트에서 X 를 찾아 JSON 으로 반환하라" 는 지시문 + 입력 + 정답

둘 다 같은 데이터를 쓰지만, 후자는 모델에게 "지시를 따르는 방법" 자체를 학습시킨다. 이 차이가 일반화에 영향을 준다.

## FLAN: 지시문 학습이 zero-shot 일반화를 만든다

Wei et al. (2021), *Finetuned Language Models Are Zero-Shot Learners* (FLAN) 의 핵심 결과는 다음과 같다.

- 여러 task 를 instruction 형식으로 바꿔 함께 학습시킨다.
- 그러면 학습에 포함되지 않은 새로운 task 에 대해서도 zero-shot 성능이 오른다.

모델이 개별 task 를 외우는 것이 아니라, "지시문을 읽고 그에 맞게 응답하는 패턴" 을 학습하기 때문이다. 지시 형식에 익숙해진 모델은 처음 보는 지시도 비슷하게 처리한다.

## InstructGPT: 지시를 따르게 만드는 정렬

Ouyang et al. (2022), *Training language models to follow instructions with human feedback* (InstructGPT) 는 한 단계 더 나아간다.

- supervised fine-tuning 으로 지시 따르기를 학습시킨 뒤,
- 사람 선호 데이터로 RLHF(Reinforcement Learning from Human Feedback)를 적용해 응답을 정렬한다.

여기서 중요한 관찰은, 1.3B InstructGPT 가 175B GPT-3 보다 사람 평가에서 선호됐다는 점이다. 모델 크기보다 "지시를 따르도록 학습됐는지" 가 실제 유용성에 더 크게 작용할 수 있다는 의미다.

## 형식 선택 시 고려한 점

instruction 형식으로 학습시킬 때 결정해야 하는 것들이 있다.

- system prompt 에 task 를 어떻게 기술할 것인가 (찾을 대상, 출력 형식, 제약)
- 출력 스키마 (예: JSON 구조)를 고정할 것인가
- 판단 근거(reason) 같은 부가 필드를 함께 학습시킬 것인가

instruction 형식의 장점은 일반화지만, 전제가 있다. 학습 때 사용한 지시문과 추론 때 사용하는 지시문이 일치해야 한다. 형식이 어긋나면 모델이 학습한 패턴과 다른 입력을 받게 되어 성능이 떨어진다. 그래서 지시문은 코드 상수가 아니라 학습된 입력 분포의 일부로 다루는 편이 안전하다.

## 정리

- instruction tuning 은 라벨만 학습하는 대신 "지시를 따르는 방법" 을 학습시킨다. 그 결과 학습하지 않은 task 에도 일반화한다 (FLAN).
- 지시 따르기 정렬은 모델 크기를 넘어서는 효과를 낼 수 있다. 작은 InstructGPT 가 큰 GPT-3 보다 선호된 사례가 있다 (InstructGPT).
- instruction 형식을 쓸 때는 학습·추론 지시문을 일치시켜야 한다. 지시문 자체가 학습 분포의 일부이기 때문이다.

---

### 참고 문헌

- Wei, J. et al. (2021). *Finetuned Language Models Are Zero-Shot Learners.* arXiv:2109.01652. (FLAN)
- Ouyang, L. et al. (2022). *Training language models to follow instructions with human feedback.* arXiv:2203.02155. (InstructGPT)
