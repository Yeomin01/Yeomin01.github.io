/* 「나눠 쓰는 GPU는 작은 요청에 세금을 매긴다」 글의 그림: 왕복마다 다른 작업의 차례를 기다리는 요청 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="shared-gpu-tax"] ';
  K.css("shared-gpu-taxes-small-requests-css", [
    S + ".sg-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 10px}",
    S + ".sg-slot{border:1px solid var(--tertiary);border-radius:6px;padding:6px 4px;text-align:center;font-size:12.5px;transition:background .12s}",
    S + ".sg-slot.on{background:var(--tca-warn);color:#111;border-color:var(--tca-warn)}",
    S + ".sg-slot.me.on{background:var(--tca-accent);border-color:var(--tca-accent)}",
    S + ".sg-t{position:relative;height:20px;background:var(--code-bg);border-radius:3px;overflow:hidden}",
    S + ".sg-s{position:absolute;top:0;bottom:0}",
    S + ".sg-s.w{background:repeating-linear-gradient(135deg,var(--tertiary) 0 3px,transparent 3px 6px)}",
    S + ".sg-s.m{background:var(--tca-accent)}",
    S + ".sg-cur{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--primary);opacity:.6}",
    S + ".sg-cap{font-size:12.5px;color:var(--secondary);margin:2px 0 4px}"
  ].join(""));

  K.register("shared-gpu-tax", function (root) {
    var TRIPS = 9, LAP = 4.5, MINE = 0.1, REAL = 70, HOLD = 1500;
    var n = 1, paused = K.reduce, now = 0, hold = 0, segs, last = "";
    function cpu(k) { return 22 + (284 - 22) * (k - 1) / 15; }
    function gpu(k) { return 43 + (62 - 43) * (k - 1) / 15; }

    K.head(root, K.t("왕복마다 한 바퀴를 기다린다", "Every round trip waits a full lap"),
      K.t("이 GPU는 다른 작업 두 개와 시분할로 번갈아 돈다. 내 요청은 GPU에서 값을 받아 올 때마다 다른 작업의 차례가 끝나기를 기다린다. 문장이 늘어도 왕복 횟수는 같다.",
        "This GPU time-slices between two other jobs and mine. Each time my request pulls a value back, it waits for the other jobs' turns. More sentences do not add round trips."));

    var bar = K.el("div", "tca-bar");
    var sl = K.slider({ label: K.t("요청의 문장 수", "Sentences per request"), min: 1, max: 16, step: 1, value: n,
      fmt: function (v) { return v + K.t("문장", ""); }, onInput: function (v) { n = v; build(); } });
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(sl.el); bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);

    root.appendChild(K.el("div", "sg-cap", K.t("지금 GPU를 쓰는 쪽", "Who has the GPU now")));
    var strip = K.el("div", "sg-strip");
    var slA = K.el("div", "sg-slot", K.t("다른 작업 1", "Other job 1"));
    var slB = K.el("div", "sg-slot", K.t("다른 작업 2", "Other job 2"));
    var slM = K.el("div", "sg-slot me", K.t("내 요청", "My request"));
    strip.appendChild(slA); strip.appendChild(slB); strip.appendChild(slM);
    root.appendChild(strip);

    var cap = K.el("div", "sg-cap tca-num");
    root.appendChild(cap);
    var tr = K.el("div", "sg-t");
    var cur = K.el("div", "sg-cur");
    root.appendChild(tr);
    var lg = K.el("div", "tca-legend");
    [[K.t("빗금 = 차례 대기", "Hatched = waiting for a turn"), "background:repeating-linear-gradient(135deg,var(--tertiary) 0 3px,transparent 3px 6px)"],
     [K.t("파랑 = 내 연산", "Blue = my compute"), "background:var(--tca-accent)"]].forEach(function (x) {
      var s = K.el("span"), i = K.el("i"); i.setAttribute("style", x[1]); s.appendChild(i); s.appendChild(document.createTextNode(x[0])); lg.appendChild(s);
    });
    root.appendChild(lg);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "96px");
    rows.style.setProperty("--tca-rw", "60px");
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
    var rCpu = row("CPU", K.COLORS[3]);
    var rGpu = row(K.t("나눠 쓰는 GPU", "Shared GPU"), "var(--tca-accent)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "왕복 한 번 4.5ms 와 1문장·16문장 지연(CPU 22ms·284ms, GPU 43ms·62ms)은 글의 실측이다. 그 사이는 두 점을 직선으로 이은 예시 값이다. 왕복 9번은 43ms 를 4.5ms 로 나눈 글의 어림이고(정확히 세지는 않았다), 다른 작업 둘의 차례 길이는 반씩으로 두었다.",
      "The 4.5 ms round trip and the 1- and 16-sentence latencies (CPU 22 / 284 ms, GPU 43 / 62 ms) are measured in the post; values in between are a straight line joining them. Nine round trips is the post's estimate (43 ÷ 4.5, not counted exactly); the two other jobs' turns are split evenly.")));

    function build() {
      var total = gpu(n);
      segs = [];
      for (var i = 0; i < TRIPS; i++) {
        var b = i * LAP, wait = LAP - MINE;
        segs.push({ s: b, e: b + wait / 2, k: "A" }, { s: b + wait / 2, e: b + wait, k: "B" }, { s: b + wait, e: b + LAP, k: "M", trip: i + 1 });
      }
      segs.push({ s: TRIPS * LAP, e: total, k: "M" });
      tr.textContent = "";
      segs.forEach(function (sg) {
        var d = K.el("div", "sg-s " + (sg.k === "M" ? "m" : "w"));
        d.style.left = (sg.s / total * 100) + "%";
        d.style.width = ((sg.e - sg.s) / total * 100) + "%";
        tr.appendChild(d);
      });
      tr.appendChild(cur);
      now = K.reduce ? total : 0; hold = 0;
      var c = cpu(n), g = total, mx = Math.max(c, g);
      rCpu.f.style.width = (c / mx * 100) + "%"; rCpu.v.textContent = Math.round(c) + "ms";
      rGpu.f.style.width = (g / mx * 100) + "%"; rGpu.v.textContent = Math.round(g) + "ms";
      var tax = TRIPS * LAP;
      var txt = n + K.t("문장 요청 — ", "-sentence request — ") + (c < g ? K.t("CPU가 빠르다. ", "CPU is faster. ") : K.t("GPU가 빠르다. ", "GPU is faster. ")) +
        K.t("GPU 지연 ", "Of the GPU's ") + Math.round(g) + K.t("ms 중 왕복 9번 × 4.5ms = ", " ms, nine round trips × 4.5 ms = ") + tax.toFixed(1) + "ms(" + Math.round(tax / g * 100) + "%)" + K.t("다.", ".");
      if (n === 1) txt += K.t(" 동시 16의 처리량도 CPU 초당 89건, GPU 33건이었다.", " At concurrency 16 throughput was CPU 89/s versus GPU 33/s.");
      if (n === 16) txt += K.t(" 동시 16의 처리량은 CPU 357문장/초, GPU 338문장/초로 비슷했다.", " At concurrency 16 they were close: CPU 357 versus GPU 338 sentences/s.");
      read.textContent = txt;
      render();
    }
    function render() {
      var total = gpu(n), who = "M", trips = 0;
      for (var i = 0; i < segs.length; i++) {
        var sg = segs[i];
        if (sg.trip && sg.e <= now + 1e-9) trips = sg.trip;
        if (now >= sg.s && now < sg.e) who = sg.k;
      }
      if (now >= total) who = "";
      slA.className = "sg-slot" + (who === "A" ? " on" : "");
      slB.className = "sg-slot" + (who === "B" ? " on" : "");
      slM.className = "sg-slot me" + (who === "M" ? " on" : "");
      cur.style.left = (Math.min(1, now / total) * 100) + "%";
      var txt = K.t("내 요청 경과 ", "My request: ") + now.toFixed(1) + " / " + total.toFixed(1) + "ms · " + K.t("왕복 ", "round trips ") + trips + " / " + TRIPS;
      if (txt !== last) { cap.textContent = txt; last = txt; }
    }

    bAgain.addEventListener("click", function () { now = 0; hold = 0; render(); });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    build();
    K.loop(root, function (dt) {
      if (paused) return;
      var total = gpu(n);
      if (now < total) { now = Math.min(total, now + dt / REAL); render(); }
      else { hold += dt; if (hold > HOLD) { hold = 0; now = 0; render(); } }
    });
  });
})();
