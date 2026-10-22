/* 「micro F1과 macro F1」 글의 그림: 약점 클래스 C 하나만 바꿔 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("micro-macro-c", function (root) {
    var START = [{ id: "A", n: 1000, f1: 0.97 }, { id: "B", n: 600, f1: 0.95 }, { id: "C", n: 200, f1: 0.86 }];
    var cls = START.map(function (c) { return { id: c.id, n: c.n, f1: c.f1 }; });
    var LO = 0.5, HI = 1.0;
    var unit = K.t("건", "");

    function micro(cs) {
      var s = 0, n = 0;
      cs.forEach(function (c) { s += c.f1 * c.n; n += c.n; });
      return s / n;
    }
    function macro(cs) {
      var s = 0;
      cs.forEach(function (c) { s += c.f1; });
      return s / cs.length;
    }
    var m0 = micro(START), M0 = macro(START);

    K.head(root, K.t("약점 클래스 C 하나만 바꿔 보기", "Move only the weak class C"),
      K.t("본문 표의 값(A 1,000건 0.97 · B 600건 0.95 · C 200건 0.86)에서 시작한다. C의 F1과 건수를 움직이면 micro와 macro가 얼마나 따라 움직이는지 보인다.",
        "Starts from the table in the post (A 1,000 at 0.97 · B 600 at 0.95 · C 200 at 0.86). Move C's F1 and support to see how much micro and macro follow."));

    var bar = K.el("div", "tca-bar");
    var sF1 = K.slider({ label: K.t("C의 F1", "C F1"), min: 0.5, max: 1, step: 0.01, value: 0.86,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { cls[2].f1 = v; render(); } });
    var sN = K.slider({ label: K.t("C의 건수", "C support"), min: 50, max: 1600, step: 50, value: 200,
      fmt: function (v) { return K.fmt(v) + unit; }, onInput: function (v) { cls[2].n = v; render(); } });
    var bReset = K.btn(K.t("본문 값으로", "Reset to the post"));
    bar.appendChild(sF1.el); bar.appendChild(sN.el); bar.appendChild(bReset);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "104px");
    function row(label, color) {
      var r = K.el("div", "tca-row");
      var l = K.el("div", "tca-row-l", label);
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      f.style.background = color;
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r");
      r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { l: l, f: f, v: v };
    }
    var cRows = cls.map(function (c, i) { return row(c.id, K.COLORS[i]); });
    rows.appendChild(K.el("div", "tca-note", K.t("합친 값", "Combined")));
    var rMicro = row("micro F1", "var(--tca-accent)");
    var rMacro = row("macro F1", "var(--tca-warn)");
    root.appendChild(rows);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "막대는 0.5~1.0 구간을 그린다. 클래스마다 정밀도와 재현율이 같다고 두었다. 그러면 micro F1은 건수로 가중한 평균과 같아진다.",
      "Bars span 0.5 to 1.0. Precision equals recall within each class here, so micro F1 equals the support-weighted mean.")));

    function width(v) { return Math.max(0, Math.min(1, (v - LO) / (HI - LO))) * 100 + "%"; }
    function sign(d) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(3); }
    function render() {
      cls.forEach(function (c, i) {
        cRows[i].l.textContent = c.id + " · " + K.fmt(c.n) + unit;
        cRows[i].f.style.width = width(c.f1);
        cRows[i].v.textContent = c.f1.toFixed(2);
      });
      var mi = micro(cls), ma = macro(cls);
      rMicro.f.style.width = width(mi); rMicro.v.textContent = mi.toFixed(3);
      rMacro.f.style.width = width(ma); rMacro.v.textContent = ma.toFixed(3);
      read.textContent = K.t("본문 값 대비 — micro ", "Versus the post — micro ") + sign(mi - m0) + " · macro " + sign(ma - M0) +
        K.t(" · 지금 둘의 차이 ", " · gap now ") + Math.abs(mi - ma).toFixed(3);
    }
    bReset.addEventListener("click", function () {
      cls[2].f1 = 0.86; cls[2].n = 200; sF1.set(0.86); sN.set(200); render();
    });
    render();
  });
})();
