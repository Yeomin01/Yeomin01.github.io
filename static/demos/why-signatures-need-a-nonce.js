/* 「서명이 맞는데도 거절해야 할 때 — 논스」 글의 그림: 서버 검사를 하나씩 켜고 끄며 변조·재전송·경로 돌리기를 보내 보는 시뮬레이터 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("nonce-sim", function (root) {
    var WIN = 5;
    var cfg = { sig: true, path: true, nonce: true, win: true };
    var now = 0, acc = 0, playing = !K.reduce, seq = 0, last = null;
    var store = [], log = [], stat = { ok: 0, dup: 0, tamper: 0 };
    var seed = 9091;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; }
    function hex4(n) { return ("000" + (n & 0xffff).toString(16)).slice(-4); }
    // 그림용 장난감 계산(실제 HMAC 아님)
    function toySig(rq) {
      var s = "k|" + rq.method + "|" + (cfg.path ? rq.path + "|" : "") + rq.ts + "|" + rq.nonce + "|" + rq.amount, h = 2166136261;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return hex4(h ^ (h >>> 16));
    }
    function fresh() {
      var rq = { method: "POST", path: "/transfer", amount: 1000, ts: now, nonce: hex4(rnd() >>> 8) };
      rq.sig = toySig(rq);
      return rq;
    }

    K.css("why-signatures-need-a-nonce-css", [
      '.tca[data-demo="nonce-sim"] .ns-lg{display:flex;flex-direction:column;gap:3px;margin-top:8px;font-size:12.5px;min-height:40px}',
      '.tca[data-demo="nonce-sim"] .ns-lg div{padding:4px 8px;border-radius:5px;background:var(--code-bg);font-variant-numeric:tabular-nums}',
      '.tca[data-demo="nonce-sim"] .ns-st{display:flex;flex-wrap:wrap;gap:4px;min-height:26px;margin-top:6px}',
      '.tca[data-demo="nonce-sim"] .ns-st span{font-size:12px;border:1px solid var(--tertiary);border-radius:10px;padding:1px 8px;font-family:ui-monospace,monospace;transition:opacity .4s}',
      '.tca[data-demo="nonce-sim"] .ns-k{font-size:12.5px;color:var(--secondary);margin-top:10px}'
    ].join(""));

    K.head(root, K.t("서버 검사를 켜고 끄며 요청 보내 보기", "Toggle server checks and send requests"),
      K.t("검사를 하나씩 끄고 같은 요청을 보내 보면 서명과 논스가 막는 대상이 다르다는 게 보인다. 시계는 1초에 1분씩 간다.",
        "Turn checks off one at a time and send the same requests: signature and nonce block different things. The clock runs one minute per second."));

    var tg = K.el("div", "tca-bar");
    var TOG = [["sig", K.t("서명 검사", "Signature check")], ["path", K.t("서명에 경로 포함", "Path in signature")],
      ["nonce", K.t("논스 검사", "Nonce check")], ["win", K.t("5분 창", "5-minute window")]];
    var tBtns = {};
    TOG.forEach(function (x) {
      var b = K.btn(x[1], cfg[x[0]]);
      b.addEventListener("click", function () {
        cfg[x[0]] = !cfg[x[0]]; K.press(b, cfg[x[0]]);
        if (x[0] === "path") { last = null; note(K.t("서명 규격이 바뀌어 이전 요청은 다시 쓸 수 없다", "Signing spec changed; earlier requests are void"), ""); }
        paint();
      });
      tBtns[x[0]] = b; tg.appendChild(b);
    });
    root.appendChild(K.el("div", "ns-k", K.t("받는 쪽 검사", "Server checks")));
    root.appendChild(tg);

    var ab = K.el("div", "tca-bar");
    var bNew = K.btn(K.t("새 요청 보내기", "Send a new request"));
    var bTamper = K.btn(K.t("가로채 금액 바꾸기", "Intercept and change amount"));
    var bReplay = K.btn(K.t("마지막 요청 그대로 다시 보내기", "Replay the last request"));
    var bPath = K.btn(K.t("가로채 다른 경로로 보내기", "Intercept and redirect path"));
    [bNew, bTamper, bReplay, bPath].forEach(function (b) { ab.appendChild(b); });
    root.appendChild(K.el("div", "ns-k", K.t("보내기", "Send")));
    root.appendChild(ab);

    var cb = K.el("div", "tca-bar");
    var clock = K.el("span", "tca-num", "");
    var bPlay = K.btn(playing ? K.t("시계 멈춤", "Pause clock") : K.t("시계 재생", "Run clock"));
    var bWait = K.btn(K.t("+5분", "+5 min"));
    cb.appendChild(clock); cb.appendChild(bPlay); cb.appendChild(bWait);
    root.appendChild(cb);

    var lg = K.el("div", "ns-lg");
    lg.setAttribute("aria-live", "polite");
    root.appendChild(lg);
    var stK = K.el("div", "ns-k", "");
    root.appendChild(stK);
    var st = K.el("div", "ns-st");
    root.appendChild(st);
    var sum = K.el("div", "tca-read");
    root.appendChild(sum);
    root.appendChild(K.el("div", "tca-note", K.t(
      "서명 값은 그림용 장난감 계산이라 실제 HMAC 이 아니다. 금액·경로·논스 값은 예시다. 받는 쪽은 창 확인 → 서명 확인 → 논스 확인 순서로 본다.",
      "Signature values are a toy calculation, not real HMAC. Amounts, paths and nonces are examples. The server checks window, then signature, then nonce.")));

    function note(text, cls) { log.unshift({ t: text, c: cls }); if (log.length > 5) log.pop(); }
    function evict() { if (cfg.win) store = store.filter(function (s) { return now - s.ts <= WIN; }); }
    function deliver(rq, kind) {
      evict();
      var head = "#" + (++seq) + " · " + now + K.t("분 · ", "m · ") + rq.method + " " + rq.path + " · " + K.fmt(rq.amount) + K.t("원", " KRW") +
        K.t(" · 논스 ", " · nonce ") + rq.nonce + K.t(" · 서명 ", " · sig ") + rq.sig + " → ";
      if (cfg.win && now - rq.ts > WIN) { note(head + K.t("거절: 5분 창 밖", "rejected: outside the window"), "tca-good"); return; }
      if (cfg.sig && toySig(rq) !== rq.sig) { note(head + K.t("거절: 다시 계산한 서명과 다름", "rejected: signature mismatch"), "tca-good"); return; }
      if (cfg.nonce && store.some(function (s) { return s.n === rq.nonce; })) { note(head + K.t("거절: 이미 본 논스 (서명은 맞음)", "rejected: nonce already seen (signature valid)"), "tca-good"); return; }
      store.push({ n: rq.nonce, ts: rq.ts });
      stat.ok++;
      var bad = "";
      if (kind === "replay") { stat.dup++; bad = K.t(" — 같은 송금이 한 번 더 처리됨", " — the same transfer ran again"); }
      if (kind === "tamper") { stat.tamper++; bad = K.t(" — 바뀐 금액으로 처리됨", " — processed with the changed amount"); }
      if (kind === "path") { stat.tamper++; bad = K.t(" — 다른 엔드포인트에서 처리됨", " — processed at another endpoint"); }
      note(head + K.t("처리", "processed") + bad, bad ? "tca-bad" : "");
      if (kind === "new") last = rq;
    }
    bNew.addEventListener("click", function () { deliver(fresh(), "new"); paint(); });
    bTamper.addEventListener("click", function () { var rq = fresh(); rq.amount = 9000; deliver(rq, "tamper"); paint(); });
    bPath.addEventListener("click", function () { var rq = fresh(); rq.path = "/payout"; deliver(rq, "path"); paint(); });
    bReplay.addEventListener("click", function () {
      if (!last) { note(K.t("다시 보낼 요청이 없다 — 먼저 새 요청을 보낸다", "Nothing to replay — send a new request first"), ""); paint(); return; }
      deliver({ method: last.method, path: last.path, amount: last.amount, ts: last.ts, nonce: last.nonce, sig: last.sig }, "replay"); paint();
    });
    bPlay.addEventListener("click", function () { playing = !playing; bPlay.textContent = playing ? K.t("시계 멈춤", "Pause clock") : K.t("시계 재생", "Run clock"); });
    bWait.addEventListener("click", function () { now += 5; paint(); });

    var lastStoreKey = "";
    function paint() {
      evict();
      clock.textContent = K.t("시계 ", "Clock ") + now + K.t("분", " min");
      lg.textContent = "";
      if (!log.length) lg.appendChild(K.el("div", "", K.t("아직 보낸 요청이 없다.", "No requests yet.")));
      log.forEach(function (e) { lg.appendChild(K.el("div", e.c, e.t)); });
      stK.textContent = K.t("받는 쪽이 적어 둔 논스 ", "Nonces the server keeps: ") + store.length + K.t("개", "") +
        (cfg.win ? K.t(" — 5분 지난 것은 지운다", " — older than 5 min are dropped") : K.t(" — 창이 없으면 계속 쌓인다", " — without a window they pile up"));
      var key = store.map(function (s) { return s.n + (now - s.ts); }).join(",") + cfg.win;
      if (key !== lastStoreKey) {
        lastStoreKey = key;
        st.textContent = "";
        store.slice(-14).forEach(function (s) {
          var age = now - s.ts, c = K.el("span", "", s.n + " · " + age + K.t("분 전", "m ago"));
          if (cfg.win) c.style.opacity = String(Math.max(0.35, 1 - age / (WIN + 1)));
          st.appendChild(c);
        });
        if (store.length > 14) st.appendChild(K.el("span", "", "+" + (store.length - 14)));
      }
      sum.textContent = K.t("처리된 송금 ", "Transfers processed ") + stat.ok + K.t("건 · 재전송으로 두 번 처리 ", " · run twice by replay ") + stat.dup +
        K.t("건 · 변조·경로 돌리기 통과 ", " · tampered or redirected through ") + stat.tamper + K.t("건", "");
      sum.className = "tca-read" + (stat.dup || stat.tamper ? " tca-bad" : "");
    }
    K.loop(root, function (dt) {
      if (!playing) return;
      acc += dt;
      if (acc >= 1000) { acc -= 1000; now++; paint(); }
    });
    deliver(fresh(), "new");
    paint();
  });
})();
