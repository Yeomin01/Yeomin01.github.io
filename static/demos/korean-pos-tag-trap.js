/* 「'세 가지'가 안 잡혔던 이유 — 한국어 형태소 분석기의 POS 태그 함정」 글의 그림: 앞 태그 조건에 따라 열거 패턴이 잡히는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("pos-rule-check", function (root) {
    // 글에 적힌 Kiwi 분석 결과
    var ITEMS = [
      { e: "3가지", m: [["3", "SN"], ["가지", "NNB"]] },
      { e: "세 가지", m: [["세", "MM"], ["가지", "NNB"]] },
      { e: "여러 가지", m: [["여러", "MM"], ["가지", "NNB"]] },
      { e: "다섯 가지", m: [["다섯", "NR"], ["가지", "NNB"]] },
      { e: "몇 가지", m: [["몇", "MM"], ["가지", "NNB"]] },
      { e: "한 가지", m: [["한", "MM"], ["가지", "NNB"]] },
      { e: "1개", m: [["1", "SN"], ["개", "NNB"]] }
    ];
    var TAGS = [
      { t: "SN", d: K.t("숫자", "number"), c: K.COLORS[0] },
      { t: "NR", d: K.t("수사", "numeral"), c: K.COLORS[1] },
      { t: "MM", d: K.t("관형사", "determiner"), c: K.COLORS[4] }
    ];
    var NNB_C = K.COLORS[3], MS = 380;
    var st = { on: { SN: true, NR: true, MM: false }, k: K.reduce ? ITEMS.length : 0, acc: 0 };

    var D = '.tca[data-demo="pos-rule-check"] ';
    K.css("korean-pos-tag-trap-css", [
      D + ".pt-row{display:grid;grid-template-columns:76px minmax(0,1fr) 64px;gap:8px;align-items:center;padding:4px 6px;border-radius:4px}",
      D + ".pt-cur{background:var(--code-bg)}",
      D + ".pt-e{font-size:14px;font-weight:600}",
      D + ".pt-m{display:flex;flex-wrap:wrap;gap:4px;align-items:center}",
      D + ".pt-x{opacity:.45;text-decoration:line-through}",
      D + ".pt-v{font-size:12.5px;text-align:right}",
      D + ".pt-rule{font-size:13px;margin:0 0 8px;padding:6px 8px;border:1px dashed var(--tertiary);border-radius:6px}"
    ].join(""));

    K.head(root, K.t("앞 태그 조건 하나가 가르는 것", "What one tag condition decides"),
      K.t("'○ + NNB(개/가지/종류)' 열거 패턴 규칙을 글의 표현들에 돌린다. 앞 태그로 인정할 태그를 켜고 끄면, MM 이 빠졌을 때 '세 가지'·'여러 가지' 가 조용히 빠지는 것이 보인다.",
        "Runs the enumeration rule '○ + NNB (개/가지/종류)' over the expressions from the post. Toggle which leading tags count and watch '세 가지' and '여러 가지' drop out silently without MM."));

    var bar = K.el("div", "tca-bar");
    bar.appendChild(K.el("span", "tca-lbl", K.t("앞 태그로 인정:", "Leading tags allowed:")));
    var tb = TAGS.map(function (g) {
      var b = K.btn(g.t + " " + g.d, st.on[g.t]);
      b.addEventListener("click", function () { st.on[g.t] = !st.on[g.t]; K.press(b, st.on[g.t]); restart(); });
      bar.appendChild(b);
      return b;
    });
    var bOld = K.btn(K.t("처음 규칙", "Original rule"));
    var bNew = K.btn(K.t("수정한 규칙", "Fixed rule"));
    bar.appendChild(bOld); bar.appendChild(bNew);
    root.appendChild(bar);

    var rule = K.el("div", "pt-rule");
    root.appendChild(rule);
    var list = K.el("div");
    var rows = ITEMS.map(function (it) {
      var r = K.el("div", "pt-row");
      r.appendChild(K.el("div", "pt-e", "“" + it.e + "”"));
      var m = K.el("div", "pt-m");
      var chips = it.m.map(function (x, i) {
        var c = K.el("span", "tca-chip", x[0] + "/" + x[1]);
        c.style.background = x[1] === "NNB" ? NNB_C : TAGS.filter(function (g) { return g.t === x[1]; })[0].c;
        m.appendChild(c);
        if (i === 0) { var plus = K.el("span", null, "+"); plus.style.color = "var(--secondary)"; m.appendChild(plus); }
        return c;
      });
      r.appendChild(m);
      var v = K.el("div", "pt-v");
      r.appendChild(v);
      list.appendChild(r);
      return { r: r, chips: chips, v: v };
    });
    root.appendChild(list);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var lg = K.el("div", "tca-legend");
    TAGS.concat([{ t: "NNB", d: K.t("의존명사", "bound noun"), c: NNB_C }]).forEach(function (g) {
      var s = K.el("span");
      var i = K.el("i"); i.style.background = g.c;
      s.appendChild(i); s.appendChild(document.createTextNode(g.t + " " + g.d));
      lg.appendChild(s);
    });
    root.appendChild(lg);
    root.appendChild(K.el("div", "tca-note", K.t(
      "태그는 글에 적힌 Kiwi 분석 결과다. '몇'·'한' 은 이 문맥에서 MM 이고, 다른 문맥이나 다른 분석기에서는 태그가 달라질 수 있다.",
      "Tags are the Kiwi analyses given in the post. '몇' and '한' are MM in this context; other contexts or analyzers may tag them differently.")));

    function allowed() { return TAGS.filter(function (g) { return st.on[g.t]; }).map(function (g) { return g.t; }); }
    function hit(it) { return st.on[it.m[0][1]] === true && it.m[1][1] === "NNB"; }
    function render() {
      var a = allowed();
      rule.textContent = K.t("규칙: ", "Rule: ") + (a.length ? "(" + a.join(K.t(" 또는 ", " or ")) + ")" : K.t("(인정하는 태그 없음)", "(no tag allowed)")) +
        K.t(" 다음에 NNB(개/가지/종류) 가 오면 열거 패턴", " followed by NNB (개/가지/종류) is an enumeration");
      var got = 0, miss = [];
      rows.forEach(function (row, i) {
        var it = ITEMS[i], done = i < st.k, h = hit(it);
        row.r.className = "pt-row" + (i === st.k && st.k < ITEMS.length ? " pt-cur" : "");
        row.chips[0].className = "tca-chip" + (done && !st.on[it.m[0][1]] ? " pt-x" : "");
        if (done) {
          if (h) got++; else miss.push(it.e);
          row.v.textContent = h ? K.t("✓ 잡힘", "✓ caught") : K.t("✗ 놓침", "✗ missed");
          row.v.className = "pt-v " + (h ? "tca-good" : "tca-bad");
        } else { row.v.textContent = ""; row.v.className = "pt-v"; }
      });
      if (st.k < ITEMS.length) { read.textContent = K.t("검사 중 ", "Checking ") + st.k + "/" + ITEMS.length; return; }
      read.textContent = K.t("잡힘 ", "Caught ") + got + "/" + ITEMS.length +
        (miss.length ? K.t(" · 놓친 표현: ", " · missed: ") + miss.join(", ") : K.t(" · 전부 잡혔다", " · all caught"));
    }
    function setRule(on) {
      TAGS.forEach(function (g, i) { st.on[g.t] = on[g.t]; K.press(tb[i], on[g.t]); });
      restart();
    }
    bOld.addEventListener("click", function () { setRule({ SN: true, NR: true, MM: false }); });
    bNew.addEventListener("click", function () { setRule({ SN: true, NR: true, MM: true }); });
    function restart() { st.k = K.reduce ? ITEMS.length : 0; st.acc = 0; render(); }
    K.loop(root, function (dt) {
      if (st.k >= ITEMS.length) return;
      st.acc += dt;
      if (st.acc < MS) return;
      st.acc = 0;
      st.k++;
      render();
    });
    render();
  });
})();
