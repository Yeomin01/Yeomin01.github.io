/* 「프로세스를 늘릴까, 스레드를 늘릴까」 글의 그림: 요청 크기에 따라 천장이 GIL에서 코어로 바뀐다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="procs-ceiling"] ';
  K.css("more-processes-or-more-threads-css", [
    S + ".pc-stack{display:flex;height:22px;border-radius:4px;overflow:hidden;background:var(--code-bg);margin:4px 0 2px}",
    S + ".pc-stack div{height:100%;transition:width .35s ease;color:#111;font-size:11.5px;line-height:22px;padding:0 6px;white-space:nowrap;overflow:hidden}",
    S + ".pc-cap{font-size:12.5px;color:var(--secondary)}",
    S + ".pc-procs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}",
    S + ".pc-procs span{display:inline-flex;align-items:center;gap:4px;font-size:12px;border:1px solid var(--tertiary);border-radius:5px;padding:2px 7px}",
    S + ".pc-procs i{display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--tca-warn)}",
    "@media (prefers-reduced-motion:reduce){" + S + ".pc-stack div{transition:none}}"
  ].join(""));

  K.register("procs-ceiling", function (root) {
    var PY = 10, NAT = 20, CORES = 8;
    var n = 1, P = 1;

    K.head(root, K.t("요청 크기를 바꾸면 천장이 바뀐다", "Request size moves the ceiling"),
      K.t("요청 하나는 파이썬 구간(GIL을 쥔다)과 네이티브 연산(GIL을 놓는다)으로 나뉜다. 파이썬 구간은 한 프로세스에서 한 번에 하나만 돌고, 네이티브 연산은 코어를 나눠 쓴다. 처리량은 둘 중 먼저 차는 쪽이 정한다.",
        "A request splits into a Python section (holds the GIL) and native compute (releases it). The Python section runs one at a time per process; native compute shares the cores. Whichever fills first sets the throughput."));

    var bar = K.el("div", "tca-bar");
    var sN = K.slider({ label: K.t("요청의 문장 수", "Sentences per request"), min: 1, max: 32, step: 1, value: n,
      fmt: function (v) { return v + K.t("문장", ""); }, onInput: function (v) { n = v; render(); } });
    var sP = K.slider({ label: K.t("프로세스 수", "Processes"), min: 1, max: 6, step: 1, value: P,
      onInput: function (v) { P = v; render(); } });
    var b1 = K.btn(K.t("1문장", "1 sentence")), b16 = K.btn(K.t("16문장", "16 sentences"));
    bar.appendChild(sN.el); bar.appendChild(sP.el); bar.appendChild(b1); bar.appendChild(b16);
    root.appendChild(bar);

    root.appendChild(K.el("div", "pc-cap", K.t("요청 하나의 시간", "Time for one request")));
    var stack = K.el("div", "pc-stack");
    var dPy = K.el("div"), dNat = K.el("div");
    dPy.style.background = "var(--tca-bad)"; dNat.style.background = K.COLORS[0];
    stack.appendChild(dPy); stack.appendChild(dNat);
    root.appendChild(stack);
    var stackTxt = K.el("div", "pc-cap tca-num");
    root.appendChild(stackTxt);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "100px");
    rows.style.setProperty("--tca-rw", "76px");
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
      return { f: fl, v: v, l: r.firstChild };
    }
    var rGil = row(K.t("GIL 천장", "GIL ceiling"), "var(--tca-bad)");
    var rCore = row(K.t("코어 천장", "Core ceiling"), K.COLORS[0]);
    var rOut = row(K.t("처리량", "Throughput"), "var(--tca-good)");
    root.appendChild(rows);
    var procs = K.el("div", "pc-procs");
    root.appendChild(procs);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "예시 값: 파이썬 구간 10ms(1문장 요청에서 프로세스 하나가 초당 100건 언저리에서 멈췄다는 글의 실측에 맞춤), 문장당 네이티브 20ms, 코어 8개, 스레드는 충분. 16문장이면 파이썬 몫이 3%로 글의 '97%가 인코더'와 비슷해진다. GIL 천장 = 프로세스 수 ÷ 파이썬 시간, 코어 천장 = 코어 수 ÷ 요청 시간으로 단순화했다.",
      "Example values: 10 ms of Python (matching the post's single process stalling near 100/s on 1-sentence requests), 20 ms native per sentence, 8 cores, enough threads. At 16 sentences Python is 3%, close to the post's '97% encoder'. GIL ceiling = processes ÷ Python time; core ceiling = cores ÷ request time.")));

    function render() {
      var tot = PY + NAT * n;
      var pyShare = PY / tot;
      dPy.style.width = (pyShare * 100) + "%";
      dNat.style.width = ((1 - pyShare) * 100) + "%";
      dPy.textContent = pyShare > 0.12 ? K.t("파이썬", "Python") : "";
      dNat.textContent = K.t("네이티브", "Native");
      stackTxt.textContent = K.t("파이썬 ", "Python ") + PY + "ms · " + K.t("네이티브 ", "native ") + (NAT * n) + "ms · " +
        K.t("파이썬 몫 ", "Python share ") + Math.round(pyShare * 100) + "%";
      var gil = P * 1000 / PY, core = CORES * 1000 / tot, out = Math.min(gil, core);
      var mx = Math.max(gil, core);
      function set(r, v) {
        r.f.style.width = (v / mx * 100) + "%";
        r.v.textContent = K.fmt(v, v < 100 ? 1 : 0) + K.t("건/초", "/s");
      }
      set(rGil, gil); set(rCore, core); set(rOut, out);
      rGil.l.textContent = K.t("GIL 천장 ×", "GIL ceiling ×") + P;
      procs.textContent = "";
      for (var i = 0; i < P; i++) {
        var s = K.el("span");
        s.appendChild(K.el("i"));
        s.appendChild(document.createTextNode(K.t("프로세스 ", "Process ") + (i + 1) + K.t(" · 모델 한 벌", " · one model copy")));
        procs.appendChild(s);
      }
      var sent = K.fmt(out * n, 0);
      read.textContent = (gil < core
        ? K.t("천장은 GIL이다. 코어가 남는데 파이썬 구간이 한 줄로 선다. 프로세스를 늘리면 처리량이 는다.",
          "The GIL is the ceiling: cores sit idle while the Python section queues single file. More processes add throughput.")
        : K.t("천장은 코어다. 스레드가 이미 코어를 채우고 있어 프로세스를 늘려도 처리량은 그대로이고 모델 사본만 늘어난다.",
          "The cores are the ceiling: threads already fill them, so more processes add only model copies, not throughput.")) +
        K.t(" 지금 상한은 초당 ", " Current limit: ") + K.fmt(out, out < 100 ? 1 : 0) + K.t("건(", "/s (") + sent + K.t("문장)이다.", " sentences/s).");
    }
    b1.addEventListener("click", function () { n = 1; sN.set(1); render(); });
    b16.addEventListener("click", function () { n = 16; sN.set(16); render(); });
    render();
  });
})();
