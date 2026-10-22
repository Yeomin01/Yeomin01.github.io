/* 「탐지 모델은 라벨이 아니라 확률을 내보내야 한다」 글의 그림: 가드 출력 형식에 따라 게이트웨이가 볼 수 있는 것 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("guardrail-score-not-label-css",
    '.tca[data-demo="score-raw-final"] .sr-mark{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--primary)}' +
    '.tca[data-demo="score-raw-final"] .sr-out{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;' +
    'white-space:pre-wrap;background:var(--code-bg);border-radius:6px;padding:8px 10px;margin:10px 0 0;min-height:3.2em}' +
    '.tca[data-demo="score-raw-final"] .sr-out b{font-weight:600}');

  K.register("score-raw-final", function (root) {
    var GUARD_T = 0.5; // 가드가 권고 판정에 쓰는 gate.json 값
    var st = { raw: 0.93, dom: 0.6, mode: "json", gw: 0.5 };

    K.head(root, K.t("가드가 무엇을 내보내느냐에 따라 게이트웨이가 보는 것", "What the gateway can see, by guard output"),
      K.t("감쇄는 final = raw × (1 − 도메인 점수)² 다. 글의 예(raw 0.93, 도메인 점수 0.60)에서 시작한다. 출력 형식을 바꾸고 게이트웨이 임계값을 움직여 본다.",
        "Dampening is final = raw × (1 − domain score)². It starts from the post's example (raw 0.93, domain score 0.60). Switch the output format and move the gateway threshold."));

    var bar1 = K.el("div", "tca-bar");
    var sRaw = K.slider({ label: K.t("모델 raw 확률", "Model raw prob"), min: 0, max: 1, step: 0.01, value: st.raw,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.raw = v; render(); } });
    var sDom = K.slider({ label: K.t("코딩 도메인 점수", "Coding-domain score"), min: 0, max: 1, step: 0.05, value: st.dom,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.dom = v; render(); } });
    bar1.appendChild(sRaw.el); bar1.appendChild(sDom.el);
    root.appendChild(bar1);

    var bar2 = K.el("div", "tca-bar");
    var bA = K.btn(K.t("예: 모델이 원래 0.15", "Case: model said 0.15"));
    var bB = K.btn(K.t("예: 0.93을 0.15로 깎음", "Case: 0.93 cut to 0.15"));
    bar2.appendChild(bA); bar2.appendChild(bB);
    root.appendChild(bar2);

    var bar3 = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "label", label: K.t("라벨만", "Label only") },
      { value: "tuple", label: K.t("(라벨, 감쇄된 확률)", "(label, dampened prob)") },
      { value: "json", label: K.t("구조화 결과", "Structured result") }
    ], st.mode, function (v) { st.mode = v; render(); }, K.t("가드 출력 형식", "Guard output format"));
    var sGw = K.slider({ label: K.t("게이트웨이 임계값", "Gateway threshold"), min: 0.1, max: 1, step: 0.05, value: st.gw,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.gw = v; render(); } });
    bar3.appendChild(sg.el); bar3.appendChild(sGw.el);
    root.appendChild(bar3);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "92px");
    function row(label, color) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      var m = K.el("div", "sr-mark");
      f.style.background = color;
      tr.appendChild(f); tr.appendChild(m);
      r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v, m: m };
    }
    var rRaw = row("raw_prob", "var(--tca-warn)");
    var rFin = row("final_prob", "var(--tca-accent)");
    root.appendChild(rows);
    root.appendChild(K.el("div", "tca-note", K.t("세로선 = 게이트웨이 임계값", "Vertical line = gateway threshold")));

    var out = K.el("div", "sr-out");
    out.setAttribute("aria-label", K.t("게이트웨이가 받는 값", "What the gateway receives"));
    root.appendChild(out);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "감쇄식과 예시 값(0.93, 0.60, 0.15), 가드의 권고 임계값 0.5는 글 본문에 있다. 임계값 1.0은 글에 나온 퇴화한 thresholds.json 값이다.",
      "The dampening formula, the example values (0.93, 0.60, 0.15) and the guard's advisory threshold 0.5 are from the post. A threshold of 1.0 is the degenerate thresholds.json value it describes.")));

    function render() {
      var fin = st.raw * Math.pow(1 - st.dom, 2);
      var guardLabel = fin >= GUARD_T ? "ATTACK" : "BENIGN";
      rRaw.f.style.width = st.raw * 100 + "%"; rRaw.v.textContent = st.raw.toFixed(2);
      rFin.f.style.width = fin * 100 + "%"; rFin.v.textContent = fin.toFixed(2);
      var gwOn = st.mode !== "label";
      [rRaw, rFin].forEach(function (r) { r.m.style.left = "calc(" + st.gw * 100 + "% - 1px)"; r.m.style.display = gwOn ? "" : "none"; });
      sGw.input.disabled = !gwOn;
      var reason = st.dom > 0 ? '["domain_dampen(' + st.dom.toFixed(2) + ')"]' : "[]";
      if (st.mode === "label") out.textContent = '"' + guardLabel + '"';
      else if (st.mode === "tuple") out.textContent = '("' + guardLabel + '", ' + fin.toFixed(2) + ")";
      else out.textContent = '{\n  "raw_prob":   ' + st.raw.toFixed(2) + ',\n  "final_prob": ' + fin.toFixed(2) +
        ',\n  "decision":   "' + guardLabel + '",\n  "threshold":  ' + GUARD_T.toFixed(1) + ',\n  "reason":     ' + reason + "\n}";

      var gwDec = st.mode === "label" ? guardLabel : (fin >= st.gw ? "ATTACK" : "BENIGN");
      var decTxt = gwDec === "ATTACK" ? K.t("차단", "block") : K.t("통과", "pass");
      var msg;
      if (st.mode === "label") msg = K.t("0/1만 받으니 게이트웨이는 동작점을 옮길 수 없다. 임계값 손잡이가 꺼진다.",
        "With only 0/1 the gateway cannot move its operating point; the threshold control is disabled.");
      else if (st.mode === "tuple") msg = K.t("확률이 " + fin.toFixed(2) + " 하나만 보인다. 모델이 원래 그렇게 봤는지, 깎인 값인지 구분할 수 없다.",
        "Only " + fin.toFixed(2) + " is visible: no way to tell a genuine score from a dampened one.");
      else if (st.dom > 0 && st.raw >= st.gw && fin < st.gw) msg = K.t("모델은 임계값을 넘겼고 가드가 감쇄해 넘지 못했다는 것이 reason과 함께 보인다. 정책에 반영할 수 있다.",
        "The model crossed the threshold and the guard's dampening pulled it back, and the reason says so. Policy can use that.");
      else msg = K.t("raw와 final, 적용한 보정이 함께 보인다.", "Raw, final and the applied correction are all visible.");
      if (gwOn && st.gw >= 1) msg += K.t(" 임계값 1.0에서는 확률이 1.0에 닿지 않는 한 터지지 않는다.", " At 1.0 nothing fires unless the probability reaches 1.0.");
      read.textContent = K.t("게이트웨이 판정: ", "Gateway decision: ") + decTxt + " — " + msg;
    }
    function preset(raw, dom) { st.raw = raw; st.dom = dom; sRaw.set(raw); sDom.set(dom); render(); }
    bA.addEventListener("click", function () { preset(0.15, 0); });
    bB.addEventListener("click", function () { preset(0.93, 0.6); });
    render();
  });
})();
