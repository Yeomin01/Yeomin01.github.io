/* 「오탐을 재는 데이터가 없었다」 글의 그림: 평가셋의 양성 비율이 정밀도를 어떻게 바꾸는지, 섞인 구분자가 숫자 표를 식별자로 읽는 모습 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  // 그림 1: 같은 탐지기라도 PII가 든 문서 비율에 따라 정밀도가 달라진다
  K.register("fp-prior-precision", function (root) {
    var pi = 100, f = 2;
    var PRE = [{ v: 100, ko: "합성 테스트셋 100%", en: "Synthetic test 100%" }, { v: 99.7, ko: "상담 전체록 99.7%", en: "Call transcripts 99.7%" },
      { v: 99.1, ko: "SNS 단문 99.1%", en: "Short SNS 99.1%" }, { v: 5, ko: "PII가 드문 트래픽(예시 5%)", en: "Sparse-PII traffic (example 5%)" }];

    K.css("nothing-was-measuring-false-positives-css", [
      '.tca[data-demo="fp-prior-precision"] .pp-g{display:grid;grid-template-columns:repeat(40,minmax(0,1fr));gap:2px;margin:4px 0 10px}',
      '@media (max-width:600px){.tca[data-demo="fp-prior-precision"] .pp-g{grid-template-columns:repeat(20,minmax(0,1fr))}}',
      '.tca[data-demo="fp-prior-precision"] .pp-g i{display:block;aspect-ratio:1;border-radius:2px;background:var(--code-bg);border:1px solid var(--tertiary);transition:background .3s}',
      '.tca[data-demo="fp-prior-precision"] .pp-g i.p{background:var(--tca-accent);border-color:var(--tca-accent)}',
      '.tca[data-demo="fp-prior-precision"] .pp-g i.f{outline:2px solid var(--tca-bad);outline-offset:-1px}',
      '.tca[data-demo="fp-separator-split"] .sp-r{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;border-bottom:1px solid var(--tertiary);padding:5px 0}',
      '.tca[data-demo="fp-separator-split"] .sp-r code{font-size:14px;background:var(--code-bg);padding:1px 6px;border-radius:4px}',
      '.tca[data-demo="fp-separator-split"] .sp-r .k{flex:1 1 140px;min-width:0;color:var(--secondary);font-size:12.5px}',
      '.tca[data-demo="fp-separator-split"] .sp-r .v{flex:none;font-weight:600;font-size:13px}'
    ].join(""));

    K.head(root, K.t("같은 탐지기, 다른 사전확률", "Same detector, different prior"),
      K.t("문서 200건 중 PII가 든 문서의 비율을 바꾼다. 탐지기의 성향(PII 문서는 맞게 잡고, 문서 100건당 몇 번 헛발화한다)은 그대로인데, 정밀도는 비율을 따라 크게 움직인다.",
        "Change the share of documents that contain PII among 200. The detector's behaviour (catch PII documents, misfire a few times per 100 documents) stays fixed, yet precision follows the share."));

    var bar = K.el("div", "tca-bar");
    var sPi = K.slider({ label: K.t("PII가 든 문서", "Docs with PII"), min: 1, max: 100, step: 0.1, value: pi,
      fmt: function (v) { return v.toFixed(1) + "%"; }, onInput: function (v) { pi = v; render(); } });
    var sF = K.slider({ label: K.t("100건당 헛발화(예시)", "Misfires per 100 (example)"), min: 0, max: 10, step: 0.5, value: f,
      fmt: function (v) { return v.toFixed(1); }, onInput: function (v) { f = v; render(); } });
    bar.appendChild(sPi.el); bar.appendChild(sF.el);
    root.appendChild(bar);
    var pb = K.el("div", "tca-bar");
    PRE.forEach(function (p) {
      var b = K.btn(K.t(p.ko, p.en));
      b.addEventListener("click", function () { pi = p.v; sPi.set(p.v); render(); });
      pb.appendChild(b);
    });
    root.appendChild(pb);

    var grid = K.el("div", "pp-g");
    var cells = [];
    for (var i = 0; i < 200; i++) { var c = document.createElement("i"); grid.appendChild(c); cells.push(c); }
    root.appendChild(grid);
    var lg = K.el("div", "tca-legend");
    [[K.t("PII가 든 문서", "doc with PII"), "background:var(--tca-accent)"], [K.t("PII 없는 문서", "doc without PII"), "background:var(--code-bg);border:1px solid var(--tertiary)"],
      [K.t("헛발화(기댓값만큼 표시)", "misfire (expected count)"), "outline:2px solid var(--tca-bad);outline-offset:-1px"]].forEach(function (p) {
      var s = K.el("span", ""); var ic = document.createElement("i"); ic.setAttribute("style", p[1]); s.appendChild(ic); s.appendChild(document.createTextNode(p[0])); lg.appendChild(s);
    });
    root.appendChild(lg);

    var rows = K.el("div", "tca-rows");
    rows.style.marginTop = "10px";
    rows.style.setProperty("--tca-lw", "72px");
    rows.style.setProperty("--tca-rw", "56px");
    var r = K.el("div", "tca-row"), rl = K.el("div", "tca-row-l", K.t("정밀도", "Precision")), tr = K.el("div", "tca-track"), fl = K.el("div", "tca-fill"), rv = K.el("div", "tca-row-r", "");
    tr.appendChild(fl); r.appendChild(rl); r.appendChild(tr); r.appendChild(rv); rows.appendChild(r);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "가정: PII가 든 문서마다 맞는 발화 1건, 헛발화는 문서 종류와 무관하게 100건당 위 값만큼. 이 두 값은 예시다. 비율 100%·99.7%·99.1%는 본문의 평가셋 구성이다.",
      "Assumptions: one correct firing per PII document; misfires at the rate above per 100 documents regardless of type. Both are example values. The 100% / 99.7% / 99.1% shares are the post's eval-set composition.")));

    function render() {
      var nP = Math.round(pi / 100 * 200), nF = Math.round(f / 100 * 200);
      cells.forEach(function (c, i) { c.className = (i < nP ? "p" : "") + (i >= 200 - nF ? " f" : ""); });
      var tp = pi / 100, fp = f / 100, prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      fl.style.width = (prec * 100) + "%";
      fl.style.background = prec >= 0.9 ? "var(--tca-good)" : prec >= 0.5 ? "var(--tca-warn)" : "var(--tca-bad)";
      rv.textContent = prec.toFixed(3);
      read.textContent = K.t("200건 기준 — 맞는 발화 ", "Per 200 docs — correct firings ") + K.fmt(tp * 200, 1) + K.t(" · 헛발화 ", " · misfires ") + K.fmt(fp * 200, 1) +
        K.t(" → 정밀도 ", " → precision ") + prec.toFixed(3) + (pi < 50 ? K.t(". 양성으로 채운 셋에서 잰 값과 크게 다르다.", ". Far from the value measured on an all-positive set.") : "");
    }
    render();
  });

  // 그림 2: 점과 공백을 섞어 받으면 숫자 표의 두 열이 3-2-5 형태가 된다
  K.register("fp-separator-split", function (root) {
    var EX = [
      { s: "171.77 99205", k: K.t("숫자 표의 두 열(본문)", "two table columns (post)"), real: false },
      { s: "178.67 99231", k: K.t("숫자 표의 두 열(본문)", "two table columns (post)"), real: false },
      { s: "123-45-67890", k: K.t("하이픈 형(예시)", "hyphen form (example)"), real: true },
      { s: "123 45 67890", k: K.t("공백 형(예시)", "space form (example)"), real: true },
      { s: "123.45.67890", k: K.t("점 전용 형(예시)", "dot-only form (example)"), real: true }
    ];
    var RX = { mixed: /^\d{3}[-. ]\d{2}[-. ]\d{5}$/, split: /^(?:\d{3}[- ]\d{2}[- ]\d{5}|\d{3}\.\d{2}\.\d{5})$/ };
    var mode = "mixed";

    K.head(root, K.t("구분자를 섞어 받을 때와 나눠 받을 때", "Mixed separators vs. split branches"),
      K.t("3-2-5 자리 형태를 찾는 단순화한 정규식이다. 점과 공백을 한 형태 안에서 섞어 받으면 소수점과 열 간격이 구분자로 읽힌다. 두 갈래로 나누면 숫자 표는 빠지고 구분자 형태는 그대로 잡힌다.",
        "A simplified 3-2-5 digit pattern. Accepting dots and spaces mixed within one form reads a decimal point and a column gap as separators. Splitting into two branches drops the table and still catches the separator forms."));
    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: "mixed", label: K.t("점·공백 섞어서 허용", "Dots and spaces mixed") }, { value: "split", label: K.t("하이픈·공백 형 / 점 전용 형", "Hyphen/space form | dot-only form") }], mode,
      function (v) { mode = v; render(); }, K.t("정규식", "Pattern"));
    bar.appendChild(seg.el);
    root.appendChild(bar);
    var pat = K.el("div", "tca-note", "");
    pat.style.margin = "0 0 6px";
    root.appendChild(pat);
    var list = K.el("div", "");
    var R = EX.map(function (x) {
      var r = K.el("div", "sp-r");
      r.appendChild(K.el("code", "", x.s));
      r.appendChild(K.el("span", "k", x.k));
      var v = K.el("span", "v", "");
      r.appendChild(v);
      list.appendChild(r);
      return v;
    });
    root.appendChild(list);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "정규식은 설명용으로 줄였고 실제 판정에는 체크섬 검사도 붙는다. 본문의 두 값은 체크섬까지 통과해 오탐 5건이 됐다.",
      "The pattern is simplified for illustration; the real path also checks the checksum. The post's two values passed the checksum too, giving five false positives.")));

    function render() {
      pat.textContent = mode === "mixed" ? K.t("숫자3 [-·.·공백] 숫자2 [-·.·공백] 숫자5", "3 digits [- . space] 2 digits [- . space] 5 digits")
        : K.t("숫자3 [-·공백] 숫자2 [-·공백] 숫자5   또는   숫자3 . 숫자2 . 숫자5", "3 [- space] 2 [- space] 5   or   3 . 2 . 5");
      var fp = 0, tp = 0;
      EX.forEach(function (x, i) {
        var m = RX[mode].test(x.s);
        R[i].textContent = m ? K.t("잡음", "match") : K.t("안 잡음", "no match");
        R[i].className = "v " + (m === x.real ? "tca-good" : "tca-bad");
        if (m && !x.real) fp++;
        if (m && x.real) tp++;
      });
      read.textContent = K.t("숫자 표를 식별자로 잡음 ", "Table read as an ID ") + fp + " / 2 · " + K.t("구분자 형태 잡음 ", "separator forms caught ") + tp + " / 3";
    }
    render();
  });
})();
