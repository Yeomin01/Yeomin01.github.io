/* 「모델은 한 번만 올리고 나눠 쓴다 — vLLM 공유 서버」 글의 그림 두 개
 *   vllm-batching : 고정 배치와 연속 배치가 같은 요청을 처리하는 모습
 *   vllm-kv       : KV 캐시 약 3만 7천 토큰에 동시에 들어가는 요청 수
 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("load-the-model-once-share-it-with-vllm-css", [
    '.tca[data-demo="vllm-batching"] .vb-free{background:repeating-linear-gradient(135deg,var(--tertiary) 0 3px,transparent 3px 7px);opacity:.7}',
    '.tca[data-demo="vllm-kv"] .vk-track{display:flex;gap:1px;height:26px;background:var(--code-bg);border-radius:4px;overflow:hidden}',
    '.tca[data-demo="vllm-kv"] .vk-blk{position:relative;height:100%;background:repeating-linear-gradient(135deg,var(--tca-warn) 0 3px,transparent 3px 7px);flex:none}',
    '.tca[data-demo="vllm-kv"] .vk-use{position:absolute;left:0;top:0;bottom:0;background:var(--tca-accent)}',
    '.tca[data-demo="vllm-kv"] .vk-q{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}',
    '.tca[data-demo="vllm-kv"] .vk-q .tca-chip{min-width:28px}',
    '.tca[data-demo="vllm-kv"] .vk-q .off{background:var(--code-bg);color:var(--secondary);border:1px dashed var(--tertiary)}'
  ].join(""));

  // 시드 고정 난수
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  K.register("vllm-batching", function (root) {
    var SLOTS = 6, N = 36, SPEED = 80; // 초당 진행 단위
    var spread = "wide", playing = !K.reduce, lanes, clock;

    K.head(root, K.t("고정 배치와 연속 배치", "Fixed batching vs continuous batching"),
      K.t("같은 요청 36건을 동시에 6건씩 처리한다. 고정 배치는 묶음 안에서 가장 긴 생성이 끝나야 다음 묶음을 넣고, 연속 배치는 끝난 칸에 바로 다음 요청을 넣는다.",
        "The same 36 requests, six at a time. Fixed batching waits for the longest generation in the batch; continuous batching refills a slot the moment it frees up."));

    var bar = K.el("div", "tca-bar");
    var bPlay = K.btn(playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    var sSpread = K.seg([
      { value: "even", label: K.t("길이 고름", "Even lengths") },
      { value: "wide", label: K.t("길이 들쭉날쭉", "Uneven lengths") }
    ], spread, function (v) { spread = v; reset(); }, K.t("생성 길이", "Generation length"));
    bar.appendChild(bPlay); bar.appendChild(bReset); bar.appendChild(sSpread.el);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    root.appendChild(two);
    function makeLane(kind, title) {
      var box = K.el("div", "tca-box");
      box.appendChild(K.el("div", "tca-h", title));
      var rows = K.el("div", "tca-rows");
      rows.style.setProperty("--tca-lw", "34px");
      rows.style.setProperty("--tca-rw", "44px");
      var slots = [];
      for (var i = 0; i < SLOTS; i++) {
        var r = K.el("div", "tca-row");
        var l = K.el("div", "tca-row-l", K.t("칸 ", "S") + (i + 1));
        var tr = K.el("div", "tca-track");
        var f = K.el("div", "tca-fill");
        f.style.transition = "none";
        tr.appendChild(f);
        var v = K.el("div", "tca-row-r", "");
        r.appendChild(l); r.appendChild(tr); r.appendChild(v);
        rows.appendChild(r);
        slots.push({ tr: tr, f: f, v: v });
      }
      box.appendChild(rows);
      var st = K.el("div", "tca-read");
      st.style.fontSize = "13px";
      box.appendChild(st);
      two.appendChild(box);
      return { kind: kind, ui: slots, st: st };
    }
    var uiFixed = makeLane("fixed", K.t("고정 배치 (6건씩 묶음)", "Fixed batch (groups of 6)"));
    var uiCont = makeLane("cont", K.t("연속 배치 (vLLM)", "Continuous batching (vLLM)"));
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var lg = K.el("div", "tca-legend");
    root.appendChild(lg);
    var i1 = K.el("span"); var sw1 = K.el("i"); sw1.style.background = "var(--tca-accent)"; i1.appendChild(sw1); i1.appendChild(document.createTextNode(K.t("생성 진행", "generating"))); lg.appendChild(i1);
    var i2 = K.el("span"); var sw2 = K.el("i", "vb-free"); i2.appendChild(sw2); i2.appendChild(document.createTextNode(K.t("노는 칸", "idle slot"))); lg.appendChild(i2);
    root.appendChild(K.el("div", "tca-note", K.t(
      "요청마다 생성 길이는 시드를 고정한 예시 값이다. 두 쪽은 같은 길이 목록을 같은 순서로 받는다. 시간은 그림 속 시간이고 실제 소요 시간이 아니다.",
      "Generation lengths are seeded example values; both sides get the same list in the same order. Times are figure time, not measured time.")));

    function lengths() {
      var r = rng(spread === "wide" ? 7 : 11), out = [];
      for (var i = 0; i < N; i++) out.push(spread === "wide" ? Math.round(20 + r() * 180) : Math.round(95 + r() * 30));
      return out;
    }
    function reset() {
      var L = lengths();
      clock = 0;
      lanes = [uiFixed, uiCont].map(function (ui) {
        return { ui: ui, kind: ui.kind, q: L.map(function (n, i) { return { id: i, n: n, rem: n }; }), slots: [null, null, null, null, null, null], done: 0, idle: 0, busy: 0, end: null };
      });
      draw();
    }
    function tick(lane) {
      if (lane.end != null) return;
      var allEmpty = lane.slots.every(function (s) { return !s; }), i;
      for (i = 0; i < SLOTS; i++) {
        if (!lane.slots[i] && lane.q.length && (lane.kind === "cont" || allEmpty)) lane.slots[i] = lane.q.shift();
      }
      for (i = 0; i < SLOTS; i++) {
        var s = lane.slots[i];
        if (!s) { lane.idle++; continue; }
        lane.busy++;
        s.rem -= 1;
        if (s.rem <= 0) { lane.done++; lane.slots[i] = null; }
      }
      if (lane.done >= N) lane.end = clock;
    }
    var acc = 0;
    function step(dt) {
      if (!playing) return;
      acc += dt / 1000 * SPEED;
      var moved = false;
      while (acc >= 1) {
        acc -= 1;
        if (lanes[0].end != null && lanes[1].end != null) { acc = 0; break; }
        clock++;
        lanes.forEach(tick);
        moved = true;
      }
      if (moved) draw();
    }
    function secs(u) { return (u / SPEED).toFixed(1); }
    function draw() {
      lanes.forEach(function (lane) {
        for (var i = 0; i < SLOTS; i++) {
          var s = lane.slots[i], u = lane.ui.ui[i];
          if (s) {
            u.tr.className = "tca-track";
            u.f.style.width = ((s.n - s.rem) / s.n * 100) + "%";
            u.f.style.background = K.COLORS[s.id % 8];
            u.v.textContent = "#" + (s.id + 1);
          } else {
            u.f.style.width = "0%";
            u.tr.className = "tca-track" + (lane.end == null && clock > 0 ? " vb-free" : "");
            u.v.textContent = lane.end != null ? K.t("끝", "done") : (clock > 0 ? K.t("논다", "idle") : "");
          }
        }
        var tot = lane.idle + lane.busy;
        lane.ui.st.textContent = K.t("완료 ", "Done ") + lane.done + "/" + N + K.t(" · 노는 칸 ", " · idle ") + (tot ? Math.round(lane.idle / tot * 100) : 0) + "%" +
          (lane.end != null ? K.t(" · 끝난 시각 ", " · finished at ") + secs(lane.end) + K.t("초", "s") : "");
      });
      var a = lanes[0], b = lanes[1];
      if (a.end != null && b.end != null) {
        read.textContent = K.t("둘 다 끝났다. 고정 배치 " + secs(a.end) + "초, 연속 배치 " + secs(b.end) + "초 (그림 속 시간).",
          "Both finished: fixed " + secs(a.end) + "s, continuous " + secs(b.end) + "s (figure time).");
      } else {
        read.textContent = K.t("그림 속 시간 ", "Figure time ") + secs(clock) + K.t("초", "s");
      }
    }
    bPlay.addEventListener("click", function () {
      if (lanes[0].end != null && lanes[1].end != null) reset();
      playing = !playing;
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    });
    bReset.addEventListener("click", function () { reset(); });
    reset();
    K.loop(root, step);
  });

  K.register("vllm-kv", function (root) {
    var BUDGET = 37000, MAXLEN = 8192, PAGE = 16, CLIENT = 16;
    var mode = "paged", len = 2048;

    K.head(root, K.t("KV 캐시 약 3만 7천 토큰에 몇 개가 들어가나", "How many requests fit in a ~37K-token KV cache"),
      K.t("요청이 실제로 쓰는 길이를 바꿔 본다. 요청마다 최대 길이를 미리 잡으면 짧은 요청도 8K 자리를 차지하고, 페이지 단위로 잡으면 쓴 만큼만 차지한다.",
        "Change how long each request really is. Reserving the maximum per request makes even short ones take an 8K slot; paging takes only what is used."));

    var bar = K.el("div", "tca-bar");
    var sMode = K.seg([
      { value: "reserve", label: K.t("요청마다 최대 길이 미리 잡기", "Reserve max length per request") },
      { value: "paged", label: K.t("페이지 단위 (PagedAttention)", "Paged (PagedAttention)") }
    ], mode, function (v) { mode = v; render(); }, K.t("메모리 할당 방식", "Allocation"));
    var sLen = K.slider({ label: K.t("요청 길이", "Request length"), min: 256, max: MAXLEN, step: 256, value: len,
      fmt: function (v) { return K.fmt(v) + K.t("토큰", " tok"); }, onInput: function (v) { len = v; render(); } });
    bar.appendChild(sMode.el); bar.appendChild(sLen.el);
    root.appendChild(bar);

    root.appendChild(K.el("div", "tca-h", K.t("KV 캐시 (약 37,000토큰) — 보낸 요청이 차지한 자리", "KV cache (~37,000 tokens) — space taken by the requests sent")));
    var track = K.el("div", "vk-track");
    root.appendChild(track);
    var lg = K.el("div", "tca-legend");
    var a = K.el("span"); var ai = K.el("i"); ai.style.background = "var(--tca-accent)"; a.appendChild(ai); a.appendChild(document.createTextNode(K.t("실제로 쓰는 몫", "used")));
    var b = K.el("span"); var bi = K.el("i"); bi.style.background = "repeating-linear-gradient(135deg,var(--tca-warn) 0 3px,transparent 3px 7px)"; b.appendChild(bi); b.appendChild(document.createTextNode(K.t("잡아 두고 안 쓰는 몫", "reserved, unused")));
    var c0 = K.el("span"); var ci = K.el("i"); ci.style.background = "var(--code-bg)"; ci.style.border = "1px solid var(--tertiary)"; c0.appendChild(ci); c0.appendChild(document.createTextNode(K.t("빈 자리", "free")));
    lg.appendChild(a); lg.appendChild(b); lg.appendChild(c0);
    root.appendChild(lg);
    root.appendChild(K.el("div", "tca-h", K.t("동시에 보낸 요청 16개", "16 concurrent requests sent")));
    root.lastChild.style.marginTop = "12px";
    var q = K.el("div", "vk-q");
    var chips = [];
    for (var i = 0; i < CLIENT; i++) { var c = K.el("span", "tca-chip", String(i + 1)); q.appendChild(c); chips.push(c); }
    root.appendChild(q);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "KV 캐시 약 3만 7천 토큰, 최대 길이 8K, 동시 요청 16개는 본문 값이다. 모든 요청의 길이가 같다고 두었고, 페이지 크기 16토큰은 그림을 위한 가정이다.",
      "The ~37K-token cache, 8K max length and 16 concurrent requests are from the post. All requests have the same length here, and the 16-token page is an assumption for the figure.")));

    function render() {
      var alloc = mode === "reserve" ? MAXLEN : Math.ceil(len / PAGE) * PAGE;
      var fit = Math.floor(BUDGET / alloc);
      var run = Math.min(fit, CLIENT);
      track.textContent = "";
      for (var i = 0; i < run; i++) {
        var blk = K.el("div", "vk-blk");
        blk.style.width = "calc(" + (alloc / BUDGET * 100) + "% - 1px)";
        var u = K.el("div", "vk-use");
        u.style.width = Math.min(100, len / alloc * 100) + "%";
        blk.appendChild(u);
        track.appendChild(blk);
      }
      chips.forEach(function (c, j) {
        var on = j < fit;
        c.className = "tca-chip" + (on ? "" : " off");
        c.style.background = on ? K.COLORS[0] : "";
      });
      var usedPct = Math.round(len * run / BUDGET * 100);
      var head = mode === "reserve"
        ? K.t("요청마다 " + K.fmt(MAXLEN) + "토큰을 잡는다", "Each request reserves " + K.fmt(MAXLEN) + " tokens")
        : K.t("요청마다 쓴 만큼 " + K.fmt(alloc) + "토큰을 잡는다", "Each request takes what it uses, " + K.fmt(alloc) + " tokens");
      read.textContent = head + K.t(" → 최대 " + fit + "개가 동시에 들어간다. ", " → up to " + fit + " fit at once. ") +
        (fit >= CLIENT ? K.t("보낸 16개가 모두 돈다. ", "All 16 sent run. ") : K.t("보낸 16개 중 " + (CLIENT - fit) + "개는 자리가 날 때까지 기다린다. ", (CLIENT - fit) + " of the 16 sent wait for room. ")) +
        K.t("캐시 중 실제로 쓰는 몫 " + usedPct + "%.", "Cache actually used: " + usedPct + "%.");
    }
    render();
  });
})();
