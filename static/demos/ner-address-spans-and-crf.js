/* 「어절 여러 개에 걸친 ADDRESS — BIO 와 CRF」 글의 그림: Viterbi 가 칸을 채우며 B·I·I·I 를 고르는 과정 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("addr-crf-viterbi", function (root) {
    var TOK = ["서울특별시", "영등포구", "여의대로", "108"];
    var LAB = ["O", "B-ADDR", "I-ADDR"], SHORT = ["O", "B", "I"];
    // 토큰 점수(emission) — 예시 값. 여의대로는 O 가 I 보다 조금 높다.
    var EM = [[0.5, 3.0, 0.5], [0.5, 0.5, 2.5], [1.6, 0.3, 1.2], [0.6, 0.2, 2.0]];
    // 전이 점수 TR[앞][뒤] — 예시 값. START 는 첫 토큰 앞.
    var START = [0, 0, -3];
    var TR = [[0.5, 0, -3], [0, -1, 1], [0, -1, 1]];
    var T = TOK.length, MAXS = T + 1;

    // Viterbi 를 미리 계산해 둔다
    var dl = [], bp = [], how = [];
    for (var t = 0; t < T; t++) {
      dl.push([]); bp.push([]); how.push([]);
      for (var j = 0; j < 3; j++) {
        if (t === 0) { dl[t][j] = START[j] + EM[t][j]; bp[t][j] = -1; how[t][j] = { prev: -1, pv: 0, tr: START[j] }; continue; }
        var best = -1e9, bi = 0;
        for (var i = 0; i < 3; i++) { var v = dl[t - 1][i] + TR[i][j]; if (v > best) { best = v; bi = i; } }
        dl[t][j] = best + EM[t][j]; bp[t][j] = bi; how[t][j] = { prev: bi, pv: dl[t - 1][bi], tr: TR[bi][j] };
      }
    }
    var end = 0;
    for (var e = 1; e < 3; e++) if (dl[T - 1][e] > dl[T - 1][end]) end = e;
    var path = [end];
    for (var b = T - 1; b > 0; b--) path.unshift(bp[b][path[0]]);
    var arg = EM.map(function (row) { var m = 0; row.forEach(function (v, i) { if (v > row[m]) m = i; }); return m; });
    function score(seq) {
      var s = 0;
      seq.forEach(function (l, t) { s += EM[t][l] + (t === 0 ? START[l] : TR[seq[t - 1]][l]); });
      return s;
    }
    function f1(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(1); }
    function sg(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1); }

    var st = { s: 0, playing: false, acc: 0 };
    var D = '.tca[data-demo="addr-crf-viterbi"] ';
    K.css("ner-address-spans-and-crf-css", [
      D + ".cv-grid{display:grid;grid-template-columns:46px repeat(4,minmax(0,1fr));gap:4px}",
      D + ".cv-h{font-size:12.5px;font-weight:600;text-align:center;padding:2px 0;min-width:0;line-height:1.3}",
      D + ".cv-l{font-size:12px;color:var(--secondary);display:flex;align-items:center;min-width:0}",
      D + ".cv-c{border:1px solid var(--tertiary);border-radius:5px;padding:3px 4px;font-size:12px;line-height:1.35;text-align:center;font-variant-numeric:tabular-nums;min-width:0;background:var(--theme)}",
      D + ".cv-d{color:var(--secondary)}",
      D + ".cv-arg{border:2px dashed var(--tca-warn)}",
      D + ".cv-cur{background:var(--code-bg)}",
      D + ".cv-path{border:2px solid var(--tca-good);font-weight:600}",
      D + ".cv-path .cv-d{color:var(--tca-good)}",
      D + ".cv-tr{display:grid;grid-template-columns:auto repeat(3,minmax(36px,auto));gap:2px 10px;font-size:12.5px;font-variant-numeric:tabular-nums;margin-top:6px;width:max-content;max-width:100%}",
      D + ".cv-seq{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:13px}"
    ].join(""));

    K.head(root, K.t("CRF 가 칸을 채우며 시퀀스를 고르는 과정", "How the CRF fills the lattice and picks a sequence"),
      K.t("글의 깨진 예시(서울특별시 영등포구 여의대로 108)를 단계별로 디코딩한다. 칸마다 앞 열에서 '누적 + 전이 점수' 가 가장 큰 칸을 골라 화살표로 기억하고 자기 토큰 점수를 더한다. 끝에서 화살표를 거꾸로 따라간다.",
        "Decodes the post's broken example step by step. Each cell picks the previous-column cell with the largest running total plus transition, remembers it as an arrow, and adds its own token score. At the end the arrows are followed backwards."));

    var bar = K.el("div", "tca-bar");
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bPlay = K.btn(K.t("자동 재생", "Auto play"), false);
    var bReset = K.btn(K.t("처음부터", "Restart"));
    var stepLbl = K.el("span", "tca-tag");
    bar.appendChild(bNext); bar.appendChild(bPlay); bar.appendChild(bReset); bar.appendChild(stepLbl);
    root.appendChild(bar);

    var grid = K.el("div", "cv-grid");
    grid.appendChild(K.el("div"));
    TOK.forEach(function (w) { grid.appendChild(K.el("div", "cv-h", w)); });
    var cells = [];
    LAB.forEach(function (l, j) {
      grid.appendChild(K.el("div", "cv-l", l));
      cells.push(TOK.map(function (_, t) {
        var c = K.el("div", "cv-c");
        var e = K.el("div", null, K.t("토큰 ", "tok ") + f1(EM[t][j]));
        var d = K.el("div", "cv-d");
        var p = K.el("div", "cv-d");
        c.appendChild(e); c.appendChild(d); c.appendChild(p);
        grid.appendChild(c);
        return { c: c, d: d, p: p };
      }));
    });
    root.appendChild(grid);

    var seq = K.el("div", "cv-seq");
    root.appendChild(seq);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    var trBox = K.el("div", "tca-note");
    trBox.appendChild(document.createTextNode(K.t("전이 점수 (앞 라벨 → 뒤 라벨, 예시 값)", "Transition scores (previous → next, example values)")));
    var tr = K.el("div", "cv-tr");
    [K.t("앞 \\ 뒤", "prev \\ next"), "O", "B", "I"].forEach(function (x) { tr.appendChild(K.el("b", null, x)); });
    [[K.t("시작", "start"), START], ["O", TR[0]], ["B", TR[1]], ["I", TR[2]]].forEach(function (r) {
      tr.appendChild(K.el("span", null, r[0]));
      r[1].forEach(function (v) { tr.appendChild(K.el("span", v <= -3 ? "tca-bad" : v > 0 ? "tca-good" : null, sg(v))); });
    });
    trBox.appendChild(tr);
    root.appendChild(trBox);
    root.appendChild(K.el("div", "tca-note", K.t(
      "토큰 점수와 전이 점수는 예시 값이다. 라벨은 O · B-ADDRESS · I-ADDRESS 세 개만 두었다. O → I 와 시작 → I 는 학습 데이터에 거의 없는 전이라 큰 음수로 두었다.",
      "Token and transition scores are example values, with only three labels (O, B-ADDRESS, I-ADDRESS). O → I and start → I are rare in training data, so they get a large negative score.")));

    function chip(txt, cls) { var c = K.el("span", "tca-tag " + (cls || ""), txt); seq.appendChild(c); }
    function render() {
      var s = st.s, done = s >= MAXS;
      stepLbl.textContent = K.t("단계 ", "Step ") + s + "/" + MAXS;
      bNext.disabled = done;
      for (var j = 0; j < 3; j++) for (var t = 0; t < T; t++) {
        var cell = cells[j][t], filled = t < s;
        var cls = "cv-c";
        if ((s === 0 || done) && arg[t] === j) cls += " cv-arg";
        if (!done && s > 0 && t === s - 1) cls += " cv-cur";
        if (done && path[t] === j) cls += " cv-path";
        cell.c.className = cls;
        cell.d.textContent = filled ? K.t("누적 ", "sum ") + f1(dl[t][j]) : "";
        cell.p.textContent = filled ? "← " + (bp[t][j] < 0 ? K.t("시작", "start") : SHORT[bp[t][j]]) : "";
      }
      seq.textContent = "";
      if (s === 0) {
        seq.appendChild(document.createTextNode(K.t("토큰별 최고: ", "Per-token best: ")));
        arg.forEach(function (l, t) { chip(SHORT[l], t > 0 && l === 2 && arg[t - 1] === 0 ? "tca-bad" : ""); });
        read.textContent = K.t("전이를 보지 않고 칸마다 가장 높은 토큰 점수만 고르면 B · I · O · I 다. O 뒤에 I 가 와서 BIO 규칙에 어긋난다. 다음 단계부터 CRF 가 왼쪽부터 칸을 채운다.",
          "Picking the highest token score in each column, ignoring transitions, gives B · I · O · I. An I right after an O breaks the BIO rule. From the next step the CRF fills the columns left to right.");
        return;
      }
      if (!done) {
        var t0 = s - 1;
        var lines = LAB.map(function (l, j) {
          var h = how[t0][j];
          var from = h.prev < 0 ? K.t("전이(시작→", "trans(start→") + SHORT[j] + ") " + f1(h.tr)
            : K.t("앞 칸 ", "from ") + SHORT[h.prev] + " " + f1(h.pv) + K.t(" + 전이 ", " + trans ") + f1(h.tr);
          return SHORT[j] + " = " + from + K.t(" + 토큰 ", " + tok ") + f1(EM[t0][j]) + " = " + f1(dl[t0][j]);
        });
        read.textContent = TOK[t0] + " — " + lines.join(" · ");
        if (t0 === 2) read.textContent += K.t(". 토큰 점수는 O 가 높지만, 앞이 I 일 때 I → I 전이가 붙어 누적은 I 가 앞선다.",
          ". O has the higher token score, but I → I adds a bonus after an I, so I leads on the running total.");
        return;
      }
      seq.appendChild(document.createTextNode(K.t("CRF 결과: ", "CRF result: ")));
      path.forEach(function (l) { chip(SHORT[l], "tca-good"); });
      read.textContent = K.t("마지막 열의 최고는 I-ADDR ", "The best cell in the last column is I-ADDR ") + f1(dl[T - 1][end]) +
        K.t(". 화살표를 거꾸로 따라가면 B · I · I · I 로 주소 네 토큰이 끊기지 않는다. 토큰별 최고(B · I · O · I) 경로의 점수는 ", ". Following the arrows back gives B · I · I · I, so the four address tokens stay joined. The per-token path (B · I · O · I) scores only ") +
        f1(score(arg)) + K.t(" 이다.", ".");
    }
    function setPlay(on) {
      st.playing = on;
      K.press(bPlay, on);
    }
    bNext.addEventListener("click", function () { setPlay(false); if (st.s < MAXS) { st.s++; render(); } });
    bPlay.addEventListener("click", function () {
      if (!st.playing && st.s >= MAXS) { st.s = 0; render(); }
      st.acc = 0;
      setPlay(!st.playing);
    });
    bReset.addEventListener("click", function () { setPlay(false); st.s = 0; render(); });
    K.loop(root, function (dt) {
      if (!st.playing) return;
      st.acc += dt;
      if (st.acc < 1400) return;
      st.acc = 0;
      if (st.s < MAXS) { st.s++; render(); }
      if (st.s >= MAXS) setPlay(false);
    });
    render();
  });
})();
