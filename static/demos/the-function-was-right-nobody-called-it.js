/* 「함수는 맞았는데 아무도 부르지 않았다」 글의 그림: 함수가 맞는 것·경로가 부르는 것·올바른 입력을 주는 것을 따로 켜 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("wire-path", function (root) {
    K.css("the-function-was-right-nobody-called-it-css", [
      '.tca[data-demo="wire-path"] .wp-s{display:flex;align-items:center;gap:10px;padding:7px 10px;margin:4px 0;border:1px solid var(--tertiary);border-radius:6px;transition:background .25s,opacity .25s}',
      '.tca[data-demo="wire-path"] .wp-s.cur{background:var(--code-bg);border-color:var(--tca-accent)}',
      '.tca[data-demo="wire-path"] .wp-s.byp{opacity:.5;border-style:dashed}',
      '.tca[data-demo="wire-path"] .wp-s.byp.cur{background:transparent;border-color:var(--tca-warn)}',
      '.tca[data-demo="wire-path"] .wp-n{flex:1;min-width:0;font-size:13px}',
      '.tca[data-demo="wire-path"] .wp-r{flex:none;font-size:12.5px;text-align:right;max-width:46%}',
      '.tca[data-demo="wire-path"] .wp-c{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 10px;font-size:13px;margin-top:10px}',
      '.tca[data-demo="wire-path"] .wp-c b{font-weight:600;min-width:1.2em;text-align:center}',
      '.tca[data-demo="wire-path"] .wp-out{margin-top:10px;padding:8px 10px;border:1px dashed var(--tertiary);border-radius:6px}'
    ].join(""));

    K.head(root, K.t("'적용됐다'를 세 가지로 나눠 보기", "Splitting 'it is applied' into three checks"),
      K.t("입력이 단계를 차례로 지난다. 배선을 끄면 그 단계는 조용히 건너뛰어지고, 함수 테스트는 그래도 통과한다.",
        "The input passes the stages in order. Unwire a stage and it is skipped silently, while the unit test still passes."));

    var kase = "list", inList = false, wired = false, arg = "turn";
    var bar = K.el("div", "tca-bar");
    var segCase = K.seg([
      { value: "list", label: K.t("사례 1 · 덮어쓰기 목록", "Case 1 · override list") },
      { value: "call", label: K.t("사례 2 · 새 필터 함수", "Case 2 · new filter function") }
    ], kase, function (v) { kase = v; render(); }, K.t("사례", "Case"));
    bar.appendChild(segCase.el);
    root.appendChild(bar);

    var opts = K.el("div", "tca-bar");
    var bList = K.btn(K.t("목록에 이 라벨 한 줄 넣기", "Add the label to the list"), false);
    var bWire = K.btn(K.t("평가 경로에 호출부 연결", "Wire the call into the eval path"), false);
    var argLbl = K.el("span", "tca-lbl", K.t("넘기는 인자", "Argument"));
    var segArg = K.seg([
      { value: "turn", label: K.t("검증 대상 턴 원문", "The checked turn only") },
      { value: "ctx", label: K.t("앞뒤 턴 포함 문맥", "Context with nearby turns") }
    ], arg, function (v) { arg = v; render(); }, K.t("넘기는 인자", "Argument"));
    opts.appendChild(bList); opts.appendChild(bWire); opts.appendChild(argLbl); opts.appendChild(segArg.el);
    root.appendChild(opts);
    bList.addEventListener("click", function () { inList = !inList; render(); });
    bWire.addEventListener("click", function () { wired = !wired; render(); });

    var stages = [0, 1, 2].map(function () {
      var s = K.el("div", "wp-s"), n = K.el("div", "wp-n"), r = K.el("div", "wp-r");
      s.appendChild(n); s.appendChild(r); root.appendChild(s);
      return { s: s, n: n, r: r };
    });
    var checks = K.el("div", "wp-c");
    var ck = [0, 1, 2].map(function () { var b = K.el("b", ""), l = K.el("span", ""); checks.appendChild(b); checks.appendChild(l); return { b: b, l: l }; });
    root.appendChild(checks);
    var out = K.el("div", "wp-out");
    out.setAttribute("aria-live", "polite");
    root.appendChild(out);
    root.appendChild(K.el("div", "tca-note", K.t(
      "수치는 본문 그대로다(미탐 64건 · 36.4% → 0.8% · 함수 테스트 8/8 · 85분 재평가). 어느 설정에서도 에러는 나지 않는다.",
      "Numbers are from the post (64 misses · 36.4% → 0.8% · unit tests 8/8 · 85-minute re-eval). No setting raises an error.")));

    function mark(c, state, text) {
      c.b.textContent = state === 1 ? "✓" : state === 0 ? "✗" : "—";
      c.b.className = state === 1 ? "tca-good" : state === 0 ? "tca-bad" : "";
      c.l.textContent = text;
    }
    var byp = -1;
    function render() {
      var L = kase === "list";
      bList.style.display = L ? "" : "none";
      bWire.style.display = argLbl.style.display = segArg.el.style.display = L ? "none" : "";
      K.press(bList, inList); K.press(bWire, wired);
      segArg.el.querySelectorAll("button").forEach(function (b) { b.disabled = !wired; });
      if (L) {
        stages[0].n.textContent = K.t("모델 판정", "Model prediction");
        stages[0].r.textContent = K.t("이 라벨 미탐 64건", "64 misses on this label");
        stages[1].n.textContent = K.t("정규식이 모델 판정을 덮어쓰는 단계 — 목록에 있는 라벨만", "Regex override — only labels in the list");
        stages[1].r.textContent = inList ? K.t("64건 다시 잡음", "Recovers the 64") : K.t("목록에 없음 → 지나침", "Not listed → skipped");
        stages[2].n.textContent = K.t("출력", "Output");
        stages[2].r.textContent = K.t("미탐률 ", "Miss rate ") + (inList ? "0.8%" : "36.4%");
        byp = inList ? -1 : 1;
        mark(ck[0], 1, K.t("패턴·검증 함수가 이미 있다 (미탐 64건을 정규식에 넣으면 64건 다 잡힘)", "Pattern and validator exist (all 64 caught when fed directly)"));
        mark(ck[1], inList ? 1 : 0, K.t("실제 경로가 그 라벨에 대해 부른다", "The real path calls it for this label"));
        mark(ck[2], -1, K.t("올바른 입력 — 이 사례에서는 해당 없음", "Right input — not relevant here"));
        out.textContent = inList ? K.t("목록에 한 줄 넣자 미탐률 36.4% → 0.8%. 재학습 없이.", "One line in the list: 36.4% → 0.8%, no retraining.")
          : K.t("미탐률 36.4%. 데이터 비중이 0.5%라 모델 탓으로 보이지만, 원인은 목록 한 줄이다.", "36.4% misses. It looks like the model (0.5% of the data), but the cause is one missing line.");
        out.className = "wp-out " + (inList ? "tca-good" : "tca-bad");
      } else {
        stages[0].n.textContent = K.t("1차 판정", "First-stage prediction");
        stages[0].r.textContent = "";
        stages[1].n.textContent = K.t("2차 필터 — 과잉 삭제를 고치는 새 함수", "Second-stage filter — the new fix");
        stages[1].r.textContent = !wired ? K.t("호출부 없음 → 지나침", "No call site → skipped")
          : arg === "turn" ? K.t("턴 원문으로 판정", "Judged on the turn") : K.t("앞뒤 턴까지 보고 판정", "Judged with nearby turns");
        stages[2].n.textContent = K.t("평가 결과", "Evaluation result");
        stages[2].r.textContent = !wired ? K.t("이전과 같음", "Unchanged") : arg === "turn" ? K.t("수정 반영", "Fix applied") : K.t("엉뚱한 결합 위험", "Wrong pairing risk");
        byp = wired ? -1 : 1;
        mark(ck[0], 1, K.t("함수가 맞게 동작한다 (함수 단위 8/8 통과)", "The function is correct (8/8 unit cases)"));
        mark(ck[1], wired ? 1 : 0, K.t("실제 평가 경로가 그 함수를 부른다", "The eval path actually calls it"));
        mark(ck[2], !wired ? -1 : arg === "turn" ? 1 : 0, K.t("올바른 입력을 준다 (같은 발화 안만 봐야 한다)", "It gets the right input (same utterance only)"));
        out.textContent = !wired ? K.t("85분 재평가 결과가 소수점까지 이전과 같다. 함수 테스트 8/8은 이 상태에서도 통과한다.", "The 85-minute re-eval matches the old result to the decimal. 8/8 still passes.")
          : arg === "turn" ? K.t("셋 다 확인됐다. 이때 비로소 '적용됐다'고 말할 수 있다.", "All three hold. Only now is it 'applied'.")
          : K.t("인접 턴에 있는 남의 식별자를 끌어와 결합할 수 있다. 패치의 거리 제한이 무력화된다.", "It can pull someone else's identifier from a nearby turn, defeating the patch's distance limit.");
        out.className = "wp-out " + (!wired ? "tca-bad" : arg === "turn" ? "tca-good" : "tca-warn");
      }
      paintCur();
    }
    var t = 0, curRow = K.reduce ? -1 : 0;
    function paintCur() {
      stages.forEach(function (st, i) { st.s.className = "wp-s" + (i === byp ? " byp" : "") + (i === curRow ? " cur" : ""); });
    }
    K.loop(root, function (dt) {
      if (K.reduce) return;
      t += dt;
      var row = Math.floor(t / 900) % 4; // 0,1,2 단계, 3은 쉼
      var nr = row === 3 ? -1 : row;
      if (nr !== curRow) { curRow = nr; paintCur(); }
    });
    render();
  });
})();
