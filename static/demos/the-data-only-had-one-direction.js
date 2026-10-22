/* 「데이터가 한 방향으로만 쌓여 있었다」 글의 그림: 놓친 38건에서 구조상 못 잡는 31건을 가르면 분모와 미탐률이 어떻게 바뀌나 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("dir-split", function (root) {
    var TOTAL = 238, CUM = 31, NAME = 7, HIT = TOTAL - CUM - NAME; // 200
    K.css("the-data-only-had-one-direction-css", [
      '.tca[data-demo="dir-split"] .dir-g{display:grid;grid-template-columns:repeat(17,minmax(0,1fr));gap:2px;max-width:380px}',
      '.tca[data-demo="dir-split"] .dir-g i{display:block;aspect-ratio:1;border-radius:2px;background:var(--tca-good);transition:background .25s,opacity .25s}',
      '.tca[data-demo="dir-split"] .dir-g i.m{background:var(--tca-bad)}',
      '.tca[data-demo="dir-split"] .dir-g i.x{background:transparent;box-shadow:inset 0 0 0 1.5px var(--tca-warn);opacity:.8}',
      '.tca[data-demo="dir-split"] .dir-lg i.x{background:transparent;box-shadow:inset 0 0 0 1.5px var(--tca-warn)}',
      '.tca[data-demo="dir-split"] .dir-k{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;margin-top:10px;font-size:13px}',
      '.tca[data-demo="dir-split"] .dir-k b{font-weight:600;text-align:right}'
    ].join(""));

    K.head(root, K.t("놓친 38건을 둘로 가르기", "Splitting the 38 misses"),
      K.t("칸 하나가 사용자 발화로 들어온 PII 1건이다(238칸). 보기를 바꾸면 누적형 31건이 분모 밖으로 빠지면서 미탐률이 다시 계산된다.",
        "Each square is one PII value from user turns (238). Switch the view and the 31 cumulative cases leave the denominator."));

    var mode = "raw";
    var bar = K.el("div", "tca-bar");
    var seg = K.seg([
      { value: "raw", label: K.t("놓친 38건을 그대로", "All 38 as misses") },
      { value: "split", label: K.t("구조상 못 잡는 31건 분리", "Separate the 31 structural") }
    ], mode, function (v) { mode = v; target(); }, K.t("세는 방식", "Counting"));
    bar.appendChild(seg.el);
    root.appendChild(bar);

    var grid = K.el("div", "dir-g");
    grid.setAttribute("aria-hidden", "true");
    var cells = [];
    for (var i = 0; i < TOTAL; i++) { var c = document.createElement("i"); grid.appendChild(c); cells.push(c); }
    root.appendChild(grid);

    var lg = K.el("div", "tca-legend dir-lg");
    function key(cls, color, txt) {
      var s = K.el("span", "");
      var i = document.createElement("i");
      if (cls) i.className = cls; else i.style.background = color;
      s.appendChild(i); s.appendChild(document.createTextNode(txt));
      lg.appendChild(s);
    }
    key("", "var(--tca-good)", K.t("가드가 잡음 200", "Caught 200"));
    key("", "var(--tca-bad)", K.t("놓침", "Missed"));
    key("x", "", K.t("구조상 못 잡음(턴에 나뉜 누적형)", "Structurally out of reach (spread over turns)"));
    root.appendChild(lg);

    var k = K.el("div", "dir-k");
    function line(label) { var l = K.el("span", "", label), v = K.el("b", "tca-num", ""); k.appendChild(l); k.appendChild(v); return v; }
    var vDen = line(K.t("분모", "Denominator"));
    var vMiss = line(K.t("미탐으로 세는 것", "Counted as misses"));
    var vRate = line(K.t("미탐률", "Miss rate"));
    var vHit = line(K.t("탐지율", "Detection rate"));
    var vOut = line(K.t("따로 보고(배포 형태의 결과)", "Reported separately (deployment shape)"));
    root.appendChild(k);
    var read = K.el("div", "tca-note");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "수치는 본문 그대로다(238 · 38 · 31 · 7 · 200/207). 단일 메시지 미탐 7건은 전부 이름이고, 이름을 맡는 문맥 판단 단계는 이번 측정에서 껐다.",
      "Numbers are from the post (238 · 38 · 31 · 7 · 200/207). The 7 single-message misses are all names; the context stage that handles names was off.")));

    // 칸 순서: 잡은 200 → 단일 미탐 7 → 누적형 31
    function want(i) {
      if (i < HIT) return "";
      if (i < HIT + NAME) return "m";
      return mode === "raw" ? "m" : "x";
    }
    var shown = -1, acc = 0;
    function target() {
      if (K.reduce) { paintAll(); readouts(); return; }
      shown = HIT + NAME - 1; acc = 0;
    }
    function paintAll() { cells.forEach(function (c, i) { c.className = want(i); }); shown = TOTAL; }
    function readouts() {
      var split = mode === "split";
      var den = split ? TOTAL - CUM : TOTAL, miss = split ? NAME : NAME + CUM;
      vDen.textContent = K.fmt(den) + K.t("건", "");
      vMiss.textContent = K.fmt(miss) + K.t("건", "");
      vRate.textContent = miss + " / " + den + " = " + (100 * miss / den).toFixed(1) + "%";
      vHit.textContent = HIT + " / " + den + " = " + (100 * HIT / den).toFixed(1) + "%";
      vOut.textContent = split ? CUM + K.t("건", "") : "—";
      vRate.className = "tca-num " + (split ? "" : "tca-bad");
      read.textContent = split
        ? K.t("메시지 단위 스캐너가 원리상 볼 수 없는 31건을 빼면, 고칠 수 있는 미탐은 이름 7건이다.",
          "Remove the 31 a per-message scanner cannot see, and the fixable misses are the 7 names.")
        : K.t("38건을 그대로 쓰면 미탐률 16%. 이 숫자로는 무엇을 고쳐야 할지 정할 수 없다.",
          "Use all 38 and the miss rate is 16%. That number does not say what to fix.");
    }
    K.loop(root, function (dt) {
      if (shown >= TOTAL) return;
      acc += dt;
      while (acc > 28 && shown < TOTAL) { acc -= 28; shown++; if (cells[shown]) cells[shown].className = want(shown); }
      if (shown >= TOTAL) readouts();
    });
    paintAll();
    readouts();
  });
})();
