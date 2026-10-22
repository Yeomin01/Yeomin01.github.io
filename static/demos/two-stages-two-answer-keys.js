/* 「두 단계를 서로 다른 정답지로 채점하고 있었다」 글의 그림: 정답지를 섞어 채점할 때 생기는 착시, 해제 전용 단계의 정밀도 경계선 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("two-stages-two-answer-keys-css", [
    '.tca[data-demo="keys-mix"] .km-c{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}',
    '.tca[data-demo="keys-mix"] .km-c span{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:26px;padding:0 6px;',
    'border-radius:13px;font-size:12px;font-weight:600;color:#111;border:2px solid transparent;transition:opacity .3s,border-color .3s}',
    '.tca[data-demo="keys-mix"] .km-c span.tp{border-color:var(--tca-good);border-style:solid}',
    '.tca[data-demo="keys-mix"] .km-c span.fp{border-color:var(--tca-bad);border-style:dashed}',
    '.tca[data-demo="keys-mix"] .km-c span.rel{opacity:.25;border-color:transparent}',
    '.tca[data-demo="keys-mix"] .km-p{font-variant-numeric:tabular-nums;font-size:13px}',
    '.tca[data-demo="keys-bound"] .kb-t{display:grid;grid-template-columns:minmax(0,1.3fr) repeat(4,minmax(0,1fr));gap:2px 6px;font-size:13px;font-variant-numeric:tabular-nums;margin-top:10px}',
    '.tca[data-demo="keys-bound"] .kb-t>span{text-align:right}',
    '.tca[data-demo="keys-bound"] .kb-t>span.l{text-align:left;color:var(--secondary)}',
    '.tca[data-demo="keys-bound"] .kb-s{position:relative;height:30px;margin:26px 0 22px;border-radius:4px;background:var(--code-bg)}',
    '.tca[data-demo="keys-bound"] .kb-zone{position:absolute;top:0;bottom:0;opacity:.2;transition:width .3s,left .3s}',
    '.tca[data-demo="keys-bound"] .kb-m{position:absolute;top:-4px;bottom:-4px;width:3px;margin-left:-1px;transition:left .3s}',
    '.tca[data-demo="keys-bound"] .kb-m b{position:absolute;white-space:nowrap;font-size:12px;font-weight:600;transform:translateX(-50%)}',
    '.tca[data-demo="keys-bound"] .kb-z{position:absolute;top:7px;font-size:12px;color:var(--secondary)}'
  ].join(""));

  /* 1. 열마다 다른 정답지로 채점하면 */
  K.register("keys-mix", function (root) {
    // t: 종류, k1/k2: 그 정답지에서 가려야 하나, rel: 2차가 풀었나
    var ITEMS = [];
    for (var i = 0; i < 16; i++) ITEMS.push({ t: "p", k1: 1, k2: 1, rel: i === 9 });
    for (var j = 0; j < 4; j++) ITEMS.push({ t: "f", k1: 1, k2: 0, rel: j < 2 });
    ITEMS.push({ t: "w", k1: 0, k2: 0, rel: true });
    var NAME = { p: K.t("개인", "Priv"), f: K.t("공인", "Pub"), w: K.t("단어", "Word") };
    var COL = { p: K.COLORS[0], f: K.COLORS[6], w: K.COLORS[5] };
    var mode = "own", shown = 0;

    K.head(root, K.t("두 열을 서로 다른 정답지로 채점하면", "Scoring each column with its own key"),
      K.t("1차가 가린 21개 중 2차가 4개를 푼다(예시). 채점 방식을 바꾸면 같은 출력의 정밀도 변화 방향이 뒤집힌다.",
        "Stage 1 masks 21; stage 2 unmasks 4 (example). Change the scoring and the direction of the precision change flips."));
    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: "own", label: K.t("열마다 자기 정답지", "Each column its own key") }, { value: "same", label: K.t("둘 다 2차 정답지", "Both on the stage-2 key") }],
      mode, function (v) { mode = v; shown = K.reduce ? 99 : 0; paint(); }, K.t("채점 방식", "Scoring"));
    bar.appendChild(seg.el);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    function col(title) {
      var b = K.el("div", "tca-box"), h = K.el("div", "tca-h", title), k = K.el("div", "tca-tag", ""), c = K.el("div", "km-c"), p = K.el("div", "km-p", "");
      b.appendChild(h); b.appendChild(k); b.appendChild(c); b.appendChild(p); two.appendChild(b);
      var chips = ITEMS.map(function (it) { var s = K.el("span", "", NAME[it.t]); s.style.background = COL[it.t]; c.appendChild(s); return s; });
      return { k: k, chips: chips, p: p };
    }
    var c1 = col(K.t("1차 출력 — 가린 21개", "Stage 1 — 21 masked")), c2 = col(K.t("2차 출력 — 그중 4개를 풂", "Stage 2 — 4 of them unmasked"));
    root.appendChild(two);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var lg = K.el("div", "tca-legend");
    [["p", K.t("개인 — 두 정답지 모두 '가려야 함'", "Priv — mask on both keys")], ["f", K.t("공인 이름 — 1차 '가려야 함', 2차 '가리면 안 됨'", "Public name — mask on key 1, keep on key 2")],
      ["w", K.t("단어 — 개인정보 아님", "Word — not PII")]].forEach(function (x) {
      var sp = K.el("span", ""), ic = document.createElement("i"); ic.style.background = COL[x[0]]; sp.appendChild(ic); sp.appendChild(document.createTextNode(x[1])); lg.appendChild(sp);
    });
    root.appendChild(lg);
    root.appendChild(K.el("div", "tca-note", K.t(
      "실선 테두리 = 그 열의 정답지에서 정탐, 점선 = 오탐, 흐린 칩 = 2차가 푼 것. 개수는 예시 값이다. 본문 골드셋에서 두 정답지가 갈리는 자리는 수천 개였다.",
      "Solid outline = true positive on that column's key, dashed = false positive, faded = unmasked by stage 2. Counts are examples; in the post thousands of spots differ.")));

    function score(colIdx, key) {
      var tp = 0, fp = 0;
      ITEMS.forEach(function (it) { if (colIdx === 2 && it.rel) return; if (it[key]) tp++; else fp++; });
      return { tp: tp, fp: fp, p: tp / (tp + fp) };
    }
    function paint() {
      var k1 = mode === "own" ? "k1" : "k2", k2 = "k2";
      c1.k.textContent = mode === "own" ? K.t("1차 정답지로 채점", "scored on key 1") : K.t("2차 정답지로 채점", "scored on key 2");
      c2.k.textContent = K.t("2차 정답지로 채점", "scored on key 2");
      [[c1, k1, 1], [c2, k2, 2]].forEach(function (x) {
        x[0].chips.forEach(function (s, i) {
          var it = ITEMS[i];
          if (x[2] === 2 && it.rel) { s.className = "rel"; return; }
          s.className = i < shown ? (it[x[1]] ? "tp" : "fp") : "";
        });
      });
      var s1 = score(1, k1), s2 = score(2, k2), done = shown >= ITEMS.length;
      c1.p.textContent = done ? K.t("정밀도 ", "precision ") + s1.tp + " / " + (s1.tp + s1.fp) + " = " + s1.p.toFixed(3) : "…";
      c2.p.textContent = done ? K.t("정밀도 ", "precision ") + s2.tp + " / " + (s2.tp + s2.fp) + " = " + s2.p.toFixed(3) : "…";
      if (!done) { read.textContent = ""; return; }
      var up = s2.p > s1.p;
      read.textContent = (up ? K.t("2차를 붙이면 정밀도가 오른다 ", "Adding stage 2 raises precision ") : K.t("2차를 붙이면 정밀도가 떨어진 것처럼 보인다 ", "Adding stage 2 seems to lower precision ")) +
        "(" + s1.p.toFixed(3) + " → " + s2.p.toFixed(3) + "). " +
        (mode === "own" ? K.t("차이에 2차의 효과와 정답지 차이가 섞여 있다.", "The gap mixes the stage-2 effect with the key difference.")
          : K.t("같은 정답지 하나로 재야 2차의 효과만 남는다.", "With one key, only the stage-2 effect remains."));
      read.className = "tca-read " + (up ? "tca-good" : "tca-warn");
    }
    K.loop(root, function (dt) {
      if (shown >= ITEMS.length) return;
      shown += dt / 45;
      if (shown >= ITEMS.length) shown = ITEMS.length;
      paint();
    });
    shown = K.reduce ? ITEMS.length : 0;
    paint();
  });

  /* 2. 해제 전용 단계가 정밀도를 떨어뜨리려면 */
  K.register("keys-bound", function (root) {
    var G = 36000, TP = 32999, FP = 1428; // 본문 표(정밀도·재현율)와 해제 개수에서 역산한 근사값
    var x = 131, y = 169;
    K.head(root, K.t("2차가 푼 오탐과 정탐, 정밀도의 경계선", "What stage 2 unmasks, and the precision boundary"),
      K.t("2차가 푼 정탐(x)과 오탐(y)을 움직여 본다. 푼 오탐:정탐 비율이 남은 오탐:정탐 비율(약 0.04:1)보다 낮아야만 정밀도가 떨어진다.",
        "Move the true (x) and false (y) positives stage 2 unmasks. Precision drops only if y:x falls below the remaining FP:TP ratio (about 0.04:1)."));
    var bar = K.el("div", "tca-bar");
    var sX = K.slider({ label: K.t("푼 정탐 x", "Unmasked TP x"), min: 0, max: 600, step: 1, value: x, fmt: function (v) { return K.fmt(v); }, onInput: function (v) { x = v; paint(); } });
    var sY = K.slider({ label: K.t("푼 오탐 y", "Unmasked FP y"), min: 0, max: 800, step: 1, value: y, fmt: function (v) { return K.fmt(v); }, onInput: function (v) { y = v; paint(); } });
    bar.appendChild(sX.el); bar.appendChild(sY.el);
    root.appendChild(bar);
    var pre = K.el("div", "tca-bar");
    function preset(label, px, py) { var b = K.btn(label); b.addEventListener("click", function () { x = px; y = py; sX.set(px); sY.set(py); paint(); }); pre.appendChild(b); }
    preset(K.t("본문 값 (정탐 131 · 오탐 169)", "Post (TP 131 · FP 169)"), 131, 169);
    preset(K.t("경계선 근처 (예시: 정탐 480 · 오탐 20)", "Near the boundary (example: 480 · 20)"), 480, 20);
    preset(K.t("정탐을 60배 풂 (예시: 600 · 10)", "60× more TP (example: 600 · 10)"), 600, 10);
    root.appendChild(pre);

    var scale = K.el("div", "kb-s");
    scale.setAttribute("aria-hidden", "true");
    var mB = K.el("div", "kb-m"), mC = K.el("div", "kb-m");
    mB.style.background = "var(--primary)"; mC.style.background = "var(--tca-accent)";
    var lbB = K.el("b", ""), lbC = K.el("b", "");
    lbB.style.top = "-20px"; lbC.style.bottom = "-20px"; lbC.style.color = "var(--tca-accent)";
    mB.appendChild(lbB); mC.appendChild(lbC);
    var zl = K.el("span", "kb-z", K.t("정밀도 ↓", "precision ↓")), zr = K.el("span", "kb-z", K.t("정밀도 ↑", "precision ↑"));
    zl.style.left = "6px"; zr.style.right = "6px";
    var zoneL = K.el("div", "kb-zone"), zoneR = K.el("div", "kb-zone");
    zoneL.style.left = "0"; zoneL.style.background = "var(--tca-bad)"; zoneR.style.right = "0"; zoneR.style.background = "var(--tca-good)";
    scale.appendChild(zoneL); scale.appendChild(zoneR);
    scale.appendChild(zl); scale.appendChild(zr); scale.appendChild(mB); scale.appendChild(mC);
    root.appendChild(scale);

    var tb = K.el("div", "kb-t");
    var heads = ["", K.t("정밀도", "Precision"), K.t("재현율", "Recall"), "F1", "F0.5"];
    heads.forEach(function (h) { tb.appendChild(K.el("span", "l", h)); });
    function line(label) { tb.appendChild(K.el("span", "l", label)); return [0, 1, 2, 3].map(function () { var s = K.el("span", ""); tb.appendChild(s); return s; }); }
    var L1 = line(K.t("1차만", "Stage 1")), L2 = line(K.t("2차까지", "With stage 2")), LD = line(K.t("차이", "Change"));
    root.appendChild(tb);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "1차 기준값(정답 36,000 · 정탐 32,999 · 오탐 1,428)은 본문 표의 정밀도·재현율과 해제 개수(오탐 169 · 정탐 131)에 맞춰 거꾸로 구한 근사값이다. 본문 값 단추를 누르면 표의 2차 행이 그대로 나온다. 눈금은 로그 축이다.",
      "The stage-1 base (36,000 gold · 32,999 TP · 1,428 FP) is back-solved from the post's table and the 169/131 unmasked; the post preset reproduces its second row. The scale is logarithmic.")));

    function met(tp, fp) { var p = tp / (tp + fp), r = tp / G; return [p, r, 2 * p * r / (p + r), 1.25 * p * r / (0.25 * p + r)]; }
    var LO = Math.log(0.005), HI = Math.log(50);
    function pos(v) { return Math.max(0, Math.min(100, 100 * (Math.log(v) - LO) / (HI - LO))); }
    function anchor(lb, p) { lb.style.transform = p > 78 ? "translateX(-100%)" : p < 22 ? "translateX(0)" : "translateX(-50%)"; }
    function ratio(v) { return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3); }
    function paint() {
      var a = met(TP, FP), b = met(TP - x, FP - y), bound = FP / TP;
      for (var i = 0; i < 4; i++) {
        L1[i].textContent = a[i].toFixed(4); L2[i].textContent = b[i].toFixed(4);
        var d = b[i] - a[i];
        LD[i].textContent = (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(4);
        LD[i].className = Math.abs(d) < 5e-5 ? "" : d > 0 ? "tca-good" : "tca-bad";
      }
      var bp = pos(bound);
      zoneL.style.width = bp + "%"; zoneR.style.width = (100 - bp) + "%";
      mB.style.left = bp + "%"; anchor(lbB, bp);
      lbB.textContent = K.t("경계 ", "boundary ") + ratio(bound) + ":1";
      var msg;
      if (x === 0 && y === 0) { mC.style.display = "none"; msg = K.t("푼 것이 없다. 두 행이 같다.", "Nothing unmasked; both rows match."); }
      else if (x === 0) { mC.style.display = "none"; msg = K.t("정탐을 하나도 안 풀었다. 이때 정밀도는 오르기만 한다.", "No true positives unmasked, so precision can only rise."); }
      else {
        var rr = y / x;
        var cp = pos(Math.max(rr, 0.0051));
        mC.style.display = ""; mC.style.left = cp + "%"; anchor(lbC, cp);
        lbC.textContent = K.t("지금 ", "now ") + ratio(rr) + ":1";
        msg = K.t("푼 오탐:정탐 = ", "Unmasked FP:TP = ") + ratio(rr) + ":1, " + K.t("남은 오탐:정탐 = ", "remaining FP:TP = ") + ratio(bound) + ":1 → " +
          (rr > bound ? K.t("정밀도가 오른다.", "precision rises.") : rr < bound ? K.t("정밀도가 떨어진다.", "precision drops.") : K.t("정밀도가 그대로다.", "precision unchanged."));
      }
      read.textContent = msg;
    }
    paint();
  });
})();
