/* 「없는 신호는 구조로 만들 수 없다」 글의 그림: 손실·구조를 바꾼 시도와 데이터 한 계열을 넣은 시도의 결과 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("no-architecture-invents-a-missing-signal-css",
    '.tca[data-demo="arch-same-place"] .as-ghost{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--secondary);opacity:.28;transition:width .35s ease}' +
    '.tca[data-demo="arch-same-place"] .tca-fill{top:4px;bottom:4px}' +
    '.tca[data-demo="arch-same-place"] .as-na{position:absolute;left:8px;top:0;font-size:11.5px;line-height:16px;color:var(--secondary)}' +
    '.tca[data-demo="arch-same-place"] .as-top{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:0 0 8px}' +
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="arch-same-place"] .as-ghost{transition:none}}');

  K.register("arch-same-place", function (root) {
    var NA = null;
    // [이전, 이후] — 글 본문 값. null 은 글에 숫자가 없음.
    var A = [
      { id: "sc1", kind: K.t("표현 손실", "Representation loss"), label: K.t("대조·약한 λ", "Contrastive · weak λ"),
        name: K.t("대조 손실, 약한 λ (projection 없이 raw CLS)", "Contrastive loss, weak λ (raw CLS, no projection)"),
        ci: [0.16, 0.35], wj: NA, fp: NA, msg: K.t("cipher 가 조금 올랐다.", "cipher rose a little.") },
      { id: "sc2", kind: K.t("표현 손실", "Representation loss"), label: K.t("대조·강한 λ", "Contrastive · strong λ"),
        name: K.t("대조 손실, projection head + 큰 λ", "Contrastive loss, projection head + larger λ"),
        ci: [0.16, 0.002], wj: NA, fp: NA, msg: K.t("공격을 밀어내며 정상 표현까지 무너뜨렸다.", "Pushing attacks away collapsed the benign representation too.") },
      { id: "gru", kind: K.t("구조", "Architecture"), label: K.t("궤적 GRU", "Trajectory GRU"),
        name: K.t("턴별 인코딩 + GRU", "Per-turn encoding + GRU"),
        ci: [0.74, 0.60], wj: [0.75, 0.13], fp: [0.22, 0.02], msg: K.t("오탐은 22% → 2%로 떨어졌고 공격 재현율이 같이 무너졌다.", "False positives fell 22% → 2% and attack recall fell with them.") },
      { id: "xb", kind: K.t("손실", "Loss"), label: K.t("비대칭 경계", "Asymmetric boundary"),
        name: K.t("비대칭 경계 손실", "Asymmetric boundary loss"),
        ci: [0.74, 0.03], wj: [0.75, 0.09], fp: NA, msg: K.t("두 계열 모두 0 근처로 갔다.", "Both families went near 0.") },
      { id: "pk", kind: K.t("구조", "Architecture"), label: K.t("peak 집계", "Peak aggregation"),
        name: K.t("위험 점수의 peak 집계", "Peak aggregation of risk scores"),
        ci: [0.74, 0], wj: NA, fp: NA, msg: K.t("cipher 는 에폭 3부터 0이었다.", "cipher was 0 from epoch 3.") },
      { id: "tf", kind: K.t("구조", "Architecture"), label: K.t("턴 Transformer", "Turn Transformer"),
        name: K.t("턴 임베딩 위 self-attention", "Self-attention over turn embeddings"),
        ci: NA, wj: NA, fp: NA, msg: K.t("글에 숫자는 없고, 결과는 같은 자리였다고만 적혀 있다.", "No numbers in the post; it only says it ended in the same place.") },
      { id: "data", kind: K.t("데이터", "Data"), label: K.t("데이터 한 계열", "One data family"),
        name: K.t("같은 치환암호 구조의 학습 데이터 추가 (앞선 실험)", "Add training data with the same substitution-cipher structure (earlier run)"),
        ci: [NA, 0.99], wj: NA, fp: NA, approx: true,
        msg: K.t("구조 대신 데이터를 바꾸자 cipher 가 거의 1.0까지 살아났다.", "Changing the data instead of the architecture brought cipher back to almost 1.0.") }
    ];
    var cur = 0, playing = false, acc = 0;

    K.head(root, K.t("손실·구조를 바꿔도 같은 자리", "Different loss or architecture, same place"),
      K.t("각 시도의 결과를 이전 값(옅은 막대) 위에 겹쳐 그렸다. 마지막 칸은 구조가 아니라 무너진 계열의 데이터를 넣은 경우다.",
        "Each attempt's result is drawn over the previous value (pale bar). The last entry changes the data, not the architecture."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg(A.map(function (a, i) { return { value: i, label: a.label }; }), 0, function (v) { cur = v; acc = 0; render(); },
      K.t("시도", "Attempt"));
    var bPlay = K.btn(K.t("차례로 보기", "Step through"), false);
    bPlay.addEventListener("click", function () { playing = !playing; acc = 0; K.press(bPlay, playing); });
    bar.appendChild(sg.el); bar.appendChild(bPlay);
    root.appendChild(bar);

    var top = K.el("div", "as-top");
    var tag = K.el("span", "tca-tag");
    var nm = K.el("span", "tca-h");
    nm.style.margin = "0";
    top.appendChild(tag); top.appendChild(nm);
    root.appendChild(top);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "100px");
    rows.style.setProperty("--tca-rw", "104px");
    function row(label, color) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), g = K.el("div", "as-ghost"), f = K.el("div", "tca-fill"),
        na = K.el("div", "as-na", K.t("글에 숫자 없음", "not in the post")), v = K.el("div", "tca-row-r");
      f.style.background = color;
      tr.appendChild(g); tr.appendChild(f); tr.appendChild(na);
      r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { g: g, f: f, na: na, v: v };
    }
    var rC = row(K.t("cipher 재현율", "cipher recall"), "var(--tca-accent)");
    var rW = row(K.t("wj_mt 재현율", "wj_mt recall"), "var(--tca-good)");
    var rF = row(K.t("정상 오탐", "Benign FP"), "var(--tca-bad)");
    root.appendChild(rows);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "숫자는 글 본문의 값이다. 대조 손실 두 칸은 이전 값이 0.16이라 나머지 칸(0.74·0.75)과 기준이 다르다. 데이터 한 계열 칸은 글이 '거의 1.0'이라고만 적어 0.99로 그렸다.",
      "Numbers are from the post. The two contrastive entries start from 0.16, a different baseline from the others (0.74 · 0.75). The post says only 'almost 1.0' for the data entry, drawn as 0.99.")));

    function v2(x, approx) { return x === null ? "—" : (approx ? "≈1.0" : (x < 0.01 && x > 0 ? x.toFixed(3) : x.toFixed(2))); }
    function fill(r, pair, approx) {
      if (!pair) { r.g.style.width = "0"; r.f.style.width = "0"; r.na.style.display = ""; r.v.textContent = ""; return; }
      r.na.style.display = "none";
      r.g.style.width = (pair[0] === null ? 0 : pair[0] * 100) + "%";
      r.f.style.width = pair[1] * 100 + "%";
      r.v.textContent = v2(pair[0]) + " → " + v2(pair[1], approx);
    }
    function render() {
      var a = A[cur];
      sg.set(cur);
      tag.textContent = a.kind; nm.textContent = a.name;
      fill(rC, a.ci, a.approx); fill(rW, a.wj); fill(rF, a.fp);
      read.textContent = (cur + 1) + "/" + A.length + " — " + a.msg;
    }
    K.loop(root, function (dt) {
      if (!playing) return;
      acc += dt;
      if (acc >= 2400) { acc = 0; cur = (cur + 1) % A.length; render(); }
    });
    render();
  });
})();
