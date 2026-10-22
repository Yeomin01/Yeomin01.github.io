/* 「ASL 이 유해콘텐츠엔 통했는데 PII NER 엔 안 되는 이유」 글의 그림: ASL 손실 모양, sigmoid 와 softmax 의 칸 간섭 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  function small(v) {
    if (v === 0) return "0";
    if (Math.abs(v) < 0.001) return v.toExponential(1);
    return v.toFixed(3);
  }
  function pct(a, b) {
    if (!(b > 0)) return "–";
    var r = a / b * 100;
    if (r >= 1) return r.toFixed(1) + "%";
    if (r >= 0.01) return r.toFixed(2) + "%";
    return "<0.01%";
  }
  // 음성 칸(y=0): q = max(p - m, 0), L = -q^γ log(1 - q). γ=0, m=0 이면 BCE 와 같다.
  function lossNeg(p, g, m) {
    var q = Math.max(p - m, 0);
    return q === 0 ? 0 : -Math.pow(q, g) * Math.log(1 - q);
  }
  // 로짓 z 에 대한 기울기 크기: dL/dq · dp/dz, dp/dz = p(1 - p)
  function gradNeg(p, g, m) {
    var q = Math.max(p - m, 0);
    if (q === 0) return 0;
    var a = Math.pow(q, g) / (1 - q);
    var b = g === 0 ? 0 : -g * Math.pow(q, g - 1) * Math.log(1 - q);
    return p * (1 - p) * (a + b);
  }
  // 양성 칸(y=1): L = -(1 - p)^γ log p
  function lossPos(p, g) { return -Math.pow(1 - p, g) * Math.log(p); }
  function gradPos(p, g) { return Math.pow(1 - p, g + 1) - g * p * Math.pow(1 - p, g) * Math.log(p); }

  K.register("asl-loss-curve", function (root) {
    var st = { y: 0, gNeg: 4, gPos: 1, m: 0.05, p: 0.1, view: "loss" };
    K.head(root, K.t("칸 하나의 손실 — BCE 와 ASL", "One label's loss — BCE vs ASL"),
      K.t("sigmoid 칸 하나가 확률 p 를 냈을 때의 손실이다. γ 와 clip 을 움직이면 쉬운 예(음성 칸에서 p 가 작을 때, 양성 칸에서 p 가 클 때)의 기여가 얼마나 줄어드는지 보인다.",
        "The loss of a single sigmoid label that predicts probability p. Move γ and clip to see how much the easy cases (small p on a negative, large p on a positive) are turned down."));

    var bar1 = K.el("div", "tca-bar");
    var segY = K.seg([{ value: 0, label: K.t("음성 칸 (정답 0)", "Negative (y=0)") }, { value: 1, label: K.t("양성 칸 (정답 1)", "Positive (y=1)") }],
      0, function (v) { st.y = v; st.p = v === 0 ? 0.1 : 0.9; sP.set(st.p); render(); }, K.t("정답", "Target"));
    var segV = K.seg([{ value: "loss", label: K.t("손실", "Loss") }, { value: "grad", label: K.t("기울기", "Gradient") }],
      "loss", function (v) { st.view = v; render(); }, K.t("보기", "View"));
    bar1.appendChild(segY.el); bar1.appendChild(segV.el);
    root.appendChild(bar1);

    var bar2 = K.el("div", "tca-bar");
    var sP = K.slider({ label: "p", min: 0.01, max: 0.99, step: 0.01, value: st.p,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.p = v; render(); } });
    var sGn = K.slider({ label: "γ⁻", min: 0, max: 4, step: 0.5, value: st.gNeg,
      fmt: function (v) { return v.toFixed(1); }, onInput: function (v) { st.gNeg = v; render(); } });
    var sGp = K.slider({ label: "γ⁺", min: 0, max: 4, step: 0.5, value: st.gPos,
      fmt: function (v) { return v.toFixed(1); }, onInput: function (v) { st.gPos = v; render(); } });
    var sM = K.slider({ label: "clip", min: 0, max: 0.2, step: 0.01, value: st.m,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.m = v; render(); } });
    bar2.appendChild(sP.el); bar2.appendChild(sGn.el); bar2.appendChild(sGp.el); bar2.appendChild(sM.el);
    root.appendChild(bar2);

    var W = 460, H = 214, X0 = 46, X1 = 446, Y0 = 12, Y1 = 180;
    var svg = K.svg("svg", { viewBox: "0 0 " + W + " " + H, class: "tca-svg", role: "img",
      "aria-label": K.t("예측 확률 p 에 따른 BCE 와 ASL 의 손실 곡선", "BCE and ASL loss against predicted probability p") });
    function px(p) { return X0 + (X1 - X0) * p; }
    var ymax = 3;
    function py(v) { return Y1 - (Y1 - Y0) * v / ymax; }
    var band = K.svg("rect", { x: px(0), y: Y0, width: 0, height: Y1 - Y0, fill: "var(--code-bg)" }, svg);
    var bandTxt = K.svg("text", { x: px(0) + 3, y: Y0 + 14, "font-size": 12, class: "muted" }, svg);
    var grid = K.svg("g", null, svg);
    K.svg("line", { x1: X0, y1: Y1, x2: X1, y2: Y1, stroke: "var(--tertiary)" }, svg);
    K.svg("line", { x1: X0, y1: Y0, x2: X0, y2: Y1, stroke: "var(--tertiary)" }, svg);
    [0, 0.5, 1].forEach(function (p) {
      var t = K.svg("text", { x: px(p), y: Y1 + 16, "font-size": 12, "text-anchor": "middle", class: "muted" }, svg);
      t.textContent = String(p);
    });
    var xl = K.svg("text", { x: (X0 + X1) / 2, y: Y1 + 31, "font-size": 12, "text-anchor": "middle", class: "muted" }, svg);
    xl.textContent = K.t("p (모델이 낸 확률)", "p (predicted probability)");
    var yl = K.svg("text", { x: X0 + 4, y: Y0 - 1, "font-size": 12, class: "muted" }, svg);
    var pB = K.svg("path", { fill: "none", stroke: "var(--secondary)", "stroke-width": 2, "stroke-dasharray": "5 4" }, svg);
    var pA = K.svg("path", { fill: "none", stroke: "var(--tca-accent)", "stroke-width": 2.5 }, svg);
    var mk = K.svg("line", { y1: Y0, y2: Y1, stroke: "var(--primary)", "stroke-width": 1, "stroke-dasharray": "2 3" }, svg);
    var dB = K.svg("circle", { r: 4.5, fill: "var(--secondary)" }, svg);
    var dA = K.svg("circle", { r: 5, fill: "var(--tca-accent)" }, svg);
    root.appendChild(svg);

    var lg = K.el("div", "tca-legend");
    var l1 = K.el("span"); var i1 = K.el("i"); i1.style.background = "var(--secondary)"; l1.appendChild(i1);
    l1.appendChild(document.createTextNode(K.t("BCE (기본, 점선)", "BCE (baseline, dashed)")));
    var l2 = K.el("span"); var i2 = K.el("i"); i2.style.background = "var(--tca-accent)"; l2.appendChild(i2);
    l2.appendChild(document.createTextNode("ASL"));
    lg.appendChild(l1); lg.appendChild(l2);
    root.appendChild(lg);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "γ·clip 의 처음 값은 예시 값이다(글에는 수치가 없다). γ 와 clip 을 0 으로 두면 ASL 은 BCE 와 같아진다. 기울기는 로짓에 대한 크기 |∂L/∂z| 이고, 그래프 위쪽은 잘라서 그렸다.",
      "Starting γ and clip are example values (the post gives none). With γ and clip at 0, ASL equals BCE. Gradient is |∂L/∂z| with respect to the logit; the top of the plot is cut off.")));

    function pathFor(f) {
      var d = "", pen = false, prevOver = false, N = 160;
      for (var i = 0; i <= N; i++) {
        var p = 0.002 + 0.996 * i / N;
        var v = f(p);
        var over = !(v <= ymax);
        var x = px(p).toFixed(1);
        if (over) {
          if (pen) { d += "L" + x + " " + py(ymax).toFixed(1); pen = false; }
          prevOver = true;
          continue;
        }
        var y = py(Math.max(0, v)).toFixed(1);
        if (!pen) { d += (prevOver ? "M" + x + " " + py(ymax).toFixed(1) + "L" : "M") + x + " " + y; pen = true; }
        else d += "L" + x + " " + y;
        prevOver = false;
      }
      return d;
    }
    function render() {
      var neg = st.y === 0, grad = st.view === "grad";
      sGn.el.style.display = neg ? "" : "none";
      sGp.el.style.display = neg ? "none" : "";
      sM.input.disabled = !neg;
      ymax = grad ? 1 : 3;
      var fB, fA;
      if (neg) {
        fB = grad ? function (p) { return p; } : function (p) { return -Math.log(1 - p); };
        fA = grad ? function (p) { return gradNeg(p, st.gNeg, st.m); } : function (p) { return lossNeg(p, st.gNeg, st.m); };
      } else {
        fB = grad ? function (p) { return 1 - p; } : function (p) { return -Math.log(p); };
        fA = grad ? function (p) { return gradPos(p, st.gPos); } : function (p) { return lossPos(p, st.gPos); };
      }
      grid.textContent = "";
      var ticks = grad ? [0, 0.5, 1] : [0, 1, 2, 3];
      ticks.forEach(function (v) {
        if (v > 0) K.svg("line", { x1: X0, y1: py(v), x2: X1, y2: py(v), stroke: "var(--tertiary)", "stroke-dasharray": "2 4" }, grid);
        var t = K.svg("text", { x: X0 - 6, y: py(v) + 4, "font-size": 12, "text-anchor": "end", class: "muted" }, grid);
        t.textContent = String(v);
      });
      yl.textContent = grad ? K.t("|기울기|", "|gradient|") : K.t("손실", "loss");
      var showBand = neg && st.m > 0;
      band.setAttribute("width", showBand ? (px(st.m) - px(0)).toFixed(1) : 0);
      bandTxt.textContent = showBand && st.m >= 0.05 ? "clip" : "";
      pB.setAttribute("d", pathFor(fB));
      pA.setAttribute("d", pathFor(fA));
      var p = st.p, vb = fB(p), va = fA(p);
      mk.setAttribute("x1", px(p)); mk.setAttribute("x2", px(p));
      dB.setAttribute("cx", px(p)); dB.setAttribute("cy", py(Math.min(ymax, vb)));
      dA.setAttribute("cx", px(p)); dA.setAttribute("cy", py(Math.min(ymax, va)));
      var kind = neg ? (p < 0.5 ? K.t("쉬운 음성", "easy negative") : K.t("어려운 음성", "hard negative"))
        : (p > 0.5 ? K.t("쉬운 양성", "easy positive") : K.t("어려운 양성", "hard positive"));
      var what = grad ? K.t("|기울기|", "|gradient|") : K.t("손실", "loss");
      var tail = (neg && va === 0) ? K.t(" (p ≤ clip 이라 아예 무시된다)", " (p ≤ clip, ignored entirely)")
        : K.t(" → BCE 의 ", " → ") + pct(va, vb) + K.t("", " of BCE");
      read.textContent = "p = " + p.toFixed(2) + " (" + kind + ") · " + what + " BCE " + small(vb) + " · ASL " + small(va) + tail;
    }
    render();
  });

  K.register("asl-softmax-couple", function (root) {
    var SIG = [{ n: "CENSURE", z: -1 }, { n: "DISCRIMINATION", z: -2 }, { n: "SEXUAL", z: -2.5 },
      { n: "ABUSE", z: -1.5 }, { n: "VIOLENCE", z: -2 }, { n: "CRIME", z: -3 }];
    var SM = [{ n: "O", z: 5 }, { n: "B-NAME", z: 1 }, { n: "I-NAME", z: 0.5 }, { n: "B-PHONE", z: 0.5 }, { n: "I-PHONE", z: 0 }];
    var REST = 28, REST_Z = -1;
    var st = { d: 0, target: 1 };

    K.head(root, K.t("한 칸을 움직이면 나머지는 — sigmoid 와 softmax", "Move one label — sigmoid vs softmax"),
      K.t("왼쪽은 유해콘텐츠 6 라벨(각각 sigmoid), 오른쪽은 PII NER 한 토큰의 33 라벨(softmax)이다. 고른 칸의 로짓을 올리거나 내리면 나머지 칸이 어떻게 되는지 보인다.",
        "Left: the six toxicity labels, each its own sigmoid. Right: the 33 labels of one PII NER token under a softmax. Raise or lower one logit and watch the other labels."));

    var bar = K.el("div", "tca-bar");
    var sD = K.slider({ label: K.t("고른 칸의 로짓 변화", "Logit change"), min: -4, max: 4, step: 0.5, value: 0,
      fmt: function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1); },
      onInput: function (v) { st.d = v; render(); } });
    var segT = K.seg([{ value: 1, label: K.t("오른쪽: B-NAME 을", "Right: B-NAME") }, { value: 0, label: K.t("오른쪽: O 를", "Right: O") }],
      1, function (v) { st.target = v; render(); }, K.t("오른쪽에서 움직일 칸", "Label to move on the right"));
    var bReset = K.btn(K.t("처음 값으로", "Reset"));
    bar.appendChild(sD.el); bar.appendChild(segT.el); bar.appendChild(bReset);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    function panel(title) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", title));
      var rows = K.el("div", "tca-rows");
      rows.style.setProperty("--tca-lw", "104px");
      rows.style.setProperty("--tca-rw", "48px");
      b.appendChild(rows);
      var r = K.el("div", "tca-note");
      r.setAttribute("aria-live", "polite");
      b.appendChild(r);
      two.appendChild(b);
      return { rows: rows, read: r };
    }
    function row(rows, label) {
      var r = K.el("div", "tca-row");
      var l = K.el("div", "tca-row-l", label);
      var tr = K.el("div", "tca-track");
      var f = K.el("div", "tca-fill");
      tr.appendChild(f);
      var v = K.el("div", "tca-row-r");
      r.appendChild(l); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { l: l, f: f, v: v };
    }
    var L = panel(K.t("유해콘텐츠 — 6 sigmoid (칸별 독립)", "Toxicity — 6 sigmoids (independent)"));
    var R = panel(K.t("PII NER — 33-class softmax (합이 1)", "PII NER — 33-class softmax (sums to 1)"));
    var lRows = SIG.map(function (s) { return row(L.rows, s.n); });
    var lSum = row(L.rows, K.t("6칸 합", "Sum of 6"));
    var rRows = SM.map(function (s) { return row(R.rows, s.n); });
    var rRest = row(R.rows, K.t("그 밖 28칸 합", "Other 28 (sum)"));
    var rSum = row(R.rows, K.t("33칸 합", "Sum of 33"));
    root.appendChild(two);
    root.appendChild(K.el("div", "tca-note", K.t(
      "로짓과 확률은 예시 값이다. 왼쪽은 언제나 CENSURE 를 움직인다. 오른쪽의 나머지 28 라벨은 한 줄로 합쳐 그렸다. 합 막대는 0~1 구간만 그린다.",
      "Logits and probabilities are example values. The left side always moves CENSURE. The remaining 28 labels on the right are drawn as one summed row. Sum bars show only 0 to 1.")));

    function sig(z) { return 1 / (1 + Math.exp(-z)); }
    function soft(d, t) {
      var ex = SM.map(function (s, i) { return Math.exp(s.z + (i === t ? d : 0)); });
      var rest = REST * Math.exp(REST_Z);
      var tot = rest + ex.reduce(function (a, b) { return a + b; }, 0);
      return { p: ex.map(function (e) { return e / tot; }), rest: rest / tot };
    }
    function w(v) { return Math.max(0, Math.min(1, v)) * 100 + "%"; }
    function render() {
      var d = st.d, t = st.target;
      var s0 = SIG.map(function (s) { return sig(s.z); });
      var s1 = SIG.map(function (s, i) { return sig(s.z + (i === 0 ? d : 0)); });
      var sum = 0;
      lRows.forEach(function (r, i) {
        r.f.style.width = w(s1[i]);
        r.f.style.background = i === 0 ? "var(--tca-accent)" : "var(--secondary)";
        r.v.textContent = s1[i].toFixed(3);
        sum += s1[i];
      });
      lSum.f.style.width = w(sum); lSum.f.style.background = "var(--tca-warn)"; lSum.v.textContent = sum.toFixed(3);
      L.read.textContent = d === 0 ? K.t("CENSURE 를 움직여도 다른 5칸의 확률은 그대로다.", "Moving CENSURE leaves the other five unchanged.")
        : "CENSURE " + s0[0].toFixed(3) + " → " + s1[0].toFixed(3) + K.t(" · 다른 5칸 변화 0 · 합은 1일 필요가 없다", " · other five change 0 · the sum need not be 1");

      var a = soft(0, t), b = soft(d, t);
      rRows.forEach(function (r, i) {
        r.f.style.width = w(b.p[i]);
        r.f.style.background = i === t ? "var(--tca-accent)" : "var(--secondary)";
        r.v.textContent = b.p[i].toFixed(3);
      });
      rRest.f.style.width = w(b.rest); rRest.f.style.background = "var(--secondary)"; rRest.v.textContent = b.rest.toFixed(3);
      var tot = b.rest + b.p.reduce(function (x, y) { return x + y; }, 0);
      rSum.f.style.width = w(tot); rSum.f.style.background = "var(--tca-warn)"; rSum.v.textContent = tot.toFixed(3);
      var oa = 1 - a.p[t], ob = 1 - b.p[t];
      var name = SM[t].n;
      var dir = d > 0 ? K.t(" — 32칸이 모두 같은 비율로 줄었다", " — all 32 shrank by the same factor")
        : d < 0 ? K.t(" — 32칸이 모두 같은 비율로 늘었다. 어느 라벨로 갈지는 고를 수 없다", " — all 32 grew by the same factor; which label gains cannot be chosen") : "";
      R.read.textContent = name + " " + a.p[t].toFixed(3) + " → " + b.p[t].toFixed(3) +
        K.t(" · 나머지 32칸 합 ", " · other 32 sum ") + oa.toFixed(3) + " → " + ob.toFixed(3) + dir;
    }
    bReset.addEventListener("click", function () { st.d = 0; sD.set(0); render(); });
    render();
  });
})();
