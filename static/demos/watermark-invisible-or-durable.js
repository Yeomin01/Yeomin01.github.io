/* 「판정을 안 바꾸면서 지워지지도 않는 워터마크는 없다」 글의 그림: 밀어내는 배수 하나로 신호·내성·뒤집힘이 같이 움직인다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("wmd-knob", function (root) {
    var STOPS = [1, 3, 10, 30, 100, 300, 1000, 5000];
    var SIG1 = 0.0015, NOISE = 0.0467; // 배수 1 에서의 신호·잡음(계산 글의 실측)
    var MEAS = { 1: { sn: "0.03", flip: K.t("0건", "0") }, 100: { sn: "3.3", flip: K.t("7건", "7") } };
    var k = 0, sweeping = false, t = 0;

    K.head(root, K.t("손잡이 하나 — 밀어내는 배수", "One knob — the push multiplier"),
      K.t("저에너지 방향에 심은 서명의 배수를 1에서 5,000까지 움직인다. 서명 신호가 int4 잡음을 넘어서는 만큼 판정 뒤집힘도 같이 늘어난다.",
        "Move the multiplier of the low-energy watermark from 1 to 5,000. As the signal climbs past int4 noise, flips rise with it."));

    var bar = K.el("div", "tca-bar");
    var sl = K.slider({ label: K.t("배수", "Multiplier"), min: 0, max: STOPS.length - 1, step: 1, value: 0,
      fmt: function (i) { return "×" + K.fmt(STOPS[i]); }, onInput: function (i) { k = i; stop(); paint(); } });
    var bSweep = K.btn(K.t("1 → 5,000 훑기", "Sweep 1 → 5,000"), false);
    bar.appendChild(sl.el); bar.appendChild(bSweep);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "104px");
    rows.style.setProperty("--tca-rw", "96px");
    function row(label, color) {
      var r = K.el("div", "tca-row"), l = K.el("div", "tca-row-l", label), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      f.style.background = color; tr.appendChild(f); r.appendChild(l); r.appendChild(tr); r.appendChild(v); rows.appendChild(r);
      return { f: f, v: v, tr: tr };
    }
    var rSig = row(K.t("서명 신호", "Signal"), "var(--tca-accent)");
    var rNoise = row(K.t("int4 잡음", "int4 noise"), "var(--secondary)");
    rows.appendChild(K.el("div", "tca-note", K.t("위 두 막대는 같은 로그 축(0.001~10)이다.", "Both bars above share one log axis (0.001 to 10).")));
    var rSN = row(K.t("신호 / 잡음", "Signal / noise"), "var(--tca-accent)");
    var rFlip = row(K.t("판정 뒤집힘", "Flipped decisions"), "var(--tca-bad)");
    root.appendChild(rows);

    var state = K.el("div", "tca-read");
    state.setAttribute("aria-live", "polite");
    root.appendChild(state);
    root.appendChild(K.el("div", "tca-note", K.t(
      "실측은 두 점뿐이다: 배수 1 에서 신호/잡음 0.03·뒤집힘 0건, 배수 100 에서 3.3·7건(200만 문장 중, 양자화·프루닝을 견딤). 신호 0.0015·잡음 0.0467 은 계산 글의 값이다. 그 사이는 신호가 배수에 비례한다고 둔 값이고, '잡음에 묻힘'의 경계를 1로 둔 것도 가정이다. 뒤집힘 막대는 측정점이 아닌 곳에서는 경향만 그린다.",
      "Only two measured points: ×1 gives S/N 0.03 and 0 flips; ×100 gives 3.3 and 7 flips (of 2M, survives quantization and pruning). Signal 0.0015 and noise 0.0467 come from the math post. Values between assume signal ∝ multiplier, and the 'buried' boundary at 1 is an assumption. The flip bar shows only the trend away from measured points.")));

    function logw(v) { return Math.max(0, Math.min(100, (Math.log(v) / Math.LN10 + 3) / 4 * 100)); }
    function paint() {
      var s = STOPS[k], sig = SIG1 * s, sn = sig / NOISE, m = MEAS[s];
      rSig.f.style.width = logw(sig) + "%"; rSig.v.textContent = (s === 1 ? "" : "≈") + (sig < 0.01 ? sig.toFixed(4) : sig < 1 ? sig.toFixed(3) : sig.toFixed(1));
      rNoise.f.style.width = logw(NOISE) + "%"; rNoise.v.textContent = NOISE.toFixed(4);
      rSN.f.style.width = logw(sn) + "%";
      rSN.v.textContent = m ? m.sn + K.t(" 실측", " meas.") : "≈" + (sn < 1 ? sn.toFixed(2) : sn.toFixed(1));
      rFlip.f.style.width = (100 * Math.log(s) / Math.log(5000)) + "%";
      rFlip.f.style.opacity = m ? "1" : ".45";
      rFlip.v.textContent = m ? m.flip + K.t(" 실측", " meas.") : K.t("측정점 아님", "not measured");
      var buried = sn < 1;
      state.textContent = "×" + K.fmt(s) + " — " + (buried ? K.t("int4 한 번이면 서명이 잡음에 묻힌다", "one int4 pass buries the watermark")
        : K.t("int4 를 거쳐도 서명이 남는다", "the watermark survives int4")) +
        (s === 1 ? K.t(" · 대신 판정은 한 건도 안 바뀐다", " · and no decision changes") : s === 100 ? K.t(" · 대신 뒤집힘이 0건에서 7건이 됐다", " · but flips went from 0 to 7") : K.t(" · 내성만 오르는 구간은 없다", " · no range raises durability alone"));
      state.className = "tca-read " + (buried ? "tca-bad" : "tca-good");
    }
    function stop() { sweeping = false; K.press(bSweep, false); }
    bSweep.addEventListener("click", function () {
      sweeping = !sweeping; K.press(bSweep, sweeping);
      if (sweeping) { k = 0; t = 0; sl.set(0); paint(); }
    });
    K.loop(root, function (dt) {
      if (!sweeping) return;
      t += dt;
      if (t > 900) {
        t = 0;
        if (k >= STOPS.length - 1) { stop(); return; }
        k++; sl.set(k); paint();
      }
    });
    paint();
  });
})();
