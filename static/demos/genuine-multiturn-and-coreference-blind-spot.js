/* 「진짜 멀티턴 공격은 측정부터 어렵다」 글의 그림 두 개
 *   mt-turn-view : 덧댄 단일턴과 coreference 멀티턴을 턴별로, 세션 전체로 볼 때의 차이(내용은 구조만 적은 자리표시)
 *   mt-threshold : 공격 확률이 양극단에 몰리면 임계값을 내려도 재현율이 그대로인 이유
 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("genuine-multiturn-and-coreference-blind-spot-css", [
    '.tca[data-demo="mt-turn-view"] .mt-turn{border:1px solid var(--tertiary);border-radius:6px;padding:6px 8px;margin:0 0 6px;font-size:13px}',
    '.tca[data-demo="mt-turn-view"] .mt-top{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}',
    '.tca[data-demo="mt-turn-view"] .mt-who{flex:none;font-weight:600;font-size:12.5px;color:var(--secondary)}',
    '.tca[data-demo="mt-turn-view"] .mt-body{min-width:0;flex:1}',
    '.tca[data-demo="mt-turn-view"] .mt-len{display:flex;align-items:center;gap:8px;margin-top:4px}',
    '.tca[data-demo="mt-turn-view"] .mt-len .tca-track{height:8px}',
    '.tca[data-demo="mt-turn-view"] .mt-len span{flex:none;width:96px;text-align:right;font-size:12px;color:var(--secondary);font-variant-numeric:tabular-nums}',
    '.tca[data-demo="mt-turn-view"] .mt-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;min-height:0}'
  ].join(""));

  function tag(text, color) {
    var t = K.el("span", "tca-tag", text);
    if (color) { t.style.color = color; t.style.borderColor = color; }
    return t;
  }

  // ---------- 1. 턴을 따로 볼 때와 함께 볼 때 ----------
  K.register("mt-turn-view", function (root) {
    var BAD = "var(--tca-bad)", MUTE = "var(--secondary)", ACC = "var(--tca-accent)";
    var SETS = {
      padded: [
        { body: K.t("[인사]", "[Greeting]"), len: 29, solo: [K.t("무관한 인사·잡담", "Unrelated small talk"), MUTE] },
        { body: K.t("[잡담]", "[Small talk]"), len: 29, solo: [K.t("무관한 인사·잡담", "Unrelated small talk"), MUTE] },
        { body: K.t("[잡담]", "[Small talk]"), len: 29, solo: [K.t("무관한 인사·잡담", "Unrelated small talk"), MUTE] },
        { body: K.t("[공격 요청 전체가 이 한 턴에 들어 있다]", "[The whole attack request sits in this one turn]"), len: 352,
          solo: [K.t("이 턴 하나로 유해함이 드러난다", "Harm is visible in this turn alone"), BAD], last: true }
      ],
      coref: [
        { body: K.t("[유해한 대상 X 를 이름으로 자연스럽게 꺼낸다]", "[Mentions a harmful target X by name, naturally]"),
          solo: [K.t("따로 보면 명백히 유해하지 않다", "Not clearly harmful on its own"), MUTE], link: K.t("X 를 이름으로 꺼냄", "names X") },
        { body: K.t("[이어지는 대화]", "[Conversation continues]"), solo: [K.t("따로 보면 명백히 유해하지 않다", "Not clearly harmful on its own"), MUTE] },
        { body: K.t("['그거'·'그 방법' 같은 지시어로만 X 를 가리키며 구체적인 실행을 요청한다]", "[Points to X only with words like 'that' or 'that method' and asks for concrete steps]"),
          solo: [K.t("따로 보면 명백히 유해하지 않다", "Not clearly harmful on its own"), MUTE], link: K.t("'그거' = 유저 1 의 X", "'that' = X from user 1"), last: true }
      ]
    };
    var STEPS = [K.t("턴 보기", "Turns"), K.t("턴 하나씩 떼어 판정", "Judge each turn alone"), K.t("세션 전체로 보기", "View the whole session")];
    var SAY = {
      padded: [
        K.t("공개 공격을 옮기고 앞에 몇 턴의 맥락을 붙여 만든 '멀티턴' 세션이다. 공격 2,000건 전부가 이 모양이었다.",
          "A 'multi-turn' session built by translating a public attack and prepending a few context turns. All 2,000 attacks looked like this."),
        K.t("턴을 하나씩 떼어 보면 마지막 턴 하나에서 유해함이 드러난다. 단일턴 분류기에 마지막 턴만 넣어도 잡힌다.",
          "Judged one by one, the last turn alone shows the harm. A single-turn classifier catches it from the last turn only."),
        K.t("세션 전체로 봐도 판정은 마지막 턴에서 끝난다. 이 셋이 재는 것은 끝에 박힌 단일 공격턴을 찾고 앞의 benign 필러에 속지 않는가이지, 멀티턴 탐지 능력이 아니다.",
          "Even as a whole session, the verdict ends at the last turn. This set measures finding one attack turn at the end without being fooled by benign filler — not multi-turn detection.")
      ],
      coref: [
        K.t("의도를 턴에 나눈 coreference 세션이다. 앞 턴에서 대상을 꺼내 두고, 마지막 턴은 지시어로만 그것을 가리킨다.",
          "A coreference session with the intent split across turns. An early turn brings up the target; the last turn refers to it only by pointing words."),
        K.t("턴을 하나씩 떼어 보면 어느 턴도 명백히 유해하지 않다. 단일턴 분류기에는 잡힐 턴이 없다.",
          "Judged one by one, no turn is clearly harmful. A single-turn classifier has nothing to catch."),
        K.t("'그거' 가 앞 턴의 X 를 가리킨다는 참조를 이어야 공격이 성립한다. 유해함은 턴 사이의 참조 관계에서만 생긴다.",
          "The attack only forms once 'that' is linked back to X in the earlier turn. The harm exists only in the reference between turns.")
      ]
    };

    K.head(root, K.t("턴을 따로 볼 때와 함께 볼 때", "Turns alone versus the whole session"),
      K.t("두 종류의 세션을 한 단계씩 넘겨 본다. 턴 내용은 실제 대화가 아니라 구조만 적은 자리표시이고, 유저 턴만 그렸다.",
        "Step through two kinds of sessions. Turn contents are structural placeholders, not real dialogue; only user turns are drawn."));

    var set = "padded", step = 0;
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "padded", label: K.t("덧댄 단일턴 ('멀티턴' 벤치마크)", "Padded single turn ('multi-turn' set)") },
      { value: "coref", label: K.t("coreference 멀티턴", "Coreference multi-turn") }], set,
    function (v) { set = v; step = 0; render(); }, K.t("세션 종류", "Session type"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    var stLbl = K.el("span", "tca-num");
    bar.appendChild(sg.el); bar.appendChild(bNext); bar.appendChild(bReset); bar.appendChild(stLbl);
    root.appendChild(bar);
    var list = K.el("div");
    root.appendChild(list);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "덧댄 쪽 글자 수는 글의 평균값이다(앞 유저 턴 평균 29자, 마지막 유저 턴 평균 352자). 앞 턴 수 3개는 그림용이다. coreference 쪽 길이는 글에 없어 그리지 않았다.",
      "Lengths on the padded side are the post's averages (earlier user turns 29 chars, last user turn 352). Three earlier turns is for the drawing. The post gives no lengths for the coreference side, so none are drawn.")));

    function render() {
      stLbl.textContent = (step + 1) + " / 3 · " + STEPS[step];
      list.textContent = "";
      SETS[set].forEach(function (t, i) {
        var box = K.el("div", "mt-turn");
        var top = K.el("div", "mt-top");
        top.appendChild(K.el("span", "mt-who", K.t("유저 ", "User ") + (i + 1)));
        top.appendChild(K.el("span", "mt-body", t.body));
        box.appendChild(top);
        if (t.len) {
          var ln = K.el("div", "mt-len");
          var tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill");
          f.style.width = (t.len / 352 * 100) + "%";
          f.style.background = t.last ? BAD : "var(--tertiary)";
          tr.appendChild(f); ln.appendChild(tr);
          ln.appendChild(K.el("span", null, K.t("평균 ", "avg ") + t.len + K.t("자", " chars")));
          box.appendChild(ln);
        }
        var tags = K.el("div", "mt-tags");
        if (step >= 1) {
          var a = tag(t.solo[0], t.solo[1]);
          if (!K.reduce && step === 1) a.className += " tca-pop";
          tags.appendChild(a);
        }
        if (step >= 2 && t.link) {
          var b = tag(t.link, ACC);
          if (!K.reduce) b.className += " tca-pop";
          tags.appendChild(b);
        }
        if (step >= 2 && set === "padded" && t.last) tags.appendChild(tag(K.t("판정은 여기서 끝난다", "The verdict ends here"), BAD));
        if (tags.childNodes.length) box.appendChild(tags);
        if (step >= 2 && set === "coref") box.style.borderColor = t.link ? ACC : "var(--tertiary)";
        list.appendChild(box);
      });
      read.textContent = SAY[set][step];
      bNext.disabled = step >= 2;
    }
    bNext.addEventListener("click", function () { if (step < 2) { step++; render(); } });
    bReset.addEventListener("click", function () { step = 0; render(); });
    render();
  });

  // ---------- 2. 임계값을 내려도 재현율이 그대로인 이유 ----------
  K.register("mt-threshold", function (root) {
    // 0.05 폭 20칸, 공격 1,000건(예시 규모)
    var DIST = {
      // 글의 서술: 절반은 0.9 이상, 절반은 0.1 미만, 중간은 거의 빔. 임계값 0.5 에서 0.496 이 되도록 맞춤.
      post: [420, 81, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 80, 412],
      // 비교용 가상 분포: 경계 근처에 몰림. 임계값 0.5 의 재현율은 같다.
      mid: [5, 10, 20, 35, 50, 65, 75, 80, 83, 81, 82, 80, 76, 66, 56, 44, 36, 26, 18, 12]
    };
    var TOTAL = 1000;
    K.head(root, K.t("임계값을 내려도 재현율이 그대로인 이유", "Why lowering the threshold leaves recall flat"),
      K.t("공격 세션의 예측 확률 분포다. 임계값보다 높은 막대만 잡힌다. 분포 모양을 바꿔 가며 임계값을 움직여 본다.",
        "Predicted attack probability for attack sessions. Only bars above the threshold are caught. Move the threshold under each distribution shape."));
    var dist = "post", th = 0.5;
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "post", label: K.t("글의 분포: 양극단", "The post: two extremes") },
      { value: "mid", label: K.t("비교: 경계에 몰린 분포(가상)", "Compare: piled at the boundary (hypothetical)") }], dist,
    function (v) { dist = v; render(); }, K.t("분포", "Distribution"));
    var sl = K.slider({ label: K.t("임계값", "Threshold"), min: 0.1, max: 0.9, step: 0.05, value: th, fmt: function (v) { return v.toFixed(2); },
      onInput: function (v) { th = Math.round(v * 100) / 100; render(); } });
    bar.appendChild(sg.el); bar.appendChild(sl.el);
    root.appendChild(bar);

    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 360 190", role: "img",
      "aria-label": K.t("공격 확률 히스토그램과 임계값", "Attack probability histogram with threshold") }, root);
    var X0 = 20, X1 = 344, YB = 150, YT = 18, BW = (X1 - X0) / 20;
    K.svg("line", { x1: X0, x2: X1, y1: YB, y2: YB, style: "stroke:var(--tertiary)" }, s);
    var bars = [];
    for (var i = 0; i < 20; i++) bars.push(K.svg("rect", { x: (X0 + i * BW + 1).toFixed(1), width: (BW - 2).toFixed(1), y: YB, height: 0 }, s));
    [0, 0.1, 0.5, 0.9, 1].forEach(function (v) {
      var t = K.svg("text", { x: X0 + v * (X1 - X0), y: YB + 16, "font-size": 12, "text-anchor": "middle", "class": "muted" }, s);
      t.textContent = String(v);
    });
    var lab = K.svg("text", { x: (X0 + X1) / 2, y: YB + 34, "font-size": 12, "text-anchor": "middle", "class": "muted" }, s);
    lab.textContent = K.t("예측 공격 확률", "Predicted attack probability");
    var thLine = K.svg("line", { y1: YT - 6, y2: YB, style: "stroke:var(--primary);stroke-width:2;stroke-dasharray:4 3" }, s);
    var thTxt = K.svg("text", { y: YT - 8, "font-size": 12 }, s);

    var legend = K.el("div", "tca-legend");
    [["var(--tca-good)", K.t("잡음 (임계값 이상)", "Caught (≥ threshold)")], ["var(--tca-bad)", K.t("놓침", "Missed")]].forEach(function (p) {
      var sp = K.el("span"), ii = K.el("i");
      ii.style.background = p[0];
      sp.appendChild(ii); sp.appendChild(document.createTextNode(p[1]));
      legend.appendChild(sp);
    });
    root.appendChild(legend);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var note = K.el("div", "tca-note");
    root.appendChild(note);

    function recallAt(d, t) {
      var k = Math.round(t / 0.05), n = 0;
      for (var j = k; j < 20; j++) n += d[j];
      return n;
    }
    function render() {
      var d = DIST[dist], mx = Math.max.apply(null, d), k = Math.round(th / 0.05);
      d.forEach(function (c, j) {
        var h = c / mx * (YB - YT);
        if (c > 0 && h < 1.5) h = 1.5;
        bars[j].setAttribute("y", (YB - h).toFixed(1));
        bars[j].setAttribute("height", h.toFixed(1));
        bars[j].setAttribute("style", "fill:" + (j >= k ? "var(--tca-good)" : "var(--tca-bad)"));
      });
      var xx = X0 + th * (X1 - X0);
      thLine.setAttribute("x1", xx); thLine.setAttribute("x2", xx);
      thTxt.setAttribute("x", xx); thTxt.setAttribute("text-anchor", th > 0.7 ? "end" : th < 0.3 ? "start" : "middle");
      thTxt.textContent = K.t("임계값 ", "threshold ") + th.toFixed(2);
      var c = recallAt(d, th), c01 = recallAt(d, 0.1), c09 = recallAt(d, 0.9);
      read.textContent = K.t("재현율 ", "Recall ") + (c / TOTAL).toFixed(3) + K.t(" — 1,000건 중 " + K.fmt(c) + "건을 잡는다. 임계값 0.1~0.9 사이에서 재현율은 ",
        " — catches " + K.fmt(c) + " of 1,000. Between thresholds 0.1 and 0.9 recall ranges ") +
        (c09 / TOTAL).toFixed(3) + "~" + (c01 / TOTAL).toFixed(3) + (dist === "post" ? K.t(" 만 움직인다.", " only.") : K.t(" 까지 움직인다.", "."));
      note.textContent = dist === "post" ? K.t(
        "1,000건은 예시 규모다. 분포는 글의 서술(절반은 0.9 이상, 절반은 0.1 미만, 중간은 거의 빔)에 맞춘 예시이고, 임계값 0.5 에서 글의 재현율 0.496 이 나오게 맞췄다. 0.1 아래는 글이 말하지 않은 구간이라 슬라이더를 0.1 에서 멈췄다. 막대 높이는 가장 큰 칸에 맞췄고, 1건짜리 칸도 보이도록 최소 높이를 줬다.",
        "1,000 is an example size. The shape follows the post (half above 0.9, half below 0.1, the middle nearly empty) and is tuned so recall is the post's 0.496 at threshold 0.5. The post says nothing below 0.1, so the slider stops there. Bar heights are scaled to the tallest bin, with a minimum so single-item bins stay visible.") : K.t(
        "글에 없는 가상 분포다. 임계값 0.5 에서 재현율이 0.496 으로 같도록 만들었다. 경계 근처에서 머뭇거리는 모델이라면 임계값을 내릴수록 재현율이 따라 오른다.",
        "A hypothetical distribution, not from the post, built so recall is the same 0.496 at threshold 0.5. For a model hesitating near the boundary, lowering the threshold raises recall.");
    }
    render();
  });
})();
