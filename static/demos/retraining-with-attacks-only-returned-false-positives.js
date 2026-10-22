/* 「공격만 더 넣은 재학습은 오탐으로 돌아왔다」 글의 그림: 네 번의 재학습에서 겉모습별로 공격·정상이 어떻게 쌓였나 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("rao-steps", function (root) {
    // 겉모습(행)별로 시도마다 들어간 데이터. a=공격, b=정상
    var ROWS = [
      { id: "re", name: K.t("일상 대화의 되묻기 화법", "Re-asking in daily chat") },
      { id: "code", name: K.t("한국어 코드 대화", "Korean code chat") },
      { id: "fin", name: K.t("긴 금융 상담", "Long finance consults") }
    ];
    var STEPS = [
      { title: K.t("시작: 배포본", "Start: deployed model"),
        add: {},
        out: [[K.t("약한 유형: 표기를 바꿔 숨기기 · 연쇄 편집 · 코드 디버깅 포장", "Weak spots: notation hiding · edit chains · code-debug wrapping"), ""]] },
      { title: K.t("시도 1 — 약한 유형의 공격 하드케이스 수백 건", "Try 1 — a few hundred attack hard cases"),
        add: { re: { a: K.t("+연쇄 편집형", "+edit-chain") }, code: { a: K.t("+코드 맥락(전부 한국어)", "+code context (all Korean)") } },
        out: [[K.t("검출률 올라감 (영어 공격에서 특히)", "Detection up (especially English)"), "good"],
          [K.t("정상 오탐 약 5배 — 대부분 한국어 일상 대화의 되묻기", "Benign false positives about 5× — mostly daily re-asking"), "bad"]] },
      { title: K.t("시도 2 — 긴 금융 상담 정상 1,500건", "Try 2 — 1,500 long finance consults"),
        add: { fin: { b: K.t("+1,500건", "+1,500") } },
        out: [[K.t("목표한 오탐 줄지 않음 (넣은 정상이 오탐 난 분포와 다름)", "Target false positives unchanged (wrong distribution)"), "bad"],
          [K.t("검출률 크게 떨어짐 (양이 많아 경계가 정상 쪽으로)", "Detection drops sharply (boundary pushed)"), "bad"]] },
      { title: K.t("시도 3 — 일상 되묻기 정상 수백 건", "Try 3 — a few hundred daily re-asking chats"),
        add: { re: { b: K.t("+수백 건", "+a few hundred") } },
        out: [[K.t("되묻기 오탐은 잡힘", "Re-asking false positives fixed"), "good"],
          ["CODE", "bad"]] },
      { title: K.t("시도 4 — 목표만 다른 공격·정상 짝", "Try 4 — attack/benign pairs differing only in goal"),
        add: { re: { a: K.t("+짝", "+pairs"), b: K.t("+짝", "+pairs") }, code: { a: K.t("+짝", "+pairs"), b: K.t("+짝", "+pairs") } },
        out: [[K.t("학습 중단 — 평가 기준을 다시 세우는 작업이 시작됨", "Stopped midway — evaluation criteria being rebuilt"), ""]] }
    ];

    K.css("retraining-with-attacks-only-returned-false-positives-css", [
      '.tca[data-demo="rao-steps"] .rao-m{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr);gap:4px;font-size:12.5px}',
      '.tca[data-demo="rao-steps"] .rao-m>div{border:1px solid var(--tertiary);border-radius:5px;padding:5px 7px;min-height:34px;min-width:0}',
      '.tca[data-demo="rao-steps"] .rao-m .hd{border:0;color:var(--secondary);min-height:0;padding:0 2px}',
      '.tca[data-demo="rao-steps"] .rao-m .nm{background:var(--code-bg)}',
      '.tca[data-demo="rao-steps"] .rao-m span{display:block}',
      '.tca[data-demo="rao-steps"] .rao-st{grid-column:1/-1;font-size:12px;margin:-2px 0 4px;border:0!important;min-height:0!important;padding:0 2px!important}',
      '.tca[data-demo="rao-steps"] .rao-out{margin-top:10px;padding:8px 10px;border:1px dashed var(--tertiary);border-radius:6px;min-height:58px}',
      '.tca[data-demo="rao-steps"] .rao-out div{margin:2px 0}'
    ].join(""));

    K.head(root, K.t("네 번의 재학습, 겉모습별로 본 학습 데이터", "Four retrains, training data by surface form"),
      K.t("'다음 시도'를 누르면 그 시도에 넣은 데이터가 칸에 쌓이고, 본문의 결과가 아래에 나온다. 공격만 있고 같은 겉모습의 정상이 없는 칸이 빨갛게 표시된다.",
        "Each step adds that try's data to the grid and shows the post's result. Rows with attacks but no benign of the same surface turn red."));

    var bar = K.el("div", "tca-bar");
    var bPrev = K.btn(K.t("이전", "Back")), bNext = K.btn(K.t("다음 시도", "Next try")), bAuto = K.btn(K.t("자동 재생", "Autoplay"), false);
    var stepLbl = K.el("span", "tca-tag", "");
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(bAuto); bar.appendChild(stepLbl);
    root.appendChild(bar);

    var title = K.el("div", "tca-h", "");
    root.appendChild(title);
    var m = K.el("div", "rao-m");
    ["", K.t("공격", "Attack"), K.t("같은 겉모습의 정상", "Benign, same surface")].forEach(function (h) { m.appendChild(K.el("div", "hd", h)); });
    var cells = ROWS.map(function (r) {
      m.appendChild(K.el("div", "nm", r.name));
      var a = K.el("div", ""), b = K.el("div", "");
      m.appendChild(a); m.appendChild(b);
      var st = K.el("div", "rao-st", "");
      m.appendChild(st);
      return { a: a, b: b, st: st };
    });
    root.appendChild(m);

    var ms = K.el("div", "tca-bar");
    ms.style.margin = "10px 0 0";
    ms.appendChild(K.el("span", "tca-lbl", K.t("오탐 측정 셋", "False-positive set")));
    var measure = "one";
    var segM = K.seg([{ value: "one", label: K.t("정상 셋 하나", "One benign set") }, { value: "fmt", label: K.t("형식별 정상 셋", "Per-format sets") }],
      measure, function (v) { measure = v; render(false); }, K.t("오탐 측정 셋", "False-positive set"));
    ms.appendChild(segM.el);
    root.appendChild(ms);

    var out = K.el("div", "rao-out");
    out.setAttribute("aria-live", "polite");
    root.appendChild(out);
    root.appendChild(K.el("div", "tca-note", K.t(
      "수치와 문장은 본문 그대로다. 칸의 빨간 표시는 '짝이 되는 정상이 없다'는 데이터 구성 상태이지, 그 시점에 오탐을 측정했다는 뜻이 아니다.",
      "Numbers and wording are from the post. A red row marks a data-composition state (no matching benign), not a measured false-positive rate at that step.")));

    var cur = 0, auto = false, t = 0;
    function stateAt(n) {
      var s = {};
      ROWS.forEach(function (r) { s[r.id] = { a: [], b: [] }; });
      for (var i = 1; i <= n; i++) {
        var add = STEPS[i].add;
        for (var k in add) {
          if (add[k].a) s[k].a.push({ txt: add[k].a, at: i });
          if (add[k].b) s[k].b.push({ txt: add[k].b, at: i });
        }
      }
      return s;
    }
    function fill(elm, list, n, pop) {
      elm.textContent = "";
      if (!list.length) { elm.appendChild(K.el("span", "", "—")).style.color = "var(--secondary)"; return; }
      list.forEach(function (x) {
        var sp = K.el("span", x.at === n && pop && !K.reduce ? "tca-pop" : "", x.txt);
        elm.appendChild(sp);
      });
    }
    function render(pop) {
      var s = stateAt(cur);
      ROWS.forEach(function (r, i) {
        var c = cells[i], d = s[r.id];
        fill(c.a, d.a, cur, pop); fill(c.b, d.b, cur, pop);
        var onlyA = d.a.length && !d.b.length, both = d.a.length && d.b.length, onlyB = !d.a.length && d.b.length;
        c.a.style.borderColor = onlyA ? "var(--tca-bad)" : "";
        c.st.className = "rao-st " + (onlyA ? "tca-bad" : both ? "tca-good" : "");
        c.st.textContent = onlyA ? K.t("공격만 있음 → 겉모습 자체가 공격 신호가 될 수 있다", "Attacks only → the surface itself can become the signal")
          : both ? K.t("짝이 있음 → 겉모습으로는 못 가른다", "Paired → surface cannot separate")
          : onlyB ? K.t("정상만 있음", "Benign only") : "";
      });
      var st = STEPS[cur];
      title.textContent = st.title;
      stepLbl.textContent = (cur + 1) + " / " + STEPS.length;
      out.textContent = "";
      st.out.forEach(function (o) {
        var txt = o[0], cls = o[1];
        if (txt === "CODE") {
          if (measure === "one") { txt = K.t("한국어 코드 대화 오탐: 보이지 않음 (정상 셋에 코드 형식이 거의 없음)", "Korean code false positives: invisible (the set has almost no code)"); cls = "tca-warn"; }
          else txt = K.t("한국어 코드 대화 오탐 거의 0% → 약 19% (다섯 건 중 한 건)", "Korean code false positives ~0% → ~19% (one in five)");
        }
        out.appendChild(K.el("div", cls ? "tca-" + cls.replace("tca-", "") : "", txt));
      });
      bPrev.disabled = cur === 0;
      bNext.disabled = cur === STEPS.length - 1 && !auto;
    }
    function go(n) { cur = Math.max(0, Math.min(STEPS.length - 1, n)); t = 0; render(true); }
    bPrev.addEventListener("click", function () { go(cur - 1); });
    bNext.addEventListener("click", function () { go(cur + 1); });
    bAuto.addEventListener("click", function () {
      auto = !auto; K.press(bAuto, auto);
      if (auto && cur === STEPS.length - 1) go(0); else render(false);
    });
    K.loop(root, function (dt) {
      if (!auto) return;
      t += dt;
      if (t > 3200) go(cur === STEPS.length - 1 ? 0 : cur + 1);
    });
    render(false);
  });
})();
