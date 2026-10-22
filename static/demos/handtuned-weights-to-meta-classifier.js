/* 「손으로 맞춘 가중치 공식을 작은 메타 분류기로 바꾼 이유」 글의 그림: 수기 공식의 분기와 숨은 상호작용 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("handtuned-weights-to-meta-classifier-css",
    '.tca[data-demo="escalation-hand-formula"] .hf-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;' +
    'align-items:center;padding:6px 8px;border:1px solid var(--tertiary);border-radius:6px}' +
    '.tca[data-demo="escalation-hand-formula"] .hf-row.off{opacity:.5}' +
    '.tca[data-demo="escalation-hand-formula"] .hf-row.win{border-color:var(--tca-accent);box-shadow:inset 3px 0 0 var(--tca-accent)}' +
    '.tca[data-demo="escalation-hand-formula"] .hf-f{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}' +
    '.tca[data-demo="escalation-hand-formula"] .hf-c{font-size:12px;color:var(--secondary);grid-column:1 / -1}' +
    '.tca[data-demo="escalation-hand-formula"] .hf-list{display:flex;flex-direction:column;gap:6px;margin:0 0 10px}');

  K.register("escalation-hand-formula", function (root) {
    var st = { g: 0.25, s: 0.7, p: 0.3, trig: false };

    function f(g, s, p, trig) {
      var c = [{ v: 0.6 * g, on: true }];
      c.push({ v: s * 0.7, on: s >= 0.18 && g < 0.3 });
      c.push({ v: p * 0.85, on: p >= 0.5 && trig });
      c.push({ v: 0.42, on: !(p >= 0.5) && trig });
      var best = 0, bi = 0;
      c.forEach(function (x, i) { if (x.on && x.v >= best) { best = x.v; bi = i; } });
      return { score: best, cand: c, win: bi };
    }

    K.head(root, K.t("수기 에스컬레이션 공식 따라가기", "Walk through the hand-written escalation formula"),
      K.t("글의 공식을 그대로 옮겼다. 신호를 움직이면 어느 분기가 켜지고 최종 점수가 어디서 나오는지 보인다. 아래 선은 gradient_score 하나만 0에서 1까지 바꿨을 때의 최종 점수다.",
        "The post's formula as written. Move the signals to see which branch fires and where the final score comes from. The line below is the final score as gradient_score alone goes from 0 to 1."));

    var bar = K.el("div", "tca-bar");
    var sG = K.slider({ label: "gradient", min: 0, max: 1, step: 0.01, value: st.g, fmt: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.g = v; render(); } });
    var sS = K.slider({ label: "semantic", min: 0, max: 1, step: 0.01, value: st.s, fmt: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.s = v; render(); } });
    var sP = K.slider({ label: "peak_prob", min: 0, max: 1, step: 0.01, value: st.p, fmt: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.p = v; render(); } });
    var bT = K.btn(K.t("트리거 있음", "Trigger present"), st.trig);
    bT.addEventListener("click", function () { st.trig = !st.trig; K.press(bT, st.trig); render(); });
    [sG.el, sS.el, sP.el, bT].forEach(function (e) { bar.appendChild(e); });
    root.appendChild(bar);

    var list = K.el("div", "hf-list");
    var DEF = [
      { f: "0.6 × gradient", c: K.t("항상", "always") },
      { f: "semantic × 0.7", c: K.t("semantic ≥ 0.18 이고 gradient < 0.3 일 때만", "only if semantic ≥ 0.18 and gradient < 0.3") },
      { f: "peak_prob × 0.85", c: K.t("peak_prob ≥ 0.5 이고 트리거가 있을 때", "if peak_prob ≥ 0.5 and a trigger is present") },
      { f: "0.42", c: K.t("그 밖에 트리거만 있을 때", "otherwise, if only a trigger is present") }
    ];
    var items = DEF.map(function (d) {
      var r = K.el("div", "hf-row"), ff = K.el("div", "hf-f", d.f), v = K.el("div", "tca-num"), c = K.el("div", "hf-c", d.c);
      r.appendChild(ff); r.appendChild(v); r.appendChild(c);
      list.appendChild(r);
      return { r: r, v: v };
    });
    root.appendChild(list);

    var W = 480, H = 160, L = 40, R = 470, T = 12, B = 128;
    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("gradient에 따른 최종 점수", "Final score versus gradient") }, root);
    function X(g) { return L + g * (R - L); }
    function Y(v) { return B - v * (B - T); }
    [0, 0.5, 1].forEach(function (v) {
      K.svg("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: "var(--tertiary)", "stroke-dasharray": v ? "3 4" : null }, sv);
      var tx = K.svg("text", { x: L - 6, y: Y(v) + 4, "font-size": 12, "text-anchor": "end", "class": "muted" }, sv);
      tx.textContent = v.toFixed(1);
    });
    K.svg("line", { x1: X(0.3), x2: X(0.3), y1: T, y2: B, stroke: "var(--tca-warn)", "stroke-dasharray": "4 3" }, sv);
    var t03 = K.svg("text", { x: X(0.3) + 4, y: T + 12, "font-size": 12, "class": "muted" }, sv);
    t03.textContent = "gradient = 0.3";
    var path = K.svg("path", { fill: "none", stroke: "var(--tca-accent)", "stroke-width": 2.5 }, sv);
    var dot = K.svg("circle", { r: 6, fill: "var(--tca-accent)", stroke: "var(--entry)", "stroke-width": 2 }, sv);
    var xl = K.svg("text", { x: (L + R) / 2, y: H - 6, "font-size": 12, "text-anchor": "middle", "class": "muted" }, sv);
    xl.textContent = K.t("gradient_score (0 → 1) · 세로: 최종 점수", "gradient_score (0 → 1) · vertical: final score");

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "공식과 계수(0.6 · 0.18 · 0.3 · 0.7 · 0.5 · 0.85 · 0.42)는 글 본문 그대로다. 신호 값은 예시다. 메타 분류기의 학습된 계수는 글에 숫자가 없어 그리지 않았다.",
      "The formula and constants are exactly as in the post; the signal values are examples. The meta-classifier's learned coefficients are not given as numbers, so they are not drawn.")));

    function render() {
      var r = f(st.g, st.s, st.p, st.trig);
      items.forEach(function (it, i) {
        var c = r.cand[i];
        it.v.textContent = c.on ? c.v.toFixed(3) : K.t("꺼짐", "off");
        it.r.className = "hf-row" + (c.on ? "" : " off") + (c.on && i === r.win ? " win" : "");
      });
      var d = "", prev = null;
      for (var k = 0; k <= 400; k++) {
        var g = k / 400, y = f(g, st.s, st.p, st.trig).score;
        d += (prev === null || Math.abs(y - prev) > 0.04 ? "M" : "L") + X(g).toFixed(1) + " " + Y(y).toFixed(1) + " ";
        prev = y;
      }
      path.setAttribute("d", d);
      dot.setAttribute("cx", X(st.g).toFixed(1)); dot.setAttribute("cy", Y(r.score).toFixed(1));
      var msg = K.t("최종 escalation_score = ", "Final escalation_score = ") + r.score.toFixed(3) + ".";
      if (st.s >= 0.18 && st.g >= 0.3 && st.s * 0.7 > 0.6 * st.g)
        msg += K.t(" semantic이 " + st.s.toFixed(2) + "로 높아도 gradient가 0.3 이상이라 무시된다.",
          " semantic is high at " + st.s.toFixed(2) + " but ignored because gradient is 0.3 or more.");
      var lo = f(0.29, st.s, st.p, st.trig).score, hi = f(0.3, st.s, st.p, st.trig).score;
      if (lo - hi > 0.01)
        msg += K.t(" 지금 값에서는 gradient가 0.29 → 0.30 으로 오르면 점수가 " + lo.toFixed(3) + " → " + hi.toFixed(3) + " 로 내려간다.",
          " At these values, raising gradient 0.29 → 0.30 drops the score " + lo.toFixed(3) + " → " + hi.toFixed(3) + ".");
      read.textContent = msg;
    }
    render();
  });
})();
