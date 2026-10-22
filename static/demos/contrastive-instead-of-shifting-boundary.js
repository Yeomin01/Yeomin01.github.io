/* 「경계를 옮기는 대신 표현을 떼어놓기」 글의 그림: 겹친 구름 사이로 경계를 옮길 때와 구름을 떼어놓을 때 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("contrast-clouds", function (root) {
    var N = 40;
    // 정규분포 분위수(근사)로 점 위치를 정한다. 매번 같은 그림이 나오도록 난수는 쓰지 않는다.
    function probit(p) {
      var a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
      var b = [-8.4735109309, 23.08336743743, -21.06224101826, 3.13082909833];
      var c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209, 0.0276438810333863,
        0.0038405729373609, 0.0003951896511919, 0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
      var y = p - 0.5, r, x;
      if (Math.abs(y) < 0.42) {
        r = y * y;
        return y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) / ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1);
      }
      r = p < 0.5 ? p : 1 - p;
      r = Math.log(-Math.log(r));
      x = c[0] + r * (c[1] + r * (c[2] + r * (c[3] + r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))));
      return y < 0 ? -x : x;
    }
    var Z = [], JY = [];
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < N; i++) Z.push(probit((i + 0.5) / N));
    for (var j = 0; j < 2 * N; j++) JY.push(rnd());

    // s=0: 겹친 상태, s=1: 떼어놓은 상태(가정)
    function pos(kind, i, s) {
      var mu = kind === 0 ? 0.45 - 0.22 * s : 0.55 + 0.22 * s;
      var sd = 0.12 - 0.055 * s;
      return Math.max(0.02, Math.min(0.98, mu + sd * Z[i]));
    }

    K.head(root, K.t("경계를 옮기기 vs 구름을 떼어놓기", "Shift the boundary vs pull the clouds apart"),
      K.t("정상(동그라미)과 공격(네모)이 표현 공간에서 겹쳐 있으면 경계를 어디로 옮기든 오탐과 재현율이 맞바뀐다. 손실을 바꿔 두 덩어리를 떼어놓으면 경계 하나로 둘 다 지킬 자리가 생긴다.",
        "When benign (circles) and attacks (squares) overlap in representation space, moving the boundary only trades false positives for recall. Pulling the two clouds apart leaves a spot where one boundary keeps both."));

    var bar = K.el("div", "tca-bar");
    var target = 0, s = 0;
    var mode = K.seg([
      { value: 0, label: K.t("CrossEntropy만 (겹침)", "CrossEntropy only (overlap)") },
      { value: 1, label: K.t("+ λ·SupCon (분리 가정)", "+ λ·SupCon (assume separation)") }
    ], 0, function (v) { target = v; if (K.reduce) { s = v; draw(); } }, K.t("손실", "Loss"));
    var bnd = 0.5;
    var sl = K.slider({ label: K.t("경계 위치", "Boundary"), min: 0.1, max: 0.9, step: 0.01, value: 0.5,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { bnd = v; draw(); } });
    bar.appendChild(mode.el); bar.appendChild(sl.el);
    root.appendChild(bar);

    var W = 480, H = 170, X0 = 14, X1 = 466, Y0 = 26, Y1 = 150;
    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("정상과 공격 점의 분포와 판정 경계", "Benign and attack points with the decision boundary") }, root);
    function xp(v) { return X0 + v * (X1 - X0); }
    var zone = K.svg("rect", { y: Y0 - 8, height: Y1 - Y0 + 16, fill: "var(--tca-bad)", opacity: 0.08 }, sv);
    K.svg("line", { x1: X0, x2: X1, y1: Y1 + 10, y2: Y1 + 10, stroke: "var(--tertiary)" }, sv);
    var zoneTxt = K.svg("text", { y: 16, "font-size": 12, "class": "muted" }, sv);
    zoneTxt.setAttribute("text-anchor", "middle");
    zoneTxt.textContent = K.t("경계", "boundary");
    var dots = [];
    for (var k = 0; k < 2 * N; k++) {
      var kind = k < N ? 0 : 1;
      var col = kind === 0 ? K.COLORS[0] : K.COLORS[2];
      var e = kind === 0 ? K.svg("circle", { r: 5, fill: col, "fill-opacity": 0.85 }, sv)
        : K.svg("rect", { width: 9, height: 9, fill: col, "fill-opacity": 0.85 }, sv);
      dots.push({ e: e, kind: kind, i: k % N, y: Y0 + 4 + JY[k] * (Y1 - Y0 - 8) });
    }
    var line = K.svg("line", { y1: Y0 - 8, y2: Y1 + 16, stroke: "var(--primary)", "stroke-width": 2, "stroke-dasharray": "5 4" }, sv);
    var axl = K.svg("text", { x: X0, y: H - 2, "font-size": 12, "class": "muted" }, sv);
    axl.textContent = K.t("← 정상 쪽 · 표현 공간(한 축으로 줄임) · 공격 쪽 →", "← benign side · representation (one axis) · attack side →");

    var lg = K.el("div", "tca-legend");
    var l1 = K.el("span"); var i1 = K.el("i"); i1.style.background = K.COLORS[0]; i1.style.borderRadius = "50%";
    l1.appendChild(i1); l1.appendChild(document.createTextNode(K.t("정상 40", "benign 40")));
    var l2 = K.el("span"); var i2 = K.el("i"); i2.style.background = K.COLORS[2];
    l2.appendChild(i2); l2.appendChild(document.createTextNode(K.t("공격 40", "attack 40")));
    var l3 = K.el("span"); var i3 = K.el("i"); i3.style.background = "var(--tca-bad)"; i3.style.opacity = "0.25";
    l3.appendChild(i3); l3.appendChild(document.createTextNode(K.t("옅은 붉은 칸 = 공격으로 판정되는 쪽", "shaded = flagged as attack")));
    lg.appendChild(l1); lg.appendChild(l2); lg.appendChild(l3);
    root.appendChild(lg);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "86px");
    rows.style.marginTop = "10px";
    function row(label, color) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      f.style.background = color;
      tr.appendChild(f);
      r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v };
    }
    var rFP = row(K.t("오탐률", "FP rate"), "var(--tca-bad)");
    var rRec = row(K.t("공격 재현율", "Attack recall"), "var(--tca-good)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "점의 위치는 예시 값이다. 글을 쓸 때 SupCon 학습은 아직 결과가 나오지 않았다. 「분리 가정」 상태는 글의 가정(두 덩어리가 실제로 분리된다면)을 그린 것이다. 세로 위치는 점이 겹치지 않게 흩뜨린 것으로 의미가 없다.",
      "Point positions are example values. When the post was written the SupCon run had no result yet; the \"assume separation\" state draws the post's assumption (if the clouds really separate). Vertical position only spreads the points out.")));

    var lastKey = "";
    function draw() {
      var key = s.toFixed(4) + "|" + bnd;
      if (key === lastKey) return;
      lastKey = key;
      var fp = 0, tp = 0;
      dots.forEach(function (d) {
        var v = pos(d.kind, d.i, s), x = xp(v);
        if (d.kind === 0) { d.e.setAttribute("cx", x.toFixed(1)); d.e.setAttribute("cy", d.y.toFixed(1)); if (v >= bnd) fp++; }
        else { d.e.setAttribute("x", (x - 4.5).toFixed(1)); d.e.setAttribute("y", (d.y - 4.5).toFixed(1)); if (v >= bnd) tp++; }
      });
      var bx = xp(bnd);
      line.setAttribute("x1", bx); line.setAttribute("x2", bx);
      zone.setAttribute("x", bx); zone.setAttribute("width", Math.max(0, X1 + 8 - bx));
      zoneTxt.setAttribute("x", Math.max(30, Math.min(450, bx)));
      rFP.f.style.width = (fp / N * 100) + "%"; rFP.v.textContent = fp + "/40";
      rRec.f.style.width = (tp / N * 100) + "%"; rRec.v.textContent = tp + "/40";
      var msg;
      if (s < 0.5) msg = K.t("겹친 상태: 경계를 왼쪽으로 밀면 재현율이 오르고 오탐도 오른다. 오른쪽으로 밀면 둘 다 내려간다.",
        "Overlapping: push the boundary left and recall rises with false positives; push right and both fall.");
      else msg = K.t("떼어놓은 상태: 가운데 근처에 오탐 0과 재현율 40/40이 함께 되는 경계 구간이 있다.",
        "Separated: near the middle there is a range where 0 false positives and 40/40 recall hold together.");
      read.textContent = K.t("오탐 ", "FP ") + Math.round(fp / N * 100) + "% · " + K.t("재현율 ", "recall ") + Math.round(tp / N * 100) + "% — " + msg;
    }
    K.loop(root, function (dt) {
      if (s === target) return;
      var stepv = dt / 1200;
      s = s < target ? Math.min(target, s + stepv) : Math.max(target, s - stepv);
      draw();
    });
    draw();
  });
})();
