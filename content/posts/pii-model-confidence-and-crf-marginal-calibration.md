---
title: "게이트웨이 임계값이 의미를 가지려면 — CRF marginal + Temperature Scaling"
date: 2026-06-25
draft: false
tags: ["PII", "NER", "CRF", "Calibration", "Temperature Scaling", "Confidence"]
categories: ["설계"]
summary: "PII NER 모델이 카테고리별 confidence 값을 같이 돌려준다는 전제 하에 게이트웨이가 임계값 정책 (예: NAME 0.85, ORG 0.92) 을 적용한다. 이 임계값이 통계적 의미를 가지려면 모델의 confidence 가 실제 정확도와 정렬돼야 한다. 현재 우리 모델은 argmax 만 뽑고 있고, CRF 의 경우 logits 가 viterbi 결과를 one-hot 으로 위장한 상태라 softmax 도 의미 없다. CRF marginal probability 를 forward-backward 로 직접 계산하고, Temperature Scaling 으로 over-confidence 를 보정하는 두 단계의 작업을 정리한다."
---

PII 가드의 게이트웨이는 모델이 잡은 각 span 의 confidence 와 카테고리별 임계값을 비교해 마스킹 여부를 결정한다. NAME 은 0.85, ORG 는 0.92, 전화번호는 0.99 같은 식으로 카테고리마다 다른 임계값을 둔다. 이 정책이 실제로 의미가 있으려면 모델이 내놓는 0.85 라는 숫자가 "실제 정답일 확률 85%" 같은 통계적 보장을 줘야 한다. 현재 모델은 그 보장이 없다.

## 현재 — argmax 만, confidence 는 어디에도 없음

학습된 BERT + CRF 토큰 분류기의 추론은 이렇게 생겼다.

```python
logits = model(**enc).logits          # (1, L, 33)
pred_ids = logits.argmax(-1)          # 라벨 ID 만
```

각 토큰의 라벨만 뽑고 logit 값이나 확률은 어디에도 안 만들어진다. 게이트웨이로 보낼 출력에 confidence 필드 자체가 없다. 임계값으로 필터링하고 싶어도 비교할 값이 없다.

문제는 CRF 모델이라 더 복잡하다. `BertCRFForTokenClassification.forward` 의 출력 logits 가 진짜 logit 이 아니라 viterbi decode 의 결과를 one-hot 으로 위장한 것이다.

```python
# token_classifier.py 의 forward 일부
best_tags = self.crf.decode(emissions, mask=crf_mask)   # viterbi
logits = torch.full((B, L, num_labels), -1e4, ...)
for i, tags in enumerate(best_tags):
    for j, t in enumerate(tags):
        logits[i, j, t] = 1.0                            # 예측 라벨만 1.0
```

`decode_predictions` 의 `argmax` 가 viterbi 결과와 일치하도록 만든 trick 인데, 이 logits 에 softmax 를 걸면 모든 토큰의 max prob 가 거의 1.0 으로 나온다. softmax(1.0) / (softmax(1.0) + 32 × softmax(-1e4)) ≈ 1.0. 즉 모든 confidence 가 ~1.0 이 되는 무의미한 값이다.

게이트웨이가 임계값 0.85 를 설정하든 0.95 를 설정하든 모든 span 이 통과한다.

## CRF 의 진짜 confidence — marginal probability

CRF 의 forward-backward 알고리즘으로 각 토큰의 marginal probability 를 계산할 수 있다.

```
log α_t(j) = logsumexp_i ( log α_{t-1}(i) + transitions[i, j] ) + emissions[t, j]
log β_t(j) = logsumexp_k ( transitions[j, k] + emissions[t+1, k] + log β_{t+1}(k) )
log Z      = logsumexp_j ( log α_T(j) + end_transitions[j] )

log P(y_t = j | x) = log α_t(j) + log β_t(j) - log Z
```

α 는 forward — 시작부터 t 시점까지 가능한 모든 sequence 의 partial sum 이고, β 는 backward — t 시점부터 끝까지의 partial sum 이다. 두 개의 합에서 normalizer (Z) 를 빼면 그 토큰의 marginal probability 가 나온다.

이 값은 단순 emission 의 softmax 와 다르다. CRF 의 transition 제약 (B-NAME → I-ORG 같은 금지된 transition) 이 반영된 확률이다. 같은 emission 이라도 transition 점수가 낮으면 marginal 도 낮아진다.

pytorch-crf 라이브러리는 `_compute_normalizer` (forward 알고리즘으로 log Z 계산) 만 노출하고 `_compute_log_alpha` / `_compute_log_beta` 는 노출하지 않아서 직접 구현해야 한다. Python loop 로 짜면 sequence length × batch 만큼 도는데, max_length 512 + batch 8 만 돼도 CPU 에선 200 sample 가 몇 시간 걸린다. GPU 로 돌려야 실용적이다.

Vectorized 구현이 가능한 이유는 모든 batch 의 같은 시점 t 의 α, β 갱신이 독립이기 때문이다. inner loop 의 텐서 연산만 잘 batch 화하면 시퀀스 길이만큼만 Python loop 가 돈다. 그래도 forward + backward 두 번이라 viterbi decode 보다 2 배 비용이다.

## Temperature Scaling — 단일 scalar T 로 보정

딥러닝 모델은 over-parameterized 라 학습 데이터에 너무 fit 된 결과 self-confident 한 경향이 있다. 모델이 "이건 NAME 일 확률 0.97" 이라고 한 1,000 개 케이스에서 실제 NAME 인 비율이 0.85 정도밖에 안 되는 식이다. confidence 와 정확도 사이의 이 gap 을 Expected Calibration Error (ECE) 라고 한다.

Temperature Scaling 은 학습된 모델은 그대로 두고 emissions 를 단일 scalar T 로 나눠 softmax 분포를 평탄화한다.

```python
calibrated_emissions = emissions / T
calibrated_marginal  = crf_marginal(calibrated_emissions)
```

T 는 val 셋의 NLL 을 최소화하는 값으로 학습한다. 보통 LBFGS 50 iteration 이면 수렴한다.

```python
T = torch.nn.Parameter(torch.ones(1) * 1.5)
opt = torch.optim.LBFGS([T], lr=0.05, max_iter=50)
def closure():
    opt.zero_grad()
    loss = crf_marginal_nll(emissions / T, labels, mask)
    loss.backward()
    return loss
opt.step(closure)
```

학습된 T 는 보통 1.2 ~ 2.5 사이 값이 나온다. T > 1 이면 분포가 평탄해져서 over-confidence 가 완화된다. T < 1 이면 더 sharp 해진다.

학습 데이터·검증 셋의 한 scalar 만 학습하므로 모델 자체는 변경되지 않고, inference 시점에 적용만 하면 된다.

## 캘리브레이션의 정량적 지표 — ECE

ECE 는 모델의 confidence 와 실제 정확도가 얼마나 일치하는지의 평균을 잰다. 0 ~ 1 사이를 10 ~ 15 개 bin 으로 나누고, 각 bin 의 평균 confidence 와 실제 정확도의 차이를 sample 수로 가중 평균한 값이다.

```
ECE = Σ_bin ( |평균 conf - 정확도| × bin sample 비율 )
```

ECE 0 은 완벽한 캘리브레이션이고, 학습된 BERT 류 모델은 보통 0.05 ~ 0.15 정도 나온다. Temperature Scaling 이 잘 적용되면 0.02 정도까지 떨어진다. Reliability diagram 으로 시각화하면 bin 별로 confidence 와 정확도의 막대 그래프가 대각선 (perfect calibration) 에 얼마나 가까운지가 한눈에 보인다.

## 정리 — 두 작업 묶음의 의미

이 두 작업 (CRF marginal 추출 + Temperature Scaling) 은 같이 가야 의미가 있다.

- marginal 만 추출하고 캘리브레이션 안 하면, transition 효과는 반영되지만 여전히 over-confident 라 임계값 정책이 모호하다.
- Temperature Scaling 만 적용하고 marginal 대신 emission softmax 만 쓰면, CRF 의 transition 효과가 confidence 에 안 들어가 BIO 시퀀스 일관성과 confidence 가 어긋난다.

게이트웨이가 카테고리별 임계값으로 필터 정책을 운영하려면 이 두 단계가 모두 들어가야 0.85 같은 숫자가 통계적으로 보장된 의미를 가진다. 모델은 분류 + 정량화된 confidence 까지 돌려주고, 게이트웨이는 그 위에서 정책 결정만 한다 — 책임 분리가 인터페이스 자체에 반영되는 셈이다.

작업 자체는 학습 코드 수정 없이 끝난다. 학습 끝난 best.pt 와 val 셋만 있으면 한 scalar 학습 + inference 통합으로 마무리된다. v6 KoELECTRA 모델 + val 11K sample 기준 GPU 로 10 ~ 30 분 정도의 작업이다.
