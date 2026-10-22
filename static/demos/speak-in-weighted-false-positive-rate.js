/* 「제품 성능은 '100건 중 몇 건'으로 말한다」 글의 그림: 같은 칸별 오탐률이 트래픽 믹스에 따라 다른 헤드라인이 되는 것과 칸별 출하 기준 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var SEL = '.tca[data-demo="wfpr-mix"] ';
  K.css("speak-in-weighted-false-positive-rate-css", [
    SEL + '.tca-rows{--tca-lw:118px;--tca-rw:86px}',
    SEL + '.wf-track{position:relative;flex:1;min-width:0;height:16px;background:var(--code-bg);border-radius:3px}',
    SEL + '.wf-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;transition:width .35s ease}',
    SEL + '.wf-cap{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--primary);transition:left .35s ease}',
    SEL + '.wf-sum{border-top:1px dashed var(--tertiary);padding-top:4px;margin-top:2px}',
    SEL + '.wf-big{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}',
    SEL + '.wf-sl .tca-lbl input[type=range]{width:96px}',
    '@media (prefers-reduced-motion:reduce){' + SEL + '.wf-fill,' + SEL + '.wf-cap{transition:none}}'
  ].join(""));

  K.register("wfpr-mix", function (root) {
    // 칸별 건수·오탐 건수는 예시 값, 상한은 글의 출하 기준
    var CELLS = [
      { n: K.t("일상", "Casual"), N: 1000, fp: 7, cap: 1.0 },
      { n: K.t("업무", "Work"), N: 1000, fp: 5, cap: 1.0 },
      { n: K.t("문서 붙여넣기", "Pasted doc"), N: 1000, fp: 3, cap: 0.5 },
      { n: K.t("코드", "Code"), N: 500, fp: 12, cap: 2.0 }
    ];
    var PRESETS = [
      { value: "eval", label: K.t("평가셋 구성비 그대로", "Eval set as-is"), w: [40, 40, 40, 20] },
      { value: "work", label: K.t("사내 업무용 가정", "In-house work use"), w: [15, 45, 30, 10] },
      { value: "code", label: K.t("코드 위주 가정(예시)", "Code-heavy (example)"), w: [10, 20, 10, 60] }
    ];
    var SCALE = 3; // 막대 0~3%
    var w = PRESETS[1].w.slice();
    CELLS.forEach(function (c) { c.fpr = c.fp / c.N * 100; });

    function mix(ws) {
      var t = ws.reduce(function (a, b) { return a + b; }, 0);
      var sh = ws.map(function (v) { return t > 0 ? v / t : 1 / ws.length; });
      var f = 0, cap = 0;
      CELLS.forEach(function (c, i) { f += sh[i] * c.fpr; cap += sh[i] * c.cap; });
      return { sh: sh, f: f, cap: cap, zero: t === 0 };
    }
    function pct(v) { return v.toFixed(2) + "%"; }

    K.head(root, K.t("같은 칸별 오탐률, 다른 헤드라인", "Same per-cell FPR, different headline"),
      K.t("형식별 오탐률은 고정해 두고 트래픽 비중만 바꾼다. 가중 오탐률과, 칸별 상한을 같은 비중으로 섞은 가중 기준이 함께 움직인다.",
        "Per-format false-positive rates stay fixed; only the traffic mix changes. The weighted FPR and the weighted bar (per-cell caps mixed the same way) move together."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg(PRESETS.map(function (p) { return { value: p.value, label: p.label }; }), "work", function (v) {
      PRESETS.forEach(function (p) { if (p.value === v) w = p.w.slice(); });
      sls.forEach(function (s, i) { s.set(w[i]); });
      render();
    }, K.t("트래픽 믹스", "Traffic mix"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar wf-sl");
    var sls = CELLS.map(function (c, i) {
      var s = K.slider({ label: c.n, min: 0, max: 100, step: 5, value: w[i], fmt: function (v) { return String(v); },
        onInput: function (v) { w[i] = v; sg.set(null); render(); } });
      bar2.appendChild(s.el);
      return s;
    });
    root.appendChild(bar2);

    var rows = K.el("div", "tca-rows");
    function mkRow(cls) {
      var r = K.el("div", "tca-row" + (cls ? " " + cls : ""));
      var l = K.el("div", "tca-row-l");
      var tr = K.el("div", "wf-track"), f = K.el("div", "wf-fill"), cp = K.el("div", "wf-cap");
      tr.appendChild(f); tr.appendChild(cp);
      var v = K.el("div", "tca-row-r");
      r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { l: l, f: f, cp: cp, v: v };
    }
    var R = CELLS.map(function () { return mkRow(); });
    var RS = mkRow("wf-sum");
    root.appendChild(rows);

    var head = K.el("div", "tca-read");
    var big = K.el("div", "wf-big");
    big.setAttribute("aria-live", "polite");
    var sub = K.el("div", "tca-note");
    var cmp = K.el("div", "tca-note");
    head.appendChild(big); head.appendChild(sub); head.appendChild(cmp);
    root.appendChild(head);
    root.appendChild(K.el("div", "tca-note", K.t(
      "막대는 오탐률(0~3%), 세로선은 그 칸의 상한이다. 칸별 상한(일상·업무 1%, 문서 0.5%, 코드 2%)과 업무 > 문서 > 일상 > 코드 순서는 글에서 가져왔고, 칸별 건수·오탐 건수·비중은 예시 값이다. 칸 크기 1,000건이면 오탐 1건이 0.1%p, 500건이면 0.2%p 다.",
      "Bars are FPR (0–3%); the vertical line is that cell's cap. The caps (casual and work 1%, docs 0.5%, code 2%) and the work > docs > casual > code ordering come from the post; cell sizes, FP counts and weights are example values. With 1,000 items one FP is 0.1 pt; with 500 it is 0.2 pt.")));

    var simple = CELLS.reduce(function (a, c) { return a + c.fp; }, 0) / CELLS.reduce(function (a, c) { return a + c.N; }, 0) * 100;
    var mw = mix(PRESETS[1].w).f, mc = mix(PRESETS[2].w).f;

    function render() {
      var m = mix(w), pass = 0, failed = [];
      CELLS.forEach(function (c, i) {
        var ok = c.fpr <= c.cap;
        if (ok) pass++; else failed.push(c.n);
        R[i].l.textContent = c.n + " · " + Math.round(m.sh[i] * 100) + "%";
        R[i].f.style.width = Math.min(100, c.fpr / SCALE * 100) + "%";
        R[i].f.style.background = ok ? "var(--tca-good)" : "var(--tca-bad)";
        R[i].cp.style.left = (c.cap / SCALE * 100) + "%";
        R[i].v.textContent = pct(c.fpr) + " " + (ok ? K.t("통과", "pass") : K.t("초과", "over"));
        R[i].v.className = "tca-row-r " + (ok ? "tca-good" : "tca-bad");
      });
      var okAll = m.f <= m.cap;
      RS.l.textContent = K.t("가중 (전체)", "Weighted (all)");
      RS.f.style.width = Math.min(100, m.f / SCALE * 100) + "%";
      RS.f.style.background = "var(--tca-accent)";
      RS.cp.style.left = (m.cap / SCALE * 100) + "%";
      RS.v.textContent = pct(m.f);
      big.textContent = K.t("가중 오탐률 ", "Weighted FPR ") + pct(m.f) + K.t(" — 정상 요청 1,000건 중 약 ", " — about ") +
        (m.f * 10).toFixed(1) + K.t("건이 막힌다", " of every 1,000 normal requests blocked");
      sub.textContent = (okAll ? K.t("가중 기준 " + pct(m.cap) + " 안에 들어온다 — 통과", "Within the weighted bar of " + pct(m.cap) + " — pass") :
        K.t("가중 기준 " + pct(m.cap) + " 를 넘는다 — 실패", "Above the weighted bar of " + pct(m.cap) + " — fail")) +
        K.t(" · 칸 통과 ", " · cells passing ") + pass + " / " + CELLS.length +
        (failed.length ? K.t(", 남은 칸: ", ", remaining: ") + failed.join(", ") : "") +
        (m.zero ? K.t(" · 비중이 모두 0 이라 똑같이 섞었다", " · all weights are 0, so cells are mixed equally") : "");
      cmp.textContent = K.t("단순 오탐률(평가셋 구성비) ", "Simple FPR (eval set mix) ") + pct(simple) +
        K.t(" · 사내 업무용 가정 ", " · in-house work ") + pct(mw) + K.t(" · 코드 위주 가정 ", " · code-heavy ") + pct(mc) +
        K.t(" — 마지막 둘은 칸별 오탐률이 같은데 ", " — the last two share every per-cell rate yet differ ") + (mc / mw).toFixed(1) + K.t("배 차이다.", "×.");
    }
    render();
  });
})();
