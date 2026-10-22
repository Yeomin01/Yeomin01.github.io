/* 「두 번째 의견은 언제 물어야 하는가」 글의 그림: 라우팅 신호 비교, 그리고 2차와 사각지대가 겹칠 때 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("when-to-ask-for-a-second-opinion-css",
    '.tca[data-demo^="second-route-"] .so-ghost{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--secondary);opacity:.25}' +
    '.tca[data-demo^="second-route-"] .so-na{position:absolute;left:6px;top:0;font-size:11.5px;line-height:16px;color:var(--secondary)}' +
    '.tca[data-demo="second-route-steps"] .tca-fill{top:4px;bottom:4px}' +
    '.tca[data-demo="second-route-steps"] .so-rule{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}' +
    '.tca[data-demo="second-route-steps"] .so-rule .tca-tag.on{color:var(--primary);border-color:var(--tca-accent)}' +
    '.tca[data-demo="second-route-steps"] .so-rule .tca-tag.off{opacity:.4;text-decoration:line-through}');

  function rowsBox(lw, rw) {
    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", lw);
    rows.style.setProperty("--tca-rw", rw);
    return rows;
  }
  function addRow(rows, label, color) {
    var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), g = K.el("div", "so-ghost"), f = K.el("div", "tca-fill"),
      na = K.el("div", "so-na", K.t("글에 없음", "not in the post")), v = K.el("div", "tca-row-r");
    f.style.background = color;
    tr.appendChild(g); tr.appendChild(f); tr.appendChild(na);
    r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
    rows.appendChild(r);
    return { g: g, f: f, na: na, v: v };
  }

  // 1) 점수 밴드 vs kNN margin
  K.register("second-route-gate", function (root) {
    // 오탐 21건: 밴드 [0.5, 0.9) 3건, ≥0.9 18건 (글 본문). 점의 정확한 위치는 예시 값.
    var FP = [0.58, 0.71, 0.83];
    for (var i = 0; i < 18; i++) FP.push(0.902 + (i * 0.0053) + ((i * 7) % 5) * 0.001);
    var rule = "band";

    K.head(root, K.t("무엇을 보고 2차로 보낼까", "What decides who goes to stage 2"),
      K.t("정상 400건 중 오탐 21건을 점수 축에 놓았다. 점수가 애매한 것만 보내는 규칙과, kNN이 정상 쪽이라고 하는(margin>0) 것만 보내는 규칙을 비교한다.",
        "The 21 false positives out of 400 benign sessions, placed on the score axis. Compare sending only ambiguous scores with sending only sessions kNN puts on the benign side (margin > 0)."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "band", label: K.t("점수 밴드 [0.5, 0.9)", "Score band [0.5, 0.9)") },
      { value: "margin", label: K.t("kNN margin > 0", "kNN margin > 0") }], rule, function (v) { rule = v; render(); }, K.t("라우팅 규칙", "Routing rule"));
    bar.appendChild(sg.el);
    root.appendChild(bar);

    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 112", role: "img",
      "aria-label": K.t("오탐 21건의 점수 분포", "Scores of the 21 false positives") }, root);
    var X0 = 20, X1 = 460;
    function X(v) { return X0 + (v - 0.5) / 0.5 * (X1 - X0); }
    var band = K.svg("rect", { x: X(0.5), y: 8, width: X(0.9) - X(0.5), height: 70, fill: "var(--tca-warn)", opacity: 0.12 }, sv);
    K.svg("line", { x1: X0, x2: X1, y1: 82, y2: 82, stroke: "var(--tertiary)", "stroke-width": 2 }, sv);
    [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(function (v) {
      K.svg("line", { x1: X(v), x2: X(v), y1: 82, y2: 88, stroke: "var(--tertiary)" }, sv);
      var t = K.svg("text", { x: X(v), y: 102, "font-size": 12, "text-anchor": v === 1 ? "end" : "middle", "class": "muted" }, sv);
      t.textContent = v.toFixed(1);
    });
    var bandTxt = K.svg("text", { x: X(0.7), y: 22, "font-size": 12, "text-anchor": "middle", "class": "muted" }, sv);
    bandTxt.textContent = K.t("애매한 밴드", "ambiguous band");
    var dots = FP.map(function (v, k) {
      var y = v < 0.9 ? 60 : 70 - (k % 6) * 10;
      return { v: v, e: K.svg("circle", { cx: X(v).toFixed(1), cy: y, r: 5.5, "stroke-width": 2 }, sv) };
    });

    var rows = rowsBox("92px", "92px");
    rows.style.marginTop = "8px";
    var hd = K.el("div", "tca-h", K.t("2차로 가는 비율", "Share sent to stage 2"));
    root.appendChild(hd);
    var R = [
      { r: addRow(rows, K.t("정상 오탐", "Benign FP"), "var(--tca-bad)"), band: 3 / 21, margin: 1, lab: ["3/21", "21/21"] },
      { r: addRow(rows, "RED QUEEN", "var(--tca-accent)"), band: null, margin: 0.33 },
      { r: addRow(rows, "hh-rlhf", "var(--tca-accent)"), band: null, margin: 0.35 },
      { r: addRow(rows, "MHJ", "var(--tca-accent)"), band: null, margin: 0.12 }
    ];
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "건수와 비율은 글 본문 값이다. 점의 정확한 위치는 예시이고, 밴드 안 3건과 0.9 이상 18건이라는 나뉨만 글을 따른다. 공격 쪽의 밴드 비율은 글에 없다(공격은 대부분 0.9 위였다고만 적혀 있다).",
      "Counts and rates are from the post. Exact dot positions are examples; only the split of 3 in the band and 18 at 0.9 or above follows the post. The post gives no band share for attacks (it only says most scored above 0.9).")));

    function render() {
      band.setAttribute("opacity", rule === "band" ? 0.16 : 0.05);
      dots.forEach(function (d) {
        var sent = rule === "margin" || d.v < 0.9;
        d.e.setAttribute("fill", sent ? "var(--tca-bad)" : "none");
        d.e.setAttribute("stroke", sent ? "var(--tca-bad)" : "var(--secondary)");
      });
      R.forEach(function (x) {
        var v = x[rule];
        if (v === null) { x.r.f.style.width = "0"; x.r.na.style.display = ""; x.r.v.textContent = ""; return; }
        x.r.na.style.display = "none"; x.r.f.style.width = v * 100 + "%";
        x.r.v.textContent = x.lab ? x.lab[rule === "band" ? 0 : 1] + " · " + Math.round(v * 100) + "%" : Math.round(v * 100) + "%";
      });
      read.textContent = rule === "band"
        ? K.t("채운 점이 2차로 간다. 오탐의 86%가 0.9 이상 확신 구간에 있어 밴드 규칙은 오탐의 14%만 건드린다.",
          "Filled dots go to stage 2. 86% of false positives sit in the confident zone at 0.9 or above, so the band rule touches only 14%.")
        : K.t("오탐은 전부 margin>0이라 모두 2차로 간다. 1차가 잡은 진짜 공격은 12~35%만 2차에 노출된다.",
          "Every false positive has margin > 0, so all go to stage 2, while only 12–35% of the real attacks stage 1 caught are exposed to it.");
    }
    render();
  });

  // 2) 2차와 사각지대가 겹치는 계열을 빼기
  K.register("second-route-steps", function (root) {
    var ST = [
      { name: K.t("2차 없음", "No stage 2"), fp: 4.7, rq: 0.70, dk: 0.92,
        msg: K.t("CPU 단독 분류기의 출발점.", "Starting point: the CPU-only classifier.") },
      { name: K.t("margin>0 · 암호 제외 → 2차", "margin>0 · no cipher → stage 2"), fp: 1.3, rq: 0.58, dk: 0.76,
        msg: K.t("오탐은 4.7% → 1.3%. 그런데 라우팅된 RED QUEEN 공격의 절반 가까이를 SLM이 정상으로 되돌렸다. margin>0인 진짜 공격은 대부분 역할극·허구 프레이밍이었고, SLM은 바로 거기에 속는다.",
          "False positives 4.7% → 1.3%, but the SLM sent nearly half of the routed RED QUEEN attacks back as benign. Real attacks with margin > 0 were mostly role-play or fiction framing, exactly what fools the SLM.") },
      { name: K.t("+ 프레이밍 단서도 제외", "+ exclude framing cues"), fp: null, rq: 0.70, dk: 0.85,
        msg: K.t("RED QUEEN 은 원상 복구, DukeCEI 는 일부만 회복했다. 정규식이 은근한 화이트칼라 프레이밍을 다 못 잡아서다.",
          "RED QUEEN fully recovered; DukeCEI only partly, because the regex misses subtle white-collar framing.") }
    ];
    var RULE = [
      { t: K.t("BERT 양성", "BERT positive"), on: [0, 1, 2] },
      { t: "kNN margin > 0", on: [1, 2] },
      { t: K.t("암호 계열 아님", "not cipher"), on: [1, 2] },
      { t: K.t("역할극·허구·권위 사칭 단서 없음", "no role-play / fiction / authority cue"), on: [2] },
      { t: K.t("→ 2차 SLM, 정상이면 하향", "→ stage-2 SLM, downgrade if benign"), on: [1, 2] }
    ];
    var cur = 0;

    K.head(root, K.t("2차가 약한 계열은 겹쳐도 뺀다", "Exclude the families stage 2 is weak on"),
      K.t("라우팅 규칙을 한 단계씩 바꾼 결과다. 옅은 막대는 2차가 없을 때 값이다.",
        "Results as the routing rule changes step by step. Pale bars are the values without stage 2."));
    var bar = K.el("div", "tca-bar");
    var bPrev = K.btn(K.t("← 이전", "← Back")), bNext = K.btn(K.t("다음 단계 →", "Next step →"));
    var stepLbl = K.el("span", "tca-num");
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(stepLbl);
    root.appendChild(bar);
    var ruleBox = K.el("div", "so-rule");
    var chips = RULE.map(function (r) { var c = K.el("span", "tca-tag", r.t); ruleBox.appendChild(c); return c; });
    root.appendChild(ruleBox);

    var rows = rowsBox("96px", "84px");
    var rF = addRow(rows, K.t("정상 오탐률", "Benign FP rate"), "var(--tca-bad)");
    var rR = addRow(rows, K.t("RED QUEEN 재현율", "RED QUEEN recall"), "var(--tca-good)");
    var rD = addRow(rows, K.t("DukeCEI 재현율", "DukeCEI recall"), "var(--tca-good)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "숫자는 글 본문 값이다. 오탐률 막대는 0~5% 눈금으로, 재현율 막대는 0~1 눈금으로 그렸다. 프레이밍 제외 뒤의 오탐률은 글에 숫자가 없다.",
      "Numbers are from the post. The FP bar uses a 0–5% scale, recall bars 0–1. The post gives no FP rate after excluding framing.")));

    function set(r, v, base, scale, fmt) {
      r.g.style.width = Math.min(100, base / scale * 100) + "%";
      if (v === null) { r.f.style.width = "0"; r.na.style.display = ""; r.v.textContent = ""; return; }
      r.na.style.display = "none"; r.f.style.width = Math.min(100, v / scale * 100) + "%"; r.v.textContent = fmt(v);
    }
    function render() {
      var s = ST[cur], b = ST[0];
      stepLbl.textContent = (cur + 1) + "/3 · " + s.name;
      bPrev.disabled = cur === 0; bNext.disabled = cur === ST.length - 1;
      chips.forEach(function (c, i) {
        var on = RULE[i].on.indexOf(cur) >= 0;
        c.className = "tca-tag " + (on ? "on" : "off");
      });
      set(rF, s.fp, b.fp, 5, function (v) { return v.toFixed(1) + "%"; });
      set(rR, s.rq, b.rq, 1, function (v) { return v.toFixed(2); });
      set(rD, s.dk, b.dk, 1, function (v) { return v.toFixed(2); });
      read.textContent = s.msg;
    }
    bPrev.addEventListener("click", function () { if (cur > 0) { cur--; render(); } });
    bNext.addEventListener("click", function () { if (cur < ST.length - 1) { cur++; render(); } });
    render();
  });
})();
