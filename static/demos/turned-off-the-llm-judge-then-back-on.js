/* 「2차 LLM 검증을 끄기로 했다가 같은 날 되돌렸다」 글의 그림: 2차를 끄거나 켜고 기본값을 뒤집을 때 경우별 판정 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("turned-off-the-llm-judge-then-back-on-css",
    '.tca[data-demo="judge-default-flip"] .jd-list{display:flex;flex-direction:column;gap:6px}' +
    '.tca[data-demo="judge-default-flip"] .jd-row{border:1px solid var(--tertiary);border-radius:6px;padding:6px 8px}' +
    '.tca[data-demo="judge-default-flip"] .jd-row.bad{border-color:var(--tca-bad);box-shadow:inset 3px 0 0 var(--tca-bad)}' +
    '.tca[data-demo="judge-default-flip"] .jd-case{font-size:13px}' +
    '.tca[data-demo="judge-default-flip"] .jd-line{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:4px;font-size:12.5px}' +
    '.tca[data-demo="judge-default-flip"] .jd-res{font-weight:600}' +
    '.tca[data-demo="judge-default-flip"] .jd-why{color:var(--secondary)}' +
    '.tca[data-demo="judge-default-flip"] .jd-m{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}' +
    '.tca[data-demo="judge-default-flip"] .jd-m .tca-box{font-size:12.5px}' +
    '.tca[data-demo="judge-default-flip"] .jd-big{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}');

  K.register("judge-default-flip", function (root) {
    var MASK = "mask", KEEP = "keep", NA = "na";
    // want: 정책상 맞는 처리. off/old/new: [결과, 판정 주체, 이유]
    var C = [
      { c: K.t("공인에 대한 일반 질문 (회사 임원이 누구인지)", "General question about a public figure (who an executive is)"), want: KEEP,
        off: [MASK, K.t("1차만", "stage 1 only"), K.t("1차는 이름을 전부 가린다 → 챗봇이 답을 못 한다", "stage 1 masks every name → the chatbot cannot answer")],
        old: [KEEP, "LLM", K.t("공개 정보 질의", "public-information question")],
        nw: [KEEP, "LLM", K.t("널리 알려진 공인 + 공개된 사실", "well-known figure + public fact")] },
      { c: K.t("같은 사람의 집 주소를 묻는 문장", "A sentence asking for the same person's home address"), want: MASK,
        off: [MASK, K.t("1차만", "stage 1 only"), ""],
        old: [MASK, "LLM", K.t("개인정보 요청", "personal-data request")],
        nw: [MASK, "LLM", K.t("공개된 사실이 아니다 → 기본은 가림", "not a public fact → default is mask")] },
      { c: K.t("붙여넣은 사내 문서 속 직원 이름 (이름만 단독)", "Employee name in a pasted internal document (name alone)"), want: MASK,
        off: [MASK, K.t("1차만", "stage 1 only"), ""],
        old: [KEEP, "LLM", K.t("'이름만 단독이면 오탐으로 본다' 조항", "the 'name alone = false positive' line")],
        nw: [MASK, "LLM", K.t("기본은 가림", "default is mask")] },
      { c: K.t("상담 기록 속 고객 이름 (이름만 단독)", "Customer name in a support log (name alone)"), want: MASK,
        off: [MASK, K.t("1차만", "stage 1 only"), ""],
        old: [KEEP, "LLM", K.t("'이름만 단독이면 오탐으로 본다' 조항", "the 'name alone = false positive' line")],
        nw: [MASK, "LLM", K.t("기본은 가림", "default is mask")] },
      { c: K.t("주민번호·카드번호 같은 번호형 식별자와 함께 나온 이름", "Name appearing with a numeric identifier (resident or card number)"), want: MASK,
        off: [MASK, K.t("1차만", "stage 1 only"), ""],
        old: [NA, "LLM", K.t("옛 구성의 결과는 글에 없다", "the post gives no result for the old setup")],
        nw: [MASK, K.t("규칙", "rule"), K.t("LLM을 부르지 않는다 — 판단할 여지가 없는 결합", "LLM not called — no room for judgement")] }
    ];
    var M = {
      off: [[K.t("본인 확인 대화 차단율", "Block rate, identity-check dialogues"), "82.3%"], [K.t("정책 프로브 통과", "Policy probes passed"), "7 / 10"]],
      old: [[K.t("본인 확인 대화 차단율", "Block rate, identity-check dialogues"), "60.3%"], [K.t("정책 프로브 통과", "Policy probes passed"), "9 / 10"],
        [K.t("2차가 푼 이름 186개 중 진짜 개인정보", "Real PII among 186 names stage 2 released"), "46%"]],
      nw: [[K.t("본인 확인 대화 174개에서 2차가 잘못 푼 이름", "Names stage 2 wrongly released in 174 identity-check dialogues"), K.t("0건", "0")],
        [K.t("공인 질의 과차단", "Over-blocked public-figure questions"), "1 / 45"], [K.t("정책 프로브 통과", "Policy probes passed"), "15 / 15"]]
    };
    var mode = "off";

    K.head(root, K.t("2차를 끄면, 켜면, 기본값을 뒤집으면", "Stage 2 off, on, and with the default flipped"),
      K.t("1차 NER은 이름을 전부 가리고, 풀어도 되는 이름을 고르는 일은 2차 LLM이 맡는다. 구성을 바꾸며 경우마다 결과가 정책과 맞는지 본다. 테두리가 붉은 줄이 정책과 어긋난 경우다.",
        "Stage 1 NER masks every name; stage 2 picks the ones safe to release. Switch the setup and check each case against the policy. A red edge marks a mismatch."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "off", label: K.t("2차 끔", "Stage 2 off") }, { value: "old", label: K.t("2차 켬 · 옛 기본값", "On · old default") },
      { value: "nw", label: K.t("2차 켬 · 기본값 가림", "On · default mask") }], mode, function (v) { mode = v; render(); }, K.t("구성", "Setup"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var list = K.el("div", "jd-list");
    var rows = C.map(function (c) {
      var r = K.el("div", "jd-row"), line = K.el("div", "jd-line");
      r.appendChild(K.el("div", "jd-case", c.c));
      var res = K.el("span", "jd-res"), who = K.el("span", "tca-tag"), why = K.el("span", "jd-why");
      line.appendChild(res); line.appendChild(who); line.appendChild(why);
      r.appendChild(line);
      list.appendChild(r);
      return { r: r, res: res, who: who, why: why, c: c };
    });
    root.appendChild(list);
    var mh = K.el("div", "tca-h", K.t("이 구성으로 잰 값 (글 본문)", "Measured with this setup (from the post)"));
    mh.style.marginTop = "12px";
    root.appendChild(mh);
    var mBox = K.el("div", "jd-m");
    root.appendChild(mBox);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "경우는 글이 든 예를 일반화해 적은 것이다. 옛 기본값 줄의 '풀림'은 2차가 진짜 개인정보를 푼 사례들의 공통 원인을 그린 것이고, 그런 이름이 모두 풀렸다는 뜻은 아니다. 세 구성의 측정값은 평가 셋과 프로브 수가 달라 같은 막대로 놓지 않았다.",
      "Cases generalise the post's examples. 'Released' in the old-default rows shows the common cause behind the real PII stage 2 released, not that every such name was released. The three setups were measured on different sets and probe counts, so they are not put on one bar.")));

    function render() {
      var bad = 0;
      rows.forEach(function (x) {
        var d = x.c[mode], ok = d[0] === NA ? null : d[0] === x.c.want;
        x.res.textContent = d[0] === MASK ? K.t("가림", "masked") : d[0] === KEEP ? K.t("풀림", "released") : "—";
        x.res.className = "jd-res " + (ok === null ? "" : ok ? "tca-good" : "tca-bad");
        x.who.textContent = K.t("판정: ", "decided by: ") + d[1];
        x.why.textContent = d[2] + (ok === false ? K.t(" · 정책과 어긋남", " · against policy") : "");
        x.r.className = "jd-row" + (ok === false ? " bad" : "");
        if (ok === false) bad++;
      });
      mBox.textContent = "";
      M[mode].forEach(function (m) {
        var b = K.el("div", "tca-box");
        b.appendChild(K.el("div", "jd-big", m[1]));
        b.appendChild(K.el("div", "tca-sub", m[0]));
        b.lastChild.style.margin = "0";
        mBox.appendChild(b);
      });
      read.textContent = mode === "off"
        ? K.t("본인 확인 대화만 보면 옛 기본값으로 켠 것보다 잘 막는다. 그 데이터에는 풀어야 할 이름이 거의 없어서다.", "On identity-check dialogues alone this blocks more than the old-default setup, because that data has almost no names that should be released.")
        : mode === "old"
          ? K.t("공인 질의는 살아나지만, 이름만 나온 문서·상담 기록의 개인정보가 풀린다.", "Public-figure questions work again, but PII in documents and support logs where only a name appears gets released.")
          : K.t("기본을 가림으로 뒤집고 번호형 결합은 규칙으로 넘겼다. 이 다섯 경우에서는 어긋난 줄이 없다. 서빙 쪽 측정에서도 공인 질의 과차단 1건은 남았다.", "Default flipped to mask and numeric-identifier pairs handed to rules. None of these five cases mismatch; the serving measurement still had one over-blocked public-figure question.");
      if (mode !== "nw") read.textContent += K.t(" 정책과 어긋난 경우 ", " Mismatches: ") + bad + "/" + rows.length + ".";
    }
    render();
  });
})();
