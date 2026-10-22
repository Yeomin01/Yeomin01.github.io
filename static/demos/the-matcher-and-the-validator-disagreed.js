/* 「정규식은 맞췄는데 검증기가 떨어뜨렸다」 글의 그림: 구분자 집합이 두 곳에 따로 적혀 갈라지는 지점, 그룹 경계를 옮긴 값이 후처리를 통과하는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("the-matcher-and-the-validator-disagreed-css", [
    '.tca[data-demo="mv-sep"] .mv-set{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0;font-size:13px}',
    '.tca[data-demo="mv-sep"] .mv-set .k{width:9.5em;flex:none;color:var(--secondary)}',
    '.tca[data-demo="mv-sep"] .mv-ch{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:26px;padding:0 6px;',
    'border:1px solid var(--tertiary);border-radius:5px;font-family:ui-monospace,monospace;font-size:13px}',
    '.tca[data-demo="mv-sep"] .mv-ch.sel{border:2px solid var(--tca-accent);font-weight:700}',
    '.tca[data-demo="mv-sep"] .mv-ch.miss{border:2px dashed var(--tca-bad);color:var(--tca-bad)}',
    '.tca[data-demo="mv-sep"] .mv-st,.tca[data-demo="mv-groups"] .mv-st{display:flex;gap:10px;align-items:center;padding:6px 10px;margin:4px 0;',
    'border:1px solid var(--tertiary);border-radius:6px;transition:background .25s,opacity .25s;font-size:13px}',
    '.tca[data-demo="mv-sep"] .mv-st.cur{background:var(--code-bg);border-color:var(--tca-accent)}',
    '.tca[data-demo="mv-sep"] .mv-st.wait{opacity:.35}',
    '.tca[data-demo="mv-sep"] .mv-st .n{flex:1;min-width:0}',
    '.tca[data-demo="mv-sep"] .mv-st .v{flex:none;max-width:55%;text-align:right;font-family:ui-monospace,monospace;font-size:12.5px;white-space:pre}',
    '.tca[data-demo="mv-groups"] .mv-gr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) minmax(0,1.2fr);gap:4px;font-size:12.5px}',
    '.tca[data-demo="mv-groups"] .mv-gr>div{padding:5px 7px;border:1px solid var(--tertiary);border-radius:5px;min-width:0;transition:opacity .25s}',
    '.tca[data-demo="mv-groups"] .mv-gr .hd{border:0;color:var(--secondary);padding:0 2px}',
    '.tca[data-demo="mv-groups"] .mv-gr .wait{opacity:.3}'
  ].join(""));

  /* 1. 구분자 집합이 두 곳에 따로 적혀 있을 때 */
  K.register("mv-sep", function (root) {
    var SEPS = [
      { v: "-", show: "-", label: K.t("하이픈", "Hyphen") },
      { v: " ", show: "␣", label: K.t("공백", "Space") },
      { v: ".", show: ".", label: K.t("점", "Dot") },
      { v: "\t", show: "⇥", label: K.t("탭", "Tab") }
    ];
    var REGEX = ["-", " ", ".", "\t"], BEFORE = ["-", " "];
    var sep = ".", fixed = false;

    K.head(root, K.t("매치는 되는데 검증에서 떨어지는 자리", "Matched, then dropped by the validator"),
      K.t("구분자를 고르면 값이 정규식과 검증기를 차례로 지난다. 검증기를 고치기 전에는 점과 탭이 검증기의 걷어낼 목록에 없다.",
        "Pick a separator and the value goes through the regex, then the validator. Before the fix, dot and tab are not in the validator's strip list."));

    var bar = K.el("div", "tca-bar");
    var segS = K.seg(SEPS.map(function (s) { return { value: s.v, label: s.label + " " + s.show }; }), sep,
      function (v) { sep = v; restart(); }, K.t("구분자", "Separator"));
    var segF = K.seg([{ value: false, label: K.t("고치기 전", "Before fix") }, { value: true, label: K.t("고친 뒤(상수 하나)", "After fix (one constant)") }],
      fixed, function (v) { fixed = v; restart(); }, K.t("검증기", "Validator"));
    bar.appendChild(segS.el); bar.appendChild(segF.el);
    root.appendChild(bar);

    function setRow(label) {
      var r = K.el("div", "mv-set");
      r.appendChild(K.el("span", "k", label));
      root.appendChild(r);
      return r;
    }
    var rowR = setRow(K.t("정규식이 받는 구분자", "Regex accepts"));
    var rowV = setRow(K.t("검증기가 걷어내는 것", "Validator strips"));

    var ST = [K.t("입력", "Input"), K.t("정규식 매치", "Regex match"), K.t("검증기 — 구분자 걷어낸 뒤", "Validator — after stripping"),
      K.t("13자리 숫자인가 (isdigit)", "13 digits? (isdigit)"), K.t("결과", "Result")];
    var st = ST.map(function (n) {
      var r = K.el("div", "mv-st"), a = K.el("span", "n", n), b = K.el("span", "v", "");
      r.appendChild(a); r.appendChild(b); root.appendChild(r);
      return { r: r, v: b };
    });
    var read = K.el("div", "tca-note");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "YYMMDD 는 본문처럼 생년월일 여섯 자리를 가린 자리표시다(숫자로 본다). 구분자 집합 - ␣ . ⇥ 은 본문의 상수 _SEP_STRIP 그대로다.",
      "YYMMDD stands for six birth-date digits, as in the post. The set - ␣ . ⇥ is the post's _SEP_STRIP constant.")));

    function chips(row, list, isV) {
      while (row.childNodes.length > 1) row.removeChild(row.lastChild);
      SEPS.forEach(function (s) {
        var has = list.indexOf(s.v) >= 0;
        if (!has && !(isV && s.v === sep)) return;
        var c = K.el("span", "mv-ch" + (s.v === sep ? (has ? " sel" : " miss") : ""), s.show);
        if (!has) c.title = K.t("없음", "missing");
        row.appendChild(c);
      });
      if (isV) row.appendChild(K.el("span", "", fixed ? K.t("← 정규식과 같은 상수", "← same constant as the regex") : K.t("← 따로 적힌 목록", "← a separate list")));
    }
    var step = 0, t = 0;
    function vals() {
      var strip = fixed ? REGEX : BEFORE;
      var shown = SEPS.filter(function (s) { return s.v === sep; })[0].show;
      var left = strip.indexOf(sep) >= 0 ? "" : shown;
      var ok = left === "";
      return [
        "YYMMDD" + shown + "1234567",
        "True",
        "YYMMDD" + left + "1234567",
        ok ? "True" : "False",
        ok ? K.t("체크섬으로 → 탐지", "to checksum → detected") : K.t("후보에서 사라짐", "dropped silently")
      ];
    }
    function paint() {
      var v = vals(), ok = v[3] === "True";
      st.forEach(function (s, i) {
        s.v.textContent = i < step ? v[i] : "";
        s.r.className = "mv-st" + (i === step - 1 ? " cur" : "") + (i >= step ? " wait" : "");
        s.v.className = "v" + (i === 4 && i < step ? (ok ? " tca-good" : " tca-bad") : i === 3 && i < step && !ok ? " tca-bad" : "");
      });
      read.textContent = step < ST.length ? "" : ok && fixed
        ? K.t("두 곳이 같은 상수를 본다. 매치된 값이 검증까지 살아남는다.", "Both places read one constant; the match survives validation.")
        : ok ? K.t("이 구분자는 두 목록에 다 있어서 통과한다. 두 목록이 다르다는 사실은 여기서는 드러나지 않는다.", "This separator is in both lists, so it passes. That the lists differ stays hidden here.")
        : K.t("정규식은 맞췄는데 검증에서 조용히 False. 예외도 로그도 없고 밖에서는 '안 잡힘'만 보인다.", "Matched, then a silent False. No exception, no log — only 'not detected' from outside.");
    }
    function restart() {
      chips(rowR, REGEX, false); chips(rowV, fixed ? REGEX : BEFORE, true);
      step = K.reduce ? ST.length : 0; t = 0; paint();
    }
    K.loop(root, function (dt) {
      t += dt;
      if (step < ST.length) { if (t > 600) { t = 0; step++; paint(); } }
      else if (t > 3500) { t = 0; step = 0; paint(); }
    });
    restart();
  });

  /* 2. 그룹 경계를 옮긴 값이 후처리를 통과하는가 */
  K.register("mv-groups", function (root) {
    var LABELS = [
      { n: K.t("주민번호", "RRN"), ck: true }, { n: K.t("사업자번호", "Business no."), ck: true },
      { n: K.t("카드", "Card"), ck: true }, { n: K.t("건강보험", "Health ins."), ck: true },
      { n: K.t("전화번호", "Phone"), ck: false }, { n: K.t("계좌번호", "Account"), ck: false }
    ];
    var fixed = false;
    K.head(root, K.t("그룹 경계를 옮긴 값이 후처리를 통과하나", "Do boundary-shifted values survive post-processing?"),
      K.t("모델이 문맥으로 잡았다고 두고, 그 값을 후처리 검증에 넣는다. 검증기를 고치기 전후를 바꿔 보면 증강 데이터로 넣어도 되는 라벨이 달라진다.",
        "Assume the model caught the value from context, then send it to the validator. Toggle the fix to see which labels are worth augmenting."));
    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: false, label: K.t("검증기 고치기 전", "Before validator fix") }, { value: true, label: K.t("고친 뒤", "After fix") }],
      fixed, function (v) { fixed = v; restart(); }, K.t("검증기", "Validator"));
    bar.appendChild(seg.el);
    root.appendChild(bar);
    var g = K.el("div", "mv-gr");
    [K.t("라벨", "Label"), K.t("후처리 검증", "Validator"), K.t("증강 데이터로 넣으면", "If used for augmentation")].forEach(function (h) { g.appendChild(K.el("div", "hd", h)); });
    var rows = LABELS.map(function (l) {
      var a = K.el("div", "", l.n), b = K.el("div", ""), c = K.el("div", "");
      g.appendChild(a); g.appendChild(b); g.appendChild(c);
      return { b: b, c: c, l: l };
    });
    root.appendChild(g);
    var read = K.el("div", "tca-note");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "통과·탈락은 본문의 확인 결과 그대로다. 고친 뒤 전화번호·계좌번호가 통과하는 것은 '검증기를 먼저 고치고 그 라벨을 증강 대상에 넣었다'는 본문 서술을 옮긴 것이다.",
      "Pass and fail follow the post. After the fix, phone and account pass, per the post ('fixed the validator first, then added those labels').")));
    var shown = 0, t = 0;
    function paint() {
      rows.forEach(function (r, i) {
        var pass = r.l.ck || fixed, vis = i < shown;
        r.b.textContent = vis ? (pass ? (r.l.ck ? K.t("통과 — 걷어내면 같은 숫자", "Pass — same digits once stripped") : K.t("통과 — 검증기 수정 뒤", "Pass — after the fix"))
          : K.t("탈락 — 형식이 그룹 구조를 요구", "Fail — format requires the grouping")) : "…";
        r.c.textContent = vis ? (pass ? K.t("끝까지 살아남음", "Survives to the end") : K.t("후처리가 버릴 것을 학습", "Teaches what gets discarded")) : "";
        r.b.className = vis ? (pass ? "tca-good" : "tca-bad") : "wait";
        r.c.className = vis ? (pass ? "" : "tca-bad") : "wait";
      });
      read.textContent = shown < rows.length ? "" : fixed
        ? K.t("여섯 라벨 모두 후처리를 통과한다. 이때 증강 데이터를 넣는다.", "All six survive. Now augmentation makes sense.")
        : K.t("체크섬이 없는 두 라벨은 모델이 잡아도 후처리에서 버려진다. 학습보다 코드로 풀 문제다.", "The two labels without checksums are discarded even when the model catches them — a code fix, not a training one.");
    }
    function restart() { shown = K.reduce ? rows.length : 0; t = 0; paint(); }
    K.loop(root, function (dt) {
      if (shown >= rows.length) return;
      t += dt;
      if (t > 380) { t = 0; shown++; paint(); }
    });
    restart();
  });
})();
