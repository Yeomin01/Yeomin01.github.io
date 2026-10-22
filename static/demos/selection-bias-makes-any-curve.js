/* 「실패한 것만 모아서 재면, 무엇이든 설명된다」 글의 그림: 효과가 없는 데이터에서 표본 선택만으로 곡선 만들기 · 찾으려는 것을 먼저 지우는 필터 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("selection-bias-makes-any-curve-css", [
    '.tca[data-demo="selbias-curve"] .sb-mk,.tca[data-demo="selbias-filter"] .sb-mk{position:absolute;top:-2px;bottom:-2px;width:3px;',
    "margin-left:-1px;background:var(--primary);border-radius:1px}",
    '.tca[data-demo="selbias-filter"] .tca-row{transition:opacity .35s ease}',
    '.tca[data-demo="selbias-filter"] .sb-off{opacity:.35}',
    '.tca[data-demo="selbias-filter"] .sb-off .tca-row-l{text-decoration:line-through}',
    '.tca[data-demo="selbias-filter"] .sb-cnt{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:12px}',
    '.tca[data-demo="selbias-filter"] .sb-big{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}',
    "@media (prefers-reduced-motion:reduce){.tca[data-demo=\"selbias-filter\"] .tca-row{transition:none}}"
  ].join(""));

  // 시드가 있는 난수(같은 화면이 매번 같게 나오도록)
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  K.register("selbias-curve", function (root) {
    var COND = ["±20" + K.t("자", " ch"), "±40" + K.t("자", " ch"), "±80" + K.t("자", " ch"), "±160" + K.t("자", " ch"),
      "±320" + K.t("자", " ch"), K.t("원문 전체", "Full text")];
    var POST = [81.4, 69.8, 57.0, 39.5, 4.7, 0.0]; // 본문 첫 번째 표
    var FR = [0.2, 0.4, 0.6, 0.8, 1];              // 창이 넓을수록 원문 판정의 몫이 커진다
    var N = 2005, Q = 1.665;                        // Q: 표준정규에서 95.2% 가 되는 경계
    var rho = 0.99, view = "fail", showPost = true, seed = 7, a = [], e = [];

    function draw() {
      var r = rng(seed);
      function g() { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
      a = []; e = [];
      for (var i = 0; i < N; i++) { a.push(g()); e.push([g(), g(), g(), g(), g()]); }
    }

    K.head(root, K.t("길이 효과가 없는 데이터에서도 곡선은 나온다", "A curve appears even with no length effect"),
      K.t("가짜 이름 2,005건을 만든다. 어느 조건에서나 탐지율은 95.2%로 같다. 그중 원문 전체에서 실패한 사례만 골라 조건별로 다시 세면 어떻게 되는지 본다.",
        "Make 2,005 fake names. Every condition has the same 95.2% detection rate. Keep only the ones that failed on the full text, then recount per condition."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "fail", label: K.t("원문에서 실패한 것만", "Failed on full text only") },
      { value: "all", label: K.t("전체 2,005건", "All 2,005") }], view, function (v) { view = v; render(); },
      K.t("표본 고르기", "Pick the sample"));
    bar.appendChild(sg.el);
    var bPost = K.btn(K.t("본문 표 겹치기", "Overlay the post's table"), true);
    var bRe = K.btn(K.t("다시 뽑기", "Redraw"));
    bar.appendChild(bPost); bar.appendChild(bRe);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var sl = K.slider({ label: K.t("±320자 창이 원문 판정을 닮는 정도", "How much the ±320 window resembles the full text"),
      min: 0, max: 1, step: 0.01, value: rho, fmt: function (v) { return v.toFixed(2); },
      onInput: function (v) { rho = v; render(); } });
    bar2.appendChild(sl.el);
    root.appendChild(bar2);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "78px");
    rows.style.setProperty("--tca-rw", "54px");
    var R = COND.map(function (c) {
      var rw = K.el("div", "tca-row"), l = K.el("div", "tca-row-l", c), tr = K.el("div", "tca-track"),
        f = K.el("div", "tca-fill"), mk = K.el("div", "sb-mk"), v = K.el("div", "tca-row-r");
      tr.appendChild(f); tr.appendChild(mk);
      rw.appendChild(l); rw.appendChild(tr); rw.appendChild(v); rows.appendChild(rw);
      return { f: f, mk: mk, v: v };
    });
    root.appendChild(rows);
    var leg = K.el("div", "tca-legend");
    root.appendChild(leg);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "시뮬레이션 가정: 사례마다 숨은 난이도 하나와 조건별 잡음을 섞어 판정한다. 원문 판정은 난이도만 보고, 창은 넓을수록 난이도의 몫이 커진다(±320자는 슬라이더 값 S, ±160자 0.8S … ±20자 0.2S). 전체 탐지율 95.2%는 본문 두 번째 표의 가중 평균이다. 길이나 위치는 판정에 전혀 들어가지 않는다. 선택만으로 이런 곡선이 나올 수 있다는 것을 보여 줄 뿐, 본문 곡선의 모양을 그대로 재현하려는 것은 아니다.",
      "Simulation assumption: each case mixes one hidden difficulty with per-condition noise. The full-text decision uses the difficulty only; wider windows take a larger share of it (±320 gets the slider value S, ±160 0.8S … ±20 0.2S). The 95.2% overall rate is the weighted mean of the post's second table. Length and position never enter the decision. It only shows that selection alone can produce such a curve; it is not meant to reproduce the exact shape of the post's curve.")));

    function render() {
      var s = FR.map(function (f) { return f * rho; });
      var sel = 0, det = [0, 0, 0, 0, 0, 0];
      for (var i = 0; i < N; i++) {
        var failFull = a[i] > Q;
        if (view === "fail" && !failFull) continue;
        sel++;
        for (var k = 0; k < 5; k++) {
          var z = Math.sqrt(s[k]) * a[i] + Math.sqrt(1 - s[k]) * e[i][k];
          if (z <= Q) det[k]++;
        }
        if (!failFull) det[5]++;
      }
      var over = showPost && view === "fail";
      det.forEach(function (d, k) {
        var p = sel ? (100 * d) / sel : 0;
        R[k].f.style.width = p + "%";
        R[k].f.style.background = k === 5 && view === "fail" ? "var(--tca-warn)" : "var(--tca-accent)";
        R[k].v.textContent = p.toFixed(1) + "%";
        R[k].mk.style.display = over ? "" : "none";
        R[k].mk.style.left = POST[k] + "%";
      });
      leg.textContent = "";
      var l1 = K.el("span"), i1 = K.el("i"); i1.style.background = "var(--tca-accent)";
      l1.appendChild(i1); l1.appendChild(document.createTextNode(K.t("시뮬레이션 탐지 성공", "Simulated detection")));
      leg.appendChild(l1);
      if (view === "fail") {
        var l2 = K.el("span"), i2 = K.el("i"); i2.style.background = "var(--tca-warn)";
        l2.appendChild(i2); l2.appendChild(document.createTextNode(K.t("선택 조건(정의상 0%)", "Selection condition (0% by definition)")));
        leg.appendChild(l2);
      }
      if (over) {
        var l3 = K.el("span"), i3 = K.el("i"); i3.style.background = "var(--primary)"; i3.style.width = "3px";
        l3.appendChild(i3); l3.appendChild(document.createTextNode(K.t("본문 첫 번째 표(86건)", "Post's first table (86 cases)")));
        leg.appendChild(l3);
      }
      read.textContent = view === "fail"
        ? K.t("표본 ", "Sample ") + K.fmt(sel) + K.t("건 — 원문 전체에서 실패한 사례만 골랐다. 오른쪽 끝 0%는 측정이 아니라 고른 조건이다.",
          " — only cases that failed on the full text. The 0% at the right end is the selection rule, not a measurement.")
        : K.t("표본 ", "Sample ") + K.fmt(sel) + K.t("건 — 성공·실패를 가리지 않았다. 어느 조건이든 95% 안팎으로 평평하다.",
          " — successes and failures alike. Every condition sits flat around 95%.");
    }

    bPost.addEventListener("click", function () { showPost = !showPost; K.press(bPost, showPost); render(); });
    bRe.addEventListener("click", function () { seed = (seed * 48271 + 11) % 2147483647; draw(); render(); });
    draw();
    render();
  });

  K.register("selbias-filter", function (root) {
    // 이름 가의 165번 중 89번은 본문 값, 나머지는 예시 값
    var ITEMS = [
      { id: K.t("'고객'", "'customer'"), kind: "w", n: 2400, lab: 36 },
      { id: K.t("'이상'", "'above'"), kind: "w", n: 1800, lab: 18 },
      { id: K.t("이름 가", "Name A"), kind: "n", n: 165, lab: 89 },
      { id: K.t("이름 나", "Name B"), kind: "n", n: 300, lab: 298 },
      { id: K.t("이름 다", "Name C"), kind: "n", n: 210, lab: 147 },
      { id: K.t("이름 라", "Name D"), kind: "n", n: 120, lab: 119 },
      { id: K.t("이름 마", "Name E"), kind: "n", n: 80, lab: 40 },
      { id: K.t("이름 바", "Name F"), kind: "n", n: 95, lab: 94 }
    ];
    var TH = 80, on = false, shown = 0, target = 0, truth = 0;
    ITEMS.forEach(function (it) { if (it.kind === "n") truth += it.n - it.lab; });

    K.head(root, K.t("찾으려는 것을 먼저 지우는 필터", "A filter that removes what you came to find"),
      K.t("이름 목록에 일반 단어가 섞여 들어왔다. '라벨률 80% 이상'만 남기면 일반 단어는 빠지지만, 라벨이 자주 누락되는 이름도 같이 빠진다.",
        "Common words slipped into the name list. Keeping only 'label rate ≥ 80%' drops them, but it also drops names whose labels are often missing."));
    var bar = K.el("div", "tca-bar");
    var bF = K.btn(K.t("라벨률 80% 필터", "Label-rate 80% filter"), false);
    bar.appendChild(bF);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "74px");
    rows.style.setProperty("--tca-rw", "96px");
    var R = ITEMS.map(function (it) {
      var rw = K.el("div", "tca-row"), l = K.el("div", "tca-row-l", it.id), tr = K.el("div", "tca-track"),
        f = K.el("div", "tca-fill"), mk = K.el("div", "sb-mk"), v = K.el("div", "tca-row-r");
      var rate = (100 * it.lab) / it.n;
      f.style.width = rate + "%";
      f.style.background = it.kind === "w" ? "var(--tca-warn)" : "var(--tca-accent)";
      mk.style.left = TH + "%";
      v.textContent = K.fmt(it.lab) + "/" + K.fmt(it.n) + " " + Math.round(rate) + "%";
      tr.appendChild(f); tr.appendChild(mk);
      rw.appendChild(l); rw.appendChild(tr); rw.appendChild(v); rows.appendChild(rw);
      return { rw: rw, rate: rate };
    });
    root.appendChild(rows);
    var leg = K.el("div", "tca-legend");
    [["var(--tca-accent)", K.t("실제 이름", "Real name")], ["var(--tca-warn)", K.t("일반 단어(오라벨)", "Common word (mislabeled)")],
      ["var(--primary)", K.t("세로 선: 80%", "Vertical line: 80%")]].forEach(function (x) {
      var s = K.el("span"), i = K.el("i"); i.style.background = x[0];
      s.appendChild(i); s.appendChild(document.createTextNode(x[1])); leg.appendChild(s);
    });
    root.appendChild(leg);

    var cnt = K.el("div", "sb-cnt");
    var b1 = K.el("div", "tca-box"), b2 = K.el("div", "tca-box");
    b1.appendChild(K.el("div", "tca-h", K.t("측정된 미라벨 출현", "Measured missing labels")));
    var big1 = K.el("div", "sb-big"); b1.appendChild(big1);
    var sub1 = K.el("div", "tca-note"); b1.appendChild(sub1);
    b2.appendChild(K.el("div", "tca-h", K.t("실제 이름의 미라벨 출현", "Missing labels on real names")));
    var big2 = K.el("div", "sb-big", K.fmt(truth)); b2.appendChild(big2);
    b2.appendChild(K.el("div", "tca-note", K.t("이름 6개의 (출현 − 라벨)", "(occurrences − labeled) over the 6 names")));
    cnt.appendChild(b1); cnt.appendChild(b2);
    root.appendChild(cnt);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "이름 가의 165번 중 89번(54%)만 본문 값이고, 나머지 출현 수는 예시 값이다. 본문 실측은 필터를 건 측정이 전 구간 1% 미만, 필터를 뺀 실제 규모가 8,717건이었다.",
      "Only Name A (89 of 165, 54%) comes from the post; the other counts are example values. In the post, the filtered measurement was under 1% everywhere and the real size without the filter was 8,717.")));

    function measure() {
      var m = 0, kept = 0, words = 0, names = 0;
      ITEMS.forEach(function (it, i) {
        var keep = !on || R[i].rate >= TH;
        R[i].rw.className = "tca-row" + (keep ? "" : " sb-off");
        if (!keep) return;
        m += it.n - it.lab; kept += it.n;
        if (it.kind === "w") words++; else names++;
      });
      return { m: m, kept: kept, words: words, names: names };
    }
    function render() {
      var s = measure();
      target = s.m;
      sub1.textContent = K.t("남은 항목 ", "Kept ") + (s.words + s.names) + K.t("개 · 남은 출현 중 ", " · ") +
        (s.kept ? ((100 * s.m) / s.kept).toFixed(1) : "0.0") + K.t("%", "% of kept occurrences");
      var gone = 6 - s.names, pct = Math.round((100 * s.m) / truth);
      read.textContent = on
        ? K.t("필터를 켰다. 일반 단어 2개와 함께 이름 " + gone + "개가 빠졌다. 측정에는 실제 미라벨 " + K.fmt(truth) + "건 중 " + K.fmt(s.m) + "건(" + pct + "%)만 남아 '거의 없다'로 보인다.",
          "Filter on. Along with the 2 common words, " + gone + " names dropped out. The measurement keeps only " + K.fmt(s.m) + " of the real " + K.fmt(truth) + " missing labels (" + pct + "%), so it looks like 'almost none'.")
        : K.t("필터를 껐다. 일반 단어 " + s.words + "개의 출현이 미라벨 이름으로 세어져 값이 부푼다.",
          "Filter off. Occurrences of the " + s.words + " common words are counted as missing names, so the number balloons.");
    }
    bF.addEventListener("click", function () { on = !on; K.press(bF, on); render(); });
    render();
    shown = target;
    big1.textContent = K.fmt(shown);
    // 숫자가 새 값으로 굴러가게 한다
    K.loop(root, function (dt) {
      if (shown === target) return;
      if (K.reduce) shown = target;
      else {
        var d = target - shown, stepv = Math.round(d * Math.min(1, dt / 120));
        if (Math.abs(stepv) < 1) stepv = d > 0 ? 1 : -1;
        shown = Math.abs(d) <= Math.abs(stepv) ? target : shown + stepv;
      }
      big1.textContent = K.fmt(shown);
    });
  });
})();
