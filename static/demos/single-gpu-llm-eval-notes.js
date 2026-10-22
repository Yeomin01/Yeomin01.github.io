/* 「단일 GPU에서 4-bit LLM을 평가하며 부딪힌 것들」 글의 그림: 출력 버퍼링, 실행 중인 bash 스크립트의 바이트 위치 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var A = '.tca[data-demo="eval-stdout-buffer"] ';
  var B = '.tca[data-demo="eval-bash-offset"] ';
  var MONO = "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;";
  K.css("single-gpu-llm-eval-notes-css", [
    A + ".sb-lines{" + MONO + "font-size:12px;line-height:1.5;min-height:6em;background:var(--code-bg);border-radius:4px;padding:4px 8px;margin-top:6px;white-space:pre-wrap;word-break:break-all}",
    A + ".sb-lines .dim{color:var(--secondary)}",
    B + ".bo-file{" + MONO + "font-size:12px;line-height:1.6;background:var(--code-bg);border-radius:6px;padding:6px 0;margin:0 0 8px}",
    B + ".bo-file div{display:flex;gap:8px;padding:0 8px}",
    B + ".bo-file .no{flex:none;width:2.6em;text-align:right;color:var(--secondary)}",
    B + ".bo-file .tx{min-width:0;white-space:pre-wrap;word-break:break-all}",
    B + ".bo-file .nx{background:var(--tca-accent);color:#111;border-radius:2px}",
    B + ".bo-file .mk{color:var(--tca-bad);font-weight:700}",
    B + ".bo-file .new{background:var(--tca-warn);color:#111;border-radius:2px}",
    B + ".bo-log{" + MONO + "font-size:12px;line-height:1.5;border:1px solid var(--tertiary);border-radius:6px;padding:6px 8px;min-height:3em;white-space:pre-wrap;word-break:break-all}",
    B + ".bo-log .bad{color:var(--tca-bad)}",
    B + ".bo-log .warn{color:var(--tca-warn)}"
  ].join(""));

  function row(rows, label, color) {
    var r = K.el("div", "tca-row");
    r.appendChild(K.el("div", "tca-row-l", label));
    var t = K.el("div", "tca-track"), fl = K.el("div", "tca-fill");
    fl.style.background = color;
    fl.style.transition = "none";
    t.appendChild(fl);
    var v = K.el("div", "tca-row-r");
    r.appendChild(t); r.appendChild(v);
    rows.appendChild(r);
    return { f: fl, v: v };
  }

  /* ── 1. 출력 버퍼링 ── */
  K.register("eval-stdout-buffer", function (root) {
    var TOTAL = 120, EVERY = 110, BUF = 4096, HOLD = 2600;
    var mode = "buf", paused = K.reduce, k = 0, t = 0, hold = 0, buf = [], bufBytes = 0, file = [], ended = false;

    K.head(root, K.t("진행 줄이 버퍼에 모였다가 한꺼번에 파일로 간다", "Progress lines pile up in a buffer, then reach the file all at once"),
      K.t("평가 스크립트가 배치마다 [N/전체] 를 찍고, 출력은 로그 파일로 간다. 출력이 터미널이 아니면 줄 단위가 아니라 블록 단위로 모았다가 버퍼가 차야 쓴다.",
        "The eval script prints [N/total] per batch and stdout goes to a log file. When stdout is not a terminal, output is collected per block and written only when the buffer fills."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "buf", label: K.t("그대로 print", "Plain print") },
      { value: "flush", label: "print(..., flush=True)" }
    ], mode, function (v) { mode = v; reset(); }, K.t("출력 방식", "How it prints"));
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(sg.el); bar.appendChild(bAgain); bar.appendChild(bPause);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    var b1 = K.el("div", "tca-box"), b2 = K.el("div", "tca-box");
    b1.appendChild(K.el("div", "tca-h", K.t("프로세스 안 버퍼", "Buffer inside the process")));
    var bcap = K.el("div", "tca-note tca-num");
    bcap.style.margin = "0";
    b1.appendChild(bcap);
    var l1 = K.el("div", "sb-lines");
    b1.appendChild(l1);
    b2.appendChild(K.el("div", "tca-h", K.t("로그 파일 (tail -f 로 보는 쪽)", "Log file (what tail -f shows)")));
    var fcap = K.el("div", "tca-note tca-num");
    fcap.style.margin = "0";
    b2.appendChild(fcap);
    var l2 = K.el("div", "sb-lines");
    b2.appendChild(l2);
    two.appendChild(b1); two.appendChild(b2);
    root.appendChild(two);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "104px");
    rows.style.setProperty("--tca-rw", "48px");
    rows.style.marginTop = "12px";
    var rReal = row(rows, K.t("실제 진행률", "Actual progress"), "var(--tca-good)");
    var rLog = row(rows, K.t("로그로 본 진행률", "Progress per the log"), "var(--tca-warn)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t("버퍼 크기 4,096바이트와 배치 120개는 예시 값이다(글: 보통 수 KB). 진행 줄 120개를 다 합쳐도 1KB 남짓이라 버퍼가 끝까지 차지 않는다.",
      "The 4,096-byte buffer and 120 batches are examples (the post says a few KB is typical). All 120 progress lines come to about 1 KB, so the buffer never fills.")));

    function line(n) { return "[" + n + "/" + TOTAL + "]"; }
    function reset() { k = 0; t = 0; hold = 0; buf = []; bufBytes = 0; file = []; ended = false; if (K.reduce) { while (k < TOTAL) emit(); finish(); } render(); }
    function emit() {
      k++;
      var s = line(k);
      if (mode === "flush") { file.push(s); return; }
      if (bufBytes + s.length + 1 > BUF) { file = file.concat(buf); buf = []; bufBytes = 0; }
      buf.push(s); bufBytes += s.length + 1;
    }
    function finish() { ended = true; file = file.concat(buf); buf = []; bufBytes = 0; }
    function tail(arr, n) { return arr.slice(Math.max(0, arr.length - n)).join("\n"); }
    function render() {
      bcap.textContent = K.fmt(bufBytes) + " / " + K.fmt(BUF) + K.t("바이트 · 줄 ", " bytes · lines ") + buf.length;
      l1.textContent = buf.length ? tail(buf, 4) : (mode === "flush" ? K.t("(줄마다 바로 내보낸다)", "(each line goes out at once)") : K.t("(비어 있음)", "(empty)"));
      fcap.textContent = K.t("파일에 쓴 줄 ", "Lines in file ") + file.length;
      l2.textContent = file.length ? tail(file, 4) : K.t("(아직 한 줄도 없다)", "(nothing yet)");
      var logP = file.length ? Math.round(+file[file.length - 1].slice(1).split("/")[0] / TOTAL * 100) : 0;
      var realP = Math.round(k / TOTAL * 100);
      rReal.f.style.width = realP + "%"; rReal.v.textContent = realP + "%";
      rLog.f.style.width = logP + "%"; rLog.v.textContent = logP + "%";
      var txt = ended
        ? (mode === "buf" ? K.t("작업이 끝나며 버퍼를 비웠다. 그제야 120줄이 한꺼번에 파일에 나타났다.", "The job ended and flushed the buffer; only now do all 120 lines appear in the file.")
          : K.t("줄마다 바로 파일에 남았다. 로그를 읽어 퍼센트로 바꾸면 밖에서도 실시간 진행률이 보인다.", "Every line reached the file at once; reading the log gives live progress from outside."))
        : (mode === "buf" ? K.t("작업은 진행 중인데 로그는 멈춘 것처럼 보인다.", "The job is running but the log looks frozen.")
          : K.t("로그가 실제 진행을 그대로 따라간다.", "The log tracks actual progress."));
      if (read.textContent !== txt) read.textContent = txt;
    }
    bAgain.addEventListener("click", reset);
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    reset();
    K.loop(root, function (dt) {
      if (paused) return;
      if (ended) { hold += dt; if (hold > HOLD) reset(); return; }
      t += dt;
      var ch = false;
      while (t >= EVERY && k < TOTAL) { t -= EVERY; emit(); ch = true; }
      if (k >= TOTAL && t >= EVERY * 4) { finish(); ch = true; }
      if (ch) render();
    });
  });

  /* ── 2. 실행 중인 bash 스크립트 ── */
  K.register("eval-bash-offset", function (root) {
    var LINES = ["echo step1", "python train.py --epoch 1", "echo step2", "python eval.py --max_new_tokens 96", "echo step3"];
    var HEADER = "export CUDA_VISIBLE_DEVICES=0\n";
    var text, off, edited, patched, log, trains;

    K.head(root, K.t("bash는 스크립트를 읽어 가며 실행한다", "bash reads the script as it runs"),
      K.t("bash는 파일을 한 번에 읽지 않고, 다음에 읽을 바이트 위치를 기억해 두었다가 거기서부터 한 명령씩 읽는다. 학습이 도는 동안 파일 앞부분을 고쳐 바이트 수가 바뀌면 그 위치가 엉뚱한 곳을 가리킨다.",
        "bash does not load the file at once; it remembers the byte offset to read next and reads one command from there. Edit the front of the file while training runs and the byte counts shift, so the offset points somewhere wrong."));
    var bar = K.el("div", "tca-bar");
    var bNext = K.btn(K.t("다음 명령 읽기", "Read next command"));
    var bEdit = K.btn(K.t("파일 맨 위에 한 줄 추가", "Add a line at the top"));
    var bPatch = K.btn(K.t("eval.py 만 고친다", "Change only eval.py"));
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(bNext); bar.appendChild(bEdit); bar.appendChild(bPatch); bar.appendChild(bAgain);
    root.appendChild(bar);
    var pos = K.el("div", "tca-h tca-num");
    root.appendChild(pos);
    var fileEl = K.el("div", "bo-file");
    root.appendChild(fileEl);
    root.appendChild(K.el("div", "tca-legend", K.t("왼쪽 숫자 = 그 줄이 시작하는 바이트 · 빨간 ▶ = bash가 기억한 위치 · 파란 칸 = 다음에 읽을 명령 · 노란 칸 = 추가한 줄", "Left number = byte where the line starts · red ▶ = bash's remembered offset · blue = next command read · yellow = added line")));
    var logEl = K.el("div", "bo-log");
    logEl.setAttribute("aria-live", "polite");
    logEl.style.marginTop = "8px";
    root.appendChild(logEl);
    root.appendChild(K.el("div", "tca-note", K.t("스크립트는 예시다. 그림은 글의 설명대로 bash가 다음에 읽을 바이트 위치만 기억한다고 두었다. 글자는 전부 1바이트짜리로 썼다.",
      "The script is an example. As the post describes, bash is modelled as remembering only the next byte offset. Every character here is one byte.")));

    function reset() {
      text = LINES.join("\n") + "\n"; off = 0; edited = false; patched = false; trains = 0;
      log = [{ c: "", m: K.t("아직 아무것도 실행하지 않았다.", "Nothing has run yet.") }];
      render();
    }
    function nextCmd() {
      if (off >= text.length) return null;
      var e = text.indexOf("\n", off);
      if (e < 0) e = text.length;
      return { s: off, e: e, cmd: text.slice(off, e) };
    }
    function run(cmd) {
      var w = cmd.trim().split(/\s+/);
      if (w[0] === "echo") return { m: w.slice(1).join(" ") };
      if (w[0] === "export") return { m: K.t("(환경 변수 설정)", "(sets an env var)") };
      if (w[0] === "python" && w[1] === "train.py") {
        trains++;
        return { m: trains > 1 ? K.t("학습이 처음부터 다시 돈다 (", "training starts over (") + trains + K.t("번째)", " runs)") : K.t("학습 실행 중… (오래 걸린다)", "training… (takes a long time)"), cls: trains > 1 ? "bad" : "" };
      }
      if (w[0] === "python" && w[1] === "eval.py") return { m: patched ? K.t("새로 뜬 프로세스라 고친 eval.py 를 읽는다", "a fresh process, so it reads the changed eval.py") : K.t("평가 실행", "evaluation runs") };
      return { m: "bash: " + w[0] + ": command not found", cls: "bad" };
    }
    function render() {
      fileEl.textContent = "";
      var nx = nextCmd(), start = 0;
      text.split("\n").slice(0, -1).forEach(function (ln) {
        var d = K.el("div");
        d.appendChild(K.el("span", "no", String(start)));
        var tx = K.el("span", "tx");
        var end = start + ln.length;
        var isNew = edited && start === 0;
        function piece(a, b, cls) { if (b > a) tx.appendChild(K.el("span", cls, ln.slice(a - start, b - start))); }
        if (off >= start && off <= end && nx) {
          piece(start, off, isNew ? "new" : null);
          tx.appendChild(K.el("span", "mk", "▶"));
          piece(off, end, "nx");
        } else if (off >= start && off <= end) {
          piece(start, end, isNew ? "new" : null);
        } else piece(start, end, isNew ? "new" : null);
        d.appendChild(tx);
        fileEl.appendChild(d);
        start = end + 1;
      });
      if (!nx) { var d2 = K.el("div"); d2.appendChild(K.el("span", "no", String(text.length))); d2.appendChild(K.el("span", "mk", "▶ " + K.t("파일 끝", "end of file"))); fileEl.appendChild(d2); }
      pos.textContent = K.t("bash가 기억한 위치: 바이트 ", "Offset bash remembers: byte ") + off + K.t(" · 파일 크기 ", " · file size ") + text.length + K.t("바이트", " bytes");
      logEl.textContent = "";
      log.slice(-6).forEach(function (x) {
        var d = K.el("div", x.cls || null, (x.c ? "$ " + x.c + "\n  " : "") + x.m);
        logEl.appendChild(d);
      });
      bNext.disabled = !nx;
      bEdit.disabled = edited;
      bPatch.disabled = patched;
    }
    bNext.addEventListener("click", function () {
      var nx = nextCmd();
      if (!nx) return;
      if (log.length === 1 && !log[0].c) log = [];
      off = nx.e + 1;
      if (nx.cmd.trim()) { var r = run(nx.cmd); log.push({ c: nx.cmd, m: r.m, cls: r.cls }); }
      render();
    });
    bEdit.addEventListener("click", function () {
      if (edited) return;
      edited = true;
      text = HEADER + text;
      log.push({ c: "", m: off > 0
        ? K.t("편집기로 맨 위에 30바이트를 넣었다. bash가 기억한 위치(바이트 ", "Inserted 30 bytes at the top. bash's offset (byte ") + off + K.t(")는 그대로라, 이제 줄 한가운데를 가리킨다.", ") did not move, so it now points into the middle of a line.")
        : K.t("아직 아무것도 안 읽었을 때 고친 것이라 문제가 없다.", "Nothing had been read yet, so this edit is harmless."), cls: off > 0 ? "warn" : "" });
      render();
    });
    bPatch.addEventListener("click", function () {
      if (patched) return;
      patched = true;
      log.push({ c: "", m: K.t("스크립트 파일은 그대로다. eval.py 단계가 오면 새로 뜨는 프로세스가 바뀐 코드를 읽는다.", "The script file is untouched. When the eval.py step comes, the new process reads the changed code.") });
      render();
    });
    bAgain.addEventListener("click", reset);
    reset();
  });
})();
