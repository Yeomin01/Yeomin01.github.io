/* 「같은 수치가 네 번 어긋났다」 글의 그림: 네 번의 어긋남을 이름만 붙인 값과 단위를 붙인 값으로 나란히 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("den-units", function (root) {
    var CASES = [
      { id: 1, plain: K.t("미탐", "misses"), max: 140, fmt: function (v) { return K.fmt(v) + K.t("건", ""); },
        a: { v: 90, u: K.t("단위: 대화 × 방향 × 라벨 (필드 단위)", "unit: conversation × direction × label (field level)") },
        b: { v: 125, u: K.t("단위: 대화 × 방향 × 라벨 × 턴 (턴 단위)", "unit: … × turn (turn level)") },
        why: K.t("같은 값이 여러 턴에서 새면 필드로는 1건, 턴으로는 여러 건이다. 배수가 라벨마다 달라서(어떤 라벨은 1.1배, 어떤 라벨은 4.0배) 라벨 간 비교가 통째로 흔들린다.",
          "One value leaking over several turns is one field but several turns. The multiplier differs by label (1.1× for one, 4.0× for another).") },
      { id: 2, plain: K.t("미탐률", "miss rate"), max: 5, fmt: function (v) { return v.toFixed(2) + "%"; },
        a: { v: 3.02, u: K.t("분모: 턴 길이 40자 이상만", "denominator: turns ≥ 40 chars") },
        b: { v: 3.98, u: K.t("분모: 전체", "denominator: all turns") },
        why: K.t("40자 미만을 뺀 건 위치 분석에선 맞는 판단이었다. 그 필터를 전체 미탐률에도 걸어서 위험이 낮게 보고됐다.",
          "Dropping short turns was right for the position analysis, but applying it to the overall rate under-reported risk.") },
      { id: 3, plain: "recall", max: 100, fmt: function (v) { return v.toFixed(1) + "%"; },
        a: { v: 93.0, u: K.t("필터 함수에 값을 직접 넣은 통과율", "filter fed values directly") },
        b: { v: 88.4, u: K.t("파이프라인 전체를 통과시킨 값", "through the whole pipeline") },
        why: K.t("93.0%는 앞단 모델이 그 값을 잡았는지를 전제하지 않은 값이다.", "93.0% does not assume the upstream model caught the value.") },
      { id: 4, plain: K.t("미탐", "misses"), max: 140, fmt: function (v) { return K.fmt(v) + K.t("건", ""); },
        a: { v: 86, u: K.t("사례 파일의 행 수", "rows in the case file") },
        b: { v: 74, u: K.t("좌표가 잡힌 스팬 수", "spans with coordinates") },
        why: K.t("86 − 74 = 12건은 마스킹돼 좌표를 못 잡았거나 여러 턴에 조각난 건이다. 이 차이를 파다가 사례 파일에서 통째로 빠진 10건(필드 합계 90 대 80)도 찾았다.",
          "The 12 are masked or fragmented cases. Digging into this also found 10 cases missing from the file (field totals 90 vs 80).") }
    ];

    K.css("the-same-number-disagreed-four-times-css", [
      '.tca[data-demo="den-units"] .den-ill{margin-top:10px;padding:8px 10px;border:1px dashed var(--tertiary);border-radius:6px;font-size:13px;min-height:84px}',
      '.tca[data-demo="den-units"] .den-turns{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}',
      '.tca[data-demo="den-units"] .den-turns span{border:1px solid var(--tertiary);border-radius:5px;padding:2px 8px;font-size:12.5px;transition:background .25s}',
      '.tca[data-demo="den-units"] .den-turns span.on{background:var(--tca-bad);color:#111;border-color:transparent}',
      '.tca[data-demo="den-units"] .den-len{display:flex;flex-direction:column;gap:3px;margin:6px 0}',
      '.tca[data-demo="den-units"] .den-len div{height:9px;border-radius:2px;background:var(--tca-accent);transition:opacity .35s}',
      '.tca[data-demo="den-units"] .den-len div.out{opacity:.2}',
      '.tca[data-demo="den-units"] .den-stack{display:flex;height:18px;border-radius:3px;overflow:hidden;margin:6px 0;background:var(--code-bg)}',
      '.tca[data-demo="den-units"] .den-stack i{display:block;height:100%;transition:width .5s}',
      '.tca[data-demo="den-units"] .den-path{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:5px 0}',
      '.tca[data-demo="den-units"] .den-path span{border:1px solid var(--tertiary);border-radius:5px;padding:2px 8px;font-size:12.5px;transition:background .25s}',
      '.tca[data-demo="den-units"] .den-path span.on{background:var(--code-bg);border-color:var(--tca-accent)}'
    ].join(""));

    K.head(root, K.t("네 번의 어긋남, 이름과 단위", "Four mismatches: names and units"),
      K.t("번호를 고르면 양쪽 값이 나온다. 이름을 '단위를 붙인 이름'으로 바꾸면 두 값이 서로 다른 것을 세고 있었다는 게 드러난다.",
        "Pick a case to see both values. Switch to unit-bearing names and it shows they counted different things."));

    var cur = 0, named = false;
    var bar = K.el("div", "tca-bar");
    var segC = K.seg(CASES.map(function (c, i) { return { value: i, label: "①②③④".charAt(i) }; }), cur, function (v) { cur = v; render(); }, K.t("사례", "Case"));
    var segN = K.seg([{ value: false, label: K.t("이름만", "Name only") }, { value: true, label: K.t("단위를 붙인 이름", "Name with unit") }],
      named, function (v) { named = v; render(); }, K.t("지표 이름", "Metric name"));
    bar.appendChild(segC.el); bar.appendChild(segN.el);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "70px");
    rows.style.setProperty("--tca-rw", "64px");
    function row(color) {
      var wrap = K.el("div", "");
      var r = K.el("div", "tca-row"), l = K.el("div", "tca-row-l"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      f.style.background = color; tr.appendChild(f); r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      var u = K.el("div", "tca-note", "");
      u.style.margin = "0 0 6px";
      wrap.appendChild(r); wrap.appendChild(u); rows.appendChild(wrap);
      return { l: l, f: f, v: v, u: u };
    }
    var rA = row(K.COLORS[0]), rB = row(K.COLORS[1]);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var ill = K.el("div", "den-ill");
    root.appendChild(ill);
    root.appendChild(K.el("div", "tca-note", K.t(
      "네 쌍의 값과 단위는 본문 그대로다. 아래 작은 그림의 턴 수·문장 길이는 설명용 예시다. ②에서 3.02%가 40자 필터 쪽이라는 것은 '위험을 낮게 보고했다'는 본문 서술에서 읽은 것이다.",
      "The four pairs and units are from the post. Turn counts and sentence lengths in the small sketch are examples. That 3.02% is the filtered side is read from 'under-reported the risk'.")));

    var anim = null;
    function sketch(c) {
      ill.textContent = "";
      var cap = K.el("div", "tca-h", "");
      ill.appendChild(cap);
      if (c.id === 1) {
        cap.textContent = K.t("예시: 같은 값 하나가 다섯 턴 중 세 턴에서 샌다", "Example: one value leaks in three of five turns");
        var tw = K.el("div", "den-turns"), leak = [1, 0, 1, 1, 0], ts = [];
        for (var i = 0; i < 5; i++) { var s = K.el("span", "", K.t("턴 ", "turn ") + (i + 1)); tw.appendChild(s); ts.push(s); }
        ill.appendChild(tw);
        var cnt = K.el("div", "tca-num", "");
        ill.appendChild(cnt);
        anim = { n: 0, max: 5, t: 0, per: 600, draw: function (n) {
          var k = 0;
          ts.forEach(function (s, j) { var on = j < n && leak[j]; s.className = on ? "on" : ""; if (on) k++; });
          cnt.textContent = K.t("필드 단위 ", "field-level ") + (k ? 1 : 0) + K.t("건 · 턴 단위 ", " · turn-level ") + k + K.t("건", "");
        } };
      } else if (c.id === 2) {
        cap.textContent = K.t("예시: 턴 길이별 막대, 40자 미만이 분모에서 빠진다", "Example: turns by length; under 40 chars leave the denominator");
        var lw = K.el("div", "den-len"), L = [14, 120, 33, 64, 22, 88, 47, 105], bs = [];
        L.forEach(function (x) { var d = document.createElement("div"); d.style.width = Math.round(100 * x / 120) + "%"; lw.appendChild(d); bs.push(d); });
        ill.appendChild(lw);
        var c2 = K.el("div", "tca-num", "");
        ill.appendChild(c2);
        anim = { n: 0, max: L.length, t: 0, per: 350, draw: function (n) {
          var keep = 0;
          bs.forEach(function (d, j) { var out = j < n && L[j] < 40; d.className = out ? "out" : ""; if (!(j < n && L[j] < 40)) keep++; });
          c2.textContent = K.t("분모에 남은 턴 ", "turns left in denominator ") + keep + " / " + L.length;
        } };
      } else if (c.id === 3) {
        cap.textContent = K.t("두 값이 지나간 길", "The path each value took");
        var p1 = K.el("div", "den-path"), p2 = K.el("div", "den-path");
        var a1 = [K.t("값", "value"), K.t("필터", "filter")], a2 = [K.t("문장", "sentence"), K.t("앞단 모델", "upstream model"), K.t("필터", "filter")];
        function mk(p, arr, lbl) { p.appendChild(K.el("span", "tca-tag", lbl)); return arr.map(function (x, j) { if (j) p.appendChild(document.createTextNode("→")); var s = K.el("span", "", x); p.appendChild(s); return s; }); }
        var s1 = mk(p1, a1, "93.0%"), s2 = mk(p2, a2, "88.4%");
        ill.appendChild(p1); ill.appendChild(p2);
        anim = { n: 0, max: 3, t: 0, per: 650, draw: function (n) {
          s1.forEach(function (s, j) { s.className = n > 0 && j === Math.min(n - 1, 1) ? "on" : ""; });
          s2.forEach(function (s, j) { s.className = j === n - 1 ? "on" : ""; });
        } };
      } else {
        cap.textContent = K.t("사례 파일 86행의 속", "Inside the 86 rows");
        var stk = K.el("div", "den-stack"), i1 = document.createElement("i"), i2 = document.createElement("i");
        i1.style.background = K.COLORS[1]; i2.style.background = K.COLORS[6];
        stk.appendChild(i1); stk.appendChild(i2);
        ill.appendChild(stk);
        var lg = K.el("div", "tca-legend", "");
        [[K.COLORS[1], K.t("좌표가 잡힌 스팬 74", "spans with coordinates 74")], [K.COLORS[6], K.t("마스킹·여러 턴 조각 12", "masked or fragmented 12")]].forEach(function (x) {
          var sp = K.el("span", ""), ic = document.createElement("i"); ic.style.background = x[0]; sp.appendChild(ic); sp.appendChild(document.createTextNode(x[1])); lg.appendChild(sp);
        });
        ill.appendChild(lg);
        anim = { n: 0, max: 2, t: 0, per: 700, draw: function (n) {
          i1.style.width = (n >= 1 ? 100 * 74 / 86 : 100) + "%";
          i2.style.width = (n >= 1 ? 100 * 12 / 86 : 0) + "%";
        } };
      }
      anim.n = K.reduce ? anim.max : 0;
      anim.draw(anim.n);
    }
    function render() {
      var c = CASES[cur];
      [[rA, c.a, K.t("한쪽", "Side A")], [rB, c.b, K.t("다른 쪽", "Side B")]].forEach(function (x) {
        var r = x[0], d = x[1];
        r.l.textContent = named ? x[2] : "\"" + c.plain + "\"";
        r.f.style.width = Math.min(100, 100 * d.v / c.max) + "%";
        r.v.textContent = c.fmt(d.v);
        r.u.textContent = named ? d.u : K.t("이름: ", "name: ") + c.plain;
      });
      read.textContent = named ? K.t("둘 다 맞는 값이다. 세는 것이 다르다. ", "Both are correct; they count different things. ") + c.why
        : K.t("같은 이름에 다른 값. 어느 쪽이 틀렸는지 찾게 된다.", "Same name, different values. You go looking for who is wrong.");
      read.className = "tca-read" + (named ? "" : " tca-warn");
      sketch(c);
    }
    K.loop(root, function (dt) {
      if (!anim || K.reduce) return;
      anim.t += dt;
      if (anim.n < anim.max) { if (anim.t > anim.per) { anim.t = 0; anim.n++; anim.draw(anim.n); } }
      else if (anim.t > 2600) { anim.t = 0; anim.n = 0; anim.draw(0); }
    });
    render();
  });
})();
