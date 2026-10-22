/* 「문장이 하나도 겹치지 않아도 골드는 오염된다」 글의 그림: 해시와 5-gram 포함률이 같은 짝을 다르게 본다 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("gold-leaks-without-a-shared-sentence-css", [
    '.tca[data-demo="goldleak-ngram"] .gl-txt{border:1px solid var(--tertiary);border-radius:6px;padding:8px;',
    "background:var(--theme);font-size:13.5px;line-height:1.9;max-height:150px;overflow-y:auto;word-break:break-all}",
    '.tca[data-demo="goldleak-ngram"] .gl-hit{background:color-mix(in srgb,var(--tca-good) 28%,transparent);',
    "border-bottom:2px solid var(--tca-good)}",
    '.tca[data-demo="goldleak-ngram"] .gl-win{outline:2px solid var(--tca-accent);outline-offset:1px;border-radius:2px}',
    '.tca[data-demo="goldleak-ngram"] .gl-mark{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--primary)}',
    '.tca[data-demo="goldleak-ngram"] .gl-meta{font-size:12.5px;color:var(--secondary);margin:4px 0 10px}',
    '.tca[data-demo="goldleak-ngram"] .gl-v{margin:10px 0 0;display:flex;flex-direction:column;gap:4px}'
  ].join(""));

  // 화면에 보이는 문장은 모두 일상 업무 예시 문장이다(본문의 실제 데이터가 아니다)
  var GOLD = K.t("다음 주 출장 일정을 표로 정리해 주세요. 부산 지사 방문은 화요일 오전입니다.",
    "Please put next week's business trip schedule in a table. The visit to the Busan branch is Tuesday morning.");
  var PAIRS = [
    { v: "same", label: K.t("같은 문장", "Same sentence"), text: GOLD },
    { v: "slot", label: K.t("슬롯만 바꾼 틀", "Same template, new slots"),
      text: K.t("다음 주 출장 일정을 표로 정리해 주세요. 광주 지사 방문은 목요일 오전입니다.",
        "Please put next week's business trip schedule in a table. The visit to the Gwangju office is Thursday afternoon.") },
    { v: "none", label: K.t("무관한 문장", "Unrelated"),
      text: K.t("고양이 사료를 바꿀 때 며칠에 걸쳐 섞어 주는 게 좋은가요?",
        "When switching cat food, over how many days should I mix the two?") },
    { v: "long", label: K.t("긴 붙여넣기", "Long paste"),
      text: K.t("회의록 정리 요청 모음입니다. 지난주 회의 내용을 표로 정리해 주세요. 다음 주 일정은 메일로 보내 주세요. 출장 일정을 확인한 뒤 숙소를 잡아 주세요. 부산 지사 담당자에게 연락해 주세요. 방문은 화요일로 잡았습니다. 오전입니다만 회의실이 비어 있는지 확인해 주세요. 견적서를 정리해 주세요. 제품 사진을 정리해 주세요. 지사 방문 보고서는 금요일까지 올려 주세요. 다음 분기 예산안도 표로 정리해 주세요. 신규 입사자 교육 자료를 정리해 주세요. 고객 문의 답변 초안을 써 주세요. 주간 보고 양식을 바꿔 주세요. 이번 프로젝트 마감은 화요일 오전입니다. 회의 시간을 다시 잡아 주세요.",
        "A collection of meeting-note requests. Please put last week's meeting in a table. Send next week's schedule by email. Check the business trip schedule and then book a hotel. Contact the person at the Busan branch. The visit is set for Tuesday. It is morning, so check that the room is free. Please tidy up the quote. Please sort the product photos. Branch visit reports are due Friday. Please also put next quarter's budget in a table. Please organize the onboarding material. Draft replies to customer questions. Change the weekly report form. This project's deadline is Tuesday morning. Please reschedule the meeting.") }
  ];
  var N = 5, TH = 0.3, REV = 0.2;

  function norm(s) { return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(); }
  function grams(s) { var o = {}, n = 0; for (var i = 0; i + N <= s.length; i++) { var g = s.slice(i, i + N); if (!o[g]) { o[g] = 1; n++; } } return { set: o, size: n }; }
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  K.register("goldleak-ngram", function (root) {
    K.head(root, K.t("해시는 다르다고 하고, 포함률은 같은 틀이라고 한다", "The hash says different; containment says same template"),
      K.t("골드 대화 하나와 학습 대화 하나를 비교한다. 정규화한 유저 턴을 5글자씩 잘라, 골드의 5-gram 중 몇 할이 학습 쪽에 들어 있는지(포함률)를 센다.",
        "Compare one gold conversation with one training conversation. Cut the normalized user turns into 5-character pieces and count what share of the gold 5-grams appear on the training side (containment)."));

    var cur = "slot", useRev = true, bug = false, playing = false, pos = -1, acc = 0;

    var bar = K.el("div", "tca-bar");
    var sg = K.seg(PAIRS.map(function (p) { return { value: p.v, label: p.label }; }), cur,
      function (v) { cur = v; restart(); }, K.t("학습 대화 고르기", "Pick the training conversation"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var bRev = K.btn(K.t("역포함률 조건(0.2)", "Reverse condition (0.2)"), true);
    var bBug = K.btn(K.t("버그 재현: 딕셔너리만 읽기", "Reproduce bug: read dicts only"), false);
    var bPlay = K.btn(K.t("5글자 창 밀기", "Slide the 5-char window"));
    bar2.appendChild(bRev); bar2.appendChild(bBug); bar2.appendChild(bPlay);
    root.appendChild(bar2);

    root.appendChild(K.el("div", "tca-h", K.t("골드 대화(유저 턴)", "Gold conversation (user turns)")));
    var gBox = K.el("div", "gl-txt"); root.appendChild(gBox);
    var gMeta = K.el("div", "gl-meta"); root.appendChild(gMeta);
    root.appendChild(K.el("div", "tca-h", K.t("학습 대화(유저 턴)", "Training conversation (user turns)")));
    var tBox = K.el("div", "gl-txt"); root.appendChild(tBox);
    var tMeta = K.el("div", "gl-meta"); root.appendChild(tMeta);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "118px");
    rows.style.setProperty("--tca-rw", "48px");
    function row(label, mark) {
      var r = K.el("div", "tca-row"), l = K.el("div", "tca-row-l", label), tr = K.el("div", "tca-track"),
        f = K.el("div", "tca-fill"), m = K.el("div", "gl-mark"), v = K.el("div", "tca-row-r");
      m.style.left = mark * 100 + "%";
      tr.appendChild(f); tr.appendChild(m);
      r.appendChild(l); r.appendChild(tr); r.appendChild(v); rows.appendChild(r);
      return { f: f, v: v };
    }
    var rC = row(K.t("포함률 골드→학습", "Gold in training"), TH);
    var rR = row(K.t("역포함률 학습→골드", "Training in gold"), REV);
    root.appendChild(rows);
    root.appendChild(K.el("div", "tca-legend", K.t("세로 선: 제거 기준 0.3(위) · 역포함률 조건 0.2(아래)", "Vertical lines: removal cutoff 0.3 (top) · reverse condition 0.2 (bottom)")));

    var verdict = K.el("div", "gl-v");
    verdict.setAttribute("aria-live", "polite");
    root.appendChild(verdict);
    root.appendChild(K.el("div", "tca-note", K.t(
      "문장은 예시로 만든 일상 업무 문장이다. 같은 문장 1.0 · 슬롯만 바꾼 틀 0.7 안팎 · 무관한 문장 0 근처라는 세 경우는 본문의 장난감 확인과 같은 꼴이다. 본문에서 빼는 '양쪽 모두 흔한 n-gram'은 여기서 다루지 않는다.",
      "Sentences are made-up office examples. Same sentence 1.0, slot-swapped template around 0.7, unrelated near 0 match the toy check in the post. The post's removal of n-grams common on both sides is not modeled here.")));

    function pair() { for (var i = 0; i < PAIRS.length; i++) if (PAIRS[i].v === cur) return PAIRS[i]; return PAIRS[0]; }

    // 덮인 글자 표시: 공유 5-gram 이 덮는 글자 위치
    function paint(box, s, shared, upto, win) {
      box.textContent = "";
      var cov = [], i, j;
      for (i = 0; i < s.length; i++) cov.push(false);
      for (i = 0; i + N <= s.length; i++) {
        if (upto != null && i > upto) break;
        if (shared[s.slice(i, i + N)]) for (j = i; j < i + N; j++) cov[j] = true;
      }
      var run = "", runCls = null;
      function flush() { if (!run) return; var sp = K.el("span", runCls, run); box.appendChild(sp); run = ""; }
      for (i = 0; i < s.length; i++) {
        var cls = (win != null && i >= win && i < win + N ? "gl-win " : "") + (cov[i] ? "gl-hit" : "");
        cls = cls.trim() || null;
        if (cls !== runCls) { flush(); runCls = cls; }
        run += s[i];
      }
      flush();
      if (!s.length) box.appendChild(K.el("span", "tca-bad", K.t("(빈 문자열 — 추출된 유저 텍스트가 없다)", "(empty string — no user text extracted)")));
    }

    var st = null;
    function compute() {
      var g = norm(GOLD), p = pair();
      // 버그 재현: 학습 레코드가 "유저: …" 문자열로 저장돼 있고 추출 함수는 딕셔너리만 읽는다고 둔다
      var t = bug ? "" : norm(p.text);
      var G = grams(g), T = grams(t), shared = {}, n = 0, gl = [];
      for (var i = 0; i + N <= g.length; i++) gl.push(g.slice(i, i + N));
      for (var k in G.set) if (T.set[k]) { shared[k] = 1; n++; }
      st = { g: g, t: t, G: G, T: T, shared: shared, n: n, gl: gl,
        c: G.size ? n / G.size : 0, r: T.size ? n / T.size : 0 };
    }

    function render() {
      var s = st;
      var showAll = pos < 0;
      paint(gBox, s.g, s.shared, showAll ? null : pos, showAll ? null : pos);
      paint(tBox, s.t, s.shared, null, null);
      var gh = fnv(s.g), th = fnv(s.t);
      gMeta.textContent = K.t("해시 ", "hash ") + gh + " · " + K.t("5-gram ", "5-grams ") + s.G.size + K.t("개", "");
      tMeta.textContent = K.t("해시 ", "hash ") + th + " · " + K.t("5-gram ", "5-grams ") + s.T.size + K.t("개", "") +
        (bug ? K.t(" · 저장 형식 '유저: …' 문자열", " · stored as 'User: …' strings") : "");
      var c = s.c, r = s.r, seen = s.G.size;
      if (!showAll) {
        // 창을 미는 중: 지금까지 지나간 고유 5-gram 기준
        var u = {}, hit = 0; seen = 0;
        for (var i = 0; i <= pos && i < s.gl.length; i++) if (!u[s.gl[i]]) { u[s.gl[i]] = 1; seen++; if (s.shared[s.gl[i]]) hit++; }
        c = s.G.size ? hit / s.G.size : 0; acc = hit;
        r = s.T.size ? hit / s.T.size : 0;
      }
      rC.f.style.width = c * 100 + "%"; rC.v.textContent = c.toFixed(2);
      rR.f.style.width = r * 100 + "%"; rR.v.textContent = r.toFixed(2);
      rC.f.style.background = c >= TH ? "var(--tca-bad)" : "var(--tca-accent)";
      rR.f.style.background = r >= REV ? "var(--tca-bad)" : "var(--tca-accent)";

      verdict.textContent = "";
      if (!showAll) {
        verdict.appendChild(K.el("div", "tca-num", K.t("창 위치 ", "Window at ") + (pos + 1) + " / " + s.gl.length +
          K.t(" · 지금까지 공유 5-gram ", " · shared 5-grams so far ") + acc + " / " + s.G.size));
        return;
      }
      var hashSame = s.g === s.t;
      var flagged = s.c >= TH && (!useRev || s.r >= REV);
      verdict.appendChild(K.el("div", hashSame ? "tca-bad" : "tca-good",
        K.t("해시 기준: ", "Hash check: ") + (hashSame ? K.t("같은 입력 → 누출로 잡힘", "same input → caught as a leak") : K.t("다른 입력 → 겹침 없음", "different input → no overlap"))));
      var why;
      if (bug) why = K.t("유저 텍스트가 비어 무엇과도 겹치지 않는다", "the user text is empty, so it overlaps nothing");
      else if (s.c < TH) why = K.t("포함률이 0.3 아래", "containment below 0.3");
      else if (useRev && s.r < REV) why = K.t("포함률은 높지만 학습 쪽이 골드로 0.2도 설명되지 않는다 — 긴 문서의 사전 효과", "containment is high, but less than 0.2 of the training side is explained by the gold — the long-document dictionary effect");
      else if (!useRev && s.r < REV) why = K.t("역포함률 조건이 꺼져 있어 긴 문서도 같은 틀로 잡힌다", "with the reverse condition off, the long document is counted as the same template");
      else why = K.t("양쪽 포함률이 다 높다 — 같은 틀", "both directions are high — same template");
      verdict.appendChild(K.el("div", flagged ? "tca-bad" : "tca-good",
        K.t("포함률 기준: ", "Containment check: ") + (flagged ? K.t("틀 공유로 제거", "removed as a shared template") : K.t("남김", "kept")) + " — " + why));
    }

    function restart() { pos = -1; playing = false; bPlay.textContent = K.t("5글자 창 밀기", "Slide the 5-char window"); compute(); render(); }

    bRev.addEventListener("click", function () { useRev = !useRev; K.press(bRev, useRev); render(); });
    bBug.addEventListener("click", function () { bug = !bug; K.press(bBug, bug); restart(); });
    bPlay.addEventListener("click", function () {
      if (playing) { playing = false; pos = -1; bPlay.textContent = K.t("5글자 창 밀기", "Slide the 5-char window"); render(); return; }
      if (K.reduce || !st.gl.length) { pos = -1; render(); return; }
      playing = true; pos = 0; tAcc = 0; bPlay.textContent = K.t("멈추고 전체 보기", "Stop and show all"); render();
    });

    var tAcc = 0;
    K.loop(root, function (dt) {
      if (!playing) return;
      tAcc += dt;
      if (tAcc < 160) return;
      tAcc = 0;
      pos++;
      if (pos >= st.gl.length) { playing = false; pos = -1; bPlay.textContent = K.t("5글자 창 밀기", "Slide the 5-char window"); }
      render();
    });

    compute();
    render();
  });
})();
