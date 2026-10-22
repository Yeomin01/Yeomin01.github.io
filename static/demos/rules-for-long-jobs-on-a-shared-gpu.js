/* 「공유 GPU 서버에서 오래 도는 작업의 규칙」 글의 그림: 상태 파일로 이어서 하기와 감시자 규칙 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("rules-for-long-jobs-on-a-shared-gpu-css", [
    '.tca[data-demo="watchdog-rules"] .wd-st{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.tca[data-demo="watchdog-rules"] .wd-s{border:1px solid var(--tertiary);border-radius:6px;padding:6px;font-size:12.5px;text-align:center;min-width:0}',
    '.tca[data-demo="watchdog-rules"] .wd-s[data-k="run"]{border-color:var(--tca-accent);box-shadow:inset 0 0 0 1px var(--tca-accent)}',
    '.tca[data-demo="watchdog-rules"] .wd-s[data-k="done"]{background:var(--code-bg)}',
    '.tca[data-demo="watchdog-rules"] .wd-info{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}',
    '.tca[data-demo="watchdog-rules"] .wd-log{margin:10px 0 0;padding:6px 8px;border-radius:6px;background:var(--code-bg);font-family:ui-monospace,monospace;font-size:12px;min-height:7.5em}',
    '.tca[data-demo="watchdog-rules"] .wd-log div{white-space:normal}'
  ].join(""));

  K.register("watchdog-rules", function (root) {
    var STAGES = [K.t("데이터 준비", "Prepare data"), K.t("학습", "Train"), K.t("평가", "Evaluate"), K.t("산출물 정리", "Package")];
    var TICKS_PER_STAGE = 2, CAP = 3, STOP_AT = 30;
    var scen = "crash", samePath = false, capOn = false, playing = !K.reduce, S;

    K.head(root, K.t("감시자가 5분마다 확인한다", "The watchdog checks every 5 minutes"),
      K.t("한 칸이 감시자의 확인 한 번(5분)이다. 감시 경로와 재시작 상한을 켜고 끄며 돌려 보면, 정상 종료한 작업이 끝없이 다시 뜨는 조건과 멈추는 조건이 보인다.",
        "One tick is one watchdog check (5 minutes). Toggle the watch path and the restart cap to see when a job that finished cleanly keeps being relaunched, and when it stops."));

    var bar = K.el("div", "tca-bar");
    var bPlay = K.btn(playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    var sScen = K.seg([
      { value: "crash", label: K.t("중간에 한 번 죽음", "Dies once midway") },
      { value: "clean", label: K.t("정상 종료", "Finishes cleanly") }
    ], scen, function (v) { scen = v; reset(); }, K.t("시나리오", "Scenario"));
    bar.appendChild(bPlay); bar.appendChild(bReset); bar.appendChild(sScen.el);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var bPath = K.btn(K.t("감시 경로 = 출력 경로", "Watch path = output path"), samePath);
    var bCap = K.btn(K.t("재시작 상한 3회", "Restart cap of 3"), capOn);
    bar2.appendChild(bPath); bar2.appendChild(bCap);
    root.appendChild(bar2);

    var st = K.el("div", "wd-st");
    var stEls = STAGES.map(function (n, i) { var e = K.el("div", "wd-s"); st.appendChild(e); return e; });
    root.appendChild(st);
    var info = K.el("div", "wd-info");
    var tState = K.el("span", "tca-tag"), tMaster = K.el("span", "tca-tag"), tMark = K.el("span", "tca-tag"), tRe = K.el("span", "tca-tag");
    info.appendChild(tState); info.appendChild(tMaster); info.appendChild(tMark); info.appendChild(tRe);
    root.appendChild(info);
    var log = K.el("div", "wd-log");
    root.appendChild(log);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "학습 출력은 네트워크 스토리지에 쓴다. 감시 경로를 끄면 감시자는 로컬 로그에서 완료 표시를 찾는다(본문의 예전 사고). 단계 길이, 죽는 시점, 다시 띄운 마스터가 곧 끝나는 것은 그림을 위한 가정이다.",
      "Training writes to network storage. With the watch path off, the watchdog looks for the completion mark in a local log (the old incident in the post). Stage lengths, the crash time and the relaunched master exiting soon are assumptions for the figure.")));

    function reset() {
      S = { t: 0, state: 0, stage: 0, prog: 0, alive: true, mark: false, restarts: 0, crashed: false, rerun: false, end: null, lines: [] };
      addLine(K.t("마스터 시작 (setsid · disown)", "master started (setsid · disown)"));
      draw();
    }
    function addLine(s) { S.lines.push(S.t * 5 + K.t("분 · ", "min · ") + s); if (S.lines.length > 6) S.lines.shift(); }
    function masterStep() {
      if (!S.alive) return;
      if (S.rerun) { // 이미 끝난 학습을 다시 재개한 경우: 곧 끝난다
        S.alive = false; S.rerun = false;
        addLine(K.t("마스터: 이미 끝난 작업을 다시 띄움 → 곧 종료", "master: relaunched a finished job → exits soon"));
        return;
      }
      S.prog++;
      if (scen === "crash" && !S.crashed && S.stage === 1 && S.prog === 1) {
        S.alive = false; S.crashed = true;
        addLine(K.t("마스터가 학습 도중 죽었다", "master died during training"));
        return;
      }
      if (S.prog >= TICKS_PER_STAGE) {
        S.prog = 0; S.stage++; S.state = S.stage;
        addLine(K.t("단계 " + S.stage + " 끝 → 상태 파일 = " + S.stage, "stage " + S.stage + " done → state file = " + S.stage));
        if (S.stage >= STAGES.length) {
          S.alive = false; S.mark = true;
          addLine(K.t("완료 표시를 네트워크 스토리지에 쓰고 종료", "wrote completion mark to network storage, exited"));
        }
      }
    }
    function watchdog() {
      var seen = S.mark && samePath;
      if (seen) { S.end = "done"; addLine(K.t("감시자: 출력 경로에 완료 표시 → 감시 종료", "watchdog: completion mark found → stop watching")); return; }
      if (S.alive) { addLine(K.t("감시자: 살아 있음", "watchdog: alive")); return; }
      if (capOn && S.restarts >= CAP) {
        S.end = "fail"; addLine(K.t("감시자: 상한 3회 초과 → FAIL_LOOP 기록, 정지", "watchdog: cap of 3 exceeded → FAIL_LOOP, stop"));
        return;
      }
      S.restarts++;
      S.alive = true;
      if (S.mark) { S.rerun = true; addLine(K.t("감시자: 완료 표시 못 봄 → 비정상 종료로 판단, 재시작 " + S.restarts, "watchdog: no mark seen → judged a crash, restart " + S.restarts)); }
      else { S.stage = S.state; S.prog = 0; addLine(K.t("감시자: 죽음 → 재시작 " + S.restarts + ", 상태 파일 " + S.state + " → 단계 " + (S.state + 1) + "부터", "watchdog: dead → restart " + S.restarts + ", state " + S.state + " → from stage " + (S.state + 1))); }
      if (!capOn && S.restarts >= STOP_AT) S.end = "loop";
    }
    function tick() {
      if (S.end) return;
      S.t++;
      masterStep();
      watchdog();
      draw();
    }
    function draw() {
      stEls.forEach(function (e, i) {
        var k = i < S.state ? "done" : (i === S.stage && S.alive && S.stage < STAGES.length ? "run" : "wait");
        e.setAttribute("data-k", k);
        e.textContent = (i + 1) + ". " + STAGES[i] + " · " + (k === "done" ? K.t("끝", "done") : k === "run" ? K.t("진행", "running") : K.t("대기", "waiting"));
      });
      tState.textContent = K.t("상태 파일 ", "state file ") + (S.state >= STAGES.length ? "DONE" : S.state);
      tMaster.textContent = K.t("마스터 ", "master ") + (S.alive ? K.t("살아 있음", "alive") : K.t("없음", "gone"));
      tMark.textContent = K.t("완료 표시 ", "completion mark ") + (S.mark ? K.t("있음 (네트워크 스토리지)", "present (network storage)") : K.t("없음", "absent"));
      tRe.textContent = K.t("재시작 ", "restarts ") + S.restarts + K.t("회", "");
      tRe.className = "tca-tag" + (S.restarts > CAP ? " tca-bad" : "");
      log.textContent = "";
      S.lines.forEach(function (l) { log.appendChild(K.el("div", null, l)); });
      var where = samePath ? K.t("감시 경로: 네트워크 스토리지", "watching: network storage") : K.t("감시 경로: 로컬 로그", "watching: local log");
      if (S.end === "done") { read.className = "tca-read tca-good"; read.textContent = K.t("정상 완료로 판정했다. ", "Judged complete. ") + where + "."; }
      else if (S.end === "fail") { read.className = "tca-read tca-warn"; read.textContent = K.t("재시작 3회 뒤 멈추고 사람을 부른다. 완료 표시를 못 본 원인은 감시 경로다. ", "Stopped after 3 restarts and calls a person. The missed mark comes from the watch path. ") + where + "."; }
      else if (S.end === "loop") { read.className = "tca-read tca-bad"; read.textContent = K.t("재시작 " + S.restarts + "회. 상한이 없으면 이 반복은 끝나지 않는다. ", S.restarts + " restarts. Without a cap this never ends. ") + where + "."; }
      else { read.className = "tca-read"; read.textContent = (S.t * 5) + K.t("분 경과 · ", " min · ") + where; }
    }
    var acc = 0;
    K.loop(root, function (dt) {
      if (!playing || S.end) return;
      acc += dt;
      if (acc >= 650) { acc = 0; tick(); }
    });
    bPlay.addEventListener("click", function () {
      if (S.end) reset();
      playing = !playing;
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    });
    bReset.addEventListener("click", reset);
    bPath.addEventListener("click", function () { samePath = !samePath; K.press(bPath, samePath); reset(); });
    bCap.addEventListener("click", function () { capOn = !capOn; K.press(bCap, capOn); reset(); });
    reset();
  });
})();
