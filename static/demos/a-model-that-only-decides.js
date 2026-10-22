/* 「생성하지 않고 판정만 하는 모델 — 제브와 케브」 글의 그림: 문장을 쓰는 생성 모델과 확률만 내는 판정 모델이 거치는 순차 단계 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("jev-two-paths", function (root) {
    var PROB = [0.91, 0.12, 0.77, 0.35, 0.64, 0.08]; // 예시 확률
    var SPEED = 20; // 초당 단계
    var L = 30, Q = 6, t = 0, playing = !K.reduce, lastShown = -1;

    K.css("a-model-that-only-decides-css", [
      '.tca[data-demo="jev-two-paths"] .jv-stage{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}',
      '.tca[data-demo="jev-two-paths"] .jv-stage .tca-tag[data-on="1"]{border-color:var(--tca-accent);color:var(--primary);font-weight:600}',
      '.tca[data-demo="jev-two-paths"] .jv-stage .tca-tag[data-done="1"]{color:var(--tca-good);border-color:var(--tca-good)}',
      '.tca[data-demo="jev-two-paths"] .jv-tok{display:flex;flex-wrap:wrap;gap:2px;min-height:12px;margin:6px 0}',
      '.tca[data-demo="jev-two-paths"] .jv-tok i{display:block;width:7px;height:10px;border-radius:2px;background:var(--code-bg);border:1px solid var(--tertiary)}',
      '.tca[data-demo="jev-two-paths"] .jv-tok i.on{background:var(--tca-accent);border-color:var(--tca-accent)}',
      '.tca[data-demo="jev-two-paths"] .jv-out{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;min-height:22px}'
    ].join(""));

    K.head(root, K.t("문장을 쓰는 길과 확률을 내는 길", "Writing a sentence vs. emitting probabilities"),
      K.t("같은 문서와 질문을 두 모델에 넣는다. 생성 모델은 답 문장을 한 토큰씩 쓰고 그 문장을 다시 해석해 판정으로 바꾼다. 판정 모델은 문서를 한 번 계산해 두고 질문마다 가지를 쳐 선택지 확률을 바로 낸다.",
        "The same document and questions go to both models. The generative model writes an answer token by token and then parses it into a verdict. The decision model encodes the document once, branches per question, and returns option probabilities directly."));

    var bar = K.el("div", "tca-bar");
    var sL = K.slider({ label: K.t("답 문장 길이", "Answer length"), min: 10, max: 60, step: 5, value: L,
      fmt: function (v) { return v + K.t("토큰", " tok"); }, onInput: function (v) { L = v; restart(); } });
    var sQ = K.slider({ label: K.t("질문 수", "Questions"), min: 1, max: 6, step: 1, value: Q,
      fmt: function (v) { return String(v); }, onInput: function (v) { Q = v; restart(); } });
    var bPlay = K.btn("", playing);
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(sL.el); bar.appendChild(sQ.el); bar.appendChild(bPlay); bar.appendChild(bAgain);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    // 생성 모델 칸
    var gBox = K.el("div", "tca-box");
    gBox.appendChild(K.el("div", "tca-h", K.t("생성 모델", "Generative model")));
    var gStage = K.el("div", "jv-stage");
    var gTags = [K.t("① 문서+질문 읽기", "① Read doc + question"), K.t("② 답 문장 쓰기", "② Write the answer"), K.t("③ 문장 해석", "③ Parse the sentence")]
      .map(function (s) { var e = K.el("span", "tca-tag", s); gStage.appendChild(e); return e; });
    gBox.appendChild(gStage);
    var gQ = K.el("div", "tca-note", "");
    gQ.style.margin = "0";
    gBox.appendChild(gQ);
    var gTok = K.el("div", "jv-tok");
    gBox.appendChild(gTok);
    var gOut = K.el("div", "jv-out");
    gBox.appendChild(gOut);
    two.appendChild(gBox);

    // 판정 모델 칸
    var dBox = K.el("div", "tca-box");
    dBox.appendChild(K.el("div", "tca-h", K.t("판정 모델", "Decision model")));
    var dStage = K.el("div", "jv-stage");
    var dTags = [K.t("① 문서 1회 계산", "① Encode doc once"), K.t("② 질문마다 가지", "② Branch per question")]
      .map(function (s) { var e = K.el("span", "tca-tag", s); dStage.appendChild(e); return e; });
    dBox.appendChild(dStage);
    var dRows = K.el("div", "tca-rows");
    dRows.style.setProperty("--tca-lw", "52px");
    dRows.style.setProperty("--tca-rw", "64px");
    var dR = PROB.map(function (p, i) {
      var r = K.el("div", "tca-row");
      var l = K.el("div", "tca-row-l", K.t("질문 ", "Q") + (i + 1));
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r", "");
      r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      dRows.appendChild(r);
      return { r: r, f: f, v: v };
    });
    dBox.appendChild(dRows);
    two.appendChild(dBox);
    root.appendChild(two);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "단계는 앞 계산이 끝나야 시작할 수 있는 계산을 하나로 센 단순화다. 생성 모델은 질문마다 답 문장을 따로 쓴다고 두었고, 토큰 수와 확률은 예시 값이다. 실제 지연은 모델과 하드웨어에 따라 다르다. 저장소에 적힌 판정 모델의 수치는 48GB급 카드, 짧은 글, 질문 여섯 개에서 40ms대다.",
      "A step counts one computation that must wait for the previous one; this is a simplification. The generative model is assumed to write a separate answer per question; token counts and probabilities are example values. Real latency depends on the model and hardware. The repository reports the 40 ms range for six questions on a short text on a 48 GB-class card.")));

    function total() { return 1 + Q * (L + 1); }
    function buildTok() {
      gTok.textContent = "";
      for (var i = 0; i < L; i++) gTok.appendChild(document.createElement("i"));
    }
    function restart() {
      t = 0; lastShown = -1; buildTok(); gOut.textContent = "";
      playing = !K.reduce;
      if (K.reduce) t = total();
      render(true);
    }
    function setTag(e, on, done) { e.setAttribute("data-on", on ? "1" : "0"); e.setAttribute("data-done", done ? "1" : "0"); }

    function render(force) {
      var N = total();
      var s = Math.min(N, Math.floor(t));
      if (!force && s === lastShown) return;
      lastShown = s;
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : (s >= N ? K.t("다시 재생", "Replay") : K.t("재생", "Play"));
      K.press(bPlay, playing);

      // 생성 모델
      var done = s >= N, q = 0, within = 0, stage = 0;
      if (s >= 1 && !done) { var r = s - 1; q = Math.floor(r / (L + 1)); within = r % (L + 1); stage = within >= L ? 2 : 1; }
      if (done) { q = Q; stage = 3; }
      setTag(gTags[0], stage === 0, s >= 1);
      setTag(gTags[1], stage === 1, done);
      setTag(gTags[2], stage === 2, done);
      gQ.textContent = done ? K.t("질문 " + Q + "개 모두 판정 끝", "All " + Q + " questions answered")
        : (s < 1 ? K.t("문서와 질문을 읽는 중", "Reading the document and question")
          : K.t("질문 " + (q + 1) + " / " + Q + " — ", "Question " + (q + 1) + " / " + Q + " — ") +
            (stage === 2 ? K.t("문장을 읽어 정탐·오탐으로 바꾸는 중", "parsing the sentence into a verdict")
              : K.t("토큰 " + within + " / " + L, "token " + within + " / " + L)));
      var cells = gTok.children, fill = done ? L : (stage === 0 ? 0 : Math.min(within, L));
      for (var i = 0; i < cells.length; i++) cells[i].className = i < fill ? "on" : "";
      while (gOut.children.length < Math.min(q, Q)) {
        var k = gOut.children.length;
        gOut.appendChild(K.el("span", "tca-tag tca-pop", K.t("질문 ", "Q") + (k + 1) + " → " +
          (PROB[k] >= 0.5 ? K.t("정탐", "true hit") : K.t("오탐", "false alarm"))));
      }

      // 판정 모델: 2단계면 끝난다
      setTag(dTags[0], s === 0, s >= 1);
      setTag(dTags[1], s === 1, s >= 2);
      dR.forEach(function (d, i) {
        d.r.style.display = i < Q ? "" : "none";
        var on = s >= 2;
        d.f.style.width = on ? (PROB[i] * 100) + "%" : "0%";
        d.v.textContent = on ? K.t("예 ", "yes ") + PROB[i].toFixed(2) : "…";
      });

      read.textContent = K.t("순차 단계 — 생성 모델 ", "Sequential steps — generative ") + K.fmt(Math.min(s, N)) + " / " + K.fmt(N) +
        K.t(" · 판정 모델 ", " · decision ") + Math.min(s, 2) + " / 2" +
        K.t(" (답 길이와 무관)", " (independent of answer length)");
    }

    bPlay.addEventListener("click", function () {
      if (Math.floor(t) >= total()) { t = 0; lastShown = -1; gOut.textContent = ""; }
      playing = !playing; render(true);
    });
    bAgain.addEventListener("click", function () { restart(); });

    K.loop(root, function (dt) {
      if (!playing) return;
      t += dt / 1000 * SPEED;
      if (t >= total()) { t = total(); playing = false; render(true); return; }
      render(false);
    });
    restart();
  });
})();
