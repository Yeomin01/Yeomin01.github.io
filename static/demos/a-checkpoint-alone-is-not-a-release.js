/* 「체크포인트만 바꾸면 배포가 아니다」 글의 그림: 구성 요소를 하나씩 새 판으로 바꿔 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("release-bundle", function (root) {
    var PARTS = [
      { id: "w", name: K.t("모델 가중치", "Model weights"), eff: K.t("후보 스팬이 달라진다", "candidate spans change") },
      { id: "t", name: K.t("보정 온도", "Calibration temperature"), eff: K.t("신뢰도가 달라져 같은 임계값에서 다른 결과가 나온다", "confidence shifts, so the same threshold gives different results") },
      { id: "h", name: K.t("라벨별·단계별 임계값", "Per-label, per-tier thresholds"), eff: K.t("어디서 자를지가 달라진다", "where to cut changes") },
      { id: "r", name: K.t("정규식·정규화·후처리 규칙 코드", "Regex, normalisation, post-processing code"), eff: K.t("최종 스팬이 달라진다", "final spans change") },
      { id: "p", name: K.t("2차 LLM 프롬프트와 정책 버전", "Second-stage LLM prompt and policy version"), eff: K.t("무엇을 풀어 줄지가 달라진다", "what gets released changes") }
    ];
    var state = {};
    PARTS.forEach(function (p) { state[p.id] = "old"; });

    K.head(root, K.t("무엇을 바꿔 끼우면 같은 시스템인가", "What has to be swapped to get the same system"),
      K.t("본문 표의 다섯 구성 요소다. 서빙 중인 이전 판에서 하나씩 새 판으로 바꿔 보면, 다섯이 모두 새 판일 때만 새 성능표의 동작이 나온다.",
        "The five components from the table. Swap them one by one from the old release to the new one; only when all five are new does the new scorecard hold."));

    var bar = K.el("div", "tca-bar");
    var bCk = K.btn(K.t("체크포인트만 교체", "Swap the checkpoint only"));
    var bAll = K.btn(K.t("묶음 전체 교체", "Swap the whole bundle"));
    var bOld = K.btn(K.t("이전 판으로", "Back to the old release"));
    bar.appendChild(bCk); bar.appendChild(bAll); bar.appendChild(bOld);
    root.appendChild(bar);

    var rows = K.el("div", "tca-rows");
    rows.style.gap = "8px";
    var segs = {}, tags = {};
    PARTS.forEach(function (p) {
      var r = K.el("div", "tca-row");
      r.style.flexWrap = "wrap";
      var l = K.el("div", "tca-row-l", p.name);
      l.style.whiteSpace = "normal";
      l.style.width = "auto";
      l.style.flex = "1 1 150px";
      l.style.color = "var(--primary)";
      var s = K.seg([{ value: "old", label: K.t("이전 판", "Old") }, { value: "new", label: K.t("새 판", "New") }], "old",
        function (v) { state[p.id] = v; render(p.id); }, p.name);
      var tg = K.el("span", "tca-tag", "");
      tg.style.minWidth = "64px";
      tg.style.textAlign = "center";
      r.appendChild(l); r.appendChild(s.el); r.appendChild(tg);
      rows.appendChild(r);
      segs[p.id] = s; tags[p.id] = tg;
    });
    root.appendChild(rows);

    var verdict = K.el("div", "tca-read");
    verdict.setAttribute("aria-live", "polite");
    verdict.style.fontWeight = "600";
    root.appendChild(verdict);
    var list = K.el("ul", "tca-note");
    list.style.paddingLeft = "18px";
    root.appendChild(list);
    root.appendChild(K.el("div", "tca-note", K.t(
      "판정 문장은 본문 표의 '바뀌면' 칸을 옮긴 것이다. 섞인 구성은 어느 쪽 성능표로도 설명되지 않는다.",
      "The consequences are the 'if it changes' column of the table. A mixed configuration is described by neither scorecard.")));

    function render(changed) {
      var nNew = 0;
      PARTS.forEach(function (p) {
        var isNew = state[p.id] === "new";
        if (isNew) nNew++;
        tags[p.id].textContent = isNew ? K.t("새 판", "new") : K.t("이전 판", "old");
        tags[p.id].style.borderColor = isNew ? "var(--tca-accent)" : "var(--tertiary)";
        tags[p.id].style.color = isNew ? "var(--tca-accent)" : "var(--secondary)";
        if (changed === p.id) { tags[p.id].classList.remove("tca-pop"); void tags[p.id].offsetWidth; tags[p.id].classList.add("tca-pop"); }
      });
      list.textContent = "";
      if (nNew === 0) {
        verdict.className = "tca-read";
        verdict.textContent = K.t("이전 판 그대로다. 이전 성능표의 동작이다.", "Still the old release. It behaves like the old scorecard.");
      } else if (nNew === PARTS.length) {
        verdict.className = "tca-read tca-good";
        verdict.textContent = K.t("묶음 전체가 새 판이다. 새 성능표의 숫자가 재현된다.", "The whole bundle is new. The new scorecard reproduces.");
      } else {
        verdict.className = "tca-read tca-bad";
        verdict.textContent = K.t("섞인 구성이다 — 새 판 " + nNew + "개, 이전 판 " + (PARTS.length - nNew) + "개. 어느 성능표와도 다른 시스템이다.",
          "Mixed — " + nNew + " new, " + (PARTS.length - nNew) + " old. A system neither scorecard describes.");
        PARTS.forEach(function (p) {
          if (state[p.id] === "old") list.appendChild(K.el("li", null, p.name + K.t(" · 이전 판 → ", " · old → ") + p.eff));
        });
      }
    }
    function setAll(v) { PARTS.forEach(function (p) { state[p.id] = v; segs[p.id].set(v); }); render(); }
    bCk.addEventListener("click", function () {
      PARTS.forEach(function (p) { state[p.id] = p.id === "w" ? "new" : "old"; segs[p.id].set(state[p.id]); });
      render("w");
    });
    bAll.addEventListener("click", function () { setAll("new"); });
    bOld.addEventListener("click", function () { setAll("old"); });
    render();
  });
})();
