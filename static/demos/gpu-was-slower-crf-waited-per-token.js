/* 「GPU로 옮겼더니 더 느려졌다」 글의 그림: 비터비 역추적 표를 값 하나씩 꺼낼 때와 한 번에 가져올 때 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="crf-backtrace"] ';
  K.css("gpu-was-slower-crf-waited-per-token-css", [
    S + ".cb-grid{display:grid;grid-template-columns:repeat(35,minmax(0,1fr));gap:1px;margin:4px 0 0}",
    S + ".cb-grid i{display:block;height:9px;border-radius:1px;background:var(--code-bg)}",
    S + ".cb-grid i.cp{background:var(--tertiary)}",
    S + ".cb-grid i.on{background:var(--tca-accent)}",
    S + ".cb-grid i.cur{background:var(--tca-bad)}",
    S + ".cb-st{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:8px 0 0;font-size:13px}",
    S + ".cb-lamp{display:inline-flex;align-items:center;gap:6px}",
    S + ".cb-lamp b{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--code-bg);border:1px solid var(--tertiary)}",
    S + ".cb-lamp.lit b{background:var(--tca-bad);border-color:var(--tca-bad)}"
  ].join(""));

  K.register("crf-backtrace", function (root) {
    var R = 6, T = 35, N = R * T;
    var STEP = 45, WAIT = 0.6, COPY = 700, COLSTEP = 30, HOLD = 2200;
    var mode = "item", paused = K.reduce, clock = 0, hold = 0, last = "";

    K.head(root, K.t("역추적 표를 읽는 두 가지 방법", "Two ways to read the backtrace table"),
      K.t("비터비의 뒤 단계는 끝 토큰에서 앞으로 표를 따라가며 태그를 읽는다. 칸 하나가 토큰 하나의 역추적 값이다. 값을 GPU에서 하나씩 꺼내면 꺼낼 때마다 GPU가 밀린 일을 끝낼 때까지 기다린다.",
        "Viterbi's second pass walks the table from the last token back to the first. Each cell is one token's backpointer. Pulling values off the GPU one at a time waits for the GPU to finish its queued work on every pull."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "item", label: K.t("토큰마다 .item()", ".item() per token") },
      { value: "bulk", label: K.t("표를 한 번에 CPU로", "Whole table to CPU once") }
    ], mode, function (v) { mode = v; clock = 0; hold = 0; render(); }, K.t("읽는 방법", "How to read"));
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(sg.el); bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);

    root.appendChild(K.el("div", "tca-note", K.t("가로 = 토큰 35개(오른쪽 끝부터 읽는다) · 세로 = 문장 6개", "Across = 35 tokens (read from the right end) · down = 6 sentences")));
    var grid = K.el("div", "cb-grid");
    grid.setAttribute("aria-hidden", "true");
    var cells = [], cls = [];
    for (var i = 0; i < N; i++) { var c = K.el("i"); grid.appendChild(c); cells.push(c); cls.push(""); }
    root.appendChild(grid);

    var st = K.el("div", "cb-st");
    var lamp = K.el("span", "cb-lamp");
    lamp.appendChild(K.el("b"));
    lamp.appendChild(document.createTextNode(K.t("GPU 기다리는 중", "Waiting on the GPU")));
    var cnt = K.el("span", "tca-num");
    st.appendChild(lamp); st.appendChild(cnt);
    root.appendChild(st);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "92px");
    rows.style.setProperty("--tca-rw", "56px");
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
    rows.appendChild(K.el("div", "tca-note", K.t("64문장 묶음 하나의 단계별 시간(글의 실측)", "Per-phase time for one 64-sentence batch (measured in the post)")));
    var rEnc = row(K.t("인코더", "Encoder"), K.COLORS[0]);
    var rDec = row(K.t("CRF 디코딩", "CRF decoding"), K.COLORS[2]);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "그림은 64문장 중 6문장만 그렸고 속도는 예시다. 글의 묶음은 64문장 × 35토큰쯤이라 값을 하나씩 꺼내면 한 묶음에 2,240번 멈춘다.",
      "Only 6 of the 64 sentences are drawn and the pace is illustrative. The post's batch is about 64 sentences × 35 tokens, so per-value reads stop 2,240 times per batch.")));

    function duration() { return mode === "item" ? N * STEP : COPY + T * COLSTEP; }
    function setCell(k, c) { if (cls[k] !== c) { cls[k] = c; cells[k].className = c; } }

    function render() {
      var syncs, done, waiting, k, r, col;
      if (mode === "item") {
        syncs = Math.min(N, Math.floor(clock / STEP) + 1);
        done = clock < STEP * WAIT ? 0 : Math.min(N, Math.floor((clock - STEP * WAIT) / STEP) + 1);
        waiting = done < syncs;
        for (k = 0; k < N; k++) {
          r = Math.floor(k / T); col = T - 1 - (k % T);
          setCell(r * T + col, k < done ? "on" : (k === syncs - 1 && waiting ? "cur" : ""));
        }
      } else {
        syncs = 1;
        waiting = clock < COPY * 0.6;
        var copied = clock >= COPY;
        var cols = copied ? Math.min(T, Math.floor((clock - COPY) / COLSTEP) + 1) : 0;
        done = cols * R;
        for (k = 0; k < N; k++) {
          col = k % T;
          setCell(k, col >= T - cols ? "on" : (copied ? "cp" : (waiting ? "cur" : "")));
        }
      }
      lamp.className = "cb-lamp" + (waiting ? " lit" : "");
      cnt.textContent = K.t("GPU 동기화 ", "GPU syncs ") + syncs + K.t("회 · 읽은 값 ", " · values read ") + done + " / " + N;
      var dec = mode === "item" ? 271 : 11;
      rEnc.f.style.width = (43 / 320 * 100) + "%"; rEnc.v.textContent = "43ms";
      rDec.f.style.width = (dec / 320 * 100) + "%"; rDec.v.textContent = dec + "ms";
      var txt = mode === "item"
        ? K.t("문장마다·토큰마다 파이썬 루프가 값을 하나씩 꺼낸다. 64문장 요청이 344ms 걸렸다.",
          "A Python loop pulls one value per sentence per token. A 64-sentence request took 344 ms.")
        : K.t("표를 통째로 한 번 가져와 넘파이로 모든 문장을 함께 거꾸로 따라간다. 표가 같으니 태그 줄도 같다. 64문장 요청이 82ms가 됐다.",
          "Copy the whole table once and walk every sentence back together in NumPy. Same table, same tag sequence. The 64-sentence request dropped to 82 ms.");
      if (txt !== last) { read.textContent = txt; last = txt; }
    }

    bAgain.addEventListener("click", function () { clock = 0; hold = 0; render(); });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    if (K.reduce) clock = duration();
    render();
    K.loop(root, function (dt) {
      if (paused) return;
      var d = duration();
      if (clock < d) { clock = Math.min(d, clock + dt); render(); }
      else { hold += dt; if (hold > HOLD) { hold = 0; clock = 0; render(); } }
    });
  });
})();
