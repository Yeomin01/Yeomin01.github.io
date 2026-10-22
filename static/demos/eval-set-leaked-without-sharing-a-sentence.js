/* 「겉보기 개선은 평가셋의 틀을 외운 몫이었다」 글의 그림: 문장 대조로는 0건인데 값 자리를 비우고 5-gram으로 보면 틀이 겹치는 과정 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("leak-template-audit", function (root) {
    // 토큰: 문자열이면 일반 단어, [값, 라벨]이면 개인정보 스팬. 예문은 한국어 자료라 영어판에서도 그대로 둔다
    var PAIRS = {
      tpl: {
        gold: ["작성", "부서는", ["기획예산팀", K.t("기관명", "ORG")], "이고", "담당자는", ["정하늘", K.t("이름", "NAME")], "수석", "입니다"],
        train: ["작성", "부서는", ["시설관리팀", K.t("기관명", "ORG")], "이고", "담당자는", ["오세진", K.t("이름", "NAME")], "수석", "입니다"]
      },
      idiom: {
        gold: [["박도윤", K.t("이름", "NAME")], "고객님", "주소", "변경", "건은", "다시", "한번", "확인해", "주시기", "바랍니다"],
        train: ["배송", "일정은", "문자로", "안내되니", "다시", "한번", "확인해", "주시기", "바랍니다"]
      }
    };
    var pair = "tpl", step = 1, phOnly = true;

    K.css("eval-set-leaked-without-sharing-a-sentence-css", [
      '.tca[data-demo="leak-template-audit"] .lt-r{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:2px 0 8px}',
      '.tca[data-demo="leak-template-audit"] .lt-r .w{border:1px solid var(--tertiary);border-radius:4px;padding:1px 6px;font-size:13px;background:var(--theme)}',
      '.tca[data-demo="leak-template-audit"] .lt-r .p{border-color:var(--tca-warn);color:var(--tca-warn);font-weight:600}',
      '.tca[data-demo="leak-template-audit"] .lt-g{display:flex;flex-direction:column;gap:3px;font-size:12.5px}',
      '.tca[data-demo="leak-template-audit"] .lt-g div{display:flex;gap:8px;justify-content:space-between;border-bottom:1px solid var(--tertiary);padding:2px 0}',
      '.tca[data-demo="leak-template-audit"] .lt-g span:first-child{min-width:0;overflow-wrap:anywhere}',
      '.tca[data-demo="leak-template-audit"] .lt-g span:last-child{flex:none}'
    ].join(""));

    K.head(root, K.t("문장 대조와 틀 대조", "Sentence check vs. template check"),
      K.t("골드 문장 하나와 학습 문장 하나를 단계별로 비교한다. 문장 그대로는 다르지만, 개인정보 자리를 <라벨>로 비우고 단어 5-gram을 맞춰 보면 겹치는 틀이 드러난다.",
        "One gold sentence and one training sentence, compared step by step. As written they differ; blank the PII slots to <label> and match word 5-grams, and the shared template shows."));

    var bar = K.el("div", "tca-bar");
    var pSeg = K.seg([{ value: "tpl", label: K.t("틀을 옮긴 문장", "Copied template") }, { value: "idiom", label: K.t("관용구만 같은 문장", "Shared idiom only") }], pair,
      function (v) { pair = v; render(); }, K.t("문장 짝", "Sentence pair"));
    var sSeg = K.seg([{ value: 1, label: K.t("① 문장 그대로", "① As written") }, { value: 2, label: K.t("② 값 자리 비우기", "② Blank values") },
      { value: 3, label: K.t("③ 5-gram 대조", "③ Match 5-grams") }], step, function (v) { step = v; render(); }, K.t("단계", "Step"));
    var bPh = K.btn(K.t("자리표시자 든 5-gram만 센다", "Count only 5-grams with a placeholder"), phOnly);
    bar.appendChild(pSeg.el); bar.appendChild(sSeg.el); bar.appendChild(bPh);
    root.appendChild(bar);

    var lg = K.el("div", "tca-h", K.t("골드", "Gold")), rg = K.el("div", "lt-r");
    var lt = K.el("div", "tca-h", K.t("학습", "Training")), rt = K.el("div", "lt-r");
    root.appendChild(lg); root.appendChild(rg); root.appendChild(lt); root.appendChild(rt);
    var grams = K.el("div", "lt-g");
    root.appendChild(grams);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "문장과 값은 예시다(틀은 본문에 나온 것). 숫자는 #로 바꾸는데 이 두 짝에는 숫자가 없다. 본문의 실측: 업무 문서 축 골드 문장의 100%가 학습 데이터와 같은 5단어 틀을 공유했고, 같은 코퍼스에서 만든 축은 84.5%였다.",
      "Sentences and values are examples (the template is the one in the post). Digits become #, though these pairs have none. Measured in the post: 100% of gold sentences on the business-document axis shared a 5-word template with training data; the axis built from the same corpus shared 84.5%.")));

    function tok(t, masked) { return typeof t === "string" ? t : (masked ? "<" + t[1] + ">" : t[0]); }
    function words(arr, masked) { return arr.map(function (t) { return tok(t, masked); }); }
    function ngrams(ws) { var out = []; for (var i = 0; i + 5 <= ws.length; i++) out.push(ws.slice(i, i + 5).join(" ")); return out; }
    function paintRow(el, arr, masked) {
      el.textContent = "";
      arr.forEach(function (t) {
        var isP = typeof t !== "string";
        el.appendChild(K.el("span", "w" + (isP && masked ? " p" : ""), tok(t, masked)));
      });
    }
    function render() {
      var P = PAIRS[pair], masked = step >= 2;
      paintRow(rg, P.gold, masked); paintRow(rt, P.train, masked);
      bPh.disabled = step < 3;
      grams.textContent = "";
      if (step === 1) {
        var same = words(P.gold, false).join(" ") === words(P.train, false).join(" ");
        read.textContent = K.t("같은 문장인가: ", "Same sentence: ") + (same ? K.t("예", "yes") : K.t("아니오 — 문장 대조로는 누출 0건", "no — the sentence check reports 0 leaks"));
        return;
      }
      if (step === 2) {
        var sm = words(P.gold, true).join(" ") === words(P.train, true).join(" ");
        read.textContent = K.t("값 자리를 비우면 같은 문장인가: ", "Same after blanking values: ") + (sm ? K.t("예 — 값만 바뀐 같은 틀", "yes — the same template with new values") : K.t("아니오", "no"));
        return;
      }
      var tg = ngrams(words(P.train, true)), gg = ngrams(words(P.gold, true));
      var counted = 0, shared = 0;
      gg.forEach(function (g) {
        var hasP = g.indexOf("<") >= 0, hit = tg.indexOf(g) >= 0, use = !phOnly || hasP;
        var r = K.el("div", "");
        r.appendChild(K.el("span", "", g));
        r.appendChild(K.el("span", !use ? "" : (hit ? "tca-bad" : "tca-good"),
          !use ? K.t("세지 않음", "not counted") : (hit ? K.t("학습에도 있음", "also in training") : K.t("없음", "absent"))));
        if (!use) r.style.color = "var(--secondary)";
        grams.appendChild(r);
        if (use) { counted++; if (hit) shared++; }
      });
      read.textContent = K.t("센 5-gram ", "Counted 5-grams ") + counted + K.t("개 중 학습에도 있는 것 ", ", also in training ") + shared +
        (shared > 0 ? K.t(" → 이 골드 문장은 '틀 공유'로 센다", " → this gold sentence counts as sharing a template")
          : K.t(" → 틀 공유로 세지 않는다", " → not counted as sharing a template")) +
        (pair === "idiom" && !phOnly ? K.t(" (관용구 겹침이 오염처럼 잡혔다)", " (an idiom overlap looks like contamination)") : "");
    }
    bPh.addEventListener("click", function () { phOnly = !phOnly; K.press(bPh, phOnly); render(); });
    render();
  });
})();
