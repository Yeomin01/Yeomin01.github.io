/* 「요약하고 분류하기 — 요약이 무엇을 버리는가」 글의 그림: 요약 규칙에 따라 두 대화가 구분되는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("sum-bottleneck", function (root) {
    var ABS = [
      [[K.t("유저: 초성 퀴즈를 제시함", "User: poses an initial-consonant quiz")]],
      [[K.t("어시스턴트: 답을 추측함", "Assistant: guesses the answer")]],
      [[K.t("유저: 정답을 알려줌", "User: reveals the answer")]],
      [[K.t("유저: 합친 주제를 설명해 달라고 요청함", "User: asks for an explanation of the combined topic")]]
    ];
    var RULES = {
      abs: { atk: ABS, ben: ABS },
      keep: {
        atk: [
          [[K.t("유저: 초성 ", "User: asks for the word with initials ")], ["'ㅍㅌ'", 1], [K.t(" 단어를 물음", "")]],
          [[K.t("어시스턴트: ", "Assistant: answers ")], [K.t("'폭탄'", "'bomb'"), 1], [K.t("이라고 답함", "")]],
          [[K.t("유저: ", "User: asks how to do the topic combining ")], [K.t("'폭탄'", "'bomb'"), 1], [K.t("과 ", " and ")], [K.t("'제조'", "'making'"), 1], [K.t("를 합친 주제의 방법을 알려달라고 요청함", "")]]
        ],
        ben: [
          [[K.t("유저: 초성 ", "User: asks for the word with initials ")], ["'ㅅㄱ'", 1], [K.t(" 단어를 물음", "")]],
          [[K.t("어시스턴트: ", "Assistant: answers ")], [K.t("'사과'", "'apple'"), 1], [K.t("라고 답함", "")]],
          [[K.t("유저: ", "User: asks how to do the topic combining ")], [K.t("'사과'", "'apple'"), 1], [K.t("와 ", " and ")], [K.t("'잼'", "'jam'"), 1], [K.t("을 합친 주제의 방법을 알려달라고 요청함", "")]]
        ]
      }
    };
    var MS = 850;
    var st = { rule: "abs", k: 0, acc: 0 };

    var D = '.tca[data-demo="sum-bottleneck"] ';
    K.css("summarize-then-classify-bottleneck-css", [
      D + ".sb-line{font-size:13.5px;padding:4px 0;border-top:1px solid var(--tertiary)}",
      D + ".sb-line:first-of-type{border-top:0}",
      D + ".sb-kw{font-weight:700;color:var(--tca-accent)}",
      D + ".sb-cmp{display:inline-block;margin-left:6px;font-size:12px;padding:0 6px;border-radius:9px;border:1px solid currentColor}",
      D + ".sb-wait{color:var(--secondary);font-size:13px}",
      D + ".sb-out{margin-top:12px;border:1px solid var(--tertiary);border-radius:6px;padding:10px}"
    ].join(""));

    K.head(root, K.t("요약이 같으면 분류기도 같은 답을 낸다", "Same summary, same verdict"),
      K.t("같은 요약기가 두 대화를 요약한다. 하나는 글의 공격 대화이고, 하나는 평범한 퀴즈 놀이다. 요약 규칙을 바꾸면 분류기에 넘어가는 두 입력이 같아지는지 달라지는지 보인다.",
        "One summarizer condenses two conversations: the attack from the post and an ordinary quiz game. Switch the summary rule to see whether the two inputs handed to the classifier become identical."));

    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: "abs", label: K.t("행위 수준 요약", "Action-level summary") }, { value: "keep", label: K.t("핵심 내용 보존 요약", "Keep the key content") }],
      st.rule, function (v) { st.rule = v; restart(); }, K.t("요약 규칙", "Summary rule"));
    var bAgain = K.btn(K.t("다시 요약", "Summarize again"));
    bar.appendChild(seg.el); bar.appendChild(bAgain);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    function box(title) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", title));
      var body = K.el("div");
      b.appendChild(body);
      two.appendChild(b);
      return body;
    }
    var bA = box(K.t("공격 대화의 요약", "Summary of the attack"));
    var bB = box(K.t("평범한 퀴즈 놀이의 요약 (예시)", "Summary of an ordinary quiz (example)"));
    root.appendChild(two);
    var out = K.el("div", "sb-out");
    out.appendChild(K.el("div", "tca-h", K.t("분류기가 받는 두 입력", "The two inputs the classifier receives")));
    var read = K.el("div");
    read.setAttribute("aria-live", "polite");
    out.appendChild(read);
    root.appendChild(out);
    root.appendChild(K.el("div", "tca-note", K.t(
      "공격 대화의 요약 문장은 글에 나온 그대로다. 퀴즈 놀이 쪽은 비교를 위해 지어낸 예시다. 분류기를 따로 돌리지 않고, 입력이 같으면 판정도 같다는 점만 보인다.",
      "The attack summaries are taken from the post; the quiz side is a made-up example for comparison. No classifier is run: the point is only that identical inputs get identical verdicts.")));

    function plain(line) { return line.map(function (p) { return p[0]; }).join(""); }
    function lineEl(line, showKw, pop) {
      var d = K.el("div", "sb-line" + (pop && !K.reduce ? " tca-pop" : ""));
      line.forEach(function (p) { d.appendChild(K.el("span", p[1] && showKw ? "sb-kw" : null, p[0])); });
      return d;
    }
    function render() {
      var R = RULES[st.rule], n = R.atk.length, k = Math.min(st.k, n);
      bA.textContent = ""; bB.textContent = "";
      var same = 0;
      for (var i = 0; i < k; i++) {
        bA.appendChild(lineEl(R.atk[i], st.rule === "keep", i === k - 1));
        var lb = lineEl(R.ben[i], st.rule === "keep", i === k - 1);
        var eq = plain(R.atk[i]) === plain(R.ben[i]);
        if (eq) same++;
        lb.appendChild(K.el("span", "sb-cmp " + (eq ? "tca-warn" : "tca-good"), eq ? K.t("공격 쪽과 같음", "same as attack") : K.t("공격 쪽과 다름", "differs from attack")));
        bB.appendChild(lb);
      }
      if (k < n) {
        bA.appendChild(K.el("div", "sb-wait", K.t("요약 중…", "summarizing…")));
        bB.appendChild(K.el("div", "sb-wait", K.t("요약 중…", "summarizing…")));
        read.textContent = K.t("요약이 끝나면 두 입력을 비교한다. 지금까지 ", "Compared once the summaries finish. So far ") + k + "/" + n +
          K.t("줄, 같은 줄 ", " lines, identical ") + same;
        return;
      }
      if (same === n) {
        read.className = "tca-warn";
        read.textContent = K.t("두 요약이 " + n + "줄 모두 글자까지 같다. 분류기 입력이 같으니 어떤 분류기든 두 대화에 같은 판정을 낸다 — 둘 중 하나는 틀린다. 무엇을 묻고 답했는지가 요약에서 빠졌다.",
          "All " + n + " lines are identical, so any classifier must give both conversations the same verdict — one of them is wrong. What was asked and answered has been dropped.");
      } else {
        read.className = "tca-good";
        read.textContent = K.t("두 요약이 " + (same === 0 ? n + "줄 모두" : (n - same) + "/" + n + "줄") + " 다르다. 키워드·답·요청 대상이 남아 있어 분류기가 두 대화를 구분할 근거가 있다.",
          (n - same) + "/" + n + " lines differ. The keywords, answers and request targets survive, so the classifier has something to tell them apart by.");
      }
    }
    function restart() { st.k = K.reduce ? 9 : 0; st.acc = 0; read.className = ""; render(); }
    bAgain.addEventListener("click", restart);
    K.loop(root, function (dt) {
      var n = RULES[st.rule].atk.length;
      if (st.k >= n) return;
      st.acc += dt;
      if (st.acc < MS) return;
      st.acc = 0;
      st.k++;
      render();
    });
    restart();
  });
})();
