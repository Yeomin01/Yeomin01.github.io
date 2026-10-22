/* 「모델 파일을 열 때 무엇이 실행되는가」 글의 그림: 방어 수단을 켜면 네 층 중 어디가 막히나 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("what-runs-when-you-load-a-model-css", [
    '.tca[data-demo="load-layers"] .ll-row{border:1px solid var(--tertiary);border-radius:6px;padding:8px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center}',
    '.tca[data-demo="load-layers"] .ll-n{font-weight:600;font-size:13.5px}',
    '.tca[data-demo="load-layers"] .ll-w{font-size:12.5px;color:var(--secondary)}',
    '.tca[data-demo="load-layers"] .ll-d{grid-column:1 / -1;font-size:12.5px;color:var(--secondary)}',
    '.tca[data-demo="load-layers"] .ll-s{font-size:12.5px;font-weight:600;padding:2px 8px;border-radius:10px;border:1px solid currentColor;white-space:nowrap}'
  ].join(""));

  K.register("load-layers", function (root) {
    var DEF = [
      { id: "hash", l: K.t("해시 대조", "Hash check") },
      { id: "st", l: K.t("safetensors · weights_only", "safetensors · weights_only") },
      { id: "code", l: K.t("코드 없는 모델 · 리비전 고정 · 코드 검토", "No bundled code · pinned revision · code review") },
      { id: "tpl", l: K.t("대화 틀 열어 읽고 해시 기록", "Read the chat template, record its hash") },
      { id: "eval", l: K.t("행동 평가 (승격 게이트)", "Behavioural evaluation (promotion gate)") }
    ];
    var MID = K.t("중간에 바뀐 파일은 잡는다", "catches files changed in transit");
    var LAYERS = [
      { n: K.t("파일 형식 (pickle)", "File format (pickle)"), w: K.t("파일을 열 때", "when the file is opened"),
        eff: { hash: MID, st: K.t("막는다", "blocks it") }, block: ["st"] },
      { n: K.t("함께 오는 코드", "Bundled code"), w: K.t("모델을 불러올 때", "when the model is loaded"),
        eff: { hash: MID, st: K.t("상관없다", "irrelevant"), code: K.t("막는다", "blocks it") }, block: ["code"] },
      { n: K.t("가중치에 심은 뒷문", "Backdoor in the weights"), w: K.t("추론할 때", "at inference"),
        eff: { hash: K.t("못 잡는다", "cannot catch it"), st: K.t("못 막는다", "cannot block it"), eval: K.t("행동으로만 확인된다", "only checkable through behaviour") }, measure: ["eval"] },
      { n: K.t("대화 틀", "Chat template"), w: K.t("대화를 조립할 때마다", "every time a conversation is assembled"),
        eff: { hash: MID, st: K.t("상관없다", "irrelevant"), tpl: K.t("읽어서 확인한다", "checked by reading it") }, block: ["tpl"] }
    ];
    var on = { hash: true, st: true, code: false, tpl: false, eval: false };

    K.head(root, K.t("방어 수단마다 막는 층이 다르다", "Each defence covers a different layer"),
      K.t("본문 표의 네 층이다. 방어 수단을 켜고 끄면 층마다 상태가 바뀐다. 처음에는 해시 대조와 safetensors만 켜 두었다.",
        "The four layers from the table. Toggle defences to see each layer's state. Only the hash check and safetensors start on."));

    var bar = K.el("div", "tca-bar");
    var btns = {};
    DEF.forEach(function (d) {
      var b = K.btn(d.l, on[d.id]);
      b.addEventListener("click", function () { on[d.id] = !on[d.id]; K.press(b, on[d.id]); render(); });
      btns[d.id] = b;
      bar.appendChild(b);
    });
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var pBase = K.btn(K.t("해시 대조 + safetensors 만", "Hash check + safetensors only"));
    var pAll = K.btn(K.t("반입 확인 항목 전부", "Every intake check"));
    var pNone = K.btn(K.t("모두 끄기", "All off"));
    bar2.appendChild(pBase); bar2.appendChild(pAll); bar2.appendChild(pNone);
    root.appendChild(bar2);

    var rows = K.el("div", "tca-rows");
    rows.style.gap = "6px";
    var els = LAYERS.map(function (L) {
      var r = K.el("div", "ll-row");
      var a = K.el("div");
      a.appendChild(K.el("div", "ll-n", L.n));
      a.appendChild(K.el("div", "ll-w", K.t("작동 시점: ", "acts: ") + L.w));
      var s = K.el("span", "ll-s");
      var d = K.el("div", "ll-d");
      r.appendChild(a); r.appendChild(s); r.appendChild(d);
      rows.appendChild(r);
      return { s: s, d: d };
    });
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "칸의 문장은 본문 표를 옮긴 것이다. '중간에 바뀐 파일은 잡는다'는 받은 파일이 배포처 원본과 같은지만 본다는 뜻이라, 원본 자체에 문제가 있으면 그대로 통과한다.",
      "The wording is the post's table. 'Catches files changed in transit' means it only checks that the file matches the publisher's original; a problem in the original passes straight through.")));

    var prev = [];
    function render() {
      var nBlock = 0, nPart = 0, nOpen = 0, nMeas = 0;
      LAYERS.forEach(function (L, i) {
        var st;
        if ((L.block || []).some(function (k) { return on[k]; })) { st = "block"; nBlock++; }
        else if ((L.measure || []).some(function (k) { return on[k]; })) { st = "measure"; nMeas++; }
        else if (on.hash && L.eff.hash === MID) { st = "part"; nPart++; }
        else { st = "open"; nOpen++; }
        var e = els[i];
        e.s.textContent = st === "block" ? K.t("막힘", "covered") : st === "measure" ? K.t("행동으로 계속 잰다", "measured by behaviour") : st === "part" ? K.t("원본 문제는 통과", "originals pass") : K.t("열림", "open");
        e.s.className = "ll-s " + (st === "block" ? "tca-good" : st === "open" ? "tca-bad" : "tca-warn");
        if (prev[i] != null && prev[i] !== st) { e.s.classList.remove("tca-pop"); void e.s.offsetWidth; e.s.classList.add("tca-pop"); }
        prev[i] = st;
        var parts = [];
        DEF.forEach(function (d) { if (on[d.id] && L.eff[d.id]) parts.push(d.l.split(" · ")[0] + ": " + L.eff[d.id]); });
        e.d.textContent = parts.length ? parts.join(" · ") : K.t("켠 방어 수단 중 이 층에 해당하는 것이 없다.", "None of the active defences applies to this layer.");
      });
      read.textContent = K.t("막힘 " + nBlock + " · 행동으로 확인 " + nMeas + " · 원본 문제는 통과 " + nPart + " · 열림 " + nOpen + " (네 층 중)",
        "Covered " + nBlock + " · measured " + nMeas + " · originals pass " + nPart + " · open " + nOpen + " (of four)") +
        (on.hash && on.st && !on.code && !on.tpl && !on.eval ? K.t(" — 해시 대조와 safetensors는 앞쪽 일부만 막는다.", " — the hash check and safetensors cover only part of the front.") : "") +
        (nMeas ? K.t(" 가중치 층은 읽어서 확인할 수 없어 행동 평가로만 확인된다.", " The weight layer cannot be read, only measured.") : "");
    }
    function setAll(map) { DEF.forEach(function (d) { on[d.id] = !!map[d.id]; K.press(btns[d.id], on[d.id]); }); render(); }
    pBase.addEventListener("click", function () { setAll({ hash: 1, st: 1 }); });
    pAll.addEventListener("click", function () { setAll({ hash: 1, st: 1, code: 1, tpl: 1, eval: 1 }); });
    pNone.addEventListener("click", function () { setAll({}); });
    render();
  });
})();
