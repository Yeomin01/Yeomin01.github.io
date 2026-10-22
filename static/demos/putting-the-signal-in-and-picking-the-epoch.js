/* 「신호를 데이터로 넣고, 에폭으로 고르기」 글의 그림: in-domain f1 이 고르는 에폭과 게이트가 고르는 에폭 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="epochpick-gate"] ';
  K.css("putting-the-signal-in-and-picking-the-epoch-css", [
    S + ".ep-band{transition:transform .3s ease}",
    S + ".ep-tab{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,.8fr) minmax(0,.9fr) minmax(0,.6fr);",
    "gap:3px 8px;font-size:12.5px;margin-top:10px;align-items:baseline}",
    S + ".ep-tab .ep-th{color:var(--secondary);font-size:12px;border-bottom:1px solid var(--tertiary);padding-bottom:2px}",
    S + ".ep-tab .ep-v{font-variant-numeric:tabular-nums;text-align:right}",
    S + ".ep-tab .ep-c{text-align:center;font-weight:600}",
    "@media (prefers-reduced-motion:reduce){" + S + ".ep-band{transition:none}}"
  ].join(""));

  // 5·6 에폭의 일부 값만 본문 값이고 나머지는 예시 값이다(아래 메모 참고)
  var EP = [
    { f1: 0.962, ci: 0.55, wj: 0.61, co: 0.52, nd: -8, fp: 15.0 },
    { f1: 0.975, ci: 0.90, wj: 0.80, co: 0.58, nd: -3, fp: 9.0 },
    { f1: 0.982, ci: 0.97, wj: 0.55, co: 0.56, nd: 1, fp: 5.1 },
    { f1: 0.986, ci: 0.99, wj: 0.86, co: 0.59, nd: -6, fp: 4.0 },
    { f1: 0.990, ci: 0.99, wj: 0.83, co: 0.58, nd: -5, fp: 4.2 },
    { f1: 0.989, ci: 1.00, wj: 0.84, co: 0.58, nd: 0, fp: 3.8 },
    { f1: 0.988, ci: 0.96, wj: 0.48, co: 0.55, nd: 1, fp: 3.5 },
    { f1: 0.988, ci: 0.99, wj: 0.79, co: 0.57, nd: -2, fp: 4.6 }
  ];
  var BASE = { ci: 0.74, wj: 0.75, co: 0.57, fp: 22 }; // v5 기준선(본문)

  function checks(e) {
    return [
      { id: K.t("cipher 재현율", "cipher recall"), v: e.ci.toFixed(2), b: "≥ " + BASE.ci.toFixed(2), ok: e.ci >= BASE.ci },
      { id: K.t("wj_mt 재현율", "wj_mt recall"), v: e.wj.toFixed(2), b: "≥ " + BASE.wj.toFixed(2), ok: e.wj >= BASE.wj },
      { id: K.t("coreference 재현율", "coreference recall"), v: e.co.toFixed(2), b: "≥ " + BASE.co.toFixed(2), ok: e.co >= BASE.co },
      { id: K.t("정상 계열 재현율 변화", "Benign-family recall change"), v: (e.nd > 0 ? "+" : e.nd < 0 ? "−" : "") + Math.abs(e.nd) + "%p",
        b: K.t("하락 없음", "no drop"), ok: e.nd >= 0 },
      { id: K.t("실사용자 정상대화 오탐", "FP on real-user chats"), v: e.fp.toFixed(1) + "%", b: "< " + BASE.fp + "%", ok: e.fp < BASE.fp }
    ];
  }
  function pass(e) { return checks(e).every(function (c) { return c.ok; }); }

  K.register("epochpick-gate", function (root) {
    var bestF1 = 0, firstPass = -1;
    EP.forEach(function (e, i) { if (e.f1 > EP[bestF1].f1) bestF1 = i; if (firstPass < 0 && pass(e)) firstPass = i; });
    var cur = bestF1, playing = false, tAcc = 0;

    K.head(root, K.t("f1 이 고르는 에폭, 게이트가 고르는 에폭", "The epoch f1 picks, the epoch the gate picks"),
      K.t("에폭마다 in-domain f1 은 조금씩 오르내리지만, OOD 계열별 값은 크게 출렁인다. 에폭을 옮기며 게이트 항목이 어떻게 바뀌는지 본다.",
        "In-domain f1 moves a little per epoch, while per-family OOD numbers swing hard. Move across epochs and watch the gate items change."));

    var bar = K.el("div", "tca-bar");
    var sl = K.slider({ label: K.t("에폭", "Epoch"), min: 1, max: EP.length, step: 1, value: cur + 1,
      fmt: function (v) { return String(v); }, onInput: function (v) { stop(); cur = v - 1; render(); } });
    var bF1 = K.btn(K.t("f1 최고로 고르기", "Pick by best f1"));
    var bGate = K.btn(K.t("게이트로 고르기", "Pick by the gate"));
    var bPlay = K.btn(K.t("에폭 재생", "Play epochs"));
    bar.appendChild(sl.el); bar.appendChild(bF1); bar.appendChild(bGate); bar.appendChild(bPlay);
    root.appendChild(bar);

    var W = 320, H = 150, X0 = 60, DX = 34, Y0 = 96, Y1 = 26, LO = 0.95, HI = 1.0;
    function xx(i) { return X0 + i * DX; }
    function yy(v) { return Y0 - ((v - LO) / (HI - LO)) * (Y0 - Y1); }
    var svg = K.svg("svg", { viewBox: "0 0 " + W + " " + H, class: "tca-svg", role: "img",
      "aria-label": K.t("에폭별 in-domain f1 과 게이트 통과 여부", "In-domain f1 and gate result per epoch") });
    var band = K.svg("rect", { x: xx(0) - 15, y: 4, width: 30, height: H - 8, rx: 4, class: "ep-band",
      fill: "var(--tertiary)", "fill-opacity": "0.35" }, svg);
    K.svg("text", { x: 0, y: 64, "font-size": 12, class: "muted" }, svg).textContent = "f1";
    K.svg("text", { x: 0, y: 118, "font-size": 12, class: "muted" }, svg).textContent = K.t("에폭", "Epoch");
    K.svg("text", { x: 0, y: 140, "font-size": 12, class: "muted" }, svg).textContent = K.t("게이트", "Gate");
    var pts = EP.map(function (e, i) { return xx(i) + "," + yy(e.f1).toFixed(1); }).join(" ");
    K.svg("polyline", { points: pts, fill: "none", stroke: "var(--tca-accent)", "stroke-width": 2 }, svg);
    var marks = EP.map(function (e, i) {
      var c = K.svg("circle", { cx: xx(i), cy: yy(e.f1), r: i === bestF1 ? 6 : 3.5, fill: i === bestF1 ? "var(--entry)" : "var(--tca-accent)",
        stroke: "var(--tca-accent)", "stroke-width": 2 }, svg);
      K.svg("text", { x: xx(i), y: 118, "font-size": 12, "text-anchor": "middle" }, svg).textContent = String(i + 1);
      var ok = pass(e);
      var g = K.svg("text", { x: xx(i), y: 141, "font-size": 14, "text-anchor": "middle", "font-weight": 600 }, svg);
      g.textContent = ok ? "✓" : "✗";
      g.style.fill = ok ? "var(--tca-good)" : "var(--tca-bad)";
      return c;
    });
    var vLab = K.svg("text", { x: xx(0), y: 16, "font-size": 12, "text-anchor": "middle" }, svg);
    svg.style.maxWidth = "460px";
    svg.style.margin = "0 auto";
    root.appendChild(svg);
    var leg = K.el("div", "tca-legend");
    leg.appendChild(K.el("span", null, K.t("큰 빈 원: in-domain f1 최고(조기 종료가 고르는 에폭)", "Large hollow dot: best in-domain f1 (what early stopping picks)")));
    leg.appendChild(K.el("span", null, K.t("✓ 게이트 통과 · ✗ 실패", "✓ gate pass · ✗ fail")));
    root.appendChild(leg);

    var tab = K.el("div", "ep-tab");
    [K.t("게이트 항목", "Gate item"), K.t("값", "Value"), K.t("기준", "Rule"), K.t("판정", "Result")].forEach(function (h, i) {
      tab.appendChild(K.el("div", "ep-th" + (i === 1 ? " ep-v" : i === 3 ? " ep-c" : ""), h));
    });
    var cells = checks(EP[0]).map(function () {
      var a = K.el("div"), b = K.el("div", "ep-v"), c = K.el("div", "tca-num"), d = K.el("div", "ep-c");
      tab.appendChild(a); tab.appendChild(b); tab.appendChild(c); tab.appendChild(d);
      return [a, b, c, d];
    });
    root.appendChild(tab);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "본문 값: v5 기준선(cipher 0.74 · wj_mt 0.75 · coreference 0.57 · 오탐 22%), 게이트를 통과한 체크포인트의 결과(1.00 · 0.84 · 0.58 · 3.8%), f1 으로 고른 체크포인트가 한 정상 계열에서 5%p 떨어졌고 한 에폭 뒤가 통과했다는 것. 그 밖의 에폭별 값과 게이트 규칙(기준선 이상·하락 없음)은 출렁임을 보여 주려는 예시 값이다.",
      "From the post: the v5 baseline (cipher 0.74 · wj_mt 0.75 · coreference 0.57 · FP 22%), the passing checkpoint's results (1.00 · 0.84 · 0.58 · 3.8%), and that the f1-picked checkpoint lost 5 points on one benign family while the next epoch passed. Other per-epoch values and the gate rules (at least baseline, no drop) are example values to show the swings.")));

    function render() {
      var e = EP[cur], cs = checks(e), ok = pass(e);
      sl.set(cur + 1);
      band.style.transform = "translateX(" + (cur * DX) + "px)";
      band.setAttribute("fill", ok ? "var(--tca-good)" : "var(--tertiary)");
      band.setAttribute("fill-opacity", ok ? "0.18" : "0.35");
      vLab.setAttribute("x", xx(cur));
      vLab.textContent = "f1 " + e.f1.toFixed(3);
      marks.forEach(function (m, i) { m.setAttribute("stroke-width", i === cur ? 3 : 2); });
      cs.forEach(function (c, i) {
        cells[i][0].textContent = c.id;
        cells[i][1].textContent = c.v;
        cells[i][2].textContent = c.b;
        cells[i][3].textContent = c.ok ? "✓" : "✗";
        cells[i][3].className = "ep-c " + (c.ok ? "tca-good" : "tca-bad");
      });
      var fails = cs.filter(function (c) { return !c.ok; }).map(function (c) { return c.id; });
      var msg = K.t("에폭 ", "Epoch ") + (cur + 1) + " — ";
      if (cur === bestF1) msg += K.t("in-domain f1 최고. ", "best in-domain f1. ");
      msg += ok ? K.t("게이트 통과.", "passes the gate.") : K.t("게이트 실패: ", "fails the gate: ") + fails.join(", ") + (ok ? "" : ".");
      if (ok && cur === firstPass) msg += K.t(" 본문에서 v5 대비 cipher 0.74→1.00 · wj_mt 0.75→0.84 · coreference 0.57→0.58 · 오탐 22%→3.8% 를 낸 체크포인트에 해당한다.",
        " This is the checkpoint that, in the post, moved cipher 0.74→1.00 · wj_mt 0.75→0.84 · coreference 0.57→0.58 · FP 22%→3.8% against v5.");
      read.textContent = msg;
    }
    function stop() { playing = false; bPlay.textContent = K.t("에폭 재생", "Play epochs"); }
    bF1.addEventListener("click", function () { stop(); cur = bestF1; render(); });
    bGate.addEventListener("click", function () { stop(); cur = firstPass < 0 ? bestF1 : firstPass; render(); });
    bPlay.addEventListener("click", function () {
      if (playing) { stop(); return; }
      if (K.reduce) { cur = firstPass < 0 ? bestF1 : firstPass; render(); return; }
      playing = true; cur = 0; tAcc = 0; bPlay.textContent = K.t("멈춤", "Pause"); render();
    });
    K.loop(root, function (dt) {
      if (!playing) return;
      tAcc += dt;
      if (tAcc < 900) return;
      tAcc = 0;
      if (cur >= EP.length - 1) { stop(); return; }
      cur++;
      render();
    });
    render();
  });
})();
