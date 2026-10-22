/* 「값은 코드가 만들고 LLM은 문장만 쓴다」 글의 그림: 누가 값을 만드느냐에 따라 유효율과 정답 라벨이 어떻게 달라지는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("code-value-split", function (root) {
    var LABELS = [K.t("주민등록번호", "Resident reg. no."), K.t("외국인등록번호", "Alien reg. no."), K.t("사업자등록번호", "Business reg. no."), K.t("신용카드", "Credit card")];
    var RATE = { a: [12.6, 5.7, 8.9, 31.9], b: [10.3, 6.4, 8.9, 10.0], code: [100, 100, 100, 100] };
    var mode = "a";

    K.head(root, K.t("값을 누가 만드는가", "Who makes the value"),
      K.t("본문 표의 유효율이다. 위에서 생성 방식을 바꾸면 라벨별 유효율 막대와, 값·대화·정답 라벨을 누가 맡는지가 함께 바뀐다.",
        "Validity rates from the table in the post. Switch the method to see the per-label bars and who handles the value, the dialogue and the answer label."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "a", label: K.t("LLM-A가 값까지 지음", "LLM-A invents values") },
      { value: "b", label: K.t("LLM-B가 값까지 지음", "LLM-B invents values") },
      { value: "code", label: K.t("코드가 값을 계산", "Code computes values") }], mode, function (v) { mode = v; render(); }, K.t("생성 방식", "Method"));
    bar.appendChild(sg.el);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "112px");
    rows.style.setProperty("--tca-rw", "56px");
    var R = LABELS.map(function (lab) {
      var r = K.el("div", "tca-row");
      var l = K.el("div", "tca-row-l", lab);
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r", "");
      r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v };
    });
    root.appendChild(rows);

    var roles = K.el("div", "tca-three");
    roles.style.marginTop = "12px";
    function roleBox(title) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", title));
      var who = K.el("div", "", "");
      who.style.fontWeight = "600";
      var how = K.el("div", "tca-note", "");
      how.style.marginTop = "2px";
      b.appendChild(who); b.appendChild(how);
      roles.appendChild(b);
      return { who: who, how: how };
    }
    var rV = roleBox(K.t("값", "Value"));
    var rD = roleBox(K.t("대화", "Dialogue"));
    var rL = roleBox(K.t("정답 라벨", "Answer label"));
    root.appendChild(roles);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "LLM 두 줄은 체크섬 공식을 시스템 프롬프트에 그대로 넣고 프로덕션 검증기로 판정한 값이다. 코드 쪽 100%는 값을 코드가 확정한 뒤의 결과다.",
      "The two LLM rows had the checksum formula in the system prompt and were judged by the production validator. The 100% for code is after the values were fixed by code.")));

    function render() {
      var v = RATE[mode];
      R.forEach(function (r, i) {
        r.f.style.width = v[i] + "%";
        r.f.style.background = mode === "code" ? "var(--tca-good)" : "var(--tca-bad)";
        r.v.textContent = v[i].toFixed(1) + "%";
      });
      if (mode === "code") {
        rV.who.textContent = K.t("코드", "Code"); rV.how.textContent = K.t("체크섬을 계산해 확정한다", "fixed by computing the checksum");
        rD.who.textContent = "LLM"; rD.how.textContent = K.t("정해진 값을 '등록된 고객 정보'로 받아 대화만 쓴다", "writes only the dialogue, given the values as registered customer data");
        rL.who.textContent = K.t("공짜", "Free"); rL.how.textContent = K.t("어디에 심었는지 코드가 안다", "code knows where it planted each value");
        read.textContent = K.t("네 라벨 모두 100%. 더 작은 모델로 바꿔도 값은 그대로 유효하고, 대화의 자연스러움만 달라진다.",
          "100% on all four labels. A smaller model leaves the values valid; only the naturalness of the dialogue changes.");
      } else {
        rV.who.textContent = "LLM"; rV.how.textContent = K.t("규칙을 받고도 직접 지어낸다", "invents them even with the rule given");
        rD.who.textContent = "LLM"; rD.how.textContent = K.t("대화와 값을 한 번에 요구받는다", "asked for dialogue and values at once");
        rL.who.textContent = K.t("따로 필요", "Extra work"); rL.how.textContent = K.t("값이 어디 있는지 다시 찾아 라벨을 단다", "values must be found and labeled afterwards");
        read.textContent = mode === "a"
          ? K.t("LLM-A 범위 5.7~31.9%. 카드 31.9%도 통과한 값의 고유율은 74%였다 — 알려진 테스트 번호와 그 변형이 반복됐다.",
            "LLM-A ranges 5.7–31.9%. Even the 31.9% for cards had 74% unique values — known test numbers and their variants repeated.")
          : K.t("LLM-B 범위 6.4~10.3%. 계열이 다른 모델도 비슷하게 못한다 — 프롬프트로 좁힐 격차가 아니다.",
            "LLM-B ranges 6.4–10.3%. A model from a different family fails similarly — not a gap a prompt can close.");
      }
    }
    render();
  });
})();
