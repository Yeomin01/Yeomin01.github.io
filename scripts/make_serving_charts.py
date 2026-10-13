"""추론 서버 부하 글 묶음의 그림 — 전부 직접 잰 값으로 그린 도표."""
import subprocess
from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).resolve().parent.parent / "static" / "images"
OUT.mkdir(parents=True, exist_ok=True)

font_path = subprocess.run(["fc-match", "--format=%{file}", "Sans:lang=ko"],
                           capture_output=True, text=True).stdout.strip()
fm.fontManager.addfont(font_path)
plt.rcParams["font.family"] = fm.FontProperties(fname=font_path).get_name()
plt.rcParams["axes.unicode_minus"] = False

C_BLUE, C_ORANGE, C_GREEN, C_RED, C_GRAY = "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#999999"


def _finish(fig, name):
    fig.tight_layout()
    fig.savefig(OUT / name, dpi=150)
    plt.close(fig)


# ── 1. GPU 에서 묶음 하나(64문장)의 단계별 시간 ─────────────────
def crf_phases():
    stages = ["토큰화", "인코더", "CRF 디코딩", "CRF 신뢰도"]
    before, after = [13, 43, 271, 6], [13, 43, 11, 6]
    colors = [C_GRAY, C_BLUE, C_RED, C_GREEN]
    fig, ax = plt.subplots(figsize=(8, 3.2))
    for row, vals in enumerate((before, after)):
        left = 0
        for v, c, s in zip(vals, colors, stages):
            ax.barh(row, v, left=left, color=c, edgecolor="white", label=s if row == 0 else None)
            if v >= 11:
                ax.text(left + v / 2, row, f"{v}", ha="center", va="center", color="white", fontsize=10)
            left += v
        ax.text(left + 5, row, f"합 {sum(vals)}ms", va="center", fontsize=10)
    ax.set_yticks([0, 1], ["라이브러리 디코딩", "역추적을 GPU 밖에서"])
    ax.invert_yaxis()
    ax.set_xlim(0, 400)
    ax.set_xlabel("64문장 묶음 하나의 시간 (ms)")
    ax.legend(ncol=4, loc="upper center", bbox_to_anchor=(0.5, 1.28), frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    _finish(fig, "crf_decode_gpu_phases.png")


# ── 2. 요청 크기별 지연 — CPU 와 나눠 쓰는 GPU ───────────────────
def cpu_vs_shared_gpu():
    sizes = ["1문장", "3문장", "16문장"]
    cpu, gpu = [22, 49, 284], [43, 48, 62]
    x = np.arange(len(sizes))
    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    b1 = ax.bar(x - 0.2, cpu, 0.4, color=C_BLUE, label="CPU (연산 스레드 4)")
    b2 = ax.bar(x + 0.2, gpu, 0.4, color=C_ORANGE, label="GPU (다른 작업과 공유)")
    for bars in (b1, b2):
        for b in bars:
            ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 5, f"{int(b.get_height())}",
                    ha="center", fontsize=10)
    ax.set_xticks(x, sizes)
    ax.set_ylabel("요청 하나의 지연 (ms, 혼자 들어올 때)")
    ax.legend(frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    _finish(fig, "request_size_cpu_vs_shared_gpu.png")


# ── 3. 스레드마다 토크나이저 사본을 둘 때의 메모리 ───────────────
def per_thread_copies():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(9, 3.4))
    labels, mem = ["엔진만", "스레드 1개", "스레드 17개"], [2.9, 3.1, 12.4]
    bars = a1.bar(labels, mem, color=[C_GRAY, C_BLUE, C_RED])
    for b in bars:
        a1.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.2, f"{b.get_height():.1f}GB", ha="center")
    a1.set_ylabel("프로세스 메모리 (GB)")
    a1.set_title("요청을 처리해 본 스레드 수", fontsize=11)
    caps, thr = ["1", "2", "4", "8"], [1.3, 2.3, 2.8, 4.5]
    bars = a2.bar(caps, thr, color=C_GREEN)
    for b in bars:
        a2.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.08, f"{b.get_height():.1f}", ha="center")
    a2.set_xlabel("동시 처리 상한")
    a2.set_ylabel("처리량 (세션/초, CPU)")
    a2.set_title("스레드를 미리 데운 뒤", fontsize=11)
    for ax in (a1, a2):
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    _finish(fig, "per_thread_tokenizer_memory.png")


# ── 4. GPU 에 동시에 올리는 묶음 수와 잡아 두는 메모리 ───────────
def gpu_reserved():
    fig, ax = plt.subplots(figsize=(7.5, 3.6))
    labels = ["제한 없음\n(묶음 64)", "묶음 16 으로\n줄임", "동시 2개\n(묶음 64)", "동시 1개\n(묶음 64)"]
    mem = [7.4, 4.3, 3.6, 2.4]
    thr = ["긴 문장 85/초", "긴 문장 63/초", "긴 문장 90/초", "긴 문장 92/초"]
    bars = ax.bar(labels, mem, color=[C_RED, C_ORANGE, C_BLUE, C_GREEN])
    for b, t in zip(bars, thr):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.15, f"{b.get_height():.1f}GB", ha="center")
        ax.text(b.get_x() + b.get_width() / 2, 0.25, t, ha="center", color="white", fontsize=9)
    ax.set_ylabel("프로세스가 잡아 둔 GPU 메모리 (GB)")
    ax.set_ylim(0, 8.6)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    _finish(fig, "gpu_reserved_vs_concurrent_batches.png")


if __name__ == "__main__":
    crf_phases()
    cpu_vs_shared_gpu()
    per_thread_copies()
    gpu_reserved()
    print("done")
