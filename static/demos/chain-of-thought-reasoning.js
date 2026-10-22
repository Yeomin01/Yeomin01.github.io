/* 「답을 먼저 내면 모델이 끼워맞춘다 — Chain-of-Thought」 글의 그림: 답 조각을 뽑는 순간 앞에 놓인 것 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("cot-token-steps", function (root) {
    var Q = ["Q:", "진수는", "사과", "5개를", "갖고", "있다.", "2개를", "먹고", "3개를", "더", "샀다.", "몇", "개?"];
    var QNUM = [3, 6, 8];
    var DIRECT = ["A:", "6"];
    var COT = ["A:", "처음", "5개.", "2개", "먹어서", "3개", "남음.", "3개", "더", "사서", "6개.", "답:", "6"];
    var MID = [1, 2, 5, 6, 10];
    var MAX = COT.length, MS = 750;
    var st = { k: 0, playing: !K.reduce, acc: 0 };

    var D = '.tca[data-demo="cot-token-steps"] ';
    K.css("chain-of-thought-reasoning-css", [
      D + ".cot-line{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}",
      D + ".cot-tok{display:inline-block;padding:1px 6px;border:1px solid var(--tertiary);border-radius:4px;font-size:13px;background:var(--theme)}",
      D + ".cot-q{color:var(--secondary);background:var(--code-bg)}",
      D + ".cot-now{outline:2px solid var(--tca-accent);outline-offset:1px}",
      D + ".cot-src{border-color:var(--tca-good);color:var(--tca-good);font-weight:600}",
      D + ".cot-far{border-color:var(--tca-warn);color:var(--tca-warn);font-weight:600}",
      D + ".cot-ans{font-weight:700;border-color:var(--tca-accent)}",
      D + ".cot-lab{font-size:12px;color:var(--secondary);margin-top:6px}"
    ].join(""));

    K.head(root, K.t("답 조각을 뽑는 순간, 앞에 무엇이 놓여 있나", "What sits in front of the answer token"),
      K.t("글의 사과 문제를 조각 하나씩 생성한다. 각 조각은 앞에 놓인 모든 조각을 조건으로 뽑힌다. 답 '6' 을 뽑는 순간 두 방식의 컨텍스트가 어떻게 다른지 본다.",
        "The apple problem from the post, generated one piece at a time. Each piece is conditioned on everything before it. Compare what the context holds at the moment the answer '6' is produced."));

    var bar = K.el("div", "tca-bar");
    var bNext = K.btn(K.t("다음 조각", "Next piece"));
    var bPlay = K.btn(K.t("일시정지", "Pause"), true);
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(bNext); bar.appendChild(bPlay); bar.appendChild(bReset);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    function box(title, out, ansIdx) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", title));
      b.appendChild(K.el("div", "cot-lab", K.t("입력", "Input")));
      var ql = K.el("div", "cot-line");
      var qs = Q.map(function (w) { var c = K.el("span", "cot-tok cot-q", w); ql.appendChild(c); return c; });
      b.appendChild(ql);
      b.appendChild(K.el("div", "cot-lab", K.t("출력 (생성 순서)", "Output (in generation order)")));
      var ol = K.el("div", "cot-line");
      ol.style.minHeight = "26px";
      b.appendChild(ol);
      var r = K.el("div", "tca-note");
      r.setAttribute("aria-live", "polite");
      b.appendChild(r);
      two.appendChild(b);
      return { qs: qs, ol: ol, read: r, out: out, ans: ansIdx, shown: 0, chips: [] };
    }
    var bd = box(K.t("직접 답", "Answer first"), DIRECT, 1);
    var bc = box(K.t("CoT — 풀이 먼저, 답은 뒤로", "CoT — reasoning first, answer last"), COT, COT.length - 1);
    root.appendChild(two);
    var read = K.el("div", "tca-read");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "조각은 어절 단위로 나눈 예시다. 실제 토크나이저는 더 잘게 나눈다. 강조 표시는 답 '6' 을 정하는 데 필요한 재료가 어디에 있는지를 가리킨다.",
      "Pieces are split by word for illustration; a real tokenizer splits finer. Highlights mark where the material needed for the answer '6' sits.")));

    function sync(b, isCot) {
      var n = Math.min(st.k, b.out.length);
      while (b.chips.length > n) b.ol.removeChild(b.chips.pop());
      while (b.chips.length < n) {
        var i = b.chips.length;
        var c = K.el("span", "cot-tok" + (K.reduce ? "" : " tca-pop"), b.out[i]);
        b.ol.appendChild(c);
        b.chips.push(c);
      }
      var atAns = n === b.out.length;
      b.chips.forEach(function (c, i) {
        var cls = "cot-tok";
        if (i === n - 1 && st.k <= b.out.length) cls += " cot-now";
        if (i === b.ans && atAns) cls += " cot-ans";
        if (atAns && isCot && MID.indexOf(i) >= 0) cls += " cot-src";
        c.className = cls + (c.className.indexOf("tca-pop") >= 0 ? " tca-pop" : "");
      });
      b.qs.forEach(function (c, i) {
        c.className = "cot-tok cot-q" + (atAns && !isCot && QNUM.indexOf(i) >= 0 ? " cot-far" : "");
      });
      if (n === 0) b.read.textContent = K.t("아직 출력 없음. 다음 조각은 입력만 보고 뽑힌다.", "No output yet. The next piece sees only the input.");
      else if (!atAns) b.read.textContent = K.t("방금 뽑은 조각 '", "Just produced '") + b.out[n - 1] +
        K.t("' — 조건: 입력 + 앞선 출력 ", "' — conditioned on the input + ") + (n - 1) + K.t("조각", " earlier pieces");
      else if (isCot) b.read.textContent = K.t("답 '6' 을 뽑을 때 컨텍스트에 중간 계산이 있다: 처음 5개 → 3개 남음 → 6개. 바로 앞의 '6개.' 를 옮기면 된다.",
        "When '6' is produced the context already holds the steps: 5 at first → 3 left → 6. It only has to copy the '6개.' right before it.");
      else b.read.textContent = K.t("답 '6' 을 뽑을 때 앞에는 문제뿐이다. 문제 속 5·2·3 을 이 한 조각 안에서 한 번에 계산해야 한다.",
        "When '6' is produced only the question is in front of it. The 5, 2 and 3 must be combined inside this single piece.");
    }
    function render() {
      sync(bd, false);
      sync(bc, true);
      read.textContent = K.t("출력 길이 — 직접 답 ", "Output length — answer first ") + Math.min(st.k, DIRECT.length) + "/" + DIRECT.length +
        K.t("조각 · CoT ", " · CoT ") + Math.min(st.k, COT.length) + "/" + COT.length + K.t("조각", "");
      bNext.disabled = st.k >= MAX;
    }
    function setPlay(on) {
      st.playing = on;
      K.press(bPlay, on);
      bPlay.textContent = on ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    }
    bNext.addEventListener("click", function () { setPlay(false); if (st.k < MAX) { st.k++; render(); } });
    bPlay.addEventListener("click", function () {
      if (!st.playing && st.k >= MAX) { st.k = 0; render(); }
      st.acc = 0;
      setPlay(!st.playing);
    });
    bReset.addEventListener("click", function () { st.k = 0; st.acc = 0; render(); setPlay(!K.reduce); });
    K.loop(root, function (dt) {
      if (!st.playing) return;
      st.acc += dt;
      if (st.acc < MS) return;
      st.acc = 0;
      if (st.k < MAX) { st.k++; render(); }
      if (st.k >= MAX) setPlay(false);
    });
    if (K.reduce) st.k = MAX;
    setPlay(st.playing);
    render();
  });
})();
