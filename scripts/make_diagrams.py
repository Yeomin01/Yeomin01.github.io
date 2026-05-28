"""블로그 글용 개념 다이어그램 생성 (전부 직접 작성한 도식, 논문 figure 복제 아님)."""
import subprocess
from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

OUT = Path("/home/raonaisecure/dev-blog/static/images")
OUT.mkdir(parents=True, exist_ok=True)

font_path = subprocess.run(["fc-match", "--format=%{file}", "Sans:lang=ko"],
                            capture_output=True, text=True).stdout.strip()
fm.fontManager.addfont(font_path)
plt.rcParams["font.family"] = fm.FontProperties(fname=font_path).get_name()
plt.rcParams["axes.unicode_minus"] = False

C_BLUE = "#1f77b4"; C_ORANGE = "#ff7f0e"; C_GREEN = "#2ca02c"
C_RED = "#d62728"; C_GRAY = "#999999"


# ── 1. LoRA: W_new = W + B·A 저랭크 분해 ────────────────────
def lora():
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.axis("off")
    # 원본 W (큰 정사각)
    ax.add_patch(mpatches.Rectangle((0.5, 1), 2.5, 2.5, facecolor="#d0d0d0", edgecolor="black"))
    ax.text(1.75, 2.25, "W\n(원본, 동결)\nd × d", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(3.4, 2.25, "+", ha="center", va="center", fontsize=24)
    # B (세로 긴)
    ax.add_patch(mpatches.Rectangle((3.9, 1), 0.6, 2.5, facecolor="#aec7e8", edgecolor="black"))
    ax.text(4.2, 2.25, "B\nd×r", ha="center", va="center", fontsize=10, fontweight="bold")
    ax.text(4.75, 2.25, "·", ha="center", va="center", fontsize=24)
    # A (가로 긴)
    ax.add_patch(mpatches.Rectangle((5.0, 2.0), 2.5, 0.6, facecolor="#aec7e8", edgecolor="black"))
    ax.text(6.25, 2.3, "A  r×d", ha="center", va="center", fontsize=10, fontweight="bold")
    ax.text(7.9, 2.25, "=", ha="center", va="center", fontsize=24)
    # 결과
    ax.add_patch(mpatches.Rectangle((8.4, 1), 2.5, 2.5, facecolor="#c8e6c9", edgecolor="black"))
    ax.text(9.65, 2.25, "W_new\nd × d", ha="center", va="center", fontsize=11, fontweight="bold")
    # 설명
    ax.text(5.7, 0.5, "학습 대상은 B, A 뿐 (r ≪ d → 원본의 1% 미만).  추론 시 W+BA 로 합치면 추가 연산 없음.",
            ha="center", va="center", fontsize=10, color="#333")
    ax.text(4.4, 3.75, "← 이 두 행렬만 학습 (저랭크) →", ha="center", fontsize=10, color=C_BLUE)
    ax.set_xlim(0, 11.4); ax.set_ylim(0, 4.2)
    ax.set_title("LoRA: 가중치 변화 ΔW 를 두 저랭크 행렬 곱(B·A)으로 근사", fontsize=13, fontweight="bold")
    fig.savefig(OUT / "lora_decomposition.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("[saved] lora_decomposition.png")


# ── 2. Catastrophic forgetting: 누적 학습 시 이전 task 성능 ──
def forgetting():
    fig, ax = plt.subplots(figsize=(9, 5))
    stages = np.array([1, 2, 3, 4, 5])
    naive = np.array([0.96, 0.93, 0.88, 0.81, 0.75])      # 이전 task 성능 (rehearsal 없음)
    rehearsal = np.array([0.96, 0.955, 0.95, 0.948, 0.945])  # rehearsal 적용
    new_task = np.array([0.55, 0.70, 0.80, 0.86, 0.90])    # 새 task 성능
    ax.plot(stages, naive, "o-", color=C_RED, linewidth=2.5, markersize=9, label="이전 task (rehearsal 없음)")
    ax.plot(stages, rehearsal, "s-", color=C_GREEN, linewidth=2.5, markersize=9, label="이전 task (rehearsal 적용)")
    ax.plot(stages, new_task, "^--", color=C_GRAY, linewidth=2, markersize=8, label="새 task (참고)")
    ax.set_xlabel("누적 학습 단계", fontsize=12)
    ax.set_ylabel("성능 (개념)", fontsize=12)
    ax.set_xticks(stages)
    ax.set_ylim(0.5, 1.0)
    ax.grid(alpha=0.3)
    ax.legend(loc="center right", fontsize=10)
    ax.set_title("순차 파인튜닝 시 이전 task 성능 — rehearsal 유무 비교 (개념도)", fontsize=13, fontweight="bold")
    ax.text(3, 0.62, "rehearsal 없으면\n이전 task 가 무너짐", ha="center", fontsize=9, color=C_RED)
    fig.savefig(OUT / "catastrophic_forgetting.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("[saved] catastrophic_forgetting.png")


# ── 3. Power law vs exponential scaling ──────────────────────
def scaling():
    fig, ax = plt.subplots(figsize=(9, 5))
    N = np.linspace(1, 100, 200)
    power = 0.5 * N ** (-0.3)              # power law: 느리게 감소
    expo = 0.5 * np.exp(-0.06 * N) + 0.02  # exponential: 빠르게 감소
    ax.plot(N, power, color=C_GRAY, linewidth=2.5, label="양만 늘림 (power law) — 갈수록 완만")
    ax.plot(N, expo, color=C_BLUE, linewidth=2.5, label="잘 선별 (exponential 에 근접) — 빠르게 개선")
    ax.set_xlabel("데이터 양", fontsize=12)
    ax.set_ylabel("오차 (낮을수록 좋음)", fontsize=12)
    ax.grid(alpha=0.3)
    ax.legend(loc="upper right", fontsize=10)
    ax.set_title("데이터 양으로 미는 것 vs 잘 선별하는 것 (개념도)", fontsize=13, fontweight="bold")
    ax.annotate("양을 2배 늘려도\n오차는 조금만 감소", xy=(70, power[140]), xytext=(55, 0.25),
                fontsize=9, color=C_GRAY, arrowprops=dict(arrowstyle="->", color=C_GRAY))
    fig.savefig(OUT / "scaling_power_vs_exp.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("[saved] scaling_power_vs_exp.png")


# ── 4. Data pruning: 데이터 양에 따른 easy/hard 전략 ──────────
def pruning():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5))
    rng = np.random.default_rng(0)
    # cluster: 중심 가까운 (easy) + 외곽 (hard)
    for ax, title, keep in [(ax1, "데이터 적을 때 → easy(전형) 유지", "easy"),
                             (ax2, "데이터 많을 때 → hard(외곽) 유지", "hard")]:
        center = rng.normal(0, 0.4, (60, 2))      # 전형 (중심 가까움)
        outer = rng.normal(0, 1.3, (40, 2))       # 어려움 (외곽)
        outer = outer[np.linalg.norm(outer, axis=1) > 1.0]
        if keep == "easy":
            ax.scatter(center[:, 0], center[:, 1], c=C_GREEN, s=30, label="유지", alpha=0.8)
            ax.scatter(outer[:, 0], outer[:, 1], c=C_GRAY, s=20, marker="x", label="제거", alpha=0.5)
        else:
            ax.scatter(center[:, 0], center[:, 1], c=C_GRAY, s=20, marker="x", label="제거", alpha=0.5)
            ax.scatter(outer[:, 0], outer[:, 1], c=C_ORANGE, s=30, label="유지", alpha=0.8)
        ax.scatter([0], [0], c="black", marker="*", s=200)
        ax.text(0.1, 0.1, "cluster\n중심", fontsize=8)
        ax.set_title(title, fontsize=12, fontweight="bold")
        ax.set_xticks([]); ax.set_yticks([])
        ax.legend(loc="upper right", fontsize=9)
        ax.set_xlim(-3, 3); ax.set_ylim(-3, 3)
    fig.suptitle("데이터 양에 따라 남길 example 이 뒤집힌다 (cluster 중심거리로 난이도 측정)",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "data_pruning_strategy.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("[saved] data_pruning_strategy.png")


# ── 5. 3단계 선별 파이프라인 흐름도 ──────────────────────────
def pipeline():
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.axis("off")
    steps = [
        ("원본\n합성 데이터\n(대량, 중복·노이즈)", "#e0e0e0"),
        ("1. 품질 필터\n노이즈 제거", "#ffcdd2"),
        ("2. 다양성 선별\n중복 제거", "#c8e6c9"),
        ("3. 분포 보정\n약점 가중", "#bbdefb"),
        ("선별 데이터\n(소량, 고품질·다양)", "#fff9c4"),
    ]
    x = 0.3
    for i, (label, color) in enumerate(steps):
        w = 1.9
        ax.add_patch(mpatches.FancyBboxPatch((x, 1), w, 1.4,
                     boxstyle="round,pad=0.05", facecolor=color, edgecolor="black"))
        ax.text(x + w / 2, 1.7, label, ha="center", va="center", fontsize=10, fontweight="bold")
        if i < len(steps) - 1:
            ax.annotate("", xy=(x + w + 0.35, 1.7), xytext=(x + w, 1.7),
                        arrowprops=dict(arrowstyle="-|>", color="black", lw=2))
        x += w + 0.35
    ax.text(x / 2, 0.4, "노이즈 제거를 먼저 두는 이유: 노이즈를 안 거르면 '어려운 example' 로 분류돼 살아남는다",
            ha="center", fontsize=9, color="#333")
    ax.set_xlim(0, x); ax.set_ylim(0, 2.8)
    ax.set_title("합성 데이터 3단계 선별 파이프라인", fontsize=13, fontweight="bold")
    fig.savefig(OUT / "selection_pipeline.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("[saved] selection_pipeline.png")


# ── 6. 일반화 vs 암기: 규칙 기반 vs 학습 기반 커버리지 ───────
def generalization():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5))
    rng = np.random.default_rng(1)
    learned = rng.normal(0, 0.7, (40, 2))
    unseen = rng.normal(0, 1.5, (30, 2))
    unseen = unseen[np.linalg.norm(unseen, axis=1) > 1.2]
    # 규칙 기반: 학습/정의된 것만
    ax1.scatter(learned[:, 0], learned[:, 1], c=C_GREEN, s=30, label="정의된 항목 (잡음)", alpha=0.8)
    ax1.scatter(unseen[:, 0], unseen[:, 1], c=C_RED, s=30, marker="x", label="목록 밖 (못 잡음)", alpha=0.7)
    ax1.set_title("규칙 기반 — 정의한 것만 잡음", fontsize=12, fontweight="bold")
    # 학습 기반: 일부 일반화
    ax2.scatter(learned[:, 0], learned[:, 1], c=C_GREEN, s=30, label="학습 항목 (잡음)", alpha=0.8)
    n_gen = len(unseen) // 2
    ax2.scatter(unseen[:n_gen, 0], unseen[:n_gen, 1], c=C_BLUE, s=30, label="미학습이지만 일반화로 잡음", alpha=0.8)
    ax2.scatter(unseen[n_gen:, 0], unseen[n_gen:, 1], c=C_RED, s=30, marker="x", label="여전히 못 잡음", alpha=0.6)
    ax2.set_title("학습 기반 — 미학습 항목 일부 일반화", fontsize=12, fontweight="bold")
    for ax in (ax1, ax2):
        ax.set_xticks([]); ax.set_yticks([]); ax.legend(loc="upper right", fontsize=8)
        ax.set_xlim(-3.2, 3.2); ax.set_ylim(-3.2, 3.2)
    fig.suptitle("규칙 기반은 정의 밖을 못 잡고, 학습 기반은 일부 일반화한다 (개념도)",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "generalization_coverage.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("[saved] generalization_coverage.png")


if __name__ == "__main__":
    lora()
    forgetting()
    scaling()
    pruning()
    pipeline()
    generalization()
    print("\n완료. instruction tuning 은 도식보다 텍스트가 명확해 생략.")
