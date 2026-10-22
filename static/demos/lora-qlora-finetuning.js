/* 「7B·10B 모델을 16GB GPU 한 장으로 파인튜닝하기」 글의 그림: rank r 과 모델 크기를 바꾸면 학습 파라미터와 메모리가 어떻게 바뀌는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("lora-qlora-finetuning-css", [
    '.tca[data-demo="lora-mem"] .lq-track{position:relative;flex:1;min-width:0;height:18px;background:var(--code-bg);border-radius:3px}',
    '.tca[data-demo="lora-mem"] .lq-seg{position:absolute;top:0;bottom:0;transition:left .35s ease,width .35s ease}',
    '.tca[data-demo="lora-mem"] .lq-mark{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--primary)}',
    '.tca[data-demo="lora-mem"] .lq-axis{position:relative;flex:1;min-width:0;height:16px;font-size:11.5px;color:var(--secondary)}',
    '.tca[data-demo="lora-mem"] .lq-axis span{position:absolute;transform:translateX(-50%);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.tca[data-demo="lora-mem"] .lq-h{font-size:12.5px;color:var(--secondary);margin:12px 0 4px}',
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="lora-mem"] .lq-seg{transition:none}}'
  ].join(""));

  K.register("lora-mem", function (root) {
    var D = 4096, MAXGB = 80, GPU = 16;
    var N = 7e9, r = 16;
    var SEG = {
      w: { c: K.COLORS[0], lb: K.t("학습하는 가중치", "Trained weights") },
      wf: { c: K.COLORS[7], lb: K.t("동결 원본 (fp16)", "Frozen base (fp16)") },
      wq: { c: K.COLORS[5], lb: K.t("동결 원본 (4-bit)", "Frozen base (4-bit)") },
      g: { c: K.COLORS[1], lb: "gradient" },
      o: { c: K.COLORS[2], lb: "optimizer state" }
    };

    K.head(root, K.t("rank r 과 모델 크기에 따라 달라지는 메모리", "Memory as rank r and model size change"),
      K.t("가중치·gradient·optimizer state 를 글의 계산대로 쌓았다. r 을 움직이면 학습 파라미터 비율과 어댑터 몫이 바뀌고, 모델을 10B 로 바꾸면 16GB 선과의 거리가 바뀐다.",
        "Weights, gradients and optimizer state are stacked using the post's arithmetic. Moving r changes the trained fraction and the adapter share; switching to 10B moves everything against the 16GB line."));

    var bar = K.el("div", "tca-bar");
    var sgN = K.seg([{ value: 7e9, label: "7B" }, { value: 10e9, label: "10B" }], N,
      function (v) { N = v; render(); }, K.t("모델 크기", "Model size"));
    var sR = K.slider({ label: "r", min: 4, max: 64, step: 4, value: r, fmt: function (v) { return String(v); },
      onInput: function (v) { r = v; render(); } });
    bar.appendChild(sgN.el); bar.appendChild(sR.el);
    root.appendChild(bar);

    // 메모리 막대
    var rowsBox = K.el("div", "tca-rows");
    rowsBox.style.setProperty("--tca-lw", "92px");
    rowsBox.style.setProperty("--tca-rw", "58px");
    function memRow(label) {
      var row = K.el("div", "tca-row");
      row.appendChild(K.el("div", "tca-row-l", label));
      var tr = K.el("div", "lq-track");
      var segs = {};
      ["w", "wf", "wq", "a", "g", "o"].forEach(function (k) {
        var s = K.el("div", "lq-seg");
        s.style.background = (SEG[k] || SEG.w).c;
        s.style.width = "0%";
        tr.appendChild(s);
        segs[k] = s;
      });
      var mk = K.el("div", "lq-mark");
      mk.style.left = (GPU / MAXGB * 100) + "%";
      tr.appendChild(mk);
      row.appendChild(tr);
      var v = K.el("div", "tca-row-r");
      row.appendChild(v);
      rowsBox.appendChild(row);
      return { segs: segs, v: v };
    }
    var R = { full: memRow(K.t("전체 파인튜닝", "Full FT")), lora: memRow("LoRA"), qlora: memRow("QLoRA") };
    var axis = K.el("div", "tca-row");
    axis.appendChild(K.el("div", "tca-row-l", "GB"));
    var ax = K.el("div", "lq-axis");
    [0, 16, 40, 60, 80].forEach(function (g) {
      var sp = K.el("span", null, String(g));
      sp.style.left = (g / MAXGB * 100) + "%";
      if (g === 16) sp.style.fontWeight = "600";
      ax.appendChild(sp);
    });
    axis.appendChild(ax);
    axis.appendChild(K.el("div", "tca-row-r", ""));
    rowsBox.appendChild(axis);
    root.appendChild(rowsBox);

    var legend = K.el("div", "tca-legend");
    ["w", "wf", "wq", "g", "o"].forEach(function (k) {
      var sp = K.el("span"), i = K.el("i");
      i.style.background = SEG[k].c;
      sp.appendChild(i); sp.appendChild(document.createTextNode(SEG[k].lb));
      legend.appendChild(sp);
    });
    var lm = K.el("span"), li = K.el("i");
    li.style.cssText = "width:2px;height:12px;background:var(--primary)";
    lm.appendChild(li); lm.appendChild(document.createTextNode(K.t("GPU 16GB 선", "16GB GPU line")));
    legend.appendChild(lm);
    root.appendChild(legend);

    // 학습 파라미터 비율
    root.appendChild(K.el("div", "lq-h", K.t("학습 파라미터 비율 (B + A) / W = 2r/d — 막대는 0~4%, 굵은 선이 1%", "Trained fraction (B + A) / W = 2r/d — bar spans 0–4%, thick line at 1%")));
    var fr = K.el("div", "tca-rows");
    fr.style.setProperty("--tca-lw", "92px");
    fr.style.setProperty("--tca-rw", "58px");
    var frow = K.el("div", "tca-row");
    frow.appendChild(K.el("div", "tca-row-l", "LoRA · r"));
    var ftr = K.el("div", "lq-track");
    var ffill = K.el("div", "lq-seg");
    ffill.style.background = "var(--tca-accent)"; ffill.style.left = "0";
    var fmk = K.el("div", "lq-mark");
    fmk.style.left = "25%";
    ftr.appendChild(ffill); ftr.appendChild(fmk);
    frow.appendChild(ftr);
    var fv = K.el("div", "tca-row-r");
    frow.appendChild(fv);
    fr.appendChild(frow);
    root.appendChild(fr);

    var read1 = K.el("div", "tca-read"), read2 = K.el("div", "tca-read");
    read2.style.marginTop = "4px";
    read2.setAttribute("aria-live", "polite");
    root.appendChild(read1); root.appendChild(read2);
    root.appendChild(K.el("div", "tca-note", K.t(
      "GB 는 10⁹ byte 다. 가중치·gradient 는 fp16 2byte, Adam 상태는 글처럼 가중치의 약 2배(파라미터당 4byte)로 셌다. 전체 파인튜닝은 세 항목만 더한 값이고, 글은 optimizer state 를 28GB+ 로 적어 합계를 60GB 초과로 본다. 어댑터 비율은 모든 가중치를 d×d 행렬로 보고 2r/d 로 셌으며 d=4096 은 예시 값이다. 활성값·배치 메모리와 4-bit 양자화 상수는 넣지 않았다.",
      "1 GB = 10⁹ bytes. Weights and gradients are fp16 (2 bytes); Adam state is about twice the weights (4 bytes per parameter), as in the post. Full FT sums only these three; the post writes optimizer state as 28GB+ and puts the total above 60GB. The adapter fraction treats every weight as a d×d matrix, 2r/d, with d = 4096 as an example value. Activations, batch memory and 4-bit quantization constants are left out.")));

    function cnt(n) {
      if (K.lang === "en") return n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B" : (n / 1e6).toFixed(1) + "M";
      if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
      return K.fmt(Math.round(n / 1e4)) + "만";
    }
    function gb(b) { return (b / 1e9).toFixed(1) + "GB"; }
    function paint(row, parts) {
      var left = 0, tot = 0;
      ["w", "wf", "wq", "a", "g", "o"].forEach(function (k) {
        var b = parts[k] || 0, el = row.segs[k];
        el.style.left = (left / 1e9 / MAXGB * 100).toFixed(2) + "%";
        el.style.width = (b / 1e9 / MAXGB * 100).toFixed(2) + "%";
        left += b; tot += b;
      });
      row.v.textContent = gb(tot);
      return tot;
    }
    function vsGpu(name, tot) {
      var g = tot / 1e9;
      if (g > GPU) return name + " " + g.toFixed(1) + K.t("GB — 16GB 를 ", "GB — over 16GB by ") + (g - GPU).toFixed(1) + K.t("GB 넘는다", "GB");
      return name + " " + g.toFixed(1) + K.t("GB — 16GB 까지 ", "GB — ") + (GPU - g).toFixed(1) + K.t("GB 남는다", "GB below 16GB");
    }
    function render() {
      var f = 2 * r / D, p = f * N;
      var tf = paint(R.full, { w: 2 * N, g: 2 * N, o: 4 * N });
      var tl = paint(R.lora, { wf: 2 * N, a: 2 * p, g: 2 * p, o: 4 * p });
      var tq = paint(R.qlora, { wq: 0.5 * N, a: 2 * p, g: 2 * p, o: 4 * p });
      R.full.v.textContent += "+";
      ffill.style.width = Math.min(100, f * 100 / 4 * 100).toFixed(2) + "%";
      fv.textContent = (f * 100).toFixed(2) + "%";
      read1.textContent = K.t("d×d 행렬 하나: 원본 W ", "One d×d matrix: W has ") + K.fmt(D * D) +
        K.t("개 · B(d×r) + A(r×d) ", " · B (d×r) + A (r×d) has ") + K.fmt(2 * D * r) +
        K.t("개. 모델 전체로는 ", ". Whole model: ") + cnt(N) + K.t(" 개 중 ", " → ") + cnt(p) +
        K.t(" 개만 학습한다 (", " trained (") + (f * 100).toFixed(2) + "%" + (f < 0.01 ? K.t(", 1% 미만).", ", under 1%).") : ").");
      read2.textContent = K.t("활성값을 빼고 16GB 와 비교: ", "Against 16GB, without activations: ") +
        vsGpu(K.t("전체", "Full"), tf) + " · " + vsGpu("LoRA", tl) + " · " + vsGpu("QLoRA", tq) + ".";
    }
    render();
  });
})();
