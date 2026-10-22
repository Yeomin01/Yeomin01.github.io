/* 「배치를 키우자 GPU 메모리가 돌아오지 않았다」 글의 그림: 줄을 GPU 안에 세울 때와 밖에 세울 때 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="gpu-queue-mem"] ';
  K.css("batching-kept-the-gpu-memory-css", [
    S + ".gq-box{min-height:96px}",
    S + ".gq-lane{display:flex;flex-wrap:wrap;gap:4px;min-height:26px;align-items:center}",
    S + ".gq-cap{font-size:12px;color:var(--secondary);margin:6px 0 3px}",
    S + ".gq-c{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;",
    "font-size:11px;font-weight:600;color:#111;background:var(--tca-accent);transition:width .3s,height .3s}",
    S + ".gq-c.sm{width:16px;height:16px;font-size:9px}",
    S + ".gq-c.prep{background:var(--code-bg);color:var(--secondary);border:1px dashed var(--tertiary)}",
    S + ".gq-c.run{outline:2px solid var(--tca-warn);outline-offset:1px}",
    S + ".gq-c.gpu{background:var(--tca-warn)}"
  ].join(""));

  K.register("gpu-queue-mem", function (root) {
    var N = 16, PREP = 300;
    var MODES = {
      base: { b: 64, sv: 900, gb: 7.4, lim: 0 },
      small: { b: 16, sv: 450, gb: 4.3, lim: 0 },
      one: { b: 64, sv: 900, gb: 2.4, lim: 1 }
    };
    var WEIGHTS = 0.5, GBMAX = 8;
    var mode = "base", load = true, paused = K.reduce;
    var cl, res, cpuq, done, peak, dirty;

    K.head(root, K.t("줄을 GPU 안에 세울까, 밖에 세울까", "Queue inside the GPU or outside it"),
      K.t("동시 요청 16건이 각자 묶음을 보낸다. GPU는 묶음을 한 번에 하나씩 차례로 계산한다. GPU 안에서 줄을 선 묶음은 기다리는 동안에도 작업 공간을 쥐고 있다.",
        "Sixteen concurrent requests each send a batch. The GPU computes one batch at a time. A batch queued inside the GPU holds its workspace while it waits."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "base", label: K.t("묶음 64 · 동시 16", "Batch 64 · 16 at once") },
      { value: "small", label: K.t("묶음 16으로 줄이기", "Shrink batch to 16") },
      { value: "one", label: K.t("GPU에 동시 1개", "One batch on the GPU") }
    ], mode, function (v) { mode = v; reset(); }, K.t("설정", "Setting"));
    var bLoad = K.btn(K.t("부하 멈추기", "Stop the load"), false);
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(sg.el); bar.appendChild(bLoad); bar.appendChild(bPause);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    var bCpu = K.el("div", "tca-box gq-box"), bGpu = K.el("div", "tca-box gq-box");
    bCpu.appendChild(K.el("div", "tca-h", K.t("CPU 쪽", "CPU side")));
    bCpu.appendChild(K.el("div", "gq-cap", K.t("준비 중 · 차례 대기", "Preparing · waiting for a turn")));
    var laneCpu = K.el("div", "gq-lane");
    bCpu.appendChild(laneCpu);
    bGpu.appendChild(K.el("div", "tca-h", K.t("GPU", "GPU")));
    bGpu.appendChild(K.el("div", "gq-cap", K.t("올라간 묶음 (테두리 = 계산 중)", "Resident batches (outlined = computing)")));
    var laneGpu = K.el("div", "gq-lane");
    bGpu.appendChild(laneGpu);
    var trRun = K.el("div", "tca-track"), flRun = K.el("div", "tca-fill");
    trRun.style.marginTop = "8px"; trRun.style.height = "8px";
    flRun.style.transition = "none"; flRun.style.background = "var(--tca-warn)";
    trRun.appendChild(flRun); bGpu.appendChild(trRun);
    two.appendChild(bCpu); two.appendChild(bGpu);
    root.appendChild(two);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "112px");
    rows.style.setProperty("--tca-rw", "64px");
    rows.style.marginTop = "12px";
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
    var rUse = row(K.t("지금 올라간 묶음", "Resident now"), "var(--tca-accent)");
    var rRes = row(K.t("잡아 둔 메모리", "Reserved memory"), "var(--tca-warn)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var mnote = K.el("div", "tca-note");
    root.appendChild(mnote);
    root.appendChild(K.el("div", "tca-note", K.t(
      "그림의 시간은 예시다. GB 와 처리량은 글의 실측이다. 잡아 둔 메모리는 그 설정에서 찍힌 최대치를 따라가고, 부하를 멈춰도 내려가지 않는다(프레임워크가 받은 메모리를 쥐고 있다).",
      "Timing in the figure is illustrative; GB and throughput are the post's measurements. Reserved memory follows the peak reached under the setting and does not come down when the load stops — the framework keeps what it got.")));

    var chips = [];
    for (var i = 0; i < N; i++) chips.push(K.el("span", "gq-c", String(i + 1)));

    function reset() {
      var m = MODES[mode];
      cl = [];
      for (var j = 0; j < N; j++) cl.push({ i: j, st: load ? "prep" : "idle", t: 80 + j * 70 });
      res = []; cpuq = []; done = 0; peak = 0; dirty = true;
      mnote.textContent = ({
        base: K.t("글의 실측: 긴 문장 64개 묶음 동시 16건에서 7.4GB. 짧은 64문장 요청 처리량은 초당 869문장.",
          "Measured: 7.4 GB with 16 concurrent long 64-sentence batches; 869 sentences/s on short 64-sentence requests."),
        small: K.t("글의 실측: 7.4GB → 4.3GB. 짧은 64문장 요청 처리량은 초당 869 → 422문장으로 절반이 됐다. 동시 16건이 그대로 올라가 있다.",
          "Measured: 7.4 → 4.3 GB, and throughput on short 64-sentence requests halved from 869 to 422 sentences/s. All 16 are still resident."),
        one: K.t("글의 실측: 7.4GB → 2.4GB. 처리량은 줄지 않았다 — 긴 문장 초당 85 → 92, 짧은 64문장 요청 869 → 889.",
          "Measured: 7.4 → 2.4 GB with no loss in throughput — long sentences 85 → 92/s, short 64-sentence requests 869 → 889.")
      })[mode];
      chips.forEach(function (c) { c.className = "gq-c" + (m.b === 16 ? " sm" : ""); });
      render();
    }
    function submit(c) {
      var m = MODES[mode];
      if (m.lim && res.length >= m.lim) { c.st = "cpuq"; cpuq.push(c); }
      else { c.st = "gpu"; c.t = m.sv; res.push(c); }
      dirty = true;
    }
    function tick(dt) {
      var m = MODES[mode];
      cl.forEach(function (c) { if (c.st === "prep") { c.t -= dt; if (c.t <= 0) submit(c); } });
      if (res.length) {
        var h = res[0];
        h.t -= dt;
        if (h.t <= 0) {
          res.shift(); done++;
          h.st = load ? "prep" : "idle"; h.t = PREP;
          if (m.lim && cpuq.length && res.length < m.lim) { var nx = cpuq.shift(); nx.st = "gpu"; nx.t = m.sv; res.push(nx); }
          dirty = true;
        }
      }
      if (res.length > peak) peak = res.length;
    }

    function render() {
      var m = MODES[mode];
      if (dirty) {
        laneCpu.textContent = ""; laneGpu.textContent = "";
        cl.forEach(function (c) {
          if (c.st === "prep" || c.st === "idle") {
            chips[c.i].className = "gq-c prep" + (m.b === 16 ? " sm" : "");
            if (c.st === "prep") laneCpu.appendChild(chips[c.i]);
          }
        });
        cpuq.forEach(function (c) { chips[c.i].className = "gq-c" + (m.b === 16 ? " sm" : ""); laneCpu.appendChild(chips[c.i]); });
        res.forEach(function (c, k) {
          chips[c.i].className = "gq-c gpu" + (k === 0 ? " run" : "") + (m.b === 16 ? " sm" : "");
          laneGpu.appendChild(chips[c.i]);
        });
        dirty = false;
      }
      flRun.style.width = res.length ? (Math.max(0, 1 - res[0].t / m.sv) * 100) + "%" : "0%";
      var full = m.lim || N;
      var gb = peak ? WEIGHTS + (m.gb - WEIGHTS) * Math.min(1, peak / full) : WEIGHTS;
      rUse.f.style.width = (res.length / N * 100) + "%";
      rUse.v.textContent = res.length + K.t("개", "");
      rRes.f.style.width = (gb / GBMAX * 100) + "%";
      rRes.v.textContent = gb.toFixed(1) + "GB";
      var txt = K.t("GPU에 올라간 묶음 ", "Resident on the GPU: ") + res.length + K.t("개 (최대 ", " (peak ") + peak + K.t("개) · CPU 쪽 대기 ", ") · waiting on CPU ") + cpuq.length +
        K.t("개 · 완료 ", " · done ") + done + K.t("묶음 = ", " batches = ") + K.fmt(done * m.b) + K.t("문장", " sentences");
      if (read.textContent !== txt) read.textContent = txt;
    }

    bLoad.addEventListener("click", function () {
      load = !load;
      bLoad.textContent = load ? K.t("부하 멈추기", "Stop the load") : K.t("부하 다시 걸기", "Resume the load");
      K.press(bLoad, !load);
      cl.forEach(function (c) {
        if (!load && c.st === "prep") c.st = "idle";
        else if (load && c.st === "idle") { c.st = "prep"; c.t = PREP; }
      });
      dirty = true;
      render();
    });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });

    reset();
    if (K.reduce) { for (var w = 0; w < 120; w++) tick(100); render(); }
    K.loop(root, function (dt) {
      if (paused) return;
      tick(dt);
      render();
    });
  });
})();
