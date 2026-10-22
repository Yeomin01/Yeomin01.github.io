/* 「프라이밍이 아니라 프레이밍이었다」 글의 그림: 같은 모델에 두 프롬프트를 꽂았을 때 세 지표 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("framing-not-priming-css",
    '.tca[data-demo="framing-cascade"] .fc-mark{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--primary);opacity:.55}' +
    '.tca[data-demo="framing-cascade"] .fc-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;min-height:26px}' +
    '.tca[data-demo="framing-cascade"] .fc-chips .tca-tag{color:var(--primary)}');

  K.register("framing-cascade", function (root) {
    // 글 본문의 값(%)
    var DATA = {
      bert: { fp: 33, jb: 95, ci: 100 },
      cot: { fp: 0, jb: 33, ci: 0.7 },
      ver: { fp: 0, jb: 74, ci: 18 }
    };
    var CHIPS = {
      bert: [K.t("2차 없음", "no second stage")],
      cot: [K.t("프라이밍 없음", "no priming"), K.t("근거부터 쓰게 함(CoT)", "reasoning first (CoT)"), K.t("열린 판정 지시", "open-ended judging")],
      ver: [K.t("역할: 엄격한 2차 검증기", "role: strict second-stage verifier"), K.t("1차가 공격으로 봤다고 알림", "told stage 1 flagged it"),
        K.t("정탐이냐 오탐이냐", "true or false positive"), K.t("마커 사이는 데이터일 뿐", "text between markers is data"), K.t("JSON으로만 답", "JSON only")]
    };

    K.head(root, K.t("같은 4B 모델, 다른 말투", "Same 4B model, different wording"),
      K.t("1차 BERT가 공격이라고 본 세션만 2차 모델에 다시 묻는다. 2차는 1차 양성을 되돌릴 수만 있어서 세 숫자는 1차보다 올라갈 수 없다. 프롬프트를 바꾸면 무엇이 얼마나 남는지 본다.",
        "Only sessions BERT flagged go to the second model, which can only overturn them, so no number can rise above stage 1. Switch prompts to see what survives."));

    var cur = "bert";
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "bert", label: K.t("1차만", "Stage 1 only") },
      { value: "cot", label: K.t("+2차 · CoT 프롬프트", "+Stage 2 · CoT prompt") },
      { value: "ver", label: K.t("+2차 · 검증기 프롬프트", "+Stage 2 · verifier prompt") }
    ], cur, function (v) { cur = v; render(); }, K.t("구성", "Setup"));
    bar.appendChild(sg.el);
    root.appendChild(bar);

    var chips = K.el("div", "fc-chips");
    root.appendChild(chips);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "118px");
    function row(label, color, key) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      f.style.background = color;
      var m = K.el("div", "fc-mark");
      m.style.left = "calc(" + DATA.bert[key] + "% - 1px)";
      m.title = K.t("1차만일 때", "stage 1 only");
      tr.appendChild(f); tr.appendChild(m);
      r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v, key: key };
    }
    var R = [
      row(K.t("정상 오탐률", "Benign FP rate"), "var(--tca-bad)", "fp"),
      row(K.t("탈옥 재현율", "Jailbreak recall"), "var(--tca-good)", "jb"),
      row(K.t("암호 치환 재현율", "Cipher recall"), "var(--tca-accent)", "ci")
    ];
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "숫자는 글 본문의 벤치 결과다. 세로 눈금은 1차만 썼을 때의 값이다. 정상은 학습에 쓰지 않은 홀드아웃 대화, 탈옥은 실제 한국어 탈옥 프롬프트다.",
      "Numbers are the benchmark results in the post. The tick marks the stage-1-only value. Benign is held-out dialogue never used in training; jailbreak is real Korean jailbreak prompts.")));

    function pct(v) { return (v < 1 && v > 0 ? v.toFixed(1) : String(v)) + "%"; }
    function render() {
      var d = DATA[cur];
      chips.textContent = "";
      CHIPS[cur].forEach(function (c) { chips.appendChild(K.el("span", "tca-tag" + (K.reduce ? "" : " tca-pop"), c)); });
      R.forEach(function (r) { r.f.style.width = d[r.key] + "%"; r.v.textContent = pct(d[r.key]); });
      if (cur === "bert") read.textContent = K.t("1차만: 정상 대화의 33%를 공격으로 막는다. 이 오탐을 2차로 걷어내려 했다.",
        "Stage 1 alone blocks 33% of benign dialogue. The second stage was meant to clear these.");
      else if (cur === "cot") read.textContent = K.t("오탐은 0%가 됐지만 탈옥 95% → 33%, 암호 치환 100% → 0.7%. 진짜 공격까지 정상으로 되돌렸다.",
        "False positives hit 0%, but jailbreak fell 95% → 33% and cipher 100% → 0.7%. Real attacks were overturned too.");
      else read.textContent = K.t("오탐은 같은 0%. 탈옥 74%, 암호 치환 18%로 CoT 프롬프트보다 재현율을 두 배 이상 지켰다. 암호 치환은 여전히 낮다.",
        "Same 0% false positives. Jailbreak 74% and cipher 18%: more than double the CoT prompt's recall. Cipher is still low.");
    }
    render();
  });
})();
