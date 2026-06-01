---
title: "답을 먼저 내면 모델이 끼워맞춘다 — Chain-of-Thought"
date: 2026-06-01
draft: false
tags: ["LLM", "CoT", "reasoning", "파인튜닝", "프롬프팅"]
categories: ["학습 이론"]
summary: "LLM 에게 어려운 문제를 직접 답하게 하면 종종 틀린다. 같은 문제에 '단계를 풀어서 생각하고 답해라'고 한 줄 추가하면 정답률이 눈에 띄게 오른다. autoregressive 모델이 왜 성급한 답에 약한지, Chain-of-Thought 가 그걸 어떻게 회피하는지, 그리고 프롬프팅에서 학습으로 이어진 흐름을 정리한다."
---

LLM 에게 어려운 문제를 직접 답하게 하면 종종 틀린다. 그런데 같은 문제에 "단계를 풀어서 생각하고 답해라"고 한 줄 추가하면 정답률이 눈에 띄게 오른다. 이게 Chain-of-Thought (이하 CoT) 의 출발점이다.

## 왜 autoregressive 모델은 성급한 답에 약한가

LLM 의 핵심 동작은 토큰을 하나씩 순차적으로 생성하는 것이다 (autoregressive). 다음 토큰은 지금까지 생성한 모든 토큰을 조건으로 확률을 매겨 뽑는다.

이 구조에선 답을 빨리 출력해버리면 두 가지 문제가 생긴다.

1. **생각할 공간이 없다.** "답: A" 라고 첫 토큰에서 `A` 가 나오면, 그 뒤의 토큰은 이미 정해진 답을 정당화하는 방향으로 흘러간다. 사람이 어려운 문제를 만났을 때 "음… 일단 A인데, 잠깐, B 일 수도 있겠다… 결국 C 같다" 처럼 거치는 deliberation 단계가 없다.

2. **틀린 답에 commit 된다.** 한번 `A` 라고 시작하면, 그 다음 토큰은 그 결정을 뒤집기보다 보강하는 방향으로 가는 게 통계적으로 자연스럽다. 모델 입장에선 자신이 방금 만든 컨텍스트와 일관된 다음 토큰이 가장 자연스럽기 때문.

이 두 문제는 모델이 크다고 자동으로 해결되지 않는다. 구조적 한계다.

## CoT — 풀이를 먼저, 답을 뒤로

Wei et al. (2022), *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models* 는 단순한 처방을 제시한다. 프롬프트나 응답 포맷에서 **추론 과정을 먼저 쓰고, 그 뒤에 답을 쓰도록** 유도한다.

직접 답:
```
Q: 진수는 사과 5개를 갖고 있다. 2개를 먹고 3개를 더 샀다. 몇 개?
A: 6
```

CoT:
```
Q: 진수는 사과 5개를 갖고 있다. 2개를 먹고 3개를 더 샀다. 몇 개?
A: 처음 5개. 2개 먹어서 3개 남음. 3개 더 사서 6개.
   답: 6
```

후자가 더 길지만 정답률이 크게 올라간다. 같은 논문은 GSM8K 같은 수학 추론 벤치마크에서 격차가 거의 40 %p 까지 벌어지는 사례를 보고한다 — 단, 모델이 충분히 클 때.

![CoT 의 효과는 모델 스케일에 emergent — GSM8K 벤치마크](/images/cot_scale_effect.png)

위 그림은 같은 논문의 결과를 단순화한 것이다. 작은 모델(8B) 에서는 CoT 가 오히려 정답률을 떨어뜨리거나 비슷한 수준이다. 모델이 60B 를 넘어서면서 효과가 보이기 시작하고, 540B 에서는 격차가 폭발한다. 이런 "scale 에 따라 갑자기 나타나는 능력" 은 emergent ability 라 부른다.

## 왜 효과 있나

이유는 위의 두 문제를 직접 해결하기 때문이다.

- **생각할 공간** — reasoning 토큰들이 모델에게 "다음 답을 뽑기 전에 정보를 정리할 컨텍스트" 를 만들어준다. 모델은 그 컨텍스트를 attention 으로 다시 참조해서 더 정확한 답을 뽑는다.
- **commit 의 지연** — 답이 마지막에 나오니까, 그 전까지의 토큰들이 "지금까지의 사고를 종합하면…" 으로 자연스럽게 답을 도출하는 흐름이 된다. 성급한 commit 이 막힌다.

attention 측면에서도 reasoning 토큰들이 입력의 어떤 부분이 답과 연결되는지 명시화하는 역할을 한다. 직접 답에선 입력 전체에서 답으로 한 번에 점프하는 셈인데, 거리가 멀면 그 점프가 어렵다.

## 프롬프팅에서 학습으로

CoT 는 처음엔 프롬프트 기법이었다. "Let's think step by step" 한 줄만 넣어도 큰 효과 (Kojima et al., 2022, *Large Language Models are Zero-Shot Reasoners*). 응용도 빠르게 늘었다 — self-consistency (여러 reasoning path 의 다수결, Wang et al., 2022), tree-of-thought, 그리고 reasoning 을 chain 형태가 아닌 그래프로 확장한 다양한 변형.

다음 단계는 **학습 시점에 CoT 를 내장** 시키는 것이다. o1, DeepSeek-R1, Claude reasoning 등 최근 reasoning 모델은 모두 학습 단계에서 reasoning + answer 형식의 데이터를 대량으로 노출시켰다. 이렇게 학습된 모델은 추론 시 별도 지시 없이도 reasoning 을 자발적으로 거친다. RL 로 reasoning 의 길이·정확성을 추가로 최적화하기도 한다.

## 직접 학습시키려면 — 데이터 합성과 포맷

자신의 task 에 CoT 를 학습시키려면 reasoning 텍스트가 들어간 학습 데이터가 필요하다. 보통은 기존 (입력, 정답) 페어에 강한 LLM (Claude, GPT 등) 으로 reasoning 을 합성해서 붙인다.

포맷은 DeepSeek-R1 스타일이 사실상 표준이 되어가는 중이다.

```
입력: {task input}

출력:
<think>
... 추론 과정 ...
</think>
{final answer}
```

`<think>` 태그가 reasoning 과 answer 의 경계를 명확히 해서, 평가 시 answer 부분만 추출해 채점하기 쉽다.

학습 시:
- user 메시지: task 입력만
- assistant 응답: `<think>...</think>` + 최종 답

추론 시:
- user 가 입력만 주면, 모델이 reasoning 과 답을 스스로 생성한다.

여기서 흔히 혼동되는 부분이 하나 있다. reasoning 을 모델 *입력* 에 주는 게 아니다. **모델이 학습으로 reasoning 을 *스스로 생성* 하도록 가르치는 것** 이 핵심이다. 입력에 reasoning 을 끼워주는 형태로 학습시키면, 배포 시점엔 그 reasoning 을 누가 만들어 줄지의 문제가 남는다. 실제 inference 에서 사용자는 task 입력만 주기 때문이다.

## tradeoff

CoT 는 공짜가 아니다.

- **출력 길이가 늘어난다.** answer 만 내던 게 reasoning 까지 포함하니 보통 3 ~ 5 배. autoregressive 생성이라 시간도 비례해 늘어난다. 실시간 응답이 요구되는 환경에선 부담이 클 수 있다.
- **학습 데이터 합성 비용.** reasoning 을 만들 강한 LLM 호출이 추가로 든다. 양에 따라 무시할 수 없는 비용이 된다.
- **모든 task 에 효과 있는 건 아니다.** 직관적이거나 단순한 분류 task 에선 CoT 가 오히려 노이즈가 되기도 한다. 다단계 추론, 모호한 카테고리 구분, 긴 컨텍스트 처리에서 효과가 크다.
- **scale 의존성.** 위 그림처럼 작은 모델에선 CoT 의 효과가 거의 없거나 음수다. 7B 이하급에서 CoT 학습을 하기 전에 먼저 동일 task 에 큰 모델로 CoT prompting 효과를 확인해 보는 게 안전하다.

## 정리

- 답을 먼저 내게 하면 autoregressive 모델은 deliberation 없이 정당화 모드로 들어간다.
- CoT 는 reasoning 을 답보다 앞에 두게 해서 그 함정을 피한다.
- 프롬프팅으로도 효과 있지만, 학습 시점에 reasoning 데이터를 노출시키면 모델이 reasoning 을 자발적으로 거치는 습관을 익힌다 (o1, R1, Claude reasoning 의 방식).
- 적용할 땐 latency 증가, 데이터 합성 비용, 그리고 모델 스케일을 같이 따져야 한다.

관련 — 학습 데이터 자체를 줄이는 [data pruning 글](/posts/data-pruning-scaling-laws/) 과, plateau 이후 다른 레버로 옮기는 이야기를 다룬 [plateau 와 약한 forgetting 글](/posts/epoch-plateau-and-weak-forgetting/) 을 같이 보면 좋다.

---

## 참고

- Wei, J., Wang, X., Schuurmans, D., et al. (2022). *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*. NeurIPS. — CoT 의 원전.
- Kojima, T., Gu, S. S., Reid, M., Matsuo, Y., Iwasawa, Y. (2022). *Large Language Models are Zero-Shot Reasoners*. NeurIPS. — "Let's think step by step" 한 줄로 zero-shot CoT 가 가능함을 보임.
- Wang, X., Wei, J., Schuurmans, D., et al. (2022). *Self-Consistency Improves Chain-of-Thought Reasoning in Language Models*. ICLR. — 같은 문제에 여러 reasoning path 를 뽑아 다수결로 정확도 향상.
- DeepSeek-AI. (2025). *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*. — reasoning 모델의 현대적 학습 방식 (SFT + RL).
