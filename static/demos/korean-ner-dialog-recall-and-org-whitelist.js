/* 「학습 분포 밖 상담 대화에서 한국어 NER recall 이 무너지는 진단」 글의 그림 두 개
 *   ner-ctx-conf  : 같은 이름을 짧은 단문과 상담 대화 전체에 넣었을 때의 예측 라벨·확신도
 *   ner-org-match : ORG 명단 매칭 순서를 값 하나씩 따라가기(이전 로직과 비교)
 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("korean-ner-dialog-recall-and-org-whitelist-css", [
    '.tca[data-demo="ner-ctx-conf"] .ner-ctx{font-size:13px;background:var(--code-bg);border-radius:6px;padding:6px 8px;margin:0 0 10px}',
    '.tca[data-demo="ner-ctx-conf"] .ner-g{font-size:12.5px;color:var(--secondary);margin:8px 0 2px}',
    '.tca[data-demo="ner-ctx-conf"] .tca-fill{background:var(--tca-bad);transition:none}',
    '.tca[data-demo="ner-org-match"] .org-step{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:4px;border-left:3px solid transparent;font-size:13px}',
    '.tca[data-demo="ner-org-match"] .org-step.on{background:var(--code-bg);border-left-color:var(--tca-accent)}',
    '.tca[data-demo="ner-org-match"] .org-step.past{opacity:.6}',
    '.tca[data-demo="ner-org-match"] .org-id{flex:none;width:22px;font-weight:600;text-align:center}',
    '.tca[data-demo="ner-org-match"] .org-lb{min-width:0;flex:1}',
    '.tca[data-demo="ner-org-match"] .org-st{flex:none;font-size:12.5px;text-align:right;min-width:72px}',
    '.tca[data-demo="ner-org-match"] .org-sep{border-top:1px dashed var(--tertiary);margin:4px 0}'
  ].join(""));

  function tag(text, color) {
    var t = K.el("span", "tca-tag", text);
    if (color) { t.style.color = color; t.style.borderColor = color; }
    return t;
  }

  // ---------- 1. 같은 이름, 다른 문맥 ----------
  K.register("ner-ctx-conf", function (root) {
    K.head(root, K.t("같은 이름, 감싸는 문맥만 다르다", "Same name, different surrounding context"),
      K.t("글의 진단 2·3 에 나온 예측을 그대로 옮겼다. 문맥을 바꿔 보면 같은 김미영이 잡히기도 하고, O 로 확신되며 빠지기도 한다.",
        "Predictions copied from diagnoses 2 and 3 in the post. Switch the context and the same name is either caught or confidently labelled O."));
    var mode = "dialog";
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "short", label: K.t("짧은 단문 하나", "One short sentence") },
      { value: "dialog", label: K.t("상담 대화 전체 안", "Inside the full dialog") }], mode,
    function (v) { mode = v; render(); }, K.t("문맥", "Context"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var body = K.el("div");
    root.appendChild(body);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    var fills = [], grow = 1;
    function paintFills() {
      var k = K.reduce ? 1 : 1 - Math.pow(1 - Math.min(1, grow), 3);
      fills.forEach(function (p) { p[0].style.width = (p[1] * k * 100).toFixed(1) + "%"; });
    }
    K.loop(root, function (dt) {
      if (grow >= 1 || !fills.length) return;
      grow += dt / 600;
      paintFills();
    });
    var NAMES = [
      [K.t("첫 등장 (char 322)", "1st mention (char 322)"), 0.96, 0.98],
      [K.t("두번째 (char 387)", "2nd mention (char 387)"), 1.00, 1.00],
      [K.t("세번째 (char 535)", "3rd mention (char 535)"), 0.89, 0.83]
    ];
    function confRow(rows, label, v) {
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", label));
      var tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill");
      f.style.width = "0%";
      tr.appendChild(f); r.appendChild(tr);
      r.appendChild(K.el("div", "tca-row-r", "O " + v.toFixed(2)));
      rows.appendChild(r);
      return f;
    }
    function render() {
      body.textContent = "";
      fills = [];
      if (mode === "short") {
        body.appendChild(K.el("div", "ner-ctx", K.t("고객: 성함은 김미영이고, 주소는 서울특별시 강남구 테헤란로 123번지입니다.",
          "Customer: My name is Kim Mi-young, and my address is 123 Teheran-ro, Gangnam-gu, Seoul.")));
        var rr = K.el("div", "tca-rows");
        [["김미", "B-NAME"], ["##영", "I-NAME"]].forEach(function (p) {
          var r = K.el("div", "tca-row");
          r.appendChild(K.el("div", "tca-row-l", p[0]));
          r.appendChild(tag(p[1], "var(--tca-good)"));
          rr.appendChild(r);
        });
        body.appendChild(rr);
        body.appendChild(K.el("div", "tca-note", K.t("이 문장의 확신도는 글에 없어 라벨만 적었다. regex overlay·postprocess 뒤 최종 결과에도 그대로 남았다.",
          "The post gives no confidence for this sentence, so only labels are shown. The span survived the regex overlay and postprocess too.")));
        read.textContent = K.t("짧은 단문에서는 김미영을 B-NAME I-NAME 으로 정확히 잡는다. 파이프라인이 지운 것도 아니다.",
          "In one short sentence the name is tagged B-NAME I-NAME correctly, and the pipeline does not remove it.");
        return;
      }
      body.appendChild(K.el("div", "ner-ctx", K.t("상담 대화 sample #2 전체 (tok=339, truncation 없음) 안의 같은 이름과 주소",
        "The same name and address inside the full dialog sample #2 (339 tokens, no truncation)")));
      var rows = K.el("div", "tca-rows");
      rows.style.setProperty("--tca-lw", "112px");
      rows.style.setProperty("--tca-rw", "56px");
      fills = [];
      NAMES.forEach(function (n) {
        rows.appendChild(K.el("div", "ner-g", n[0]));
        fills.push([confRow(rows, K.t("김미 → O", "김미 → O"), n[1]), n[1]]);
        fills.push([confRow(rows, K.t("##영 → O", "##영 → O"), n[2]), n[2]]);
      });
      rows.appendChild(K.el("div", "ner-g", K.t("주소 span 서울특별시 강남구 테헤란로 123번지", "Address span (8 tokens)")));
      fills.push([confRow(rows, K.t("8개 토큰 모두 → O", "all 8 tokens → O"), 1.00), 1.00]);
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", "010-9876-5432"));
      r.appendChild(tag(K.t("정확히 잡음 (정형 PII)", "caught (structured PII)"), "var(--tca-good)"));
      rows.appendChild(r);
      body.appendChild(rows);
      body.appendChild(K.el("div", "tca-note", K.t("막대는 모델이 O(비PII)라고 예측한 확신도다. 0~1 구간을 그렸다.",
        "Bars show the model's confidence in O (non-PII), on a 0–1 scale.")));
      grow = 0;
      paintFills();
      read.textContent = K.t("놓친 이름 토큰의 O 확신도는 0.83~1.00 이다. 경계에서 흔들린 것이 아니라 non-PII 로 확신했다. 형식이 있는 전화번호는 잡는다.",
        "Confidence in O for the missed name tokens is 0.83–1.00. Not borderline: the model is sure they are non-PII. The formatted phone number is still caught.");
    }
    render();
  });

  // ---------- 2. ORG 명단 매칭 순서 ----------
  K.register("ner-org-match", function (root) {
    var NEW = [
      { id: "A", lb: K.t("길이 2자 이하", "Length ≤ 2"), out: false },
      { id: "B", lb: K.t("사람이름 패턴 (성씨 + 두 글자)", "Person-name pattern (surname + 2)"), out: false },
      { id: "C", lb: K.t("지명·국가 blacklist", "Place/country blacklist"), out: false },
      { id: "D", lb: K.t("DART 상장사 or 글로벌 빅테크", "DART-listed or global big tech"), out: false },
      { id: "1", lb: K.t("raw 완전 일치", "Raw exact match"), out: true },
      { id: "2", lb: K.t("normalized 일치", "Normalized match"), out: true },
      { id: "3", lb: K.t("alias 일치", "Alias match"), out: true }
    ];
    var OLD = [{ id: "1", lb: K.t("raw 완전 일치", "Raw exact match"), out: true }];
    var NAME_B = [K.t("인허가 명단에 실제 상호로 등록된 사람 이름이다.", "A person's name registered as a real business name."),
      K.t("성씨 + 두 글자 패턴에서 걸러진다.", "The surname + two-syllable pattern filters it.")];
    var SHORT_A = K.t("2자 이하라 첫 단계에서 걸러진다.", "At two characters or fewer, the first step filters it.");
    var LISTED = [K.t("상장사·빅테크 명단에 있어 마스킹하지 않기로 한 public negative 다.", "A public negative on the listed / big-tech lists, not to be masked."),
      K.t("D 단계에서 reject 된다.", "Step D rejects it.")];
    // why = [값에 대한 사실, 바꾼 뒤 로직이 처리하는 방식]
    var EX = [
      { v: "KB국민은행", nw: "3", old: null, why: [K.t("명단에는 이 문자열이 없고 'KB국민은행 신관' 처럼 붙은 형태로만 있다.", "Not in the list as-is, only as forms like 'KB국민은행 신관'."),
        K.t("첫 공백 앞을 자른 alias 로 잡힌다.", "The alias cut before the first space catches it.")] },
      { v: "배달의민족", nw: "3", old: null, why: [K.t("명단에 붙은 형태로만 있던 이름이다.", "Only present in suffixed forms."), K.t("alias 로 잡힌다.", "The alias catches it.")] },
      { v: "KB국민은행 신관", nw: "1", old: "1", why: [K.t("명단에 이 문자열 그대로 있다.", "This exact string is in the list."), ""] },
      { v: "김민수", nw: "B", old: "1", why: NAME_B },
      { v: "홍길동", nw: "B", old: "1", why: NAME_B },
      { v: "서울", nw: "A", old: "1", why: [K.t("상호로 등록된 짧은 대표어다.", "A short common word registered as a business name."), SHORT_A] },
      { v: "DB", nw: "A", old: "1", why: [K.t("인허가에 실제 상호로 등록돼 'DB 서버' 가 ORG 로 오탐되던 값이다.", "Registered as a business name, which made 'DB server' a false ORG."), SHORT_A] },
      { v: "신한은행", nw: "D", old: "1", why: LISTED },
      { v: "Microsoft", nw: "D", old: "1", why: LISTED }
    ];

    K.head(root, K.t("ORG 명단 매칭 순서 따라가기", "Follow the ORG list-matching order"),
      K.t("BERT 가 ORG 로 예측한 span 을 명단으로 확인하는 함수다. True 면 ORG 로 확인한다. 값은 모두 글에 나온 것이다.",
        "This function confirms a span BERT predicted as ORG against the lists. True means confirmed as ORG. Every value comes from the post."));

    var logic = "new", ex = 0, cur = 0, acc = 0, running = false;
    var bar1 = K.el("div", "tca-bar");
    var sgL = K.seg([{ value: "old", label: K.t("이전: 완전 일치만", "Before: exact match only") },
      { value: "new", label: K.t("바꾼 뒤: 필터 + 3단 일치", "After: filters + 3 matches") }], logic,
    function (v) { logic = v; start(); }, K.t("매칭 로직", "Matching logic"));
    bar1.appendChild(sgL.el);
    var bar2 = K.el("div", "tca-bar");
    var sgE = K.seg(EX.map(function (e, i) { return { value: i, label: e.v }; }), ex,
      function (v) { ex = v; start(); }, K.t("확인할 값", "Value to check"));
    bar2.appendChild(sgE.el);
    root.appendChild(bar1); root.appendChild(bar2);

    var list = K.el("div");
    root.appendChild(list);
    var res = K.el("div", "tca-read");
    res.setAttribute("aria-live", "polite");
    root.appendChild(res);
    var cmp = K.el("div", "tca-note");
    root.appendChild(cmp);
    root.appendChild(K.el("div", "tca-note", K.t("C·2 단계에서 결정되는 예시는 글에 없어 넣지 않았다.",
      "The post has no example decided at step C or 2, so none is included.")));

    var rowsEls = [];
    function steps() { return logic === "new" ? NEW : OLD; }
    function decideIdx() {
      var e = EX[ex], key = logic === "new" ? e.nw : e.old, st = steps();
      for (var i = 0; i < st.length; i++) if (st[i].id === key) return i;
      return st.length; // 어디에도 안 걸리면 끝 줄(False)
    }
    function build() {
      list.textContent = "";
      rowsEls = [];
      var st = steps();
      st.forEach(function (s, i) {
        if (logic === "new" && i === 4) list.appendChild(K.el("div", "org-sep"));
        var r = K.el("div", "org-step");
        r.appendChild(K.el("span", "org-id", s.id));
        r.appendChild(K.el("span", "org-lb", s.lb + " → " + (s.out ? "True" : "False")));
        var stt = K.el("span", "org-st", "");
        r.appendChild(stt);
        list.appendChild(r);
        rowsEls.push({ r: r, st: stt });
      });
      var end = K.el("div", "org-step");
      end.appendChild(K.el("span", "org-id", "·"));
      end.appendChild(K.el("span", "org-lb", K.t("어디에도 안 걸림 → False", "No match anywhere → False")));
      var est = K.el("span", "org-st", "");
      end.appendChild(est);
      list.appendChild(end);
      rowsEls.push({ r: end, st: est });
    }
    function outcome(lg) {
      var e = EX[ex], key = lg === "new" ? e.nw : e.old;
      if (!key) return false;
      return /^[123]$/.test(key);
    }
    function paint() {
      var d = decideIdx();
      rowsEls.forEach(function (o, i) {
        o.r.className = "org-step" + (i === cur ? " on" : i < cur ? " past" : "");
        o.st.textContent = i < cur ? K.t("통과", "pass") : (i === cur && cur === d) ? K.t("여기서 결정", "decided") : "";
      });
      if (cur < d) { res.textContent = K.t("확인 중: " + EX[ex].v, "Checking: " + EX[ex].v); cmp.textContent = ""; return; }
      var val = outcome(logic), other = outcome(logic === "new" ? "old" : "new");
      var intended = outcome("new");
      res.textContent = "";
      res.appendChild(document.createTextNode(EX[ex].v + " → "));
      res.appendChild(tag(val ? K.t("True — ORG 로 확인", "True — confirmed ORG") : K.t("False — 확인 안 함", "False — not confirmed"),
        val ? "var(--tca-accent)" : "var(--secondary)"));
      res.appendChild(document.createTextNode(" "));
      res.appendChild(tag(val === intended ? K.t("의도대로", "as intended") : K.t("의도와 다름", "not intended"),
        val === intended ? "var(--tca-good)" : "var(--tca-bad)"));
      var w = EX[ex].why, how = logic === "new" ? w[1] :
        (val ? K.t("완전 일치만 보니 raw 일치로 그대로 통과했다.", "Exact match alone let it through.") : K.t("완전 일치만 보니 매칭이 실패했다.", "Exact match alone failed to find it."));
      res.appendChild(document.createTextNode(" " + w[0] + (how ? " " + how : "")));
      cmp.textContent = logic === "new" ?
        K.t("이전 로직(완전 일치만)에서는 " + (other ? "True" : "False") + (other === val ? " 로 같았다." : " 였다."),
          "Under the old exact-match logic it was " + (other ? "True" : "False") + (other === val ? " as well." : ".")) :
        K.t("바꾼 뒤에는 " + (other ? "True" : "False") + (other === val ? " 로 같다." : " 가 된다."),
          "After the change it is " + (other ? "True" : "False") + (other === val ? " as well." : "."));
    }
    function start() {
      build();
      cur = 0; acc = 0;
      if (K.reduce) { cur = decideIdx(); running = false; } else running = true;
      paint();
    }
    K.loop(root, function (dt) {
      if (!running) return;
      acc += dt;
      if (acc < 420) return;
      acc = 0;
      if (cur < decideIdx()) { cur++; paint(); }
      if (cur >= decideIdx()) running = false;
    });
    start();
  });
})();
