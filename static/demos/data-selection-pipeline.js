/* 「대규모 합성 데이터를 선별하는 3단계 파이프라인」 글의 그림: 단계마다 무엇이 걸러지는지, 노이즈 제거를 빼면 무엇이 남는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("data-selection-pipeline-css", [
    '.tca[data-demo="selpipe-flow"] .sp-steps{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 10px}',
    '.tca[data-demo="selpipe-flow"] .sp-step{font-size:12px;padding:2px 8px;border-radius:10px;border:1px solid var(--tertiary);color:var(--secondary)}',
    '.tca[data-demo="selpipe-flow"] .sp-step.on{background:var(--primary);color:var(--theme);border-color:var(--primary)}',
    '.tca[data-demo="selpipe-flow"] .sp-step.skip{text-decoration:line-through}',
    '.tca[data-demo="selpipe-flow"] .sp-pool{display:flex;flex-wrap:wrap;gap:4px}',
    '.tca[data-demo="selpipe-flow"] .sp-c{width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;',
    'font-size:12px;font-weight:600;color:#111;transition:opacity .4s ease,transform .4s ease,box-shadow .3s ease}',
    '.tca[data-demo="selpipe-flow"] .sp-c.out{opacity:.14;transform:scale(.7)}',
    '.tca[data-demo="selpipe-flow"] .sp-c.up{box-shadow:0 0 0 2px var(--entry),0 0 0 4px var(--primary)}',
    '.tca[data-demo="selpipe-flow"] .sp-stack{display:flex;height:18px;border-radius:3px;overflow:hidden;background:var(--code-bg);margin-top:4px}',
    '.tca[data-demo="selpipe-flow"] .sp-stack div{height:100%;transition:width .4s ease}',
    '@media (prefers-reduced-motion:reduce){.tca[data-demo="selpipe-flow"] .sp-c,.tca[data-demo="selpipe-flow"] .sp-stack div{transition:none}}'
  ].join(""));

  K.register("selpipe-flow", function (root) {
    // 예시 값: 60건의 합성 데이터
    var TYPES = [
      { id: "A", n: 12, tpl: true, ch: K.t("A", "A"), label: K.t("템플릿 A(전형·중복)", "Template A (typical, duplicate)"), color: K.COLORS[0] },
      { id: "B", n: 10, tpl: true, ch: K.t("B", "B"), label: K.t("템플릿 B", "Template B"), color: K.COLORS[5] },
      { id: "C", n: 8, tpl: true, ch: K.t("C", "C"), label: K.t("템플릿 C", "Template C"), color: K.COLORS[7] },
      { id: "D", n: 12, ch: K.t("다", "D"), label: K.t("다양한 문장", "Diverse sentence"), color: K.COLORS[3] },
      { id: "W", n: 10, ch: K.t("약", "W"), label: K.t("약한 카테고리의 경계 case", "Weak-category boundary case"), color: K.COLORS[6] },
      { id: "N", n: 8, ch: K.t("오", "N"), label: K.t("라벨 오류(노이즈)", "Label error (noise)"), color: K.COLORS[2] }
    ];
    var items = [];
    TYPES.forEach(function (ty) { for (var i = 0; i < ty.n; i++) items.push({ t: ty, k: i }); });
    // 고정된 순서로 섞는다
    var seed = 5;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = items[i]; items[i] = items[j]; items[j] = tmp; }

    // 단계별 판정. 반환: {keep, up}
    var STAGE = {
      quality: function (it) { return { keep: it.t.id !== "N" }; },
      diversity: function (it) { return { keep: it.t.tpl ? it.k === 0 : true }; },     // 노이즈는 특이해 보여 그대로 남는다
      hardfirst: function (it) { return { keep: it.t.tpl ? it.k === 0 : true }; },     // hard 우선: 오라벨은 어려운 example 로 보인다
      importance: function (it) {
        if (it.t.id === "W") return { keep: true, up: true };
        if (it.t.id === "D") return { keep: it.k < 4 };
        if (it.t.id === "N") return { keep: true };                                   // 노이즈 제거가 없으면 걸러낼 단계가 없다
        return { keep: true };
      }
    };
    var ORDERS = {
      plan: [
        { key: "quality", name: K.t("1단계 품질 필터", "1 Quality filter"), says: K.t("규칙 검증·Confident Learning 으로 라벨 오류 후보를 먼저 뺀다.", "Rule checks and Confident Learning remove label-error candidates first.") },
        { key: "diversity", name: K.t("2단계 다양성 선별", "2 Diversity selection"), says: K.t("중심에 가까운 전형·중복 example 을 공격적으로 줄여 템플릿마다 대표만 남긴다.", "Typical and duplicate examples near a centre are cut hard; one representative per template remains.") },
        { key: "importance", name: K.t("3단계 분포 보정", "3 Distribution reweighting"), says: K.t("약한 카테고리의 경계 case 비중을 높이고, 이미 잘하는 영역은 최소한만 둔다.", "Weak-category boundary cases are weighted up; areas already handled well keep a minimum.") }
      ],
      nofilter: [
        { key: null, name: K.t("품질 필터 없음", "No quality filter"), says: K.t("라벨이 깨끗하다고 보고 품질 필터를 건너뛴다.", "Assume clean labels and skip the quality filter.") },
        { key: "hardfirst", name: K.t("난이도·다양성 선별", "Difficulty/diversity selection"), says: K.t("hard·특이한 example 을 우선 남긴다. 오라벨은 모델 예측과 어긋나 어려운 example 로 보여 살아남는다.", "Hard and unusual examples are kept first. Mislabels disagree with the model, look hard, and survive.") },
        { key: "importance", name: K.t("분포 보정", "Distribution reweighting"), says: K.t("약한 카테고리 비중을 높인다. 노이즈를 걸러낼 단계는 이미 지나갔다.", "Weak categories are weighted up. The step that would drop noise never ran.") }
      ]
    };

    var order = "plan", stage = 0, playing = !K.reduce, acc = 0, STEP_MS = 1800;
    if (K.reduce) stage = 3;

    K.head(root, K.t("세 단계가 무엇을 걸러 내나", "What each stage removes"),
      K.t("칸 하나가 학습 example 하나다. 단계를 넘기면 걸러진 칸이 흐려진다. 순서를 노이즈 제거 없이로 바꾸면 라벨 오류가 끝까지 남는다.",
        "Each square is one training example. Step through and the removed ones fade. Switch to the no-filter order and the label errors survive to the end."));

    var bar = K.el("div", "tca-bar");
    var sOrder = K.seg([
      { value: "plan", label: K.t("설계안: 노이즈 제거 먼저", "Design: noise removal first") },
      { value: "nofilter", label: K.t("노이즈 제거 없이 선별", "Select without noise removal") }
    ], order, function (v) { order = v; stage = K.reduce ? 3 : 0; acc = 0; playing = !K.reduce; render(); }, K.t("순서", "Order"));
    var bPlay = K.btn(K.t("일시정지", "Pause"), playing);
    var bNext = K.btn(K.t("다음 단계", "Next stage"));
    var bReset = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(sOrder.el); bar.appendChild(bPlay); bar.appendChild(bNext); bar.appendChild(bReset);
    root.appendChild(bar);

    var steps = K.el("div", "sp-steps");
    root.appendChild(steps);
    var stepEls = [];
    for (var s = 0; s < 4; s++) { var e = K.el("span", "sp-step"); steps.appendChild(e); stepEls.push(e); }

    var box = K.el("div", "tca-box");
    var pool = K.el("div", "sp-pool");
    box.appendChild(pool);
    var chips = items.map(function (it) {
      var c = K.el("div", "sp-c", it.t.ch);
      c.style.background = it.t.color;
      c.title = it.t.label;
      pool.appendChild(c);
      return c;
    });
    var lg = K.el("div", "tca-legend");
    TYPES.forEach(function (ty) {
      var sp = K.el("span"); var ic = K.el("i"); ic.style.background = ty.color;
      sp.appendChild(ic); sp.appendChild(document.createTextNode(ty.tpl ? ty.label : ty.ch + " = " + ty.label)); lg.appendChild(sp);
    });
    var upLg = K.el("span"); var ui = K.el("i"); ui.style.outline = "2px solid var(--primary)"; ui.style.outlineOffset = "1px";
    upLg.appendChild(ui); upLg.appendChild(document.createTextNode(K.t("테두리 = 비중을 높인 것", "Outline = weighted up"))); lg.appendChild(upLg);
    box.appendChild(lg);
    root.appendChild(box);

    var compL = K.el("div", "tca-note", K.t("남은 구성", "What remains"));
    var stack = K.el("div", "sp-stack");
    var segs = TYPES.map(function (ty) { var d = K.el("div"); d.style.background = ty.color; stack.appendChild(d); return d; });
    root.appendChild(compL); root.appendChild(stack);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "개수와 단계별 판정은 예시 값이다. 본문의 설계안은 아직 검증 전이고, 그림은 순서가 무엇을 남기는지만 보여 준다. 성능은 재지 않는다.",
      "Counts and per-stage rules are example values. The design in the post is not yet validated; the figure only shows what each order leaves behind, not performance.")));

    function compute() {
      var st = items.map(function () { return { keep: true, up: false }; });
      var seq = ORDERS[order];
      for (var k = 0; k < stage; k++) {
        var key = seq[k].key;
        if (!key) continue;
        items.forEach(function (it, i) {
          if (!st[i].keep) return;
          var res = STAGE[key](it);
          st[i].keep = res.keep;
          if (res.up) st[i].up = true;
        });
      }
      return st;
    }

    function render() {
      sOrder.set(order);
      var seq = ORDERS[order];
      stepEls[0].textContent = K.t("원본", "Raw");
      stepEls[0].className = "sp-step" + (stage === 0 ? " on" : "");
      for (var k = 0; k < 3; k++) {
        stepEls[k + 1].textContent = seq[k].name;
        stepEls[k + 1].className = "sp-step" + (stage === k + 1 ? " on" : "") + (seq[k].key ? "" : " skip");
      }
      var st = compute(), left = 0, cnt = {};
      TYPES.forEach(function (ty) { cnt[ty.id] = 0; });
      st.forEach(function (x, i) {
        chips[i].className = "sp-c" + (x.keep ? "" : " out") + (x.keep && x.up ? " up" : "");
        if (x.keep) { left++; cnt[items[i].t.id]++; }
      });
      TYPES.forEach(function (ty, i) { segs[i].style.width = (left ? cnt[ty.id] / left * 100 : 0) + "%"; });
      var noise = cnt.N, pct = Math.round(left / items.length * 100);
      var head = stage === 0 ? K.t("원본 합성 데이터 60건 — 중복·노이즈·편향이 섞여 있다.", "60 raw synthetic examples — duplicates, noise and skew mixed in.")
        : seq[stage - 1].name + " — " + seq[stage - 1].says;
      read.textContent = head + K.t(" 남음 ", " Left: ") + left + "/" + items.length + " (" + pct + "%)" +
        K.t(" · 그중 라벨 오류 ", " · label errors among them: ") + noise + K.t("건", "") +
        (left ? " (" + Math.round(noise / left * 100) + "%)" : "") +
        K.t(" · 약한 카테고리 ", " · weak category: ") + (left ? Math.round(cnt.W / left * 100) : 0) + "%";
      read.className = "tca-read" + (stage === 3 && noise > 0 ? " tca-bad" : "");
      bNext.disabled = stage >= 3;
      K.press(bPlay, playing);
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : (stage >= 3 ? K.t("다시 재생", "Replay") : K.t("재생", "Play"));
    }

    bPlay.addEventListener("click", function () {
      if (!playing && stage >= 3) stage = 0;
      playing = !playing; acc = 0; render();
    });
    bNext.addEventListener("click", function () { if (stage < 3) { stage++; playing = false; render(); } });
    bReset.addEventListener("click", function () { stage = 0; acc = 0; playing = !K.reduce; render(); });

    K.loop(root, function (dt) {
      if (!playing) return;
      acc += dt;
      if (acc < STEP_MS) return;
      acc = 0;
      if (stage < 3) { stage++; if (stage === 3) playing = false; render(); }
    });

    render();
  });
})();
