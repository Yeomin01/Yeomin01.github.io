/* 「부품만 보면 고장 같지만, 파이프라인에선 멀쩡했다」 글의 그림: 일상 정상이 게이트에서 걸러져 결합기까지 얼마나 가는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("gate-before-combiner", function (root) {
    var N = 100, PER = 4; // 점 하나 = 대화 4건, 400건
    var AUC = { rq: { solo: 0.22, pipe: 0.978, name: "RED QUEEN" }, mhj: { solo: 0.36, pipe: 0.910, name: "MHJ" } };
    var mode = "pipe", ds = "rq", playing = !K.reduce;
    var Y = 86, GX = 150, CX = 320, SPEED = 170, SPAWN = 45;
    var dots = [], spawned = 0, clock = 0, nExit = 0, nComb = 0;

    K.head(root, K.t("배포 경로로 재기 vs 결합기만 떼어 재기", "Measure on the deployed path vs. the combiner alone"),
      K.t("일상 정상 대화 400건을 흘려 보낸다. 배포 경로에서는 1차 게이트가 먼저 있어 대부분이 거기서 정상으로 끝나고, 결합기만 떼어 재면 400건이 전부 결합기로 들어간다.",
        "400 everyday benign conversations flow in. On the deployed path the first-stage gate comes first and most end there as benign; measured alone, all 400 go into the combiner."));

    var bar = K.el("div", "tca-bar");
    var mSeg = K.seg([{ value: "pipe", label: K.t("배포 경로(게이트 → 결합기)", "Deployed path (gate → combiner)") },
      { value: "solo", label: K.t("결합기 단독", "Combiner alone") }], mode, function (v) { mode = v; reset(); }, K.t("재는 방법", "How to measure"));
    var bPlay = K.btn("", playing);
    var bAgain = K.btn(K.t("다시 흘려 보내기", "Run again"));
    bar.appendChild(mSeg.el); bar.appendChild(bPlay); bar.appendChild(bAgain);
    root.appendChild(bar);

    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 226", role: "img", "aria-label": K.t("게이트와 결합기를 지나는 대화 흐름", "Conversations flowing through gate and combiner") }, root);
    K.svg("text", { x: 4, y: 40, "font-size": 12, "class": "muted" }, s).textContent = K.t("일상 정상", "Everyday benign");
    K.svg("text", { x: 4, y: 56, "font-size": 12, "class": "muted" }, s).textContent = K.t("400건", "400 conv.");
    K.svg("line", { x1: 0, y1: Y, x2: 400, y2: Y, stroke: "var(--tertiary)", "stroke-dasharray": "3 4" }, s);
    var gate = K.svg("g", {}, s);
    K.svg("rect", { x: GX - 32, y: 44, width: 64, height: 84, rx: 6, fill: "var(--code-bg)", stroke: "var(--tca-accent)", "stroke-width": 1.5 }, gate);
    K.svg("text", { x: GX, y: 34, "font-size": 12, "text-anchor": "middle" }, gate).textContent = K.t("1차 게이트", "Stage-1 gate");
    var gateNote = K.svg("text", { x: GX, y: 146, "font-size": 12, "text-anchor": "middle", "class": "muted" }, s);
    K.svg("rect", { x: CX - 32, y: 44, width: 64, height: 84, rx: 6, fill: "var(--code-bg)", stroke: "var(--tca-warn)", "stroke-width": 1.5 }, s);
    K.svg("text", { x: CX, y: 34, "font-size": 12, "text-anchor": "middle" }, s).textContent = K.t("결합기", "Combiner");
    var exitLbl = K.svg("text", { x: 214, y: 220, "font-size": 12, "text-anchor": "middle" }, s);
    var combLbl = K.svg("text", { x: 432, y: 150, "font-size": 12, "text-anchor": "middle" }, s);
    K.svg("text", { x: 432, y: 34, "font-size": 12, "text-anchor": "middle", "class": "muted" }, s).textContent = K.t("결합기 판정", "Scored");

    for (var i = 0; i < N; i++) {
      var c = K.svg("circle", { r: 2.6, cx: -10, cy: Y, fill: "var(--tca-accent)" }, s);
      dots.push({ el: c, x: -10, y: Y, jy: ((i * 37) % 21) - 10, st: 0, tx: 0, ty: 0, pass: false });
    }

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "112px");
    rows.style.setProperty("--tca-rw", "48px");
    function row(label) {
      var r = K.el("div", "tca-row");
      var l = K.el("div", "tca-row-l", label);
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r", "");
      r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { r: r, f: f, v: v };
    }
    var dBar = K.el("div", "tca-bar");
    dBar.style.margin = "12px 0 6px";
    dBar.appendChild(K.el("span", "tca-lbl", K.t("AUROC (공격 셋 대 일상 정상)", "AUROC (attack set vs. everyday benign)")));
    var dSeg = K.seg([{ value: "rq", label: K.t("RED QUEEN 홀드아웃", "RED QUEEN holdout") }, { value: "mhj", label: "MHJ" }], ds,
      function (v) { ds = v; renderAuc(); }, K.t("공격 셋", "Attack set"));
    dBar.appendChild(dSeg.el);
    root.appendChild(dBar);
    var rSolo = row(K.t("결합기 단독", "Combiner alone"));
    var rPipe = row(K.t("배포 경로", "Deployed path"));
    root.appendChild(rows);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "점 하나가 대화 4건이다. 게이트 조기 종결 97%·결합기 도달 3%와 AUROC는 본문 값이고, 0.5가 무작위다. 짝 정상(학습 때 본 음성)으로 재면 결합기 단독도 RED QUEEN에서 0.75다. 공격 대화의 흐름은 그리지 않았다.",
      "Each dot is 4 conversations. The 97% early exit, 3% reaching the combiner and the AUROC values are from the post; 0.5 is random. Against paired benigns (the negatives it trained on), the combiner alone scores 0.75 on RED QUEEN. Attack traffic is not drawn.")));

    function slot(kind, k) {
      if (kind === "exit") return { x: 120 + (k % 24) * 6, y: 168 + Math.floor(k / 24) * 6 };
      return { x: 396 + (k % 13) * 6, y: 60 + Math.floor(k / 13) * 6 };
    }
    function reset() {
      spawned = 0; clock = 0; nExit = 0; nComb = 0;
      var ke = 0, kc = 0;
      dots.forEach(function (d, i) {
        d.pass = mode === "solo" || i % 33 === 16;
        d.x = -10; d.y = Y + d.jy * 0.3; d.st = 0;
        var t = d.pass ? slot("comb", kc++) : slot("exit", ke++);
        d.tx = t.x; d.ty = t.y;
      });
      gate.setAttribute("opacity", mode === "solo" ? "0.3" : "1");
      gateNote.textContent = mode === "solo" ? K.t("(건너뜀)", "(bypassed)") : "";
      playing = !K.reduce;
      if (K.reduce) dots.forEach(function (d) { d.x = d.tx; d.y = d.ty; d.st = 3; if (d.pass) nComb++; else nExit++; });
      dots.forEach(function (d) { d.el.setAttribute("cx", d.x.toFixed(1)); d.el.setAttribute("cy", d.y.toFixed(1)); });
      renderCounts(); renderAuc();
    }
    function moveTo(d, x, y, step) {
      var dx = x - d.x, dy = y - d.y, L = Math.sqrt(dx * dx + dy * dy);
      if (L <= step) { d.x = x; d.y = y; return true; }
      d.x += dx / L * step; d.y += dy / L * step; return false;
    }
    function renderCounts() {
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play");
      K.press(bPlay, playing);
      exitLbl.textContent = K.t("게이트에서 정상으로 끝남 ", "Ended at gate ") + K.fmt(nExit * PER) + K.t("건", "");
      combLbl.textContent = K.t("결합기 도달 ", "Reached ") + K.fmt(nComb * PER) + K.t("건", "");
      var finished = nExit + nComb;
      read.textContent = finished < N ? K.t("흐르는 중 — 처리 ", "Flowing — processed ") + K.fmt(finished * PER) + " / 400"
        : (mode === "pipe"
          ? K.t("400건 중 388건(97%)은 결합기를 보지 못한다. 결합기는 수상한 세션 12건(3%)만 받는다.", "388 of 400 (97%) never reach the combiner. It only receives the 12 suspicious sessions (3%).")
          : K.t("게이트를 빼면 400건이 전부 결합기로 간다 — 학습 때 본 적 없는 분포다.", "Without the gate all 400 hit the combiner — a distribution it never saw in training."));
    }
    function renderAuc() {
      var a = AUC[ds];
      [[rSolo, a.solo, "solo"], [rPipe, a.pipe, "pipe"]].forEach(function (p) {
        p[0].f.style.width = (p[1] * 100) + "%";
        p[0].f.style.background = p[1] < 0.5 ? "var(--tca-bad)" : "var(--tca-good)";
        p[0].v.textContent = p[1].toFixed(p[1] >= 0.9 ? 3 : 2);
        p[0].r.style.fontWeight = p[2] === mode ? "600" : "400";
        p[0].r.style.opacity = p[2] === mode ? "1" : "0.6";
      });
    }

    bPlay.addEventListener("click", function () {
      if (nExit + nComb >= N) reset();
      else { playing = !playing; renderCounts(); }
    });
    bAgain.addEventListener("click", reset);

    K.loop(root, function (dt) {
      if (!playing) return;
      clock += dt;
      while (spawned < N && clock >= spawned * SPAWN) { dots[spawned].st = 1; spawned++; }
      var step = SPEED * dt / 1000, changed = false;
      dots.forEach(function (d) {
        if (d.st === 0 || d.st === 3) return;
        if (d.st === 1) {
          var stopX = d.pass ? CX : GX;
          if (moveTo(d, stopX, Y + d.jy * 0.3, step)) d.st = 2;
        } else if (moveTo(d, d.tx, d.ty, step)) {
          d.st = 3; changed = true;
          if (d.pass) nComb++; else nExit++;
        }
        d.el.setAttribute("cx", d.x.toFixed(1)); d.el.setAttribute("cy", d.y.toFixed(1));
      });
      if (nExit + nComb >= N) playing = false;
      if (changed || !playing) renderCounts();
    });
    reset();
  });
})();
