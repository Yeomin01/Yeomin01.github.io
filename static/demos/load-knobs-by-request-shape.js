/* 「부하를 줄이는 손잡이, 요청 모양별로」 글의 그림: 요청 모양별로 듣는 손잡이, 닫힌 루프와 열린 루프 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var A = '.tca[data-demo="knobs-shape"] ';
  var B = '.tca[data-demo="knobs-closed-open"] ';
  K.css("load-knobs-by-request-shape-css", [
    A + ".kn-list{display:flex;flex-direction:column;gap:6px}",
    A + ".kn-i{border:1px solid var(--tertiary);border-left-width:4px;border-radius:6px;padding:6px 10px;transition:opacity .3s,border-color .3s}",
    A + ".kn-i.dim{opacity:.42}",
    A + ".kn-i.good{border-left-color:var(--tca-good)}",
    A + ".kn-i.warn{border-left-color:var(--tca-warn)}",
    A + ".kn-i.bad{border-left-color:var(--tca-bad)}",
    A + ".kn-i.gap{border-style:dashed}",
    A + ".kn-top{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-weight:600;font-size:13.5px}",
    A + ".kn-d{font-size:12.5px;color:var(--secondary);margin-top:2px}",
    B + ".co-q{display:flex;flex-wrap:wrap;gap:3px;min-height:40px;align-content:flex-start;margin:6px 0}",
    B + ".co-q i{display:block;width:10px;height:10px;border-radius:2px;background:var(--tca-accent)}",
    B + ".co-q i.sv{background:var(--tca-warn)}",
    B + ".co-q span{font-size:12px;color:var(--secondary)}",
    B + ".co-m{display:grid;grid-template-columns:auto auto;gap:2px 10px;font-size:12.5px}",
    B + ".co-m b{font-weight:600;text-align:right;font-variant-numeric:tabular-nums}"
  ].join(""));

  /* ── 1. 요청 모양별로 듣는 손잡이 ── */
  K.register("knobs-shape", function (root) {
    var KN = [
      { n: K.t("요청 안의 문장을 묶어 한 번에", "Batch the sentences within a request"), e: K.t("16문장 1.6~4.8배, 1문장 1.2배", "16 sentences 1.6–4.8×, 1 sentence 1.2×"), s: K.t("GPU 메모리 최대치가 커진다", "Raises the GPU memory peak") },
      { n: K.t("GPU 왕복 줄이기", "Cut GPU round trips"), e: K.t("디코딩 271ms → 11ms", "Decoding 271 → 11 ms"), s: K.t("결과가 같은지 따로 확인해야 한다", "Must check separately that results match") },
      { n: K.t("GPU로 옮기기", "Move to the GPU"), e: K.t("16문장 지연 284ms → 62ms", "16-sentence latency 284 → 62 ms"), s: K.t("나눠 쓰는 GPU에서 1문장은 두 배 느림. 남이 메모리를 채우면 실패", "On a shared GPU one sentence is twice as slow; fails when others fill memory") },
      { n: K.t("연산 스레드 수 줄이기", "Fewer compute threads"), e: K.t("동시 16에서 226 → 357문장/초", "At concurrency 16: 226 → 357 sentences/s"), s: K.t("혼자 온 큰 요청은 119ms → 284ms", "A lone large request: 119 → 284 ms") },
      { n: K.t("요청 단위 잠금 풀기", "Remove the per-request lock"), e: K.t("동시 8에서 1.3 → 4.5건/초", "At concurrency 8: 1.3 → 4.5/s"), s: K.t("스레드별 사본이 메모리와 첫 요청 지연을 먹는다", "Per-thread copies cost memory and first-request latency") },
      { n: K.t("레이어 전용 프로세스", "Dedicated process per layer"), e: K.t("상한 5.4 → 9~10건/초", "Ceiling 5.4 → 9–10/s"), s: K.t("메모리가 프로세스 수만큼. 운영 대상이 늘어난다", "Memory per process; more things to operate") },
      { n: K.t("묶음 크기 줄이기", "Smaller batches"), e: "7.4GB → 4.3GB", s: K.t("처리량 절반", "Half the throughput") },
      { n: K.t("동시에 올리는 묶음 수 제한", "Limit batches on the GPU at once"), e: K.t("7.4GB → 2.4GB, 처리량 그대로", "7.4 → 2.4 GB, same throughput"), s: K.t("코드 변경이 필요하다", "Needs a code change") },
      { n: K.t("여러 요청의 문장을 모아 한 묶음으로", "Pool sentences across requests"), e: K.t("재지 않았다", "Not measured"), s: K.t("기다리는 창만큼 지연의 바닥이 올라가고 구현이 복잡하다", "The wait window raises the latency floor; complex to build"), gap: true }
    ];
    var SH = {
      small: {
        sum: K.t("묶음 효과가 작다. 요청마다 드는 파이썬 구간이 천장이다. 전용 프로세스가 듣고, GPU는 나눠 쓰는 한 손해다.",
          "Batching does little. The per-request Python section is the ceiling. A dedicated process helps; a shared GPU hurts."),
        m: { 0: ["warn", K.t("효과 작다", "small effect")], 2: ["bad", K.t("나눠 쓰면 손해", "loses when shared")], 5: ["good", K.t("듣는다", "helps")],
          8: ["warn", K.t("가장 맞는 처방, 재지 않음", "best fit, unmeasured")] }
      },
      large: {
        sum: K.t("묶음이 가장 크게 듣는다. GPU로 옮길 만하고, 그때는 메모리 최대치를 같이 본다.",
          "Batching helps most. Moving to the GPU pays off — then watch the memory peak too."),
        m: { 0: ["good", K.t("가장 크게 듣는다", "helps most")], 2: ["good", K.t("옮길 만하다", "worth it")], 1: ["warn", K.t("GPU로 옮기면", "once on GPU")],
          6: ["warn", K.t("메모리 최대치를 볼 때", "for the memory peak")], 7: ["warn", K.t("메모리 최대치를 볼 때", "for the memory peak")] }
      },
      mixed: {
        sum: K.t("큰 요청 하나가 작은 요청들을 세우지 않게 하는 게 먼저다. 요청 단위 잠금이 있으면 그것부터 본다.",
          "First keep one large request from stalling the small ones. If there is a per-request lock, start there."),
        m: { 4: ["good", K.t("먼저 본다", "look first")] }
      }
    };
    var shape = "small";

    K.head(root, K.t("요청 모양을 고르면 듣는 손잡이", "Pick a request shape, see which knobs apply"),
      K.t("글의 표를 요청 모양으로 세로로 잘라 읽는다. 효과와 부작용은 표 그대로이고, 표시는 '요청 모양으로 다시 읽으면' 절의 문장을 따랐다.",
        "The post's table, sliced by request shape. Effects and side effects are the table's; the marks follow the section on reading by request shape."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "small", label: K.t("한두 문장 대화", "1–2 sentence chats") },
      { value: "large", label: K.t("수십 문장 응답·문서", "Dozens of sentences") },
      { value: "mixed", label: K.t("둘이 섞임", "A mix") }
    ], shape, function (v) { shape = v; render(); }, K.t("요청 모양", "Request shape"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var sum = K.el("div", "tca-read");
    sum.setAttribute("aria-live", "polite");
    sum.style.margin = "0 0 10px";
    root.appendChild(sum);
    var list = K.el("div", "kn-list");
    var items = KN.map(function (k) {
      var it = K.el("div", "kn-i" + (k.gap ? " gap" : ""));
      var top = K.el("div", "kn-top");
      top.appendChild(K.el("span", null, k.n));
      var tag = K.el("span", "tca-tag");
      top.appendChild(tag);
      it.appendChild(top);
      it.appendChild(K.el("div", "kn-d", K.t("효과 ", "Effect ") + k.e + K.t(" · 부작용 ", " · Side effect ") + k.s));
      list.appendChild(it);
      return { it: it, tag: tag, gap: k.gap };
    });
    root.appendChild(list);
    root.appendChild(K.el("div", "tca-note", K.t("초록 = 듣는다 · 노랑 = 조건부로 본다 · 빨강 = 손해 · 흐린 줄 = 그 모양에 대해 글이 따로 말하지 않았다. 점선 줄은 재지 않아 표에서 빠진 손잡이다.",
      "Green = helps · yellow = conditional · red = hurts · faded = the post says nothing for that shape. The dashed row was left out of the table because it was not measured.")));

    function render() {
      var m = SH[shape].m;
      sum.textContent = SH[shape].sum;
      items.forEach(function (x, i) {
        var s = m[i];
        x.it.className = "kn-i" + (x.gap ? " gap" : "") + (s ? " " + s[0] : " dim");
        x.tag.textContent = s ? s[1] : "—";
        x.tag.style.display = s ? "" : "none";
      });
    }
    render();
  });

  /* ── 2. 닫힌 루프와 열린 루프 ── */
  K.register("knobs-closed-open", function (root) {
    var SV_N = 250, SV_S = 500, CLIENTS = 4, GAP = 333, WIN = 4000, QSHOW = 40, QCAP = 400;
    var slow = false, paused = K.reduce, t = 0;
    var P;

    K.head(root, K.t("닫힌 루프는 서버를 봐준다", "A closed loop goes easy on the server"),
      K.t("같은 서버를 두 방식으로 잰다. 닫힌 루프는 동시 4개가 응답을 받은 뒤에야 다음을 보낸다. 열린 루프는 서버 사정과 상관없이 일정한 간격으로 보낸다. 중간에 서버를 느리게 만들어 본다.",
        "The same server, measured two ways. The closed loop keeps 4 in flight and sends only after a reply. The open loop sends at a fixed interval regardless. Slow the server down midway."));
    var bar = K.el("div", "tca-bar");
    var bSlow = K.btn(K.t("서버 느려짐", "Slow server"), false);
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(bSlow); bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    function panel(title) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", title));
      var q = K.el("div", "co-q");
      q.setAttribute("aria-hidden", "true");
      b.appendChild(q);
      var m = K.el("div", "co-m");
      function line(l) { m.appendChild(K.el("span", null, l)); var v = K.el("b"); m.appendChild(v); return v; }
      var o = { q: q, send: line(K.t("보내는 속도", "Send rate")), done: line(K.t("처리 속도", "Completion rate")),
        len: line(K.t("서버 앞 요청", "At the server")), lat: line(K.t("응답 시간", "Response time")) };
      b.appendChild(m);
      two.appendChild(b);
      return o;
    }
    var vC = panel(K.t("닫힌 루프 — 동시 4개", "Closed loop — 4 in flight"));
    var vO = panel(K.t("열린 루프 — 초당 3건", "Open loop — 3 per second"));
    root.appendChild(two);
    root.appendChild(K.el("div", "tca-legend", K.t("노란 칸 = 처리 중 · 파란 칸 = 줄 서서 기다림", "Yellow = being served · blue = queued")));
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "값은 예시다(처리 시간 0.25초, 느려지면 0.5초). 글의 측정은 전부 닫힌 루프였고, 그래서 그 숫자는 배수로만 읽고 버틸 수 있는 도착률로는 읽지 않는다.",
      "Values are examples (0.25 s per request, 0.5 s when slow). Every measurement in the post was closed-loop, so its numbers are read only as ratios, not as a sustainable arrival rate.")));

    function mk(closed) { return { closed: closed, q: [], cur: null, rem: 0, sends: [], dones: [], lat: [], next: 0, drop: 0 }; }
    function reset() {
      t = 0;
      P = [mk(true), mk(false)];
      for (var i = 0; i < CLIENTS; i++) P[0].q.push(0); // 처음 띄운 4건은 보내는 속도에 넣지 않는다
      render();
    }
    function send(p, at) {
      p.sends.push(at);
      if (p.q.length < QCAP) p.q.push(at); else p.drop++;
    }
    function step(p, dt) {
      if (!p.closed) while (p.next <= t) { send(p, p.next); p.next += GAP; }
      if (p.cur == null && p.q.length) { p.cur = p.q.shift(); p.rem = slow ? SV_S : SV_N; }
      if (p.cur != null) {
        p.rem -= dt;
        if (p.rem <= 0) {
          p.lat.push(t - p.cur); if (p.lat.length > 6) p.lat.shift();
          p.dones.push(t);
          p.cur = null;
          if (p.closed) send(p, t);
          if (p.q.length) { p.cur = p.q.shift(); p.rem = (slow ? SV_S : SV_N) + p.rem; }
        }
      }
      var cut = t - WIN;
      while (p.sends.length && p.sends[0] < cut) p.sends.shift();
      while (p.dones.length && p.dones[0] < cut) p.dones.shift();
    }
    function rate(arr) { var w = Math.min(WIN, Math.max(t, 1000)); return arr.length / (w / 1000); }
    function show(p, v) {
      var n = p.q.length + (p.cur != null ? 1 : 0);
      var shown = Math.min(n, QSHOW);
      if (v.q.childElementCount !== shown + (n > QSHOW ? 1 : 0)) {
        v.q.textContent = "";
        for (var i = 0; i < shown; i++) v.q.appendChild(K.el("i", i === 0 && p.cur != null ? "sv" : null));
        if (n > QSHOW) v.q.appendChild(K.el("span", null, "+" + (n - QSHOW)));
      } else if (n > QSHOW) v.q.lastChild.textContent = "+" + (n - QSHOW);
      v.send.textContent = rate(p.sends).toFixed(1) + K.t("건/초", "/s");
      v.done.textContent = rate(p.dones).toFixed(1) + K.t("건/초", "/s");
      v.len.textContent = n + K.t("건", "");
      var s = 0;
      p.lat.forEach(function (x) { s += x; });
      v.lat.textContent = p.lat.length ? (s / p.lat.length / 1000).toFixed(2) + K.t("초", " s") : "—";
    }
    function render() {
      show(P[0], vC); show(P[1], vO);
      var txt = slow
        ? K.t("서버가 느려졌다. 닫힌 루프는 보내는 속도도 같이 절반이 되어 줄이 4건에서 멈춘다. 열린 루프는 계속 초당 3건을 보내 줄이 끝없이 길어진다.",
          "The server slowed. The closed loop's send rate halves with it and its queue stays at 4. The open loop keeps sending 3/s and its queue grows without end.")
        : K.t("평소에는 둘 다 버틴다. '서버 느려짐'을 눌러 본다.", "Normally both keep up. Press 'Slow server'.");
      if (read.textContent !== txt) read.textContent = txt;
    }

    bSlow.addEventListener("click", function () { slow = !slow; K.press(bSlow, slow); render(); });
    bAgain.addEventListener("click", function () { slow = false; K.press(bSlow, false); reset(); });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    reset();
    if (K.reduce) { for (var w = 0; w < 60; w++) { t += 100; step(P[0], 100); step(P[1], 100); } render(); }
    K.loop(root, function (dt) {
      if (paused || !dt) return;
      t += dt;
      step(P[0], dt); step(P[1], dt);
      render();
    });
  });
})();
