/* 「데이터를 줄여서 더 잘 학습하기」 글의 그림: k-means 중심거리로 난이도를 매기고, 데이터 양에 따라 남길 쪽을 고른다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  K.register("prune-kmeans-keep", function (root) {
    var W = 460, H = 250, KC = 3;
    // 예시 배치: 세 덩어리 + 멀리 떨어진 점 몇 개
    var CENT = [[110, 88], [340, 78], [238, 182]];
    var OUT = [[28, 222], [440, 214], [26, 30], [446, 148], [178, 18]];
    var ALL = (function () {
      var r = rng(11), pts = [];
      for (var i = 0; i < 30; i++) {
        for (var c = 0; c < KC; c++) {
          var u = Math.max(1e-6, r()), v = r();
          var m = Math.sqrt(-2 * Math.log(u)) * 22;
          var px = CENT[c][0] + m * Math.cos(2 * Math.PI * v), py = CENT[c][1] + m * Math.sin(2 * Math.PI * v);
          pts.push({ x: Math.max(10, Math.min(W - 10, px)), y: Math.max(10, Math.min(H - 10, py)), rank: i });
        }
      }
      OUT.forEach(function (o, i) { pts.push({ x: o[0], y: o[1], rank: i < 2 ? 0 : 20 }); });
      return pts;
    })();
    var SIZES = { few: 10, many: 30 };

    var amount = "many", keepPct = 70, filterExtreme = false, seed = 3;
    var pts = [], centers = [], assign = [], phase = "assign", t = 0, iter = 0, from = null, to = null;
    var cutR = 0, extremeSet = {}, keptSet = {};

    K.head(root, K.t("중심거리로 난이도를 매기고 남길 쪽 고르기", "Rank by distance to the centre, then pick what to keep"),
      K.t("라벨 없이 embedding 공간에서 k-means 를 돌리고, 가장 가까운 중심까지의 거리를 난이도로 쓴다. 데이터가 적으면 중심 가까운 easy 를, 많으면 먼 hard 를 남긴다.",
        "Run k-means in embedding space with no labels and use the distance to the nearest centre as difficulty. With little data keep the near (easy) points; with a lot, keep the far (hard) ones."));

    var bar = K.el("div", "tca-bar");
    var sAmt = K.seg([
      { value: "few", label: K.t("데이터 적음 → easy 남김", "Little data → keep easy") },
      { value: "many", label: K.t("데이터 많음 → hard 남김", "Lots of data → keep hard") }
    ], amount, function (v) { amount = v; build(); }, K.t("가진 데이터 양", "Data you have"));
    var sKeep = K.slider({ label: K.t("남길 비율", "Keep"), min: 30, max: 100, step: 5, value: keepPct,
      fmt: function (v) { return v + "%"; }, onInput: function (v) { keepPct = v; decide(); paint(); } });
    var bFilter = K.btn(K.t("극단 hard 먼저 거르기", "Drop extreme hard first"), filterExtreme);
    var bRerun = K.btn(K.t("k-means 다시", "Re-run k-means"));
    bar.appendChild(sAmt.el); bar.appendChild(sKeep.el); bar.appendChild(bFilter); bar.appendChild(bRerun);
    root.appendChild(bar);

    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("embedding 공간의 점과 k-means 중심", "Points in embedding space with k-means centres") });
    K.svg("rect", { x: 0.5, y: 0.5, width: W - 1, height: H - 1, fill: "none", stroke: "var(--tertiary)", rx: 6 }, s);
    var gCut = K.svg("g", null, s), gPts = K.svg("g", null, s), gCen = K.svg("g", null, s);
    root.appendChild(s);

    var lg = K.el("div", "tca-legend");
    function li(html, label) { var sp = K.el("span"); sp.appendChild(html); sp.appendChild(document.createTextNode(label)); lg.appendChild(sp); }
    var i1 = K.el("i"); i1.style.background = K.COLORS[0]; li(i1, K.t("채운 점 = 남김(색은 묶음)", "Filled = kept (colour = cluster)"));
    var i2 = K.el("i"); i2.style.border = "1.5px solid var(--secondary)"; i2.style.borderRadius = "50%"; i2.style.width = "10px"; li(i2, K.t("빈 점 = 버림", "Hollow = dropped"));
    var i3 = K.el("i"); i3.style.border = "2px solid var(--tca-bad)"; i3.style.borderRadius = "50%"; i3.style.width = "10px"; li(i3, K.t("빨간 고리 = 중심에서 가장 먼 5%(극단 hard)", "Red ring = farthest 5% (extreme hard)"));
    var i4 = K.el("i"); i4.style.borderTop = "2px dashed var(--secondary)"; i4.style.height = "0"; i4.style.verticalAlign = "3px"; li(i4, K.t("점선 원 = 남김/버림 경계 거리", "Dashed circle = keep/drop cut distance"));
    root.appendChild(lg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "점 배치·개수와 5% 기준은 예시 값이다. 본문이 전하는 결과는 이 self-supervised 기준이 데이터의 70~80% 를 남기는 구간까지 supervised 기준에 견줄 만했다는 것이다. 적음과 많음이 어디서 갈리는지는 그림이 말하지 않는다.",
      "Point layout, counts and the 5% cut are example values. The result reported in the post is that this self-supervised metric matched the supervised one down to keeping 70–80% of the data. The figure does not say where 'little' turns into 'a lot'.")));

    var dots = [], cenEls = [];
    function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
    function nearest(p, cs) {
      cs = cs || centers;
      var bi = 0, bd = Infinity;
      for (var c = 0; c < cs.length; c++) { var d = d2(p, cs[c]); if (d < bd) { bd = d; bi = c; } }
      return bi;
    }
    function plusplus(r) {
      var cs = [];
      var first = pts[Math.floor(r() * pts.length)];
      cs.push({ x: first.x, y: first.y });
      while (cs.length < KC) {
        var ds = pts.map(function (p) { return d2(p, cs[nearest(p, cs)]); });
        var sum = ds.reduce(function (a, b) { return a + b; }, 0), u = r() * sum, k = 0;
        while (k < ds.length - 1 && u > ds[k]) { u -= ds[k]; k++; }
        cs.push({ x: pts[k].x, y: pts[k].y });
      }
      return cs;
    }
    function means(cs, as) {
      cs = cs || centers; as = as || assign;
      var acc = cs.map(function () { return { x: 0, y: 0, n: 0 }; });
      pts.forEach(function (p, i) { var a = acc[as[i]]; a.x += p.x; a.y += p.y; a.n += 1; });
      return acc.map(function (a, c) { return a.n ? { x: a.x / a.n, y: a.y / a.n } : { x: cs[c].x, y: cs[c].y }; });
    }
    function initCenters() {
      // k-means++ 초기화를 여러 번 해 보고, 끝까지 돌렸을 때 가장 촘촘한 것의 시작점을 쓴다(라이브러리의 n_init 과 같은 방식)
      var best = null, bestIn = Infinity;
      for (var j = 0; j < 8; j++) {
        var init = plusplus(rng(seed * 7919 + (amount === "many" ? 1 : 2) + j * 101));
        var cs = init, as = null;
        for (var k = 0; k < 30; k++) {
          as = pts.map(function (p) { return nearest(p, cs); });
          var nx = means(cs, as), mv = shift(cs, nx);
          cs = nx;
          if (mv < 0.5) break;
        }
        var inertia = 0;
        pts.forEach(function (p) { inertia += d2(p, cs[nearest(p, cs)]); });
        if (inertia < bestIn - 1e-6) { bestIn = inertia; best = init; }
      }
      centers = best;
    }
    function doAssign() { assign = pts.map(function (p) { return nearest(p); }); }
    function shift(a, b) { var s2 = 0; for (var c = 0; c < a.length; c++) s2 += Math.sqrt(d2(a[c], b[c])); return s2; }

    function build() {
      sAmt.set(amount);
      var n = SIZES[amount];
      pts = ALL.filter(function (p) { return p.rank < n; }).map(function (p) { return { x: p.x, y: p.y }; });
      gPts.textContent = ""; gCen.textContent = ""; gCut.textContent = "";
      dots = pts.map(function (p) {
        var g = K.svg("g", null, gPts);
        var ring = K.svg("circle", { cx: p.x, cy: p.y, r: 8, fill: "none", stroke: "var(--tca-bad)", "stroke-width": 1.8 }, g);
        var c = K.svg("circle", { cx: p.x, cy: p.y, r: 4.5 }, g);
        return { ring: ring, c: c };
      });
      initCenters();
      cenEls = centers.map(function () {
        var g = K.svg("g", null, gCen);
        K.svg("circle", { r: 8, fill: "var(--entry)", stroke: "var(--primary)", "stroke-width": 2.5 }, g);
        K.svg("path", { d: "M-4 0H4M0 -4V4", stroke: "var(--primary)", "stroke-width": 2 }, g);
        return g;
      });
      iter = 0; t = 0; phase = "assign";
      doAssign();
      if (K.reduce) {
        for (var k = 0; k < 30; k++) {
          var nx = means(), sh = shift(centers, nx);
          centers = nx; doAssign(); iter++;
          if (sh < 0.5) break;
        }
        phase = "done";
        decide();
      }
      paint();
    }

    function decide() {
      if (phase !== "done") return;
      var dist = pts.map(function (p, i) { return Math.sqrt(d2(p, centers[assign[i]])); });
      var order = pts.map(function (p, i) { return i; }).sort(function (a, b) { return dist[a] - dist[b]; });
      var nx = Math.ceil(pts.length * 0.05);
      extremeSet = {};
      order.slice(order.length - nx).forEach(function (i) { extremeSet[i] = true; });
      var elig = order.filter(function (i) { return !(filterExtreme && extremeSet[i]); });
      var nk = Math.round(elig.length * keepPct / 100);
      var kept = amount === "few" ? elig.slice(0, nk) : elig.slice(elig.length - nk);
      keptSet = {};
      kept.forEach(function (i) { keptSet[i] = true; });
      if (nk === 0 || nk === elig.length) cutR = 0;
      else cutR = amount === "few" ? (dist[elig[nk - 1]] + dist[elig[nk]]) / 2 : (dist[elig[elig.length - nk - 1]] + dist[elig[elig.length - nk]]) / 2;
    }

    function paint() {
      cenEls.forEach(function (g, c) { g.setAttribute("transform", "translate(" + centers[c].x.toFixed(1) + " " + centers[c].y.toFixed(1) + ")"); });
      var done = phase === "done";
      gCut.textContent = "";
      if (done && cutR > 0) {
        centers.forEach(function (c) {
          K.svg("circle", { cx: c.x, cy: c.y, r: cutR, fill: "none", stroke: "var(--secondary)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }, gCut);
        });
      }
      var keptN = 0, extKept = 0, extN = 0;
      dots.forEach(function (d, i) {
        var col = K.COLORS[assign[i] % K.COLORS.length];
        var ext = done && extremeSet[i];
        d.ring.style.display = ext ? "" : "none";
        if (!done) {
          d.c.setAttribute("fill", col); d.c.setAttribute("stroke", "none"); d.c.setAttribute("opacity", "0.6"); d.c.setAttribute("r", 4.5);
          return;
        }
        if (ext) extN++;
        if (keptSet[i]) {
          keptN++; if (ext) extKept++;
          d.c.setAttribute("fill", col); d.c.setAttribute("stroke", "none"); d.c.setAttribute("opacity", "1"); d.c.setAttribute("r", 4.5);
        } else {
          d.c.setAttribute("fill", "none"); d.c.setAttribute("stroke", "var(--secondary)"); d.c.setAttribute("stroke-width", "1.3");
          d.c.setAttribute("opacity", "0.6"); d.c.setAttribute("r", 3.5);
        }
      });
      K.press(bFilter, filterExtreme);
      if (!done) {
        read.textContent = K.t("k-means 반복 ", "k-means iteration ") + (iter + 1) +
          K.t(" — 점을 가장 가까운 중심에 배정하고, 중심을 배정된 점들의 평균으로 옮긴다.", " — assign each point to its nearest centre, then move each centre to the mean of its points.");
        return;
      }
      var side = amount === "few" ? K.t("easy(중심 가까운 것)", "easy (near the centre)") : K.t("hard(중심에서 먼 것)", "hard (far from the centre)");
      var msg = K.t("k-means ", "k-means converged after ") + iter + K.t("회 반복 후 수렴 · ", " iterations · ") + side + K.t(" 남김 · ", " kept · ") +
        keptN + "/" + pts.length + K.t("건", "");
      if (filterExtreme) msg += K.t(" · 극단 hard ", " · ") + extN + K.t("건은 먼저 걸러냄", " extreme-hard points removed first");
      else msg += K.t(" · 극단 hard ", " · extreme hard kept: ") + extKept + "/" + extN + K.t("건 남음", "");
      read.textContent = msg;
      read.className = "tca-read" + (!filterExtreme && extKept > 0 ? " tca-warn" : "");
      if (!filterExtreme && extKept > 0 && amount === "many") {
        read.textContent += K.t(" — 라벨 오류·비정상 문장일 수 있는 점까지 남는다(6절·7절).", " — points that may be label errors or broken sentences survive too (sections 6–7).");
      }
    }

    bFilter.addEventListener("click", function () { filterExtreme = !filterExtreme; decide(); paint(); });
    bRerun.addEventListener("click", function () { seed += 1; build(); });

    function ease(f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; }
    K.loop(root, function (dt) {
      if (phase === "done") return;
      t += dt;
      if (phase === "assign") {
        if (t < 500) return;
        var nx = means();
        if (shift(centers, nx) < 0.5 || iter >= 12) { iter += 1; phase = "done"; decide(); paint(); return; }
        from = centers.map(function (c) { return { x: c.x, y: c.y }; }); to = nx; phase = "move"; t = 0;
      } else if (phase === "move") {
        var f = Math.min(1, t / 600), e = ease(f);
        centers = from.map(function (a, c) { return { x: a.x + (to[c].x - a.x) * e, y: a.y + (to[c].y - a.y) * e }; });
        if (f >= 1) { centers = to; iter += 1; doAssign(); phase = "assign"; t = 0; }
        paint();
      }
    });

    build();
  });
})();
