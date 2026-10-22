/* 「암호는 번역에서 살아남지 못한다」 글의 그림: 세 공격셋을 영어 → 한국어로 옮겼을 때 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("cipher-does-not-survive-translation-css",
    '.tca[data-demo="translate-ood"] .to-mark{position:absolute;top:0;bottom:0;left:50%;width:1px;background:var(--secondary);opacity:.6}' +
    '.tca[data-demo="translate-ood"] .to-na{position:absolute;left:6px;top:0;font-size:11.5px;line-height:16px;color:var(--secondary)}' +
    '.tca[data-demo="translate-ood"] .tca-rows{--tca-lw:54px;--tca-rw:40px}' +
    '.tca[data-demo="translate-ood"] .to-grid{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));gap:2px;margin-top:8px;max-width:220px}' +
    '.tca[data-demo="translate-ood"] .to-grid i{display:block;aspect-ratio:1;border-radius:2px;background:var(--tca-accent);transition:opacity .25s,transform .25s}' +
    '.tca[data-demo="translate-ood"] .to-grid i.gone{opacity:.12;transform:scale(.6)}' +
    '.tca[data-demo="translate-ood"] .to-flag{margin-top:6px;font-size:12.5px}' +
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="translate-ood"] .to-grid i{transition:none}}');

  K.register("translate-ood", function (root) {
    var SETS = [
      { name: "DukeCEI", kind: K.t("목표가 표면에 뚜렷", "Goal explicit on the surface"),
        en: { auc: 0.99, rec: null }, ko: { auc: 0.99, rec: 0.81 } },
      { name: "hh-rlhf", kind: K.t("자연스럽게 은닉", "Naturally concealed"),
        en: { auc: 0.98, rec: 0.92 }, ko: { auc: 0.94, rec: 0.39 } },
      { name: "tom-gibbs", kind: K.t("언어 밖 인코딩(치환표)", "Encoding outside language (mapping table)"),
        en: { auc: 1.0, rec: null }, ko: { auc: 0.57, rec: 0.25 }, grid: true }
    ];
    var lang = "en", alive = 150, target = 150;

    K.head(root, K.t("번역 렌즈를 통과한 세 공격셋", "Three attack sets through the translation lens"),
      K.t("같은 분류기로 영어 원본과 한국어 번역본을 쟀다. 언어를 바꾸면 유해 의도가 자연어에 담긴 두 셋은 갈림이 유지되고, 치환표에 기댄 셋만 무너진다.",
        "One classifier on the English originals and the Korean translations. The two sets whose intent lives in natural language stay separable; only the one leaning on a mapping table collapses."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "en", label: K.t("영어 원본", "English original") }, { value: "ko", label: K.t("한국어 번역", "Korean translation") }],
      lang, function (v) { lang = v; target = v === "ko" ? 20 : 150; if (K.reduce) alive = target; render(); }, K.t("언어", "Language"));
    bar.appendChild(sg.el);
    root.appendChild(bar);

    var grid3 = K.el("div", "tca-three");
    var cards = SETS.map(function (d) {
      var box = K.el("div", "tca-box");
      box.appendChild(K.el("div", "tca-h", d.name));
      var tg = K.el("span", "tca-tag", d.kind);
      tg.style.marginBottom = "8px";
      box.appendChild(tg);
      var rows = K.el("div", "tca-rows");
      rows.style.marginTop = "8px";
      function row(label, color, mark) {
        var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r"),
          na = K.el("div", "to-na", K.t("글에 없음", "n/a"));
        f.style.background = color;
        tr.appendChild(f);
        if (mark) tr.appendChild(K.el("div", "to-mark"));
        tr.appendChild(na);
        r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
        rows.appendChild(r);
        return { f: f, v: v, na: na };
      }
      var c = { auc: row("AUROC", "var(--tca-accent)", true), rec: row(K.t("재현율", "Recall"), "var(--tca-good)") };
      box.appendChild(rows);
      if (d.grid) {
        var g = K.el("div", "to-grid");
        g.setAttribute("aria-hidden", "true");
        c.cells = [];
        for (var i = 0; i < 150; i++) { var e = K.el("i"); g.appendChild(e); c.cells.push(e); }
        box.appendChild(g);
        c.cnt = K.el("div", "tca-note");
        c.cnt.style.marginTop = "4px";
        box.appendChild(c.cnt);
        c.flag = K.el("div", "to-flag tca-bad");
        box.appendChild(c.flag);
      }
      grid3.appendChild(box);
      return c;
    });
    root.appendChild(grid3);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "숫자는 글 본문 값이다. AUROC 막대의 세로선은 0.5(무작위)다. 재현율은 임계 0.5 기준이다. 칸 150개는 tom-gibbs 번역에 넣은 150건이고, 한국어에서 남은 20건만 진하게 칠했다.",
      "Numbers are from the post. The line on the AUROC bar is 0.5 (random). Recall is at threshold 0.5. The 150 cells are the tom-gibbs records sent to translation; only the 20 that survived in Korean stay solid.")));

    function setRow(r, v) {
      if (v === null) { r.f.style.width = "0"; r.v.textContent = ""; r.na.style.display = ""; return; }
      r.na.style.display = "none"; r.f.style.width = v * 100 + "%"; r.v.textContent = v.toFixed(2);
    }
    // 남는 20칸은 고르게 흩어 두고, 나머지 130칸은 섞인 순서로 사라진다
    var order = [], rest = [];
    for (var q = 0; q < 150; q++) { if ((q * 20) % 150 < 20) order[q] = -1; else rest.push(q); }
    rest.sort(function (x, y) { return (x * 53) % 150 - (y * 53) % 150; });
    rest.forEach(function (idx, k) { order[idx] = k; });
    function drawGrid() {
      var c = cards[2], n = Math.round(alive), removed = 150 - n;
      c.cells.forEach(function (e, i) { e.className = order[i] >= 0 && order[i] < removed ? "gone" : ""; });
      c.cnt.textContent = K.t("번역 통과 ", "Survived translation ") + n + " / 150";
    }
    function render() {
      SETS.forEach(function (d, i) { setRow(cards[i].auc, d[lang].auc); setRow(cards[i].rec, d[lang].rec); });
      cards[2].flag.textContent = lang === "ko" ? K.t("20건짜리 0.57은 성능이 아니라 파손이다 — 리더보드에서 뺐다.", "0.57 on 20 records is breakage, not performance — removed from the leaderboard.") : "";
      drawGrid();
      read.textContent = lang === "en"
        ? K.t("영어에서는 셋 다 AUROC 0.98 이상으로 갈린다. 사람이 만든 hh-rlhf 도 재현율 0.92.", "In English all three separate at AUROC 0.98 or above; even human-written hh-rlhf has recall 0.92.")
        : K.t("DukeCEI 는 0.99 그대로, hh-rlhf 는 분리는 되지만(0.94) 임계에서 재현율 0.39, tom-gibbs 는 0.57로 거의 무작위다.",
          "DukeCEI holds at 0.99; hh-rlhf still separates (0.94) but recall at the threshold is 0.39; tom-gibbs drops to a near-random 0.57.");
    }
    K.loop(root, function (dt) {
      if (alive === target) return;
      var sp = dt / 1400 * 130;
      alive = alive > target ? Math.max(target, alive - sp) : Math.min(target, alive + sp);
      drawGrid();
    });
    render();
  });
})();
