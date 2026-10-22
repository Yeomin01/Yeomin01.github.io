/* 「잠금 하나가 처리량을 못 박아 두었다」 글의 그림: 잠금 범위에 따른 시간표, 사본 수에 따른 메모리 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="lock-scope"] ';
  var C = '.tca[data-demo="lock-copies"] ';
  K.css("a-lock-pinned-the-throughput-css", [
    S + ".lk-rows{display:flex;flex-direction:column;gap:4px;--tca-lw:64px}",
    S + ".lk-t{position:relative;flex:1;min-width:0;height:18px;background:var(--code-bg);border-radius:3px;overflow:hidden}",
    S + ".lk-s{position:absolute;top:0;bottom:0;color:#111;font-size:11px;line-height:18px;text-align:center;overflow:hidden}",
    S + ".lk-s.wait{background:repeating-linear-gradient(135deg,var(--tertiary) 0 3px,transparent 3px 6px)}",
    S + ".lk-cur{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--primary);opacity:.55}",
    C + ".lk-grid{display:flex;flex-wrap:wrap;gap:3px;margin:10px 0 0;min-height:12px}",
    C + ".lk-grid i{display:block;width:10px;height:10px;border-radius:2px;background:var(--tca-warn)}"
  ].join(""));

  function legend(items) {
    var lg = K.el("div", "tca-legend");
    items.forEach(function (x) {
      var s = K.el("span"), i = K.el("i");
      i.setAttribute("style", x[1]);
      s.appendChild(i);
      s.appendChild(document.createTextNode(x[0]));
      lg.appendChild(s);
    });
    return lg;
  }

  /* ── 1. 잠금 범위 ── */
  K.register("lock-scope", function (root) {
    var PH = [
      { k: "tok", d: 1, c: K.COLORS[0], n: K.t("토큰화", "Tokenize") },
      { k: "enc", d: 4, c: K.COLORS[1], n: K.t("인코더", "Encoder") },
      { k: "comb", d: 1, c: K.COLORS[3], n: K.t("결합기", "Combiner") },
      { k: "knn", d: 2, c: K.COLORS[4], n: K.t("이웃 검색", "Neighbor search") }
    ];
    var COL = {};
    PH.forEach(function (p) { COL[p.k] = p.c; });
    var H = 48, RUN_MS = 6500, HOLD_MS = 2500;
    var mode = "whole", n = 4, paused = K.reduce, f = K.reduce ? 1 : 0, hold = 0;
    var sim, base1, rowEls = [], curs = [], lastRead = "";

    K.head(root, K.t("잠금 범위에 따라 달라지는 시간표", "How the lock's scope shapes the timeline"),
      K.t("스레드마다 대화를 하나씩 맡아 판정하고, 끝나면 바로 다음 대화를 받는다. 판정은 토큰화 → 인코더 → 결합기 → 이웃 검색 순서다. 잠금이 판정 전체를 감싸면 스레드가 몇 개든 한 번에 하나만 돈다.",
        "Each thread judges one conversation and takes the next as soon as it finishes. A judgment runs tokenize → encoder → combiner → neighbor search. When the lock wraps the whole judgment, only one runs at a time however many threads there are."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "whole", label: K.t("판정 전체를 잠금", "Lock the whole judgment") },
      { value: "tok", label: K.t("토큰화만 잠금", "Lock tokenization only") }
    ], mode, function (v) { mode = v; build(); }, K.t("잠금 범위", "Lock scope"));
    var sl = K.slider({ label: K.t("동시 스레드", "Threads"), min: 1, max: 6, step: 1, value: n,
      onInput: function (v) { n = v; build(); } });
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(sg.el); bar.appendChild(sl.el); bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);

    var rows = K.el("div", "lk-rows");
    root.appendChild(rows);
    root.appendChild(legend(PH.map(function (p) { return [p.n, "background:" + p.c]; }).concat([
      [K.t("빗금 = 잠금을 기다림", "Hatched = waiting for the lock"), "background:repeating-linear-gradient(135deg,var(--tertiary) 0 3px,transparent 3px 6px)"],
      [K.t("잠금 줄의 숫자 = 쥔 스레드", "Number in the lock row = holder"), "background:var(--tca-warn)"]
    ])));
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "단계 길이는 예시 값이다(토큰화 1 · 인코더 4 · 결합기 1 · 이웃 검색 2단위). 코어는 충분하다고 두었다. 글의 실측은 판정 전체 잠금에서 동시 1·4·16일 때 초당 1.7·1.8·1.9건이었고, 기다리는 시간만 0.5초에서 5.8초로 늘었다.",
      "Phase lengths are example values (tokenize 1 · encoder 4 · combiner 1 · neighbor search 2 units), with enough cores assumed. Measured in the post with the whole-judgment lock: 1.7 · 1.8 · 1.9 per second at concurrency 1 · 4 · 16, while the wait grew from 0.5 s to 5.8 s.")));

    function add(segs, t, k) {
      var l = segs[segs.length - 1];
      if (l && l.k === k && l.e === t) l.e = t + 1;
      else segs.push({ s: t, e: t + 1, k: k });
    }
    // 단위 시간마다 돈다. 잠금은 먼저 기다린 스레드부터 받는다.
    function simulate(nT, md) {
      var th = [], q = [], lock = -1, lockSegs = [], ends = [];
      for (var i = 0; i < nT; i++) th.push({ ph: 0, rem: PH[0].d, has: false, inQ: false, waited: 0, segs: [] });
      function need(s) { return md === "whole" || s.ph === 0; }
      for (var t = 0; t < H; t++) {
        th.forEach(function (s, j) { if (need(s) && !s.has && !s.inQ) { q.push(j); s.inQ = true; } });
        if (lock < 0 && q.length) { lock = q.shift(); th[lock].has = true; th[lock].inQ = false; }
        var holder = lock;
        th.forEach(function (s) {
          if (need(s) && !s.has) { s.waited++; add(s.segs, t, "wait"); return; }
          add(s.segs, t, PH[s.ph].k);
          if (--s.rem > 0) return;
          if (md === "tok" ? s.ph === 0 : s.ph === PH.length - 1) { s.has = false; lock = -1; }
          s.ph++;
          if (s.ph === PH.length) { s.ph = 0; ends.push({ t: t + 1, w: s.waited }); s.waited = 0; }
          s.rem = PH[s.ph].d;
        });
        if (holder >= 0) add(lockSegs, t, holder);
      }
      return { th: th, lock: lockSegs, ends: ends };
    }

    function track(label, segs, isLock) {
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", label));
      var tr = K.el("div", "lk-t");
      var els = segs.map(function (sgm) {
        var d = K.el("div", "lk-s" + (sgm.k === "wait" ? " wait" : ""));
        if (isLock) {
          d.style.background = "var(--tca-warn)";
          d.style.borderRight = "1px solid var(--entry)";
          if (sgm.e - sgm.s >= 2) d.textContent = String(sgm.k + 1);
        } else if (sgm.k !== "wait") {
          d.style.background = COL[sgm.k];
          d.style.borderRight = "1px solid var(--entry)";
        }
        d.style.left = (sgm.s / H * 100) + "%";
        tr.appendChild(d);
        return { el: d, s: sgm.s, e: sgm.e };
      });
      var cur = K.el("div", "lk-cur");
      tr.appendChild(cur);
      curs.push(cur);
      r.appendChild(tr);
      rows.appendChild(r);
      rowEls.push(els);
    }

    function build() {
      sim = simulate(n, mode);
      base1 = simulate(1, mode).ends.length;
      rows.textContent = "";
      rowEls = []; curs = [];
      track(K.t("잠금", "Lock"), sim.lock, true);
      sim.th.forEach(function (s, i) { track(K.t("스레드 ", "Thread ") + (i + 1), s.segs, false); });
      f = K.reduce ? 1 : 0; hold = 0;
      render();
    }

    function render() {
      var now = f * H;
      rowEls.forEach(function (els) {
        els.forEach(function (x) {
          if (now <= x.s) { x.el.style.display = "none"; return; }
          x.el.style.display = "";
          x.el.style.width = ((Math.min(x.e, now) - x.s) / H * 100) + "%";
        });
      });
      curs.forEach(function (c) { c.style.left = (f * 100) + "%"; });
      var done = sim.ends.filter(function (e) { return e.t <= now; });
      var w = 0;
      done.forEach(function (e) { w += e.w; });
      var txt = K.t("경과 ", "Elapsed ") + Math.floor(now) + " / " + H + K.t("단위 · 완료 ", " units · done ") + done.length + K.t("건", "") +
        K.t(" · 1건당 평균 대기 ", " · avg wait per judgment ") + (done.length ? (w / done.length).toFixed(1) + K.t("단위", " units") : "—");
      if (f >= 1) txt += K.t(" · 스레드 1개일 때는 ", " · with one thread: ") + base1 + K.t("건", " done");
      if (txt !== lastRead) { read.textContent = txt; lastRead = txt; }
    }

    bAgain.addEventListener("click", function () { f = 0; hold = 0; render(); });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    build();
    K.loop(root, function (dt) {
      if (paused) return;
      if (f < 1) { f = Math.min(1, f + dt / RUN_MS); render(); }
      else { hold += dt; if (hold > HOLD_MS) { hold = 0; f = 0; render(); } }
    });
  });

  /* ── 2. 스레드마다 사본 대 상한만큼 풀 ── */
  K.register("lock-copies", function (root) {
    var BASE = 2.9, COPY = 0.56, MAXG = 40;
    var mode = "thread", nT = 17, cap = 4;

    K.head(root, K.t("사본을 스레드마다 둘 때와 상한만큼 둘 때", "A copy per thread versus a pool the size of the cap"),
      K.t("가중치는 공유하고 토크나이저 사본만 늘어난다. 스레드마다 사본을 두면 메모리가 스레드 수를 따라가고, 풀에 두면 동시 수 상한을 따라간다.",
        "Weights stay shared; only tokenizer copies multiply. A copy per thread follows the thread count, a pool follows the concurrency cap."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "thread", label: K.t("스레드마다 사본", "Copy per thread") },
      { value: "pool", label: K.t("상한만큼 풀", "Pool of cap size") }
    ], mode, function (v) { mode = v; render(); }, K.t("사본 두는 방식", "Where copies live"));
    var sT = K.slider({ label: K.t("작업 스레드", "Worker threads"), min: 1, max: 64, step: 1, value: nT,
      onInput: function (v) { nT = v; render(); } });
    var sC = K.slider({ label: K.t("동시 수 상한", "Concurrency cap"), min: 1, max: 8, step: 1, value: cap,
      onInput: function (v) { cap = v; render(); } });
    bar.appendChild(sg.el); bar.appendChild(sT.el); bar.appendChild(sC.el);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "92px");
    rows.style.setProperty("--tca-rw", "64px");
    function row(label, color) {
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", label));
      var tr = K.el("div", "tca-track"), fl = K.el("div", "tca-fill");
      fl.style.background = color;
      tr.appendChild(fl);
      var v = K.el("div", "tca-row-r");
      r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: fl, v: v };
    }
    var rShared = row(K.t("공유·잠금", "Shared + lock"), "var(--secondary)");
    var rNow = row(K.t("지금 설정", "This setting"), "var(--tca-warn)");
    root.appendChild(rows);
    var grid = K.el("div", "lk-grid");
    grid.setAttribute("aria-hidden", "true");
    root.appendChild(grid);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var first = K.el("div", "tca-note");
    root.appendChild(first);
    root.appendChild(K.el("div", "tca-note", K.t(
      "사본 한 벌 0.56GB 는 글의 실측(스레드 17개가 한 번씩 요청을 처리하자 2.9GB → 12.4GB)을 17로 나눈 값이다. 모든 스레드가 한 번씩 요청을 받았다고 두었다. 막대는 0~40GB 를 그린다.",
      "0.56 GB per copy is the post's measurement (17 threads each serving one request took the process from 2.9 GB to 12.4 GB) divided by 17. Every thread is assumed to have served a request. Bars span 0–40 GB.")));

    function w(g) { return Math.min(100, g / MAXG * 100) + "%"; }
    function render() {
      var copies = mode === "thread" ? nT : cap;
      var g = BASE + copies * COPY;
      rShared.f.style.width = w(BASE); rShared.v.textContent = BASE.toFixed(1) + "GB";
      rNow.f.style.width = w(g); rNow.v.textContent = g.toFixed(1) + "GB";
      if (grid.children.length !== copies) {
        grid.textContent = "";
        for (var i = 0; i < copies; i++) grid.appendChild(K.el("i"));
      }
      read.textContent = K.t("사본 ", "Copies ") + copies + K.t("벌 × 0.56GB + 기본 2.9GB = ", " × 0.56 GB + base 2.9 GB = ") + g.toFixed(1) + "GB" +
        (mode === "thread" ? K.t(" — 상한을 바꿔도 그대로다", " — the cap does not change it") : K.t(" — 스레드 수를 바꿔도 그대로다", " — the thread count does not change it"));
      first.textContent = mode === "thread"
        ? K.t("첫 요청: 사본은 각 스레드의 첫 요청 안에서 만든다. 혼자 만들면 0.9초, 스레드 16개가 동시에 만들면 각자 10초쯤 걸렸다(글의 실측).",
          "First request: each thread builds its copy inside its first request — 0.9 s alone, about 10 s each when 16 threads build at once (measured in the post).")
        : K.t("첫 요청: 서버가 뜰 때 사본을 만들어 풀에 넣어 두니 첫 요청이 느려지지 않는다. 판정이 시작될 때 하나 빌리고 끝나면 돌려준다.",
          "First request: copies are built when the server starts and kept in a pool, so the first request is not slowed. A judgment borrows one and returns it.");
    }
    render();
  });
})();
