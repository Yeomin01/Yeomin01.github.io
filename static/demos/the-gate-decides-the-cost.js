/* 「게이트가 비용을 정한다」 글의 그림: 1차 공격판정율이 2차 부하를 정하는 캐스케이드, 16GB 카드에 두 모델 올리기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var A = '.tca[data-demo="gate-cascade"] ';
  var B = '.tca[data-demo="gate-card-fit"] ';
  K.css("the-gate-decides-the-cost-css", [
    A + ".gc-rows{display:flex;flex-direction:column;gap:6px;--tca-lw:84px;margin:4px 0 0}",
    A + ".gc-t{position:relative;flex:1;min-width:0;height:24px;background:var(--code-bg);border-radius:3px;overflow:hidden}",
    A + ".gc-d{position:absolute;top:8px;width:8px;height:8px;margin-left:-4px;border-radius:50%}",
    A + ".gc-d.up{background:var(--tca-good)}",
    A + ".gc-d.dn{background:var(--tca-warn)}",
    A + ".gc-box{position:absolute;top:2px;bottom:2px;left:64%;width:20%;border-radius:4px;background:var(--tca-bad);color:#111;font-size:11px;line-height:20px;text-align:center;overflow:hidden;white-space:nowrap}",
    A + ".gc-q{position:absolute;top:2px;bottom:2px;right:36%;display:flex;flex-direction:row-reverse;gap:2px;align-items:center;padding-right:3px}",
    A + ".gc-q i{display:block;width:6px;height:14px;border-radius:2px;background:var(--tca-warn)}",
    B + ".gf-bar{position:relative;display:flex;height:28px;border-radius:4px;background:var(--code-bg);margin:6px 0 4px}",
    B + ".gf-bar div{height:100%;color:#111;font-size:11.5px;line-height:28px;padding:0 6px;white-space:nowrap;overflow:hidden;transition:width .35s ease}",
    B + ".gf-line{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--primary)}",
    B + ".gf-ax{position:relative;height:16px;font-size:11.5px;color:var(--secondary)}",
    B + ".gf-ax span{position:absolute;transform:translateX(-50%)}",
    "@media (prefers-reduced-motion:reduce){" + B + ".gf-bar div{transition:none}}"
  ].join(""));

  function row(rows, label, color, rw) {
    var r = K.el("div", "tca-row");
    r.appendChild(K.el("div", "tca-row-l", label));
    var t = K.el("div", "tca-track"), fl = K.el("div", "tca-fill");
    fl.style.background = color;
    t.appendChild(fl);
    var v = K.el("div", "tca-row-r");
    if (rw) v.style.width = rw;
    r.appendChild(t); r.appendChild(v);
    rows.appendChild(r);
    return { f: fl, v: v };
  }

  /* ── 1. 캐스케이드 ── */
  K.register("gate-cascade", function (root) {
    var S1 = 890, S2 = 8, SPIKE_R = 5, SPIKE_S = 10;
    var lam = 400, r = 0.5, spike = 0, Q = 0, paused = K.reduce;
    var dots = [], accUp = 0, accDn = 0, accOut = 0, pool = [], lastRead = "";

    K.head(root, K.t("1차가 보내는 비율이 2차의 부하를 정한다", "The first stage's pass-on rate sets the second stage's load"),
      K.t("1차(BERT)가 공격이라고 본 세션만 2차(gemma)로 간다. 나머지는 1차에서 끝난다. 2차가 지는 부하는 1차 공격판정율 × 트래픽이고, 2차는 초당 8건 남짓만 처리한다.",
        "Only sessions the first stage (BERT) flags go to the second (gemma); the rest end at stage one. Stage-two load is flag rate × traffic, and stage two handles only about 8 per second."));
    var bar = K.el("div", "tca-bar");
    var sL = K.slider({ label: K.t("트래픽", "Traffic"), min: 20, max: 890, step: 10, value: lam,
      fmt: function (v) { return v + K.t("건/초", "/s"); }, onInput: function (v) { lam = v; render(true); } });
    var sR = K.slider({ label: K.t("1차 공격판정율", "Stage-1 flag rate"), min: 0, max: 10, step: 0.1, value: r,
      fmt: function (v) { return v.toFixed(1) + "%"; }, onInput: function (v) { r = v; render(true); } });
    var bSpike = K.btn(K.t("공격이 몰린 10초", "Ten seconds of attacks"), false);
    var bPause = K.btn(paused ? K.t("재생", "Play") : K.t("일시정지", "Pause"), paused);
    bar.appendChild(sL.el); bar.appendChild(sR.el); bar.appendChild(bSpike); bar.appendChild(bPause);
    root.appendChild(bar);

    var flow = K.el("div", "gc-rows");
    function lane(label) {
      var rw = K.el("div", "tca-row");
      rw.appendChild(K.el("div", "tca-row-l", label));
      var t = K.el("div", "gc-t");
      t.setAttribute("aria-hidden", "true");
      rw.appendChild(t);
      flow.appendChild(rw);
      return t;
    }
    var tUp = lane(K.t("1차에서 끝", "Ends at stage 1"));
    var tDn = lane(K.t("2차로", "To stage 2"));
    var qEl = K.el("div", "gc-q");
    tDn.appendChild(qEl);
    tDn.appendChild(K.el("div", "gc-box", K.t("2차", "Stage 2")));
    root.appendChild(flow);
    root.appendChild(K.el("div", "tca-legend", K.t("점의 수는 비율만 보인다(위 점 하나 ≈ 60건, 아래 점 하나 = 2건). 아래 줄의 막대 = 2차 앞에서 기다리는 요청.",
      "Dot counts show proportions only (top dot ≈ 60 requests, bottom dot = 2). Bars on the bottom lane = requests waiting for stage two.")));

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "84px");
    rows.style.marginTop = "12px";
    var rLoad = row(rows, K.t("2차 부하", "Stage-2 load"), "var(--tca-warn)", "112px");
    var rQ = row(rows, K.t("2차 앞 대기", "Stage-2 backlog"), "var(--tca-bad)", "112px");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "1차 초당 890건(배치 32)과 2차 초당 8건 남짓은 글의 값이다. 트래픽과 판정율은 예시 값이고, 두 단계는 서로 기다리지 않고 따로 돈다고 두었다. 전체 상한 = 1차 890건과 2차가 버티는 트래픽(8 ÷ 판정율) 중 작은 값.",
      "Stage one at 890/s (batch 32) and stage two at about 8/s are from the post. Traffic and flag rate are examples, and the two stages are assumed to run independently. Overall limit = the smaller of 890/s and what stage two can absorb (8 ÷ flag rate).")));

    function rEff() { return spike > 0 ? Math.max(r, SPIKE_R) : r; }
    function render(force) {
      var re = rEff() / 100, load = lam * re, util = load / S2;
      rLoad.f.style.width = Math.min(100, util * 100) + "%";
      rLoad.v.textContent = load.toFixed(1) + " / 8" + K.t("건/초", "/s");
      rQ.f.style.width = Math.min(100, Q / 200 * 100) + "%";
      rQ.v.textContent = K.fmt(Q, 0) + K.t("건 · ", " · ") + (Q / S2).toFixed(1) + K.t("초", "s");
      var n = Math.min(14, Math.round(Q / 4));
      if (qEl.childElementCount !== n) { qEl.textContent = ""; for (var i = 0; i < n; i++) qEl.appendChild(K.el("i")); }
      var cap = re > 0 ? Math.min(S1, S2 / re) : S1;
      var txt = K.t("전체 상한 ", "Overall limit ") + K.fmt(cap, 0) + K.t("건/초 — ", "/s — ") +
        (cap < S1 ? K.t("2차가 정한다(8 ÷ 판정율)", "set by stage two (8 ÷ flag rate)") : K.t("1차 속도가 정한다", "set by stage one's speed")) + (spike > 0 ? K.t(" · 공격 몰림 ", " · attack spike ") + Math.ceil(spike) + K.t("초 남음", "s left") : "") +
        (util > 1 ? K.t(" · 지금 트래픽이면 2차 앞에 줄이 쌓인다", " · at this traffic a queue builds before stage two") : "");
      if (force || txt !== lastRead) { read.textContent = txt; lastRead = txt; }
    }
    function dot(t, cls, x0) {
      var d = pool.pop() || K.el("div");
      d.className = "gc-d " + cls;
      t.appendChild(d);
      return { el: d, x: x0 };
    }
    function step(dt) {
      var s = dt / 1000;
      if (spike > 0) { spike -= s; if (spike <= 0) { spike = 0; K.press(bSpike, false); } }
      var re = rEff() / 100, load = lam * re;
      Q = Math.max(0, Q + (load - S2) * s);
      accUp += lam * (1 - re) / 60 * s;
      accDn += load / 2 * s;
      accOut += (Q > 0 ? S2 : Math.min(load, S2)) / 2 * s;
      while (accUp >= 1) { accUp--; var u = dot(tUp, "up", 0); u.end = 1; u.v = 0.6; dots.push(u); }
      while (accDn >= 1) { accDn--; var dn = dot(tDn, "dn", 0); dn.end = 0.5; dn.v = 0.6; dots.push(dn); }
      while (accOut >= 1) { accOut--; var o = dot(tDn, "dn", 0.84); o.end = 1; o.v = 0.6; dots.push(o); }
      dots = dots.filter(function (d) {
        d.x += d.v * s;
        if (d.x >= d.end) { d.el.remove(); pool.push(d.el); return false; }
        d.el.style.left = (d.x * 100) + "%";
        return true;
      });
      render(false);
    }
    bSpike.addEventListener("click", function () { spike = SPIKE_S; K.press(bSpike, true); render(true); });
    bPause.addEventListener("click", function () {
      paused = !paused;
      bPause.textContent = paused ? K.t("재생", "Play") : K.t("일시정지", "Pause");
      K.press(bPause, paused);
    });
    render(true);
    K.loop(root, function (dt) { if (!paused && dt) step(dt); });
  });

  /* ── 2. 16GB 카드 ── */
  K.register("gate-card-fit", function (root) {
    var CARD = 16, MAX = 18, P1 = 1.2;
    var q = "bf16";
    K.head(root, K.t("16GB 카드에 두 모델 올리기", "Fitting both models on a 16 GB card"),
      K.t("1차(약 1.2GB)와 2차를 한 카드에 함께 올린다. 2차의 정밀도를 바꿔 본다.", "Stage one (about 1.2 GB) and stage two share one card. Switch stage two's precision."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "bf16", label: "bf16" }, { value: "nf4", label: K.t("nf4 4bit", "nf4 4-bit") }], q,
      function (v) { q = v; render(); }, K.t("2차 정밀도", "Stage-2 precision"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var b = K.el("div", "gf-bar");
    var d1 = K.el("div"), d2 = K.el("div");
    d1.style.background = K.COLORS[0]; d2.style.background = K.COLORS[1];
    b.appendChild(d1); b.appendChild(d2);
    var line = K.el("div", "gf-line");
    line.style.left = (CARD / MAX * 100) + "%";
    b.appendChild(line);
    root.appendChild(b);
    var ax = K.el("div", "gf-ax");
    [0, 4, 8, 12, 16].forEach(function (g) { var s = K.el("span", null, g + "GB"); s.style.left = (g / MAX * 100) + "%"; ax.appendChild(s); });
    root.appendChild(ax);
    root.appendChild(K.el("div", "tca-legend", K.t("파랑 = 1차 · 주황 = 2차 · 세로선 = 카드 16GB", "Blue = stage 1 · orange = stage 2 · line = 16 GB card")));
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t("크기는 글의 값이다(2차 bf16 약 15GB, nf4 약 9.4GB). 실행 중에 더 드는 작업 메모리는 그리지 않았다.",
      "Sizes are the post's (stage two about 15 GB in bf16, 9.4 GB in nf4). Working memory during inference is not drawn.")));
    function render() {
      var p2 = q === "bf16" ? 15 : 9.4, tot = P1 + p2;
      d1.style.width = (P1 / MAX * 100) + "%";
      d2.style.width = (p2 / MAX * 100) + "%";
      d2.textContent = K.t("2차 ", "Stage 2 ") + p2 + "GB";
      read.className = "tca-read " + (tot > CARD ? "tca-bad" : "tca-good");
      read.textContent = tot > CARD
        ? K.t("합 ", "Total ") + tot.toFixed(1) + K.t("GB — 16GB 카드에 안 들어간다. 실제로 bf16 로드는 OOM으로 죽었다.", " GB — does not fit. The bf16 load did die with OOM.")
        : K.t("합 ", "Total ") + tot.toFixed(1) + K.t("GB — 1차와 함께 들어간다. 이 과제에서 4bit의 정확도 손실은 무시할 수준이었다.", " GB — fits alongside stage one. The 4-bit accuracy loss was negligible on this task.");
    }
    render();
  });
})();
