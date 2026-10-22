/* 「지표는 그대로였는데, 판정하는 곳이 바뀌었다」 글의 그림: 같은 차단율 뒤에서 판정 위치가 옮겨 가는 모습 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  K.register("cascade-who", function (root) {
    var N = 100;
    var PH = [
      { v: "p1", l: K.t("① 데이터 변경 전", "① Before"), q: { comb: 80, gate: 15, miss: 5 } },
      { v: "p2", l: K.t("② 정상 데이터 추가 후", "② After adding benign data"), q: { comb: 5, gate: 89, miss: 6 } },
      { v: "p3", l: K.t("③ 1차 재학습 후", "③ After retraining stage one"), q: { comb: 5, gate: 10, miss: 85 } },
      { v: "p4", l: K.t("④ 그 계열 신호 학습 후", "④ After teaching that family's signal"), q: { comb: 82, gate: 12, miss: 6 } }
    ];
    var phase = PH[0], byStage = false, sessions = [], spawned = 0, acc = 0, cnt;
    var COL = { comb: K.COLORS[0], gate: K.COLORS[1], miss: "var(--secondary)" };

    K.head(root, K.t("차단율은 같아도 판정하는 곳은 다르다", "Same block rate, different place of decision"),
      K.t("한 계열의 공격 세션 100건을 흘려 본다. '집계 숫자만'으로는 ①②④가 비슷해 보인다. '단계별로' 바꾸면 ②에서 판정이 보조 게이트로 쏠린 것이 보이고, ③에서 그 경로가 무너진다.",
        "Run 100 attack sessions from one family. With totals only, ① ② ④ look alike. By stage, ② has shifted to the fallback gate, and ③ is where that path collapses."));

    var bar = K.el("div", "tca-bar");
    var sPh = K.seg(PH.map(function (p) { return { value: p.v, label: p.l }; }), phase.v, function (v) {
      phase = PH.filter(function (p) { return p.v === v; })[0]; restart();
    }, K.t("시점", "Phase"));
    bar.appendChild(sPh.el);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var sView = K.seg([{ value: false, label: K.t("집계 숫자만", "Totals only") }, { value: true, label: K.t("단계별로", "By stage") }], byStage,
      function (v) { byStage = v; draw(); }, K.t("보기", "View"));
    var bAgain = K.btn(K.t("다시 흘리기", "Run again"));
    bar2.appendChild(sView.el); bar2.appendChild(bAgain);
    root.appendChild(bar2);

    var svg = K.svg("svg", { viewBox: "0 0 480 200", "class": "tca-svg", role: "img", "aria-label": K.t("세션이 판정 단계로 흘러가는 그림", "Sessions flowing to decision stages") });
    root.appendChild(svg);
    function node(x, y, w, h, label) {
      var g = K.svg("g", null, svg);
      K.svg("rect", { x: x, y: y, width: w, height: h, rx: 6, fill: "var(--theme)", stroke: "var(--tertiary)" }, g);
      var t = K.svg("text", { x: x + w / 2, y: y + h / 2 + 4, "text-anchor": "middle", "font-size": 12.5 }, g);
      t.textContent = label;
      return g;
    }
    var P = { src: [8, 100], s1: [130, 100], comb: [290, 45], gate: [290, 155], hit: [432, 80], miss: [432, 170] };
    function line(a, b, dash) { K.svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "var(--tertiary)", "stroke-width": 1.5, "stroke-dasharray": dash || null }, svg); }
    line(P.src, P.s1); line(P.s1, P.comb); line(P.s1, P.gate); line(P.comb, P.hit); line(P.gate, P.hit); line(P.gate, P.miss, "4 3");
    node(100, 82, 60, 36, K.t("1차", "Stage 1"));
    var gComb = node(244, 27, 92, 36, K.t("2차 결합기", "Combiner"));
    var gGate = node(244, 137, 92, 36, K.t("보조 게이트", "Fallback gate"));
    node(400, 62, 76, 36, K.t("공격 판정", "Attack"));
    node(400, 152, 76, 36, K.t("정상 종결", "Closed benign"));
    var tHigh = K.svg("text", { x: 196, y: 62, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg); tHigh.textContent = K.t("점수 높음", "high score");
    var tLow = K.svg("text", { x: 196, y: 148, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg); tLow.textContent = K.t("점수 낮음", "low score");
    var cComb = K.svg("text", { x: 290, y: 20, "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, svg);
    var cGate = K.svg("text", { x: 290, y: 192, "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, svg);
    var cHit = K.svg("text", { x: 438, y: 56, "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, svg);
    var cMiss = K.svg("text", { x: 438, y: 146, "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, svg);
    var dotLayer = K.svg("g", null, svg);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "128px");
    rows.style.setProperty("--tca-rw", "44px");
    function row(label, color) {
      var r = K.el("div", "tca-row"); r.appendChild(K.el("div", "tca-row-l", label));
      var tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"); f.style.background = color; tr.appendChild(f); r.appendChild(tr);
      var v = K.el("div", "tca-row-r"); r.appendChild(v); rows.appendChild(r); return { r: r, f: f, v: v };
    }
    var rTot = row(K.t("최종 차단율", "Final block rate"), "var(--primary)");
    var rComb = row(K.t("└ 결합기에서", "└ by combiner"), COL.comb);
    var rGate = row(K.t("└ 보조 게이트에서", "└ by fallback gate"), COL.gate);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "단계별 비율은 예시 값이다. 본문에는 공개 벤치 전체의 최종 차단율 98%→97%만 있고, 이 계열의 단계별 수치는 없다. 결합기에 도달한 공격은 모두 차단된다고 단순화했다.",
      "Per-stage shares are examples. The post gives only the bench-wide block rate (98% → 97%), not this family's breakdown. Every attack that reaches the combiner is blocked here, for simplicity.")));

    function plan() {
      var list = [], r = rng(3 + PH.indexOf(phase));
      ["comb", "gate", "miss"].forEach(function (k) { for (var i = 0; i < phase.q[k]; i++) list.push(k); });
      for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = list[i]; list[i] = list[j]; list[j] = t; }
      return list;
    }
    var order = [];
    function restart() {
      order = plan(); sessions = []; spawned = 0; acc = 0; cnt = { comb: 0, gate: 0, miss: 0 };
      dotLayer.textContent = "";
      if (K.reduce) { cnt = { comb: phase.q.comb, gate: phase.q.gate, miss: phase.q.miss }; spawned = N; }
      draw();
    }
    function route(k) {
      if (k === "comb") return [P.src, P.s1, P.comb, P.hit];
      return k === "gate" ? [P.src, P.s1, P.gate, P.hit] : [P.src, P.s1, P.gate, P.miss];
    }
    function pos(path, d) {
      for (var i = 0; i < path.length - 1; i++) {
        var a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= L) return [a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L];
        d -= L;
      }
      return null;
    }
    function step(dt) {
      if (spawned < N) {
        acc += dt;
        while (acc >= 70 && spawned < N) {
          acc -= 70;
          var k = order[spawned++];
          var c = K.svg("circle", { r: 4, stroke: "var(--entry)", "stroke-width": 1 }, dotLayer);
          sessions.push({ k: k, d: 0, path: route(k), el: c });
        }
      }
      if (!sessions.length) return;
      sessions = sessions.filter(function (s) {
        s.d += dt * 0.32;
        var p = pos(s.path, s.d);
        if (!p) { cnt[s.k]++; s.el.remove(); return false; }
        s.el.setAttribute("cx", p[0].toFixed(1)); s.el.setAttribute("cy", p[1].toFixed(1));
        s.el.setAttribute("fill", byStage || s.k === "miss" ? COL[s.k] : "var(--tca-accent)");
        return true;
      });
      draw();
    }
    function draw() {
      var hit = cnt.comb + cnt.gate, done = hit + cnt.miss;
      gComb.style.opacity = byStage ? "1" : "0.35";
      gGate.style.opacity = byStage ? "1" : "0.35";
      cComb.textContent = byStage ? K.t("차단 ", "") + cnt.comb : "";
      cGate.textContent = byStage ? K.t("차단 ", "") + cnt.gate : "";
      cHit.textContent = String(hit);
      cMiss.textContent = String(cnt.miss);
      rTot.f.style.width = hit + "%"; rTot.v.textContent = hit + "%";
      rComb.r.style.display = byStage ? "" : "none"; rGate.r.style.display = byStage ? "" : "none";
      rComb.f.style.width = cnt.comb + "%"; rComb.v.textContent = cnt.comb + "%";
      rGate.f.style.width = cnt.gate + "%"; rGate.v.textContent = cnt.gate + "%";
      if (done < N) { read.className = "tca-read"; read.textContent = K.t("흘린 세션 ", "Sessions ") + done + "/" + N; return; }
      var msg;
      if (!byStage) msg = K.t("최종 차단율 " + hit + "%. 이 숫자만으로는 누가 판정했는지 알 수 없다.", "Final block rate " + hit + "%. This number alone does not say who decided.");
      else if (phase.v === "p2") msg = K.t("차단율은 비슷한데 판정의 대부분을 보조 게이트가 떠안았다. 결합기는 이 계열에 대해 놀고 있다.", "The rate is similar, but the fallback gate carries most decisions; the combiner is idle for this family.");
      else if (phase.v === "p3") msg = K.t("점수 스케일이 바뀌어 같은 임계에서 게이트가 거의 발동하지 않는다. 대부분이 정상으로 종결됐다.", "The score scale changed, the gate barely fires at the same threshold, and most sessions closed as benign.");
      else if (phase.v === "p4") msg = K.t("공격이 다시 1차에서 점수를 받아 결합기까지 간다. 튼튼한 경로가 숫자를 만든다.", "Attacks score in stage one again and reach the combiner; the sturdy path makes the number.");
      else msg = K.t("대부분 결합기에서 잡힌다.", "Most are caught by the combiner.");
      read.className = "tca-read" + (phase.v === "p3" ? " tca-bad" : phase.v === "p2" && byStage ? " tca-warn" : "");
      read.textContent = msg;
    }
    bAgain.addEventListener("click", restart);
    restart();
    K.loop(root, step);
  });
})();
