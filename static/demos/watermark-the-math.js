/* 「워터마킹의 계산」 글의 그림: 중심화한 H로 상한을 재면 편향 이동이 빠지는 모습, 임계값 근처 밀도로 뒤집힘 기대값을 미리 세기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("watermark-the-math-css", [
    '.tca[data-demo="wmm-center"] .wc-tr{position:relative;flex:1;min-width:0;height:18px;background:var(--code-bg);border-radius:3px;overflow:hidden}',
    '.tca[data-demo="wmm-center"] .wc-tr i{position:absolute;top:0;bottom:0;display:block}',
    '.tca[data-demo="wmm-center"] .wc-tr .dl{width:2px;background:var(--primary);z-index:2}',
    '.tca[data-demo="wmm-flips"] .wf-dot{transition:fill .25s}'
  ].join(""));

  /* 1. 평균을 빼고 상한을 재면 */
  K.register("wmm-center", function (root) {
    var MAXD = 7, G0 = 1.6; // 축 끝(δ 단위), κ로 줄이기 전 배율
    var mode = "c", g = 1;
    var FIN = { c: { com: 3, varp: 1 }, u: { com: 0.75, varp: 0.25 } }; // 최종 상태(δ 단위)
    K.head(root, K.t("상한을 어디서 재는가 — 평균을 빼면", "Where the bound is measured — centering"),
      K.t("κ로 변화를 줄여 '잰 최대 로짓 변화'를 상한 δ에 맞춘다. 중심화한 H로 재면 모든 문장에 공통인 편향 이동이 계산에서 빠져서, 다 줄인 뒤에도 실제 최대가 δ를 넘는다.",
        "κ shrinks the change until the measured maximum logit change meets δ. Measured on centered H, the shift common to all sentences drops out, so the real maximum still overshoots."));
    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: "c", label: K.t("중심화한 H (평균을 뺌)", "Centered H (mean removed)") }, { value: "u", label: K.t("비중심화 H", "Uncentered H") }],
      mode, function (v) { mode = v; g = K.reduce ? 1 : G0; paint(); }, K.t("상한을 재는 행렬", "Matrix for the bound"));
    var bAgain = K.btn(K.t("κ 다시 맞추기", "Re-fit κ"));
    bAgain.addEventListener("click", function () { g = K.reduce ? 1 : G0; paint(); });
    bar.appendChild(seg.el); bar.appendChild(bAgain);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "118px");
    rows.style.setProperty("--tca-rw", "56px");
    function row(label) {
      var r = K.el("div", "tca-row"), l = K.el("div", "tca-row-l", label), tr = K.el("div", "wc-tr"), v = K.el("div", "tca-row-r");
      var a = document.createElement("i"), b = document.createElement("i"), d = document.createElement("i");
      a.style.background = K.COLORS[1]; b.style.background = K.COLORS[0]; d.className = "dl"; d.style.left = (100 / MAXD) + "%";
      tr.appendChild(a); tr.appendChild(b); tr.appendChild(d);
      r.appendChild(l); r.appendChild(tr); r.appendChild(v); rows.appendChild(r);
      return { a: a, b: b, v: v };
    }
    var rM = row(K.t("잰 최대 변화", "Measured max")), rA = row(K.t("실제 최대 변화", "Real max"));
    root.appendChild(rows);
    var lg = K.el("div", "tca-legend");
    [[K.COLORS[1], K.t("모든 문장에 공통인 부분 A V_lowᵀ μ (편향 이동)", "Common part A V_lowᵀ μ (bias shift)")], [K.COLORS[0], K.t("문장마다 다른 부분 A V_lowᵀ (h − μ)", "Per-sentence part A V_lowᵀ (h − μ)")],
      ["var(--primary)", K.t("세로선 = 상한 δ", "Line = bound δ")]].forEach(function (x) {
      var sp = K.el("span", ""), ic = document.createElement("i"); ic.style.background = x[0]; sp.appendChild(ic); sp.appendChild(document.createTextNode(x[1])); lg.appendChild(sp);
    });
    root.appendChild(lg);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "'4배 초과'는 본문 실측이다. 공통분과 변동분이 같은 방향으로 더해진다고 두고 3:1로 나눈 것은 예시다. 본문 실측으로 저에너지 방향에서 변동분은 111배 줄지만 상수분은 6.6배밖에 안 줄어, 공통분이 크게 남는다.",
      "The 4× overshoot is measured in the post; the 3:1 split assumes both parts add in the same direction. In low-energy directions the varying part shrinks 111× but the constant only 6.6×, so the common part stays large.")));

    function w(v) { return Math.min(100, 100 * v / MAXD); }
    function paint() {
      var f = FIN[mode], com = f.com * g, vp = f.varp * g;
      var meas = mode === "c" ? vp : com + vp, real = com + vp;
      if (mode === "c") { rM.a.style.left = "0"; rM.a.style.width = "0"; rM.b.style.left = "0"; rM.b.style.width = w(vp) + "%"; }
      else { rM.a.style.left = "0"; rM.a.style.width = w(com) + "%"; rM.b.style.left = w(com) + "%"; rM.b.style.width = w(vp) + "%"; }
      rA.a.style.left = "0"; rA.a.style.width = w(com) + "%"; rA.b.style.left = w(com) + "%"; rA.b.style.width = w(vp) + "%";
      rM.v.textContent = meas.toFixed(2) + "δ"; rA.v.textContent = real.toFixed(2) + "δ";
      if (g > 1) { read.textContent = K.t("κ로 줄이는 중… 잰 값이 δ에 닿으면 멈춘다", "Shrinking with κ… stops when the measured value reaches δ"); read.className = "tca-read"; return; }
      read.textContent = mode === "c"
        ? K.t("잰 최대는 δ에 딱 맞았지만 실제 최대는 4.00δ — 상한을 지켰다고 믿은 판본이 4배를 넘었다.", "Measured max meets δ, real max is 4.00δ — the 'bounded' version overshot 4×.")
        : K.t("편향 이동까지 재므로 잰 최대와 실제 최대가 같다(1.00δ).", "The bias shift is measured too, so measured and real max agree (1.00δ).");
      read.className = "tca-read " + (mode === "c" ? "tca-bad" : "tca-good");
    }
    K.loop(root, function (dt) {
      if (g <= 1) return;
      g = Math.max(1, g - (G0 - 1) * dt / 1500);
      paint();
    });
    g = K.reduce ? 1 : G0;
    paint();
  });

  /* 2. 뒤집힘을 미리 세기 */
  K.register("wmm-flips", function (root) {
    var RHO = 800, SPAN = 0.012;
    var STOPS = [0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01];
    var k = 3, shift = 0, anim = 0; // anim: 0 쉼, 1 미는 중, 2 멈춤
    var pts = [];
    for (var i = 0; i < 8; i++) { pts.push(-0.000625 - 0.00125 * i); pts.push(0.000625 + 0.00125 * i); }

    K.head(root, K.t("임계값 근처 밀도로 뒤집힘 세기", "Counting flips from density near the threshold"),
      K.t("점 하나가 임계값 ±0.01 안에 있는 문장 하나다(200만 중 16개). 점수 변화 상한 Δp를 고르고 점을 그만큼 밀어 보면, 경계를 넘는 점의 수가 E ≈ Δp × ρ 근처에 온다.",
        "Each dot is one of the 16 sentences (of 2M) within ±0.01 of the threshold. Pick the bound Δp and push the dots; the number crossing lands near E ≈ Δp × ρ."));
    var bar = K.el("div", "tca-bar");
    var sl = K.slider({ label: "Δp", min: 0, max: STOPS.length - 1, step: 1, value: k, fmt: function (j) { return fmtP(STOPS[j]); },
      onInput: function (j) { k = j; shift = 0; anim = 0; draw(); } });
    var bPush = K.btn(K.t("점수를 Δp 만큼 밀기", "Push scores by Δp"));
    bar.appendChild(sl.el); bar.appendChild(bPush);
    root.appendChild(bar);

    var W = 360, H = 118, X0 = 16, X1 = 344;
    function sx(v) { return X0 + (v + SPAN) / (2 * SPAN) * (X1 - X0); }
    var s = K.svg("svg", { viewBox: "0 0 " + W + " " + H, class: "tca-svg", role: "img", "aria-label": K.t("임계값 근처 점수 분포", "Scores near the threshold") });
    var band = K.svg("rect", { y: 22, height: 54, style: "fill:var(--tca-warn);opacity:.22" }, s);
    K.svg("line", { x1: X0, x2: X1, y1: 76, y2: 76, style: "stroke:var(--tertiary)" }, s);
    [-0.01, 0.01].forEach(function (v) { K.svg("line", { x1: sx(v), x2: sx(v), y1: 72, y2: 80, style: "stroke:var(--tertiary)" }, s); var tx = K.svg("text", { x: sx(v), y: 96, "text-anchor": "middle", "font-size": 12, class: "muted" }, s); tx.textContent = (v > 0 ? "θ+" : "θ−") + "0.01"; });
    K.svg("line", { x1: sx(0), x2: sx(0), y1: 14, y2: 80, "stroke-width": 2, style: "stroke:var(--primary)" }, s);
    var tTh = K.svg("text", { x: sx(0), y: 96, "text-anchor": "middle", "font-size": 12 }, s); tTh.textContent = K.t("임계값 θ", "threshold θ");
    var tBand = K.svg("text", { y: 16, "text-anchor": "end", "font-size": 12, class: "muted" }, s);
    var dots = pts.map(function (p, j) { return K.svg("circle", { cy: j % 4 < 2 ? 40 : 58, r: 5.5, class: "wf-dot" }, s); });
    var tL = K.svg("text", { x: X0, y: 112, "font-size": 12, class: "muted" }, s); tL.textContent = K.t("← 아래 판정", "← below");
    var tR = K.svg("text", { x: X1, y: 112, "font-size": 12, "text-anchor": "end", class: "muted" }, s); tR.textContent = K.t("위 판정 →", "above →");
    root.appendChild(s);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "ρ ≈ 800 (±0.01 안 16건 ÷ 0.02)과 Δp = 1e-3 에서 기대값 0.8건, 실제 0건은 본문 값이다. 점의 위치는 고르게 늘어놓은 예시이고, 모든 점을 위쪽으로 최대치만큼 민다고 두었다.",
      "ρ ≈ 800 (16 within ±0.01 ÷ 0.02), the 0.8 expected flips at Δp = 1e-3 and the 0 actual are from the post. Dot positions are an even example, and every dot is pushed up by the full bound.")));

    function fmtP(v) { var e = Math.floor(Math.log(v) / Math.LN10 + 1e-9), m = v / Math.pow(10, e); return Math.round(m) + "e" + e; }
    function draw() {
      var dp = STOPS[k];
      band.setAttribute("x", sx(-dp)); band.setAttribute("width", sx(0) - sx(-dp));
      tBand.setAttribute("x", sx(0) - 4); tBand.textContent = K.t("넘을 수 있는 띠", "band that can cross");
      var crossed = 0;
      pts.forEach(function (p, j) {
        var np = p + shift;
        dots[j].setAttribute("cx", sx(np));
        var c = p < 0 && np >= 0;
        if (c) crossed++;
        dots[j].style.fill = c ? "var(--tca-bad)" : p < 0 ? "var(--tca-accent)" : "var(--secondary)";
      });
      var E = RHO * dp;
      read.textContent = "E[" + K.t("뒤집힘", "flips") + "] ≈ " + fmtP(dp) + " × 800 = " + (E < 1 ? E.toFixed(2) : E.toFixed(1)) + K.t("건 (200만 중)", " of 2M") +
        (anim ? K.t(" · 예시 배치에서 넘어간 점 ", " · dots crossed in this layout ") + crossed + K.t("개", "") : "") +
        (k === 3 ? K.t(" · 본문: 기대 0.8건, 실제 0건", " · post: 0.8 expected, 0 actual") : "");
    }
    bPush.addEventListener("click", function () { shift = 0; anim = 1; if (K.reduce) { shift = STOPS[k]; anim = 2; } draw(); });
    var hold = 0;
    K.loop(root, function (dt) {
      if (K.reduce) return;
      if (anim === 1) {
        shift = Math.min(STOPS[k], shift + STOPS[k] * dt / 900);
        if (shift >= STOPS[k]) { anim = 2; hold = 0; }
        draw();
      } else if (anim === 2) {
        hold += dt;
        if (hold > 2600) { anim = 0; shift = 0; draw(); }
      }
    });
    draw();
  });
})();
