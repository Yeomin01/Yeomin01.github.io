/* 「비교하기 전에, 그 셋으로 배운 적이 있는가」 글의 그림: 비교 셋의 출처를 네 곳에 대조하고 나서야 수치를 낼 수 있는지 정해지는 순서 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("bench-seen-check", function (root) {
    var PLACES = [K.t("1차 분류기 학습 출처", "Stage-1 training sources"), K.t("결합기 학습 코드", "Combiner training code"),
      K.t("에폭·단계 조정 벤치", "Epoch/stage tuning bench"), K.t("유사 대화 검색 인덱스", "Similar-dialogue index")];
    // 칸 값: 1 = 들어 있음, 0 = 없음. 이미 본 셋으로 판정된 출처는 이후 칸을 확인할 필요가 없다.
    var HIT = [[1, 1, 0], [null, null, 0], [null, null, 1], [null, null, null]];
    var step = 0, order = "check";

    K.css("did-we-train-on-the-benchmark-css", [
      '.tca[data-demo="bench-seen-check"] .bs-g{display:grid;grid-template-columns:minmax(0,1.7fr) repeat(3,minmax(0,1fr));gap:4px;font-size:12.5px}',
      '.tca[data-demo="bench-seen-check"] .bs-g>div{border:1px solid var(--tertiary);border-radius:4px;padding:4px 6px;min-width:0;transition:background .3s}',
      '.tca[data-demo="bench-seen-check"] .bs-g .hd{border:0;color:var(--secondary);text-align:center}',
      '.tca[data-demo="bench-seen-check"] .bs-g .pl{color:var(--primary)}',
      '.tca[data-demo="bench-seen-check"] .bs-g .c{text-align:center}',
      '.tca[data-demo="bench-seen-check"] .bs-g .now{outline:2px solid var(--tca-accent);outline-offset:-1px}',
      '.tca[data-demo="bench-seen-check"] .bs-t{margin-top:10px}',
      '.tca[data-demo="bench-seen-check"] .bs-t .x{text-decoration:line-through;color:var(--secondary)}'
    ].join(""));

    K.head(root, K.t("수치를 내기 전에 네 곳을 본다", "Check four places before reporting"),
      K.t("비교에 쓴 공격 출처 셋을, 모델이 데이터를 본 네 곳에 차례로 대조한다. '다음 곳 확인'을 누르며 진행하고, 위에서 순서를 바꾸면 비교 표가 언제 나가는지가 달라진다.",
        "The three attack sources used in the comparison are checked against the four places where the model saw data. Step through with 'Check next'; switching the order changes when the comparison table goes out."));

    var bar = K.el("div", "tca-bar");
    var oSeg = K.seg([{ value: "first", label: K.t("수치부터 낸 순서", "Numbers first") }, { value: "check", label: K.t("확인부터 하는 순서", "Check first") }], order,
      function (v) { order = v; render(); }, K.t("순서", "Order"));
    var bNext = K.btn(K.t("다음 곳 확인", "Check next"));
    var bReset = K.btn(K.t("처음부터", "Start over"));
    bar.appendChild(oSeg.el); bar.appendChild(bNext); bar.appendChild(bReset);
    root.appendChild(bar);

    var g = K.el("div", "bs-g");
    g.appendChild(K.el("div", "hd", ""));
    [1, 2, 3].forEach(function (i) { g.appendChild(K.el("div", "hd", K.t("출처 ", "Source ") + i)); });
    var rowsEl = [], cellEl = [];
    PLACES.forEach(function (p, r) {
      var pl = K.el("div", "pl", (r + 1) + ". " + p);
      g.appendChild(pl); rowsEl.push(pl);
      cellEl.push([0, 1, 2].map(function () { var c = K.el("div", "c", ""); g.appendChild(c); return c; }));
    });
    root.appendChild(g);

    var idx = K.el("div", "tca-rows");
    idx.style.marginTop = "8px";
    idx.style.setProperty("--tca-lw", "150px");
    idx.style.setProperty("--tca-rw", "72px");
    var ir = K.el("div", "tca-row");
    var il = K.el("div", "tca-row-l", K.t("'분포 밖 평가 셋'", "'Out-of-distribution set'"));
    var itr = K.el("div", "tca-track"), ifl = K.el("div", "tca-fill");
    ifl.style.background = "var(--tca-bad)";
    itr.appendChild(ifl);
    var iv = K.el("div", "tca-row-r", "");
    ir.appendChild(il); ir.appendChild(itr); ir.appendChild(iv);
    idx.appendChild(ir);
    root.appendChild(idx);

    var tb = K.el("div", "tca-box bs-t");
    tb.appendChild(K.el("div", "tca-h", K.t("비교 표", "Comparison table")));
    var tv = K.el("div", "", "");
    var tn = K.el("div", "tca-note", "");
    tb.appendChild(tv); tb.appendChild(tn);
    root.appendChild(tb);
    tv.setAttribute("aria-live", "polite");

    root.appendChild(K.el("div", "tca-note", K.t(
      "출처 둘이 1차 모델 학습에, 남은 하나는 학습에는 없었지만 에폭을 고를 때 쓴 벤치에 있었다(본문). 이미 본 셋으로 판정된 출처는 다음 칸을 확인할 필요가 없어 '—'로 둔다. 아래 막대는 인계 문서가 평가용이라 부른 셋 300개 중 인덱스 안에 있던 217개다.",
      "Two sources were in stage-1 training; the third was not in training but was the bench used to pick the epoch (from the post). Once a source is found, later cells need no check and show '—'. The bar is the 217 of 300 items of the set the handoff doc called an evaluation set that sat in the index.")));

    function cellText(r, c) {
      if (r >= step) return { t: K.t("확인 전", "unchecked"), cls: "" };
      for (var k = 0; k < r; k++) if (HIT[k][c] === 1) return { t: "—", cls: "" };
      return HIT[r][c] === 1 ? { t: K.t("있음", "found"), cls: "tca-bad" } : { t: K.t("없음", "absent"), cls: "tca-good" };
    }
    function render() {
      PLACES.forEach(function (p, r) {
        rowsEl[r].className = "pl" + (r === step - 1 ? " now" : "");
        for (var c = 0; c < 3; c++) {
          var x = cellText(r, c);
          cellEl[r][c].textContent = x.t;
          cellEl[r][c].className = "c " + x.cls + (r === step - 1 ? " now" : "");
        }
      });
      var done = step >= PLACES.length;
      ifl.style.width = step >= 4 ? (217 / 300 * 100) + "%" : "0%";
      iv.textContent = step >= 4 ? "217 / 300" : K.t("확인 전", "unchecked");
      bNext.disabled = done;
      tv.textContent = "";
      if (order === "first") {
        var line = K.el("span", done ? "x" : "", K.t("재현율 0.956 대 0.38", "Recall 0.956 vs 0.38"));
        tv.appendChild(line);
        if (done) tv.appendChild(K.el("span", "tca-bad", K.t("  철회", "  withdrawn")));
        tn.textContent = done ? K.t("세 출처 모두 본 셋이었다. 표는 이미 각주 없이 돌아다닌 뒤다.", "All three sources had been seen. The table had already travelled without its footnote.")
          : K.t("각주: 학습 쪽 확인 필요 — 표는 각주 없이 돌아다닌다.", "Footnote: training side to be checked — tables travel without footnotes.");
      } else {
        tv.appendChild(K.el("span", done ? "tca-bad" : "tca-warn", done ? K.t("이 셋으로는 비교하지 않는다", "Not comparable on this set") : K.t("미확인 — 수치를 내지 않는다", "Unverified — no numbers yet")));
        tn.textContent = done ? K.t("세 출처 모두 모델이 본 셋이다. 확인이 먼저였으니 철회할 표가 없다.", "All three sources were seen. Checking came first, so there is nothing to withdraw.")
          : K.t("확인한 곳 ", "Checked ") + step + " / 4";
      }
    }
    bNext.addEventListener("click", function () { if (step < PLACES.length) { step++; render(); } });
    bReset.addEventListener("click", function () { step = 0; render(); });
    render();
  });
})();
