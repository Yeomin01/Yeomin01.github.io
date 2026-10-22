/* 「오답을 데이터로 메우다」 글의 그림: 오답을 출처별로 묶고, 출처에 맞는 데이터로 하나씩 메우기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="errmap-sources"] ';
  K.css("error-analysis-driven-data-augmentation-css", [
    S + ".ea-head{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:0 0 4px}",
    S + ".ea-col{text-align:center;font-size:12.5px;line-height:1.35;padding:0 2px;transition:opacity .3s ease}",
    S + ".ea-col b{display:block;font-weight:600;color:var(--primary)}",
    S + ".ea-col span{color:var(--secondary)}",
    S + ".ea-col .ea-n{display:block;font-variant-numeric:tabular-nums;color:var(--primary);margin-top:2px}",
    S + ".ea-field{position:relative;height:112px;border:1px solid var(--tertiary);border-radius:6px;background:var(--code-bg);overflow:hidden}",
    S + ".ea-sep{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed var(--tertiary);transition:opacity .3s ease}",
    S + ".ea-sep.ea-mid{border-left:2px solid var(--secondary)}",
    S + ".ea-dot{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border:2px solid transparent;",
    "transition:left .6s ease,top .6s ease,opacity .4s ease,background-color .4s ease}",
    S + ".ea-fp{border-radius:50%}",
    S + ".ea-fn{border-radius:2px}",
    S + ".ea-fixed{background:transparent!important;opacity:.55}",
    S + ".ea-side{display:flex;justify-content:space-between;font-size:12px;color:var(--secondary);margin:4px 2px 0}",
    "@media (prefers-reduced-motion:reduce){" + S + ".ea-dot," + S + ".ea-col," + S + ".ea-sep{transition:none}}"
  ].join(""));

  K.register("errmap-sources", function (root) {
    var COLS = [
      [K.t("실제 대화", "Real chats"), K.t("콜센터·SNS", "calls · SNS")],
      [K.t("생성 정상", "Generated"), K.t("깔끔한 문장", "clean benign")],
      [K.t("난독화 공격", "Obfuscated"), K.t("초성·은어", "initials · slang")],
      [K.t("그 밖의", "Other"), K.t("공격", "attacks")]
    ];
    var FP_C = K.COLORS[1], FN_C = K.COLORS[0];
    // 예시 값: 과차단 15건(실제 대화 14 · 생성 1), 미탐 14건(난독화 12 · 그 밖 2)
    var GROUPS = [
      { col: 0, type: "fp", n: 14, fixAt: 3, left: 2 },
      { col: 1, type: "fp", n: 1, fixAt: 99, left: 1 },
      { col: 2, type: "fn", n: 12, fixAt: 4, left: 2 },
      { col: 3, type: "fn", n: 2, fixAt: 99, left: 2 }
    ];
    var STEPS = [
      K.t("held-out 오답을 한데 모으면 점수와 오답 수만 보인다.", "Pooled together, held-out errors show only a score and a count."),
      K.t("출처별로 묶으니 과차단은 실제 대화에, 미탐은 난독화 공격에 몰려 있다.", "Grouped by source, over-blocking piles up on real chats and misses on obfuscated attacks."),
      K.t("실제 사람 대화를 학습 정상 데이터에 더했다. 실제 대화의 과차단이 크게 줄고, 공격을 놓치는 수는 그대로다.", "Real human chats were added to the benign training data. Over-blocking on real chats drops sharply; misses stay the same."),
      K.t("초성·은어로 가린 멀티턴 공격을 생성해 더했다. 놓치던 난독화 공격을 대부분 잡는다.", "Generated multi-turn attacks hidden with initials and slang were added. Most of the missed obfuscated attacks are now caught.")
    ];
    var step = 1;

    K.head(root, K.t("오답을 출처별로 묶고, 출처에 맞게 메우기", "Group the errors by source, then fill each one"),
      K.t("동그라미는 정상을 공격으로 본 과차단(FP), 네모는 공격을 놓친 미탐(FN)이다. 단계를 넘기면 오답이 출처로 모이고, 맞는 데이터를 넣은 쪽만 줄어든다.",
        "Circles are over-blocks (FP, benign judged as attack); squares are misses (FN). Step forward to see errors gather by source and shrink only where the matching data went in."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([1, 2, 3, 4].map(function (i) {
      return { value: i, label: [K.t("① 모아 보기", "1 Pooled"), K.t("② 출처별로", "2 By source"),
        K.t("③ 실제 대화 보강", "3 Add real chats"), K.t("④ 난독화 보강", "4 Add obfuscation")][i - 1] };
    }), step, function (v) { step = v; render(); }, K.t("단계", "Step"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    bar.appendChild(sg.el); bar.appendChild(bNext);
    root.appendChild(bar);

    var head = K.el("div", "ea-head");
    var colEls = COLS.map(function (c) {
      var d = K.el("div", "ea-col");
      d.appendChild(K.el("b", null, c[0]));
      d.appendChild(K.el("span", null, c[1]));
      var n = K.el("span", "ea-n");
      d.appendChild(n);
      head.appendChild(d);
      return { d: d, n: n };
    });
    root.appendChild(head);

    var field = K.el("div", "ea-field");
    var seps = [25, 50, 75].map(function (x) {
      var s = K.el("div", "ea-sep" + (x === 50 ? " ea-mid" : ""));
      s.style.left = x + "%";
      field.appendChild(s);
      return s;
    });
    root.appendChild(field);
    var side = K.el("div", "ea-side");
    side.appendChild(K.el("span", null, K.t("← 정상 데이터 출처", "← benign sources")));
    side.appendChild(K.el("span", null, K.t("공격 데이터 출처 →", "attack sources →")));
    root.appendChild(side);

    var leg = K.el("div", "tca-legend");
    [[FP_C, "50%", K.t("과차단(FP)", "Over-block (FP)")], [FN_C, "2px", K.t("미탐(FN)", "Miss (FN)")],
      ["transparent", "50%", K.t("빈 테두리: 보강 뒤 맞힌 오답", "Hollow: fixed after augmentation")]].forEach(function (x) {
      var s = K.el("span"), i = K.el("i");
      i.style.background = x[0]; i.style.borderRadius = x[1]; i.style.width = "10px";
      if (x[0] === "transparent") i.style.border = "2px solid var(--secondary)";
      s.appendChild(i); s.appendChild(document.createTextNode(x[2])); leg.appendChild(s);
    });
    root.appendChild(leg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "점의 개수는 예시 값이다. 본문은 건수 없이, 실제 대화의 과차단이 크게 줄고 놓치는 비율은 그대로였으며 난독화 공격은 대부분 잡게 됐다고만 적었다.",
      "Dot counts are example values. The post gives no counts; it only says over-blocking on real chats dropped sharply while the miss rate held, and that most obfuscated attacks were then caught.")));

    // 점 만들기. 흩어진 자리는 시드 난수로 고정한다.
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var dots = [];
    GROUPS.forEach(function (g) {
      for (var k = 0; k < g.n; k++) {
        var el = K.el("span", "ea-dot " + (g.type === "fp" ? "ea-fp" : "ea-fn"));
        var c = g.type === "fp" ? FP_C : FN_C;
        el.style.backgroundColor = c; el.style.borderColor = c;
        el.style.transitionDelay = (dots.length * 12) + "ms";
        field.appendChild(el);
        dots.push({ el: el, g: g, k: k, sx: 5 + rnd() * 90, sy: 14 + rnd() * 84 });
      }
    });

    function render() {
      sg.set(step);
      bNext.disabled = step >= 4;
      var grouped = step >= 2, fp = 0, fn = 0, colN = [0, 0, 0, 0];
      dots.forEach(function (d) {
        var g = d.g, fixed = step >= g.fixAt && d.k >= g.left;
        if (grouped) {
          var cx = (g.col + 0.5) * 25, r = Math.floor(d.k / 4), c = d.k % 4;
          d.el.style.left = "calc(" + cx + "% + " + ((c - 1.5) * 16) + "px)";
          d.el.style.top = (16 + r * 18) + "px";
        } else {
          d.el.style.left = d.sx + "%";
          d.el.style.top = d.sy + "px";
        }
        d.el.className = "ea-dot " + (g.type === "fp" ? "ea-fp" : "ea-fn") + (fixed ? " ea-fixed" : "");
        if (!fixed) { if (g.type === "fp") fp++; else fn++; colN[g.col]++; }
      });
      colEls.forEach(function (c, i) {
        c.d.style.opacity = grouped ? "1" : "0.25";
        c.n.textContent = grouped ? colN[i] + K.t("건", "") : "·";
      });
      seps.forEach(function (s) { s.style.opacity = grouped ? "1" : "0"; });
      read.textContent = STEPS[step - 1] + " " + K.t("남은 오답: 과차단 ", "Errors left: FP ") + fp +
        K.t("건 · 미탐 ", " · FN ") + fn + K.t("건", "");
    }
    bNext.addEventListener("click", function () { if (step < 4) { step++; render(); } });
    render();
  });
})();
