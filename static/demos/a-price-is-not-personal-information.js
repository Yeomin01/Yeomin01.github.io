/* 「가격은 개인정보가 아니다」 글의 그림: 금액 주변 근접 범위에 무엇이 있느냐로 가격과 개인 거래를 가르기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("price-window", function (root) {
    // 예시 문장. amount 는 금액 스팬, ents 는 다른 PII 스팬, truth 는 정책상 정답(예시)
    var S = [
      { text: K.t("경복궁 입장료는 성인 3,000원이에요. 한복을 입으면 무료라고 하네요.", "Gyeongbokgung admission is 3,000 won for adults. Free if you wear a hanbok."),
        amount: K.t("3,000원", "3,000 won"), ents: [], truth: false },
      { text: K.t("서울 종로구에 있는 박물관 관람료는 5,000원입니다.", "The museum in Jongno-gu, Seoul charges 5,000 won."),
        amount: K.t("5,000원", "5,000 won"), ents: [{ s: K.t("서울 종로구", "Jongno-gu, Seoul"), lab: "addr" }], truth: false },
      { text: K.t("이거 12,340원짜리야? 생각보다 싸네.", "This one is 12,340 won? Cheaper than I thought."),
        amount: K.t("12,340원", "12,340 won"), ents: [], truth: false },
      { text: K.t("김민수 고객님, 본인 확인 감사합니다. 예약은 다음 주 화요일 오전 출발로 잡혀 있고 일정 안내 문자는 전날 저녁에 따로 보내 드립니다. 문의하신 시티투어 요금은 1인 45,000원입니다.",
          "Thank you, Kim Minsu, for verifying your identity. Your booking departs next Tuesday morning and the schedule text will be sent the evening before. The city tour you asked about is 45,000 won per person."),
        amount: K.t("45,000원", "45,000 won"), ents: [{ s: K.t("김민수", "Kim Minsu"), lab: "name" }], truth: false },
      { text: K.t("박서연 님, 환급금 52,340원이 등록하신 계좌로 입금되었습니다.", "Park Seoyeon, your refund of 52,340 won has been deposited to your registered account."),
        amount: K.t("52,340원", "52,340 won"), ents: [{ s: K.t("박서연", "Park Seoyeon"), lab: "name" }], truth: true }
    ];
    var KEYS = K.lang === "en" ? ["payment", "refund", "deposited", "balance", "transfer"] : ["결제", "환급", "납부", "입금", "잔액", "송금"];
    var LAB = { name: K.t("이름", "name"), addr: K.t("주소", "address") };
    var win = 60, addrCounts = false, precise = false;

    S.forEach(function (x) {
      x.a0 = x.text.indexOf(x.amount); x.a1 = x.a0 + x.amount.length;
      x.ents.forEach(function (e) { e.a = x.text.indexOf(e.s); e.b = e.a + e.s.length; });
      x.keys = [];
      KEYS.forEach(function (k) { var i = x.text.indexOf(k); if (i >= 0) x.keys.push({ s: k, a: i, b: i + k.length }); });
      x.value = +x.amount.replace(/[^0-9]/g, "");
    });

    K.css("a-price-is-not-personal-information-css", [
      '.tca[data-demo="price-window"] .pw-s{border:1px solid var(--tertiary);border-radius:6px;padding:8px 10px;margin:0 0 6px}',
      '.tca[data-demo="price-window"] .pw-t{line-height:1.9}',
      '.tca[data-demo="price-window"] .pw-t .w{background:var(--code-bg);transition:background .3s}',
      '.tca[data-demo="price-window"] .pw-t .am{border:1.5px solid var(--tca-accent);border-radius:3px;padding:0 2px;font-weight:600}',
      '.tca[data-demo="price-window"] .pw-t .en{border-bottom:2px dotted var(--tca-warn)}',
      '.tca[data-demo="price-window"] .pw-t .kw{border-bottom:2px solid var(--tca-bad)}',
      '.tca[data-demo="price-window"] .pw-v{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12.5px;margin-top:4px}'
    ].join(""));

    K.head(root, K.t("금액 주변을 얼마나 넓게 볼까", "How far around the amount to look"),
      K.t("금액 앞뒤의 근접 범위(회색 바탕) 안에 개인을 특정하는 다른 PII나 거래 문맥 키워드가 있을 때만 개인정보로 남긴다. 범위와 조건을 바꾸면 예시 문장 다섯의 판정이 바뀐다.",
        "An amount stays PII only when another person-identifying PII or a transaction keyword sits inside the window around it (grey). Change the window and the conditions to see the verdicts on five example sentences change."));

    var bar = K.el("div", "tca-bar");
    var wSeg = K.seg([{ value: 20, label: K.t("앞뒤 20자", "±20 chars") }, { value: 60, label: K.t("앞뒤 60자(정책)", "±60 chars (policy)") },
      { value: 1e9, label: K.t("문서 전체", "Whole text") }], win, function (v) { win = v; render(); }, K.t("근접 범위", "Window"));
    var bAddr = K.btn(K.t("주소도 결합으로 센다", "Count address as linkage"), false);
    var bPrec = K.btn(K.t("정밀도 조건도 쓴다", "Also use precision"), false);
    bar.appendChild(wSeg.el); bar.appendChild(bAddr); bar.appendChild(bPrec);
    root.appendChild(bar);

    var list = K.el("div", "");
    root.appendChild(list);
    var boxes = S.map(function () {
      var b = K.el("div", "pw-s");
      var tx = K.el("div", "pw-t");
      var v = K.el("div", "pw-v");
      b.appendChild(tx); b.appendChild(v);
      list.appendChild(b);
      return { tx: tx, v: v };
    });

    var leg = K.el("div", "tca-legend");
    leg.innerHTML = "";
    [[K.t("금액", "amount"), "border:1.5px solid var(--tca-accent)"], [K.t("다른 PII", "other PII"), "border-bottom:2px dotted var(--tca-warn)"],
      [K.t("거래 키워드", "transaction keyword"), "border-bottom:2px solid var(--tca-bad)"], [K.t("근접 범위", "window"), "background:var(--code-bg)"]].forEach(function (p) {
      var s = K.el("span", "");
      var i = document.createElement("i");
      i.setAttribute("style", p[1]);
      s.appendChild(i); s.appendChild(document.createTextNode(p[0]));
      leg.appendChild(s);
    });
    root.appendChild(leg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "문장과 정답은 예시다. 근접 범위는 금액 앞뒤 N자로 두었고, 거래 키워드는 결제·환급·납부 같은 몇 개만 넣었다. 정밀도 조건은 100원 미만 단위가 있는 금액이다. 본문의 실측: 정책 적용 뒤 중립 코퍼스 발화 39건 → 6건, 관광 25건 → 0건.",
      "Sentences and answers are examples. The window is N characters on each side of the amount; the keyword list holds only a few words like payment and refund. Precision means the amount has units below 100 won. Measured in the post: neutral-corpus firings 39 → 6, tourism 25 → 0.")));

    function overlaps(a, b, lo, hi) { return a < hi && b > lo; }
    function judge(x) {
      var lo = x.a0 - win, hi = x.a1 + win, why = [];
      x.ents.forEach(function (e) {
        if (!overlaps(e.a, e.b, lo, hi)) return;
        if (e.lab === "name" || (e.lab === "addr" && addrCounts)) why.push(LAB[e.lab] + K.t(" 동반", " nearby"));
      });
      x.keys.forEach(function (k) { if (overlaps(k.a, k.b, lo, hi)) why.push(K.t("키워드 '", "keyword '") + k.s + "'"); });
      if (precise && x.value % 100 !== 0) why.push(K.t("100원 미만 단위", "units below 100"));
      return { keep: why.length > 0, why: why, lo: lo, hi: hi };
    }
    function paint(x, box, j) {
      var cuts = [0, x.text.length, x.a0, x.a1, Math.max(0, j.lo), Math.min(x.text.length, j.hi)];
      x.ents.forEach(function (e) { cuts.push(e.a, e.b); });
      x.keys.forEach(function (k) { cuts.push(k.a, k.b); });
      cuts = cuts.filter(function (c, i, a) { return c >= 0 && c <= x.text.length && a.indexOf(c) === i; }).sort(function (a, b) { return a - b; });
      box.tx.textContent = "";
      for (var i = 0; i < cuts.length - 1; i++) {
        var a = cuts[i], b = cuts[i + 1], cls = [];
        if (a >= j.lo && b <= j.hi) cls.push("w");
        if (a >= x.a0 && b <= x.a1) cls.push("am");
        x.ents.forEach(function (e) { if (a >= e.a && b <= e.b) cls.push("en"); });
        x.keys.forEach(function (k) { if (a >= k.a && b <= k.b) cls.push("kw"); });
        var sp = K.el("span", cls.join(" "), x.text.slice(a, b));
        box.tx.appendChild(sp);
      }
    }
    function render() {
      var ok = 0;
      S.forEach(function (x, i) {
        var j = judge(x), box = boxes[i];
        paint(x, box, j);
        box.v.textContent = "";
        var verdict = K.el("span", j.keep ? "tca-warn" : "", j.keep ? K.t("개인정보로 남김", "Kept as PII") + " (" + j.why.join(", ") + ")" : K.t("가격으로 통과", "Passed as a price"));
        verdict.style.fontWeight = "600";
        var right = j.keep === x.truth;
        if (right) ok++;
        box.v.appendChild(verdict);
        box.v.appendChild(K.el("span", "", K.t("정답(예시): ", "Answer (example): ") + (x.truth ? K.t("개인 거래", "personal transaction") : K.t("가격", "price"))));
        box.v.appendChild(K.el("span", right ? "tca-good" : "tca-bad", right ? K.t("✓ 맞음", "✓ correct") : K.t("✗ 틀림", "✗ wrong")));
      });
      read.textContent = K.t("예시 문장 다섯 중 정답과 같은 판정: ", "Verdicts matching the answer: ") + ok + " / " + S.length;
    }
    bAddr.addEventListener("click", function () { addrCounts = !addrCounts; K.press(bAddr, addrCounts); render(); });
    bPrec.addEventListener("click", function () { precise = !precise; K.press(bPrec, precise); render(); });
    render();
  });
})();
