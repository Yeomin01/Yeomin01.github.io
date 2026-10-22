/* 「스레드 수는 다른 부품이 정하고 있었다」 글의 그림: 전역 스레드 설정이 정해지는 순서, 스레드 수의 맞바꿈 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var A = '.tca[data-demo="threads-global-order"] ';
  var B = '.tca[data-demo="threads-tradeoff"] ';
  K.css("someone-else-set-my-thread-count-css", [
    A + ".tg-steps{display:flex;flex-direction:column;gap:5px;margin:0 0 10px}",
    A + ".tg-step{border:1px solid var(--tertiary);border-radius:6px;padding:6px 10px;font-size:13px;opacity:.35;transition:opacity .3s,border-color .3s}",
    A + ".tg-step.seen{opacity:1}",
    A + ".tg-step.now{border-color:var(--tca-accent);box-shadow:inset 3px 0 0 var(--tca-accent)}",
    A + ".tg-step.hit{box-shadow:inset 3px 0 0 var(--tca-bad)}",
    A + ".tg-g,.tt-g{display:grid;gap:2px}",
    A + ".tg-g{grid-template-columns:repeat(12,minmax(0,1fr));max-width:320px}",
    A + ".tg-g i,.tca[data-demo='threads-tradeoff'] .tt-g i{display:flex;align-items:center;justify-content:center;height:16px;border-radius:2px;background:var(--code-bg);font-size:10px;font-style:normal;color:#111;transition:background .3s}",
    A + ".tg-g i.on{background:var(--tca-accent)}",
    B + ".tt-g{grid-template-columns:repeat(16,minmax(0,1fr));max-width:340px;margin:4px 0 0}",
    B + ".tt-g i.one{background:var(--tca-good)}",
    B + ".tt-g i.two{background:var(--tca-warn)}",
    B + ".tt-g i.many{background:var(--tca-bad)}"
  ].join(""));

  /* ── 1. 누가 같이 뜨느냐 ── */
  K.register("threads-global-order", function (root) {
    var STEPS = {
      prod: [
        [K.t("프로세스 시작 — 연산 스레드 기본값은 물리 코어 수 24", "Process starts — compute threads default to 24 physical cores"), 24],
        [K.t("개인정보 레이어 생성", "Build the PII layer"), 24],
        [K.t("다른 레이어 생성 — 생성자가 연산 스레드 수를 4로 정한다. 이 값은 프로세스 전역 기본값이다", "Build another layer — its constructor sets compute threads to 4, a process-wide default"), 4, true],
        [K.t("요청 처리 시작 — 개인정보 레이어의 연산도 4스레드로 돈다", "Serving starts — the PII layer's ops also run on 4 threads"), 4]
      ],
      tool: [
        [K.t("프로세스 시작 — 연산 스레드 기본값은 물리 코어 수 24", "Process starts — compute threads default to 24 physical cores"), 24],
        [K.t("개인정보 레이어 생성", "Build the PII layer"), 24],
        [K.t("다른 레이어는 띄우지 않는다 — 4로 정하는 그 한 줄이 실행되지 않는다", "Other layers are not loaded — the line that sets 4 never runs"), 24],
        [K.t("요청 처리 시작 — 개인정보 레이어가 24스레드로 돈다", "Serving starts — the PII layer runs on 24 threads"), 24]
      ]
    };
    var mode = "tool", step = 0;

    K.head(root, K.t("누가 같이 뜨느냐가 스레드 수를 정한다", "Who else is in the process sets the thread count"),
      K.t("이미지도 환경 변수도 같다. 다른 것은 프로세스 안에 어떤 레이어가 같이 만들어지느냐다. '다음 단계'로 서버가 레이어를 만드는 순서를 따라간다.",
        "Same image, same environment variables. What differs is which layers are built in the same process. Step through the order in which the server builds them."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "tool", label: K.t("측정 도구: 개인정보 레이어만", "Benchmark: PII layer only") },
      { value: "prod", label: K.t("운영 서버: 레이어 전부", "Server: all layers") }
    ], mode, function (v) { mode = v; step = 0; build(); }, K.t("띄운 구성", "What is loaded"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(sg.el); bar.appendChild(bNext); bar.appendChild(bAgain);
    root.appendChild(bar);
    var steps = K.el("div", "tg-steps");
    root.appendChild(steps);
    var gcap = K.el("div", "tca-h tca-num");
    root.appendChild(gcap);
    var grid = K.el("div", "tg-g");
    grid.setAttribute("aria-hidden", "true");
    var cells = [];
    for (var i = 0; i < 24; i++) { var c = K.el("i"); grid.appendChild(c); cells.push(c); }
    root.appendChild(grid);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t("칸 하나 = 물리 코어 하나. 칠한 칸 수 = 연산 내부 병렬에 쓰는 스레드 수. 글의 서버는 물리 코어 24개, 논리 코어 48개였다.",
      "One cell = one physical core; filled cells = intra-op threads. The post's server had 24 physical and 48 logical cores.")));

    var els = [];
    function build() {
      steps.textContent = "";
      els = STEPS[mode].map(function (s) { var d = K.el("div", "tg-step", s[0]); steps.appendChild(d); return d; });
      render();
    }
    function render() {
      var L = STEPS[mode];
      els.forEach(function (d, i) {
        d.className = "tg-step" + (i <= step ? " seen" : "") + (i === step ? " now" : "") + (i <= step && L[i][2] ? " hit" : "");
      });
      var th = L[step][1];
      cells.forEach(function (c, i) { c.className = i < th ? "on" : ""; });
      gcap.textContent = K.t("프로세스 전역 연산 스레드 수: ", "Process-wide compute threads: ") + th;
      bNext.disabled = step >= L.length - 1;
      read.textContent = step < L.length - 1
        ? K.t("단계 ", "Step ") + (step + 1) + " / " + L.length
        : (mode === "tool"
          ? K.t("측정 도구에서 잰 개인정보 레이어는 24스레드였다. 운영에는 없는 조건이다.", "The benchmark measured the PII layer at 24 threads — a condition that does not exist in production.")
          : K.t("운영 서버의 개인정보 레이어는 처음부터 4스레드로 돌고 있었다. 마지막에 만들어진 부품이 모두의 설정을 정한다.", "In production the PII layer had run on 4 threads all along. The last component built sets everyone's setting."));
    }
    bNext.addEventListener("click", function () { if (step < STEPS[mode].length - 1) { step++; render(); } });
    bAgain.addEventListener("click", function () { step = 0; render(); });
    build();
  });

  /* ── 2. 스레드 수의 맞바꿈 ── */
  K.register("threads-tradeoff", function (root) {
    var OLD = { 24: { 1: 33, 4: 44, 16: 48 }, 4: { 1: 39, 4: 91, 16: 74 } };
    var NEW = { 4: { 1: 62, 4: 201, 16: 357 }, 24: { 16: 226 } };
    var LAT = { 24: 119, 4: 284 };
    var LOGICAL = 48, MAXV = 357;
    var th = 24, conc = 16;

    K.head(root, K.t("스레드 수가 한 건의 지연과 동시 처리량을 맞바꾼다", "Thread count trades single-request latency for concurrent throughput"),
      K.t("요청마다 연산 스레드를 몇 개씩 쓰느냐와 동시 요청 수를 고르면, 논리 코어 48개에 몰리는 스레드 수와 글의 실측이 함께 바뀐다.",
        "Pick threads per request and concurrency; the threads piled onto 48 logical cores and the post's measurements change together."));
    var bar = K.el("div", "tca-bar");
    var sT = K.seg([{ value: 24, label: K.t("스레드 24", "24 threads") }, { value: 4, label: K.t("스레드 4", "4 threads") }], th,
      function (v) { th = v; render(); }, K.t("연산 스레드 수", "Compute threads"));
    var sC = K.seg([{ value: 1, label: K.t("동시 1", "Conc. 1") }, { value: 4, label: K.t("동시 4", "Conc. 4") }, { value: 16, label: K.t("동시 16", "Conc. 16") }], conc,
      function (v) { conc = v; render(); }, K.t("동시 요청 수", "Concurrent requests"));
    bar.appendChild(sT.el); bar.appendChild(sC.el);
    root.appendChild(bar);

    var gcap = K.el("div", "tca-h tca-num");
    root.appendChild(gcap);
    var grid = K.el("div", "tt-g");
    grid.setAttribute("aria-hidden", "true");
    var cells = [];
    for (var i = 0; i < LOGICAL; i++) { var c = K.el("i"); grid.appendChild(c); cells.push(c); }
    root.appendChild(grid);
    root.appendChild(K.el("div", "tca-legend", K.t("칸 = 논리 코어 · 초록 1개 · 노랑 2개 · 빨강 3개 이상(숫자 = 몰린 스레드)", "Cell = logical core · green 1 · yellow 2 · red 3+ (number = threads piled on)")));

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "84px");
    rows.style.setProperty("--tca-rw", "92px");
    rows.style.marginTop = "12px";
    function row(label, color) {
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", label));
      var t = K.el("div", "tca-track"), fl = K.el("div", "tca-fill");
      fl.style.background = color;
      t.appendChild(fl);
      var v = K.el("div", "tca-row-r");
      r.appendChild(t); r.appendChild(v);
      rows.appendChild(r);
      return { f: fl, v: v };
    }
    rows.appendChild(K.el("div", "tca-note", K.t("16문장 요청의 처리량, 초당 문장 수(글의 실측)", "Throughput on 16-sentence requests, sentences/s (measured in the post)")));
    var rOld = row(K.t("이전 코드", "Old code"), "var(--secondary)");
    var rNew = row(K.t("새 코드", "New code"), "var(--tca-accent)");
    root.appendChild(rows);
    var lat = K.el("div", "tca-read tca-num");
    root.appendChild(lat);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    function set(r, v) {
      r.f.style.width = (v ? v / MAXV * 100 : 0) + "%";
      r.v.textContent = v ? v + K.t("문장/초", "/s") : K.t("글에 없음", "not in post");
    }
    function render() {
      var total = th * conc;
      for (var i = 0; i < LOGICAL; i++) {
        var k = Math.floor(total / LOGICAL) + (i < total % LOGICAL ? 1 : 0);
        cells[i].className = k === 0 ? "" : k === 1 ? "one" : k === 2 ? "two" : "many";
        cells[i].textContent = k >= 2 ? String(k) : "";
      }
      gcap.textContent = K.t("스레드 ", "") + th + " × " + K.t("동시 ", "") + conc + " = " + total + K.t("개 · 논리 코어 48개에 코어당 ", " threads · ") +
        (total / LOGICAL).toFixed(1) + K.t("개", " per logical core");
      set(rOld, OLD[th][conc]);
      set(rNew, NEW[th][conc]);
      lat.textContent = K.t("혼자 들어온 16문장 요청의 지연: ", "Latency of a lone 16-sentence request: ") + LAT[th] + "ms" +
        K.t(" (스레드 ", " (") + (th === 24 ? "4" : "24") + K.t("개면 ", " threads: ") + LAT[th === 24 ? 4 : 24] + "ms)";
      var txt;
      if (th === 24 && conc === 16) txt = K.t("요청 16개가 각자 24스레드를 쓰려 하면 코어 48개에 스레드 384개가 몰린다. 서로 밀려서 처리량이 평평해진 것이지 코드의 성질이 아니었다.",
        "Sixteen requests each wanting 24 threads put 384 threads on 48 cores. They crowd each other out; the flat throughput was not a property of the code.");
      else if (conc === 1) txt = K.t("혼자 온 요청은 스레드가 많을수록 빨리 끝난다. 사용자가 느끼는 한 건의 지연은 이쪽이다.",
        "A lone request finishes sooner with more threads. This is the latency a user feels.");
      else txt = th === 4 ? K.t("스레드를 적게 주면 동시 요청이 코어를 나눠 써서 처리량이 오른다. 부하 시험이 재는 것은 이쪽이다.",
        "Fewer threads per request let concurrent requests share the cores, so throughput rises. This is what a load test measures.")
        : K.t("동시 요청이 늘면 스레드가 코어 수를 넘어 서로 밀리기 시작한다.", "As concurrency rises, threads exceed the cores and start crowding each other.");
      read.textContent = txt;
    }
    render();
  });
})();
