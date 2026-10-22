/*
 * 「코어에 올라가는 건 스레드다」 글의 움직이는 그림 세 개.
 *   cores   : 스레드가 코어에 올라가는 모습 (C·Java 코드 / 파이썬 코드)
 *   servers : 같은 요청 여섯 건을 Tomcat 과 Uvicorn 이 처리하는 시간표
 *   procs   : 프로세스 1개와 4개에 같은 부하를 넣었을 때 GIL 앞의 줄
 * 색은 테마(PaperMod)의 CSS 변수를 따라가서 라이트·다크 모드가 같이 바뀐다.
 */
(function () {
  "use strict";

  var CSS = [
    ".tca{--tca-gil:#d62728;--tca-run:#2a9d5c;--tca-await:#4e79a7;--tca-wait:#b8860b;",
    "border:1px solid var(--tertiary);border-radius:8px;padding:14px;margin:24px 0;",
    "background:var(--entry);color:var(--primary);font-size:14px;line-height:1.5}",
    ":root[data-theme='dark'] .tca{--tca-gil:#ff6b6b;--tca-run:#5cc290;--tca-await:#7ea6d8;--tca-wait:#e0bd4a}",
    ".tca *{box-sizing:border-box}",
    ".tca-title{font-weight:600;font-size:15px;margin:0 0 2px}",
    ".tca-sub{color:var(--secondary);font-size:13px;margin:0 0 10px}",
    ".tca-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 12px}",
    ".tca-seg{display:inline-flex;border:1px solid var(--tertiary);border-radius:6px;overflow:hidden}",
    ".tca-btn{font:inherit;font-size:13px;line-height:1.4;padding:4px 10px;border:1px solid var(--tertiary);",
    "background:var(--theme);color:var(--primary);border-radius:6px;cursor:pointer}",
    ".tca-seg .tca-btn{border:0;border-radius:0}",
    ".tca-seg .tca-btn+.tca-btn{border-left:1px solid var(--tertiary)}",
    ".tca-btn[aria-pressed='true']{background:var(--primary);color:var(--theme)}",
    ".tca-btn:focus-visible{outline:2px solid var(--tca-await);outline-offset:2px}",
    ".tca-lbl{display:inline-flex;align-items:center;gap:6px;font-size:13px}",
    ".tca-lbl input{width:130px;accent-color:var(--tca-await)}",
    ".tca-num{font-variant-numeric:tabular-nums}",
    ".tca-read{font-variant-numeric:tabular-nums;margin:12px 0 0}",
    ".tca-note{color:var(--secondary);font-size:13px;margin:8px 0 0}",
    ".tca-chip{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;",
    "padding:0 7px;border-radius:13px;font-weight:600;font-size:12.5px;color:#111;flex:none}",
    ".tca-chip.dim{opacity:.35}",
    ".tca-chip.gil{box-shadow:0 0 0 3px var(--tca-gil)}",
    ".tca-chip.pop{animation:tca-pop .35s ease-out}",
    "@keyframes tca-pop{from{transform:scale(.55);opacity:.2}to{transform:scale(1);opacity:1}}",
    ".tca-cores{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}",
    "@media (max-width:540px){.tca-cores{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    ".tca-core{border:1px solid var(--tertiary);border-radius:6px;padding:8px;min-width:0}",
    ".tca-core-h{font-size:12.5px;color:var(--secondary)}",
    ".tca-slot{display:flex;align-items:center;gap:6px;height:34px;font-size:12px;color:var(--secondary)}",
    ".tca-hist{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:1px;height:10px;margin-top:4px}",
    ".tca-hist span{background:var(--code-bg);border-radius:1px}",
    ".tca-queue{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;min-height:30px;font-size:13px;color:var(--secondary)}",
    ".tca-gantt{position:relative;--lw:82px;--rw:58px;margin-top:4px}",
    ".tca-gh{font-weight:600;font-size:13.5px;margin:12px 0 4px}",
    ".tca-row{display:flex;align-items:center;height:22px}",
    ".tca-row-l{width:var(--lw);flex:none;font-size:12.5px;color:var(--secondary);white-space:nowrap}",
    ".tca-row-t{position:relative;flex:1;height:16px;background:var(--code-bg);border-radius:3px;overflow:hidden}",
    ".tca-row-r{width:var(--rw);flex:none;text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums}",
    ".tca-s{position:absolute;top:0;bottom:0;border-radius:2px}",
    ".tca-s.await{border:1.5px solid var(--tca-await);background:transparent}",
    ".tca-s.wait{background:repeating-linear-gradient(135deg,var(--tca-wait) 0 3px,transparent 3px 6px);opacity:.8}",
    ".tca-s span{position:absolute;left:3px;top:0;font-size:10.5px;line-height:16px;font-weight:600;color:#111}",
    ".tca-cur{position:absolute;top:0;bottom:16px;width:2px;background:var(--primary);opacity:.55;",
    "left:calc(var(--lw) + (100% - var(--lw) - var(--rw)) * var(--f,0))}",
    ".tca-axis{position:relative;height:16px;margin-left:var(--lw);margin-right:var(--rw);font-size:11px;color:var(--secondary)}",
    ".tca-axis span{position:absolute;transform:translateX(-50%);font-variant-numeric:tabular-nums}",
    ".tca-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--secondary);margin-top:8px}",
    ".tca-legend i{display:inline-block;width:18px;height:10px;margin-right:5px;vertical-align:-1px;border-radius:2px}",
    ".tca-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}",
    "@media (max-width:600px){.tca-two{grid-template-columns:minmax(0,1fr)}}",
    ".tca-side{border:1px solid var(--tertiary);border-radius:6px;padding:10px;min-width:0}",
    ".tca-proc{display:flex;align-items:center;gap:8px;min-height:28px;border-bottom:1px dashed var(--tertiary);padding:3px 0}",
    ".tca-proc-n{width:64px;flex:none;font-size:12.5px;color:var(--secondary)}",
    ".tca-lamp{width:14px;height:14px;border-radius:50%;flex:none;border:2px solid var(--tca-gil);opacity:.35}",
    ".tca-lamp.on{background:var(--tca-gil);opacity:1}",
    ".tca-dots{display:flex;flex-wrap:wrap;gap:3px;align-items:center;min-width:0;flex:1}",
    ".tca-dots b{width:7px;height:7px;border-radius:50%;background:var(--secondary);opacity:.75}",
    ".tca-dots em{font-style:normal;font-size:11.5px;color:var(--secondary);margin-left:3px;font-variant-numeric:tabular-nums}",
    ".tca-coresrow{display:flex;align-items:center;gap:4px;margin-top:8px;font-size:12.5px;color:var(--secondary)}",
    ".tca-coresrow b{width:16px;height:16px;border-radius:3px;background:var(--code-bg);border:1px solid var(--tertiary)}",
    ".tca-stat{font-size:12.5px;margin-top:8px;font-variant-numeric:tabular-nums;line-height:1.6}",
    "@media (prefers-reduced-motion:reduce){.tca-chip.pop{animation:none}}"
  ].join("");

  var COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#59a14f", "#b07aa1", "#76b7b2", "#edc948", "#9c755f"];
  var reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function injectCSS() {
    if (document.getElementById("tca-css")) return;
    var s = document.createElement("style");
    s.id = "tca-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // 작은 DOM 도우미
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, pressed) {
    var b = el("button", "tca-btn", label);
    b.type = "button";
    if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
    return b;
  }
  function press(b, on) { b.setAttribute("aria-pressed", on ? "true" : "false"); }
  function chip(i, extra) {
    var c = el("span", "tca-chip" + (extra ? " " + extra : ""), String(i + 1));
    c.style.background = COLORS[i % COLORS.length];
    return c;
  }

  // 화면에 보일 때만 돌린다(안 보이는 그림이 CPU 를 쓰지 않게)
  function whenVisible(root, onChange) {
    if (typeof IntersectionObserver !== "function") { onChange(true); return; }
    new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { onChange(e.isIntersecting); });
    }, { threshold: 0.1 }).observe(root);
  }

  // requestAnimationFrame 루프. step(dtMs) 를 부른다.
  function loop(step) {
    var visible = false, last = 0, running = false;
    function frame(now) {
      if (!visible) { running = false; return; }
      var dt = last ? Math.min(100, now - last) : 0;
      last = now;
      step(dt);
      requestAnimationFrame(frame);
    }
    return function setVisible(v) {
      visible = v;
      if (v && !running) { running = true; last = 0; requestAnimationFrame(frame); }
    };
  }

  /* ───────────── 1. 스레드와 코어 ───────────── */

  function initCores(root) {
    var NC = 4, HIST = 24, SLICE = 900, SUB = 3;
    var nT = 6, mode = "native", paused = reduce, t = 0, sub = 0, tick = 0;
    var coreOf = [-1, -1, -1, -1], gil = -1, lastRun = [], moved = {};
    var hist = [[], [], [], []];

    root.textContent = "";
    root.appendChild(el("div", "tca-title", "스레드는 코어에 올라가서 돈다"));
    root.appendChild(el("div", "tca-sub",
      "코어 4개에 스레드 여러 개. 운영체제가 짧은 간격으로 스레드를 코어에 다시 배정한다. " +
      "칸 아래 막대는 그 코어에서 최근에 실제로 계산한 스레드 기록이다."));
    var bar = el("div", "tca-bar");
    var seg = el("span", "tca-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "실행하는 코드");
    var bNative = btn("C·Java 코드", true), bGil = btn("파이썬 코드 (GIL)", false);
    seg.appendChild(bNative); seg.appendChild(bGil);
    var cnt = el("span", "tca-lbl");
    var bMinus = btn("−"), bPlus = btn("+"), nOut = el("span", "tca-num", "");
    bMinus.setAttribute("aria-label", "스레드 하나 줄이기");
    bPlus.setAttribute("aria-label", "스레드 하나 늘리기");
    cnt.appendChild(el("span", null, "스레드"));
    cnt.appendChild(bMinus); cnt.appendChild(nOut); cnt.appendChild(bPlus);
    var bPause = btn(paused ? "재생" : "일시정지", paused);
    bar.appendChild(seg); bar.appendChild(cnt); bar.appendChild(bPause);
    root.appendChild(bar);

    var grid = el("div", "tca-cores");
    var slots = [], hists = [];
    for (var c = 0; c < NC; c++) {
      var box = el("div", "tca-core");
      box.appendChild(el("div", "tca-core-h", "코어 " + c));
      var slot = el("div", "tca-slot");
      var hs = el("div", "tca-hist");
      hs.setAttribute("aria-hidden", "true");
      var cells = [];
      for (var k = 0; k < HIST; k++) { var sp = el("span"); hs.appendChild(sp); cells.push(sp); }
      box.appendChild(slot); box.appendChild(hs);
      grid.appendChild(box);
      slots.push(slot); hists.push(cells);
    }
    root.appendChild(grid);
    var queue = el("div", "tca-queue");
    root.appendChild(queue);
    var read = el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var note = el("div", "tca-note");
    root.appendChild(note);

    function schedule() {
      tick++;
      var ids = [];
      for (var i = 0; i < nT; i++) ids.push(i);
      ids.sort(function (a, b) {
        var la = lastRun[a] == null ? -1 : lastRun[a], lb = lastRun[b] == null ? -1 : lastRun[b];
        return la - lb || Math.random() - 0.5;
      });
      var run = ids.slice(0, Math.min(NC, nT));
      var next = [-1, -1, -1, -1], rest = [];
      run.forEach(function (th) {
        var pc = coreOf.indexOf(th);
        if (pc >= 0 && Math.random() < 0.4 && next[pc] === -1) next[pc] = th; else rest.push(th);
      });
      var free = [];
      for (var c2 = 0; c2 < NC; c2++) if (next[c2] === -1) free.push(c2);
      free.sort(function () { return Math.random() - 0.5; });
      rest.forEach(function (th, j) { next[free[j]] = th; });
      moved = {};
      next.forEach(function (th, c3) { if (th >= 0 && coreOf[c3] !== th) moved[th] = true; });
      run.forEach(function (th) { lastRun[th] = tick; });
      coreOf = next;
    }
    function passGil() {
      var on = coreOf.filter(function (x) { return x >= 0; });
      if (!on.length) { gil = -1; return; }
      var idx = on.indexOf(gil);
      gil = on[(idx + 1) % on.length];
    }
    function record() {
      for (var c4 = 0; c4 < NC; c4++) {
        var th = coreOf[c4];
        hist[c4].push({ t: th, ran: th >= 0 && (mode === "native" || th === gil) });
        if (hist[c4].length > HIST) hist[c4].shift();
      }
    }
    function render() {
      nOut.textContent = String(nT);
      for (var c5 = 0; c5 < NC; c5++) {
        var th = coreOf[c5], s = slots[c5];
        s.textContent = "";
        if (th < 0) { s.appendChild(el("span", null, "비어 있음")); }
        else {
          var running = mode === "native" || th === gil;
          var cls = (running ? "" : "dim") + (mode === "gil" && th === gil ? " gil" : "") + (moved[th] ? " pop" : "");
          s.appendChild(chip(th, cls.trim()));
          s.appendChild(el("span", null, running ? (mode === "gil" ? "GIL 쥐고 실행" : "실행 중") : "GIL 기다림"));
        }
        var hcells = hists[c5], h = hist[c5], off = HIST - h.length;
        for (var k2 = 0; k2 < HIST; k2++) {
          var rec = h[k2 - off], cell = hcells[k2];
          if (!rec || rec.t < 0) { cell.style.background = ""; cell.style.opacity = ""; }
          else { cell.style.background = COLORS[rec.t % COLORS.length]; cell.style.opacity = rec.ran ? "1" : "0.22"; }
        }
      }
      queue.textContent = "";
      queue.appendChild(el("span", null, "코어 차례를 기다리는 스레드:"));
      var waiting = 0;
      for (var i2 = 0; i2 < nT; i2++) if (coreOf.indexOf(i2) < 0) { queue.appendChild(chip(i2, "dim")); waiting++; }
      if (!waiting) queue.appendChild(el("span", null, "없음"));
      var active = mode === "native" ? coreOf.filter(function (x) { return x >= 0; }).length : (gil >= 0 ? 1 : 0);
      read.textContent = "지금 실제로 계산 중인 스레드 " + active + "개 · top 의 CPU 사용률로 약 " + (active * 100) + "%";
      note.textContent = mode === "native"
        ? "C 코드나 Java 스레드는 코어에 올라간 스레드가 모두 같은 순간에 계산한다. 같은 번호가 시간에 따라 다른 코어에 나타나는 것이 운영체제가 자리를 바꾸는 모습이다."
        : "파이썬 코드는 코어에 올라가 있어도 GIL(빨간 테두리)을 쥔 스레드 하나만 실행된다. 나머지는 코어 위에서 GIL을 기다린다. 기록 막대에서 진한 칸이 한 번에 하나뿐이다.";
    }
    function step(dt) {
      if (paused) return;
      t += dt;
      while (t >= SLICE / SUB) {
        t -= SLICE / SUB;
        if (sub === 0) { schedule(); passGil(); } else { passGil(); moved = {}; }
        sub = (sub + 1) % SUB;
        record();
        render();
      }
    }
    function setMode(m) { mode = m; press(bNative, m === "native"); press(bGil, m === "gil"); render(); }
    bNative.addEventListener("click", function () { setMode("native"); });
    bGil.addEventListener("click", function () { setMode("gil"); });
    bMinus.addEventListener("click", function () { if (nT > 2) { nT--; coreOf = coreOf.map(function (x) { return x >= nT ? -1 : x; }); passGil(); render(); } });
    bPlus.addEventListener("click", function () { if (nT < 8) { nT++; render(); } });
    bPause.addEventListener("click", function () { paused = !paused; bPause.textContent = paused ? "재생" : "일시정지"; press(bPause, paused); });

    schedule(); passGil();
    for (var w = 0; w < 6; w++) { if (w % SUB === 0 && w) schedule(); passGil(); record(); }
    render();
    whenVisible(root, loop(step));
  }

  /* ───────────── 2. Tomcat 과 Uvicorn 시간표 ───────────── */

  var UNIT_MS = 10;
  var REQS = [
    { id: "A", at: 0 }, { id: "B", at: 1 }, { id: "C", at: 2 },
    { id: "D", at: 4 }, { id: "E", at: 5 }, { id: "F", at: 7 }
  ];

  // 요청 하나 = 계산 c1 → DB 대기 w → 계산 c2 (단위 10ms). heavy 면 C 의 c1 이 9.
  function plan(heavy) {
    return REQS.map(function (r, i) {
      return { id: r.id, i: i, at: r.at, c1: heavy && r.id === "C" ? 9 : 1, w: 5, c2: 1 };
    });
  }

  // Tomcat: 요청마다 스레드 하나. 코어는 충분하다고 둔다(이 예에서 동시 계산은 최대 2건).
  function scheduleTomcat(reqs) {
    return reqs.map(function (r) {
      var a = r.at, b = a + r.c1, c = b + r.w, d = c + r.c2;
      return { id: r.id, at: r.at, end: d, segs: [
        { s: a, e: b, k: "run" }, { s: b, e: c, k: "await" }, { s: c, e: d, k: "run" }] };
    });
  }

  // Uvicorn: 이벤트 루프 하나. 준비된 계산을 먼저 준비된 순서대로 하나씩 돌린다.
  function scheduleUvicorn(reqs) {
    var out = reqs.map(function (r) { return { id: r.id, at: r.at, end: 0, segs: [] }; });
    var ready = reqs.map(function (r) { return { i: r.i, part: 1, ready: r.at, dur: r.c1 }; });
    var loopSegs = [], t = 0;
    while (ready.length) {
      ready.sort(function (x, y) { return x.ready - y.ready || x.i - y.i; });
      var job = ready[0];
      if (job.ready > t) t = job.ready;
      ready.shift();
      var o = out[job.i], r = reqs[job.i];
      if (t > job.ready) o.segs.push({ s: job.ready, e: t, k: "wait" });
      o.segs.push({ s: t, e: t + job.dur, k: "run" });
      loopSegs.push({ s: t, e: t + job.dur, i: job.i });
      t += job.dur;
      if (job.part === 1) {
        o.segs.push({ s: t, e: t + r.w, k: "await" });
        ready.push({ i: job.i, part: 2, ready: t + r.w, dur: r.c2 });
      } else {
        o.end = t;
      }
    }
    return { rows: out, loop: loopSegs };
  }

  function initServers(root) {
    var heavy = false, paused = reduce, f = 0, hold = 0;
    var UNIT_REAL = 170, HOLD = 2600;
    var tom, uvi, tmax;

    root.textContent = "";
    root.appendChild(el("div", "tca-title", "같은 요청 여섯 건을 두 서버가 처리하는 시간표"));
    root.appendChild(el("div", "tca-sub",
      "요청 하나는 계산 10ms → DB 응답 대기 50ms → 계산 10ms다. 세로선이 지나가며 시간이 흐른다."));
    var bar = el("div", "tca-bar");
    var bHeavy = btn("무거운 계산 섞기", false), bAgain = btn("처음부터"), bPause = btn(paused ? "재생" : "일시정지", paused);
    bar.appendChild(bHeavy); bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);
    var host = el("div");
    root.appendChild(host);
    var legend = el("div", "tca-legend");
    [["진한 칸 = 계산(색은 요청별)", "background:#4e79a7"],
     ["테두리 칸 = DB 응답 대기", "border:1.5px solid var(--tca-await)"],
     ["빗금 칸 = 루프가 다른 일을 해서 차례 대기", "background:repeating-linear-gradient(135deg,var(--tca-wait) 0 3px,transparent 3px 6px)"]]
      .forEach(function (x) { var s = el("span"); var i = el("i"); i.setAttribute("style", x[1]); s.appendChild(i); s.appendChild(document.createTextNode(x[0])); legend.appendChild(s); });
    root.appendChild(legend);
    var read = el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var note = el("div", "tca-note");
    root.appendChild(note);

    var panels = [];
    function buildPanel(title, rows, labels, loopRow) {
      host.appendChild(el("div", "tca-gh", title));
      var g = el("div", "tca-gantt");
      var parts = [];
      function addRow(label, segs, isLoop) {
        var row = el("div", "tca-row");
        row.appendChild(el("div", "tca-row-l", label));
        var track = el("div", "tca-row-t");
        var segEls = segs.map(function (sg) {
          var d = el("div", "tca-s " + (isLoop ? "run" : sg.k));
          var col = COLORS[(isLoop ? sg.i : sg.ri) % COLORS.length];
          if (isLoop || sg.k === "run") d.style.background = col;
          d.style.left = (sg.s / tmax * 100) + "%";
          if (isLoop && sg.e - sg.s >= 1) d.appendChild(el("span", null, REQS[sg.i].id));
          track.appendChild(d);
          return { el: d, s: sg.s, e: sg.e };
        });
        row.appendChild(track);
        var resp = el("div", "tca-row-r", "");
        row.appendChild(resp);
        g.appendChild(row);
        return { segs: segEls, resp: resp };
      }
      if (loopRow) parts.push({ row: addRow("루프", loopRow, true), end: null });
      rows.forEach(function (r, i) {
        r.segs.forEach(function (sg) { sg.ri = i; });
        parts.push({ row: addRow(labels[i], r.segs, false), end: r.end, at: r.at });
      });
      var axis = el("div", "tca-axis");
      for (var u = 0; u <= tmax; u += 5) {
        var lab = el("span", null, (u * UNIT_MS) + (u + 5 > tmax ? "ms" : ""));
        lab.style.left = (u / tmax * 100) + "%";
        axis.appendChild(lab);
      }
      g.appendChild(axis);
      var cur = el("div", "tca-cur");
      g.appendChild(cur);
      host.appendChild(g);
      return { parts: parts, cur: cur, g: g };
    }

    function build() {
      var reqs = plan(heavy);
      tom = scheduleTomcat(reqs);
      uvi = scheduleUvicorn(reqs);
      tmax = Math.max.apply(null, tom.map(function (r) { return r.end; }).concat(uvi.rows.map(function (r) { return r.end; }))) + 1;
      host.textContent = "";
      panels = [
        buildPanel("Tomcat — 요청마다 스레드 하나", tom, REQS.map(function (r, i) { return r.id + " · 스레드" + (i + 1); }), null),
        buildPanel("Uvicorn — 이벤트 루프 스레드 하나", uvi.rows, REQS.map(function (r) { return r.id; }), uvi.loop)
      ];
      f = 0; hold = 0;
      note.textContent = heavy
        ? "C가 90ms 동안 계산한다. Tomcat은 다른 스레드가 다른 코어에서 계속 처리해 나머지 요청이 그대로다. Uvicorn은 루프 하나가 C에 묶여 그동안 준비된 계산이 모두 차례를 기다린다."
        : "DB 응답을 기다리는 동안 Uvicorn 루프는 다른 요청을 처리한다. 기다림이 대부분인 요청이면 스레드 하나로도 응답 시간이 Tomcat과 거의 같다.";
      render();
    }
    function avg(rows) {
      var s = 0;
      rows.forEach(function (r) { s += (r.end - r.at) * UNIT_MS; });
      return Math.round(s / rows.length);
    }
    function render() {
      var now = f * tmax;
      panels.forEach(function (p) {
        p.g.style.setProperty("--f", String(f));
        p.parts.forEach(function (pt) {
          pt.row.segs.forEach(function (sg) {
            var w = Math.max(0, Math.min(sg.e, now) - sg.s);
            sg.el.style.width = (w / tmax * 100) + "%";
            sg.el.style.display = w > 0 ? "" : "none";
          });
          if (pt.end != null) pt.row.resp.textContent = now >= pt.end ? ((pt.end - pt.at) * UNIT_MS) + "ms" : "";
        });
      });
      var done = now >= tmax - 1;
      read.textContent = done
        ? "평균 응답 시간: Tomcat " + avg(tom) + "ms · Uvicorn " + avg(uvi.rows) + "ms (오른쪽 숫자는 요청별 응답 시간)"
        : "진행 중… " + Math.round(now * UNIT_MS) + "ms";
    }
    function step(dt) {
      if (paused) return;
      if (f >= 1) { hold += dt; if (hold >= HOLD) { f = 0; hold = 0; } }
      else f = Math.min(1, f + dt / (UNIT_REAL * tmax));
      render();
    }
    bHeavy.addEventListener("click", function () { heavy = !heavy; press(bHeavy, heavy); build(); });
    bAgain.addEventListener("click", function () { f = 0; hold = 0; render(); });
    bPause.addEventListener("click", function () { paused = !paused; bPause.textContent = paused ? "재생" : "일시정지"; press(bPause, paused); });

    build();
    if (reduce) { f = 1; render(); }
    whenVisible(root, loop(step));
  }

  /* ───────────── 3. 프로세스 1개 대 4개 ───────────── */

  var P_PRE = 6, P_POST = 2, COMP = 40, NCORE = 8, THREADS = 64;

  function Heap() { this.a = []; }
  Heap.prototype.push = function (x) {
    var a = this.a; a.push(x);
    var i = a.length - 1;
    while (i > 0) { var p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; var tmp = a[p]; a[p] = a[i]; a[i] = tmp; i = p; }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < a.length && a[l].t < a[m].t) m = l;
        if (r < a.length && a[r].t < a[m].t) m = r;
        if (m === i) break;
        var tmp = a[m]; a[m] = a[i]; a[i] = tmp; i = m;
      }
    }
    return top;
  };
  Heap.prototype.peek = function () { return this.a[0]; };

  // 같은 도착을 받는 서버 한 대(프로세스 nProc 개, 코어 NCORE 개 공유).
  // 스레드는 합쳐서 THREADS 개라 프로세스마다 THREADS / nProc 개씩 둔다.
  function makeMachine(nProc) {
    var m = { procs: [], pool: THREADS / nProc, coreFree: NCORE, coreQ: [], computing: [], done: [], ev: new Heap() };
    for (var i = 0; i < nProc; i++) m.procs.push({ i: i, q: [], tq: [], holder: null, inflight: 0 });
    return m;
  }
  function admit(m, p, r, t) {
    p.inflight++;
    r.phase = "pre";
    p.q.push(r);
    tryGil(m, p, t);
  }
  function tryGil(m, p, t) {
    if (p.holder || !p.q.length) return;
    var r = p.q.shift();
    p.holder = r;
    m.ev.push({ t: t + (r.phase === "pre" ? P_PRE : P_POST), k: "gil", p: p, r: r });
  }
  function tryCore(m, t) {
    while (m.coreFree > 0 && m.coreQ.length) {
      var r = m.coreQ.shift();
      m.coreFree--;
      m.computing.push(r);
      m.ev.push({ t: t + COMP * (0.8 + 0.4 * r.u), k: "comp", r: r });
    }
  }
  function arrive(m, t, u) {
    var best = m.procs[0];
    m.procs.forEach(function (p) { if (p.inflight + p.tq.length < best.inflight + best.tq.length) best = p; });
    var r = { born: t, p: best, phase: "wait", u: u };
    if (best.inflight < m.pool) admit(m, best, r, t); else best.tq.push(r);
  }
  function runUntil(m, t) {
    while (m.ev.a.length && m.ev.peek().t <= t) {
      var e = m.ev.pop();
      if (e.k === "gil") {
        e.p.holder = null;
        if (e.r.phase === "pre") { e.r.phase = "comp"; m.coreQ.push(e.r); tryCore(m, e.t); }
        else {
          m.done.push({ t: e.t, lat: e.t - e.r.born });
          e.p.inflight--;
          if (e.p.tq.length) admit(m, e.p, e.p.tq.shift(), e.t);
        }
        tryGil(m, e.p, e.t);
      } else {
        m.coreFree++;
        m.computing.splice(m.computing.indexOf(e.r), 1);
        e.r.phase = "post";
        e.r.p.q.push(e.r);
        tryGil(m, e.r.p, e.t);
        tryCore(m, e.t);
      }
    }
    if (m.done.length > 6000) m.done = m.done.slice(-3000);
  }
  function stats(m, now, win) {
    var n = 0, s = 0;
    for (var i = m.done.length - 1; i >= 0 && m.done[i].t > now - win; i--) { n++; s += m.done[i].lat; }
    var waitGil = 0, waitThread = 0;
    m.procs.forEach(function (p) { waitGil += p.q.length; waitThread += p.tq.length; });
    var span = Math.max(1, Math.min(win, now));
    return { rate: n / (span / 1000), lat: n ? s / n : 0, waitGil: waitGil, waitThread: waitThread,
      waitCore: m.coreQ.length, busy: NCORE - m.coreFree };
  }

  function initProcs(root) {
    var SPEED = 0.25, WIN = 2000;
    var rate = 150, paused = reduce, simT = 0, nextArr = 0, sinceDraw = 0;
    var A, B;

    root.textContent = "";
    root.appendChild(el("div", "tca-title", "프로세스 1개와 4개에 같은 요청을 넣으면"));
    root.appendChild(el("div", "tca-sub",
      "요청 하나 = 파이썬 처리 8ms(GIL 필요) + 모델 계산 40ms(GIL을 놓고 코어 하나 사용). 두 서버 모두 코어 8개, 스레드 합계 64개이고, 같은 순간에 같은 요청이 들어온다. 화면은 실제보다 4배 느리다."));
    var bar = el("div", "tca-bar");
    var lab = el("label", "tca-lbl");
    var range = document.createElement("input");
    range.type = "range"; range.min = "20"; range.max = "300"; range.step = "10"; range.value = String(rate);
    var rOut = el("span", "tca-num", rate + "건/초");
    lab.appendChild(document.createTextNode("들어오는 요청"));
    lab.appendChild(range); lab.appendChild(rOut);
    var bReset = btn("비우기"), bPause = btn(paused ? "재생" : "일시정지", paused);
    bar.appendChild(lab); bar.appendChild(bReset); bar.appendChild(bPause);
    root.appendChild(bar);

    var two = el("div", "tca-two");
    function side(title, nProc) {
      var box = el("div", "tca-side");
      box.appendChild(el("div", "tca-gh", title));
      var procs = [];
      for (var i = 0; i < nProc; i++) {
        var row = el("div", "tca-proc");
        row.appendChild(el("span", "tca-proc-n", "프로세스 " + (i + 1)));
        var lamp = el("span", "tca-lamp");
        lamp.title = "GIL";
        var dots = el("span", "tca-dots");
        row.appendChild(lamp); row.appendChild(dots);
        box.appendChild(row);
        procs.push({ lamp: lamp, dots: dots, n: -1 });
      }
      var cr = el("div", "tca-coresrow");
      cr.appendChild(el("span", null, "코어"));
      var cores = [];
      for (var c = 0; c < NCORE; c++) { var b = el("b"); cr.appendChild(b); cores.push(b); }
      box.appendChild(cr);
      var st = el("div", "tca-stat");
      box.appendChild(st);
      two.appendChild(box);
      return { procs: procs, cores: cores, st: st };
    }
    var vA = side("프로세스 1개 · GIL 1개", 1);
    var vB = side("프로세스 4개 · GIL 4개", 4);
    root.appendChild(two);
    var legend = el("div", "tca-legend");
    legend.appendChild(el("span", null, "빨간 원 = GIL을 쥔 순간 · 회색 점 = 그 프로세스에서 기다리는 요청 · 칸 = 모델 계산 중인 코어(색은 프로세스별)"));
    root.appendChild(legend);
    root.appendChild(el("div", "tca-note",
      "천장 계산: GIL은 프로세스마다 하나라 프로세스 하나는 초당 1000 ÷ 8 = 125건이 끝이다. 코어 8개는 초당 8 × 1000 ÷ 40 = 200건까지 계산한다. " +
      "그래서 초당 150건이면 왼쪽만 줄이 길어지고, 200건을 넘기면 오른쪽도 이번엔 코어 앞에서 줄이 선다."));

    function reset() { A = makeMachine(1); B = makeMachine(4); simT = 0; nextArr = 0; draw(); }
    function drawSide(v, m) {
      m.procs.forEach(function (p, i) {
        var pv = v.procs[i];
        pv.lamp.className = "tca-lamp" + (p.holder ? " on" : "");
        var n = p.q.length + p.tq.length;
        if (n !== pv.n) {
          pv.n = n;
          pv.dots.textContent = "";
          var show = Math.min(n, 28);
          for (var k = 0; k < show; k++) pv.dots.appendChild(el("b"));
          if (n > show) pv.dots.appendChild(el("em", null, "+" + (n - show)));
          if (!n) pv.dots.appendChild(el("em", null, "대기 없음"));
        }
      });
      for (var c = 0; c < NCORE; c++) {
        var r = m.computing[c];
        v.cores[c].style.background = r ? COLORS[r.p.i % COLORS.length] : "";
      }
      var s = stats(m, simT, WIN);
      var where = s.waitCore > 12 ? "코어 앞" : s.waitGil + s.waitThread > 12 ? "GIL 앞" : "없음";
      v.st.textContent = "처리 " + Math.round(s.rate) + "건/초 · 평균 응답 " + (s.lat ? Math.round(s.lat) + "ms" : "–") +
        " · 코어 " + s.busy + "/" + NCORE + " · 줄이 서는 곳: " + where;
    }
    function draw() { drawSide(vA, A); drawSide(vB, B); }
    function step(dt) {
      if (paused) return;
      var target = simT + dt * SPEED;
      while (nextArr <= target) {
        runUntil(A, nextArr); runUntil(B, nextArr);
        var u = Math.random();
        arrive(A, nextArr, u); arrive(B, nextArr, u);
        nextArr += -Math.log(1 - Math.random()) * 1000 / rate;
      }
      runUntil(A, target); runUntil(B, target);
      simT = target;
      sinceDraw += dt;
      if (sinceDraw > 60) { sinceDraw = 0; draw(); }
    }
    range.addEventListener("input", function () { rate = +range.value; rOut.textContent = rate + "건/초"; });
    bReset.addEventListener("click", reset);
    bPause.addEventListener("click", function () { paused = !paused; bPause.textContent = paused ? "재생" : "일시정지"; press(bPause, paused); });

    reset();
    whenVisible(root, loop(step));
  }

  /* ───────────── 시작 ───────────── */

  var INIT = { cores: initCores, servers: initServers, procs: initProcs };
  function start() {
    var roots = document.querySelectorAll(".tca[data-tca]");
    if (!roots.length) return;
    injectCSS();
    Array.prototype.forEach.call(roots, function (r) {
      var fn = INIT[r.getAttribute("data-tca")];
      if (fn && !r.getAttribute("data-tca-on")) { r.setAttribute("data-tca-on", "1"); fn(r); }
    });
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }

  // 계산 부분 시험용(브라우저 동작에는 영향 없음)
  if (typeof globalThis !== "undefined") {
    globalThis.__tcaTest = { plan: plan, scheduleTomcat: scheduleTomcat, scheduleUvicorn: scheduleUvicorn,
      makeMachine: makeMachine, arrive: arrive, runUntil: runUntil, stats: stats };
  }
})();
