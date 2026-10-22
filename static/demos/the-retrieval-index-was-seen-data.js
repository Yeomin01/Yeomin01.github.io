/* 「검색 인덱스도 모델이 본 데이터다」 글의 그림: 자기 자신을 이웃으로 찾는 질의, 코사인 임계로 누출 가르기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 그림 1: 평가 대화가 인덱스에 들어 있으면 가장 가까운 이웃이 자기 자신이다 */
  K.register("retr-self-nn", function (root) {
    var W = 320, H = 210, QX = 180, QY = 105, KNN = 3;
    var r = rng(20261006), pts = [];
    while (pts.length < 26) {
      var x = 14 + r() * (W - 28), y = 14 + r() * (H - 28), d = Math.hypot(x - QX, y - QY);
      if (d > 48) pts.push({ x: x, y: y, d: d, self: false });
    }
    var self = { x: QX, y: QY, d: 0, self: true };
    var mode = "out", radius = 0, found = [];
    function sim(d) { return Math.max(0, 1 - d / 300); } // 그림용: 거리가 멀수록 유사도가 준다

    K.head(root, K.t("자기 자신을 이웃으로 찾는 질의", "A query that finds itself"),
      K.t("평가 대화 하나를 질의로 넣으면 정상 예문 인덱스에서 가까운 이웃 3개를 찾는다. 같은 대화가 인덱스에 들어 있으면 첫 이웃은 자기 자신이다.",
        "One eval conversation is used as a query and its three nearest neighbors are looked up in the normal index. If the same conversation is in the index, the first neighbor is itself."));

    var bar = K.el("div", "tca-bar");
    var seg = K.seg([
      { value: "out", label: K.t("인덱스에 없음", "Not in the index") },
      { value: "in", label: K.t("같은 대화가 인덱스에 있음", "Same conversation in the index") }
    ], mode, function (v) { mode = v; restart(); }, K.t("인덱스 상태", "Index state"));
    var bAgain = K.btn(K.t("다시 찾기", "Search again"));
    bar.appendChild(seg.el); bar.appendChild(bAgain);
    root.appendChild(bar);

    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("정상 예문 인덱스의 점들과 질의 점", "Index points and the query point") }, root);
    s.style.maxWidth = "440px";
    K.svg("rect", { x: 0.5, y: 0.5, width: W - 1, height: H - 1, rx: 6, fill: "none", stroke: "var(--tertiary)" }, s);
    var ring = K.svg("circle", { cx: QX, cy: QY, r: 0, fill: "none", stroke: "var(--tca-accent)", "stroke-dasharray": "4 4" }, s);
    var lines = K.svg("g", null, s);
    pts.forEach(function (p) { p.el = K.svg("circle", { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 4, fill: "var(--secondary)", opacity: 0.55 }, s); });
    self.el = K.svg("circle", { cx: QX, cy: QY, r: 9, fill: "none", stroke: "var(--tca-bad)", "stroke-width": 2.5 }, s);
    K.svg("circle", { cx: QX, cy: QY, r: 5, fill: "var(--tca-accent)" }, s);
    var qt = K.svg("text", { x: QX, y: QY - 14, "text-anchor": "middle", "font-size": 12 }, s);
    qt.textContent = K.t("질의(평가 대화)", "query (eval chat)");
    var leg = K.el("div", "tca-legend");
    [["var(--secondary)", K.t("인덱스의 정상 예문 벡터", "Normal index vectors")],
      ["var(--tca-accent)", K.t("질의", "Query")], ["var(--tca-bad)", K.t("인덱스 속 같은 대화(링)", "Same chat in the index (ring)")]]
      .forEach(function (l) { var sp = K.el("span"), i = K.el("i"); i.style.background = l[0]; sp.appendChild(i); sp.appendChild(document.createTextNode(l[1])); leg.appendChild(sp); });
    root.appendChild(leg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "점의 배치와 유사도는 그림용 예시다. 이웃 유사도 0.7~0.85는 본문의 '같은 도메인의 다른 대화' 구간, 1.000은 같은 벡터다.",
      "Positions and similarities are illustrative. Neighbors at 0.7–0.85 match the post's 'other chats in the same domain'; 1.000 means the same vector.")));

    function pool() { return mode === "in" ? pts.concat([self]) : pts; }
    function order() { return pool().slice().sort(function (a, b) { return a.d - b.d; }); }
    var target = 0;
    function restart() {
      radius = 0; found = []; lines.textContent = "";
      self.el.style.display = mode === "in" ? "" : "none";
      var o = order();
      target = o[KNN - 1].d + 2;
      if (K.reduce) { radius = target; step(); }
      update();
    }
    function step() {
      ring.setAttribute("r", radius.toFixed(1));
      order().forEach(function (p) {
        if (p.d <= radius && found.indexOf(p) < 0 && found.length < KNN) {
          found.push(p);
          if (!p.self) K.svg("line", { x1: QX, y1: QY, x2: p.x.toFixed(1), y2: p.y.toFixed(1), stroke: "var(--tca-accent)", "stroke-width": 1.5 }, lines);
          p.el.setAttribute("opacity", "1");
        }
      });
      pts.forEach(function (p) { if (found.indexOf(p) < 0) p.el.setAttribute("opacity", "0.55"); });
    }
    function update() {
      if (found.length < KNN) { read.textContent = K.t("이웃을 찾는 중… (" + found.length + " / " + KNN + ")", "Searching… (" + found.length + " / " + KNN + ")"); return; }
      var parts = found.map(function (p) { return (p.self ? K.t("자기 자신 ", "itself ") : "") + sim(p.d).toFixed(3); });
      read.textContent = K.t("이웃 유사도: ", "Neighbor similarity: ") + parts.join(" · ") +
        (found[0].self ? K.t(" — 첫 이웃이 자기 자신이라, 모델이 이 대화를 본 것과 다르지 않다.", " — the first neighbor is itself, as if the model had seen this chat.")
          : K.t(" — 같은 도메인의 다른 대화들이다.", " — other chats from the same domain."));
    }
    K.loop(root, function (dt) {
      if (radius >= target) return;
      radius = Math.min(target, radius + dt * 0.09);
      step(); update();
    });
    bAgain.addEventListener("click", restart);
    restart();
  });

  /* 그림 2: 같은 인코더로 임베딩해 코사인 임계로 누출을 가른다 */
  K.register("retr-cos-threshold", function (root) {
    var r = rng(95);
    function clip(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function gauss(m, sd) { var u = 1 - r(), v = r(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var N = 40, i;
    var ko = [], en = [], atk = [];
    for (i = 0; i < N - 2; i++) ko.push(clip(gauss(0.76, 0.035), 0.66, 0.85));
    ko.push(0.91, 0.93);
    for (i = 0; i < N; i++) en.push(1.0);
    for (i = 0; i < N - 4; i++) atk.push(clip(gauss(0.75, 0.04), 0.64, 0.86));
    atk.push(0.96, 0.97, 0.98, 0.99);
    var AXES = [
      { name: K.t("한국어 업무·문서 정상", "Korean work/doc normals"), v: ko, c: K.COLORS[0] },
      { name: K.t("영어 정상", "English normals"), v: en, c: K.COLORS[1] },
      { name: K.t("공격", "Attacks"), v: atk, c: K.COLORS[2] }
    ];
    var th = 0.95, audit = "embed";
    var LO = 0.6, HI = 1.0, W = 320, L = 10, R = 306, ROW = 54, TOP = 6;
    var H = TOP + ROW * AXES.length + 24;
    function sx(v) { return L + (v - LO) / (HI - LO) * (R - L); }

    K.head(root, K.t("코사인 임계로 누출 가르기", "Splitting leaks with a cosine threshold"),
      K.t("평가 대화를 서빙과 같은 방법으로 임베딩해 인덱스와의 최대 코사인 유사도를 찍었다. 임계를 움직이면 축마다 몇 건이 누출로 걸리는지 바뀐다.",
        "Each eval chat is embedded the way serving does it and its max cosine to the index is plotted. Move the threshold to see how many per axis count as leaks."));

    var bar = K.el("div", "tca-bar");
    var segA = K.seg([
      { value: "ngram", label: K.t("문자 n-gram 감사", "Char n-gram audit") },
      { value: "embed", label: K.t("서빙과 같은 임베딩", "Serving-identical embedding") }
    ], audit, function (v) { audit = v; render(); }, K.t("감사 방법", "Audit method"));
    var sl = K.slider({ label: K.t("임계", "Threshold"), min: 0.8, max: 1, step: 0.01, value: th,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { th = v; render(); } });
    var bReset = K.btn(K.t("본문 임계 0.95", "Post's 0.95"));
    bar.appendChild(segA.el); bar.appendChild(sl.el); bar.appendChild(bReset);
    root.appendChild(bar);

    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("축별 최대 코사인 유사도 점 그림", "Max cosine similarity per axis") }, root);
    s.style.maxWidth = "460px";
    var band = K.svg("rect", { x: sx(0.9), y: TOP, width: sx(0.95) - sx(0.9), height: ROW * AXES.length, fill: "var(--tca-warn)", opacity: 0.12 }, s);
    var rowsG = AXES.map(function (a, k) {
      var y0 = TOP + k * ROW;
      K.svg("line", { x1: L, x2: R, y1: y0 + ROW - 6, y2: y0 + ROW - 6, stroke: "var(--tertiary)" }, s);
      var lab = K.svg("text", { x: L, y: y0 + 14, "font-size": 12 }, s);
      var cnt = K.svg("text", { x: R, y: y0 + 14, "font-size": 12, "text-anchor": "end", "class": "muted" }, s);
      var g = K.svg("g", null, s);
      var dots = a.v.map(function (v, j) {
        return K.svg("circle", { cx: sx(v).toFixed(1), cy: (y0 + 24 + (j % 6) * 4.2).toFixed(1), r: 3.2, fill: a.c }, g);
      });
      lab.textContent = a.name;
      return { lab: lab, cnt: cnt, g: g, dots: dots };
    });
    [0.6, 0.7, 0.8, 0.9, 1.0].forEach(function (v) {
      var t = K.svg("text", { x: sx(v), y: H - 6, "font-size": 12, "text-anchor": v === 0.6 ? "start" : v === 1 ? "end" : "middle", "class": "muted" }, s);
      t.textContent = v.toFixed(1);
    });
    var thLine = K.svg("line", { y1: TOP, y2: TOP + ROW * AXES.length, stroke: "var(--tca-bad)", "stroke-width": 2 }, s);

    var leg = K.el("div", "tca-legend");
    var l1 = K.el("span"), i1 = K.el("i"); i1.style.background = "var(--tca-bad)";
    l1.appendChild(i1); l1.appendChild(document.createTextNode(K.t("임계 선 (오른쪽 = 누출로 본다)", "Threshold (right = leak)")));
    var l2 = K.el("span"), i2 = K.el("i"); i2.style.background = "var(--tca-warn)"; i2.style.opacity = "0.4";
    l2.appendChild(i2); l2.appendChild(document.createTextNode(K.t("0.90~0.95 확인 대상", "0.90–0.95 review band")));
    leg.appendChild(l1); leg.appendChild(l2);
    root.appendChild(leg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "본문에 있는 것은 한국어 0.7대·영어 전부 1.000·공격 일부 0.95 초과·0.90~0.95 몇 건·임계 0.95다. 축마다 점 40개, 분포 모양, 경계 사례가 놓인 축은 예시 값이다.",
      "From the post: Korean mostly 0.7x, English all 1.000, some attacks above 0.95, a few in 0.90–0.95, threshold 0.95. Forty dots per axis, the shapes and where the borderline cases sit are illustrative.")));

    function render() {
      var embed = audit === "embed";
      thLine.setAttribute("x1", sx(th)); thLine.setAttribute("x2", sx(th));
      thLine.style.display = embed ? "" : "none";
      band.style.display = embed ? "" : "none";
      var hits = AXES.map(function (a, k) {
        var n = 0;
        a.v.forEach(function (v, j) {
          var over = embed && v >= th - 1e-9;
          if (over) n++;
          rowsG[k].dots[j].setAttribute("stroke", over ? "var(--primary)" : "none");
          rowsG[k].dots[j].setAttribute("stroke-width", "1.5");
        });
        rowsG[k].g.setAttribute("opacity", embed ? "1" : "0.15");
        rowsG[k].cnt.textContent = embed ? K.t("누출 ", "leaks ") + n + " / " + a.v.length : K.t("원문 없음 — 대조 불가", "no text to compare");
        return n;
      });
      var other = 0, border = 0, missed = 0;
      [ko, atk].forEach(function (arr) {
        arr.forEach(function (v) {
          var over = v >= th - 1e-9;
          if (over && v < 0.9) other++;
          if (over && v >= 0.9 && v < 0.95) border++;
          if (!over && v >= 0.95) missed++;
        });
      });
      var msg;
      if (!embed) msg = K.t("인덱스에는 벡터와 라벨만 있어 n-gram 감사로는 0건이다. 겹침이 없다는 뜻이 아니라 잴 수 없다는 뜻이다.",
        "The index holds only vectors and labels, so the n-gram audit finds 0. That means it cannot measure, not that nothing overlaps.");
      else if (other) msg = K.t("같은 도메인의 다른 대화(0.7~0.85)까지 누출로 걸린다.", "Other chats from the same domain (0.7–0.85) get flagged too.");
      else if (border) msg = K.t("빈 구간 안이라 같은 대화와 다른 대화는 갈린다. 다만 0.90~0.95 경계 사례 " + border + "건이 누출 쪽에 들어간다.",
        "Inside the gap the same and different chats separate, but " + border + " borderline case(s) in 0.90–0.95 land on the leak side.");
      else if (missed) msg = K.t("0.95를 넘은 공격 가운데 " + missed + "건이 빠진다. 영어 정상은 1.000이라 끝까지 걸린다.",
        missed + " of the attacks above 0.95 drop out. English normals sit at 1.000 and stay flagged.");
      else msg = K.t("1.0 근처의 같은 대화와 0.95를 넘은 공격 일부만 걸린다. 본문 임계 0.95와 같은 결과다.",
        "Only the same chats near 1.0 and the attacks above 0.95 are flagged, the same result as the post's 0.95.");
      read.textContent = (embed ? K.t("임계 ", "Threshold ") + th.toFixed(2) + K.t("에서 누출로 본 건수 — ", " — flagged: ") +
        AXES.map(function (a, k) { return a.name + " " + hits[k]; }).join(" · ") + ". " : "") + msg;
    }
    bReset.addEventListener("click", function () { th = 0.95; sl.set(th); audit = "embed"; segA.set(audit); render(); });
    render();
  });
})();
