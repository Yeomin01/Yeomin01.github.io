---
title: "7B·10B 모델을 16GB GPU 한 장으로 파인튜닝하기 — LoRA / QLoRA"
date: 2026-05-25
draft: false
tags: ["논문리뷰", "LLM", "파인튜닝", "LoRA", "QLoRA", "PEFT"]
categories: ["파인튜닝"]
summary: "수십억 파라미터 모델을 통째로 학습하려면 GPU 메모리부터 막힌다. LoRA 는 저랭크 행렬만 학습하고, QLoRA 는 4-bit 양자화를 더해 이 문제를 줄인다. 두 논문의 핵심과, rank 를 정할 때 고려한 capacity 문제를 정리한다."
---

## 전체 파인튜닝의 메모리 비용

7B 모델을 full fine-tuning 하려면 모델 가중치만 올리는 것으로 끝나지 않는다.

- 모델 가중치: 7B × 2byte(fp16) = 14GB
- gradient: 동일하게 14GB
- optimizer state (Adam): 파라미터당 약 2배 = 28GB+

합치면 60GB를 넘는다. 16GB GPU 한 장으로는 학습을 시작할 수 없다. 이 지점에서 PEFT(Parameter-Efficient Fine-Tuning)가 필요해진다.

## LoRA: 변화량만 저랭크로 학습

Hu et al. (2021), *LoRA: Low-Rank Adaptation of Large Language Models* 의 전제는 다음과 같다. 파인튜닝으로 생기는 가중치 변화 ΔW 는 low-rank 로 근사할 수 있다.

따라서 거대한 가중치 행렬 W 를 통째로 업데이트하는 대신, 변화량 ΔW 를 두 개의 작은 행렬 곱으로 표현한다.

```
W_new = W + ΔW
ΔW = B · A     (B: d×r,  A: r×d,  r ≪ d)
```

![LoRA 저랭크 분해 개념도](/images/lora_decomposition.png)

- 원본 W 는 동결(frozen)한다. 따라서 gradient/optimizer state 가 필요 없다.
- 학습 대상은 A, B 뿐이다. r=16 이면 원본 파라미터의 1% 미만.
- 추론 시 W + BA 로 합치면 추가 연산이 없다.

학습 파라미터가 1% 미만으로 줄면 optimizer state 메모리도 그만큼 줄어, 16GB 안에 들어온다.

## QLoRA: 원본을 4-bit 로 양자화

LoRA 만으로도 원본 가중치 14GB(fp16)는 GPU 에 올려야 한다. 10B 급에서는 다시 빠듯해진다.

Dettmers et al. (2023), *QLoRA: Efficient Finetuning of Quantized LLMs* 는 여기서 한 단계 더 나아간다.

- 원본 가중치를 4-bit(NF4, NormalFloat)로 양자화해 올린다. 메모리는 약 1/4.
- 그 위에 fp16 LoRA 어댑터를 얹어 학습한다.
- double quantization(양자화 상수도 양자화)과 paged optimizer 로 추가로 절약한다.

원본은 4-bit 로 눌러 읽기만 하고, 학습 가능한 부분만 정밀도를 유지하는 구조다. 이 조합으로 단일 GPU 에서 수십억 파라미터 모델의 파인튜닝이 가능해졌다. 논문은 65B 모델을 48GB 한 장에 올린 사례를 제시한다.

7B~10B 모델을 16GB GPU 한 장에서 돌릴 수 있었던 것도 이 4-bit + LoRA 조합 덕분이다.

## rank 와 capacity

LoRA 의 `r`(rank)은 변화량을 얼마나 표현력 있게 근사하는지를 정한다. 작을수록 메모리와 속도에서 유리하지만 표현 용량도 함께 줄어든다.

여러 종류의 출력을 동시에 학습시켜야 하는 경우, r=16 에서는 세 종류를 동시에 잘 맞추기 어려웠다. 한쪽을 강화하면 다른 쪽이 떨어지는 trade-off 가 나타났다.

- r 을 키우면(32, 64) capacity 가 늘어 동시 학습이 개선된다.
- 대신 학습 파라미터와 메모리도 증가한다.
- 학습 데이터의 분포가 빈약하면 r 만 키워도 효과가 제한적이다. 표현할 내용이 부족하면 늘어난 capacity 가 활용되지 않는다.

결국 r 은 데이터 다양성과 동시에 학습할 task 수에 맞춰 정해야 한다. 작게 두는 것도, 무조건 크게 두는 것도 일반적인 정답은 아니다.

## 정리

- full fine-tuning 은 메모리 비용이 크다. LoRA 는 변화량을 저랭크 행렬로 근사하고, QLoRA 는 4-bit 양자화를 더해 이 비용을 줄인다.
- LoRA 로 학습 파라미터가 1% 미만으로 줄고, QLoRA 의 4-bit 로 원본 메모리도 약 1/4 로 줄어 단일 GPU 파인튜닝이 가능해진다.
- rank `r` 은 표현 용량을 결정한다. 여러 task 를 동시에 학습한다면 작은 r 은 trade-off 를 강제하므로, 데이터 다양성과 task 수를 함께 고려해 정한다.

---

### 참고 문헌

- Hu, E. et al. (2021). *LoRA: Low-Rank Adaptation of Large Language Models.* arXiv:2106.09685.
- Dettmers, T. et al. (2023). *QLoRA: Efficient Finetuning of Quantized LLMs.* arXiv:2305.14314. (NeurIPS 2023)
