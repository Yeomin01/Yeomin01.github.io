/* 「방어가 강한 게 아니라 우리 공격이 그것뿐이었다」 글의 그림: A를 뚫으며 고른 전략 목록으로 B를 재면 무엇을 재게 되나 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("few-transfer", function (root) {
    var N = 60, KEEP = 20;
    // 결정적 난수(예시 배치를 매번 같게)
    function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
    function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    var idx = []; for (var i = 0; i < N; i++) idx.push(i);
    var r = rng(7);
    var order = shuffle(idx.slice(), r); // A에 시험해 본 순서
    var pos = {}; order.forEach(function (c, n) { pos[c] = n; });
    var aWeak = {}; shuffle(idx.slice(), r).slice(0, 24).forEach(function (c) { aWeak[c] = 1; });
    // A에 통한 것 중 먼저 시험한 20개를 남긴다
    var kept = {}, keptList = [], scanEnd = 0;
    for (var s = 0; s < N && keptList.length < KEEP; s++) { scanEnd = s + 1; if (aWeak[order[s]]) { kept[order[s]] = 1; keptList.push(order[s]); } }
    var outside = order.filter(function (c) { return !kept[c]; }); // 3단계에서 훑는 순서
    var rank = {}; outside.forEach(function (c, n) { rank[c] = n; });
    // 두 가정 모두 '남긴 20개 중 B에 통하는 것'은 1개로 같게 둔다
    var shared = keptList[7];
    var bWeak = { strong: {}, elsewhere: {} };
    bWeak.strong[shared] = 1; bWeak.strong[outside[9]] = 1; bWeak.strong[outside[27]] = 1;
    bWeak.elsewhere[shared] = 1;
    shuffle(outside.slice(), rng(11)).slice(0, 21).forEach(function (c) { bWeak.elsewhere[c] = 1; });

    var scen = "strong", phase = 0, prog = 0, acc = 0, hold = 0, playing = !K.reduce;

    K.css("the-defense-was-not-strong-our-attacks-were-few-css", [
      '.tca[data-demo="few-transfer"] .few-g{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px;max-width:400px}',
      '.tca[data-demo="few-transfer"] .few-g i{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:4px;',
      'background:var(--code-bg);font-style:normal;font-size:12px;font-weight:600;color:var(--secondary);border:2px solid transparent;transition:background .2s}',
      '.tca[data-demo="few-transfer"] .few-g i.k{background:#4e79a7;color:#111}',
      '.tca[data-demo="few-transfer"] .few-g i.d{opacity:.5}',
      '.tca[data-demo="few-transfer"] .few-g i.b{border-color:var(--tca-bad);opacity:1;color:var(--primary)}',
      '.tca[data-demo="few-transfer"] .few-g i.k.b{color:#111}',
      '.tca[data-demo="few-transfer"] .few-p{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
      '.tca[data-demo="few-transfer"] .few-p .on{background:var(--primary);color:var(--theme)}'
    ].join(""));

    K.head(root, K.t("A용으로 다듬은 공격 목록으로 B를 재면", "Measuring B with a list tuned on A"),
      K.t("칸 하나가 전략 하나다(60칸, 예시). A를 뚫는 것만 남겨 20종을 만들고, 그 20종을 B에 그대로 건다. B에 대한 가정을 바꿔도 2단계 숫자는 같다.",
        "Each square is a strategy (60, example). Keep what breaks A until there are 20, then run those 20 on B. The step-2 number is the same under both assumptions about B."));

    var bar = K.el("div", "tca-bar");
    bar.appendChild(K.el("span", "tca-lbl", K.t("B에 대한 가정", "Assumption about B")));
    var seg = K.seg([
      { value: "strong", label: K.t("전반적으로 강하다", "Strong overall") },
      { value: "elsewhere", label: K.t("약점이 A와 다른 곳에 있다", "Weak spots elsewhere") }
    ], scen, function (v) { scen = v; paint(); }, K.t("B에 대한 가정", "Assumption about B"));
    bar.appendChild(seg.el);
    root.appendChild(bar);

    var phases = K.el("div", "few-p");
    var phEls = [K.t("1 A를 뚫으며 다듬기", "1 Tune on A"), K.t("2 고정 20종을 B에", "2 Fixed 20 on B"), K.t("3 목록 밖까지 탐색", "3 Search beyond the list")]
      .map(function (p) { var e = K.el("span", "tca-tag", p); phases.appendChild(e); return e; });
    root.appendChild(phases);

    var grid = K.el("div", "few-g");
    grid.setAttribute("aria-hidden", "true");
    var cells = idx.map(function () { var c = document.createElement("i"); grid.appendChild(c); return c; });
    root.appendChild(grid);

    var lg = K.el("div", "tca-legend");
    [["#4e79a7", K.t("A — A를 뚫어 남긴 전략", "A — kept, breaks A")], ["", K.t("· A에 안 통해 버림 · – 목록 밖에서 시험, B 못 뚫음", "· dropped on A · – tried outside, fails on B")],
      ["var(--tca-bad)", K.t("빨간 테두리 B — B를 뚫음", "Red outline B — breaks B")]].forEach(function (x) {
      var sp = K.el("span", "");
      if (x[0]) { var ic = document.createElement("i"); ic.style.background = x[0]; sp.appendChild(ic); }
      sp.appendChild(document.createTextNode(x[1]));
      lg.appendChild(sp);
    });
    root.appendChild(lg);

    var ctl = K.el("div", "tca-bar");
    ctl.style.margin = "10px 0 0";
    var bPlay = K.btn(playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"), playing);
    var bNext = K.btn(K.t("다음 단계", "Next step")), bReset = K.btn(K.t("처음부터", "Restart"));
    ctl.appendChild(bPlay); ctl.appendChild(bNext); ctl.appendChild(bReset);
    root.appendChild(ctl);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var concl = K.el("div", "tca-note", "");
    root.appendChild(concl);
    root.appendChild(K.el("div", "tca-note", K.t(
      "전략 배치와 성공 여부는 설명을 위한 가정이다. 본문의 43%·48%·2%를 재현하는 계산이 아니다(실제 실험은 대화 단위 유출률을 쟀다).",
      "Placement and outcomes are assumptions for illustration, not a reproduction of the post's 43% · 48% · 2% (the experiment measured per-conversation leaks).")));

    function len() { return phase === 0 ? scanEnd : phase === 1 ? KEEP : outside.length; }
    function count(set, list) { var n = 0; list.forEach(function (c) { if (set[c]) n++; }); return n; }
    function paint() {
      var B = bWeak[scen];
      cells.forEach(function (c, i) {
        var tried = pos[i] < (phase === 0 ? prog : scanEnd);
        var cls = "", txt = "";
        if (tried) { if (kept[i]) { cls = "k"; txt = "A"; } else { cls = "d"; txt = "·"; } }
        var shown = phase === 1 ? (kept[i] && keptList.indexOf(i) < prog) : phase === 2 ? (kept[i] || rank[i] < prog) : false;
        if (shown && B[i]) { cls += " b"; txt = kept[i] ? "AB" : "B"; }
        else if (shown && !kept[i] && !tried) { cls = "d"; txt = "–"; }
        c.className = cls; c.textContent = txt;
      });
      phEls.forEach(function (e, j) { e.className = "tca-tag" + (j === phase ? " on" : ""); });
      var done = prog >= len();
      if (phase === 0) read.textContent = K.t("A에 시험한 전략 ", "Tried on A: ") + Math.min(prog, scanEnd) + K.t("개 · 남긴 전략 ", " · kept ") + count(kept, order.slice(0, prog)) + " / " + KEEP;
      else if (phase === 1) read.textContent = K.t("고정 목록 중 B를 뚫은 것: ", "Fixed list breaking B: ") + count(B, keptList.slice(0, prog)) + " / " + Math.min(prog, KEEP);
      else read.textContent = K.t("고정 목록 1 / 20 · 목록 밖에서 새로 B를 뚫은 것: ", "Fixed list 1 / 20 · new breaks on B outside it: ") +
        count(B, outside.slice(0, prog)) + " / " + Math.min(prog, outside.length);
      concl.textContent = phase === 1 && done ? K.t("두 가정 모두 1 / 20 이다. 이 숫자만으로는 둘을 가를 수 없다.", "1 / 20 under both assumptions. This number alone cannot tell them apart.")
        : phase === 2 && done ? (scen === "strong" ? K.t("이 가정에서는 B가 실제로 강하다. 목록 밖에서도 거의 안 뚫린다.", "Here B really is strong; little breaks outside the list either.")
          : K.t("이 가정에서는 고정 목록이 B의 약점을 못 본 것이다. 목록 밖에서 새로 뚫린다.", "Here the fixed list simply missed B's weak spots; new breaks appear outside it."))
        : "";
    }
    function setPhase(p) { phase = p; prog = K.reduce ? len() : 0; acc = 0; hold = 0; paint(); }
    function setPlaying(v) { playing = v; K.press(bPlay, v); bPlay.textContent = v ? K.t("일시정지", "Pause") : K.t("재생", "Play"); }
    bPlay.addEventListener("click", function () {
      setPlaying(!playing);
      if (playing && phase === 2 && prog >= len()) setPhase(0);
    });
    bNext.addEventListener("click", function () {
      if (prog < len()) { prog = len(); paint(); } else setPhase(Math.min(2, phase + 1));
    });
    bReset.addEventListener("click", function () { setPhase(0); });

    K.loop(root, function (dt) {
      if (!playing) return;
      if (prog < len()) {
        acc += dt;
        var per = phase === 0 ? 70 : phase === 1 ? 110 : 50, moved = false;
        while (acc > per && prog < len()) { acc -= per; prog++; moved = true; }
        if (moved) paint();
        return;
      }
      if (phase === 2) { setPlaying(false); return; }
      hold += dt;
      if (hold > 1800) setPhase(phase + 1);
    });
    setPhase(0);
  });
})();
