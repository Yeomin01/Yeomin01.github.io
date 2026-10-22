/* 「생성기와 검증기가 같은 실수를 공유했다」 글의 그림: +2 가 빠진 생성기와 검증기를 맞물리면 100% 와 0% 가 동시에 나온다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("gv-pair", function (root) {
    var W = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
    function ours(d) { var s = 0; for (var i = 0; i < 12; i++) s += d[i] * W[i]; return { s: s, r: s % 11, c: (11 - s % 11) % 10 }; }
    function spec(d) { var o = ours(d); return (o.c + 2) % 10; }
    var seed = 20260820;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    function digits() { var d = []; for (var i = 0; i < 12; i++) d.push(Math.floor(rnd() * 10)); return d; }

    K.css("the-generator-and-the-validator-shared-a-bug-css", [
      '.tca[data-demo="gv-pair"] .gv-d{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:2px;max-width:420px;text-align:center}',
      '.tca[data-demo="gv-pair"] .gv-d span{font-variant-numeric:tabular-nums;border-radius:3px;padding:2px 0}',
      '.tca[data-demo="gv-pair"] .gv-d .dg{background:var(--code-bg);font-weight:600;font-size:14px}',
      '.tca[data-demo="gv-pair"] .gv-d .ck{border:1.5px solid var(--tca-accent)}',
      '.tca[data-demo="gv-pair"] .gv-d .wt{font-size:12px;color:var(--secondary)}',
      '.tca[data-demo="gv-pair"] .gv-calc{font-size:13px;margin:6px 0 10px;font-variant-numeric:tabular-nums}',
      '.tca[data-demo="gv-pair"] .gv-m{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);gap:4px;font-size:12.5px}',
      '.tca[data-demo="gv-pair"] .gv-m>div{padding:6px 8px;border-radius:5px;border:1px solid var(--tertiary);min-width:0}',
      '.tca[data-demo="gv-pair"] .gv-m .hd{border:0;color:var(--secondary);padding:0 4px}',
      '.tca[data-demo="gv-pair"] .gv-m .on{border:2px solid var(--primary)}',
      '.tca[data-demo="gv-pair"] .gv-m b{display:block;font-size:15px;font-variant-numeric:tabular-nums}'
    ].join(""));

    K.head(root, K.t("+2 하나가 빠진 생성기와 검증기", "A generator and validator both missing +2"),
      K.t("두 줄의 번호가 계속 만들어진다. 위는 우리 생성기(+2 없음), 아래는 명세대로(+2) 만든 것이다. 두 검증기가 각각 몇 %를 통과시키는지 쌓인다.",
        "Numbers keep coming: ours (no +2) and spec (+2). Each validator's pass rate accumulates."));

    var useV = "ours", playing = !K.reduce, show = "ours";
    var bar = K.el("div", "tca-bar");
    bar.appendChild(K.el("span", "tca-lbl", K.t("파이프라인이 쓰는 검증기", "Validator in the pipeline")));
    var segV = K.seg([
      { value: "ours", label: K.t("우리 코드(+2 없음)", "Our code (no +2)") },
      { value: "spec", label: K.t("공개 명세(+2)", "Public spec (+2)") }
    ], useV, function (v) { useV = v; paint(); }, K.t("검증기", "Validator"));
    bar.appendChild(segV.el);
    var bPlay = K.btn(playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"), playing);
    var bOne = K.btn(K.t("한 건 더", "One more"));
    bar.appendChild(bPlay); bar.appendChild(bOne);
    root.appendChild(bar);

    var srcBar = K.el("div", "tca-bar");
    srcBar.style.margin = "0 0 6px";
    srcBar.appendChild(K.el("span", "tca-lbl", K.t("아래 계산을 볼 번호", "Show the calculation for")));
    var segS = K.seg([
      { value: "ours", label: K.t("우리 생성기", "Our generator") },
      { value: "spec", label: K.t("명세대로 만든 번호", "Spec-made number") }
    ], show, function (v) { show = v; paintCalc(); }, K.t("번호", "Number"));
    srcBar.appendChild(segS.el);
    root.appendChild(srcBar);

    var dRow = K.el("div", "gv-d");
    dRow.setAttribute("aria-hidden", "true");
    var dg = [], wt = [];
    for (var i = 0; i < 13; i++) { var e = K.el("span", "dg" + (i === 12 ? " ck" : ""), ""); dRow.appendChild(e); dg.push(e); }
    for (var j = 0; j < 13; j++) { var w = K.el("span", "wt", j < 12 ? "×" + W[j] : ""); dRow.appendChild(w); wt.push(w); }
    root.appendChild(dRow);
    var calc = K.el("div", "gv-calc");
    root.appendChild(calc);

    var m = K.el("div", "gv-m");
    ["", K.t("우리 검증기 (+2 없음)", "Our validator (no +2)"), K.t("명세 검증기 (+2)", "Spec validator (+2)")].forEach(function (h) { m.appendChild(K.el("div", "hd", h)); });
    var cellEls = {};
    [["ours", K.t("우리 생성기가 만든 합성 데이터", "Synthetic data from our generator")], ["spec", K.t("명세대로 만든 실제 형식 번호", "Real-format numbers (spec)")]].forEach(function (row) {
      m.appendChild(K.el("div", "hd", row[1]));
      ["ours", "spec"].forEach(function (v) {
        var c = K.el("div", ""), b = K.el("b", "", "—"), s = K.el("span", "", "");
        c.appendChild(b); c.appendChild(s); m.appendChild(c);
        cellEls[row[0] + "|" + v] = { c: c, b: b, s: s };
      });
    });
    root.appendChild(m);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "숫자열은 무작위로 만든 것이고 실제 번호가 아니다. 생년월일·세기코드 검사는 빼고 체크섬만 본다. 가중치와 (11 − 합 % 11) % 10, 그리고 +2 는 본문의 공식이다(10을 넘으면 일의 자리를 쓴다).",
      "Digits are random, not real numbers. Only the checksum is checked (no date or century code). Weights, (11 − sum % 11) % 10 and the +2 follow the post (taking the last digit).")));

    var cnt = { "ours|ours": [0, 0], "ours|spec": [0, 0], "spec|ours": [0, 0], "spec|spec": [0, 0] };
    var last = {};
    function add() {
      var a = digits(), b = digits();
      var na = a.concat([ours(a).c]), nb = b.concat([spec(b)]);
      last = { ours: na, spec: nb };
      [["ours", na], ["spec", nb]].forEach(function (x) {
        var d = x[1], chk = d[12];
        var pOurs = ours(d).c === chk, pSpec = spec(d) === chk;
        cnt[x[0] + "|ours"][1]++; if (pOurs) cnt[x[0] + "|ours"][0]++;
        cnt[x[0] + "|spec"][1]++; if (pSpec) cnt[x[0] + "|spec"][0]++;
      });
      paint(); paintCalc();
    }
    function pct(c) { return c[1] ? Math.round(100 * c[0] / c[1]) + "%" : "—"; }
    function paint() {
      for (var k in cellEls) {
        var c = cnt[k], e = cellEls[k];
        e.b.textContent = pct(c);
        e.s.textContent = K.t("통과 ", "pass ") + K.fmt(c[0]) + " / " + K.fmt(c[1]);
        e.c.className = (k.split("|")[1] === useV ? "on " : "") + (c[1] ? (c[0] === c[1] ? "tca-good" : c[0] === 0 ? "tca-bad" : "") : "");
      }
      var syn = cnt["ours|" + useV], real = cnt["spec|" + useV];
      read.textContent = K.t("지금 파이프라인 — 합성 데이터 유효율 ", "Pipeline now — synthetic validity ") + pct(syn) +
        K.t(" · 실제 형식 탐지율 ", " · real-format detection ") + pct(real) +
        (useV === "ours" ? K.t(" (라운드트립 테스트는 초록불)", " (round-trip test is green)") : K.t(" (기존 합성 데이터를 다시 판정하면 걸러진다)", " (old synthetic data now fails)"));
    }
    function paintCalc() {
      var d = last[show];
      if (!d) return;
      for (var i = 0; i < 13; i++) dg[i].textContent = String(d[i]);
      var o = ours(d), sp = (o.c + 2) % 10;
      calc.textContent = K.t("합 = ", "sum = ") + o.s + " · " + K.t("합 % 11 = ", "sum % 11 = ") + o.r +
        K.t(" · 우리 코드 (11 − ", " · ours (11 − ") + o.r + ") % 10 = " + o.c +
        K.t(" · 명세 +2 → ", " · spec +2 → ") + sp + K.t(" · 붙은 검사 자리(테두리 칸) ", " · check digit (outlined) ") + d[12];
    }
    bPlay.addEventListener("click", function () { playing = !playing; K.press(bPlay, playing); bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"); });
    bOne.addEventListener("click", add);
    var t = 0;
    K.loop(root, function (dt) {
      if (!playing) return;
      t += dt;
      if (t > 650) { t = 0; add(); }
    });
    add();
    if (K.reduce) for (var n = 0; n < 19; n++) add();
  });
})();
