/* 「멀티턴 공격은 한 턴만 봐선 안 잡힌다」 글의 그림: 단일턴 판정과 세션 판정, 관측 창 크기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("mt-session-window", function (root) {
    var PAT = {
      packed: ["n", "n", "n", "n", "n", "n", "f1", "f2", "f3", "c"],
      spread: ["f1", "n", "n", "f2", "n", "n", "f3", "n", "n", "c"]
    };
    var N = 10, MS = 700;
    var st = { pat: "packed", win: 4, t: K.reduce ? N : 0, acc: 0, playing: !K.reduce };

    var D = '.tca[data-demo="mt-session-window"] ';
    K.css("multi-turn-attack-detection-session-level-css", [
      D + ".mt-row{display:grid;grid-template-columns:44px minmax(0,1fr) 50px 50px;gap:6px;align-items:center;padding:3px 6px;border-left:3px solid transparent;border-radius:3px}",
      D + ".mt-head{font-size:12px;color:var(--secondary)}",
      D + ".mt-in{background:var(--code-bg);border-left-color:var(--tca-accent)}",
      D + ".mt-n{font-size:12px;color:var(--secondary);font-variant-numeric:tabular-nums}",
      D + ".mt-c{font-size:13px;min-width:0}",
      D + ".mt-v{font-size:12.5px;text-align:center}",
      D + ".mt-off{opacity:.35}"
    ].join(""));

    K.head(root, K.t("한 턴씩 볼 때와 창으로 묶어 볼 때", "Turn by turn, or a window of turns"),
      K.t("유해한 목표를 하위 조각 셋으로 쪼개 묻고 마지막에 결합을 요청하는 대화다. 턴이 하나씩 들어오며 두 판정기가 각자 판정한다. 관측 창 크기와 조각 배치를 바꿔 보면 무엇이 보이고 무엇이 창 밖으로 빠지는지 보인다.",
        "A conversation that splits a harmful goal into three pieces and asks to combine them at the end. Turns arrive one by one and two judges decide. Change the window size and the spacing of the pieces to see what stays visible and what falls outside."));

    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: "packed", label: K.t("조각이 연달아", "Pieces back to back") }, { value: "spread", label: K.t("조각 사이에 일상 턴", "Small talk between pieces") }],
      st.pat, function (v) { st.pat = v; restart(); }, K.t("조각 배치", "Placement of pieces"));
    var sW = K.slider({ label: K.t("관측 창", "Window"), min: 1, max: 10, step: 1, value: st.win,
      fmt: function (v) { return v + K.t("턴", " turns"); }, onInput: function (v) { st.win = v; render(); } });
    var bPlay = K.btn(K.t("일시정지", "Pause"), true);
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(seg.el); bar.appendChild(sW.el); bar.appendChild(bPlay); bar.appendChild(bReset);
    root.appendChild(bar);

    var list = K.el("div");
    var h = K.el("div", "mt-row mt-head");
    [K.t("턴", "Turn"), K.t("유저 발화 (예시)", "User turn (example)"), K.t("단일턴", "Per turn"), K.t("세션", "Session")].forEach(function (x, i) {
      var c = K.el("div", i >= 2 ? "mt-v" : null, x);
      h.appendChild(c);
    });
    list.appendChild(h);
    var rows = [];
    for (var i = 0; i < N; i++) {
      var r = K.el("div", "mt-row");
      var n = K.el("div", "mt-n", K.t("턴 ", "T") + (i + 1));
      var c = K.el("div", "mt-c");
      var v1 = K.el("div", "mt-v"), v2 = K.el("div", "mt-v");
      r.appendChild(n); r.appendChild(c); r.appendChild(v1); r.appendChild(v2);
      list.appendChild(r);
      rows.push({ r: r, c: c, v1: v1, v2: v2 });
    }
    root.appendChild(list);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "턴 내용은 예시다. 세션 판정은 '창 안에 조각 셋과 결합 요청이 모두 들어오면 결합 의도가 보인다'로 단순화한 가정이다. 실제 세션 분류기는 이런 흐름을 학습으로 익힌다.",
      "Turn contents are examples. The session judge is simplified to 'the intent shows once all three pieces and the combine request are inside the window'; a real session classifier learns such flows.")));

    function text(k) {
      if (k === "n") return K.t("일상 질문", "Ordinary question");
      if (k === "c") return K.t("앞의 답을 합쳐 설명해 달라는 요청", "Asks to combine the earlier answers");
      return K.t("하위 질문 ", "Sub-question ") + k.slice(1) + K.t(" (따로 보면 무해)", " (harmless alone)");
    }
    function inWin(seq, t, w) {
      var a = Math.max(1, t - w + 1), f = 0, c = false;
      for (var i = a; i <= t; i++) { var k = seq[i - 1]; if (k.charAt(0) === "f") f++; if (k === "c") c = true; }
      return { a: a, f: f, c: c, hit: f === 3 && c };
    }
    function render() {
      var seq = PAT[st.pat], t = st.t, w = st.win;
      var cur = t > 0 ? inWin(seq, t, w) : null;
      var first = 0;
      rows.forEach(function (row, i) {
        var turn = i + 1, k = seq[i], seen = turn <= t;
        row.c.textContent = "";
        var tag = K.el("span", "tca-chip", k === "n" ? K.t("일상", "chat") : k === "c" ? K.t("결합", "join") : K.t("조각", "piece ") + k.slice(1));
        tag.style.background = k === "n" ? "var(--code-bg)" : k === "c" ? K.COLORS[2] : K.COLORS[1];
        if (k === "n") tag.style.color = "var(--secondary)";
        tag.style.marginRight = "6px";
        row.c.appendChild(tag);
        row.c.appendChild(document.createTextNode(text(k)));
        row.r.className = "mt-row" + (cur && turn >= cur.a && turn <= t ? " mt-in" : "") + (seen ? "" : " mt-off");
        if (seen) {
          row.v1.textContent = K.t("통과", "pass");
          row.v1.className = "mt-v tca-good";
          var s = inWin(seq, turn, w);
          if (s.hit && !first) first = turn;
          row.v2.textContent = s.hit ? K.t("공격", "attack") : K.t("정상", "benign");
          row.v2.className = "mt-v " + (s.hit ? "tca-bad" : "tca-good");
        } else { row.v1.textContent = ""; row.v2.textContent = ""; }
      });
      if (t === 0) { read.textContent = K.t("아직 들어온 턴이 없다.", "No turns yet."); return; }
      var winTxt = K.t("창: 턴 ", "window: T") + cur.a + "~" + t;
      if (t < N) {
        read.textContent = K.t("턴 ", "Turn ") + t + " · " + winTxt + K.t(" · 창 안 조각 ", " · pieces in window ") + cur.f + "/3" +
          (cur.c ? K.t(" · 결합 요청 있음", " · combine request inside") : "");
        return;
      }
      read.textContent = K.t("단일턴 판정: 10턴 모두 통과 · 세션 판정(창 ", "Per-turn judge: all 10 pass · session judge (window ") + w +
        K.t("턴): ", "): ") + (first ? K.t(first + "번째 턴에서 공격으로 판정", "flags attack at turn " + first)
          : K.t("끝까지 정상 — 마지막 창(턴 ", "benign to the end — the last window (T") + cur.a + "~" + t + K.t(")에 조각이 ", ") holds only ") + cur.f + K.t("/3 만 들어 있다", "/3 pieces"));
    }
    function setPlay(on) {
      st.playing = on;
      K.press(bPlay, on);
      bPlay.textContent = on ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    }
    function restart() { st.t = K.reduce ? N : 0; st.acc = 0; setPlay(!K.reduce); render(); }
    bPlay.addEventListener("click", function () {
      if (!st.playing && st.t >= N) { st.t = 0; render(); }
      st.acc = 0;
      setPlay(!st.playing);
    });
    bReset.addEventListener("click", restart);
    K.loop(root, function (dt) {
      if (!st.playing) return;
      st.acc += dt;
      if (st.acc < MS) return;
      st.acc = 0;
      if (st.t < N) { st.t++; render(); }
      if (st.t >= N) setPlay(false);
    });
    setPlay(st.playing);
    render();
  });
})();
