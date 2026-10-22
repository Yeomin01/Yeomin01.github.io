/* 「배포된 모델은 못 고치니 자를 고쳤다」 글의 그림: 칸을 겹쳐 채우면 생성량이 부족분의 합이 아니라 가장 큰 축의 부족분이 된다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("fix-the-ruler-when-the-model-is-shipped-css", [
    '.tca[data-demo="ruler-cell-fill"] .tca-rows{--tca-lw:78px;--tca-rw:36px}',
    '.tca[data-demo="ruler-cell-fill"] .tca-fill{transition:none}',
    '.tca[data-demo="ruler-cell-fill"] .rf-over{font-size:12.5px;color:var(--secondary);margin-top:6px;font-variant-numeric:tabular-nums}'
  ].join(""));

  K.register("ruler-cell-fill", function (root) {
    // 부족분(목표 − 현재)은 예시 값. 의료·국방·통신 0건은 글과 같다.
    var AXES = [
      { name: K.t("말투", "Tone"), color: K.COLORS[0], cells: [[K.t("존댓말", "Polite"), 0], [K.t("반말", "Casual"), 150], [K.t("혼합", "Mixed"), 100]] },
      { name: K.t("형식", "Format"), color: K.COLORS[1], cells: [[K.t("대화", "Dialog"), 0], [K.t("목록·표", "List/table"), 80],
        [K.t("문서 붙여넣기", "Pasted doc"), 200], [K.t("코드·로그", "Code/log"), 60]] },
      { name: K.t("도메인", "Domain"), color: K.COLORS[3], cells: [[K.t("공공", "Public"), 50], [K.t("의료", "Medical"), 200], [K.t("국방", "Defense"), 200],
        [K.t("통신", "Telecom"), 200], [K.t("금융", "Finance"), 0], [K.t("일반", "General"), 0]] }
    ];
    var SCALE = 200, RATE = 130; // 막대 최대 200건, 초당 130건 생성
    var SUM = 0, MAXAX = 0, MAXNAME = "";
    AXES.forEach(function (a) {
      a.total = a.cells.reduce(function (s, c) { return s + c[1]; }, 0);
      SUM += a.total;
      if (a.total > MAXAX) { MAXAX = a.total; MAXNAME = a.name; }
    });

    K.head(root, K.t("칸별 부족분을 겹쳐 채우기", "Filling cell gaps with overlap"),
      K.t("한 건은 말투·형식·도메인마다 칸 하나씩, 세 칸에 동시에 들어간다. 겹쳐 채울 때와 칸마다 따로 채울 때 몇 건을 만들어야 끝나는지 비교한다.",
        "Each item lands in one cell per axis — tone, format and domain at once. Compare how many items it takes when cells are filled together versus one at a time."));

    var mode = "overlap", playing = !K.reduce, acc = 0, gen = 0, rem, over;
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "overlap", label: K.t("겹쳐 채우기", "Overlap") }, { value: "separate", label: K.t("칸마다 따로", "One cell each") }],
      mode, function (v) { mode = v; reset(); if (!K.reduce) { playing = true; syncPlay(); } }, K.t("채우는 방식", "Filling mode"));
    var bPlay = K.btn(K.t("일시정지", "Pause"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(sg.el); bar.appendChild(bPlay); bar.appendChild(bReset);
    root.appendChild(bar);

    var three = K.el("div", "tca-three");
    AXES.forEach(function (a) {
      var box = K.el("div", "tca-box");
      box.appendChild(K.el("div", "tca-h", a.name + K.t(" — 부족분 합 ", " — gap total ") + K.fmt(a.total)));
      var rows = K.el("div", "tca-rows");
      a.ui = a.cells.map(function (c) {
        var r = K.el("div", "tca-row");
        r.appendChild(K.el("div", "tca-row-l", c[0]));
        var tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill");
        f.style.background = a.color;
        tr.appendChild(f); r.appendChild(tr);
        var v = K.el("div", "tca-row-r");
        r.appendChild(v);
        rows.appendChild(r);
        return { f: f, v: v };
      });
      box.appendChild(rows);
      a.overEl = K.el("div", "rf-over");
      box.appendChild(a.overEl);
      three.appendChild(box);
    });
    root.appendChild(three);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "막대는 남은 부족분이다(최대 200건). 부족분은 예시 값이고, 정상 쪽 의료·국방·통신 0건은 글과 같게 두어 목표 200건(글의 보조 칸 기준)이 그대로 부족분이 됐다. 그림은 어떤 조합이든 만들 수 있다고 가정한다. 그래서 겹쳐 채우면 생성량이 가장 큰 축의 부족분과 정확히 같아진다.",
      "Bars show the remaining gap (max 200). Gaps are example values; the zero normal items in medical, defense and telecom match the post, so a 200 target (the post's secondary-cell size) becomes the whole gap. The figure assumes any combination can be generated, so with overlap the total equals the largest axis gap exactly.")));

    function left() {
      var n = 0;
      rem.forEach(function (ax) { ax.forEach(function (v) { n += v; }); });
      return n;
    }
    function argmax(arr) {
      var b = 0;
      for (var i = 1; i < arr.length; i++) if (arr[i] > arr[b]) b = i;
      return b;
    }
    function one() {
      gen++;
      if (mode === "overlap") {
        rem.forEach(function (ax, i) {
          var j = argmax(ax);
          if (ax[j] > 0) ax[j]--; else over[i]++;
        });
      } else {
        var bi = 0, bj = 0, bv = -1;
        rem.forEach(function (ax, i) { ax.forEach(function (v, j) { if (v > bv) { bv = v; bi = i; bj = j; } }); });
        rem[bi][bj]--;
      }
    }
    function render() {
      AXES.forEach(function (a, i) {
        a.ui.forEach(function (u, j) {
          u.f.style.width = (rem[i][j] / SCALE * 100).toFixed(1) + "%";
          u.v.textContent = K.fmt(rem[i][j]);
        });
        a.overEl.textContent = mode === "overlap" ? K.t("이미 찬 칸에 더 들어감 +", "Extra into full cells +") + K.fmt(over[i]) : "";
      });
      var done = left() === 0;
      if (!done) {
        read.textContent = K.t("생성 ", "Generated ") + K.fmt(gen) + K.t("건 · 남은 부족분 ", " · gap left ") + K.fmt(left()) +
          K.t("건", "") + " — " + K.t("칸별 부족분의 합 ", "sum of cell gaps ") + K.fmt(SUM) + K.t("건 · 가장 큰 축(", " · largest axis (") + MAXNAME + ") " + K.fmt(MAXAX) + K.t("건", "");
      } else if (mode === "overlap") {
        read.textContent = K.t("다 채웠다: " + K.fmt(gen) + "건. 가장 큰 축(" + MAXNAME + ")의 부족분 " + K.fmt(MAXAX) + "건과 같고, 칸별 부족분의 합 " + K.fmt(SUM) + "건보다 " + K.fmt(SUM - gen) + "건 적다.",
          "Done: " + K.fmt(gen) + " items, equal to the largest axis gap (" + MAXNAME + ", " + K.fmt(MAXAX) + ") and " + K.fmt(SUM - gen) + " fewer than the sum of cell gaps (" + K.fmt(SUM) + ").");
      } else {
        read.textContent = K.t("다 채웠다: " + K.fmt(gen) + "건. 한 건이 한 칸만 채우니 칸별 부족분의 합과 같다.",
          "Done: " + K.fmt(gen) + " items. Each item fills one cell, so this is the sum of cell gaps.");
      }
    }
    function syncPlay() { bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"); }
    function reset() {
      gen = 0; acc = 0;
      rem = AXES.map(function (a) { return a.cells.map(function (c) { return c[1]; }); });
      over = AXES.map(function () { return 0; });
      if (K.reduce) { while (left() > 0) one(); playing = false; }
      syncPlay();
      render();
    }
    bPlay.addEventListener("click", function () {
      if (!playing && left() === 0) reset();
      playing = !playing; syncPlay();
    });
    bReset.addEventListener("click", function () {
      reset();
      if (!K.reduce) { playing = true; syncPlay(); }
    });
    K.loop(root, function (dt) {
      if (!playing) return;
      acc += dt * RATE / 1000;
      var n = Math.floor(acc);
      if (n < 1) return;
      acc -= n;
      while (n-- > 0 && left() > 0) one();
      if (left() === 0) { playing = false; syncPlay(); }
      render();
    });
    reset();
  });
})();
