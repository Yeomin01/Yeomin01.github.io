/* 「재학습 대신 상수 두 개를 고쳤다」 글의 그림: 누적 게이트 임계를 움직이며 오탐과 공격을 같이 세기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  K.register("gate-sweep", function (root) {
    // 영역별 점 개수 (예시 배치). b=정상(old: 상담·공개 대화, new: 문서·코드), a=공격
    var R = [
      { x: [0.04, 0.40], y: [0.04, 0.40], old: 60, neu: 40, atk: 3 },
      { x: [0.40, 0.50], y: [0.04, 0.48], old: 5, neu: 6, atk: 2 },
      { x: [0.04, 0.40], y: [0.40, 0.50], old: 3, neu: 4, atk: 1 },
      { x: [0.50, 0.60], y: [0.04, 0.50], old: 2, neu: 15, atk: 2 },
      { x: [0.04, 0.50], y: [0.50, 0.60], old: 2, neu: 10, atk: 2 },
      { x: [0.50, 0.60], y: [0.50, 0.60], old: 0, neu: 2, atk: 1 },
      { x: [0.60, 0.70], y: [0.04, 0.60], old: 1, neu: 5, atk: 5 },
      { x: [0.04, 0.60], y: [0.60, 0.70], old: 0, neu: 3, atk: 3 },
      { x: [0.70, 0.96], y: [0.04, 0.96], old: 1, neu: 2, atk: 14 },
      { x: [0.04, 0.70], y: [0.70, 0.96], old: 0, neu: 2, atk: 8 }
    ];
    var r = rng(21), PTS = [];
    function inside(a) { return a[0] + 0.012 + r() * (a[1] - a[0] - 0.024); }
    R.forEach(function (g) {
      [["old", g.old], ["neu", g.neu], ["atk", g.atk]].forEach(function (p) {
        for (var i = 0; i < p[1]; i++) { var x = inside(g.x), y = inside(g.y); PTS.push({ k: p[0], x: x, y: y, mx: Math.min(0.9, Math.max(x, y) + 0.05) }); }
      });
    });
    var BASE = 0.5, STEP = 0.1, MAXT = 0.95;
    var km = 0, ks = 0, newFmt = true, maxOn = true;
    function th(k) { return BASE + STEP * k; }
    function lab(k) { return k === 0 ? K.t("기준", "base") : (k > 0 ? "+" : "−") + Math.abs(k) + K.t("단계", " step"); }

    K.head(root, K.t("누적 게이트의 임계 두 개를 다시 스윕하기", "Re-sweeping the two cumulative-gate thresholds"),
      K.t("점 하나가 1차 점수가 낮아 누적 게이트까지 온 세션이다. 색칠된 영역에 들어가면 게이트가 공격으로 올린다. 임계를 움직이면 줄어드는 오탐과 잃는 공격이 함께 세어진다.",
        "Each dot is a session with a low stage-one score that reaches the cumulative gate. Inside the shaded area the gate raises it to attack. Move the thresholds to count false positives removed and attacks lost together."));

    var bar = K.el("div", "tca-bar");
    var sM = K.slider({ label: K.t("평균 임계", "Mean threshold"), min: -1, max: 2, step: 1, value: km, fmt: lab, onInput: function (v) { km = v; render(); } });
    var sS = K.slider({ label: K.t("단일 턴 임계", "Single-turn threshold"), min: -1, max: 2, step: 1, value: ks, fmt: lab, onInput: function (v) { ks = v; render(); } });
    bar.appendChild(sM.el); bar.appendChild(sS.el);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var sFmt = K.seg([{ value: false, label: K.t("예전 보정 데이터만", "Old calibration data only") }, { value: true, label: K.t("형식별 정상 포함", "With per-format benign") }],
      newFmt, function (v) { newFmt = v; render(); }, K.t("정상 데이터", "Benign data"));
    var bMax = K.btn(K.t("최대값 조건 켬", "Max condition on"), maxOn);
    var bPick = K.btn(K.t("본문 조합 (둘 다 +1단계)", "The post's choice (both +1)"));
    var bBase = K.btn(K.t("기준으로", "Back to base"));
    bar2.appendChild(sFmt.el); bar2.appendChild(bMax); bar2.appendChild(bPick); bar2.appendChild(bBase);
    root.appendChild(bar2);

    var X0 = 52, X1 = 470, Y0 = 8, Y1 = 250;
    var svg = K.svg("svg", { viewBox: "0 0 480 290", "class": "tca-svg", role: "img", "aria-label": K.t("세션 점수 산점도와 게이트 영역", "Session scores and gate area") });
    root.appendChild(svg);
    function sx(v) { return X0 + v * (X1 - X0); }
    function sy(v) { return Y1 - v * (Y1 - Y0); }
    var zoneX = K.svg("rect", { y: Y0, height: Y1 - Y0, fill: "var(--tca-accent)", opacity: 0.13 }, svg);
    var zoneY = K.svg("rect", { x: X0, height: 0, fill: "var(--tca-accent)", opacity: 0.13 }, svg);
    var lineX = K.svg("line", { y1: Y0, y2: Y1, stroke: "var(--tca-accent)", "stroke-width": 1.5, "stroke-dasharray": "5 3" }, svg);
    var lineY = K.svg("line", { x1: X0, x2: X1, stroke: "var(--tca-accent)", "stroke-width": 1.5, "stroke-dasharray": "5 3" }, svg);
    K.svg("rect", { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: "none", stroke: "var(--tertiary)" }, svg);
    var ax = K.svg("text", { x: X1, y: Y1 + 18, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg); ax.textContent = K.t("턴별 부분 점수 평균 →", "mean of per-turn scores →");
    var ay = K.svg("text", { x: 14, y: Y1, "font-size": 12, "class": "muted", transform: "rotate(-90 14 " + Y1 + ")" }, svg); ay.textContent = K.t("단일 턴 점수 →", "single-turn score →");
    var g = K.svg("g", null, svg);
    var els = PTS.map(function (p) {
      var e;
      if (p.k === "atk") e = K.svg("path", { d: "M" + (sx(p.x) - 4) + " " + (sy(p.y) - 4) + "l8 8m0 -8l-8 8", stroke: K.COLORS[2], "stroke-width": 2 }, g);
      else e = K.svg("circle", { cx: sx(p.x), cy: sy(p.y), r: 3.6, fill: p.k === "neu" ? K.COLORS[0] : "none", stroke: K.COLORS[0], "stroke-width": 1.5 }, g);
      return e;
    });
    var lg = K.el("div", "tca-legend");
    function li(sw, t) { var s = K.el("span"); s.appendChild(sw); s.appendChild(document.createTextNode(t)); lg.appendChild(s); }
    var i1 = K.el("i"); i1.style.border = "1.5px solid " + K.COLORS[0]; i1.style.borderRadius = "50%"; i1.style.width = "10px";
    var i2 = K.el("i"); i2.style.background = K.COLORS[0]; i2.style.borderRadius = "50%"; i2.style.width = "10px";
    var i3 = K.el("i"); i3.textContent = "×"; i3.style.color = K.COLORS[2]; i3.style.fontStyle = "normal"; i3.style.fontWeight = "700"; i3.style.width = "10px"; i3.style.height = "auto";
    li(i1, K.t("정상 — 상담·공개 대화", "benign — counselling, public chat"));
    li(i2, K.t("정상 — 문서·코드", "benign — documents, code"));
    li(i3, K.t("공격", "attack"));
    root.appendChild(lg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var read2 = K.el("div", "tca-note");
    root.appendChild(read2);
    root.appendChild(K.el("div", "tca-note", K.t(
      "점 배치는 예시 값이다. 두 임계를 한 단계씩 올렸을 때의 변화(오탐 31건 감소, 공격 5건 손실)만 본문 값에 맞춰 두었다. 최대값 조건은 본문대로 현재 점수 분포에서 한 번도 발동하지 않게 두었다.",
      "Dot positions are examples. Only the change for raising both thresholds one step (31 fewer false positives, 5 attacks lost) matches the post. As in the post, the max condition never fires on this score distribution.")));

    function count(m, s, useNew, mx) {
      var fp = 0, atk = 0, onlyMax = 0;
      PTS.forEach(function (p) {
        if (p.k === "neu" && !useNew) return;
        var hit = p.x >= m || p.y >= s, viaMax = mx && p.mx >= MAXT;
        if (!hit && viaMax) onlyMax++;
        if (hit || viaMax) { if (p.k === "atk") atk++; else fp++; }
      });
      return { fp: fp, atk: atk, onlyMax: onlyMax };
    }
    function render() {
      var m = th(km), s = th(ks);
      zoneX.setAttribute("x", sx(m)); zoneX.setAttribute("width", X1 - sx(m));
      zoneY.setAttribute("y", Y0); zoneY.setAttribute("height", sy(s) - Y0); zoneY.setAttribute("width", X1 - X0);
      lineX.setAttribute("x1", sx(m)); lineX.setAttribute("x2", sx(m));
      lineY.setAttribute("y1", sy(s)); lineY.setAttribute("y2", sy(s));
      PTS.forEach(function (p, i) {
        var show = p.k !== "neu" || newFmt, hit = p.x >= m || p.y >= s;
        els[i].style.display = show ? "" : "none";
        els[i].setAttribute("opacity", hit ? 1 : 0.4);
      });
      var c = count(m, s, newFmt, maxOn), b = count(th(0), th(0), newFmt, maxOn);
      var dF = c.fp - b.fp, dA = c.atk - b.atk, txt;
      if (!dF && !dA) txt = K.t("기준과 같다.", "Same as base.");
      else {
        txt = K.t("기준 대비 오탐 ", "Versus base: false positives ") + (dF > 0 ? "+" : dF < 0 ? "−" : "±") + Math.abs(dF) + K.t(" · 공격 ", " · attacks ") + (dA > 0 ? "+" : dA < 0 ? "−" : "±") + Math.abs(dA);
        if (dF < 0 && dA < 0) txt += K.t(" → 약 " + (-dF / -dA).toFixed(1) + " 대 1 교환", " → about " + (-dF / -dA).toFixed(1) + " to 1");
        else if (dF < 0 && dA === 0) txt += K.t(" → 공격 손실 없이 오탐만 준다", " → fewer false positives at no attack cost");
      }
      read.textContent = K.t("게이트가 올린 세션 — 정상(오탐) ", "Raised by the gate — benign (false positive) ") + c.fp + K.t(" · 공격 ", " · attack ") + c.atk + ". " + txt;
      read2.textContent = (newFmt ? "" : K.t("문서·코드 정상을 빼면 기준 임계의 오탐이 " + b.fp + "건뿐이라 임계가 충분해 보인다. ", "Without document and code benign the base threshold shows only " + b.fp + " false positives and looks fine. ")) +
        K.t("최대값 조건으로만 걸린 세션 ", "Sessions caught only by the max condition: ") + c.onlyMax + K.t("건 — 켜도 꺼도 결과가 같다.", " — on or off, the result is the same.");
    }
    bMax.addEventListener("click", function () { maxOn = !maxOn; K.press(bMax, maxOn); bMax.textContent = maxOn ? K.t("최대값 조건 켬", "Max condition on") : K.t("최대값 조건 무력화", "Max condition disabled"); render(); });
    bPick.addEventListener("click", function () { km = 1; ks = 1; sM.set(1); sS.set(1); render(); });
    bBase.addEventListener("click", function () { km = 0; ks = 0; sM.set(0); sS.set(0); render(); });
    render();
  });
})();
