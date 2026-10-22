/* 「골드를 들여다본 순간, 다음 학습에 대해선 골드가 아니게 된다」 글의 그림: 갭 분석을 골드로 할 때와 dev 셋으로 할 때 각 셋이 언제 '본 데이터'가 되는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var SEL = '.tca[data-demo="gold-rounds"] ';
  K.css("looking-at-the-gold-spends-it-css", [
    SEL + '.gr-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;margin-top:6px}',
    SEL + '.gr-c{height:16px;border-radius:3px;border:1.5px solid var(--tertiary);transition:background-color .3s ease,border-color .3s ease}',
    SEL + '.gr-c.s1{border-color:var(--tca-accent);background:var(--code-bg)}',
    SEL + '.gr-c.s2{border-color:var(--tca-warn);background:var(--tca-warn)}',
    SEL + '.gr-c.s3{border-color:var(--tca-bad);background:var(--tca-bad)}',
    SEL + '.gr-c.s4{border-color:var(--tca-good);background:var(--tca-good)}',
    SEL + '.gr-dim{opacity:.4}',
    SEL + '.gr-train{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}',
    SEL + '.tca-legend i.s0{border:1.5px solid var(--tertiary)}',
    '@media (prefers-reduced-motion:reduce){' + SEL + '.gr-c{transition:none}}'
  ].join(""));

  K.register("gold-rounds", function (root) {
    var NG = 24, ND = 24;
    function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }
    function mark(a, idx, v) { idx.forEach(function (i) { a[i] = v; }); return a; }
    function range(a, b) { var r = []; for (var i = a; i < b; i++) r.push(i); return r; }
    var MISS_G = [2, 5, 9, 13, 17, 21];
    var T1 = K.t("v1 학습 데이터", "v1 training data");

    // 각 단계: 골드·dev 칸 상태(0 안 봄, 1 평가에 씀, 2 미탐, 3 들여다봄, 4 최종 보고에만 씀), 태그, 학습 데이터, 설명
    var FLOW = {
      gold: [
        { g: mark(fill(NG, 1), MISS_G, 2), d: fill(ND, 0), dOff: true,
          gt: K.t("v1 평가 중", "evaluating v1"), train: [T1],
          say: K.t("v1 을 골드로 평가한다. 특정 유형에서 놓친 항목(노란 칸)이 보인다.", "Evaluate v1 on gold. Misses in certain types show up (yellow).") },
        { g: fill(NG, 3), d: fill(ND, 0), dOff: true,
          gt: K.t("v2 에겐 본 데이터", "seen data for v2"), train: [T1, K.t("보강 1 — 골드 미탐 유형을 보고 생성, 문장 겹침 0건", "Boost 1 — made from gold miss types, 0 sentence overlap")],
          say: K.t("그 유형을 골라 학습 데이터를 새로 만든다. 문장은 하나도 겹치지 않지만 무엇을 만들지를 골드를 보고 정했다. 이 순간 골드는 다음 학습에 대해 본 데이터가 된다.",
            "Generate new training data for those types. No sentence overlaps, but what to make was decided by looking at gold. From here gold is seen data for the next model.") },
        { g: fill(NG, 3), d: fill(ND, 0), dOff: true,
          gt: K.t("v2 평가 중 — 본 데이터", "evaluating v2 — seen data"), train: [T1, K.t("보강 1 — 골드 미탐 유형을 보고 생성, 문장 겹침 0건", "Boost 1 — made from gold miss types, 0 sentence overlap")],
          say: K.t("v2 를 같은 골드로 잰다. 그 유형 점수가 오르면, 일반화된 개선인지 골드가 드러낸 약점을 겨냥해 맞춘 결과인지 구분할 수 없다.",
            "Measure v2 on the same gold. If those types improve, there is no telling general improvement from fitting the weakness gold exposed.") },
        { g: fill(NG, 3), d: fill(ND, 0), dOff: true, end: "bad",
          gt: K.t("v2 에 대해 오염", "contaminated for v2"), train: [T1, K.t("보강 1 — 골드 미탐 유형을 보고 생성, 문장 겹침 0건", "Boost 1 — made from gold miss types, 0 sentence overlap")],
          say: K.t("최종 보고: 골드 점수는 그 유형을 외웠는지를 재는 숫자가 됐다. 골드가 맡은 일, 곧 처음 보는 데이터에서의 성능 측정은 v2 에 대해 더 이상 할 수 없다.",
            "Final report: the gold score now measures whether those types were memorized. Gold can no longer do its job — measuring performance on unseen data — for v2.") }
      ],
      dev: [
        { g: fill(NG, 0), d: mark(mark(fill(ND, 0), range(0, 8), 1), [1, 4, 6], 2),
          gt: K.t("최종 보고까지 열지 않음", "closed until the final report"), dt: K.t("1묶음으로 v1 평가", "batch 1 evaluates v1"), train: [T1],
          say: K.t("v1 을 dev 셋의 첫 묶음으로 평가한다. 골드는 열지 않는다.", "Evaluate v1 on the first dev batch. Gold stays closed.") },
        { g: fill(NG, 0), d: mark(fill(ND, 0), range(0, 8), 3),
          gt: K.t("최종 보고까지 열지 않음", "closed until the final report"), dt: K.t("1묶음은 닳음 — 기록해 두고 뺀다", "batch 1 is spent — logged and excluded"),
          train: [T1, K.t("보강 1 — dev 미탐 유형을 보고 생성", "Boost 1 — made from dev miss types")],
          say: K.t("dev 의 미탐 유형으로 학습 데이터를 보강한다. 갭 분석에 쓴 dev 항목은 기록해 두고 다음 평가에서 뺀다. dev 도 쓰면 닳는다.",
            "Boost training data from dev miss types. The dev items used for gap analysis are logged and dropped from later evaluation. Dev wears out too.") },
        { g: fill(NG, 0), d: mark(mark(mark(fill(ND, 0), range(0, 8), 3), range(8, 16), 1), [10, 13], 2),
          gt: K.t("최종 보고까지 열지 않음", "closed until the final report"), dt: K.t("2묶음으로 v2 평가", "batch 2 evaluates v2"),
          train: [T1, K.t("보강 1 — dev 미탐 유형을 보고 생성", "Boost 1 — made from dev miss types")],
          say: K.t("v2 는 아직 쓰지 않은 dev 묶음으로 잰다.", "v2 is measured on a dev batch not used yet.") },
        { g: fill(NG, 0), d: mark(fill(ND, 0), range(0, 16), 3),
          gt: K.t("최종 보고까지 열지 않음", "closed until the final report"), dt: K.t("3묶음은 다음 라운드용", "batch 3 is for the next round"),
          train: [T1, K.t("보강 1 — dev 미탐 유형을 보고 생성", "Boost 1 — made from dev miss types"), K.t("보강 2 — dev 미탐 유형을 보고 생성", "Boost 2 — made from dev miss types")],
          say: K.t("같은 방식으로 한 번 더 보강한다. 남은 dev 묶음은 다음 라운드용이고, 다 쓰면 새로 만든다.",
            "Boost once more the same way. The remaining dev batch is for the next round; when it runs out, a new one is made.") },
        { g: fill(NG, 4), d: mark(fill(ND, 0), range(0, 16), 3), end: "good",
          gt: K.t("v3 최종 보고 — 처음 보는 데이터", "v3 final report — unseen data"), dt: K.t("갭 분석에만 썼다", "used for gap analysis only"),
          train: [T1, K.t("보강 1 — dev 미탐 유형을 보고 생성", "Boost 1 — made from dev miss types"), K.t("보강 2 — dev 미탐 유형을 보고 생성", "Boost 2 — made from dev miss types")],
          say: K.t("최종 보고: 골드로 한 번만 잰다. 골드는 어떤 학습 결정에도 쓰이지 않았으니, 이 점수는 처음 보는 데이터에서의 성능이다.",
            "Final report: measure on gold once. Gold drove no training decision, so this score is performance on unseen data.") }
      ]
    };

    K.head(root, K.t("갭 분석을 어디서 하느냐", "Where the gap analysis happens"),
      K.t("칸 하나는 평가 항목 하나(예시)다. 갭 분석에 쓸 셋을 바꿔 단계를 넘겨 보면, 어느 셋이 언제 '본 데이터'가 되는지 보인다.",
        "Each square is one evaluation item (illustrative). Switch the set used for gap analysis and step through to see which set becomes 'seen data', and when."));

    var mode = "gold", step = 0;
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "gold", label: K.t("골드로 갭 분석", "Gap analysis on gold") }, { value: "dev", label: K.t("dev 셋으로 갭 분석", "Gap analysis on dev") }],
      mode, function (v) { mode = v; step = 0; render(); }, K.t("갭 분석에 쓰는 셋", "Set used for gap analysis"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    var stLbl = K.el("span", "tca-num");
    bar.appendChild(sg.el); bar.appendChild(bNext); bar.appendChild(bReset); bar.appendChild(stLbl);
    root.appendChild(bar);

    function setBox(title) {
      var box = K.el("div", "tca-box");
      var h = K.el("div", "tca-h", title);
      var tg = K.el("span", "tca-tag");
      var grid = K.el("div", "gr-grid");
      box.appendChild(h); box.appendChild(tg); box.appendChild(grid);
      return { box: box, tag: tg, grid: grid, cells: [] };
    }
    var two = K.el("div", "tca-two");
    var G = setBox(K.t("골드 (평가셋)", "Gold (eval set)")), Dv = setBox(K.t("dev 셋", "Dev set"));
    [[G, NG], [Dv, ND]].forEach(function (p) {
      for (var i = 0; i < p[1]; i++) { var c = K.el("div", "gr-c"); p[0].grid.appendChild(c); p[0].cells.push(c); }
      two.appendChild(p[0].box);
    });
    root.appendChild(two);

    var tb = K.el("div", "tca-box");
    tb.style.marginTop = "10px";
    tb.appendChild(K.el("div", "tca-h", K.t("학습 데이터", "Training data")));
    var trainEl = K.el("div", "gr-train");
    tb.appendChild(trainEl);
    root.appendChild(tb);

    var legend = K.el("div", "tca-legend");
    [["s0", K.t("안 봄", "not looked at")], ["s1", K.t("평가에 씀", "used to evaluate")], ["s2", K.t("미탐", "missed")],
      ["s3", K.t("들여다봄 — 다음 학습에 대해 본 데이터", "looked at — seen data for the next model")], ["s4", K.t("최종 보고에만 씀", "final report only")]].forEach(function (p) {
      var sp = K.el("span"), i = K.el("i", p[0]);
      var col = { s1: "var(--code-bg)", s2: "var(--tca-warn)", s3: "var(--tca-bad)", s4: "var(--tca-good)" }[p[0]];
      if (col) i.style.background = col;
      if (p[0] === "s1") i.style.border = "1.5px solid var(--tca-accent)";
      sp.appendChild(i); sp.appendChild(document.createTextNode(p[1]));
      legend.appendChild(sp);
    });
    root.appendChild(legend);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    function paintSet(S, states, tagText, off) {
      states.forEach(function (v, i) { S.cells[i].className = "gr-c" + (v ? " s" + v : ""); });
      S.tag.textContent = tagText;
      S.grid.className = "gr-grid" + (off ? " gr-dim" : "");
    }
    function render() {
      var fl = FLOW[mode], st = fl[step];
      stLbl.textContent = K.t("단계 ", "Step ") + (step + 1) + " / " + fl.length;
      paintSet(G, st.g, st.gt, false);
      paintSet(Dv, st.d, st.dOff ? K.t("이 흐름에서는 쓰지 않는다", "not used in this flow") : st.dt, !!st.dOff);
      var gc = st.end === "bad" ? "var(--tca-bad)" : st.end === "good" ? "var(--tca-good)" : "";
      G.tag.style.color = gc; G.tag.style.borderColor = gc;
      trainEl.textContent = "";
      st.train.forEach(function (t, i) {
        var c = K.el("span", "tca-tag", t);
        if (i > 0) { c.style.color = mode === "gold" ? "var(--tca-bad)" : "var(--tca-accent)"; c.style.borderColor = c.style.color; }
        trainEl.appendChild(c);
      });
      read.textContent = st.say;
      bNext.disabled = step >= fl.length - 1;
    }
    bNext.addEventListener("click", function () { if (step < FLOW[mode].length - 1) { step++; render(); } });
    bReset.addEventListener("click", function () { step = 0; render(); });
    render();
  });
})();
