/* 「사전학습 임베딩으로 '유해 방향'을 잡으려 했더니 거꾸로 나왔다」 글의 그림: 같은 투영식이 공간에 따라 뒤집히는 모습 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("sbert-axis", function (root) {
    // 개념 그림용 예시 좌표. [시작 x, 시작 y, 끝 x, 끝 y] — A: SBERT 공간(첫 턴 → 마지막 턴),
    // B: 분류기 [CLS] 공간(세션 전체를 한 벡터로 인코딩하므로 시작 = 끝)
    var ATK = {
      A: [[0.45, 0.80, 0.30, 0.85], [0.55, 0.62, 0.42, 0.68], [0.40, 0.42, 0.30, 0.34], [0.62, 0.25, 0.52, 0.20], [0.35, 0.14, 0.38, 0.22]],
      B: [[0.30, 0.80, 0.30, 0.80], [0.50, 0.84, 0.50, 0.84], [0.68, 0.74, 0.68, 0.74], [0.40, 0.66, 0.40, 0.66], [0.60, 0.62, 0.60, 0.62]]
    };
    var BEN = {
      A: [[0.18, 0.78, 0.48, 0.84], [0.24, 0.58, 0.44, 0.53], [0.30, 0.40, 0.55, 0.45], [0.14, 0.20, 0.25, 0.14], [0.58, 0.32, 0.53, 0.37]],
      B: [[0.26, 0.22, 0.26, 0.22], [0.46, 0.28, 0.46, 0.28], [0.70, 0.30, 0.70, 0.30], [0.36, 0.16, 0.36, 0.16], [0.56, 0.55, 0.56, 0.55]]
    };
    // 앵커(또는 클래스 중심) 위치
    // 분류기 쪽 중심은 B 좌표의 실제 평균으로 정한다
    function mean(set) {
      var x = 0, y = 0;
      set.B.forEach(function (p) { x += p[2]; y += p[3]; });
      return [x / set.B.length, y / set.B.length];
    }
    var ANC = { A: { atk: [0.86, 0.56], ben: [0.14, 0.50] }, B: { atk: mean(ATK), ben: mean(BEN) } };
    var MID = [(ANC.B.atk[0] + ANC.B.ben[0]) / 2, (ANC.B.atk[1] + ANC.B.ben[1]) / 2];
    var ANG = { sbert: Math.atan2(0.06, 0.72), flip: Math.atan2(0.06, 0.72) + Math.PI,
      cls: Math.atan2(ANC.B.atk[1] - ANC.B.ben[1], ANC.B.atk[0] - ANC.B.ben[0]) };
    var mode = "sbert", t = 0, tT = 0, ang = ANG.sbert, angT = ANG.sbert;

    K.head(root, K.t("같은 투영, 다른 공간", "Same projection, different space"),
      K.t("SBERT 방식은 세션의 첫 턴 → 마지막 턴 이동(화살표)을, 분류기 방식은 세션 전체의 [CLS] 벡터(점)를 '유해 방향'에 투영해 점수를 낸다. 아래 줄에서 공격·정상의 순서가 어떻게 바뀌는지 본다.",
        "The SBERT version projects each session's first-to-last-turn shift (arrow) onto the 'harmful direction'; the classifier version projects the whole session's [CLS] vector (dot). Watch the order of attacks and benign on the line below."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "sbert", label: K.t("SBERT 앵커 방향", "SBERT anchor direction") },
      { value: "flip", label: K.t("부호만 뒤집기", "Flip the sign") },
      { value: "cls", label: K.t("분류기 [CLS] 방향", "Classifier [CLS] direction") }
    ], mode, function (v) {
      mode = v; tT = v === "cls" ? 1 : 0; angT = ANG[v];
      if (K.reduce) { t = tT; ang = angT; }
      draw();
    }, K.t("방향", "Direction"));
    bar.appendChild(sg.el);
    root.appendChild(bar);

    var W = 480, H = 210, PX = 70, PW = 340, PY = 8, PH = 180;
    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": K.t("임베딩 평면의 세션 이동과 유해 방향", "Session shifts and harmful direction in the embedding plane") }, root);
    var defs = K.svg("defs", null, sv);
    function marker(id, color) {
      var m = K.svg("marker", { id: id, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, defs);
      K.svg("path", { d: "M0 0 L10 5 L0 10 z", fill: color }, m);
    }
    marker("sbert-ah-a", K.COLORS[2]); marker("sbert-ah-b", K.COLORS[0]); marker("sbert-ah-d", "var(--primary)");
    K.svg("rect", { x: PX, y: PY, width: PW, height: PH, fill: "none", stroke: "var(--tertiary)", rx: 6 }, sv);
    function sx(x) { return PX + x * PW; }
    function sy(y) { return PY + (1 - y) * PH; }
    var axisLabel = K.svg("text", { x: PX + PW / 2, y: H - 4, "font-size": 12, "text-anchor": "middle", "class": "muted" }, sv);
    var dirLine = K.svg("line", { stroke: "var(--primary)", "stroke-width": 2.5, "stroke-dasharray": "6 4", "marker-end": "url(#sbert-ah-d)" }, sv);
    var arrows = [];
    function mk(set, kind) {
      set.A.forEach(function (_, i) {
        var col = kind === "a" ? K.COLORS[2] : K.COLORS[0];
        var ln = K.svg("line", { stroke: col, "stroke-width": 2, "marker-end": "url(#sbert-ah-" + kind + ")" }, sv);
        var st = K.svg("circle", { r: 3, fill: col }, sv);
        arrows.push({ ln: ln, st: st, kind: kind, A: set.A[i], B: set.B[i] });
      });
    }
    mk(ATK, "a"); mk(BEN, "b");
    var ancA = K.svg("rect", { width: 14, height: 14, fill: "none", stroke: K.COLORS[2], "stroke-width": 3 }, sv);
    var ancB = K.svg("rect", { width: 14, height: 14, fill: "none", stroke: K.COLORS[0], "stroke-width": 3 }, sv);
    var ancAt = K.svg("text", { "font-size": 12, "text-anchor": "middle" }, sv);
    var ancBt = K.svg("text", { "font-size": 12, "text-anchor": "middle" }, sv);

    var lg = K.el("div", "tca-legend");
    [[K.COLORS[2], K.t("공격 세션 5", "attack sessions 5")],
      [K.COLORS[0], K.t("정상 세션 5", "benign sessions 5")], ["var(--primary)", K.t("점선 화살표 = 지금 쓰는 '유해 방향'", "dashed arrow = the 'harmful direction' in use")]].forEach(function (x) {
      var s = K.el("span"), i = K.el("i"); i.style.background = x[0]; s.appendChild(i); s.appendChild(document.createTextNode(x[1])); lg.appendChild(s);
    });
    root.appendChild(lg);

    // 투영 점수 줄
    var sv2 = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 74", role: "img",
      "aria-label": K.t("투영 점수 줄", "Projection score line") }, root);
    sv2.style.marginTop = "8px";
    var NX0 = 40, NX1 = 440, NY = 34;
    function nx(v) { return (NX0 + NX1) / 2 + Math.max(-0.5, Math.min(0.5, v)) / 0.5 * (NX1 - NX0) / 2; }
    K.svg("line", { x1: NX0, x2: NX1, y1: NY, y2: NY, stroke: "var(--tertiary)", "stroke-width": 2 }, sv2);
    K.svg("line", { x1: nx(0), x2: nx(0), y1: NY - 14, y2: NY + 14, stroke: "var(--secondary)" }, sv2);
    var nl = K.svg("text", { x: NX0, y: 68, "font-size": 12, "class": "muted" }, sv2);
    nl.textContent = K.t("← 음수(정상 방향)", "← negative (benign)");
    var nr = K.svg("text", { x: NX1, y: 68, "font-size": 12, "text-anchor": "end", "class": "muted" }, sv2);
    nr.textContent = K.t("양수(유해 방향) →", "positive (harmful) →");
    var ticks = arrows.map(function (a, i) {
      var e = a.kind === "a" ? K.svg("rect", { width: 10, height: 10, fill: K.COLORS[2] }, sv2) : K.svg("circle", { r: 5.5, fill: K.COLORS[0] }, sv2);
      return { e: e, a: a, row: (i % 5) };
    });

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "개념 그림이다. 점과 화살표 좌표는 예시 값이고, 두 공간을 한 평면에 겹쳐 그렸다. AUC 0.375(한국어)·0.522(전체)·0.625(뒤집었을 때)는 글 본문 값이며, 분류기 방향의 AUC는 글에 숫자가 없다.",
      "A conceptual sketch: points and arrows are example values, and two different spaces share one plane. AUC 0.375 (Korean), 0.522 (all) and 0.625 (flipped) are from the post; it gives no AUC for the classifier direction.")));

    function lerp(a, b, k) { return a + (b - a) * k; }
    function draw() {
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var pos = 0, benPos = 0;
      arrows.forEach(function (a) {
        var x0 = lerp(a.A[0], a.B[0], t), y0 = lerp(a.A[1], a.B[1], t), x1 = lerp(a.A[2], a.B[2], t), y1 = lerp(a.A[3], a.B[3], t);
        a.ln.setAttribute("x1", sx(x0)); a.ln.setAttribute("y1", sy(y0)); a.ln.setAttribute("x2", sx(x1)); a.ln.setAttribute("y2", sy(y1));
        a.st.setAttribute("cx", sx(x0)); a.st.setAttribute("cy", sy(y0));
        a.ln.setAttribute("marker-end", t < 0.85 ? "url(#sbert-ah-" + a.kind + ")" : "none");
        a.st.setAttribute("r", t < 0.85 ? 3 : 5);
        // 점수: SBERT 쪽은 이동량 투영, 분류기 쪽은 두 클래스 중심의 가운데를 기준으로 한 [CLS] 위치 투영
        var drift = (a.A[2] - a.A[0]) * dx + (a.A[3] - a.A[1]) * dy;
        var place = (a.B[2] - MID[0]) * dx + (a.B[3] - MID[1]) * dy;
        a.score = (1 - t) * drift + t * place;
      });
      ticks.forEach(function (k) {
        var x = nx(k.a.score), y = NY - 12 + k.row * 6;
        if (k.a.kind === "a") { k.e.setAttribute("x", (x - 5).toFixed(1)); k.e.setAttribute("y", (y - 5).toFixed(1)); }
        else { k.e.setAttribute("cx", x.toFixed(1)); k.e.setAttribute("cy", y.toFixed(1)); }
      });
      var ax = lerp(ANC.A.atk[0], ANC.B.atk[0], t), ay = lerp(ANC.A.atk[1], ANC.B.atk[1], t);
      var bx = lerp(ANC.A.ben[0], ANC.B.ben[0], t), by = lerp(ANC.A.ben[1], ANC.B.ben[1], t);
      // 방향 화살표: 두 중심의 가운데를 축으로, 두 중심 사이 길이만큼 그린다(부호를 뒤집으면 반대로 돈다)
      var cx = (ax + bx) / 2, cy = (ay + by) / 2, L = Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)) / 2 * 0.82;
      dirLine.setAttribute("x1", sx(cx - L * dx)); dirLine.setAttribute("y1", sy(cy - L * dy));
      dirLine.setAttribute("x2", sx(cx + L * dx)); dirLine.setAttribute("y2", sy(cy + L * dy));
      ancA.setAttribute("x", sx(ax) - 7); ancA.setAttribute("y", sy(ay) - 7);
      ancB.setAttribute("x", sx(bx) - 7); ancB.setAttribute("y", sy(by) - 7);
      var space = t < 0.5;
      ancAt.textContent = space ? K.t("공격 앵커 평균", "attack anchors") : K.t("공격 세션 중심", "attack centroid");
      ancBt.textContent = space ? K.t("정상 앵커 평균", "benign anchors") : K.t("정상 세션 중심", "benign centroid");
      [[ancAt, ax, ay], [ancBt, bx, by]].forEach(function (q) {
        q[0].setAttribute("text-anchor", space ? "middle" : "start");
        q[0].setAttribute("x", space ? Math.max(40, Math.min(W - 40, sx(q[1]))) : sx(q[1]) + 12);
        q[0].setAttribute("y", space ? sy(q[2]) + 24 : sy(q[2]) + 4);
      });
      axisLabel.textContent = space ? K.t("SBERT 공간: 문체·내용으로 배열 (일상 ← → 노골적)", "SBERT space: arranged by style and content (everyday ← → explicit)")
        : K.t("분류기 [CLS] 공간: 공격/정상을 가르게 학습된 배열", "Classifier [CLS] space: arranged to split attack from benign");
      arrows.forEach(function (a) { if (a.score > 0) { if (a.kind === "a") pos++; else benPos++; } });
      var m = mode === "sbert" ? K.t("공격 세션은 일상 문체로 위장해 음수 쪽, 정상 세션이 오히려 양수 쪽에 놓인다. 글: 한국어 AUC 0.375.",
        "Attack sessions disguised in everyday style land negative; benign ones land positive. Post: Korean AUC 0.375.")
        : mode === "flip" ? K.t("부호를 뒤집으면 순서는 맞아 보인다(글: 0.625). 글의 말로는 방향을 거꾸로 쓴 것이지 신호가 작동하는 것이 아니다. 축은 여전히 문체·내용 축이다.",
          "Flipping the sign makes the order look right (post: 0.625). In the post's words that is using the direction backwards, not a working signal; the axis is still style and content.")
          : K.t("분류기가 공격/정상을 가르게 공간을 다시 배열해서, 클래스 중심의 차이가 곧 유해 방향이 된다. 글: 역상관이 사라졌다.",
            "The classifier rearranged the space to split the classes, so the centroid difference is the harmful direction. Post: the reversal went away.");
      read.textContent = K.t("이 예시에서 + 쪽: 공격 ", "Positive side in this sketch: attack ") + pos + "/5 · " + K.t("정상 ", "benign ") + benPos + "/5. " + m;
    }
    K.loop(root, function (dt) {
      if (t === tT && ang === angT) return;
      var k = dt / 1000;
      t = t < tT ? Math.min(tT, t + k) : Math.max(tT, t - k);
      var da = angT - ang, sp = k * Math.PI;
      ang = Math.abs(da) <= sp ? angT : ang + (da > 0 ? sp : -sp);
      draw();
    });
    draw();
  });
})();
