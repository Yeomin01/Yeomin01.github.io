/* 「쓰지도 않는 명단 1GB를 프로세스마다 올리고 있었다」 글의 그림: 플래그보다 먼저 올리는 명단과 그 곱셈 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="list-preload"] ';
  K.css("a-list-loaded-for-nothing-css", [
    S + ".lp-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;background:var(--code-bg);border-radius:6px;padding:8px 0;margin:0 0 10px}",
    S + ".lp-code div{padding:0 10px;white-space:pre-wrap;word-break:break-all;border-left:3px solid transparent;transition:background .2s}",
    S + ".lp-code div.now{background:var(--entry);border-left-color:var(--tca-accent)}",
    S + ".lp-code div.load{border-left-color:var(--tca-warn)}",
    S + ".lp-code div.skip{opacity:.45}",
    S + ".lp-grid{display:grid;gap:4px;margin:6px 0 0;max-width:420px}",
    S + ".lp-grid div{border:1px solid var(--tertiary);border-radius:4px;padding:2px 3px;font-size:11px;text-align:center;line-height:1.3}",
    S + ".lp-grid div.idle{background:var(--tca-warn);color:#111;border-color:var(--tca-warn)}",
    S + ".lp-grid div.used{background:var(--tca-accent);color:#111;border-color:var(--tca-accent)}"
  ].join(""));

  K.register("list-preload", function (root) {
    var CODE = {
      before: [
        ["def filter_listed_org(spans, check_list=True):"],
        ["    _preload_org_list()   " + K.t("# 플래그보다 먼저 올린다", "# loads before the flag"), "load"],
        ["    if not check_list:"],
        ["        return spans", "ret"],
        ["    ...                   " + K.t("# 명단으로 확인한다", "# check against the list")]
      ],
      after: [
        ["def filter_listed_org(spans, check_list=True):"],
        ["    if not check_list:"],
        ["        return spans", "ret"],
        ["    ...                   " + K.t("# 확인할 때 여기서 명단을 올린다", "# loads the list here when checking"), "load"]
      ]
    };
    var PATH = { before: { off: [0, 1, 2, 3], on: [0, 1, 2, 4] }, after: { off: [0, 1, 2], on: [0, 1, 3] } };
    var BASE = 39, LOADED = 1117, MAXMB = 1200, LINE_MS = 650;
    var ver = "before", flag = "off", w = 4, rep = 3;
    var running = false, pi = -1, tAcc = 0, mem = BASE, loaded = false;

    K.head(root, K.t("플래그를 보기 전에 올리면", "Loading before the flag is checked"),
      K.t("지금 파이프라인은 이 함수를 확인 기능을 끈 채(check_list=False) 부른다. '한 번 호출'을 누르면 실행되는 줄을 따라가며 프로세스 메모리가 어떻게 되는지 보인다.",
        "The pipeline now calls this function with checking off (check_list=False). Press 'Call once' to follow the lines that run and watch process memory."));

    var bar = K.el("div", "tca-bar");
    var sV = K.seg([{ value: "before", label: K.t("고치기 전", "Before the fix") }, { value: "after", label: K.t("고친 뒤", "After the fix") }], ver,
      function (v) { ver = v; reset(); }, K.t("코드", "Code"));
    var sF = K.seg([{ value: "off", label: "check_list=False" }, { value: "on", label: "check_list=True" }], flag,
      function (v) { flag = v; reset(); }, K.t("플래그", "Flag"));
    var bCall = K.btn(K.t("한 번 호출", "Call once"));
    bar.appendChild(sV.el); bar.appendChild(sF.el); bar.appendChild(bCall);
    root.appendChild(bar);

    var code = K.el("div", "lp-code");
    root.appendChild(code);
    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "92px");
    rows.style.setProperty("--tca-rw", "72px");
    var r = K.el("div", "tca-row");
    r.appendChild(K.el("div", "tca-row-l", K.t("프로세스 메모리", "Process memory")));
    var tr = K.el("div", "tca-track"), fl = K.el("div", "tca-fill");
    fl.style.background = "var(--tca-warn)";
    tr.appendChild(fl);
    var mv = K.el("div", "tca-row-r");
    r.appendChild(tr); r.appendChild(mv);
    rows.appendChild(r);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    var bar2 = K.el("div", "tca-bar");
    bar2.style.margin = "14px 0 4px";
    var sW = K.slider({ label: K.t("워커", "Workers"), min: 1, max: 8, step: 1, value: w, onInput: function (v) { w = v; renderGrid(); } });
    var sR = K.slider({ label: K.t("레플리카", "Replicas"), min: 1, max: 6, step: 1, value: rep, onInput: function (v) { rep = v; renderGrid(); } });
    bar2.appendChild(sW.el); bar2.appendChild(sR.el);
    root.appendChild(bar2);
    root.appendChild(K.el("div", "tca-note", K.t("칸 하나 = 이 함수를 부르는 프로세스 하나. 가로 = 워커, 세로 = 레플리카. 노랑 = 쓰지 않는 명단, 파랑 = 쓰는 명단.",
      "One cell = one process calling this function. Across = workers, down = replicas. Yellow = unused list, blue = list in use.")));
    var grid = K.el("div", "lp-grid");
    grid.setAttribute("aria-hidden", "true");
    root.appendChild(grid);
    var read2 = K.el("div", "tca-read");
    read2.setAttribute("aria-live", "polite");
    root.appendChild(read2);
    root.appendChild(K.el("div", "tca-note", K.t(
      "글의 실측: import 직후 39MB, 고치기 전 끈 채로 한 번 호출 1,117MB, 고친 뒤 39MB. 명단은 376만 건, 1GB다. 서빙 컨테이너는 2,383MB에서 1,662MB로 줄었다. 켜고 부를 때의 메모리는 재지 않아 '명단을 올림'으로만 적었다.",
      "Measured: 39 MB after import, 1,117 MB after one call with checking off before the fix, 39 MB after it. The list is 3.76 M entries, 1 GB. The serving container went from 2,383 MB to 1,662 MB. Memory with checking on was not measured, so it is only marked as 'list loaded'.")));

    var lineEls = [];
    function reset() {
      running = false; pi = -1; tAcc = 0; mem = BASE; loaded = false;
      code.textContent = "";
      lineEls = CODE[ver].map(function (l) { var d = K.el("div", null, l[0]); code.appendChild(d); return d; });
      render(); renderGrid();
    }
    function render() {
      var path = PATH[ver][flag];
      lineEls.forEach(function (d, i) {
        var at = pi >= 0 ? path[pi] : -1;
        var visited = pi >= 0 && path.slice(0, pi + 1).indexOf(i) >= 0;
        var done = !running && pi >= path.length - 1;
        d.className = (i === at && running ? "now" : "") + (visited && CODE[ver][i][1] === "load" ? " load" : "") +
          (done && path.indexOf(i) < 0 ? " skip" : "");
      });
      fl.style.width = (mem / MAXMB * 100) + "%";
      mv.textContent = loaded && flag === "on" ? K.t("39MB+명단", "39MB+list") : K.fmt(mem, 0) + "MB";
      bCall.disabled = running;
      var txt;
      if (pi < 0) txt = K.t("import 직후. 명단은 아직 없다.", "Right after import. No list yet.");
      else if (running) txt = K.t("실행 중…", "Running…");
      else if (!loaded) txt = K.t("플래그를 먼저 보고 바로 돌아왔다. 명단은 올라가지 않았다(모듈의 명단 객체가 None 으로 남는다).", "Checked the flag first and returned. No list was loaded (the module's list object stays None).");
      else if (flag === "off") txt = K.t("확인을 끈 채 불렀는데 명단 1GB가 올라갔다. 쓰지 않는 명단이 이 프로세스에 상주한다.", "Called with checking off, yet the 1 GB list was loaded and now sits unused in the process.");
      else txt = K.t("확인을 켜고 불렀으니 명단을 올리는 것이 맞다.", "Checking is on, so loading the list is correct.");
      if (read.textContent !== txt) read.textContent = txt;
    }
    function renderGrid() {
      var n = w * rep, holds = ver === "before" || flag === "on", idle = ver === "before" && flag === "off";
      grid.style.gridTemplateColumns = "repeat(" + w + ",minmax(0,1fr))";
      if (grid.childElementCount !== n) {
        grid.textContent = "";
        for (var i = 0; i < n; i++) grid.appendChild(K.el("div"));
      }
      Array.prototype.forEach.call(grid.children, function (d, i) {
        d.className = holds ? (idle ? "idle" : "used") : "";
        d.textContent = holds ? "1GB" : "—";
      });
      read2.textContent = idle
        ? K.t("쓰지 않는 명단 ", "Unused list: ") + n + "GB (" + K.t("워커 ", "") + w + " × " + K.t("레플리카 ", "") + rep + " × 1GB" + K.t(") — 컨테이너 메모리 한도와 인스턴스 크기가 그만큼 커진다.", ") — memory limits and instance size grow with it.")
        : holds ? K.t("확인을 켜면 프로세스마다 명단이 필요하다. 쓰는 메모리다.", "With checking on every process needs the list; this memory is in use.")
          : K.t("쓰지 않는 명단 0GB. 프로세스를 늘려도 곱해질 것이 없다.", "Unused list: 0 GB. Nothing multiplies as processes are added.");
    }
    bCall.addEventListener("click", function () {
      if (running) return;
      running = true; pi = 0; tAcc = 0; mem = BASE; loaded = false;
      render();
    });
    reset();
    K.loop(root, function (dt) {
      if (!running) return;
      tAcc += dt;
      if (tAcc < LINE_MS) return;
      tAcc = 0;
      var path = PATH[ver][flag];
      if (pi < path.length - 1) {
        pi++;
        if (CODE[ver][path[pi]][1] === "load") { loaded = true; mem = LOADED; }
      } else running = false;
      render();
    });
  });
})();
