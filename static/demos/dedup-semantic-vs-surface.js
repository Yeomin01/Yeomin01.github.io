/* 「프루닝 했는데 같은 템플릿이 수십 번」 글의 그림: 데이터 origin 과 dedup 방식에 따라 어떤 중복이 남는가 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("dedup-semantic-vs-surface-css", [
    '.tca[data-demo="dedup-keep"] .dd-row{padding:7px 0;border-top:1px dashed var(--tertiary)}',
    '.tca[data-demo="dedup-keep"] .dd-row:first-child{border-top:0;padding-top:0}',
    '.tca[data-demo="dedup-keep"] .dd-h{font-size:12.5px;color:var(--secondary);margin:0 0 4px}',
    '.tca[data-demo="dedup-keep"] .dd-chips{display:flex;flex-wrap:wrap;gap:4px}',
    '.tca[data-demo="dedup-keep"] .dd-c{font-size:12.5px;line-height:1.4;padding:1px 8px;border-radius:10px;border:1.5px solid var(--tca-accent);',
    'background:var(--entry);transition:opacity .35s ease;max-width:100%}',
    '.tca[data-demo="dedup-keep"] .dd-c.gone{opacity:.38;border:1px dashed var(--tertiary);text-decoration:line-through;background:var(--code-bg)}',
    '.tca[data-demo="dedup-keep"] .dd-hash{font-size:12px;color:var(--secondary);font-variant-numeric:tabular-nums;margin-left:4px}',
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="dedup-keep"] .dd-c{transition:none}}'
  ].join(""));

  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("00000000" + h.toString(16)).slice(-8).slice(0, 6);
  }

  K.register("dedup-keep", function (root) {
    var NAMES = [["홍길동", "Gildong Hong"], ["김철수", "Cheolsu Kim"], ["이수진", "Sujin Lee"], ["박영희", "Younghee Park"],
      ["최민호", "Minho Choi"], ["정하늘", "Haneul Jung"], ["윤서연", "Seoyeon Yoon"], ["강도윤", "Doyun Kang"]].map(function (p) { return K.t(p[0], p[1]); });
    var TPL = {
      t1: K.t("[NAME]님께 이체했습니다", "Transferred to [NAME]"),
      t2: K.t("금요일까지 [NAME]님 계정 권한 정리해둘게요.", "I'll sort out [NAME]'s account permissions by Friday.")
    };
    var PARA = {
      p1: [K.t("내일까지 보고서 보내드릴게요.", "I'll send the report by tomorrow."),
        K.t("리포트는 내일 안으로 전달드리겠습니다.", "The report will reach you within tomorrow."),
        K.t("보고서는 내일 중에 드릴게요.", "You'll have the report sometime tomorrow.")],
      p2: [K.t("회의를 다음 주로 미뤄도 될까요?", "Could we push the meeting to next week?"),
        K.t("미팅 일정을 한 주 늦출 수 있을까요?", "Can the meeting slip by a week?"),
        K.t("다음 주에 회의해도 괜찮을까요?", "Would next week work for the meeting?")],
      p3: [K.t("결제 내역 한 번만 확인해 주세요.", "Please check the payment history once."),
        K.t("청구된 금액이 맞는지 봐 주실래요?", "Could you see whether the charged amount is right?"),
        K.t("결제된 내용을 검토 부탁드려요.", "Please review what was paid.")]
    };
    // origin 별 구성(예시 값): 묶음 = 임베딩 cluster
    var ORIGIN = {
      slot: [{ id: "t1", n: 8 }, { id: "t2", n: 8 }, { id: "p1" }],
      free: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "t1", n: 2 }]
    };

    var origin = "slot", method = "semantic", keep = 0.5;

    K.head(root, K.t("같은 데이터, 어떤 중복이 남나", "Same data, which duplicates survive"),
      K.t("한 줄이 임베딩 cluster 하나다. 슬롯만 바꾼 템플릿 묶음(표면 중복)과 표현만 다른 같은 뜻 묶음(의미 중복)을 섞어 두고, dedup 방식에 따라 무엇이 남는지 본다.",
        "Each row is one embedding cluster. Template rows that differ only in a slot (surface duplicates) sit next to rows that say the same thing in different words (semantic duplicates); see what each dedup method leaves."));

    var bar = K.el("div", "tca-bar");
    var sOrigin = K.seg([
      { value: "slot", label: K.t("슬롯 injection 합성", "Slot-injection synthetic") },
      { value: "free", label: K.t("사람·여러 LLM 자유 작성", "Free-written (people, many LLMs)") }
    ], origin, function (v) { origin = v; build(); }, K.t("데이터 origin", "Data origin"));
    var sMethod = K.seg([
      { value: "semantic", label: K.t("의미 dedup", "Semantic dedup") },
      { value: "surface", label: K.t("표면 dedup(스켈레톤 해시)", "Surface dedup (skeleton hash)") },
      { value: "both", label: K.t("표면 먼저 → 의미 보조", "Surface first → semantic") }
    ], method, function (v) { method = v; paint(); }, K.t("dedup 방식", "Dedup method"));
    var sKeep = K.slider({ label: K.t("의미 dedup keep ratio", "Semantic keep ratio"), min: 10, max: 100, step: 10, value: 50,
      fmt: function (v) { return v + "%"; }, onInput: function (v) { keep = v / 100; paint(); } });
    bar.appendChild(sOrigin.el); bar.appendChild(sMethod.el); bar.appendChild(sKeep.el);
    root.appendChild(bar);

    var box = K.el("div", "tca-box");
    root.appendChild(box);
    var lg = K.el("div", "tca-legend");
    lg.appendChild(K.el("span", null, K.t("실선 테두리 = 남음 · 줄 그음 = 제거 · # 뒤 = 스켈레톤 해시(짧게 표시)", "Solid border = kept · struck through = removed · after # = skeleton hash (shortened)")));
    root.appendChild(lg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var verdict = K.el("div", "tca-note");
    root.appendChild(verdict);
    root.appendChild(K.el("div", "tca-note", K.t(
      "문장·이름·개수는 예시 값이다. keep ratio 50% 는 본문 값이다. 해시는 브라우저에서 바로 계산한 짧은 해시다(본문 코드는 md5). 의미 dedup 은 cluster 안에서 앞에서부터 keep ratio 만큼 남긴다고 단순화했다.",
      "Sentences, names and counts are example values; the 50% keep ratio is from the post. Hashes are short hashes computed in the browser (the post's code uses md5). Semantic dedup is simplified to keeping the first keep-ratio share of each cluster.")));

    var rows = [];   // [{kind, id, items:[{text, skel, el}]}]
    function build() {
      sOrigin.set(origin);
      box.textContent = "";
      rows = ORIGIN[origin].map(function (g, gi) {
        var row = K.el("div", "dd-row");
        var surface = !!TPL[g.id];
        var items = [];
        var h = K.el("div", "dd-h");
        row.appendChild(h);
        var chips = K.el("div", "dd-chips");
        row.appendChild(chips);
        if (surface) {
          var skel = TPL[g.id];
          for (var i = 0; i < g.n; i++) {
            var c = K.el("span", "dd-c", NAMES[i]);
            c.title = skel.replace("[NAME]", NAMES[i]);
            chips.appendChild(c);
            items.push({ skel: skel, el: c });
          }
          h.textContent = "cluster " + (gi + 1) + K.t(" · 표면 중복 — ", " · surface duplicates — ") + skel + "  #" + fnv(skel);
        } else {
          PARA[g.id].forEach(function (txt) {
            var c = K.el("span", "dd-c", txt);
            c.appendChild(K.el("span", "dd-hash", "#" + fnv(txt)));
            chips.appendChild(c);
            items.push({ skel: txt, el: c });
          });
          h.textContent = "cluster " + (gi + 1) + K.t(" · 의미 중복 — 표현은 다르고 뜻은 같다", " · semantic duplicates — different words, same meaning");
        }
        box.appendChild(row);
        return { surface: surface, items: items };
      });
      paint();
    }

    function paint() {
      sMethod.set(method);
      sKeep.input.disabled = method === "surface";
      var alive = rows.map(function (r) { return r.items.map(function () { return true; }); });
      if (method === "surface" || method === "both") {
        var seen = {};
        rows.forEach(function (r, ri) {
          r.items.forEach(function (it, ii) {
            var h = fnv(it.skel);
            if (seen[h]) alive[ri][ii] = false; else seen[h] = true;
          });
        });
      }
      if (method === "semantic" || method === "both") {
        rows.forEach(function (r, ri) {
          var idx = [];
          alive[ri].forEach(function (a, ii) { if (a) idx.push(ii); });
          var k = Math.max(1, Math.round(idx.length * keep));
          idx.slice(k).forEach(function (ii) { alive[ri][ii] = false; });
        });
      }
      var total = 0, left = 0, maxTpl = 0, maxPara = 0;
      rows.forEach(function (r, ri) {
        var n = 0;
        r.items.forEach(function (it, ii) {
          total++;
          var a = alive[ri][ii];
          it.el.className = "dd-c" + (a ? "" : " gone");
          if (a) { left++; n++; }
        });
        if (r.surface) maxTpl = Math.max(maxTpl, n); else maxPara = Math.max(maxPara, n);
      });
      read.textContent = K.t("남은 문장 ", "Sentences left ") + left + "/" + total +
        K.t(" · 같은 템플릿이 가장 많이 남은 수 ", " · most copies of one template left: ") + maxTpl +
        K.t(" · 같은 뜻 묶음에 가장 많이 남은 수 ", " · most sentences left in one same-meaning cluster: ") + maxPara;
      var v;
      if (method === "semantic") {
        if (maxTpl > 1) v = K.t("슬롯만 다른 문장들이 한 cluster 에 모여 keep ratio 만큼 함께 남는다. 같은 템플릿이 여러 번 살아남는 이유다.",
          "Slot variants share one cluster and survive together at the keep ratio — this is how one template lives on many times.");
        else if (origin === "free") v = K.t("자유 작성 데이터는 중복 대부분이 같은 뜻 묶음이라, 의미 dedup 이 그 묶음들을 keep ratio 만큼 줄인다.",
          "In free-written data most duplicates are same-meaning clusters, and semantic dedup trims each of them by the keep ratio.");
        else v = K.t("keep ratio 를 낮추면 템플릿 묶음은 1개까지 줄지만, 같은 비율이 의미 중복 묶음에도 걸린다.",
          "A low keep ratio squeezes template rows to one, but the same ratio also hits the semantic rows.");
      } else if (method === "surface") {
        v = origin === "slot"
          ? K.t("이름을 [NAME] 으로 바꾸면 해시가 같아져 템플릿마다 하나만 남는다. 표현이 다른 같은 뜻 문장은 해시가 달라 그대로 남는다.",
            "Replacing the name with [NAME] makes the hashes equal, so one sentence per template remains. Same-meaning sentences in different words hash differently and all stay.")
          : K.t("같은 뜻이라도 표현이 다르면 해시가 달라 거의 그대로 남는다. 이 데이터에서는 표면 dedup 만으로는 부족하다.",
            "Same meaning in different words gives different hashes, so nearly everything stays. Surface dedup alone falls short on this data.");
      } else {
        v = K.t("표면 dedup 이 템플릿 중복을 먼저 걷어 내고, 의미 dedup 이 남은 의미 중복을 줄인다. 두 도구는 서로를 대체하지 못하고 보완한다.",
          "Surface dedup clears template copies first, then semantic dedup trims the remaining same-meaning sentences. The two tools complement rather than replace each other.");
      }
      verdict.textContent = v;
    }

    build();
  });
})();
