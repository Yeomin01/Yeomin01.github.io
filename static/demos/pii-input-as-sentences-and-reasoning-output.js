/* 「PII 가드 입력은 글이 아니라 문장 리스트, 출력은 분류 + reasoning」 글의 그림: 글 전체를 자를 때와 문장 단위로 보낼 때 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("pii-input-as-sentences-and-reasoning-output-css",
    '.tca[data-demo="pii-sentence-window"] .pw-seqs{display:flex;flex-direction:column;gap:8px}' +
    '.tca[data-demo="pii-sentence-window"] .pw-seq{display:flex;flex-wrap:wrap;gap:3px;align-items:center;padding:6px;border-radius:6px;border:2px solid var(--tertiary)}' +
    '.tca[data-demo="pii-sentence-window"] .pw-seq.drop{border-style:dashed;opacity:.45}' +
    '.tca[data-demo="pii-sentence-window"] .pw-cap{flex-basis:100%;font-size:12px;color:var(--secondary)}' +
    '.tca[data-demo="pii-sentence-window"] .pw-t{font-size:13px;padding:1px 5px;border-radius:4px;background:var(--code-bg)}' +
    '.tca[data-demo="pii-sentence-window"] .pw-t.e{box-shadow:inset 0 -3px 0 var(--tca-accent);font-weight:600}' +
    '.tca[data-demo="pii-sentence-window"] .pw-t.cut{box-shadow:inset 0 -3px 0 var(--tca-bad);color:var(--tca-bad)}' +
    '.tca[data-demo="pii-sentence-window"] .pw-t.miss{box-shadow:inset 0 -3px 0 var(--tca-warn)}' +
    '.tca[data-demo="pii-sentence-window"] .pw-t.o{opacity:.55}');

  K.register("pii-sentence-window", function (root) {
    // 예시 문장(가상의 이름·주소·번호). 토큰은 설명용으로 띄어쓰기 단위에 가깝게 잘랐다.
    var S = [
      { t: ["어제", "상담", "내용을", "정리", "했습니다", "."], e: [] },
      { t: ["고객", "홍길동", "님은", "가람시", "누리구", "별빛로", "12", "에", "산다고", "하셨습니다", "."],
        e: [{ l: "NAME", a: 1, b: 1 }, { l: "ADDRESS", a: 3, b: 6 }] },
      { t: ["연락처는", "010-0000-0000", "입니다", "."], e: [{ l: "PHONE", a: 1, b: 1 }] },
      { t: ["다음", "주에", "다시", "연락", "드리기로", "했습니다", "."], e: [] }
    ];
    var TOK = [], ENT = [];
    S.forEach(function (s, si) {
      var base = TOK.length;
      s.t.forEach(function (w) { TOK.push({ w: w, s: si }); });
      s.e.forEach(function (e) { ENT.push({ l: e.l, a: base + e.a, b: base + e.b, s: si }); });
    });
    var st = { mode: "window", W: 12 };

    K.head(root, K.t("글을 통째로 자를 때 vs 문장 리스트로 보낼 때", "Cutting the whole text vs sending a sentence list"),
      K.t("네 문장, 28토큰짜리 예시 글이다. 모델 한 번에 들어가는 길이(윈도우)를 바꾸면 글 전체 방식에서는 경계가 entity 한가운데를 지나기도 하고, 잘라내기에서는 뒤쪽이 아예 버려진다.",
        "An example text of four sentences and 28 tokens. Change the window length: with the whole text, a boundary can run through an entity, and with truncation the tail is dropped."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "trunc", label: K.t("글 전체 · 잘라내기", "Whole text · truncate") },
      { value: "window", label: K.t("글 전체 · 윈도우 분할", "Whole text · windows") },
      { value: "sent", label: K.t("문장 리스트", "Sentence list") }
    ], st.mode, function (v) { st.mode = v; render(); }, K.t("입력 방식", "Input"));
    var sl = K.slider({ label: K.t("윈도우 길이(토큰)", "Window (tokens)"), min: 12, max: 24, step: 1, value: st.W,
      onInput: function (v) { st.W = v; render(); } });
    bar.appendChild(sg.el); bar.appendChild(sl.el);
    root.appendChild(bar);

    var wrap = K.el("div", "pw-seqs");
    root.appendChild(wrap);
    var lg = K.el("div", "tca-legend");
    [["var(--tca-accent)", K.t("한 윈도우 안에서 온전한 entity", "entity whole inside one window")],
      ["var(--tca-bad)", K.t("윈도우 경계에 잘린 entity", "entity cut by a boundary")],
      ["var(--tca-warn)", K.t("잘려 나가 아예 안 본 entity", "entity never seen (dropped)")]].forEach(function (x) {
      var s = K.el("span"), i = K.el("i"); i.style.background = x[0]; s.appendChild(i); s.appendChild(document.createTextNode(x[1])); lg.appendChild(s);
    });
    root.appendChild(lg);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "글과 윈도우 길이는 예시 값이다. 실제 BERT의 max_length는 보통 512이고, 여기서는 짧은 글에 맞춰 줄였다. 윈도우 분할은 겹치지 않게 이어 붙였다고 두었다. 흐린 토큰은 entity와 같은 윈도우에 들어온 다른 문장 토큰이다.",
      "The text and window lengths are examples; real BERT max_length is usually 512, scaled down here for a short text. Windows are assumed to tile without overlap. Faded tokens are other sentences' tokens sharing a window with an entity.")));

    function render() {
      var seqs = [];
      if (st.mode === "sent") {
        var k = 0;
        S.forEach(function (s, si) { seqs.push({ a: k, b: k + s.t.length - 1, cap: K.t("문장 ", "Sentence ") + (si + 1) }); k += s.t.length; });
      } else {
        for (var a = 0, n = 0; a < TOK.length; a += st.W, n++) {
          var b = Math.min(TOK.length - 1, a + st.W - 1);
          seqs.push({ a: a, b: b, cap: K.t("윈도우 ", "Window ") + (n + 1) + " · " + (b - a + 1) + K.t("토큰", " tokens"), drop: st.mode === "trunc" && n > 0 });
        }
      }
      // entity 상태
      var cut = 0, miss = 0, ok = 0, noise = 0, ctx = 0;
      ENT.forEach(function (e) {
        var sq = seqs.filter(function (q) { return !(q.b < e.a || q.a > e.b); });
        var live = sq.filter(function (q) { return !q.drop; });
        if (!live.length) { e.st = "miss"; miss++; }
        else if (sq.length > 1) { e.st = "cut"; cut++; }
        else { e.st = "ok"; ok++; }
      });
      // entity가 든 윈도우(버려지지 않은 것)에서 entity와 무관한 다른 문장 토큰 수를 센다
      wrap.textContent = "";
      seqs.forEach(function (q, qi) {
        var box = K.el("div", "pw-seq" + (q.drop ? " drop" : ""));
        box.style.borderColor = q.drop ? "var(--tertiary)" : K.COLORS[qi % K.COLORS.length];
        box.appendChild(K.el("div", "pw-cap", q.cap + (q.drop ? K.t(" · 버려짐", " · dropped") : "")));
        var hasEnt = ENT.some(function (e) { return !(q.b < e.a || q.a > e.b); });
        for (var i = q.a; i <= q.b; i++) {
          var cls = "pw-t", ent = null;
          ENT.forEach(function (e) { if (i >= e.a && i <= e.b) ent = e; });
          if (ent) cls += ent.st === "ok" ? " e" : ent.st === "cut" ? " cut" : " miss";
          else if (hasEnt && !q.drop && !ENT.some(function (e) { return e.s === TOK[i].s && !(q.b < e.a || q.a > e.b); })) { cls += " o"; noise++; }
          if (hasEnt && !q.drop) ctx++;
          var tk = K.el("span", cls, TOK[i].w);
          if (ent && i === ent.a) tk.title = ent.l;
          box.appendChild(tk);
        }
        wrap.appendChild(box);
      });
      var names = ENT.filter(function (e) { return e.st !== "ok"; }).map(function (e) { return e.l + (e.st === "cut" ? K.t(" 잘림", " cut") : K.t(" 누락", " missed")); });
      read.textContent = K.t("온전한 entity ", "Whole entities ") + ok + "/" + ENT.length +
        (names.length ? " · " + names.join(", ") : "") +
        K.t(" · entity가 든 윈도우 속 다른 문장 토큰 ", " · other-sentence tokens in entity windows ") + noise + "/" + ctx;
    }
    render();
  });
})();
