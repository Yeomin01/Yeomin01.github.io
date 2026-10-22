/* 「에폭을 더 돌려도 안 늘 때」 글의 그림: 에폭 sweep 을 한 칸씩 넘기며 train loss 와 평가 F1 을 같이 본다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("plateau-sweep", function (root) {
    var N = 10;
    // train loss 는 글에 숫자가 없어 예시 값. 평가 F1 은 글의 예시 그림에서 읽은 값.
    var LOSS = [0.62, 0.43, 0.35, 0.31, 0.28, 0.26, 0.245, 0.23, 0.22, 0.21];
    var CLS = [
      { id: "A", color: K.COLORS[0], f: [0.950, 0.970, 0.969, 0.967, 0.965, 0.962, 0.960, 0.957, 0.955, 0.953] },
      { id: "B", color: K.COLORS[4], f: [0.920, 0.940, 0.938, 0.935, 0.930, 0.928, 0.924, 0.920, 0.917, 0.913] },
      { id: "C", color: K.COLORS[1], f: [0.830, 0.855, 0.860, 0.857, 0.852, 0.847, 0.843, 0.840, 0.836, 0.833] }
    ];
    var MINUS = "−";

    K.head(root, K.t("에폭 sweep 을 한 칸씩 넘겨 보기", "Step through an epoch sweep"),
      K.t("에폭마다 train loss 와 클래스별 평가 F1 을 같이 기록한다. 평가 F1 은 지금까지의 최고값보다 얼마나 낮은지로 그렸다.",
        "Each epoch logs train loss and per-class eval F1 together. Eval F1 is drawn as the gap below its best value so far."));

    var bar = K.el("div", "tca-bar");
    var bPlay = K.btn(K.t("일시정지", "Pause"));
    var bStep = K.btn(K.t("다음 에폭", "Next epoch"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    var epLbl = K.el("span", "tca-num");
    bar.appendChild(bPlay); bar.appendChild(bStep); bar.appendChild(bReset); bar.appendChild(epLbl);
    root.appendChild(bar);

    // ---- SVG: 위는 train loss, 아래는 평가 F1 − 지금까지 최고값 ----
    var W = 360, XL = 46, XR = 348;
    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " 236", role: "img",
      "aria-label": K.t("에폭별 train loss 와 평가 F1 하락 폭", "Train loss and eval F1 gap by epoch") }, root);
    function x(e) { return XL + (e - 1) * (XR - XL) / (N - 1); }
    function yL(v) { return 92 - (v - 0.15) / 0.5 * 70; }
    function yD(d) { return 126 + (-d) / 0.03 * 80; }
    function txt(xx, yy, str, anchor, cls) {
      var t = K.svg("text", { x: xx, y: yy, "font-size": 12, "text-anchor": anchor || "start", "class": cls || null }, s);
      t.textContent = str;
      return t;
    }
    function grid(yy) {
      K.svg("line", { x1: XL, x2: XR, y1: yy, y2: yy, style: "stroke:var(--tertiary);stroke-dasharray:3 3" }, s);
    }
    txt(XL, 13, K.t("train loss (예시 값) — 낮을수록 좋다", "Train loss (example values) — lower is better"));
    [0.6, 0.4, 0.2].forEach(function (v) { grid(yL(v)); txt(XL - 6, yL(v) + 4, v.toFixed(1), "end", "muted"); });
    txt(XL, 117, K.t("평가 F1 − 지금까지 최고값", "Eval F1 − best so far"));
    [0, -0.01, -0.02, -0.03].forEach(function (d) {
      grid(yD(d));
      txt(XL - 6, yD(d) + 4, d === 0 ? "0" : MINUS + Math.abs(d).toFixed(2), "end", "muted");
    });
    for (var e = 1; e <= N; e++) txt(x(e), 224, String(e), "middle", "muted");
    txt(XL - 6, 224, K.t("에폭", "ep"), "end", "muted");

    var cursor = K.svg("line", { y1: 20, y2: 208, style: "stroke:var(--secondary);stroke-width:1;stroke-dasharray:2 3" }, s);
    var lossLine = K.svg("polyline", { fill: "none", style: "stroke:var(--primary);stroke-width:2" }, s);
    var lossDot = K.svg("circle", { r: 3.5, style: "fill:var(--primary)" }, s);
    CLS.forEach(function (c) {
      c.line = K.svg("polyline", { fill: "none", style: "stroke:" + c.color + ";stroke-width:2" }, s);
      c.dot = K.svg("circle", { r: 3.5, style: "fill:" + c.color }, s);
    });

    var legend = K.el("div", "tca-legend");
    function leg(color, label) {
      var sp = K.el("span");
      var i = K.el("i"); i.style.background = color;
      sp.appendChild(i); sp.appendChild(document.createTextNode(label));
      legend.appendChild(sp);
    }
    leg("var(--primary)", "train loss");
    CLS.forEach(function (c) { leg(c.color, K.t("클래스 ", "Class ") + c.id); });
    root.appendChild(legend);

    // ---- 클래스별 현재 상태 ----
    var rows = K.el("div", "tca-rows");
    rows.style.marginTop = "10px";
    CLS.forEach(function (c) {
      var r = K.el("div", "tca-row");
      var chip = K.el("span", "tca-chip", c.id);
      chip.style.background = c.color;
      c.txt = K.el("span", "tca-num");
      c.txt.style.fontSize = "13px";
      r.appendChild(chip); r.appendChild(c.txt);
      rows.appendChild(r);
    });
    root.appendChild(rows);

    var readLoss = K.el("div", "tca-read");
    var readEval = K.el("div", "tca-read");
    readEval.style.marginTop = "4px";
    readEval.setAttribute("aria-live", "polite");
    root.appendChild(readLoss); root.appendChild(readEval);
    root.appendChild(K.el("div", "tca-note", K.t(
      "평가 F1 은 위 그림의 예시 곡선에서 읽은 값이고, train loss 는 글에 숫자가 없어 넣은 예시 값이다. 정점 뒤 에폭당 하락 폭은 모두 0.001~0.005 로, 글이 말한 범위 안에 있다.",
      "Eval F1 is read off the example chart above; train loss values are examples, since the post gives none. After each peak the per-epoch drop stays within 0.001–0.005, the range the post mentions.")));

    function fmt3(v) { return v.toFixed(3); }
    function signed(d) { return (d > 0 ? "+" : d < 0 ? MINUS : "±") + Math.abs(d).toFixed(3); }
    function peakIdx(c, upto) {
      var b = 0;
      for (var i = 1; i <= upto; i++) if (c.f[i] > c.f[b]) b = i;
      return b;
    }
    function joinIds(list) { return list.map(function (c) { return c.id; }).join("·"); }

    var ep = K.reduce ? N : 1, playing = !K.reduce, acc = 0;

    function render() {
      var i = ep - 1, cx = x(ep);
      epLbl.textContent = K.t("에폭 ", "Epoch ") + ep + " / " + N;
      cursor.setAttribute("x1", cx); cursor.setAttribute("x2", cx);
      var pts = [];
      for (var k = 0; k <= i; k++) pts.push(x(k + 1).toFixed(1) + "," + yL(LOSS[k]).toFixed(1));
      lossLine.setAttribute("points", pts.join(" "));
      lossDot.setAttribute("cx", cx); lossDot.setAttribute("cy", yL(LOSS[i]));

      var up = [], down = [];
      CLS.forEach(function (c) {
        var p = [], best = c.f[0];
        for (var k = 0; k <= i; k++) {
          if (c.f[k] > best) best = c.f[k];
          p.push(x(k + 1).toFixed(1) + "," + yD(c.f[k] - best).toFixed(1));
        }
        c.line.setAttribute("points", p.join(" "));
        var gap = c.f[i] - best, pk = peakIdx(c, i);
        c.dot.setAttribute("cx", cx); c.dot.setAttribute("cy", yD(gap));
        var dir = "";
        if (i > 0) {
          if (c.f[i] > c.f[i - 1]) { up.push(c); dir = K.t(" · 오름", " · rising"); }
          else { down.push(c); dir = K.t(" · 내려감", " · falling"); }
        }
        c.txt.textContent = fmt3(c.f[i]) + K.t(" · 최고 ", " · best ") + fmt3(c.f[pk]) +
          K.t("(" + (pk + 1) + "에폭)", " (ep " + (pk + 1) + ")") + K.t(" · 차이 ", " · gap ") +
          (gap === 0 ? "0" : signed(gap)) + dir;
      });

      if (i === 0) readLoss.textContent = K.t("train loss ", "Train loss ") + LOSS[0].toFixed(2) + K.t(" — 첫 에폭이다.", " — first epoch.");
      else readLoss.textContent = K.t("train loss ", "Train loss ") + LOSS[i].toFixed(3).replace(/0$/, "") +
        K.t(" (이전보다 ", " (") + MINUS + (LOSS[i - 1] - LOSS[i]).toFixed(3).replace(/0$/, "") +
        K.t(") — loss 만 보면 더 돌릴 만해 보인다.", " vs previous) — on loss alone, more epochs look worthwhile.");

      if (i === 0) readEval.textContent = K.t("평가: 비교할 이전 에폭이 아직 없다.", "Eval: no earlier epoch to compare yet.");
      else if (!down.length) readEval.textContent = K.t("평가: 세 클래스 모두 오르고 있다. 아직 데이터에서 배울 신호가 남아 있다.",
        "Eval: all three classes are rising. The data still has signal left to learn.");
      else if (up.length) readEval.textContent = K.t("평가: " + joinIds(down) + " 는 내려가고 " + joinIds(up) + " 는 오른다. 한쪽만 오르는 trade-off 구간이다.",
        "Eval: " + joinIds(down) + " falling while " + joinIds(up) + " still rises. This is the trade-off zone.");
      else {
        var since = 0;
        for (var j = i; j > 0; j--) {
          var all = CLS.every(function (c) { return c.f[j] <= c.f[j - 1]; });
          if (all) since++; else break;
        }
        readEval.textContent = K.t("평가: 세 클래스 모두 정점을 지나 내려간다(같이 내려간 지 " + since + "에폭째). plateau 에 닿았고, 그 뒤는 약한 forgetting·미세 과적합 구간이다.",
          "Eval: all three classes are past their peaks and falling (" + since + " epoch" + (since > 1 ? "s" : "") + " in a row). The plateau is reached; what follows is weak forgetting and mild overfitting.");
      }
    }

    function syncPlay() { bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"); }
    bPlay.addEventListener("click", function () {
      if (!playing && ep >= N) { ep = 1; render(); }
      playing = !playing; acc = 0; syncPlay();
    });
    bStep.addEventListener("click", function () {
      playing = false; syncPlay();
      ep = ep < N ? ep + 1 : 1; render();
    });
    bReset.addEventListener("click", function () { ep = 1; acc = 0; render(); });

    K.loop(root, function (dt) {
      if (!playing) return;
      acc += dt;
      if (acc < 1000) return;
      acc = 0;
      if (ep < N) { ep++; render(); }
      else { playing = false; syncPlay(); }
    });
    syncPlay();
    render();
  });
})();
