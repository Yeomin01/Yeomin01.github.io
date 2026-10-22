/* 「데이터 생성용 LLM을 고를 때 모델보다 접근 권한이 먼저 막혔다」 글의 그림: 접근 단계에서 막히는 자리, 정적 배치와 서빙 엔진 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var A = '.tca[data-demo="llm-access-gates"] ';
  var B = '.tca[data-demo="llm-static-vs-serving"] ';
  K.css("llm-backend-access-before-model-choice-css", [
    A + ".ag-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}",
    "@media (max-width:600px){" + A + ".ag-g{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    A + ".ag-b{border:1px solid var(--tertiary);border-radius:6px;padding:8px;min-height:64px;transition:border-color .25s,background .25s,opacity .25s}",
    A + ".ag-b .n{font-size:12px;color:var(--secondary)}",
    A + ".ag-b .s{font-weight:600;font-size:13.5px;margin-top:2px}",
    A + ".ag-b.now{border-color:var(--tca-accent);box-shadow:inset 0 0 0 1px var(--tca-accent)}",
    A + ".ag-b.ok{border-color:var(--tca-good)}",
    A + ".ag-b.ok .s{color:var(--tca-good)}",
    A + ".ag-b.no{border-color:var(--tca-bad)}",
    A + ".ag-b.no .s{color:var(--tca-bad)}",
    A + ".ag-b.na{opacity:.4}",
    B + ".sv-p{margin:0 0 10px}",
    B + ".sv-rows{display:flex;flex-direction:column;gap:3px;--tca-lw:44px}",
    B + ".sv-t{position:relative;flex:1;min-width:0;height:18px;background:var(--code-bg);border-radius:3px;overflow:hidden}",
    B + ".sv-s{position:absolute;top:0;bottom:0;color:#111;font-size:10.5px;line-height:18px;text-align:center;overflow:hidden;border-right:1px solid var(--entry)}",
    B + ".sv-s.idle{background:repeating-linear-gradient(135deg,var(--tertiary) 0 3px,transparent 3px 6px)}",
    B + ".sv-cur{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--primary);opacity:.55}"
  ].join(""));

  /* ── 1. 접근 단계 ── */
  K.register("llm-access-gates", function (root) {
    var GATES = [K.t("키 유효성", "Key validity"), K.t("모델 접근 승인", "Model access approval"), K.t("쿼터·결제", "Quota and billing"), K.t("생성 비교", "Compare outputs")];
    var C = {
      a: { stop: 0, code: K.t("인증 실패", "Auth failed"), why: K.t("환경에 들어 있던 키가 유효하지 않았다.", "The key in the environment was not valid.") },
      cloud: { stop: 1, code: "403 / 404", why: K.t("계정에서 해당 모델 접근이 활성화돼 있지 않았다. 오류만 보면 모델 이름을 잘못 쓴 것처럼 보이기도 한다.", "Model access was not enabled on the account. The error can look like a misspelt model name.") },
      b: { stop: 2, code: "429", why: K.t("크레딧이 없었다.", "There were no credits.") },
      dom: { stop: 4, code: "", why: K.t("성공했다. OpenAI 호환 엔드포인트였다.", "It worked — an OpenAI-compatible endpoint.") }
    };
    var STEP = 650;
    var cand = "a", pos = 0, t = 0;

    K.head(root, K.t("성능을 비교하기 전에 지나야 할 문", "Gates to pass before comparing models"),
      K.t("후보를 고르면 요청이 문을 차례로 지나간다. 셋 중 하나라도 막히면 그 뒤의 비교는 의미가 없다.",
        "Pick a candidate and the request walks through the gates in order. If any of the first three blocks it, nothing after it matters."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "a", label: K.t("상용 API A", "Commercial API A") },
      { value: "cloud", label: K.t("클라우드 관리형", "Cloud managed") },
      { value: "b", label: K.t("상용 API B", "Commercial API B") },
      { value: "dom", label: K.t("국내 모델 API", "Domestic model API") }
    ], cand, function (v) { cand = v; start(); }, K.t("후보", "Candidate"));
    var bAgain = K.btn(K.t("다시 보내기", "Send again"));
    bar.appendChild(sg.el); bar.appendChild(bAgain);
    root.appendChild(bar);
    var g = K.el("div", "ag-g");
    var boxes = GATES.map(function (n, i) {
      var b = K.el("div", "ag-b");
      b.appendChild(K.el("div", "n", (i + 1) + ". " + n));
      var s = K.el("div", "s");
      b.appendChild(s);
      g.appendChild(b);
      return { b: b, s: s };
    });
    root.appendChild(g);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t("후보와 결과는 글의 표 그대로다. 클라우드 관리형 서비스는 모델마다 접근을 켜야 하고, 일부 제공사 모델은 사용 목적 양식도 내야 한다.",
      "Candidates and results are the post's table. A cloud managed service needs access enabled per model, and some providers' models also require a use-case form.")));

    function start() { pos = K.reduce ? 4 : 0; t = 0; render(); }
    function render() {
      var c = C[cand];
      boxes.forEach(function (x, i) {
        var cls = "ag-b", s = "";
        if (i < pos && i < c.stop) { cls += " ok"; s = K.t("통과", "Passed"); }
        else if (i === c.stop && pos > i) { cls += " no"; s = c.code; }
        else if (i > c.stop && pos > c.stop) { cls += " na"; s = K.t("확인 못 함", "Never reached"); }
        else if (i === pos) { cls += " now"; s = K.t("확인 중…", "Checking…"); }
        if (i === 3 && c.stop === 4 && pos > 3) { cls = "ag-b ok"; s = K.t("이제 비교할 수 있다", "Ready to compare"); }
        x.b.className = cls; x.s.textContent = s;
      });
      var done = pos > Math.min(c.stop, 3);
      var txt = done ? (c.stop < 4 ? K.t("막힌 곳: ", "Blocked at: ") + GATES[c.stop] + " — " + c.why : c.why) : K.t("확인 중…", "Checking…");
      if (read.textContent !== txt) read.textContent = txt;
    }
    bAgain.addEventListener("click", start);
    start();
    K.loop(root, function (dt) {
      var c = C[cand];
      if (pos > Math.min(c.stop, 3)) return;
      t += dt;
      if (t >= STEP) { t = 0; pos++; render(); }
    });
  });

  /* ── 2. 정적 배치와 서빙 엔진 ── */
  K.register("llm-static-vs-serving", function (root) {
    var L = [3, 9, 4, 2, 7, 3, 8, 2, 5, 6, 2, 4], SLOTS = 4, UNIT = 300, HOLD = 2200;
    var paused = K.reduce, now = 0, hold = 0, last = "";

    function staticPlan() {
      var rows = [[], [], [], []], ends = [], t0 = 0;
      for (var b = 0; b < L.length; b += SLOTS) {
        var mx = 0, k;
        for (k = b; k < b + SLOTS && k < L.length; k++) mx = Math.max(mx, L[k]);
        for (k = b; k < b + SLOTS && k < L.length; k++) {
          var sl = k - b;
          rows[sl].push({ s: t0, e: t0 + L[k], i: k });
          if (L[k] < mx) rows[sl].push({ s: t0 + L[k], e: t0 + mx, idle: true });
          ends.push(t0 + L[k]);
        }
        t0 += mx;
      }
      return { rows: rows, ends: ends, total: t0 };
    }
    function servingPlan() {
      var rows = [[], [], [], []], free = [0, 0, 0, 0], ends = [];
      L.forEach(function (len, i) {
        var best = 0;
        for (var s = 1; s < SLOTS; s++) if (free[s] < free[best]) best = s;
        rows[best].push({ s: free[best], e: free[best] + len, i: i });
        free[best] += len;
        ends.push(free[best]);
      });
      return { rows: rows, ends: ends, total: Math.max.apply(null, free) };
    }
    var P1 = staticPlan(), P2 = servingPlan(), T = Math.max(P1.total, P2.total);

    K.head(root, K.t("가장 긴 출력을 기다리는 배치, 끝난 자리를 바로 채우는 서빙", "A batch that waits for its longest output, a server that refills a free slot at once"),
      K.t("요청 12개의 출력 길이가 제각각이다. 자리는 둘 다 4개다. 정적 배치는 네 개가 모두 끝나야 다음 네 개를 받는다. 서빙 엔진은 끝난 자리에 바로 다음 요청을 넣는다.",
        "Twelve requests with uneven output lengths, four slots each. A static batch takes the next four only after all four finish; a serving engine puts the next request into a slot as soon as it frees."));
    var bar = K.el("div", "tca-bar");
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);

    var parts = [];
    function panel(title, plan) {
      var p = K.el("div", "sv-p");
      p.appendChild(K.el("div", "tca-h", title));
      var rows = K.el("div", "sv-rows");
      var segs = [], curs = [];
      plan.rows.forEach(function (row, si) {
        var r = K.el("div", "tca-row");
        r.appendChild(K.el("div", "tca-row-l", K.t("자리 ", "Slot ") + (si + 1)));
        var tr = K.el("div", "sv-t");
        row.forEach(function (sg) {
          var d = K.el("div", "sv-s" + (sg.idle ? " idle" : ""));
          if (!sg.idle) { d.style.background = K.COLORS[sg.i % K.COLORS.length]; if (sg.e - sg.s >= 2) d.textContent = String(sg.i + 1); }
          d.style.left = (sg.s / T * 100) + "%";
          tr.appendChild(d);
          segs.push({ el: d, s: sg.s, e: sg.e });
        });
        var c = K.el("div", "sv-cur");
        tr.appendChild(c);
        curs.push(c);
        r.appendChild(tr);
        rows.appendChild(r);
      });
      p.appendChild(rows);
      var st = K.el("div", "tca-note tca-num");
      p.appendChild(st);
      root.appendChild(p);
      parts.push({ segs: segs, curs: curs, st: st, plan: plan });
    }
    panel(K.t("정적 배치 generate", "Static batch generate"), P1);
    panel(K.t("서빙 엔진(요청 단위로 들고 남)", "Serving engine (requests join and leave)"), P2);
    root.appendChild(K.el("div", "tca-legend", K.t("색 칸 = 요청이 토큰을 뽑는 중(숫자 = 요청 번호) · 빗금 = 끝났는데 배치가 안 끝나 비어 있는 자리", "Colored = generating (number = request) · hatched = finished but the slot sits idle until the batch ends")));
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "출력 길이와 자리 수는 예시 값이다(실제 서빙 엔진은 KV 캐시 여유에 따라 동시 수가 바뀐다). 글의 실측은 같은 16GB GPU·같은 4B 모델에서 transformers 6건 배치가 명세 1건당 약 5초, vLLM 동시 12개가 완료 1건당 약 1.6초였다.",
      "Output lengths and slot count are examples (a real serving engine varies concurrency with KV-cache room). Measured in the post on the same 16 GB GPU and 4B model: transformers with 6-item batches about 5 s per spec, vLLM with 12 concurrent about 1.6 s per completion.")));

    function render() {
      parts.forEach(function (p) {
        p.segs.forEach(function (x) {
          if (now <= x.s) { x.el.style.display = "none"; return; }
          x.el.style.display = "";
          x.el.style.width = ((Math.min(x.e, now) - x.s) / T * 100) + "%";
        });
        p.curs.forEach(function (c) { c.style.left = (now / T * 100) + "%"; });
        var done = p.plan.ends.filter(function (e) { return e <= now; }).length;
        p.st.textContent = K.t("완료 ", "Done ") + done + " / " + L.length + (done === L.length ? K.t(" · 모두 끝난 시각 ", " · all done at ") + p.plan.total + K.t("단위", " units") : "");
      });
      var txt = now >= T
        ? K.t("같은 요청 12개가 정적 배치는 ", "The same 12 requests took ") + P1.total + K.t("단위, 서빙 엔진은 ", " units with static batches and ") + P2.total +
          K.t("단위에 끝났다. 완료 1건당 ", " units with the serving engine — ") + (P1.total / L.length).toFixed(2) + K.t("단위 대 ", " versus ") + (P2.total / L.length).toFixed(2) + K.t("단위다.", " units per completion.")
        : K.t("진행 ", "Time ") + Math.floor(now) + " / " + T + K.t("단위", " units");
      if (txt !== last) { read.textContent = txt; last = txt; }
    }
    bAgain.addEventListener("click", function () { now = 0; hold = 0; render(); });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    if (K.reduce) now = T;
    render();
    K.loop(root, function (dt) {
      if (paused) return;
      if (now < T) { now = Math.min(T, now + dt / UNIT); render(); }
      else { hold += dt; if (hold > HOLD) { hold = 0; now = 0; render(); } }
    });
  });
})();
