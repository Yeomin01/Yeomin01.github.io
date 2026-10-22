/* 「정보량을 바꾸지 않는 변형만 회피로 친다」 글의 그림: 변형 하나가 미탐으로 세어지기까지 거치는 세 관문 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("ipm-gates", function (root) {
    // g: 관문별 결과(true=예, false=아니오). 아니오가 나오면 그 뒤는 건너뛴다.
    var CASES = [
      { name: K.t("금액 · 구분자 제거 단독", "Amount · separators dropped only"),
        g: [true, true, false], v: "ok",
        verdict: K.t("회피 아님 — 본문 수치: 단독 0% 회피", "Not an evasion — post: 0% alone") },
      { name: K.t("금액 · 전각 변환 단독", "Amount · full-width only"),
        g: [true, true, false], v: "ok",
        verdict: K.t("회피 아님 — 본문 수치: 단독 0% 회피", "Not an evasion — post: 0% alone") },
      { name: K.t("금액 · 둘을 겹침", "Amount · both combined"),
        g: [true, true, true], v: "miss",
        verdict: K.t("미탐으로 센다 — 본문 수치: 100% 회피", "Counted as a miss — post: 100% evasion") },
      { name: K.t("이메일·IP · 구분자 치환", "Email/IP · separator swap"),
        g: [false], v: "out",
        verdict: K.t("제외 — 구분자가 의미를 나르는 라벨이라 다른 값이 된다", "Excluded — the separator carries meaning, so it is a different value") },
      { name: K.t("플레이스홀더 값 · 마크다운", "Placeholder value · markdown"),
        g: [true, false], v: "out",
        verdict: K.t("제외 — 원본(010-1234-5678)부터 필터가 막는 값이라 두 효과가 섞인다", "Excluded — the original (010-1234-5678) is already blocked by a filter, so two effects mix") }
    ];
    var GATES = [
      { q: K.t("① 변형을 되돌리면 원래 숫자열과 글자 단위로 같은가", "① Undo the mutation — is the digit string identical?"),
        yes: K.t("같다", "Same"), no: K.t("다른 값", "Different") },
      { q: K.t("② 원본은 탐지되는가 (기준선)", "② Is the original detected? (baseline)"),
        yes: K.t("탐지됨", "Detected"), no: K.t("원본도 안 잡힘", "Missed too") },
      { q: K.t("③ 변형본을 탐지기가 놓쳤는가", "③ Did the detector miss the mutated value?"),
        yes: K.t("놓침", "Missed"), no: K.t("잡힘", "Caught") }
    ];

    K.css("only-information-preserving-mutations-count-css", [
      '.tca[data-demo="ipm-gates"] .ipm-g{display:flex;align-items:center;gap:10px;padding:7px 10px;margin:5px 0;',
      'border:1px solid var(--tertiary);border-radius:6px;transition:background .3s,opacity .3s}',
      '.tca[data-demo="ipm-gates"] .ipm-g.cur{background:var(--code-bg)}',
      '.tca[data-demo="ipm-gates"] .ipm-g.skip{opacity:.45}',
      '.tca[data-demo="ipm-gates"] .ipm-q{flex:1;min-width:0;font-size:13px}',
      '.tca[data-demo="ipm-gates"] .ipm-a{flex:none;min-width:84px;text-align:right;font-size:12.5px;font-weight:600}',
      '.tca[data-demo="ipm-gates"] .ipm-v{margin-top:8px;padding:8px 10px;border-radius:6px;border:1px dashed var(--tertiary);min-height:38px}',
      '.tca[data-demo="ipm-gates"] .ipm-sum{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;font-size:12.5px;margin-top:10px}',
      '.tca[data-demo="ipm-gates"] .ipm-sum .r{text-align:right}'
    ].join(""));

    K.head(root, K.t("변형 하나가 미탐으로 세어지기까지", "When a mutation counts as a miss"),
      K.t("사례를 고르면 세 관문을 차례로 통과시킨다. 세 관문을 다 지나 ③에서 놓친 것만 미탐으로 센다.",
        "Pick a case and it walks through three gates. Only a value that passes all three and is missed at ③ counts as a miss."));

    var bar = K.el("div", "tca-bar");
    var caseBtns = CASES.map(function (c, i) {
      var b = K.btn(c.name, i === 0);
      b.addEventListener("click", function () { auto = false; K.press(bAuto, false); bAuto.textContent = K.t("차례로 보기", "Play all"); pick(i); });
      bar.appendChild(b);
      return b;
    });
    root.appendChild(bar);

    var rows = GATES.map(function (g) {
      var r = K.el("div", "ipm-g");
      var q = K.el("div", "ipm-q", g.q);
      var a = K.el("div", "ipm-a", "");
      r.appendChild(q); r.appendChild(a);
      root.appendChild(r);
      return { r: r, a: a };
    });
    var verdict = K.el("div", "ipm-v");
    verdict.setAttribute("aria-live", "polite");
    root.appendChild(verdict);

    var ctl = K.el("div", "tca-bar");
    ctl.style.margin = "10px 0 0";
    var bAuto = K.btn(K.t("일시정지", "Pause"), true);
    var bAgain = K.btn(K.t("이 사례 다시", "Replay case"));
    ctl.appendChild(bAuto); ctl.appendChild(bAgain);
    root.appendChild(ctl);

    var sumBox = K.el("div", "ipm-sum");
    var sumCells = CASES.map(function (c) {
      var l = K.el("div", "", c.name), r = K.el("div", "r tca-num", "—");
      sumBox.appendChild(l); sumBox.appendChild(r);
      return r;
    });
    root.appendChild(K.el("div", "tca-h", K.t("지금까지 본 사례", "Cases seen so far")));
    root.lastChild.style.marginTop = "12px";
    root.appendChild(sumBox);
    root.appendChild(K.el("div", "tca-note", K.t(
      "다섯 사례는 본문에 나온 것만 골랐다. 수치도 본문 그대로다(금액 라벨의 단독 0%·조합 100%). 변형된 실제 문자열은 그리지 않았다.",
      "The five cases and their numbers come from the post (amount label: 0% alone, 100% combined). Mutated strings are not drawn.")));

    var cur = 0, step = 0, t = 0, auto = !K.reduce, hold = 0;
    var SHORT = { ok: K.t("회피 아님", "Not evasion"), miss: K.t("미탐으로 셈", "Miss"), out: K.t("제외", "Excluded") };
    var CLS = { ok: "tca-good", miss: "tca-bad", out: "tca-warn" };

    function render() {
      var c = CASES[cur];
      var stopAt = c.g.indexOf(false); // 처음 '아니오' 자리
      rows.forEach(function (row, i) {
        var known = i < step, res = c.g[i];
        row.r.className = "ipm-g" + (i === step && step < 3 && !(stopAt >= 0 && i > stopAt) ? " cur" : "") +
          (stopAt >= 0 && i > stopAt && step > stopAt ? " skip" : "");
        if (stopAt >= 0 && i > stopAt) { row.a.textContent = step > stopAt ? K.t("건너뜀", "Skipped") : ""; row.a.className = "ipm-a"; return; }
        if (!known) { row.a.textContent = i === step ? "…" : ""; row.a.className = "ipm-a"; return; }
        row.a.textContent = res ? GATES[i].yes : GATES[i].no;
        // ③의 '놓침'은 미탐, ①②의 '아니오'는 제외 사유
        row.a.className = "ipm-a " + (i === 2 ? (res ? "tca-bad" : "tca-good") : (res ? "" : "tca-warn"));
      });
      var done = step >= c.g.length;
      verdict.textContent = done ? c.verdict : K.t("판정 중…", "Checking…");
      verdict.className = "ipm-v" + (done ? " " + CLS[c.v] : "");
      if (done) { sumCells[cur].textContent = SHORT[c.v]; sumCells[cur].className = "r tca-num " + CLS[c.v]; }
    }
    function pick(i) {
      cur = i; step = K.reduce ? CASES[i].g.length : 0; t = 0; hold = 0;
      caseBtns.forEach(function (b, j) { K.press(b, j === i); });
      render();
    }
    bAuto.addEventListener("click", function () {
      auto = !auto; K.press(bAuto, auto);
      bAuto.textContent = auto ? K.t("일시정지", "Pause") : K.t("차례로 보기", "Play all");
    });
    bAgain.addEventListener("click", function () { var r = K.reduce; step = 0; t = 0; hold = 0; if (r) step = CASES[cur].g.length; render(); });
    if (!auto) { K.press(bAuto, false); bAuto.textContent = K.t("차례로 보기", "Play all"); }

    K.loop(root, function (dt) {
      var c = CASES[cur];
      if (step < c.g.length) {
        t += dt;
        if (t > 750) { t = 0; step++; render(); }
        return;
      }
      if (!auto) return;
      hold += dt;
      if (hold > 2200) pick((cur + 1) % CASES.length);
    });
    pick(0);
  });
})();
