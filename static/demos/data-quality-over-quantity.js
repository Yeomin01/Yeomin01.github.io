/* 「데이터는 양보다 질」 글의 그림: epoch 을 늘리는 것과 부족한 패턴을 데이터에 넣는 것의 차이 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("dq-epoch-vs-data", function (root) {
    var EMAX = 10;
    // 예시 값. 본문의 정성적 서술(epoch 으로는 거의 안 오름 · 반복하면 다른 출력이 약간 떨어짐 · 보강 뒤 오름)만 따른다.
    function common(e) { return 0.6 + 0.33 * (1 - Math.exp(-(e - 1) / 1.3)) - 0.008 * Math.max(0, e - 4); }
    function rareBefore(e) { return 0.28 + 0.08 * (1 - Math.exp(-(e - 1) / 1.5)); }
    function rareAfter(e) { return 0.35 + 0.52 * (1 - Math.exp(-(e - 1) / 1.5)) - 0.004 * Math.max(0, e - 5); }

    var mix = 0, target = 0;          // 0 = 보강 전, 1 = 보강 후 (곡선이 서서히 옮겨 간다)
    var epoch = 1, playing = !K.reduce;
    if (K.reduce) epoch = EMAX;
    function rare(e) { return rareBefore(e) * (1 - mix) + rareAfter(e) * mix; }

    K.head(root, K.t("epoch 을 늘릴까, 데이터를 채울까", "More epochs, or fill the data?"),
      K.t("데이터에 거의 없는 종류의 출력(드문 패턴)과 데이터에 많은 출력(흔한 패턴)을 epoch 에 따라 본다. 보강 전후를 바꾸면 드문 패턴 곡선이 옮겨 간다.",
        "Track an output type that is nearly absent from the data (rare pattern) and one that is plentiful (common pattern) across epochs. Switch before/after augmentation and the rare-pattern curve moves."));

    var bar = K.el("div", "tca-bar");
    var sData = K.seg([
      { value: 0, label: K.t("보강 전: 패턴이 거의 없음", "Before: pattern nearly absent") },
      { value: 1, label: K.t("보강 후: 부족한 패턴 추가", "After: missing pattern added") }
    ], 0, function (v) { target = v; if (K.reduce) { mix = v; } draw(); }, K.t("데이터", "Data"));
    var sEp = K.slider({ label: "epoch", min: 1, max: EMAX, step: 1, value: epoch,
      fmt: function (v) { return String(v); }, onInput: function (v) { epoch = v; playing = false; draw(); } });
    var bPlay = K.btn(K.t("일시정지", "Pause"), playing);
    bar.appendChild(sData.el); bar.appendChild(sEp.el); bar.appendChild(bPlay);
    root.appendChild(bar);

    var W = 460, H = 230, L = 40, R = 12, T = 12, B = 34;
    var Y0 = 0.2, Y1 = 1.0;
    function x(e) { return L + (e - 1) / (EMAX - 1) * (W - L - R); }
    function y(v) { return T + (1 - (v - Y0) / (Y1 - Y0)) * (H - T - B); }
    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("epoch 에 따른 두 패턴의 성능 곡선", "Performance of two patterns across epochs") });
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(function (v) {
      K.svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: "var(--tertiary)", "stroke-width": 1, "stroke-dasharray": v === 0.2 ? null : "2 3" }, s);
      var t = K.svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, s);
      t.textContent = v.toFixed(1);
    });
    for (var e = 1; e <= EMAX; e++) {
      var tx = K.svg("text", { x: x(e), y: H - B + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, s);
      tx.textContent = String(e);
    }
    var xl = K.svg("text", { x: (L + W - R) / 2, y: H - 2, "text-anchor": "middle", "font-size": 12, "class": "muted" }, s);
    xl.textContent = "epoch";
    var cur = K.svg("line", { y1: T, y2: H - B, stroke: "var(--secondary)", "stroke-width": 1.5 }, s);
    var pCommon = K.svg("path", { fill: "none", stroke: K.COLORS[0], "stroke-width": 2.5 }, s);
    var pRareGhost = K.svg("path", { fill: "none", stroke: K.COLORS[1], "stroke-width": 1.5, "stroke-dasharray": "4 4", opacity: 0.5 }, s);
    var pRare = K.svg("path", { fill: "none", stroke: K.COLORS[1], "stroke-width": 2.5 }, s);
    var dCommon = K.svg("circle", { r: 5, fill: K.COLORS[0], stroke: "var(--entry)", "stroke-width": 2 }, s);
    var dRare = K.svg("circle", { r: 5, fill: K.COLORS[1], stroke: "var(--entry)", "stroke-width": 2 }, s);
    root.appendChild(s);

    var lg = K.el("div", "tca-legend");
    function item(color, label, dash) {
      var sp = K.el("span");
      var i = K.el("i");
      i.style.background = color;
      if (dash) { i.style.background = "none"; i.style.borderTop = "2px dashed " + color; i.style.height = "0"; i.style.verticalAlign = "3px"; }
      sp.appendChild(i); sp.appendChild(document.createTextNode(label));
      lg.appendChild(sp);
    }
    item(K.COLORS[0], K.t("흔한 패턴(데이터에 많음)", "Common pattern (plentiful)"));
    item(K.COLORS[1], K.t("드문 패턴(데이터에 거의 없음)", "Rare pattern (nearly absent)"));
    item(K.COLORS[1], K.t("보강 전 드문 패턴(비교용)", "Rare pattern before (for reference)"), true);
    root.appendChild(lg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var verdict = K.el("div", "tca-note");
    root.appendChild(verdict);
    root.appendChild(K.el("div", "tca-note", K.t(
      "곡선은 예시 값이다. 본문은 epoch 을 늘려도 거의 개선되지 않았고, 반복 학습하면 다른 종류의 출력이 약간 떨어졌으며, 데이터를 보강한 뒤에야 올랐다고만 적는다.",
      "Curves are example values. The post only says more epochs barely helped, repetition slightly hurt other outputs, and the score rose only after the data was augmented.")));

    function path(fn) {
      var d = "";
      for (var i = 0; i <= 45; i++) {
        var e = 1 + i / 45 * (EMAX - 1);
        d += (i ? "L" : "M") + x(e).toFixed(1) + " " + y(fn(e)).toFixed(1);
      }
      return d;
    }
    pCommon.setAttribute("d", path(common));
    pRareGhost.setAttribute("d", path(rareBefore));
    function sg(d) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(2); }

    var lastKey = "";
    function draw() {
      pRare.setAttribute("d", path(rare));
      pRareGhost.style.display = mix > 0.02 ? "" : "none";
      var e = epoch;
      cur.setAttribute("x1", x(e)); cur.setAttribute("x2", x(e));
      dCommon.setAttribute("cx", x(e)); dCommon.setAttribute("cy", y(common(e)));
      dRare.setAttribute("cx", x(e)); dRare.setAttribute("cy", y(rare(e)));
      K.press(bPlay, playing);
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("epoch 재생", "Play epochs");
      var ei = Math.round(e);
      var key = ei + ":" + target + ":" + (mix === target);
      if (key === lastKey) return;
      lastKey = key;
      var peak = 0;
      for (var k = 1; k <= EMAX; k++) peak = Math.max(peak, common(k));
      var rv = target ? rareAfter(ei) : rareBefore(ei);
      var dp = common(ei) - peak;
      read.textContent = "epoch " + ei + K.t(" — 흔한 패턴 ", " — common ") + common(ei).toFixed(2) +
        (Math.abs(dp) < 0.005 ? K.t(" (최고점)", " (peak)") : K.t(" (최고점 대비 ", " (vs its peak ") + sg(dp) + ")") +
        K.t(" · 드문 패턴 ", " · rare ") + rv.toFixed(2) + K.t(" (epoch 1 대비 ", " (vs epoch 1 ") + sg(rv - (target ? rareAfter(1) : rareBefore(1))) + ")" +
        (target ? K.t(" · 보강 전 같은 epoch 은 ", " · before, same epoch: ") + rareBefore(ei).toFixed(2) : "");
      verdict.textContent = target
        ? K.t("보강 후: 같은 epoch 에서 드문 패턴이 올라와 있다. 바뀐 것은 epoch 이 아니라 데이터다.",
          "After: at the same epoch the rare pattern is higher. What changed is the data, not the epoch count.")
        : K.t("보강 전: epoch 을 늘려도 드문 패턴은 거의 그대로이고, 흔한 패턴은 뒤로 갈수록 조금씩 내려간다.",
          "Before: more epochs leave the rare pattern almost flat, while the common pattern slips slightly later on.");
    }

    bPlay.addEventListener("click", function () {
      if (!playing && epoch >= EMAX) epoch = 1;
      playing = !playing;
      draw();
    });

    var hold = 0;
    K.loop(root, function (dt) {
      var changed = false;
      if (mix !== target) {
        var step = dt / 600;
        mix = target > mix ? Math.min(target, mix + step) : Math.max(target, mix - step);
        changed = true;
      }
      if (playing) {
        if (epoch >= EMAX) {
          hold += dt;
          if (hold > 1500) { hold = 0; epoch = 1; }
        } else {
          epoch = Math.min(EMAX, epoch + dt / 650);
        }
        sEp.set(Math.round(epoch));
        changed = true;
      }
      if (changed) draw();
    });

    draw();
  });
})();
