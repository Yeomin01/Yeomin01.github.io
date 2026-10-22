/* 「LLM 을 이어서 파인튜닝하면 이전 능력이 떨어진다」 글의 그림: 가중치 두 개로 본 망각과 EWC·rehearsal */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("forget-weights", function (root) {
    // 예시 손실: A 는 가중치 1 방향으로 가파르고(중요) 가중치 2 방향으로 완만하다. B 는 둥근 그릇.
    var A = [0, 0.4], B = [1.6, 1.0], CA = [2, 0.2], CB = 0.5;
    function lossA(w) { return CA[0] * w[0] * w[0] + CA[1] * (w[1] - A[1]) * (w[1] - A[1]); }
    function lossB(w) { return CB * ((w[0] - B[0]) * (w[0] - B[0]) + (w[1] - B[1]) * (w[1] - B[1])); }
    function gA(w) { return [2 * CA[0] * (w[0] - A[0]), 2 * CA[1] * (w[1] - A[1])]; }
    function gB(w) { return [2 * CB * (w[0] - B[0]), 2 * CB * (w[1] - B[1])]; }
    var LR = 0.06, STEPS = 200, MS = 25, MAXL = 5.5;
    var st = { mode: "plain", lam: 1, r: 0.25, w: A.slice(), k: 0, playing: !K.reduce, acc: 0, trail: [] };

    K.css("catastrophic-forgetting-llm-css", [
      '.tca[data-demo="forget-weights"] .fw-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px;align-items:start}',
      '@media (max-width:600px){.tca[data-demo="forget-weights"] .fw-grid{grid-template-columns:minmax(0,1fr)}}'
    ].join(""));

    K.head(root, K.t("task B 를 배우는 동안 가중치가 어디로 가나", "Where the weights go while learning task B"),
      K.t("가중치 두 개짜리 예시다. task A 를 마친 자리(A 최적)에서 task B 를 학습한다. 방식을 바꿔 재생하면 task A 의 손실이 얼마나 다시 오르는지 보인다.",
        "A two-weight example. Training on task B starts from where task A finished. Switch the method and replay to see how far task A's loss climbs back."));

    var bar = K.el("div", "tca-bar");
    var seg = K.seg([
      { value: "plain", label: K.t("B 만 학습", "B only") },
      { value: "ewc", label: "EWC" },
      { value: "reh", label: "rehearsal" }
    ], st.mode, function (v) { st.mode = v; replay(); }, K.t("학습 방식", "Training method"));
    var sLam = K.slider({ label: K.t("EWC 세기 λ", "EWC strength λ"), min: 0, max: 3, step: 0.25, value: st.lam,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.lam = v; replay(); } });
    var sR = K.slider({ label: K.t("A 데이터 비율", "Share of A data"), min: 0, max: 0.5, step: 0.05, value: st.r,
      fmt: function (v) { return Math.round(v * 100) + "%"; }, onInput: function (v) { st.r = v; replay(); } });
    var bPlay = K.btn(K.t("일시정지", "Pause"), true);
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(seg.el); bar.appendChild(sLam.el); bar.appendChild(sR.el); bar.appendChild(bPlay); bar.appendChild(bReset);
    root.appendChild(bar);

    var grid = K.el("div", "fw-grid");
    var VW = 320, VH = 272, XL = 24, YT = 8, S = 88, W1 = -0.6, W2 = 2.0;
    function X(a) { return XL + (a - W1) * S; }
    function Y(b) { return YT + (W2 - b) * S; }
    var svg = K.svg("svg", { viewBox: "0 0 " + VW + " " + VH, class: "tca-svg", role: "img",
      "aria-label": K.t("가중치 1·가중치 2 평면에서 task A·B 의 손실 등고선과 학습 경로", "Loss contours of tasks A and B over two weights, with the training path") });
    K.svg("rect", { x: XL, y: YT, width: 3.3 * S, height: 2.7 * S, fill: "none", stroke: "var(--tertiary)" }, svg);
    [0.03, 0.1, 0.2].forEach(function (c) {
      K.svg("ellipse", { cx: X(A[0]), cy: Y(A[1]), rx: Math.sqrt(c / CA[0]) * S, ry: Math.sqrt(c / CA[1]) * S,
        fill: "none", stroke: K.COLORS[0], "stroke-width": 1.5, opacity: 0.85 }, svg);
    });
    [0.3, 0.6, 0.9].forEach(function (r) {
      K.svg("circle", { cx: X(B[0]), cy: Y(B[1]), r: r * S, fill: "none", stroke: K.COLORS[1], "stroke-width": 1.5, opacity: 0.85 }, svg);
    });
    K.svg("circle", { cx: X(A[0]), cy: Y(A[1]), r: 4, fill: K.COLORS[0] }, svg);
    K.svg("circle", { cx: X(B[0]), cy: Y(B[1]), r: 4, fill: K.COLORS[1] }, svg);
    function label(x, y, txt, anchor) {
      var t = K.svg("text", { x: x, y: y, "font-size": 13, "text-anchor": anchor || "start" }, svg);
      t.textContent = txt;
      return t;
    }
    label(X(A[0]) - 8, Y(A[1]) + 4, K.t("A 최적", "A optimum"), "end");
    label(X(B[0]) + 8, Y(B[1]) + 4, K.t("B 최적", "B optimum"));
    var xa = label(XL + 3.3 * S, VH - 4, K.t("가중치 1 → (A 에 중요)", "weight 1 → (matters for A)"), "end");
    xa.setAttribute("class", "muted");
    var ya = label(XL + 4, YT + 15, K.t("↑ 가중치 2", "↑ weight 2"));
    ya.setAttribute("class", "muted");
    var trail = K.svg("polyline", { fill: "none", stroke: "var(--primary)", "stroke-width": 2, points: "" }, svg);
    var dot = K.svg("circle", { r: 6, fill: "var(--primary)", stroke: "var(--entry)", "stroke-width": 2 }, svg);
    grid.appendChild(svg);

    var side = K.el("div");
    var modeNote = K.el("div", "tca-note");
    modeNote.style.marginTop = "0";
    side.appendChild(modeNote);
    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "86px");
    rows.style.setProperty("--tca-rw", "44px");
    rows.style.marginTop = "10px";
    function row(lbl, color) {
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", lbl));
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      f.style.background = color;
      f.style.transition = "none";
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r");
      r.appendChild(tr);
      r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v };
    }
    var rA = row(K.t("task A 손실", "task A loss"), K.COLORS[0]);
    var rB = row(K.t("task B 손실", "task B loss"), K.COLORS[1]);
    side.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    side.appendChild(read);
    grid.appendChild(side);
    root.appendChild(grid);
    root.appendChild(K.el("div", "tca-note", K.t(
      "손실 모양·학습률·단계 수는 모두 예시 값인 개념도다. 손실은 낮을수록 좋다. EWC 의 중요도(Fisher)는 task A 손실의 곡률로 두었고, rehearsal 은 배치에서 A 데이터가 차지하는 비율이다(글의 예: 20~30%).",
      "A concept sketch: loss shapes, learning rate and step count are example values. Lower loss is better. EWC importance (Fisher) is taken from task A's curvature; rehearsal is the share of A data in each batch (the post used 20–30%).")));

    function grad(w) {
      var b = gB(w), a = gA(w);
      if (st.mode === "ewc") return [b[0] + st.lam * a[0], b[1] + st.lam * a[1]];
      if (st.mode === "reh") return [(1 - st.r) * b[0] + st.r * a[0], (1 - st.r) * b[1] + st.r * a[1]];
      return b;
    }
    function step() {
      var g = grad(st.w);
      st.w = [st.w[0] - LR * g[0], st.w[1] - LR * g[1]];
      st.k++;
      if (st.k % 4 === 0 || st.k === STEPS) st.trail.push(X(st.w[0]).toFixed(1) + "," + Y(st.w[1]).toFixed(1));
    }
    function draw() {
      trail.setAttribute("points", st.trail.join(" "));
      dot.setAttribute("cx", X(st.w[0]).toFixed(1));
      dot.setAttribute("cy", Y(st.w[1]).toFixed(1));
      var la = lossA(st.w), lb = lossB(st.w);
      rA.f.style.width = Math.min(1, la / MAXL) * 100 + "%"; rA.v.textContent = la.toFixed(2);
      rB.f.style.width = Math.min(1, lb / MAXL) * 100 + "%"; rB.v.textContent = lb.toFixed(2);
      var done = st.k >= STEPS;
      read.textContent = (done ? K.t("끝", "Done") : K.t("단계 ", "Step ") + st.k + "/" + STEPS) +
        K.t(" · task A 손실 0.00 → ", " · task A loss 0.00 → ") + la.toFixed(2) +
        K.t(" · task B 손실 ", " · task B loss ") + lossB(A).toFixed(2) + " → " + lb.toFixed(2);
    }
    function restart() {
      st.w = A.slice(); st.k = 0; st.acc = 0;
      st.trail = [X(A[0]).toFixed(1) + "," + Y(A[1]).toFixed(1)];
      sLam.el.style.display = st.mode === "ewc" ? "" : "none";
      sR.el.style.display = st.mode === "reh" ? "" : "none";
      modeNote.textContent = st.mode === "ewc"
        ? K.t("EWC — A 에 중요한 가중치일수록 움직이면 페널티를 준다. 가중치 1 은 붙잡히고 가중치 2 는 비교적 자유롭게 움직인다.", "EWC — moving a weight costs more the more it mattered for A. Weight 1 is held back; weight 2 moves more freely.")
        : st.mode === "reh"
          ? K.t("rehearsal — 학습 배치에 task A 데이터를 섞는다. 기울기가 B 쪽과 A 쪽의 가중합이 된다.", "Rehearsal — mix task A data into each batch. The gradient becomes a weighted sum of the B and A directions.")
          : K.t("B 만 학습 — B 의 손실만 줄인다. A 에 중요한 가중치 1 도 B 쪽으로 끌려간다.", "B only — only B's loss is reduced. Weight 1, which A relied on, is dragged toward B too.");
      if (K.reduce && !st.playing) { while (st.k < STEPS) step(); }
      draw();
    }
    function setPlay(on) {
      st.playing = on;
      K.press(bPlay, on);
      bPlay.textContent = on ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    }
    bPlay.addEventListener("click", function () {
      if (!st.playing && st.k >= STEPS) restart();
      setPlay(!st.playing);
    });
    function replay() { setPlay(!K.reduce); restart(); }
    bReset.addEventListener("click", replay);
    K.loop(root, function (dt) {
      if (!st.playing || st.k >= STEPS) return;
      st.acc += dt;
      var n = 0;
      while (st.acc >= MS && st.k < STEPS && n < 8) { st.acc -= MS; step(); n++; }
      if (n) draw();
      if (st.k >= STEPS) setPlay(false);
    });
    setPlay(st.playing);
    restart();
  });
})();
