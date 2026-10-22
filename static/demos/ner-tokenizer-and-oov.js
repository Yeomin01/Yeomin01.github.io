/* 「NER 모델이 일반 명사를 ORG 로 잡는 이유 — 토크나이저, OOV, vocab 확장」 글의 그림: 가장 긴 조각부터 맞추는 WordPiece 분할과 vocab 확장 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("tok-wordpiece", function (root) {
    var WORD = "한국인터넷진흥원";
    var BASE = ["한국인", "한국", "한", "##터", "##넷", "##진흥", "##진", "##원"];
    var NEW = "한국인터넷진흥원";
    // 원래 조각 5개의 임베딩 — 예시 값(4차원)
    var EMB = { "한국인": [0.8, -0.2, 0.1, 0.4], "##터": [0.1, 0.5, -0.3, 0.2], "##넷": [0.2, 0.4, -0.1, 0.0],
      "##진흥": [0.6, 0.1, 0.3, -0.2], "##원": [0.3, -0.3, 0.5, 0.1] };
    var MS = 420;
    var st = { ext: false, i: 0, acc: 0, playing: !K.reduce };

    function plan(vocab) {
      var checks = [], toks = [], pos = 0, n = WORD.length;
      while (pos < n) {
        var hit = false;
        for (var end = n; end > pos; end--) {
          var cand = (pos > 0 ? "##" : "") + WORD.slice(pos, end);
          var ok = vocab.indexOf(cand) >= 0;
          checks.push({ pos: pos, end: end, cand: cand, hit: ok, tokIdx: ok ? toks.length : -1 });
          if (ok) { toks.push({ t: cand, pos: pos, end: end }); pos = end; hit = true; break; }
        }
        if (!hit) { toks.push({ t: "[UNK]", pos: pos, end: n }); break; }
      }
      return { checks: checks, toks: toks };
    }
    var P0 = plan(BASE), P1 = plan(BASE.concat([NEW]));

    var D = '.tca[data-demo="tok-wordpiece"] ';
    K.css("ner-tokenizer-and-oov-css", [
      D + ".tw-word{display:flex;gap:3px;margin:6px 0}",
      D + ".tw-ch{flex:1;min-width:0;max-width:44px;text-align:center;font-size:16px;padding:6px 0;border:1px solid var(--tertiary);border-radius:4px;background:var(--theme);border-bottom-width:4px}",
      D + ".tw-cand{background:var(--code-bg);border-color:var(--tca-accent)}",
      D + ".tw-toks{display:flex;flex-wrap:wrap;gap:8px;min-height:50px;margin-top:6px}",
      D + ".tw-tok{display:flex;flex-direction:column;align-items:center;gap:3px}",
      D + ".tw-lab{font-size:12px;color:var(--secondary)}",
      D + ".tw-voc{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 0}",
      D + ".tw-emb{display:grid;grid-template-columns:auto repeat(4,minmax(0,52px));gap:2px 10px;font-size:12.5px;font-variant-numeric:tabular-nums;margin-top:6px;width:max-content;max-width:100%}",
      D + ".tw-mean{font-weight:600;border-top:1px solid var(--tertiary);padding-top:2px}"
    ].join(""));

    K.head(root, K.t("가장 긴 조각부터 맞춰 자르기", "Longest piece first"),
      K.t("WordPiece 는 vocab 에 있는 가장 긴 조각부터 맞춰 본다. 재생하면 후보가 한 글자씩 줄어들며 vocab 을 확인하는 과정이 보인다. vocab 에 단어를 추가하면 토큰 수와 맞혀야 할 라벨 수가 어떻게 바뀌는지 비교한다.",
        "WordPiece tries the longest piece in the vocab first. Play it to watch the candidate shrink one character at a time as the vocab is checked. Add the word to the vocab and compare the token count and the labels to predict."));

    var bar = K.el("div", "tca-bar");
    var seg = K.seg([{ value: false, label: K.t("원래 vocab", "Original vocab") }, { value: true, label: K.t("vocab 에 단어 추가", "Word added to vocab") }],
      false, function (v) { st.ext = v; restart(); }, "vocab");
    var bPlay = K.btn(K.t("일시정지", "Pause"), true);
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(seg.el); bar.appendChild(bPlay); bar.appendChild(bReset);
    root.appendChild(bar);

    var voc = K.el("div", "tca-note");
    voc.style.marginTop = "0";
    root.appendChild(voc);
    var word = K.el("div", "tw-word");
    var chs = WORD.split("").map(function (c) { var e = K.el("div", "tw-ch", c); word.appendChild(e); return e; });
    root.appendChild(word);
    var cand = K.el("div", "tca-note");
    cand.setAttribute("aria-live", "polite");
    root.appendChild(cand);
    var toks = K.el("div", "tw-toks");
    root.appendChild(toks);
    var read = K.el("div", "tca-read");
    root.appendChild(read);
    var emb = K.el("div", "tca-box");
    emb.style.marginTop = "10px";
    root.appendChild(emb);
    root.appendChild(K.el("div", "tca-note", K.t(
      "vocab 은 글의 분할(한국인 + ##터 + ##넷 + ##진흥 + ##원)이 나오도록 고른 예시다. 실제 KoELECTRA vocab 은 35,000개다. 임베딩 값도 예시 값이다.",
      "The vocab is an example chosen to reproduce the post's split (한국인 + ##터 + ##넷 + ##진흥 + ##원); the real KoELECTRA vocab has 35,000 entries. Embedding values are examples too.")));

    function plan1() { return st.ext ? P1 : P0; }
    function render() {
      var P = plan1(), n = Math.min(st.i, P.checks.length), done = n >= P.checks.length;
      voc.textContent = "";
      voc.appendChild(document.createTextNode(K.t("vocab (예시): ", "vocab (example): ")));
      var vl = K.el("span", "tw-voc");
      vl.style.display = "inline-flex";
      BASE.concat(st.ext ? [NEW] : []).forEach(function (v) {
        var t = K.el("span", "tca-tag", v);
        if (v === NEW) { t.style.borderColor = "var(--tca-accent)"; t.style.color = "var(--primary)"; }
        vl.appendChild(t);
      });
      voc.appendChild(vl);

      var cur = n > 0 ? P.checks[n - 1] : null;
      var made = P.toks.filter(function (t, k) {
        for (var c = 0; c < n; c++) if (P.checks[c].tokIdx === k) return true;
        return false;
      });
      chs.forEach(function (e, i) {
        var tk = -1;
        made.forEach(function (t, k) { if (i >= t.pos && i < t.end) tk = k; });
        e.className = "tw-ch" + (cur && !done && i >= cur.pos && i < cur.end ? " tw-cand" : "");
        e.style.borderBottomColor = tk >= 0 ? K.COLORS[tk % K.COLORS.length] : "var(--tertiary)";
      });
      if (!cur) cand.textContent = K.t("처음 위치에서 단어 전체를 후보로 시작한다.", "Start at the first position with the whole word as the candidate.");
      else if (cur.hit) cand.textContent = K.t("후보 '", "Candidate '") + cur.cand + K.t("' — vocab 에 있다 → 이 조각을 토큰으로 자르고 다음 위치로 간다", "' — in the vocab → cut it as a token and move on");
      else cand.textContent = K.t("후보 '", "Candidate '") + cur.cand + K.t("' — vocab 에 없다 → 끝에서 한 글자 줄인다", "' — not in the vocab → drop one character from the end");

      toks.textContent = "";
      made.forEach(function (t, k) {
        var b = K.el("div", "tw-tok");
        var c = K.el("span", "tca-chip", t.t);
        c.style.background = K.COLORS[k % K.COLORS.length];
        b.appendChild(c);
        b.appendChild(K.el("span", "tw-lab", k === 0 ? "B-ORG" : "I-ORG"));
        toks.appendChild(b);
      });
      read.textContent = K.t("vocab 확인 ", "Vocab lookups ") + n + K.t("번 · 토큰 ", " · tokens ") + made.length +
        K.t("개 · 맞혀야 할 라벨 ", " · labels to predict ") + made.length + K.t("개", "") +
        (made.length > 1 ? " (B-ORG 1 + I-ORG " + (made.length - 1) + ")" : made.length === 1 ? " (B-ORG)" : "");

      emb.style.display = st.ext && done ? "" : "none";
      if (st.ext && done) {
        emb.textContent = "";
        emb.appendChild(K.el("div", "tca-h", K.t("새 토큰의 임베딩 초기값 = 원래 조각 5개의 평균", "New token's initial embedding = mean of the original five pieces")));
        var g = K.el("div", "tw-emb");
        var mean = [0, 0, 0, 0];
        P0.toks.forEach(function (t) {
          g.appendChild(K.el("span", null, t.t));
          EMB[t.t].forEach(function (v, d) { mean[d] += v / P0.toks.length; g.appendChild(K.el("span", null, v.toFixed(2))); });
        });
        g.appendChild(K.el("span", "tw-mean", NEW));
        mean.forEach(function (v) { g.appendChild(K.el("span", "tw-mean", v.toFixed(2))); });
        emb.appendChild(g);
        emb.appendChild(K.el("div", "tca-note", K.t("resize_token_embeddings 로 늘린 새 행을 이 평균으로 채운다. 단순 랜덤보다 의미 있는 자리에서 학습을 시작한다.",
          "The new row added by resize_token_embeddings is filled with this mean, so training starts from a meaningful point rather than random.")));
      }
    }
    function setPlay(on) {
      st.playing = on;
      K.press(bPlay, on);
      bPlay.textContent = on ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    }
    function restart() { st.i = K.reduce ? plan1().checks.length : 0; st.acc = 0; setPlay(!K.reduce); render(); }
    bPlay.addEventListener("click", function () {
      if (!st.playing && st.i >= plan1().checks.length) { st.i = 0; render(); }
      st.acc = 0;
      setPlay(!st.playing);
    });
    bReset.addEventListener("click", restart);
    K.loop(root, function (dt) {
      if (!st.playing) return;
      st.acc += dt;
      if (st.acc < MS) return;
      st.acc = 0;
      var N = plan1().checks.length;
      if (st.i < N) { st.i++; render(); }
      if (st.i >= N) setPlay(false);
    });
    restart();
  });
})();
