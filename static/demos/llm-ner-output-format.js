/* 「LLM 으로 NER 할 때 — 어절 인덱스만 받자」 글의 그림: 두 출력 형식의 생성 길이와 시간 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("llmner-output-race", function (root) {
    var TAG = 8, ITEM = 15, RUN_MS = 4000;
    var st = { len: 100, pii: 2, ms: 30, t: 0, playing: !K.reduce };

    K.head(root, K.t("같은 속도로 생성하면 누가 먼저 끝나나", "Same speed, which output finishes first"),
      K.t("두 출력 형식을 같은 속도(출력 1토큰당 같은 시간)로 생성한다. 입력 길이와 PII 개수를 바꾸면, 원문 다시 쓰기는 입력 길이를 따라 길어지고 인덱스 형식은 PII 개수만 따라가는 것이 보인다.",
        "Both output formats are generated at the same speed per token. Change the input length and the PII count: rewriting grows with the input, the index format only with the PII count."));

    var bar = K.el("div", "tca-bar");
    var sL = K.slider({ label: K.t("입력 길이", "Input length"), min: 50, max: 1024, step: 2, value: st.len,
      fmt: function (v) { return K.fmt(v) + K.t("토큰", " tok"); }, onInput: function (v) { st.len = v; restart(); } });
    var sN = K.slider({ label: K.t("PII 개수", "PII count"), min: 0, max: 5, step: 1, value: st.pii,
      fmt: function (v) { return String(v); }, onInput: function (v) { st.pii = v; restart(); } });
    var sM = K.slider({ label: K.t("1토큰 시간", "Per token"), min: 10, max: 50, step: 5, value: st.ms,
      fmt: function (v) { return v + " ms"; }, onInput: function (v) { st.ms = v; restart(); } });
    var bPlay = K.btn(K.t("일시정지", "Pause"), true);
    bar.appendChild(sL.el); bar.appendChild(sN.el); bar.appendChild(sM.el); bar.appendChild(bPlay);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "112px");
    rows.style.setProperty("--tca-rw", "82px");
    function row(label, sample, color) {
      var wrap = K.el("div");
      var r = K.el("div", "tca-row");
      r.appendChild(K.el("div", "tca-row-l", label));
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      f.style.background = color;
      f.style.transition = "none";
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r");
      r.appendChild(tr); r.appendChild(v);
      wrap.appendChild(r);
      var s = K.el("div", "tca-note", sample);
      s.style.margin = "0 0 6px";
      s.style.fontFamily = "var(--code-font, monospace)";
      s.style.fontSize = "12px";
      wrap.appendChild(s);
      rows.appendChild(wrap);
      return { f: f, v: v, s: s };
    }
    var r1 = row(K.t("원문 다시 쓰기", "Rewrite the text"), "<NAME>김철수</NAME> <PHONE>010-1234-5678</PHONE> 로 연락주세요", K.COLORS[2]);
    var SAMPLE = '[{"idx": 0, "label": "NAME", "text": "김철수"}, …]';
    var r2 = row(K.t("인덱스 + PII 만", "Index + PII only"), SAMPLE, K.COLORS[3]);
    root.appendChild(rows);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "토큰 수는 원문 다시 쓰기 = 입력 토큰 + PII 하나당 태그 8토큰, 인덱스 형식 = PII 하나당 15토큰(PII 가 없으면 [] 1토큰)으로 셌다. 8·15 와 1토큰 시간은 예시 값이다(글: 7B 기준 출력 1토큰에 수십 ms). 막대는 시간 축이고, 재생은 실제보다 빠르게 돌린다.",
      "Token counts: rewriting = input tokens + 8 tag tokens per PII; index format = 15 tokens per PII ([] is 1 token when there is none). 8, 15 and the per-token time are example values (the post: tens of ms per output token on a 7B model). Bars are a time axis; playback runs faster than real time.")));

    function counts() {
      return { a: st.len + TAG * st.pii, b: st.pii === 0 ? 1 : ITEM * st.pii };
    }
    function sec(ms) { return (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + K.t("초", " s"); }
    function render() {
      var c = counts(), ta = c.a * st.ms, tb = c.b * st.ms, T = Math.max(ta, tb);
      var now = Math.min(st.t, T);
      function put(r, n, tt) {
        var done = Math.min(now, tt);
        r.f.style.width = (done / T * 100) + "%";
        r.v.textContent = K.fmt(Math.floor(done / st.ms + 1e-9)) + "/" + K.fmt(n);
      }
      put(r1, c.a, ta); put(r2, c.b, tb);
      var head = now >= T ? K.t("끝 · ", "Done · ") : K.t("경과 ", "Elapsed ") + sec(now) + " · ";
      read.textContent = head + K.t("원문 다시 쓰기 ", "rewrite ") + K.fmt(c.a) + K.t("토큰 = ", " tok = ") + sec(ta) +
        K.t(" · 인덱스 형식 ", " · index ") + K.fmt(c.b) + K.t("토큰 = ", " tok = ") + sec(tb) +
        K.t(" · 약 ", " · about ") + (ta / tb >= 10 ? Math.round(ta / tb) : (ta / tb).toFixed(1)) + K.t("배", "×");
      r2.s.textContent = st.pii === 0 ? "[]" : SAMPLE;
    }
    function setPlay(on) {
      st.playing = on;
      K.press(bPlay, on);
      bPlay.textContent = on ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    }
    function total() { var c = counts(); return Math.max(c.a, c.b) * st.ms; }
    function restart() {
      st.t = K.reduce ? total() : 0;
      setPlay(!K.reduce);
      render();
    }
    bPlay.addEventListener("click", function () {
      if (!st.playing && st.t >= total()) st.t = 0;
      setPlay(!st.playing);
      render();
    });
    K.loop(root, function (dt) {
      if (!st.playing) return;
      var T = total();
      st.t = Math.min(T, st.t + dt * T / RUN_MS);
      render();
      if (st.t >= T) setPlay(false);
    });
    restart();
  });
})();
