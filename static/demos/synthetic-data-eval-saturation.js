/* 「합성 데이터의 평가 함정 — eval이 1.0이어도」 글의 그림: 같은 분포 평가에서는 무엇을 배웠는지 안 보인다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("synth-eval-axes", function (root) {
    // 고정 시드 난수: 새로 고쳐도 같은 점이 나온다
    var seed = 20260612;
    function rnd() {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function u(a, b) { return a + (b - a) * rnd(); }
    var N = 30, pts = [], i;
    // x = 내용 신호(공격 의도), y = 합성 생성기의 정상 문체와 닮은 정도. 둘 다 0~1, 예시 값.
    for (i = 0; i < N; i++) pts.push({ atk: false, x: u(0.05, 0.4), sy: u(0.62, 0.95), ry: u(0.15, 0.7) });
    for (i = 0; i < N; i++) { var y = u(0.05, 0.38); pts.push({ atk: true, x: u(0.6, 0.95), sy: y, ry: y }); }
    pts.forEach(function (p) { p.y = p.sy; });

    var evalSet = "synth", show = "style", anim = 1;
    var MODELS = {
      style: { name: K.t("문체로 가르는 모델", "Style model"), attack: function (x, y) { return y < 0.5; } },
      content: { name: K.t("내용으로 가르는 모델", "Content model"), attack: function (x, y) { return x > 0.5; } }
    };

    K.head(root, K.t("합성 평가셋에서는 무엇을 배웠는지 안 보인다", "A same-generator eval hides what was learned"),
      K.t("합성 데이터에서는 정상 문체와 내용이 함께 움직여서, 문체만 배운 모델도 만점을 받는다. 평가셋의 정상을 실제 사람 대화로 바꾸면 두 모델이 갈린다.",
        "In synthetic data the normal style and the content move together, so a style-only model also scores perfectly. Swap the eval normals for real human chats and the two models split."));

    var bar = K.el("div", "tca-bar");
    var segEval = K.seg([
      { value: "synth", label: K.t("정상: 같은 생성기 합성", "Normals: same generator") },
      { value: "real", label: K.t("정상: 실제 사람 대화", "Normals: real human chats") }
    ], evalSet, function (v) { evalSet = v; anim = K.reduce ? 1 : 0; render(); }, K.t("평가셋의 정상 대화", "Eval normals"));
    var segModel = K.seg([
      { value: "style", label: K.t("문체 모델 경계", "Style boundary") },
      { value: "content", label: K.t("내용 모델 경계", "Content boundary") }
    ], show, function (v) { show = v; render(); }, K.t("그릴 경계", "Boundary to draw"));
    bar.appendChild(segEval.el); bar.appendChild(segModel.el);
    root.appendChild(bar);

    var W = 320, H = 250, L = 34, R = 310, T = 12, B = 214;
    function sx(v) { return L + v * (R - L); }
    function sy(v) { return B - v * (B - T); }
    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("가로는 내용 신호, 세로는 합성 정상 문체와 닮은 정도인 산점도", "Scatter: x is content signal, y is resemblance to the synthetic normal style") }, root);
    s.style.maxWidth = "440px";
    K.svg("rect", { x: L, y: T, width: R - L, height: B - T, fill: "none", stroke: "var(--tertiary)" }, s);
    var shade = K.svg("rect", { fill: "var(--tca-bad)", opacity: "0.08" }, s);
    var line = K.svg("line", { stroke: "var(--primary)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
    var lineTxt = K.svg("text", { "font-size": 12 }, s);
    var tx = K.svg("text", { x: (L + R) / 2, y: H - 14, "text-anchor": "middle", "font-size": 12, "class": "muted" }, s);
    tx.textContent = K.t("내용 신호(공격 의도) →", "Content signal (attack intent) →");
    var ty = K.svg("text", { x: 12, y: (T + B) / 2, "text-anchor": "middle", "font-size": 12, "class": "muted",
      transform: "rotate(-90 12 " + (T + B) / 2 + ")" }, s);
    ty.textContent = K.t("합성 정상 문체와 닮음 →", "Synthetic normal style →");
    var marks = pts.map(function (p) {
      var m = p.atk ? K.svg("rect", { width: 8, height: 8, fill: K.COLORS[2] }, s) : K.svg("circle", { r: 4.5, fill: K.COLORS[0] }, s);
      m.setAttribute("stroke-width", "2.2");
      return m;
    });

    var leg = K.el("div", "tca-legend");
    function legItem(color, txt, round) {
      var sp = K.el("span"), ic = K.el("i");
      ic.style.background = color; if (round) ic.style.borderRadius = "50%";
      sp.appendChild(ic); sp.appendChild(document.createTextNode(txt)); leg.appendChild(sp);
    }
    legItem(K.COLORS[0], K.t("정상 (원)", "Normal (circle)"), true);
    legItem(K.COLORS[2], K.t("공격 (네모)", "Attack (square)"));
    var errSp = K.el("span"), errI = K.el("i");
    errI.style.border = "2px solid var(--tca-bad)"; errI.style.background = "transparent";
    errSp.appendChild(errI); errSp.appendChild(document.createTextNode(K.t("고른 경계로 틀린 점", "Wrong under the drawn boundary")));
    leg.appendChild(errSp);
    root.appendChild(leg);

    var rows = K.el("div", "tca-rows");
    rows.style.marginTop = "10px";
    rows.style.setProperty("--tca-lw", "84px");
    rows.style.setProperty("--tca-rw", "64px");
    function row(label, color) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      f.style.background = color;
      tr.appendChild(f); r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v };
    }
    var rS = row(K.t("문체 모델", "Style model"), "var(--tca-warn)");
    var rC = row(K.t("내용 모델", "Content model"), "var(--tca-accent)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "두 축과 점(정상 30·공격 30)은 설명용 예시 값이다. 막대는 공격 쪽 F1이다. 글의 사례처럼 공격은 그대로 두고 정상만 실제 대화로 바꾼다.",
      "Axes and dots (30 normal, 30 attack) are illustrative values. Bars show attack-class F1. As in the post, attacks stay and only the normals change.")));

    function score(m) {
      var tp = 0, fp = 0, fn = 0;
      pts.forEach(function (p) {
        var a = m.attack(p.x, p.atk ? p.y : p.to);
        if (a && p.atk) tp++; else if (a && !p.atk) fp++; else if (!a && p.atk) fn++;
      });
      var f1 = tp ? (2 * tp) / (2 * tp + fp + fn) : 0;
      return { f1: f1, fp: fp };
    }
    function draw() {
      var m = MODELS[show];
      pts.forEach(function (p, k) {
        var el = marks[k], cx = sx(p.x), cy = sy(p.y);
        if (p.atk) { el.setAttribute("x", (cx - 4).toFixed(1)); el.setAttribute("y", (cy - 4).toFixed(1)); }
        else { el.setAttribute("cx", cx.toFixed(1)); el.setAttribute("cy", cy.toFixed(1)); }
        var wrong = m.attack(p.x, p.y) !== p.atk;
        el.setAttribute("stroke", wrong ? "var(--tca-bad)" : "none");
      });
      if (show === "style") {
        line.setAttribute("x1", L); line.setAttribute("x2", R); line.setAttribute("y1", sy(0.5)); line.setAttribute("y2", sy(0.5));
        shade.setAttribute("x", L); shade.setAttribute("y", sy(0.5)); shade.setAttribute("width", R - L); shade.setAttribute("height", B - sy(0.5));
        lineTxt.setAttribute("x", R - 4); lineTxt.setAttribute("y", sy(0.5) - 5); lineTxt.setAttribute("text-anchor", "end");
        lineTxt.textContent = K.t("선 아래 = 공격 판정", "below = attack");
      } else {
        line.setAttribute("x1", sx(0.5)); line.setAttribute("x2", sx(0.5)); line.setAttribute("y1", T); line.setAttribute("y2", B);
        shade.setAttribute("x", sx(0.5)); shade.setAttribute("y", T); shade.setAttribute("width", R - sx(0.5)); shade.setAttribute("height", B - T);
        lineTxt.setAttribute("x", sx(0.5) + 5); lineTxt.setAttribute("y", T + 16); lineTxt.setAttribute("text-anchor", "start");
        lineTxt.textContent = K.t("오른쪽 = 공격 판정", "right = attack");
      }
    }
    function render() {
      pts.forEach(function (p) { if (!p.atk) { p.from = p.y; p.to = evalSet === "real" ? p.ry : p.sy; } });
      if (anim >= 1) pts.forEach(function (p) { if (!p.atk) p.y = p.to; });
      draw();
      var a = score(MODELS.style), b = score(MODELS.content);
      rS.f.style.width = (a.f1 * 100).toFixed(1) + "%"; rS.v.textContent = "F1 " + a.f1.toFixed(2);
      rC.f.style.width = (b.f1 * 100).toFixed(1) + "%"; rC.v.textContent = "F1 " + b.f1.toFixed(2);
      read.textContent = evalSet === "synth"
        ? K.t("두 모델 모두 F1 ", "Both models score F1 ") + a.f1.toFixed(2) + K.t(" — 점수로는 어느 쪽이 내용을 배웠는지 구분되지 않는다.", " — the score cannot tell which one learned the content.")
        : K.t("실제 대화 정상 ", "Of ") + N + K.t("건 중 공격으로 본 것 — 문체 모델 ", " real normals, flagged as attack — style model ") + a.fp +
          K.t("건, 내용 모델 ", ", content model ") + b.fp + K.t("건.", ".");
    }
    // 정상 점이 합성 위치와 실제 위치 사이를 옮겨 가는 움직임
    K.loop(root, function (dt) {
      if (anim >= 1) return;
      anim = Math.min(1, anim + dt / 700);
      var e = anim < 0.5 ? 2 * anim * anim : 1 - Math.pow(-2 * anim + 2, 2) / 2;
      pts.forEach(function (p) { if (!p.atk) p.y = p.from + (p.to - p.from) * e; });
      draw();
    });
    render();
  });
})();
