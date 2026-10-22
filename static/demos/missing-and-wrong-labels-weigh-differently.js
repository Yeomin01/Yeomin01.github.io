/* 「정답에서 빠진 것과 정답에 잘못 들어간 것은 무게가 다르다」 글의 그림: 본문의 채점 규칙으로 정답 누락과 과다 라벨을 각각 채점해 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("label-error-weight", function (root) {
    var TEXT = ["", "김지수", " 과장(", "재무팀", ")이 계약 상대인 ", "가람물산", "에 공문을 보냈다."];
    var SP = [
      { seg: 1, lab: K.t("이름", "NAME"), why: K.t("특정인", "a person"), policy: "mask" },
      { seg: 3, lab: K.t("기관명", "ORG"), why: K.t("사람에 붙은 부서", "dept tied to a person"), policy: "mask" },
      { seg: 5, lab: K.t("기관명", "ORG"), why: K.t("공문 수신 회사", "recipient company"), policy: "keep" }
    ];
    var PRESET = {
      miss: ["mask", "none", "none"],
      over: ["mask", "mask", "mask"],
      fixed: ["mask", "mask", "keep"]
    };
    var preset = "miss", pred = [true, true, false]; // 정책대로 판단한 모델

    K.css("missing-and-wrong-labels-weigh-differently-css", [
      '.tca[data-demo="label-error-weight"] .lw-s{font-size:15px;line-height:2;margin:0 0 8px}',
      '.tca[data-demo="label-error-weight"] .lw-s b{font-weight:600;border-bottom:2px solid var(--tca-accent);padding:0 1px}',
      '.tca[data-demo="label-error-weight"] .lw-s b.pm{background:var(--code-bg)}',
      '.tca[data-demo="label-error-weight"] .lw-g{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:4px;font-size:12.5px;align-items:center}',
      '.tca[data-demo="label-error-weight"] .lw-g .hd{color:var(--secondary)}',
      '.tca[data-demo="label-error-weight"] .lw-g .tca-btn{width:100%;padding:3px 4px}',
      '.tca[data-demo="label-error-weight"] .lw-k{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-variant-numeric:tabular-nums}'
    ].join(""));

    K.head(root, K.t("같은 모델, 다른 정답, 다른 점수", "Same model, different answer key, different score"),
      K.t("본문의 채점 규칙을 그대로 옮겼다. 정답 표시를 바꾸거나 모델의 판단(가림·통과)을 눌러 바꾸면, 오류 종류에 따라 점수가 어떻게 흔들리는지 보인다.",
        "The scoring rule from the post, as is. Change the answer key or click the model's decisions (mask/pass) to see how each kind of error moves the score."));

    var bar = K.el("div", "tca-bar");
    var pSeg = K.seg([{ value: "miss", label: K.t("정답 누락", "Missing label") }, { value: "over", label: K.t("과다 라벨", "Over-label") },
      { value: "fixed", label: K.t("판정을 거친 정답", "After context judging") }], preset, function (v) { preset = v; render(); }, K.t("정답 상태", "Answer key"));
    bar.appendChild(pSeg.el);
    root.appendChild(bar);

    var sent = K.el("div", "lw-s");
    root.appendChild(sent);

    var g = K.el("div", "lw-g");
    [K.t("스팬", "Span"), K.t("정책상", "Policy"), K.t("정답 표시", "Answer key"), K.t("모델", "Model")].forEach(function (h) { g.appendChild(K.el("div", "hd", h)); });
    var cells = SP.map(function (sp, i) {
      g.appendChild(K.el("div", "", TEXT[sp.seg] + " · " + sp.lab));
      g.appendChild(K.el("div", sp.policy === "mask" ? "" : "tca-good", (sp.policy === "mask" ? K.t("가림", "mask") : K.t("가리지 않음", "keep")) + " (" + sp.why + ")"));
      var key = K.el("div", "", "");
      g.appendChild(key);
      var b = K.btn("", pred[i]);
      b.addEventListener("click", function () { pred[i] = !pred[i]; render(); });
      var wrap = K.el("div", "");
      wrap.appendChild(b);
      g.appendChild(wrap);
      return { key: key, b: b };
    });
    root.appendChild(g);

    var kpi = K.el("div", "lw-k");
    var kTP = K.el("span", ""), kMiss = K.el("span", ""), kOver = K.el("span", ""), kSkip = K.el("span", "");
    kpi.appendChild(kTP); kpi.appendChild(kMiss); kpi.appendChild(kOver); kpi.appendChild(kSkip);
    root.appendChild(kpi);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "문장과 값은 예시다. 채점: TP = 정답 '가림' ∩ 예측, 미탐 = 정답 '가림' − 예측, 과차단 = 정답 '가리지 않음' ∩ 예측. 항목이 있는 문장에서 정답에 없는 예측은 세지 않는다.",
      "Sentence and values are examples. Scoring: TP = mask ∩ predicted, miss = mask − predicted, over-block = keep ∩ predicted. In a sentence with items, predictions outside the key are not counted.")));

    function keyText(k) { return k === "mask" ? K.t("가려야 함", "mask") : k === "keep" ? K.t("가리면 안 됨", "keep") : K.t("없음", "absent"); }
    function render() {
      var keyv = PRESET[preset];
      sent.textContent = "";
      TEXT.forEach(function (t, i) {
        var sp = SP.filter(function (s) { return s.seg === i; })[0];
        if (!sp) { sent.appendChild(document.createTextNode(t)); return; }
        var b = K.el("b", pred[SP.indexOf(sp)] ? "pm" : "", t);
        sent.appendChild(b);
      });
      var tp = 0, miss = 0, over = 0, skip = 0, fake = [], blind = [];
      SP.forEach(function (sp, i) {
        var k = keyv[i], p = pred[i], res;
        if (k === "mask") { if (p) { tp++; res = "TP"; } else { miss++; res = K.t("미탐", "miss"); if (sp.policy === "keep") fake.push(TEXT[sp.seg]); } }
        else if (k === "keep") { if (p) { over++; res = K.t("과차단", "over-block"); } else res = K.t("맞게 통과", "kept"); }
        else { if (p) skip++; res = K.t("세지 않음", "not scored"); if (sp.policy === "mask") blind.push(TEXT[sp.seg]); }
        cells[i].key.textContent = keyText(k) + " → " + res;
        cells[i].key.className = res === "TP" || res === K.t("맞게 통과", "kept") ? "tca-good" : (res === K.t("세지 않음", "not scored") ? "" : "tca-bad");
        cells[i].b.textContent = p ? K.t("가림", "mask") : K.t("통과", "pass");
        K.press(cells[i].b, p);
      });
      kTP.textContent = "TP " + tp; kMiss.textContent = K.t("미탐 ", "miss ") + miss;
      kOver.textContent = K.t("과차단 ", "over-block ") + over; kSkip.textContent = K.t("세지 않은 예측 ", "unscored predictions ") + skip;
      var msg = [];
      if (fake.length) msg.push(K.t("가짜 미탐: 모델이 정책대로 통과시킨 ", "False miss: ") + fake.join(", ") + K.t("을 미탐으로 셌다.", " was passed per policy yet counted as a miss."));
      if (blind.length) msg.push(K.t("정답에서 빠진 ", "Missing from the key: ") + blind.join(", ") + K.t(" 자리는 모델이 가리든 놓치든 점수가 같다 — 왜곡은 없지만 그 자리의 미탐은 볼 수 없다.", " — mask or miss, the score is the same; nothing is distorted, but a miss there cannot be seen."));
      if (preset === "fixed") msg.push(over ? K.t("가리지 않아야 할 기관명을 가린 것이 과차단으로 잡힌다.", "Masking the ORG that should stay shows up as an over-block.")
        : K.t("'가리면 안 됨' 항목이 생겨 과차단도 문맥 단위로 잴 수 있다.", "With keep items in the key, over-blocking can be measured in context."));
      read.textContent = msg.join(" ");
    }
    render();
  });
})();
