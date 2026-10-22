/* 「임계값을 서빙이 아닌 사본 경로로 뽑고 있었다」 글의 그림: 경로를 바꾸면 경계에 걸린 값이 넘어간다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("threshold-path", function (root) {
    var T = [], C = [0.900, 0.840, 0.760, 0.680, 0.600, 0.530, 0.470, 0.448, 0.430, 0.400, 0.360, 0.310, 0.260, 0.210, 0.170, 0.130];
    for (var i = 0; i < C.length; i++) T.push(+(0.50 + i * 0.02).toFixed(2));
    var LIFT = 0.008; // 서빙 경로에서 2차 패스·원래 점수 디코딩으로 더해지는 재현율 (예시)
    var CURVES = { copy: C, serve: C.map(function (v) { return +(v + LIFT).toFixed(3); }) };
    var path = "copy";

    K.head(root, K.t("같은 규칙, 다른 경로", "Same rule, different path"),
      K.t("산출 경로를 사본에서 서빙으로 바꾸면 재현율 곡선이 조금 올라간다. 경계에 걸린 임계값 하나가 '최대치의 50% 이상' 조건을 넘는다.",
        "Switching the path from the copy to serving lifts the recall curve slightly. One threshold sitting on the boundary crosses the 'at least 50% of max' condition."));

    var bar = K.el("div", "tca-bar");
    var sPath = K.seg([{ value: "copy", label: K.t("사본 경로", "Copy path") }, { value: "serve", label: K.t("서빙 경로", "Serving path") }],
      path, function (v) { path = v; render(); }, K.t("산출 경로", "Path"));
    bar.appendChild(sPath.el);
    root.appendChild(bar);

    var chain = K.el("div", "tca-rows");
    chain.style.setProperty("--tca-lw", "110px");
    chain.style.marginBottom = "8px";
    var STEPS = [
      { l: K.t("디코딩", "Decoding"), copy: K.t("온도로 나눈 점수로 Viterbi", "Viterbi on temperature-scaled scores"), serve: K.t("원래 점수로 Viterbi, 온도는 신뢰도에만", "Viterbi on raw scores; temperature only for confidence") },
      { l: K.t("일반명사 필터", "Common-noun filter"), copy: K.t("없음", "missing"), serve: K.t("있음", "present") },
      { l: K.t("음절 분리 2차 패스", "Split-name second pass"), copy: K.t("없음", "missing"), serve: K.t("있음", "present") }
    ];
    var stepEls = STEPS.map(function (s) {
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", s.l));
      var v = K.el("div", null, "");
      v.style.fontSize = "13px"; v.style.minWidth = "0";
      r.appendChild(v);
      chain.appendChild(r);
      return v;
    });
    root.appendChild(chain);

    var W = 480, H = 230, X0 = 46, X1 = 466, Y0 = 16, Y1 = 196;
    var svg = K.svg("svg", { viewBox: "0 0 " + W + " " + H, "class": "tca-svg", role: "img", "aria-label": K.t("임계값별 재현율 곡선", "Recall by threshold") });
    root.appendChild(svg);
    function x(t) { return X0 + (t - T[0]) / (T[T.length - 1] - T[0]) * (X1 - X0); }
    function y(r) { return Y1 - r * (Y1 - Y0); }
    K.svg("line", { x1: X0, y1: Y1, x2: X1, y2: Y1, stroke: "var(--tertiary)" }, svg);
    K.svg("line", { x1: X0, y1: Y0, x2: X0, y2: Y1, stroke: "var(--tertiary)" }, svg);
    [0.5, 0.6, 0.7, 0.8].forEach(function (t) {
      var tx = K.svg("text", { x: x(t), y: Y1 + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg); tx.textContent = t.toFixed(2);
    });
    [0, 0.5, 1].forEach(function (r) {
      var tx = K.svg("text", { x: X0 - 6, y: y(r) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg); tx.textContent = r.toFixed(1);
    });
    var lx = K.svg("text", { x: X1, y: H - 2, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg); lx.textContent = K.t("임계값 →", "threshold →");
    var ly = K.svg("text", { x: X0 + 4, y: Y0 - 2, "font-size": 12, "class": "muted" }, svg); ly.textContent = K.t("재현율", "recall");
    var other = K.svg("polyline", { fill: "none", stroke: "var(--secondary)", "stroke-width": 1.5, "stroke-dasharray": "4 4", opacity: 0.6 }, svg);
    var main = K.svg("polyline", { fill: "none", stroke: "var(--tca-accent)", "stroke-width": 2.5 }, svg);
    var base = K.svg("line", { x1: X0, x2: X1, stroke: "var(--tca-warn)", "stroke-width": 1.5, "stroke-dasharray": "6 3" }, svg);
    var baseT = K.svg("text", { x: X1, "text-anchor": "end", "font-size": 12 }, svg);
    var dots = T.map(function (t) { return K.svg("circle", { cx: x(t), r: 3.5, "stroke-width": 1.5 }, svg); });
    var pick = K.svg("circle", { r: 8, fill: "none", stroke: "var(--tca-bad)", "stroke-width": 2 }, svg);
    var pickT = K.svg("text", { "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, svg);

    var zoom = K.el("div", "tca-rows");
    zoom.style.setProperty("--tca-lw", "84px");
    zoom.style.setProperty("--tca-rw", "110px");
    zoom.style.marginTop = "6px";
    root.appendChild(K.el("div", "tca-h", K.t("경계 근처 확대", "Close to the boundary")));
    root.appendChild(zoom);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "곡선은 예시 값이다. 서빙 경로에서 곡선이 오른 몫은 본문 설명대로 2차 패스가 더한 이름과 원래 점수 디코딩이다. 값이 0.02 오르고 기준선을 0.002 차이로 넘은 것, 24개 값 중 하나만 바뀐 것은 본문 값이다. 선정 규칙은 '재현율이 최대치의 50% 이상인 값 중 가장 높은 임계값'으로 단순화했다. 점선은 다른 경로의 곡선이다.",
      "The curves are examples. On the serving path the lift comes, as the post says, from names added by the second pass and decoding on raw scores. The +0.02 shift, the 0.002 margin and 'one value out of 24' are from the post. The rule is simplified to 'the highest threshold whose recall is at least 50% of the max'. The dashed line is the other path.")));

    function select(curve) {
      var line = Math.max.apply(null, curve) * 0.5, idx = -1;
      for (var i = 0; i < curve.length; i++) if (curve[i] >= line - 1e-9) idx = i;
      return { line: line, idx: idx };
    }
    function pts(curve) { return curve.map(function (r, i) { return x(T[i]).toFixed(1) + "," + y(r).toFixed(1); }).join(" "); }
    function render() {
      var cur = CURVES[path], oth = CURVES[path === "copy" ? "serve" : "copy"];
      STEPS.forEach(function (s, i) {
        stepEls[i].textContent = s[path];
        stepEls[i].className = path === "copy" ? "tca-bad" : "tca-good";
      });
      main.setAttribute("points", pts(cur));
      other.setAttribute("points", pts(oth));
      var sel = select(cur), sc = select(CURVES.copy);
      base.setAttribute("y1", y(sel.line)); base.setAttribute("y2", y(sel.line));
      baseT.setAttribute("y", y(sel.line) - 5);
      baseT.textContent = K.t("최대치의 50% = ", "50% of max = ") + sel.line.toFixed(3);
      dots.forEach(function (d, i) {
        var ok = cur[i] >= sel.line - 1e-9;
        d.setAttribute("cy", y(cur[i]));
        d.setAttribute("fill", ok ? "var(--tca-accent)" : "var(--entry)");
        d.setAttribute("stroke", "var(--tca-accent)");
      });
      pick.setAttribute("cx", x(T[sel.idx])); pick.setAttribute("cy", y(cur[sel.idx]));
      pickT.setAttribute("x", x(T[sel.idx])); pickT.setAttribute("y", y(cur[sel.idx]) - 13);
      pickT.textContent = T[sel.idx].toFixed(2);
      zoom.textContent = "";
      [sc.idx, sc.idx + 1, sc.idx + 2].forEach(function (i) {
        var ok = cur[i] >= sel.line - 1e-9, d = cur[i] - sel.line;
        var r = K.el("div", "tca-row");
        r.appendChild(K.el("div", "tca-row-l", K.t("임계값 ", "thr ") + T[i].toFixed(2)));
        var m = K.el("div", "tca-num", K.t("재현율 ", "recall ") + cur[i].toFixed(3));
        m.style.flex = "1"; m.style.fontSize = "12.5px";
        r.appendChild(m);
        var v = K.el("div", "tca-row-r " + (ok ? "tca-good" : "tca-bad"), (ok ? K.t("통과 ", "pass ") : K.t("미달 ", "below ")) + (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(3));
        r.appendChild(v);
        zoom.appendChild(r);
      });
      var moved = T[sel.idx] - T[sc.idx];
      read.textContent = K.t("고른 값 ", "Picked ") + T[sel.idx].toFixed(2) +
        (path === "serve" ? K.t(" — 사본 경로보다 +", " — +") + moved.toFixed(2) + K.t(". 규칙대로 새 값을 택했다.", " versus the copy path. The rule was followed.") : K.t(" — 서빙이 내지 않는 스팬으로 그린 곡선에서 고른 값이다.", " — picked from a curve built on spans serving never emits."));
    }
    render();
  });
})();
