/* 「한 번 뽑고 대표값이라 불렀다」 글의 그림: 씨앗을 늘리면 드러나는 분포, 기준선을 먼저 찍느냐에 따라 갈리는 결과 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  // 그림 1: 처음 한 번의 21과 씨앗 여섯 번의 분포
  K.register("seed-spread", function (root) {
    var FIRST = 21, SEEDS = [34, 49, 28, 41, 30, 35]; // 값은 본문, 뽑힌 순서는 예시
    var X0 = 15, X1 = 55, Y = 70;
    var n = 0, drops = [], auto = false, acc = 0;

    K.head(root, K.t("한 번 값과 씨앗 여섯 번", "One draw vs. six seeds"),
      K.t("같은 조건에서 씨앗만 바꿔 다시 돌린다. 처음 얻은 21이 대표값인지는 다른 씨앗의 값이 쌓여야 보인다.",
        "Rerun the same condition with a different seed. Whether the first 21 is representative only shows once other seeds pile up."));
    var bar = K.el("div", "tca-bar");
    var bOne = K.btn(K.t("씨앗 바꿔 한 번 더", "One more seed"));
    var bAuto = K.btn(K.t("여섯 번 자동으로", "Run all six"), false);
    var bReset = K.btn(K.t("처음으로", "Back to one draw"));
    bar.appendChild(bOne); bar.appendChild(bAuto); bar.appendChild(bReset);
    root.appendChild(bar);

    var s = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 120", role: "img", "aria-label": K.t("뒤집힘 건수의 수직선", "Number line of flip counts") }, root);
    function px(v) { return 20 + (v - X0) / (X1 - X0) * 440; }
    var band = K.svg("rect", { x: 0, y: Y - 22, width: 0, height: 44, rx: 4, fill: "var(--tca-accent)", opacity: 0.12 }, s);
    var med = K.svg("line", { x1: 0, x2: 0, y1: Y - 26, y2: Y + 26, stroke: "var(--tca-accent)", "stroke-width": 2, opacity: 0 }, s);
    var medT = K.svg("text", { x: 0, y: Y - 30, "font-size": 12, "text-anchor": "middle" }, s);
    K.svg("line", { x1: 20, x2: 460, y1: Y, y2: Y, stroke: "var(--tertiary)" }, s);
    for (var v = 15; v <= 55; v += 5) {
      K.svg("line", { x1: px(v), x2: px(v), y1: Y - 4, y2: Y + 4, stroke: "var(--tertiary)" }, s);
      K.svg("text", { x: px(v), y: Y + 20, "font-size": 12, "text-anchor": "middle", "class": "muted" }, s).textContent = String(v);
    }
    K.svg("circle", { cx: px(FIRST), cy: Y, r: 6, fill: "var(--tca-warn)", stroke: "var(--primary)", "stroke-width": 1 }, s);
    K.svg("text", { x: px(FIRST), y: Y + 38, "font-size": 12, "text-anchor": "middle" }, s).textContent = K.t("처음 한 번 21", "first draw 21");
    var dots = SEEDS.map(function () { return K.svg("circle", { cx: -20, cy: -20, r: 5.5, fill: "var(--tca-accent)", opacity: 0 }, s); });
    K.svg("text", { x: 460, y: Y + 38, "font-size": 12, "text-anchor": "end", "class": "muted" }, s).textContent = K.t("뒤집힌 판정 수", "flipped verdicts");

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "21과 여섯 값(28·30·34·35·41·49)은 본문 값이고, 여섯 값이 나오는 순서는 예시다. 띠는 지금까지 나온 씨앗 값의 범위, 세로선은 중앙값이다.",
      "21 and the six values (28, 30, 34, 35, 41, 49) are from the post; the order they appear in is illustrative. The band is the range of seed values so far, the line is the median.")));

    function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
    function render() {
      var got = SEEDS.slice(0, n);
      if (!got.length) {
        band.setAttribute("width", 0); med.setAttribute("opacity", 0); medT.textContent = "";
        read.textContent = K.t("값이 하나뿐이다 — 21. 이 값이 분포의 어디쯤인지 알 수 없다.", "Only one value — 21. No way to tell where it sits in the distribution.");
      } else {
        var lo = Math.min.apply(null, got), hi = Math.max.apply(null, got), m = median(got);
        band.setAttribute("x", px(lo) - 8); band.setAttribute("width", px(hi) - px(lo) + 16);
        med.setAttribute("x1", px(m)); med.setAttribute("x2", px(m)); med.setAttribute("opacity", 1);
        medT.setAttribute("x", px(m)); medT.textContent = K.t("중앙값 ", "median ") + m;
        read.textContent = K.t("씨앗 ", "Seeds ") + n + K.t("개 — 중앙값 ", " — median ") + m + " (" + lo + "~" + hi + ")" +
          (FIRST < lo ? K.t(" · 처음의 21은 이 범위 밖, 낮은 쪽이다", " · the first 21 lies outside, on the low side") : "") +
          (n === SEEDS.length ? K.t(". 보고는 '34.5 (28~49)' 꼴로 한다.", ". Report it as '34.5 (28–49)'.") : "");
      }
      bOne.disabled = n >= SEEDS.length;
      K.press(bAuto, auto);
    }
    function add() {
      if (n >= SEEDS.length) return;
      drops.push({ i: n, y: K.reduce ? Y : 4 });
      dots[n].setAttribute("cx", px(SEEDS[n])); dots[n].setAttribute("opacity", 1);
      n++; render();
    }
    bOne.addEventListener("click", function () { auto = false; add(); });
    bAuto.addEventListener("click", function () { auto = !auto; acc = 0; if (n >= SEEDS.length) { reset(); auto = true; } render(); });
    function reset() {
      n = 0; drops = []; auto = false;
      dots.forEach(function (d) { d.setAttribute("opacity", 0); d.setAttribute("cx", -20); d.setAttribute("cy", -20); });
      render();
    }
    bReset.addEventListener("click", reset);
    K.loop(root, function (dt) {
      if (auto) {
        acc += dt;
        if (acc > 600) { acc = 0; add(); if (n >= SEEDS.length) { auto = false; render(); } }
      }
      drops = drops.filter(function (d) {
        d.y = Math.min(Y, d.y + dt * 0.25);
        dots[d.i].setAttribute("cy", d.y.toFixed(1));
        return d.y < Y;
      });
    });
    render();
  });

  // 그림 2: 표본법으로 줄일 때 기준선을 먼저 찍는 경우와 건너뛰는 경우
  K.register("seed-baseline-gate", function (root) {
    var PLANS = {
      first: [
        { say: K.t("판본마다 200만 건을 돌리면 한 판본에 1시간 25분. 42판본은 불가능하다.", "2 million sentences per version take 1 h 25 min. 42 versions are out of reach."), rows: [] },
        { say: K.t("판정은 점수가 임계를 넘나들 때만 바뀐다. 임계 주변 띠 안의 문장만 고르고, 띠 폭은 기존 전수 결과(뒤집힘 21건)로 검증한다.",
          "A verdict only changes when the score crosses the threshold. Keep sentences inside a band around it, and validate the width on the full run (21 flips)."),
          rows: [["±0.05", 18, 21, "warn"], ["±0.2", 21, 21, "good"]] },
        { say: K.t("여유를 두고 ±0.45를 고른다. 문장이 1,603건으로 줄어 판본당 20초.", "Pick ±0.45 for margin. 1,603 sentences remain, 20 seconds per version."),
          rows: [["±0.05", 18, 21, "warn"], ["±0.2", 21, 21, "good"], ["±0.45", 21, 21, "good"]] },
        { say: K.t("워터마크를 안 심은 원본을 같은 경로로 돌린다. 뒤집힘 0건, 점수 최대차 5e-06 — 전수 기준선과 일치하니 진행한다.",
          "Run the unmarked original through the same path. 0 flips, max score gap 5e-06 — it matches the full baseline, so go on."),
          rows: [[K.t("원본 뒤집힘", "original flips"), 0, 1, "good"]] }
      ],
      skip: [
        { say: K.t("같은 실험을 다른 대상으로 넓히면서 기준선 확인을 건너뛴다.", "Extend the experiment to another target and skip the baseline check."), rows: [] },
        { say: K.t("변경을 100배로 키운 판본과 원래 판본이 거의 같은 값을 낸다. 효과가 없는 것처럼 보인다.", "The 100× version and the original version give almost the same value. It looks like no effect."),
          rows: [[K.t("원래 판본", "original"), 15570, 16000, "accent"], [K.t("100배 판본", "100× version"), 15571, 16000, "accent"]] },
        { say: K.t("기준선을 찍어 보니 원본조차 800문장 중 464건이 저장된 값과 어긋난다. 여기서 멈춘다.", "Taking the baseline: even the original disagrees with stored values on 464 of 800 sentences. Stop here."),
          rows: [[K.t("어긋난 문장", "mismatched"), 464, 800, "bad"]] },
        { say: K.t("원인은 대상마다 기준선을 만든 입력 파일이 달랐는데 하나로 통일해 쓴 것. 고쳐서 다시 돌리니 5건과 531건으로 갈린다. 이제야 변경의 효과다.",
          "Each target's baseline came from a different input file, but one file was used for all. After fixing it, the versions split into 5 and 531 — now that is the effect."),
          rows: [[K.t("원래 판본", "original"), 5, 600, "accent"], [K.t("100배 판본", "100× version"), 531, 600, "accent"]] }
      ]
    };
    var plan = "first", step = 0;
    K.head(root, K.t("표본으로 줄이기 전에 기준선부터", "Baseline before shrinking to a sample"),
      K.t("전수를 표본으로 줄인 실험에서 무처리 기준선을 먼저 찍은 경우와 건너뛴 경우를 단계별로 본다.",
        "Step through the sampled experiment with the untreated baseline taken first, and with it skipped."));
    var bar = K.el("div", "tca-bar");
    var pSeg = K.seg([{ value: "first", label: K.t("기준선 먼저", "Baseline first") }, { value: "skip", label: K.t("기준선 건너뜀", "Baseline skipped") }], plan,
      function (v) { plan = v; step = 0; render(); }, K.t("절차", "Procedure"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bReset = K.btn(K.t("처음으로", "Back to start"));
    bar.appendChild(pSeg.el); bar.appendChild(bNext); bar.appendChild(bReset);
    root.appendChild(bar);
    var read = K.el("div", "", "");
    read.setAttribute("aria-live", "polite");
    read.style.minHeight = "44px";
    root.appendChild(read);
    var rows = K.el("div", "tca-rows");
    rows.style.marginTop = "8px";
    rows.style.setProperty("--tca-lw", "84px");
    rows.style.setProperty("--tca-rw", "84px");
    root.appendChild(rows);
    var cnt = K.el("div", "tca-note", "");
    root.appendChild(cnt);
    root.appendChild(K.el("div", "tca-note", K.t("모든 수치는 본문 값이다. 막대 길이는 단계마다 기준이 다르다(오른쪽 숫자가 실제 값).",
      "All numbers are from the post. Bar scales differ per step (the number on the right is the value).")));

    function render() {
      var P = PLANS[plan][step];
      read.textContent = P.say;
      rows.textContent = "";
      P.rows.forEach(function (r) {
        var row = K.el("div", "tca-row");
        var l = K.el("div", "tca-row-l", r[0]);
        var tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill");
        f.style.background = "var(--tca-" + r[3] + ")";
        f.style.width = Math.max(r[1] ? 1 : 0, r[1] / r[2] * 100) + "%";
        tr.appendChild(f);
        var v = K.el("div", "tca-row-r", K.fmt(r[1]) + (r[2] === 21 || r[2] === 800 ? " / " + r[2] : ""));
        row.appendChild(l); row.appendChild(tr); row.appendChild(v);
        rows.appendChild(row);
      });
      cnt.textContent = K.t("단계 ", "Step ") + step + " / " + (PLANS[plan].length - 1);
      bNext.disabled = step >= PLANS[plan].length - 1;
    }
    bNext.addEventListener("click", function () { if (step < PLANS[plan].length - 1) { step++; render(); } });
    bReset.addEventListener("click", function () { step = 0; render(); });
    render();
  });
})();
