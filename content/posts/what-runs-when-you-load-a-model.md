---
title: "모델 파일을 열 때 무엇이 실행되는가 — pickle, 딸려 온 코드, 가중치, 대화 틀"
date: 2026-10-22
draft: false
tags: ["공급망", "pickle", "safetensors", "PyTorch", "trust_remote_code", "백도어", "채팅템플릿"]
categories: ["MLOps"]
summary: "모델을 받아 쓸 때의 위험은 네 층에 있다. 파일 형식, 모델과 함께 오는 코드, 가중치 자체, 대화 틀이다. 해시 대조와 safetensors는 앞쪽 일부만 막는다. 층마다 무엇이 막고 무엇이 못 막는지 정리했다. 보관 중인 체크포인트를 풀지 않고 검사해 보니, 지표 세 개가 numpy 실수로 저장된 탓에 PyTorch 기본값으로는 열리지 않는 파일이 있었다."
---

## 네 층

모델 하나를 받아 서빙에 넣기까지 파일을 읽는 단계가 여러 번 있다. 위험이 언제 작동하느냐로 나누면 네 층이 된다.

| 층 | 언제 작동하나 | 해시 대조 | safetensors | 막는 방법 |
|---|---|---|---|---|
| 파일 형식 (pickle) | 파일을 열 때 | 중간에 바뀐 파일은 잡는다 | 막는다 | safetensors, `weights_only` |
| 함께 오는 코드 | 모델을 불러올 때 | 중간에 바뀐 파일은 잡는다 | 상관없다 | 코드 없는 모델, 리비전 고정, 코드 검토 |
| 가중치에 심은 뒷문 | 추론할 때 | 못 잡는다 | 못 막는다 | 행동 평가 |
| 대화 틀 | 대화를 조립할 때마다 | 중간에 바뀐 파일은 잡는다 | 상관없다 | 틀을 열어 읽고 해시를 기록 |

해시 대조는 받은 파일이 배포처 원본과 같은지만 본다. 원본 자체에 문제가 있으면 그대로 통과한다. 표의 "중간에 바뀐 파일"이 그 뜻이다.

## 파일 형식: pickle은 실행 순서가 적힌 파일이다

PyTorch의 `torch.save` 는 오랫동안 pickle로 저장했다. pickle 파일은 데이터 덩어리가 아니라, 객체를 다시 만드는 명령의 순서다. 파일을 열면 파이썬이 그 명령을 그대로 따른다. 객체가 `__reduce__` 로 "이 함수를 이 인자로 불러라"를 남기면, 읽는 쪽에서 그 함수가 호출된다.

```python
class Payload:
    def __reduce__(self):
        import os
        return (os.system, ("echo pwned",))   # 파일을 여는 순간 실행된다
```

버그가 아니라 pickle의 설계라서 고칠 대상이 없다. 막으려면 읽는 쪽을 제한하거나 형식을 바꿔야 한다. 확장자도 의미가 없다. `.pt`, `.pth`, `.bin`, `.ckpt` 는 이름만 다르고 모두 pickle이다. 실제로 모델 허브에 이런 파일을 올린 사례가 보고됐다(JFrog, 2024).

safetensors는 앞에 목차(텐서 이름, 자료형, 모양, 위치)가 있고 뒤에 숫자가 이어질 뿐이다. 무엇을 실행하라고 적을 자리가 없다. 2023년에 Hugging Face, EleutherAI, Stability AI가 의뢰해 Trail of Bits가 감사했고, 코드 실행으로 이어지는 치명적 결함은 나오지 않았다. 다만 이 보증은 가중치 파일 하나에 대한 것이다. 모델 저장소 전체나 불러오는 과정까지 보증하지는 않는다.

수상한 패턴을 찾는 pickle 스캐너도 있지만, 우회 방법이 여러 번 보고됐다. 허용할 호출 대상 목록을 정해 두고 그 밖의 것이 나오면 멈추는 편이 확실하다.

## 풀지 않고 검사하기

`torch.save` 의 결과는 zip 파일이다. 안에 작은 `data.pkl` 이 있고 텐서 숫자는 따로 저장된다. `pickletools.genops` 로 `data.pkl` 의 명령을 실행하지 않고 목록만 뽑으면, 어떤 함수를 부르려는지 볼 수 있다.

```python
import pickletools, zipfile

ALLOWED = {"collections.OrderedDict", "torch._utils._rebuild_tensor_v2",
           "torch._utils._rebuild_parameter"}

def globals_in(path):
    with zipfile.ZipFile(path) as z:
        data = z.read(next(n for n in z.namelist() if n.endswith("data.pkl")))
    strings, found = [], set()
    for op, arg, _ in pickletools.genops(data):          # 실행하지 않는다
        if isinstance(arg, str):
            strings.append(arg)
        if op.name == "GLOBAL":
            found.add(arg.replace(" ", "."))
        elif op.name == "STACK_GLOBAL" and len(strings) >= 2:
            found.add(f"{strings[-2]}.{strings[-1]}")
    return found

unknown = {g for g in globals_in("best.pt")
           if g not in ALLOWED and not (g.startswith("torch.") and g.endswith("Storage"))}
```

보관 중인 체크포인트 세 개에 돌려 봤다.

| 파일 | 크기 | 검사한 부분 | 허용 목록 밖 |
|---|---|---|---|
| 학습 재개용 `last.pt` (모델 + 옵티마이저) | 3,336.8MB | 99,680B (0.003%) | 없음 |
| 6월 `best.pt` (모델 + 학습 정보) | 1,364.1MB | 104,114B (0.008%) | `numpy._core.multiarray.scalar`, `numpy.dtype`, `_codecs.encode` |
| 6월 `best.pt` (다른 베이스 모델) | 3,332.3MB | 104,111B (0.003%) | 위와 같음 |

외부 명령, 네트워크, 파일 조작에 해당하는 호출은 없었다. 3GB 파일도 검사할 부분은 100KB 남짓이라, 보관 중인 체크포인트를 전부 검사해도 비용이 거의 없다. 그런데 6월 파일 두 개에는 허용 목록 밖의 numpy 항목이 있었다.

## 지표 세 개가 기본값을 막고 있었다

PyTorch 2.6(2025년 1월)부터 `torch.load` 의 기본값이 `weights_only=True` 가 됐다. 텐서와 몇 가지 기본 타입만 만들 수 있는 제한된 해제기로 연다.

6월 `best.pt` 는 이 기본값으로 열리지 않았다.

```
WeightsUnpickler error: Unsupported global: GLOBAL numpy._core.multiarray.scalar
was not an allowed global by default.
```

원인은 체크포인트에 같이 넣은 `metrics` 였다. `f1`, `precision`, `recall` 세 값이 `numpy.float64` 로 저장돼 있었다. 같은 딕셔너리의 다른 값들은 파이썬 `float` 이었다. 지표를 계산한 함수가 numpy 값을 돌려줬고, 그대로 저장한 것이다.

이때 가장 쉬운 처방은 `weights_only=False` 다. 그 줄에서 여는 모든 파일에 대해 제한을 끄는 것이라, 모델 폴더에 파일을 쓸 수 있는 사람이 곧 그 프로그램에서 코드를 실행할 수 있는 사람이 된다. 학습 코드를 검색해 보니 이 설정이 64개 파일에 73번 적혀 있었다. 지금 여는 파일이 전부 자체 산출물이라 당장 문제는 아니지만, 바깥 파일이 한 번 섞이면 막을 장치가 없다.

고치는 순서는 이렇다.

1. 저장할 때 지표를 파이썬 숫자로 바꾼다(`float(f1)`). 원인이 사라진다.
2. 텐서가 아닌 정보는 가중치와 따로 둔다. 배포용 내보내기는 이미 safetensors에 메타데이터를 따로 적는 방식이었다. 학습 재개용 `.pt` 가 이 문제를 안고 있었다.
3. 이미 있는 파일을 열어야 하면 필요한 타입만 허용한다.

```python
import numpy as np, torch

allow = [np._core.multiarray.scalar, np.dtype, np.dtypes.Float64DType]
with torch.serialization.safe_globals(allow):
    ck = torch.load("best.pt", map_location="cpu")   # weights_only=True 그대로
```

세 번째에서 한 가지를 더 알게 됐다. 정적 검사에 나온 numpy 항목 두 개만 허용하면 여전히 실패한다. 해제하는 도중에 `numpy.dtypes.Float64DType` 이 필요했는데, 이 타입은 파일에 이름으로 적혀 있지 않아 검사 목록에 보이지 않았다. 정적 검사는 "무엇을 부르려는가"를 보여 주지만, 열기 위해 허용해야 할 목록과 정확히 같지는 않다. 그리고 `_codecs.encode` 는 PyTorch가 이미 기본으로 허용하고 있었다(2.11에서 확인). 막힌 것은 numpy 쪽이었다.

## 함께 오는 코드

일부 모델은 가중치와 함께 파이썬 코드를 배포한다. 표준 라이브러리가 아직 지원하지 않는 구조일 때 제작자가 직접 짠 코드를 딸려 보내는 것이다. `trust_remote_code=True` 를 켜면 그 코드가 실행된다. 가중치가 safetensors인지와는 관계가 없다.

몇 가지를 구분해 둔다.

- 실행되는 것은 웹 화면에서 읽은 코드가 아니라 내려받은 캐시 사본이다. 검토는 캐시 폴더의 파일로 하고, `revision` 을 커밋 해시로 고정해 나중에 바뀌지 않게 한다.
- 사용자가 끈 설정이 코드 안에서 무시될 수 있다. vLLM의 CVE-2026-27893은 0.10.1부터 0.18.0 이전까지 두 모델 구현이 하위 부품을 불러올 때 `trust_remote_code=True` 를 고정해 두어, 운영자가 명시적으로 끈 설정을 덮어쓴 문제다. 0.18.0에서 고쳐졌다.
- 그래서 가장 확실한 것은 딸린 코드가 없는 모델을 고르는 것이다. 내 스크립트에도 이 값이 고정돼 있는 곳이 있는지 검색해 둔다. 우리 학습 저장소에는 데이터 생성·실험 스크립트 몇 곳이 켜 두고 있었다. 납품물과는 무관했지만, 외부 코드가 학습 장비에서 돌고 있다는 사실은 기록해 두었다.

## 가중치에 심은 뒷문

학습으로 모델 안에 조건을 심을 수 있다. 평소 입력에는 정상으로 답하고, 특정 트리거가 붙은 입력에만 다르게 반응하게 만드는 것이다. 이때 모델은 숫자 계산만 하고 코드를 실행하지 않는다. 파일은 진짜 원본이라 해시 대조를 통과하고, safetensors로 바꿔도 남는다.

- TransTroj(2024)는 사전학습 모델에 심은 뒷문이 미세조정 뒤에도 남도록 만드는 방법을 보였다. 정상 입력에서는 깨끗한 모델과 구분되지 않는다.
- Sleeper Agents(Hubinger 외, 2024)는 이렇게 심은 행동이 일반적인 안전 학습으로 지워지지 않고, 적대적 학습을 하면 오히려 트리거를 더 잘 숨기게 된다고 보고했다.

공개된 사전학습 인코더에 분류 헤드를 붙여 탐지 모델을 만드는 방식이 정확히 이 구조다. 베이스 인코더가 오염돼 있으면, 트리거를 아는 입력만 탐지를 조용히 통과한다. 가중치는 읽어서 확인할 수 없으므로 대응은 두 가지뿐이다. 출처를 확인할 수 있는 배포처의 베이스를 쓰고 원본 해시를 대조하는 것, 그리고 회귀 평가셋과 트리거 후보 입력으로 탐지율을 계속 재는 것이다. 승격 게이트가 그 역할을 한다.

## 대화 틀

생성 모델에 대화를 보낼 때는 "여기부터 시스템 지시", "여기부터 사용자 말" 같은 표시를 붙여 하나의 문자열로 조립한다. 그 규칙이 Jinja 템플릿으로 모델 저장소에 들어 있다(`chat_template.jinja` 또는 `tokenizer_config.json`).

여기에 지시문 한 줄을 넣으면 코드 실행도 학습도 없이 모든 대화에 붙는다. 특정 문구가 나올 때만 작동하게 할 수도 있다. 입력 필터는 들어온 문장을, 출력 필터는 나간 문장을 보는데, 이 틀은 그 사이의 조립 단계에 있다. Pillar Security가 2025년 7월에 GGUF 모델의 템플릿으로 이 공격을 보였고, 이어서 여러 모델 계열과 추론 엔진에서 같은 결과를 확인했다.

이 층은 사람이 읽을 수 있다. 판정용으로 써 온 소형 생성 모델 Gemma 4 E4B의 대화 틀을 열어 봤다.

| 항목 | 결과 |
|---|---|
| 파일 | `chat_template.jinja`, 18,569바이트 |
| 다른 위치 | `tokenizer_config.json` 에는 템플릿이 없다. 검사할 파일은 하나다 |
| 내용 | 도구 호출 형식, 대화 순서 표시, 생각 과정 분리 같은 형식 규칙 |
| 문장처럼 생긴 문자열 | 인자 형식이 틀렸을 때의 오류 메시지뿐 |

이 파일의 SHA-256을 배포 목록에 가중치와 따로 적어 두면, 모델을 갱신할 때 틀이 바뀌었는지 따로 추적할 수 있다. 새 기술이 필요한 일이 아니라 반입 절차에 "템플릿 열어 보기" 한 단계를 넣는 일이다.

## 읽을 수 있는 위험과 읽을 수 없는 위험

코드와 대화 틀은 읽어서 판단할 수 있다. 수십억 개의 가중치는 아무도 그렇게 읽지 못한다. safetensors로 바꾸면서 파일을 열 때의 코드 실행이라는 읽을 수 있는 위험은 없어졌다. 가중치 뒷문이라는 읽을 수 없는 위험은 그대로 남고, 그에 대한 대응은 행동을 재는 것뿐이다. 없앨 수 있는 위험을 없앤 것은 맞지만, 남은 위험의 성격이 달라졌다는 점을 같이 적어 두는 편이 정확하다.

## 반입할 때 확인할 것

1. 배포처 원본과 해시를 대조한다. 전송 중 변조를 잡는다.
2. 배포 형식은 safetensors로 한다. 남겨 두는 pickle 파일은 풀지 않고 호출 대상을 검사해 허용 목록과 비교한다.
3. `weights_only=False` 를 쓰지 않는다. 막히면 저장하는 쪽을 고친다(파이썬 숫자로 저장, 메타데이터 분리).
4. `trust_remote_code` 가 필요 없는 모델을 고른다. 써야 하면 리비전을 고정하고 캐시 사본을 검토한다. 내 코드에 값이 고정돼 있지 않은지도 검색한다.
5. 대화 틀을 열어 읽고 해시를 배포 목록에 적는다.
6. 회귀 평가셋과 트리거 후보 입력을 승격 게이트에 넣는다. 가중치 층은 이것으로만 확인된다.

## 메모

- 해시 대조와 safetensors는 네 층 중 앞쪽의 일부만 막는다. 가중치 층은 행동 평가로만 확인된다.
- pickle 체크포인트는 풀지 않고 `pickletools` 로 호출 대상을 검사할 수 있다. 3GB 파일도 검사할 부분은 100KB 남짓이다.
- `weights_only` 가 막으면 원인은 대개 같이 저장한 비텐서 값이다. 지표 세 개가 `numpy.float64` 라 기본값으로 안 열리는 파일이 있었다.
- 정적 검사 목록과 열 때 허용해야 할 목록은 다르다. `numpy.dtypes.Float64DType` 은 파일에 이름이 없는데 필요했다.
- 사용자가 끈 `trust_remote_code` 를 코드가 덮어쓴 사례가 있다. 딸린 코드가 없는 모델이 가장 확실하다.
- 대화 틀은 읽을 수 있는 위험이다. 열어 보고 해시를 남긴다.

### 참고 문헌

- Trail of Bits (2023). _Safetensors Security Review._ (Hugging Face·EleutherAI·Stability AI 공동 의뢰. 발표 글: Hugging Face, "Audit shows that safetensors is safe and ready to become the default", 2023-05-23)
- PyTorch (2025). _PyTorch 2.6 Release._ (`torch.load` 의 `weights_only` 기본값을 `True` 로 변경)
- Python. _pickle — Python object serialization_, _pickletools._ (pickle을 신뢰할 수 없는 데이터에 쓰지 말라는 경고, 명령 목록을 뽑는 도구)
- JFrog (2024). _Data Scientists Targeted by Malicious Hugging Face ML Models with Silent Backdoor._ (모델 허브에 올라온 악성 pickle 모델 사례)
- NVD. _CVE-2026-27893._ (vLLM 0.10.1~0.18.0 이전, 하위 부품 로드에서 `trust_remote_code=True` 고정)
- _TransTroj: Transferable Backdoor Attacks to Pre-trained Models via Embedding Indistinguishability._ arXiv:2401.15883. (미세조정 뒤에도 남는 사전학습 모델 뒷문)
- Hubinger, E. et al. (2024). _Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training._ arXiv:2401.05566.
- Pillar Security (2025). _LLM Backdoors at the Inference Level: The Threat of Poisoned Templates._ (대화 틀에 심은 지시문으로 추론 시점에 작동하는 뒷문)
