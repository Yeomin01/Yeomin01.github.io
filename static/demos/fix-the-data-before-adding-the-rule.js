/* 「규칙을 걸기 전에 데이터를 고쳐야 했다」 글의 그림: 필터·생성기·데이터를 어떤 순서로 고치느냐에 따라 지표가 말하는 것 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("fix-order-steps", function (root) {
    var TOTAL = 911, RES = 478;
    // 상태: gen(생성기 고침), data(gold 치환), filter(필터 켬), next(다음 생성 데이터를 보여 줌)
    var PLANS = {
      rule: [
        { s: {}, say: K.t("시작. 생성기 fallback 은 예약 도메인을 만들고, gold EMAIL 911건 중 478건(52%)이 예약 도메인이다.", "Start. The generator fallback emits reserved domains; 478 of 911 gold EMAILs (52%) are reserved.") },
        { s: { filter: 1 }, say: K.t("필터를 건다. 478건이 전부 미탐으로 집계되고 이메일 재현율이 절반 아래로 떨어진다. 지표만 보면 필터가 성능을 무너뜨렸다.", "Turn on the filter. All 478 become misses and email recall falls below half. By the metric, the filter broke things.") },
        { s: {}, say: K.t("무너진 지표를 보고 필터를 되돌린다. 맞는 규칙을 데이터 때문에 포기한 셈이다.", "Seeing the drop, the filter is rolled back. A correct rule is abandoned because of the data.") }
      ],
      post: [
        { s: {}, say: K.t("시작. 생성기 fallback 은 예약 도메인을 만들고, gold EMAIL 911건 중 478건(52%)이 예약 도메인이다.", "Start. The generator fallback emits reserved domains; 478 of 911 gold EMAILs (52%) are reserved.") },
        { s: { gen: 1 }, say: K.t("1. 생성기 fallback 을 실재 도메인 풀로 바꾼다. 앞으로 만드는 데이터는 예약 도메인을 만들지 않는다.", "1. Swap the generator fallback for a pool of real domains. New data no longer gets reserved domains.") },
        { s: { gen: 1, data: 1 }, say: K.t("2. 기존 데이터의 예약 도메인을 같은 길이의 평범한 도메인으로 바꾼다. 스팬 좌표가 그대로라 검증이 간단하다.", "2. Replace reserved domains in existing data with ordinary domains of the same length. Span offsets stay put, so checking is simple.") },
        { s: { gen: 1, data: 1, filter: 1 }, say: K.t("3. 그다음에 필터를 건다. 이메일 gold 재현율 0.258 → 1.000, 정밀도 1.000 그대로(수리 전후, 본문 값).", "3. Then turn on the filter. Email gold recall 0.258 → 1.000, precision stays 1.000 (before/after repair, from the post).") }
      ],
      dataonly: [
        { s: {}, say: K.t("시작. 생성기 fallback 은 예약 도메인을 만들고, gold EMAIL 911건 중 478건(52%)이 예약 도메인이다.", "Start. The generator fallback emits reserved domains; 478 of 911 gold EMAILs (52%) are reserved.") },
        { s: { data: 1 }, say: K.t("기존 데이터만 고친다. 생성기는 이미 고쳐져 있다고 잘못 판단했다(그건 건강보험번호 이야기였다).", "Fix only the existing data, wrongly assuming the generator was already fixed (that was the health-insurance number).") },
        { s: { data: 1, filter: 1 }, say: K.t("필터를 건다. 지금 데이터에서는 문제가 없어 보인다.", "Turn on the filter. On the current data, nothing looks wrong.") },
        { s: { data: 1, filter: 1, next: 1 }, say: K.t("다음 생성. 생성기는 그대로라 예약 도메인이 되살아난다 — 다른 팀 측정으로 2,000회 호출 중 65.3%.", "Next generation run. The generator is unchanged, so reserved domains come back — 65.3% of 2,000 calls in another team's measurement.") }
      ]
    };
    var plan = "post", step = 0;

    K.css("fix-the-data-before-adding-the-rule-css", [
      '.tca[data-demo="fix-order-steps"] .fo-st{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
      '.tca[data-demo="fix-order-steps"] .fo-st .tca-tag[data-on="1"]{border-color:var(--tca-good);color:var(--tca-good);font-weight:600}',
      '.tca[data-demo="fix-order-steps"] .fo-st .tca-tag[data-on="2"]{border-color:var(--tca-bad);color:var(--tca-bad);font-weight:600}',
      '.tca[data-demo="fix-order-steps"] .fo-b{display:flex;height:22px;border-radius:4px;overflow:hidden;background:var(--code-bg);margin:2px 0 4px}',
      '.tca[data-demo="fix-order-steps"] .fo-b div{height:100%;transition:width .4s ease,background .4s ease;display:flex;align-items:center;justify-content:center;font-size:12px;color:#111;white-space:nowrap;overflow:hidden}'
    ].join(""));

    K.head(root, K.t("고치는 순서", "The order of the fixes"),
      K.t("이메일 필터는 맞는 규칙이지만, 언제 거느냐에 따라 지표가 반대로 말한다. 순서를 고르고 '다음 단계'로 넘겨 본다.",
        "The email filter is a correct rule, but the metric says the opposite depending on when it is applied. Pick an order and step through it."));

    var bar = K.el("div", "tca-bar");
    var pSeg = K.seg([{ value: "rule", label: K.t("규칙부터", "Rule first") }, { value: "post", label: K.t("생성기 → 데이터 → 규칙", "Generator → data → rule") },
      { value: "dataonly", label: K.t("데이터만 고침", "Data only") }], plan, function (v) { plan = v; step = 0; render(); }, K.t("순서", "Order"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bReset = K.btn(K.t("처음으로", "Back to start"));
    bar.appendChild(pSeg.el); bar.appendChild(bNext); bar.appendChild(bReset);
    root.appendChild(bar);

    var st = K.el("div", "fo-st");
    var tGen = K.el("span", "tca-tag", ""), tData = K.el("span", "tca-tag", ""), tFil = K.el("span", "tca-tag", "");
    st.appendChild(tGen); st.appendChild(tData); st.appendChild(tFil);
    root.appendChild(st);

    root.appendChild(K.el("div", "tca-h", K.t("평가셋 gold EMAIL 911건", "Gold EMAIL in the eval set, 911")));
    var b1 = K.el("div", "fo-b"), b1a = K.el("div", ""), b1b = K.el("div", "");
    b1.appendChild(b1a); b1.appendChild(b1b);
    root.appendChild(b1);
    var cap1 = K.el("div", "tca-note", "");
    cap1.style.margin = "0 0 8px";
    root.appendChild(cap1);
    var nextWrap = K.el("div", "");
    nextWrap.appendChild(K.el("div", "tca-h", K.t("다음에 생성한 데이터", "Data from the next generation run")));
    var b2 = K.el("div", "fo-b"), b2a = K.el("div", ""), b2b = K.el("div", "");
    b2.appendChild(b2a); b2.appendChild(b2b);
    nextWrap.appendChild(b2);
    root.appendChild(nextWrap);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var cnt = K.el("div", "tca-note", "");
    root.appendChild(cnt);
    root.appendChild(K.el("div", "tca-note", K.t(
      "911·478·65.3%·재현율 0.258 → 1.000은 본문 값이다. 생성기는 35% 확률로 국내 도메인을 쓰고, 나머지는 Faker 기본 email() 이라 예약 도메인이 된다.",
      "911, 478, 65.3% and recall 0.258 → 1.000 are from the post. The generator uses a domestic domain 35% of the time; the rest falls back to Faker's default email(), which yields reserved domains.")));

    function seg(el, w, bg, txt) { el.style.width = w + "%"; el.style.background = bg; el.textContent = w > 12 ? txt : ""; }
    function render() {
      var P = PLANS[plan], cur = P[step].s;
      tGen.textContent = cur.gen ? K.t("생성기: 실재 도메인 풀", "Generator: real-domain pool") : K.t("생성기: 예약 도메인 fallback", "Generator: reserved fallback");
      tGen.setAttribute("data-on", cur.gen ? "1" : "2");
      tData.textContent = cur.data ? K.t("기존 데이터: 치환함", "Existing data: replaced") : K.t("기존 데이터: 그대로", "Existing data: as is");
      tData.setAttribute("data-on", cur.data ? "1" : "0");
      tFil.textContent = cur.filter ? K.t("예약 도메인 필터: 켬", "Reserved-domain filter: on") : K.t("예약 도메인 필터: 끔", "Reserved-domain filter: off");
      tFil.setAttribute("data-on", cur.filter ? "1" : "0");

      var resW = RES / TOTAL * 100;
      if (cur.data) {
        seg(b1a, resW, "var(--tca-good)", K.t("치환된 478", "478 replaced"));
        cap1.textContent = K.t("478건이 같은 길이의 평범한 도메인이 됐다. 필터가 걸러 낼 값이 gold에 없다.", "The 478 now use ordinary domains of the same length; the filter has nothing to drop in gold.");
      } else {
        seg(b1a, resW, cur.filter ? "var(--tca-bad)" : "var(--tca-warn)", cur.filter ? K.t("미탐 478", "478 missed") : K.t("예약 도메인 478", "478 reserved"));
        cap1.textContent = cur.filter ? K.t("필터가 478건을 버리니 채점은 전부 미탐으로 센다.", "The filter drops the 478, so scoring counts them all as misses.")
          : K.t("예약 도메인 478건(52%)이 '가려야 할 개인정보' 정답으로 들어 있다.", "478 reserved addresses (52%) sit in gold as PII to be masked.");
      }
      seg(b1b, 100 - resW, "var(--tca-accent)", K.t("그 외 433", "other 433"));

      nextWrap.style.display = cur.next ? "" : "none";
      if (cur.next) { seg(b2a, 65.3, "var(--tca-warn)", K.t("예약 도메인 65.3%", "reserved 65.3%")); seg(b2b, 34.7, "var(--tca-accent)", K.t("그 외", "other")); }

      read.textContent = P[step].say;
      cnt.textContent = K.t("단계 ", "Step ") + step + " / " + (P.length - 1);
      bNext.disabled = step >= P.length - 1;
    }
    bNext.addEventListener("click", function () { if (step < PLANS[plan].length - 1) { step++; render(); } });
    bReset.addEventListener("click", function () { step = 0; render(); });
    render();
  });
})();
