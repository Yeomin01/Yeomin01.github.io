/* 「기본 임계끼리 견주면 아무것도 견준 게 아니다」 글의 그림: 각자 기본 임계에서 본 숫자와 같은 오탐률에서 본 숫자가 다른 결론을 내는 모습 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("thr-operating-point", function (root) {
    // 설명용 예시 분포: 정상 N(0,1), 공격 N(mu,1). 기본 임계는 모델의 성질이라 셋이 바뀌어도 그대로다.
    var DEF = { A: -0.6, B: 2.6 };
    var SETS = { s1: { A: 2.2, B: 1.2 }, s2: { A: 0.9, B: 2.6 } };
    var Z = { 2: 2.054, 5: 1.645, 10: 1.282 }; // 정상 오탐률 f 에 맞는 임계
    var set = "s1", op = "def";
    var cur = { A: DEF.A, B: DEF.B }, X0 = -3.5, X1 = 6;

    function erf(x) {
      var s = x < 0 ? -1 : 1; x = Math.abs(x);
      var t = 1 / (1 + 0.3275911 * x);
      var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return s * y;
    }
    function Phi(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
    function pdf(x, m) { return Math.exp(-0.5 * (x - m) * (x - m)) / 2.5066; }
    function target(m) { return op === "def" ? DEF[m] : Z[op]; }

    K.head(root, K.t("임계를 어디에 두고 견주는가", "Where the thresholds sit when you compare"),
      K.t("두 모델의 점수 분포(예시)다. 각자 기본 임계에 두면 한쪽은 많이 잡고 오탐도 많고, 다른 쪽은 거의 안 잡고 오탐도 없다. 오탐률을 같은 값으로 맞추면 재현율과 분리도로 견줄 수 있다.",
        "Score distributions for two models (example). At their own default thresholds one catches a lot with many false alarms, the other catches almost nothing with none. Matching the false-alarm rate lets you compare recall and separation."));

    var bar = K.el("div", "tca-bar");
    var sSeg = K.seg([{ value: "s1", label: K.t("셋 1(예시)", "Set 1 (example)") }, { value: "s2", label: K.t("셋 2(예시)", "Set 2 (example)") }], set,
      function (v) { set = v; draw(); }, K.t("평가 셋", "Eval set"));
    var oSeg = K.seg([{ value: "def", label: K.t("각자 기본 임계", "Own defaults") }, { value: 2, label: K.t("오탐 2%", "FPR 2%") },
      { value: 5, label: K.t("오탐 5%", "FPR 5%") }, { value: 10, label: K.t("오탐 10%", "FPR 10%") }], op,
      function (v) { op = v; }, K.t("운영점", "Operating point"));
    bar.appendChild(sSeg.el); bar.appendChild(oSeg.el);
    root.appendChild(bar);

    var W = 480, PH = 100, s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 236", role: "img", "aria-label": K.t("두 모델의 점수 분포와 임계", "Score distributions and thresholds of two models") }, root);
    function px(x) { return 16 + (x - X0) / (X1 - X0) * (W - 32); }
    function panel(m, y0) {
      var g = K.svg("g", { transform: "translate(0," + y0 + ")" }, s);
      var fB = K.svg("path", { fill: "var(--tca-bad)", opacity: 0.35 }, g);
      var fA = K.svg("path", { fill: "var(--tca-accent)", opacity: 0.3 }, g);
      var cB = K.svg("path", { fill: "none", stroke: "var(--secondary)", "stroke-width": 1.5 }, g);
      var cA = K.svg("path", { fill: "none", stroke: "var(--tca-accent)", "stroke-width": 1.8 }, g);
      K.svg("line", { x1: 16, y1: PH - 14, x2: W - 16, y2: PH - 14, stroke: "var(--tertiary)" }, g);
      K.svg("text", { x: 16, y: 14, "font-size": 13, "font-weight": 600 }, g).textContent = K.t("모델 ", "Model ") + m;
      var tl = K.svg("line", { y1: 14, y2: PH - 14, stroke: "var(--primary)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }, g);
      var tt = K.svg("text", { y: PH - 1, "font-size": 12, "text-anchor": "middle" }, g);
      tt.textContent = K.t("임계", "threshold");
      return { fB: fB, fA: fA, cB: cB, cA: cA, tl: tl, tt: tt };
    }
    var P = { A: panel("A", 0), B: panel("B", 112) };
    var lg = K.svg("g", { transform: "translate(0,222)" }, s);
    [[16, "var(--secondary)", K.t("정상 점수", "benign")], [120, "var(--tca-accent)", K.t("공격 점수", "attack")],
      [216, "var(--tca-bad)", K.t("임계 위 정상 = 오탐", "benign above = false alarm")]].forEach(function (l) {
      K.svg("rect", { x: l[0], y: 0, width: 12, height: 10, rx: 2, fill: l[1], opacity: 0.7 }, lg);
      K.svg("text", { x: l[0] + 16, y: 10, "font-size": 12, "class": "muted" }, lg).textContent = l[2];
    });

    function curve(m, from, area) {
      var h = PH - 34, d = "", n = 80;
      var a = area ? Math.max(X0, Math.min(X1, from)) : X0;
      for (var i = 0; i <= n; i++) {
        var x = a + (X1 - a) * i / n, y = PH - 14 - pdf(x, m) / 0.4 * h;
        d += (i ? "L" : "M") + px(x).toFixed(1) + " " + y.toFixed(1);
      }
      if (area) d += "L" + px(X1).toFixed(1) + " " + (PH - 14) + "L" + px(a).toFixed(1) + " " + (PH - 14) + "Z";
      return d;
    }

    var tbl = K.el("div", "tca-rows");
    tbl.style.marginTop = "8px";
    var head = K.el("div", "tca-row");
    head.style.fontSize = "12.5px"; head.style.color = "var(--secondary)";
    ["", K.t("오탐률", "FPR"), K.t("재현율", "Recall"), K.t("분리도", "AUROC")].forEach(function (h, i) {
      var c = K.el("div", i ? "tca-num" : "", h); c.style.flex = i ? "1" : "none"; c.style.width = i ? "" : "64px"; c.style.textAlign = i ? "right" : "left";
      head.appendChild(c);
    });
    tbl.appendChild(head);
    var cells = {};
    ["A", "B"].forEach(function (m) {
      var r = K.el("div", "tca-row");
      var l = K.el("div", "", K.t("모델 ", "Model ") + m); l.style.width = "64px"; l.style.flex = "none"; l.style.fontWeight = "600";
      r.appendChild(l);
      cells[m] = [0, 1, 2].map(function () { var c = K.el("div", "tca-num", ""); c.style.flex = "1"; c.style.textAlign = "right"; r.appendChild(c); return c; });
      tbl.appendChild(r);
    });
    root.appendChild(tbl);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "분포와 값은 설명용 예시다(정규분포 가정). 본문의 실제 값: 공격 도구가 만든 셋에서 분리도 우리 0.957 · 다른 모델 0.74~0.81, 오탐 5%에서 재현율 0.64 대 0.32. 사람이 만든 의도 은닉형 셋에서는 분리도 우리 0.77 · 다른 두 모델 0.96과 0.88.",
      "Distributions and values are illustrative (normal assumption). Actual values in the post: on the tool-generated set, AUROC ours 0.957 vs. others 0.74–0.81, recall at 5% FPR 0.64 vs. 0.32; on the human-written concealed-intent set, AUROC ours 0.77 vs. 0.96 and 0.88.")));

    function pct(v) { var x = v * 100; return (x < 1 || (x > 99 && x < 100) ? x.toFixed(1) : x.toFixed(0)) + "%"; }
    function draw() {
      var mu = SETS[set], res = {};
      ["A", "B"].forEach(function (m) {
        var t = cur[m], p = P[m];
        p.cB.setAttribute("d", curve(0, 0, false));
        p.cA.setAttribute("d", curve(mu[m], 0, false));
        p.fB.setAttribute("d", curve(0, t, true));
        p.fA.setAttribute("d", curve(mu[m], t, true));
        var x = px(Math.max(X0, Math.min(X1, t))).toFixed(1);
        p.tl.setAttribute("x1", x); p.tl.setAttribute("x2", x); p.tt.setAttribute("x", x);
        var fpr = 1 - Phi(t), rec = 1 - Phi(t - mu[m]), auc = Phi(mu[m] / Math.SQRT2);
        res[m] = { fpr: fpr, rec: rec };
        cells[m][0].textContent = pct(fpr);
        cells[m][1].textContent = pct(rec);
        cells[m][2].textContent = auc.toFixed(2);
      });
      var a = res.A, b = res.B;
      if (op === "def") {
        read.textContent = K.t("기본 임계 표 — A 오탐 ", "Default table — A FPR ") + pct(a.fpr) + K.t(" · 재현율 ", " · recall ") + pct(a.rec) +
          K.t(" / B 오탐 ", " / B FPR ") + pct(b.fpr) + K.t(" · 재현율 ", " · recall ") + pct(b.rec) +
          K.t(". 이 표는 모델이 아니라 각자 다른 자리에 놓인 임계를 견준다.", ". This table compares where each threshold sits, not the models.");
      } else {
        var win = a.rec > b.rec ? "A" : "B";
        read.textContent = K.t("오탐률을 ", "With FPR fixed at ") + op + K.t("%로 맞추면 재현율 A ", "%, recall A ") + pct(a.rec) + " · B " + pct(b.rec) +
          K.t(" — 같은 자리에서 더 잘 잡는 쪽은 모델 ", " — the better catcher at the same point is model ") + win + K.t("다.", ".");
      }
    }
    K.loop(root, function (dt) {
      var moved = false;
      ["A", "B"].forEach(function (m) {
        var g = target(m), d = g - cur[m];
        if (Math.abs(d) < 0.002) { if (cur[m] !== g) { cur[m] = g; moved = true; } return; }
        cur[m] += d * Math.min(1, K.reduce ? 1 : dt / 120);
        moved = true;
      });
      if (moved) draw();
    });
    draw();
  });
})();
