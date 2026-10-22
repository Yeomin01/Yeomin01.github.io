/* 「방어 목적이라고 하면 공격 탐지기가 물러선다」 글의 그림: 세 층을 지나며 공격 확률이 어떻게 눌리는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("defense-framing-and-rule-conflict-css", [
    '.tca[data-demo="defframe-layers"] .df-mk{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:var(--primary)}',
    '.tca[data-demo="defframe-layers"] .tca-row{transition:opacity .3s ease}',
    '.tca[data-demo="defframe-layers"] .df-dim{opacity:.3}',
    '.tca[data-demo="defframe-layers"] .df-why{font-size:12.5px;color:var(--secondary);margin:0 0 6px var(--tca-lw,96px);padding-left:8px}',
    '@media (max-width:420px){.tca[data-demo="defframe-layers"] .df-why{margin-left:0;padding-left:0}}',
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="defframe-layers"] .tca-row{transition:none}}'
  ].join(""));

  K.register("defframe-layers", function (root) {
    // 발화 유형별 예시 원 확률. 0.07 은 제곱 감쇄 뒤 본문의 0.005 정도가 되도록 거꾸로 잡은 값이다.
    var CASES = {
      edu: { p: 0.6, attack: false, sec: true, ask: false },
      frame: { p: 0.07, attack: true, sec: true, ask: true }
    };
    var kind = "frame", fixed = false, p = CASES.frame.p, th = 0.5, stage = 4, tAcc = 0, playing = false;

    K.head(root, K.t("세 층이 서로 책임을 넘기는 자리", "Where three layers hand off responsibility"),
      K.t("마지막 발화가 분류기 → 코딩 도메인 감쇄 규칙 → 백업 규칙을 차례로 지난다. 감쇄 규칙은 공격 확률 p 를 p² 로 누른다.",
        "The last utterance passes the classifier, then the coding-domain damping rule, then the backup rule. Damping turns attack probability p into p²."));

    var bar = K.el("div", "tca-bar");
    var sgKind = K.seg([
      { value: "frame", label: K.t("방어 프레이밍 + 결과물 요청", "Defense framing + output request") },
      { value: "edu", label: K.t("보안 교육 질문", "Security education question") }
    ], kind, function (v) { kind = v; p = CASES[v].p; sP.set(p); flow(); }, K.t("마지막 발화 유형", "Type of last utterance"));
    var sgVer = K.seg([
      { value: false, label: K.t("규칙 수정 전", "Before the fix") },
      { value: true, label: K.t("수정 후(역-조건)", "After the fix (counter-condition)") }
    ], fixed, function (v) { fixed = v; flow(); }, K.t("규칙 버전", "Rule version"));
    bar.appendChild(sgKind.el); bar.appendChild(sgVer.el);
    root.appendChild(bar);

    var bar2 = K.el("div", "tca-bar");
    var sP = K.slider({ label: K.t("분류기 원 확률", "Raw classifier p"), min: 0.01, max: 0.99, step: 0.01, value: p,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { p = v; stage = 4; render(); } });
    var sT = K.slider({ label: K.t("차단 기준", "Block threshold"), min: 0.05, max: 0.95, step: 0.05, value: th,
      fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { th = v; render(); } });
    var bTrain = K.btn(K.t("사례를 학습한 분류기(예시 0.90)", "Classifier trained on the pattern (example 0.90)"));
    var bPlay = K.btn(K.t("한 층씩 흘려 보기", "Step through the layers"));
    bar2.appendChild(sP.el); bar2.appendChild(sT.el); bar2.appendChild(bTrain); bar2.appendChild(bPlay);
    root.appendChild(bar2);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "96px");
    rows.style.setProperty("--tca-rw", "52px");
    function row(label) {
      var r = K.el("div", "tca-row"), l = K.el("div", "tca-row-l", label), tr = K.el("div", "tca-track"),
        f = K.el("div", "tca-fill"), mk = K.el("div", "df-mk"), v = K.el("div", "tca-row-r");
      tr.appendChild(f); tr.appendChild(mk);
      r.appendChild(l); r.appendChild(tr); r.appendChild(v); rows.appendChild(r);
      var why = K.el("div", "df-why"); rows.appendChild(why);
      return { r: r, f: f, mk: mk, v: v, why: why };
    }
    var R = [row(K.t("① 분류기", "1 Classifier")), row(K.t("② 감쇄 규칙", "2 Damping rule")),
      row(K.t("③ 백업 규칙", "3 Backup rule")), row(K.t("최종", "Final"))];
    root.appendChild(rows);
    root.appendChild(K.el("div", "tca-legend", K.t("세로 선: 차단 기준", "Vertical line: block threshold")));
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "발화 내용은 쓰지 않고 조건만 표시한다. 분류기 원 확률(방어 프레이밍 0.07, 보안 교육 질문 0.60)과 차단 기준은 본문에 없는 예시 값이다. 0.07 은 제곱 감쇄 뒤 본문의 0.005 정도가 되도록 거꾸로 잡았다.",
      "Utterances are not shown, only the conditions they meet. Raw probabilities (defense framing 0.07, education question 0.60) and the threshold are example values not in the post. 0.07 was picked so that squaring gives about the post's 0.005.")));

    function render() {
      var c = CASES[kind];
      var damp = c.sec && !(fixed && c.ask);
      var v = [p, damp ? p * p : p, damp ? p * p : p];
      v.push(v[2]);
      R.forEach(function (x, i) {
        var show = i < stage;
        x.r.className = "tca-row" + (show ? "" : " df-dim");
        x.f.style.width = (show ? v[i] * 100 : 0) + "%";
        x.v.textContent = show ? (v[i] < 0.01 ? v[i].toFixed(4) : v[i].toFixed(3)) : "…";
        x.mk.style.left = th * 100 + "%";
      });
      R[0].why.textContent = c.attack
        ? (p < th ? K.t("프레이밍에 어느 정도 속아 기준 아래로 낸다", "Partly fooled by the framing, it scores below the threshold")
          : K.t("기준을 넘게 낸다", "It scores above the threshold"))
        : (p >= th ? K.t("민감해 보이는 어휘 때문에 기준을 넘게 낸다", "Sensitive-looking vocabulary pushes it above the threshold")
          : K.t("기준 아래로 낸다", "It scores below the threshold"));
      var cond = K.t("보안 어휘 충분 ", "Security vocabulary ") + (c.sec ? "✓" : "✗") +
        K.t(" · 결과물 요청 표현 ", " · Output-request phrase ") + (c.ask ? "✓" : "✗");
      R[1].why.textContent = cond + " → " + (damp ? K.t("감쇄 적용 (p²)", "damped (p²)")
        : K.t("역-조건에 걸려 감쇄 차단", "counter-condition blocks damping"));
      R[2].why.textContent = K.t("명시적 트리거 키워드가 없어 발동 안 함", "No explicit trigger keyword, so it does not fire");
      var block = v[3] >= th, f = R[3].f;
      f.style.background = block ? "var(--tca-bad)" : "var(--tca-good)";
      R[3].why.textContent = stage < 4 ? "" : (block ? K.t("차단", "Blocked") : K.t("통과", "Passed")) + " · " +
        (c.attack ? (block ? K.t("공격을 잡았다", "attack caught") : K.t("미탐", "missed attack (FN)"))
          : (block ? K.t("오탐(과차단)", "false positive (over-blocking)") : K.t("정상 통과", "normal traffic passed")));
      if (stage < 4) { read.textContent = K.t("층을 지나는 중…", "Passing through the layers…"); return; }
      var msg;
      if (c.attack && !block && damp) msg = K.t("이미 낮던 확률을 감쇄가 한 번 더 눌렀고, 백업 규칙도 발동하지 않았다. 어느 층도 혼자 막지 않았다.",
        "Damping pressed an already low probability further, and the backup rule did not fire. No layer blocked it alone.");
      else if (c.attack && !block) msg = K.t("감쇄는 빠졌다. 남은 것은 분류기 자체가 프레이밍에 속은 몫이다.",
        "Damping is gone. What remains is how much the classifier itself was fooled by the framing.");
      else if (c.attack) msg = K.t("감쇄 없이 분류기 출력이 기준을 넘어 차단됐다.", "Without damping, the classifier output clears the threshold and is blocked.");
      else if (damp && !block) msg = K.t("감쇄 규칙이 원래 하려던 일이다. 보안 교육 질문의 과차단을 막는다.", "This is what damping is for: it keeps a security education question from being over-blocked.");
      else msg = K.t("감쇄가 있어도 기준을 넘었다.", "Even with damping it clears the threshold.");
      read.textContent = msg;
    }

    function flow() {
      if (K.reduce) { stage = 4; render(); return; }
      stage = 1; tAcc = 0; playing = true; render();
    }
    bTrain.addEventListener("click", function () { kind = "frame"; sgKind.set("frame"); p = 0.9; sP.set(p); flow(); });
    bPlay.addEventListener("click", flow);
    K.loop(root, function (dt) {
      if (!playing) return;
      tAcc += dt;
      if (tAcc < 650) return;
      tAcc = 0;
      stage++;
      if (stage >= 4) { stage = 4; playing = false; }
      render();
    });
    render();
  });
})();
