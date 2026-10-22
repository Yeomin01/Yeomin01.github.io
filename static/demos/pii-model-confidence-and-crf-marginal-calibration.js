/* 「게이트웨이 임계값이 의미를 가지려면 — CRF marginal + Temperature Scaling」 글의 그림: 신뢰도 그림과 ECE */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("crf-reliability", function (root) {
    // 예시 데이터: 토큰 400개. 점수 z 가 클수록 자신 있게 맞히는 모델을 흉내 낸다.
    // 정확도는 무작위 표본이 아니라 각 토큰의 '맞을 확률'로 두어 매번 같은 그림이 나온다.
    var N = 400, Z = [], A = [];
    function sig(x) { return 1 / (1 + Math.exp(-x)); }
    for (var i = 0; i < N; i++) {
      var u = (i + 0.5) / N, z = 0.2 + 5.8 * Math.sqrt(u);
      Z.push(z);
      A.push(Math.min(0.999, Math.max(0.01, sig(z / 1.9 - 0.1) + 0.04 * Math.sin(z * 1.7))));
    }
    var B = 10, LO = 0.5, BW = 0.05;
    function confOf(z, T, mode) {
      if (mode === "onehot") {
        // 예측 라벨만 1.0, 나머지 32개는 -1e4 → softmax 최댓값은 사실상 1.0
        var a = Math.exp(1 / T), b = 32 * Math.exp(-1e4 / T);
        return a / (a + b);
      }
      return sig(z / T);
    }
    function stats(T, mode, thr) {
      var s = [], c = [], a = [], k;
      for (k = 0; k < B; k++) { s.push(0); c.push(0); a.push(0); }
      var pass = 0, passAcc = 0;
      Z.forEach(function (z, j) {
        var p = confOf(z, T, mode), bi = Math.floor((p - LO) / BW);
        bi = Math.max(0, Math.min(B - 1, bi));
        s[bi]++; c[bi] += p; a[bi] += A[j];
        if (p >= thr) { pass++; passAcc += A[j]; }
      });
      var e = 0;
      for (k = 0; k < B; k++) if (s[k]) e += Math.abs(c[k] / s[k] - a[k] / s[k]) * s[k] / N;
      return { s: s, c: c, a: a, ece: e, pass: pass, passAcc: pass ? passAcc / pass : 0 };
    }
    function nll(T) {
      var l = 0;
      Z.forEach(function (z, j) { var p = sig(z / T); l -= A[j] * Math.log(p) + (1 - A[j]) * Math.log(1 - p); });
      return l / N;
    }
    var bestT = 1, bn = Infinity;
    for (var t = 0.8; t <= 2.5001; t += 0.05) { var v = nll(t); if (v < bn) { bn = v; bestT = Math.round(t * 100) / 100; } }

    var st = { mode: "marg", T: 1, thr: 0.85, goal: null };

    K.head(root, K.t("confidence가 정확도와 맞는가", "Does confidence match accuracy?"),
      K.t("막대는 confidence 구간마다 실제 정확도, 가로 눈금은 그 구간의 평균 confidence다. 둘 사이 붉은 칸이 어긋남이고, 그 가중 평균이 ECE다. 대각선에 붙을수록 0.85라는 숫자가 '85% 맞는다'는 뜻에 가까워진다.",
        "Bars show actual accuracy per confidence bin; the tick shows the bin's mean confidence. The red gap is the miscalibration and its weighted mean is ECE. The closer to the diagonal, the more 0.85 means '85% correct'."));

    var bar1 = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "onehot", label: K.t("one-hot 위장 logits", "One-hot disguised logits") },
      { value: "marg", label: K.t("CRF marginal", "CRF marginal") }], st.mode, function (v) { st.mode = v; render(); }, K.t("confidence 출처", "Confidence source"));
    bar1.appendChild(sg.el);
    root.appendChild(bar1);
    var bar2 = K.el("div", "tca-bar");
    var sT = K.slider({ label: K.t("온도 T", "Temperature T"), min: 0.8, max: 2.5, step: 0.05, value: 1, fmt: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.T = v; st.goal = null; render(); } });
    var bFit = K.btn(K.t("val NLL로 T 맞추기", "Fit T on val NLL"));
    var sThr = K.slider({ label: K.t("게이트웨이 임계값", "Gateway threshold"), min: 0.5, max: 0.99, step: 0.01, value: 0.85,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.thr = v; render(); } });
    bar2.appendChild(sT.el); bar2.appendChild(bFit); bar2.appendChild(sThr.el);
    root.appendChild(bar2);

    var W = 480, H = 214, X0 = 40, X1 = 466, Y0 = 10, Y1 = 180, YL = 0.4;
    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("신뢰도 그림", "Reliability diagram") }, root);
    function X(p) { return X0 + (p - LO) / (1 - LO) * (X1 - X0); }
    function Y(p) { return Y1 - (p - YL) / (1 - YL) * (Y1 - Y0); }
    [0.4, 0.6, 0.8, 1.0].forEach(function (v) {
      K.svg("line", { x1: X0, x2: X1, y1: Y(v), y2: Y(v), stroke: "var(--tertiary)", "stroke-dasharray": v > 0.4 ? "3 4" : null }, sv);
      var tx = K.svg("text", { x: X0 - 6, y: Y(v) + 4, "font-size": 12, "text-anchor": "end", "class": "muted" }, sv);
      tx.textContent = v.toFixed(1);
    });
    [0.5, 0.75, 1.0].forEach(function (v) {
      var tx = K.svg("text", { x: X(v), y: Y1 + 16, "font-size": 12, "text-anchor": v === 1 ? "end" : v === 0.5 ? "start" : "middle", "class": "muted" }, sv);
      tx.textContent = v.toFixed(2);
    });
    var xl = K.svg("text", { x: (X0 + X1) / 2, y: H - 2, "font-size": 12, "text-anchor": "middle", "class": "muted" }, sv);
    xl.textContent = K.t("confidence 구간 (세로: 실제 정확도)", "confidence bin (vertical: actual accuracy)");
    K.svg("line", { x1: X(0.5), y1: Y(0.5), x2: X(1), y2: Y(1), stroke: "var(--secondary)", "stroke-dasharray": "5 4" }, sv);
    var thrLine = K.svg("line", { y1: Y0, y2: Y1, stroke: "var(--tca-warn)", "stroke-width": 2 }, sv);
    var bars = [];
    for (var b = 0; b < B; b++) {
      var x = X(LO + b * BW) + 3, w = X(LO + BW) - X(LO) - 6;
      bars.push({
        acc: K.svg("rect", { x: x, width: w, fill: "var(--tca-accent)", opacity: 0.8 }, sv),
        gap: K.svg("rect", { x: x, width: w, fill: "var(--tca-bad)", opacity: 0.35 }, sv),
        tick: K.svg("line", { x1: x - 2, x2: x + w + 2, stroke: "var(--primary)", "stroke-width": 2.5 }, sv)
      });
    }
    var lg = K.el("div", "tca-legend");
    [["var(--tca-accent)", K.t("실제 정확도", "actual accuracy")], ["var(--tca-bad)", K.t("confidence와의 어긋남", "gap to confidence")],
      ["var(--tca-warn)", K.t("게이트웨이 임계값", "gateway threshold")]].forEach(function (q) {
      var s = K.el("span"), ic = K.el("i"); ic.style.background = q[0]; s.appendChild(ic); s.appendChild(document.createTextNode(q[1])); lg.appendChild(s);
    });
    root.appendChild(lg);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "예시 데이터다. 토큰 400개의 confidence를 두 라벨 시그모이드로 단순화했고, 정확도는 표본 대신 토큰마다 맞을 확률로 계산했다. 구간은 0.5~1.0을 10칸으로 나눴다. one-hot 위장 logits의 계산(예측 라벨 1.0, 나머지 32개 −1e4)과 T의 보통 범위(1.2~2.5)는 글 본문을 따른다.",
      "Example data: 400 tokens, confidence simplified to a two-label sigmoid, accuracy computed as each token's probability of being right rather than a sample. Bins split 0.5–1.0 into 10. The one-hot logits (predicted label 1.0, the other 32 at −1e4) and the usual T range (1.2–2.5) follow the post.")));

    function render() {
      var r = stats(st.T, st.mode, st.thr);
      for (var k = 0; k < B; k++) {
        var o = bars[k];
        if (!r.s[k]) { o.acc.setAttribute("height", 0); o.gap.setAttribute("height", 0); o.tick.setAttribute("opacity", 0); continue; }
        var acc = r.a[k] / r.s[k], cf = r.c[k] / r.s[k];
        o.acc.setAttribute("y", Y(acc)); o.acc.setAttribute("height", Math.max(0, Y1 - Y(acc)));
        var top = Math.max(acc, cf), bot = Math.min(acc, cf);
        o.gap.setAttribute("y", Y(top)); o.gap.setAttribute("height", Math.max(0, Y(bot) - Y(top)));
        o.tick.setAttribute("y1", Y(cf)); o.tick.setAttribute("y2", Y(cf)); o.tick.setAttribute("opacity", 1);
      }
      thrLine.setAttribute("x1", X(st.thr)); thrLine.setAttribute("x2", X(st.thr));
      sT.input.disabled = st.mode === "onehot";
      bFit.disabled = st.mode === "onehot";
      var txt = "ECE " + r.ece.toFixed(3) + " · " + K.t("임계값 ", "threshold ") + st.thr.toFixed(2) + K.t(" 이상 통과 ", ": passes ") +
        Math.round(r.pass / N * 100) + "%" + K.t(", 그 통과분의 평균 정확도 ", ", mean accuracy of what passes ") + (r.pass ? Math.round(r.passAcc * 100) + "%" : "—") + ". ";
      if (st.mode === "onehot") txt += K.t("모든 토큰의 confidence가 1.0이라 임계값을 어디에 두든 전부 통과한다. T를 나눠도 1.0 그대로다.",
        "Every token's confidence is 1.0, so everything passes wherever the threshold sits; dividing by T leaves it at 1.0.");
      else if (st.T < 1.15) txt += K.t("T = " + st.T.toFixed(2) + ": 막대가 대각선 아래에 있다. 말하는 confidence보다 실제로 덜 맞는다(over-confidence).",
        "T = " + st.T.toFixed(2) + ": bars sit below the diagonal; the model is right less often than it claims (over-confidence).");
      else if (Math.abs(st.T - bestT) < 0.13) txt += K.t("T = " + st.T.toFixed(2) + ": 이 예시에서 val NLL이 가장 작은 T다. 막대가 대각선에 붙는다.",
        "T = " + st.T.toFixed(2) + ": the NLL-minimising T for this example; bars hug the diagonal.");
      else txt += K.t("T = " + st.T.toFixed(2) + ": T가 클수록 분포가 평탄해진다. 너무 키우면 반대로 confidence가 정확도보다 낮아진다.",
        "T = " + st.T.toFixed(2) + ": larger T flattens the distribution; too large and confidence falls below accuracy instead.");
      read.textContent = txt;
    }
    bFit.addEventListener("click", function () {
      st.goal = bestT;
      if (K.reduce) { st.T = bestT; st.goal = null; sT.set(st.T); render(); }
    });
    K.loop(root, function (dt) {
      if (st.goal === null) return;
      var d = st.goal - st.T, sp = dt / 1000 * 1.2;
      st.T = Math.abs(d) <= sp ? st.goal : st.T + (d > 0 ? sp : -sp);
      if (st.T === st.goal) st.goal = null;
      sT.set(Math.round(st.T * 100) / 100);
      render();
    });
    render();
  });
})();
