/* 「작은 모델에게 조건을 한 번에 주면 앞에서부터 놓친다」 글의 그림: 지시를 고친 단계별 통과율, 그리고 거부 샘플링이 빼는 명세 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("small-models-drop-instructions-from-the-front-css",
    '.tca[data-demo="small-stage-steps"] .ss-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;' +
    'white-space:pre-wrap;background:var(--code-bg);border-radius:6px;padding:6px 8px;margin:6px 0 0}' +
    '.tca[data-demo="small-stage-steps"] .ss-list{margin:4px 0 0;padding-left:18px;font-size:13px}' +
    '.tca[data-demo="small-reject-bias"] .rb-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}' +
    '@media (max-width:600px){.tca[data-demo="small-reject-bias"] .rb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '.tca[data-demo="small-reject-bias"] .rb-cells{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:2px;margin:6px 0 4px}' +
    '.tca[data-demo="small-reject-bias"] .rb-cells i{display:block;aspect-ratio:1;border-radius:2px;transition:opacity .25s,transform .25s}' +
    '.tca[data-demo="small-reject-bias"] .rb-cells i.gone{opacity:.12;transform:scale(.6)}' +
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="small-reject-bias"] .rb-cells i{transition:none}}');

  // 1) 단계별 통과율
  K.register("small-stage-steps", function (root) {
    var ST = [
      { name: K.t("출발: 조건을 한 번에", "Start: all conditions at once"), rate: 7 / 24, lab: "7/24 · 29%",
        what: K.t("문서·자리표시자·형식·명세를 한 지시에 모두 넣었다.", "Document, placeholders, format and spec all in one instruction."),
        fail: [[K.t("문서 없이 요청 한 줄만 씀", "Only a one-line request, no document"), 11], [K.t("이름을 자리표시자 없이 직접 씀", "Wrote names without placeholders"), 3],
          [K.t("목록에 없는 자리표시자를 만듦", "Invented placeholders not on the list"), 2], [K.t("대조 문서에 개인정보를 넣음", "Put PII in a no-PII contrast document"), 1]] },
      { name: K.t("1단계: 과제를 하나로", "Step 1: one task"), rate: 0.08, lab: "8%",
        what: K.t("모델은 문서 본문만 쓰고, 요청 문장은 코드가 목록에서 골라 앞에 붙인다.", "The model writes only the document body; code prepends a request picked from a list."),
        fail: [[K.t("목록에 없는 자리표시자를 지어냄 — 12건에서 45종", "Invented placeholders — 45 kinds in 12 outputs"), null]] },
      { name: K.t("2단계: 허용 목록 + 나쁜 예·좋은 예", "Step 2: allow-list + bad/good example"), rate: 0.5, lab: "50%",
        what: K.t("자리표시자는 정해진 16가지뿐이라고 못박고, 실제로 틀린 모양 그대로 나쁜 예를 한 줄 넣었다.", "Fixed the placeholders to 16 kinds and added one bad example in the exact shape of the failure."),
        code: "- 나쁜 예: [[DATE]] [[PROJECT_NAME]] 회의에 [[NAME]] 과장이 [[COUNTRY]] 출장 후 참석\n- 좋은 예: 2026년 3월 14일 ERP 고도화 회의에 [[NAME]] 과장이 베트남 출장 후 참석",
        fail: [[K.t("남은 실패 대부분: 예시 이름을 직접 씀", "Most remaining failures: example names written directly"), null]] },
      { name: K.t("3단계: 예시 이름 금지 + 형식 실수 일부 복구", "Step 3: ban example names + repair some format slips"), rate: 0.71, lab: "71%",
        what: K.t("빠졌던 '이름은 한 명도 직접 쓰지 않는다'를 되돌리고, 뜻이 분명한 형식 실수만 복구했다.", "Restored the dropped 'never write a name directly' line and repaired only unambiguous format slips."),
        code: K.t("복구: [[IP]   →  [[IP]]\n복구: <문서> 로 닫음  →  </문서>\n복구: [[NAME_1]]  →  번호는 # 로\n버림: 닫는 태그가 아예 없음(잘렸을 수 있음)",
          "repair: [[IP]   →  [[IP]]\nrepair: closed with <문서>  →  </문서>\nrepair: [[NAME_1]]  →  number with #\ndrop: no closing tag at all (may be truncated)"),
        fail: [], extra: K.t("이후 정답 검사를 엄격하게 바꾸자 같은 표본이 58%가 됐다. 지시가 아니라 기준이 바뀐 몫이다.",
          "A stricter answer check later put the same sample at 58%; that is the criterion changing, not the instruction.") }
    ];
    var cur = 0;
    K.head(root, K.t("지시를 고친 단계별 통과율", "Pass rate as the instruction was fixed"),
      K.t("한 단계씩 넘기면 무엇을 바꿨고, 통과율이 어떻게 움직였고, 남은 실패가 무엇이었는지가 보인다. 1단계에서 한 번 더 떨어진 것도 그대로 그렸다.",
        "Step through to see what changed, how the pass rate moved and what failures remained. The extra drop at step 1 is drawn as it happened."));
    var bar = K.el("div", "tca-bar");
    var bPrev = K.btn(K.t("← 이전", "← Back")), bNext = K.btn(K.t("다음 단계 →", "Next step →"));
    var lbl = K.el("span", "tca-num");
    bar.appendChild(bPrev); bar.appendChild(bNext); bar.appendChild(lbl);
    root.appendChild(bar);

    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 132", role: "img", "aria-label": K.t("단계별 통과율", "Pass rate by step") }, root);
    var X = function (i) { return 50 + i * 125; }, Y = function (v) { return 110 - v * 96; };
    [0, 0.5, 1].forEach(function (v) {
      K.svg("line", { x1: 30, x2: 470, y1: Y(v), y2: Y(v), stroke: "var(--tertiary)", "stroke-dasharray": v ? "3 4" : null }, sv);
      var t = K.svg("text", { x: 26, y: Y(v) + 4, "font-size": 12, "text-anchor": "end", "class": "muted" }, sv);
      t.textContent = Math.round(v * 100) + "%";
    });
    var pl = K.svg("polyline", { fill: "none", stroke: "var(--tca-accent)", "stroke-width": 2.5 }, sv);
    var pts = ST.map(function (s, i) {
      var c = K.svg("circle", { cx: X(i), cy: Y(s.rate), r: 6, fill: "var(--entry)", stroke: "var(--tca-accent)", "stroke-width": 2.5 }, sv);
      var t = K.svg("text", { x: X(i), y: Y(s.rate) - 11, "font-size": 12, "text-anchor": "middle" }, sv);
      t.textContent = Math.round(s.rate * 100) + "%";
      var u = K.svg("text", { x: X(i), y: 126, "font-size": 12, "text-anchor": "middle", "class": "muted" }, sv);
      u.textContent = i === 0 ? K.t("출발", "start") : K.t(i + "단계", "step " + i);
      return { c: c, t: t };
    });
    var box = K.el("div", "tca-box");
    box.style.marginTop = "8px";
    root.appendChild(box);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t("숫자와 예시 줄은 모두 글 본문 그대로다.", "All numbers and example lines are as in the post.")));

    function render() {
      var s = ST[cur];
      lbl.textContent = (cur + 1) + "/" + ST.length + " · " + s.name;
      bPrev.disabled = cur === 0; bNext.disabled = cur === ST.length - 1;
      pl.setAttribute("points", ST.slice(0, cur + 1).map(function (q, i) { return X(i) + "," + Y(q.rate); }).join(" "));
      pts.forEach(function (p, i) {
        p.c.setAttribute("fill", i === cur ? "var(--tca-accent)" : "var(--entry)");
        p.c.setAttribute("opacity", i <= cur ? 1 : 0.25); p.t.setAttribute("opacity", i <= cur ? 1 : 0.25);
      });
      box.textContent = "";
      box.appendChild(K.el("div", "tca-h", K.t("바꾼 것", "What changed")));
      box.appendChild(K.el("div", null, s.what));
      if (s.code) box.appendChild(K.el("pre", "ss-code", s.code));
      if (s.fail.length) {
        var h = K.el("div", "tca-h", K.t("남은 실패", "Remaining failures")); h.style.marginTop = "8px";
        box.appendChild(h);
        var ul = K.el("ul", "ss-list");
        s.fail.forEach(function (f) { ul.appendChild(K.el("li", null, f[0] + (f[1] != null ? " — " + f[1] + K.t("건", "") : ""))); });
        box.appendChild(ul);
      }
      read.textContent = K.t("통과율 ", "Pass rate ") + s.lab + (s.extra ? " · " + s.extra : "") +
        (cur === 0 ? K.t(" · 24건 중 11건, 절반 가까이가 지시의 첫 조건인 '문서를 붙여넣은 입력'을 놓쳤다.", " · 11 of 24, nearly half, missed the first condition, 'an input with a pasted document'.") : "");
    }
    bPrev.addEventListener("click", function () { if (cur > 0) { cur--; render(); } });
    bNext.addEventListener("click", function () { if (cur < ST.length - 1) { cur++; render(); } });
    render();
  });

  // 2) 거부 샘플링이 빼는 명세
  K.register("small-reject-bias", function (root) {
    var F = [
      { name: K.t("일반 업무 문서", "General business doc"), r: 0.92 },
      { name: K.t("이메일 스레드", "Email thread"), r: 0.94 },
      { name: K.t("로그·설정·코드", "Logs · config · code"), r: 0.86 },
      { name: K.t("표·명단", "Tables · rosters"), r: 0.74 }
    ];
    var PER = 50, on = false, prog = 0, goal = 0;
    K.head(root, K.t("검사를 통과한 것만 남기면", "Keep only what passes the check"),
      K.t("네 형태를 같은 수(50건씩)로 명세했다고 두고, 글의 형태별 통과율로 걸러 본다. 어려운 형태일수록 많이 빠져 남은 데이터의 분포가 명세와 달라진다.",
        "Assume 50 specs per form and filter with the post's per-form pass rates. Harder forms lose more, so what remains no longer matches the spec distribution."));
    var bar = K.el("div", "tca-bar");
    var bRun = K.btn(K.t("거부 샘플링 적용", "Apply rejection sampling"), false);
    bRun.addEventListener("click", function () { on = !on; K.press(bRun, on); goal = on ? 1 : 0; if (K.reduce) prog = goal; draw(); });
    bar.appendChild(bRun);
    root.appendChild(bar);
    var grid = K.el("div", "rb-grid");
    var cards = F.map(function (f, fi) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", f.name));
      var cells = K.el("div", "rb-cells");
      cells.setAttribute("aria-hidden", "true");
      var fail = PER - Math.round(PER * f.r), arr = [];
      for (var i = 0; i < PER; i++) {
        var e = K.el("i");
        e.style.background = K.COLORS[fi];
        cells.appendChild(e); arr.push(e);
      }
      // 빠질 칸을 고르게 흩어 둔다
      var drop = [];
      for (var k = 0; k < fail; k++) drop.push(Math.floor((k + 0.5) * PER / fail));
      b.appendChild(cells);
      var cnt = K.el("div", "tca-num");
      cnt.style.fontSize = "12.5px";
      b.appendChild(cnt);
      grid.appendChild(b);
      return { cells: arr, drop: drop, cnt: cnt, keep: PER - fail };
    });
    root.appendChild(grid);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "104px");
    rows.style.setProperty("--tca-rw", "112px");
    rows.style.marginTop = "12px";
    var shareRows = F.map(function (f, fi) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), fl = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      fl.style.background = K.COLORS[fi];
      tr.appendChild(fl);
      r.appendChild(K.el("div", "tca-row-l", f.name)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: fl, v: v };
    });
    var hd = K.el("div", "tca-h", K.t("전체에서 차지하는 비율 (막대 끝 = 40%)", "Share of the whole (bar end = 40%)"));
    hd.style.marginTop = "12px";
    root.appendChild(hd);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "형태별 통과율(92·94·86·74%)은 글 본문 값이다. 형태마다 50건씩 같은 수로 명세했다는 것은 예시 가정이다.",
      "Per-form pass rates (92, 94, 86, 74%) are from the post. Equal specs of 50 per form is an example assumption.")));

    function draw() {
      var total = 0, left = [];
      cards.forEach(function (c) {
        var gone = Math.round(c.drop.length * prog);
        c.cells.forEach(function (e) { e.className = ""; });
        for (var k = 0; k < gone; k++) c.cells[c.drop[k]].className = "gone";
        var n = PER - gone;
        left.push(n); total += n;
        c.cnt.textContent = n + "/" + PER + (prog >= 1 ? K.t(" 통과", " pass") : "");
      });
      cards.forEach(function (c, i) {
        var share = left[i] / total;
        shareRows[i].f.style.width = Math.min(100, share / 0.4 * 100) + "%";
        shareRows[i].v.textContent = K.t("명세 25% → ", "spec 25% → ") + (share * 100).toFixed(1) + "%";
      });
      read.textContent = prog >= 1
        ? K.t("남은 " + total + "건에서 표·명단은 25% → " + (left[3] / total * 100).toFixed(1) + "%로 줄었다. 통과율만 보면 안 보이는 쏠림이라, 명세 분포와 통과 분포를 나란히 적어 둔다.",
          "Of the " + total + " left, tables fall from 25% to " + (left[3] / total * 100).toFixed(1) + "%. The pass rate alone hides this skew, so the spec and pass distributions are recorded side by side.")
        : K.t("거부 샘플링 전: 네 형태가 25%씩이다.", "Before rejection sampling: 25% each.");
    }
    K.loop(root, function (dt) {
      if (prog === goal) return;
      var sp = dt / 1400;
      prog = prog < goal ? Math.min(goal, prog + sp) : Math.max(goal, prog - sp);
      draw();
    });
    draw();
  });
})();
