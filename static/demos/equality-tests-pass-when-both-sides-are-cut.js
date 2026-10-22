/* 「동등성 테스트는 양쪽이 같이 잘려도 통과한다」 글의 그림: 뒤 단계를 잘라 보고 어떤 테스트가 실패하는지 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("equality-tests-pass-when-both-sides-are-cut-css", [
    '.tca[data-demo="parity-cut"] .pc-chain{display:flex;flex-wrap:wrap;align-items:center;gap:4px 4px;margin:0 0 10px}',
    '.tca[data-demo="parity-cut"] .pc-st{font-size:12.5px;padding:3px 8px;border-radius:12px;border:1px solid var(--tertiary);background:var(--theme);color:var(--primary);font:inherit;font-size:12.5px;line-height:1.4}',
    '.tca[data-demo="parity-cut"] button.pc-st{cursor:pointer;border-color:var(--tca-accent)}',
    '.tca[data-demo="parity-cut"] button.pc-st[aria-pressed="false"]{border-style:dashed;border-color:var(--tca-bad);color:var(--secondary);text-decoration:line-through}',
    '.tca[data-demo="parity-cut"] button.pc-st:focus-visible{outline:2px solid var(--tca-accent);outline-offset:2px}',
    '.tca[data-demo="parity-cut"] .pc-ar{color:var(--secondary);font-size:12px}',
    '.tca[data-demo="parity-cut"] .pc-t{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:6px 8px;border:1px solid var(--tertiary);border-radius:6px}',
    '.tca[data-demo="parity-cut"] .pc-c{font-size:13px}',
    '.tca[data-demo="parity-cut"] .pc-w{font-size:12.5px;color:var(--secondary);grid-column:1 / -1}',
    '.tca[data-demo="parity-cut"] .pc-r{font-weight:600;font-size:12.5px;white-space:nowrap}'
  ].join(""));

  K.register("parity-cut", function (root) {
    var TAIL = [
      { id: "amt", l: K.t("금액 정책", "Amount policy"), c: K.t("경복궁 입장료는 3,000원입니다", "Admission to Gyeongbokgung is 3,000 won"), why: K.t("개인에게 귀속되지 않는 금액은 풀어 준다", "release amounts not tied to a person") },
      { id: "rep", l: K.t("재언급 전파", "Re-mention propagation"), c: K.t("김철수 … 김철수 고객님 맞으신가요", "Kim Cheolsu … are you Mr Kim Cheolsu?"), why: K.t("한 번 잡은 이름을 같은 문서의 다른 위치에도 적용", "apply a caught name to its other mentions") },
      { id: "lst", l: K.t("이름 나열 회수", "Name-list recovery"), c: K.t("홍길동+김영희 두 분 예약해 주세요", "Book for Hong Gildong+Kim Younghee"), why: K.t("기호로 이은 이름들을 나눠 잡는다", "split names joined by symbols") },
      { id: "noun", l: K.t("일반명사 필터", "Common-noun filter"), c: K.t("공주 이야기를 들려주세요", "Tell me a story about a princess"), why: K.t("이름처럼 보이는 일반명사를 풀어 준다", "release common nouns that look like names") }
    ];
    var on = {};
    TAIL.forEach(function (s) { on[s.id] = true; });

    K.head(root, K.t("서빙 체인의 뒤 단계를 잘라 보기", "Cut stages off the end of the serving chain"),
      K.t("뒤 단계 버튼을 눌러 잘라 본다. 평가 체인은 서빙 함수를 그대로 부르므로 같이 잘리고, 동등성 테스트는 계속 통과한다. 잘린 단계는 그 단계의 사례 테스트만 잡는다.",
        "Press a tail stage to cut it. The eval chain calls the serving function, so it is cut too and the parity test keeps passing. Only that stage's case test catches it."));

    var chain = K.el("div", "pc-chain");
    function fixed(t) { chain.appendChild(K.el("span", "pc-st", t)); }
    function arrow() { chain.appendChild(K.el("span", "pc-ar", "→")); }
    fixed(K.t("모델 추론", "Model inference")); arrow();
    fixed(K.t("기관명 정책", "Org policy")); arrow();
    fixed(K.t("오버레이", "Overlay"));
    var tailBtns = {};
    TAIL.forEach(function (s) {
      arrow();
      var b = K.btn(s.l, true);
      b.className = "pc-st";
      b.addEventListener("click", function () { on[s.id] = !on[s.id]; render(); });
      chain.appendChild(b);
      tailBtns[s.id] = b;
    });
    root.appendChild(chain);

    var bar = K.el("div", "tca-bar");
    var bCut = K.btn(K.t("오버레이에서 자르기 (다른 환경의 고장)", "Cut at the overlay (the other environment's bug)"));
    var bFix = K.btn(K.t("모두 되돌리기", "Restore all"));
    bar.appendChild(bCut); bar.appendChild(bFix);
    root.appendChild(bar);

    var list = K.el("div", "tca-rows");
    list.style.gap = "6px";
    root.appendChild(list);
    function testRow(name, sub) {
      var r = K.el("div", "pc-t");
      r.appendChild(K.el("div", "pc-c", name));
      var res = K.el("div", "pc-r");
      r.appendChild(res);
      var w = K.el("div", "pc-w", sub);
      r.appendChild(w);
      list.appendChild(r);
      return { res: res, w: w };
    }
    var tParity = testRow(K.t("동등성 테스트: 평가 체인 출력 = 서빙 체인 출력", "Parity test: eval chain output = serving chain output"), "");
    var tCases = TAIL.map(function (s) { return testRow("“" + s.c + "”", ""); });
    var tHead = testRow(K.t("기관명 사례 (머리 몫)", "Org case (head's share)"), K.t("기관명 정책은 오버레이 앞이라 부분 결과에 이미 반영된다 — '뒤 단계가 바꾸지 않음'으로 남겨 둔 사례", "The org policy runs before the overlay, so the partial result already has it — kept as 'tail does not change it'"));

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "사례와 바뀌어야 하는 단계는 본문 표 그대로다. 그림의 동등성 테스트는 본문 앞부분이 설명한, 평가 체인이 서빙 함수를 그대로 부르는 패리티 테스트다. 본문의 실제 실험에서는 오버레이에서 잘랐을 때 뒤 단계 사례 4건과 동등성 테스트 1건이 실패했다.",
      "The cases and stages are the post's table. The parity test drawn here is the one the post describes first, where the eval chain calls the serving function. In the post's actual experiment, cutting at the overlay failed the four tail cases and one equality test.")));

    function mark(o, ok, text) { o.res.textContent = text; o.res.className = "pc-r " + (ok ? "tca-good" : "tca-bad"); }
    function render() {
      var cut = 0, fail = 0;
      TAIL.forEach(function (s, i) {
        K.press(tailBtns[s.id], on[s.id]);
        tailBtns[s.id].title = on[s.id] ? K.t("누르면 자른다", "press to cut") : K.t("잘림 — 누르면 되돌린다", "cut — press to restore");
        if (!on[s.id]) cut++;
        var o = tCases[i];
        o.w.textContent = s.l + K.t(" — ", " — ") + s.why + " · " + (on[s.id] ? K.t("최종 결과가 오버레이 결과와 다르다", "final differs from the overlay result") : K.t("단계가 없어 최종 결과 = 오버레이 결과", "stage missing, final = overlay result"));
        mark(o, on[s.id], on[s.id] ? K.t("통과", "pass") : K.t("실패", "fail"));
        if (!on[s.id]) fail++;
      });
      tParity.w.textContent = cut ? K.t("양쪽이 같이 " + cut + "단계 잘려 출력이 여전히 같다", "Both sides lost " + cut + " stage(s), so outputs still match") : K.t("양쪽 출력이 같다", "Outputs match");
      mark(tParity, true, K.t("통과", "pass"));
      mark(tHead, true, K.t("통과", "pass"));
      if (!cut) { read.className = "tca-read"; read.textContent = K.t("잘린 단계 없음 · 모든 테스트 통과", "No stage cut · every test passes"); }
      else {
        read.className = "tca-read tca-bad";
        read.textContent = K.t("잘린 단계 " + cut + "개 · 사례 테스트 " + fail + "건 실패 · 동등성 테스트는 통과 · 머리 몫 사례도 통과(바뀌지 않는 게 맞다)",
          cut + " stage(s) cut · " + fail + " case test(s) fail · the parity test passes · the head case passes too (it should not change)");
      }
    }
    bCut.addEventListener("click", function () { TAIL.forEach(function (s) { on[s.id] = false; }); render(); });
    bFix.addEventListener("click", function () { TAIL.forEach(function (s) { on[s.id] = true; }); render(); });
    render();
  });
})();
