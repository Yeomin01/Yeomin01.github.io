/* 「학습한 것만 잡는가, 안 배운 것도 잡는가」 글의 그림: 어떤 평가셋으로 재야 암기와 일반화가 갈리나 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("gen-mem-eval", function (root) {
    var TRAIN = ["알파상사", "베타전자", "감마물산"];
    var SETS = {
      seen: [
        { item: "알파상사", rest: "에 입사했다", cue: true },
        { item: "베타전자", rest: " 대표가 말했다", cue: true },
        { item: "감마물산", rest: "과 계약했다", cue: true },
        { item: "알파상사", rest: " 직원이 왔다", cue: true }
      ],
      unseen: [
        { item: "델타제약", rest: "에 입사했다", cue: true },
        { item: "엡실론통신", rest: " 대표가 말했다", cue: true },
        { item: "제타식품", rest: "과 계약했다", cue: true },
        { item: "에타", rest: "를 봤다", cue: false }
      ]
    };
    var MS = 650;
    var st = { data: "repeat", set: "seen", k: K.reduce ? 4 : 0, acc: 0 };

    var D = '.tca[data-demo="gen-mem-eval"] ';
    K.css("generalization-vs-memorization-css", [
      D + ".gm-row{display:grid;grid-template-columns:minmax(0,1fr) 66px 66px;gap:6px;align-items:center;padding:5px 0;border-top:1px solid var(--tertiary)}",
      D + ".gm-head{font-size:12.5px;color:var(--secondary);border-top:0;padding-top:0}",
      D + ".gm-s{font-size:13.5px}",
      D + ".gm-item{font-weight:600}",
      D + ".gm-cue{text-decoration:underline;text-decoration-color:var(--tca-accent);text-underline-offset:3px}",
      D + ".gm-why{font-size:12px;color:var(--secondary)}",
      D + ".gm-m{font-size:12.5px;text-align:center}",
      D + ".gm-cur{background:var(--code-bg)}"
    ].join(""));

    K.head(root, K.t("어떤 평가셋으로 재야 암기와 일반화가 갈리나", "Which test set tells memorizing from generalizing"),
      K.t("회사 이름을 찾는 예시다. 규칙 기반은 학습 항목 세 개로 만든 목록을 쓴다. 학습 데이터 방식과 평가셋을 바꿔 채점해 보면, 학습에 쓴 항목만으로는 두 방식이 구분되지 않는 것이 보인다.",
        "An example of finding company names. The rule-based side uses a list made of the three training items. Switch the training data and the test set and rescore: on items seen in training the two cannot be told apart."));

    var bar = K.el("div", "tca-bar");
    var segD = K.seg([{ value: "repeat", label: K.t("학습: 같은 항목 반복", "Train: same items repeated") },
      { value: "diverse", label: K.t("학습: 다양한 항목·문맥", "Train: varied items and contexts") }],
      st.data, function (v) { st.data = v; restart(); }, K.t("학습 데이터", "Training data"));
    var segS = K.seg([{ value: "seen", label: K.t("평가: 학습에 쓴 항목", "Test: seen items") },
      { value: "unseen", label: K.t("평가: 처음 보는 항목", "Test: unseen items") }],
      st.set, function (v) { st.set = v; restart(); }, K.t("평가셋", "Test set"));
    var bAgain = K.btn(K.t("다시 채점", "Score again"));
    bar.appendChild(segD.el); bar.appendChild(segS.el); bar.appendChild(bAgain);
    root.appendChild(bar);

    var info = K.el("div", "tca-note");
    info.style.margin = "0 0 8px";
    root.appendChild(info);

    var table = K.el("div");
    var head = K.el("div", "gm-row gm-head");
    head.appendChild(K.el("div", null, K.t("평가 문장 (굵게: 항목, 밑줄: 문맥 단서)", "Test sentence (bold: item, underline: context cue)")));
    head.appendChild(K.el("div", "gm-m", K.t("규칙 기반", "Rule-based")));
    head.appendChild(K.el("div", "gm-m", K.t("학습 기반", "Learned")));
    table.appendChild(head);
    var rows = [0, 1, 2, 3].map(function () {
      var r = K.el("div", "gm-row");
      var c = K.el("div");
      var s = K.el("div", "gm-s");
      var why = K.el("div", "gm-why");
      c.appendChild(s); c.appendChild(why);
      var m1 = K.el("div", "gm-m"), m2 = K.el("div", "gm-m");
      r.appendChild(c); r.appendChild(m1); r.appendChild(m2);
      table.appendChild(r);
      return { r: r, s: s, why: why, m1: m1, m2: m2 };
    });
    root.appendChild(table);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "회사 이름은 지어낸 예시다. 학습 기반의 동작은 글의 설명(반복은 암기를, 다양성은 패턴 학습을 유도한다)을 그대로 옮긴 가정이다. 실제 모델은 이렇게 깔끔하게 나뉘지 않는다.",
      "Company names are made up. The learned model's behaviour is an assumption that restates the post (repetition leads to memorizing, variety to learning the pattern); real models are not this clean.")));

    function inTrain(it) { return TRAIN.indexOf(it) >= 0; }
    function judge(x) {
      var rule = inTrain(x.item);
      var learned, why;
      if (inTrain(x.item)) { learned = true; why = K.t("학습 기반 근거: 학습 때 본 항목", "Learned: item seen in training"); }
      else if (st.data === "diverse" && x.cue) { learned = true; why = K.t("학습 기반 근거: 문맥 단서 '", "Learned: context cue '") + x.rest.trim() + "'"; }
      else if (st.data === "diverse") { learned = false; why = K.t("학습 기반 근거: 단서가 없다", "Learned: no cue to go on"); }
      else { learned = false; why = K.t("학습 기반 근거: 외운 목록에 없다", "Learned: not among the memorized items"); }
      return { rule: rule, learned: learned, why: why };
    }
    function mark(el, ok) {
      el.textContent = ok ? K.t("✓ 잡음", "✓ found") : K.t("✗ 놓침", "✗ missed");
      el.className = "gm-m " + (ok ? "tca-good" : "tca-bad") + (K.reduce ? "" : " tca-pop");
    }
    function render() {
      var set = SETS[st.set];
      info.textContent = st.data === "repeat"
        ? K.t("학습 데이터: 알파상사·베타전자·감마물산이 같은 문장 틀로 여러 번 들어 있다.", "Training data: 알파상사, 베타전자 and 감마물산, many times in the same sentence frame.")
        : K.t("학습 데이터: 여러 회사 이름이 여러 문맥으로 들어 있다(알파상사·베타전자·감마물산 포함). 규칙 기반의 목록은 그대로 세 개다.", "Training data: many company names in many contexts (including the three). The rule list is still those three.");
      var nr = 0, nl = 0;
      set.forEach(function (x, i) {
        var row = rows[i];
        row.s.textContent = "";
        row.s.appendChild(K.el("span", "gm-item", x.item));
        row.s.appendChild(K.el("span", x.cue ? "gm-cue" : null, x.rest));
        row.r.className = "gm-row" + (i === st.k && st.k < 4 ? " gm-cur" : "");
        if (i < st.k) {
          var j = judge(x);
          if (j.rule) nr++;
          if (j.learned) nl++;
          if (!row.m1.textContent) { mark(row.m1, j.rule); mark(row.m2, j.learned); }
          row.why.textContent = j.why;
        } else {
          row.m1.textContent = ""; row.m2.textContent = ""; row.m1.className = row.m2.className = "gm-m";
          row.why.textContent = "";
        }
      });
      if (st.k < 4) { read.textContent = K.t("채점 중 ", "Scoring ") + st.k + "/4"; return; }
      var sc = K.t("규칙 기반 ", "Rule-based ") + nr + "/4 · " + K.t("학습 기반 ", "learned ") + nl + "/4 — ";
      if (st.set === "seen") read.textContent = sc + K.t("학습에 쓴 항목으로는 두 방식이 같은 점수다. 외운 것인지 일반화한 것인지 이 평가로는 알 수 없다.",
        "same score on seen items; this test cannot say whether anything generalized.");
      else if (nl === 0) read.textContent = sc + K.t("학습 기반도 처음 보는 항목을 못 잡는다. 목록을 외운 것과 같은 동작이라 암기에 가깝다.",
        "the learned model misses every unseen item, just like a list; closer to memorizing.");
      else read.textContent = sc + K.t("문맥 단서가 있는 새 항목은 잡고, 단서가 없는 '에타' 는 놓친다. 일반화가 일어났다.",
        "it finds new items that come with a context cue and misses '에타', which has none; this is generalization.");
    }
    function restart() { st.k = K.reduce ? 4 : 0; st.acc = 0; rows.forEach(function (r) { r.m1.textContent = ""; }); render(); }
    bAgain.addEventListener("click", restart);
    K.loop(root, function (dt) {
      if (st.k >= 4) return;
      st.acc += dt;
      if (st.acc < MS) return;
      st.acc = 0;
      st.k++;
      render();
    });
    render();
  });
})();
