/* 「이름은 가르쳤지만, 그 이름이 있을 자리는 안 가르쳤다」 글의 그림: 캐리어 고정 증강의 위치 편중, 문장 옮기기 실험 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("taught-the-name-not-its-position-css", [
    '.tca[data-demo="taught-carrier-fill"] .tn-sent{font-size:14px;min-height:28px;margin:0 0 6px}',
    '.tca[data-demo="taught-carrier-fill"] .tn-name{display:inline-block;padding:0 6px;border-radius:4px;',
    'background:var(--tca-accent);color:var(--theme);font-weight:600}',
    '.tca[data-demo="taught-carrier-fill"] .tn-strip{position:relative;height:18px;background:var(--code-bg);border-radius:3px;margin:0 0 4px}',
    '.tca[data-demo="taught-carrier-fill"] .tn-strip i{position:absolute;top:0;bottom:0;border-left:1px dashed var(--tertiary)}',
    '.tca[data-demo="taught-carrier-fill"] .tn-mark{position:absolute;top:2px;bottom:2px;width:12px;margin-left:-6px;border-radius:3px;',
    'background:var(--tca-accent);transition:left .25s ease}',
    '.tca[data-demo="taught-carrier-fill"] .tn-ax{display:flex;justify-content:space-between;font-size:12px;color:var(--secondary);margin:0 0 10px}',
    '.tca[data-demo="taught-move-sentence"] .tn-doc{display:flex;flex-wrap:wrap;gap:5px;border:1px solid var(--tertiary);',
    'border-radius:6px;padding:8px;min-height:60px;margin:0 0 10px}',
    '.tca[data-demo="taught-move-sentence"] .tn-p{display:inline-flex;align-items:center;gap:4px;height:22px;border-radius:4px;',
    'background:var(--code-bg);padding:0 6px;font-size:12px;color:var(--secondary)}',
    '.tca[data-demo="taught-move-sentence"] .tn-p.nm{background:var(--tca-accent);color:var(--theme);font-weight:600}',
    '.tca[data-demo="taught-move-sentence"] .tn-p b{font-weight:600;font-size:11.5px;padding:0 5px;border-radius:8px;',
    'background:var(--tca-warn);color:#111}',
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="taught-carrier-fill"] .tn-mark{transition:none}}'
  ].join(""));

  var BINS = [K.t("앞 25%", "First 25%"), "25~50%", "50~75%", K.t("뒤 25%", "Last 25%")];

  /* 그림 1: 캐리어를 고정하고 이름만 갈아 끼우면 이름 자리가 그대로 반복된다 */
  K.register("taught-carrier-fill", function (root) {
    // 예시 캐리어. {N} 자리에 이름 목록의 이름이 들어간다.
    var CARRIERS = [
      K.t("{N} 고객님 문의 접수했습니다.", "{N}, your inquiry has been received."),
      K.t("{N} 님, 요청하신 내용 안내드립니다.", "{N}, here is the information you asked for."),
      K.t("고객 {N} 님 상담 기록입니다.", "Dear {N}, consultation record attached."),
      K.t("담당자 {N} 확인 부탁드립니다.", "Hi {N}, please confirm the details."),
      K.t("{N} 고객 주소 변경 요청 건", "{N}: address change request"),
      K.t("안녕하세요, {N} 님. 예약 확인차 연락드렸습니다.", "Hello {N}, calling to confirm your booking."),
      K.t("{N} 님께 회신 부탁드립니다.", "Please reply to {N}."),
      K.t("오늘 상담 요약: 요금제 변경 문의, 고객 {N}", "Today's summary: plan change inquiry, customer {N}")
    ];
    var NAME_LEN = 3;
    function relPos(c) {
      // 이름 스팬이 시작하는 글자의 상대 위치
      return c.indexOf("{N}") / (c.length - 3 + NAME_LEN);
    }
    var seed = 9;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

    var mode = "fixed", playing = !K.reduce, acc = 0, n = 0, counts = [0, 0, 0, 0], nameNo = 0;

    K.head(root, K.t("이름만 갈아 끼우면 자리는 그대로다", "Swap only the name and the slot stays put"),
      K.t("증강 표본이 하나씩 쌓이며 이름이 문서의 어느 구간에 놓였는지 센다. 캐리어를 고정하면 이름은 바뀌어도 앞 구간만 채워진다.",
        "Augmented samples pile up and each name's relative position is counted. With fixed carriers the names change but only the front bin fills."));

    var bar = K.el("div", "tca-bar");
    var segMode = K.seg([
      { value: "fixed", label: K.t("캐리어 고정, 이름만 교체", "Fixed carriers, swap names") },
      { value: "mixed", label: K.t("문서와 자리도 섞기", "Vary document and slot") }
    ], mode, function (v) { mode = v; reset(); }, K.t("증강 방식", "Augmentation"));
    var bPlay = K.btn(playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"), playing);
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(segMode.el); bar.appendChild(bPlay); bar.appendChild(bReset);
    root.appendChild(bar);

    var sent = K.el("div", "tn-sent");
    var strip = K.el("div", "tn-strip");
    [25, 50, 75].forEach(function (p) { var t = K.el("i"); t.style.left = p + "%"; strip.appendChild(t); });
    var mark = K.el("div", "tn-mark");
    strip.appendChild(mark);
    var ax = K.el("div", "tn-ax");
    ax.appendChild(K.el("span", null, K.t("문서 시작", "start"))); ax.appendChild(K.el("span", null, K.t("문서 끝", "end")));
    root.appendChild(sent); root.appendChild(strip); root.appendChild(ax);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "70px");
    rows.style.setProperty("--tca-rw", "96px");
    var rs = BINS.map(function (b) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      tr.appendChild(f); r.appendChild(K.el("div", "tca-row-l", b)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v };
    });
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "캐리어 8개와 섞기 방식(자리가 고르게 퍼진다고 둠)은 예시다. 글의 실측 앞 25% 비중은 직접 만든 증강 87%·88%, 합성·증강 84~98%, 상담 기록 57%다.",
      "The eight carriers and the mixed mode (slots spread evenly) are illustrative. Measured front-25% shares in the post: my augmentation 87% and 88%, synthetic/augmented 84–98%, consultation logs 57%.")));

    function bin(p) { return Math.min(3, Math.floor(p * 4)); }
    function sample() {
      var p;
      nameNo++;
      var nm = K.t("이름 ", "Name ") + nameNo;
      sent.textContent = "";
      if (mode === "fixed") {
        var c = CARRIERS[Math.floor(rnd() * CARRIERS.length)], parts = c.split("{N}");
        p = relPos(c);
        sent.appendChild(document.createTextNode(parts[0]));
        var chip = K.el("span", "tn-name tca-pop", nm);
        sent.appendChild(chip);
        sent.appendChild(document.createTextNode(parts[1]));
      } else {
        p = rnd();
        var len = 80 + Math.floor(rnd() * 400);
        sent.appendChild(document.createTextNode(K.t("문서 " + len + "자 · " + Math.round(p * 100) + "% 지점 문장에 ",
          "A " + len + "-char document, sentence at " + Math.round(p * 100) + "%: ")));
        sent.appendChild(K.el("span", "tn-name tca-pop", nm));
      }
      mark.style.left = (p * 100).toFixed(1) + "%";
      counts[bin(p)]++; n++;
      draw();
    }
    function draw() {
      rs.forEach(function (r, i) {
        var share = n ? counts[i] / n : 0;
        r.f.style.width = (share * 100).toFixed(1) + "%";
        r.v.textContent = K.fmt(counts[i]) + K.t("건 · ", " · ") + (share * 100).toFixed(0) + "%";
      });
      read.textContent = n
        ? K.t("표본 ", "Samples ") + K.fmt(n) + K.t(" · 앞 25% 비중 ", " · front-25% share ") + (counts[0] / n * 100).toFixed(1) + "%"
        : K.t("재생을 누르면 표본이 쌓인다.", "Press play to add samples.");
    }
    function reset() {
      seed = 9; n = 0; nameNo = 0; counts = [0, 0, 0, 0]; acc = 0;
      sent.textContent = ""; mark.style.left = "0%";
      if (K.reduce) for (var i = 0; i < 200; i++) sample();
      draw();
    }
    bPlay.addEventListener("click", function () {
      playing = !playing; K.press(bPlay, playing);
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play");
    });
    bReset.addEventListener("click", reset);
    K.loop(root, function (dt) {
      if (!playing) return;
      if (n >= 400) { playing = false; K.press(bPlay, false); bPlay.textContent = K.t("재생", "Play"); return; }
      acc += dt;
      var gap = n < 12 ? 450 : 90;
      while (acc >= gap && n < 400) { acc -= gap; sample(); }
    });
    reset();
  });

  /* 그림 2: 같은 문서에서 이름이 든 문장만 옮기기 */
  K.register("taught-move-sentence", function (root) {
    // 탐지율·평균 길이는 본문 표의 값
    var REAL = [
      { v: "orig", label: K.t("원문 그대로", "As is"), at: 3, det: 0.0, len: 291, note: K.t("원문에서는 전 사례 미탐이다.", "Missed in every case in the original.") },
      { v: "rebuild", label: K.t("제자리 재조립", "Reassembled in place"), at: 3, det: 0.0, len: 292, note: K.t("같은 절차로 제자리에 넣어도 0%라서, 분리·재결합 절차가 만든 아티팩트가 아니다.", "Still 0% when reassembled in place, so the split-and-join step is not the cause.") },
      { v: "front", label: K.t("맨 앞으로", "To the front"), at: 0, det: 50.0, len: 291, note: K.t("문서 앞 경계로 옮기자 0%가 50%가 된다.", "Moving it to the front boundary turns 0% into 50%.") },
      { v: "back", label: K.t("맨 뒤로", "To the end"), at: 6, det: 39.5, len: 291, note: K.t("뒤 경계로 옮겨도 39.5%가 된다.", "The end boundary gives 39.5%.") },
      { v: "alone", label: K.t("이름 든 문장만", "Name sentence only"), at: -1, det: 87.2, len: 48, note: K.t("주변 문장을 모두 빼면 87.2%까지 오른다.", "With every other sentence removed it rises to 87.2%.") }
    ];
    var NEUTRAL_AT = [0, 2, 5, 7, 10];
    var ctx = "real", vReal = "orig", vNeu = 0;
    // 실제 문서의 문장 6개와 그 안의 다른 개인정보 표시 개수(예시)
    var REAL_SENT = [{ w: 30, pii: 1 }, { w: 22, pii: 2 }, { w: 36, pii: 0 }, { w: 26, pii: 1 }, { w: 40, pii: 2 }, { w: 24, pii: 1 }];
    var NEU_SENT = [34, 26, 40, 22, 30, 38, 24, 32, 28, 36];

    K.head(root, K.t("이름이 든 문장만 옮겨 보기", "Move only the sentence with the name"),
      K.t("같은 문서·같은 길이에서 이름이 든 문장의 자리만 바꾼 실험이다. 실제 미탐 문서와 개인정보가 없는 중립 텍스트를 비교한다.",
        "Same document and length; only the position of the name's sentence changes. Compare a real missed document with neutral text that has no personal data."));

    var bar1 = K.el("div", "tca-bar");
    var segCtx = K.seg([
      { value: "real", label: K.t("실제 미탐 문서", "Real missed document") },
      { value: "neu", label: K.t("중립 텍스트 480자", "Neutral text, 480 chars") }
    ], ctx, function (v) { ctx = v; render(true); }, K.t("문맥", "Context"));
    bar1.appendChild(segCtx.el);
    var bar2 = K.el("div", "tca-bar");
    var segReal = K.seg(REAL.map(function (r) { return { value: r.v, label: r.label }; }), vReal,
      function (v) { vReal = v; render(true); }, K.t("변형", "Variant"));
    var segNeu = K.seg(NEUTRAL_AT.map(function (a, i) { return { value: i, label: K.t("위치 ", "Pos ") + (i + 1) }; }), vNeu,
      function (v) { vNeu = v; render(true); }, K.t("삽입 위치", "Insert position"));
    bar2.appendChild(segReal.el); bar2.appendChild(segNeu.el);
    root.appendChild(bar1); root.appendChild(bar2);

    var doc = K.el("div", "tn-doc");
    root.appendChild(doc);
    var nm = K.el("span", "tn-p nm", K.t("이름이 든 문장", "Sentence with the name"));
    nm.style.width = "46%";
    var realPills = REAL_SENT.map(function (s) {
      var p = K.el("span", "tn-p");
      p.style.width = s.w + "%";
      for (var i = 0; i < s.pii; i++) p.appendChild(K.el("b", null, K.t("개인정보", "PII")));
      return p;
    });
    var neuPills = NEU_SENT.map(function (w) { var p = K.el("span", "tn-p"); p.style.width = w + "%"; return p; });

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "64px");
    rows.style.setProperty("--tca-rw", "56px");
    var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), fill = K.el("div", "tca-fill"), val = K.el("div", "tca-row-r");
    fill.style.background = "var(--tca-good)";
    tr.appendChild(fill); r.appendChild(K.el("div", "tca-row-l", K.t("탐지율", "Detected"))); r.appendChild(tr); r.appendChild(val);
    rows.appendChild(r);
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "탐지율과 길이는 본문 값이다. 문장 수, 개인정보 표시 개수, 원문에서 이름 문장의 자리(가운데), 중립 텍스트의 다섯 위치 간격은 그림용 예시다.",
      "Detection rates and lengths are from the post. Sentence counts, PII markers, the original slot (middle) and the spacing of the five neutral positions are illustrative.")));

    function render(animate) {
      var first = animate && !K.reduce && nm.parentNode ? nm.getBoundingClientRect() : null;
      segReal.el.style.display = ctx === "real" ? "" : "none";
      segNeu.el.style.display = ctx === "neu" ? "" : "none";
      doc.textContent = "";
      var list, at, det, txt;
      if (ctx === "real") {
        var c = REAL.filter(function (x) { return x.v === vReal; })[0];
        list = c.at < 0 ? [] : realPills.slice();
        at = c.at < 0 ? 0 : c.at;
        det = c.det;
        txt = K.t("탐지 ", "Detected ") + c.det.toFixed(1) + K.t("% · 평균 길이 ", "% · mean length ") + c.len + K.t("자 — ", " chars — ") + c.note;
      } else {
        list = neuPills.slice();
        at = NEUTRAL_AT[vNeu];
        det = 100;
        txt = K.t("탐지 100% · 480자 — 개인정보가 없는 문맥에서는 이름 8개 × 다섯 위치 40회가 전부 탐지됐다.",
          "Detected 100% · 480 chars — with no personal data around, all 40 trials (8 names × 5 positions) were detected.");
      }
      list.splice(at, 0, nm);
      list.forEach(function (p) { doc.appendChild(p); });
      fill.style.width = det + "%";
      val.textContent = det.toFixed(1) + "%";
      read.textContent = txt;
      if (first) {
        var last = nm.getBoundingClientRect(), dx = first.left - last.left, dy = first.top - last.top;
        if (dx || dy) {
          nm.style.transition = "none";
          nm.style.transform = "translate(" + dx + "px," + dy + "px)";
          void nm.offsetWidth;
          nm.style.transition = "transform .45s ease";
          nm.style.transform = "";
        }
      }
    }
    render(false);
  });
})();
