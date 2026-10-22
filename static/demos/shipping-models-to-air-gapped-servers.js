/* 「모델을 폐쇄망에 납품하는 방식」 글의 그림: 갱신 절차에서 한 단계를 빼면 생기는 일 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("shipping-models-to-air-gapped-servers-css", [
    '.tca[data-demo="airgap-steps"] .ag-route{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 6px;font-size:12.5px}',
    '.tca[data-demo="airgap-steps"] .ag-route b{font-weight:600;min-width:64px}',
    '.tca[data-demo="airgap-steps"] .ag-step{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border:1px solid var(--tertiary);border-radius:6px;min-width:0}',
    '.tca[data-demo="airgap-steps"] .ag-step[data-now="1"]{border-color:var(--tca-accent);box-shadow:inset 0 0 0 1px var(--tca-accent)}',
    '.tca[data-demo="airgap-steps"] .ag-ic{flex:none;width:22px;text-align:center;font-weight:700}',
    '.tca[data-demo="airgap-steps"] .ag-tx{flex:1;min-width:0;font-size:13px}',
    '.tca[data-demo="airgap-steps"] .ag-ef{font-size:12.5px;color:var(--secondary)}',
    '.tca[data-demo="airgap-steps"] .ag-step .tca-btn{flex:none;font-size:12px;padding:2px 8px}'
  ].join(""));

  K.register("airgap-steps", function (root) {
    var PLANS = {
      model: [
        { n: K.t("체크섬 대조", "Verify checksums"), skip: K.t("전송 중 손상이 있었다면 기동은 되는데 탐지 결과만 조용히 틀린다.", "If something was damaged in transit, the service starts but detections are silently wrong."), silent: true },
        { n: K.t("함께 바꿔야 하는 설정 확인 (1차 모델과 결합기는 짝으로)", "Check settings that change together (first-stage model and combiner as a pair)"), skip: K.t("1차만 바꾸면 결합기가 받는 점수 분포가 달라져 판정이 무너진다.", "Swapping only the first stage shifts the scores the combiner sees and its decisions collapse."), silent: true },
        { n: K.t("이번에 온 모델만 교체, 나머지는 백업에서 되돌림", "Replace only the models that came; restore the rest from backup"), skip: K.t("모델 디렉터리를 통째로 바꾸면 이번에 오지 않은 모델이 사라진다.", "Replacing the whole directory drops the models that were not in this delivery.") },
        { n: K.t("옛 키 제거", "Remove the old key"), skip: K.t("옛 키가 남아 있어 새 키 등록이 '이미 등록됨'으로 건너뛰어진다.", "With the old key still there, registering the new one is skipped as 'already registered'.") },
        { n: K.t("새 키 등록 (묶음과 다른 경로로 받은 키)", "Register the new key (received by a separate route)"), skip: K.t("키는 납품마다 바뀐다. 모델을 갱신하면 키도 다시 등록해야 한다.", "The key changes with every delivery. Updating the model means registering the key again.") },
        { n: K.t("재기동", "Restart"), skip: K.t("키 파일은 기동할 때만 읽으므로 등록한 키가 반영되지 않는다.", "The key file is read only at start-up, so the new key is not picked up.") },
        { n: K.t("구성 요소별 로드 결과 확인", "Check what each component actually loaded"), skip: K.t("파일 하나가 빠져 판별기가 조용히 꺼져도, 기동 로그에는 '판별기 포함'으로 찍힐 수 있다.", "If one file is missing and a discriminator silently turns off, the start-up log may still say it is included."), silent: true }
      ],
      hotfix: [
        { n: K.t("체크섬 대조", "Verify checksums"), skip: K.t("전송 중 손상을 맨 앞에서 잡지 못한다.", "Transit damage is not caught up front."), silent: true },
        { n: K.t("새 이미지 docker load", "docker load the new image"), fixed: true },
        { n: K.t("새 묶음의 설정으로 띄우기", "Start with the new bundle's config"), skip: K.t("compose가 참조하는 태그가 설정 파일에 고정돼 있어, load만 하고 다시 띄우면 옛 이미지가 뜬다.", "The tag compose uses is pinned in the config, so loading and restarting brings up the old image.") },
        { n: K.t("키·설정이 든 상태 디렉터리를 이전 설치에서 옮겨 오기", "Carry over the state directory with the key and settings"), skip: K.t("키가 없으면 서비스가 기동하지 않는다.", "Without the key the service does not start.") },
        { n: K.t("모델 디렉터리는 그대로 둔다", "Leave the model directory as is"), fixed: true },
        { n: K.t("구성 요소별 로드 결과 확인", "Check what each component actually loaded"), skip: K.t("어느 구성 요소가 조용히 꺼졌는지 기동 로그만으로는 모를 수 있다.", "The start-up log alone may not show a component that silently turned off."), silent: true }
      ]
    };
    var plan = "model", on = {}, cursor = -1, running = false, acc = 0;

    K.head(root, K.t("갱신 절차에서 한 단계를 빼 보기", "Drop one step from the update procedure"),
      K.t("본문의 '운영하며 걸린 것들'을 절차로 옮겼다. 단계를 하나 빼고 실행하면, 그 단계가 막던 문제가 결과에 나온다. 몇 개는 에러 없이 조용히 지나간다.",
        "The post's operational issues, laid out as a procedure. Drop a step and run it to see the problem that step prevents. Some pass silently, with no error."));

    var routes = K.el("div");
    function route(label, items, color) {
      var r = K.el("div", "ag-route");
      r.appendChild(K.el("b", null, label));
      items.forEach(function (t) { var c = K.el("span", "tca-chip", t); c.style.background = color; r.appendChild(c); });
      routes.appendChild(r);
    }
    route(K.t("납품 경로", "Delivery"), [K.t("이미지 tar", "image tar"), K.t("모델 묶음 (암호화)", "model bundle (encrypted)"), K.t("체크섬 목록", "checksum list")], K.COLORS[0]);
    route(K.t("다른 경로", "Separate"), [K.t("데이터 키 (납품마다 새로)", "data key (new each delivery)")], K.COLORS[6]);
    root.appendChild(routes);

    var bar = K.el("div", "tca-bar");
    bar.style.marginTop = "8px";
    var sPlan = K.seg([{ value: "model", label: K.t("모델 갱신 (일부 모델)", "Model update (some models)") }, { value: "hotfix", label: K.t("이미지 핫픽스", "Image hotfix") }],
      plan, function (v) { plan = v; resetPlan(); }, K.t("절차", "Procedure"));
    var bRun = K.btn(K.t("절차 실행", "Run the procedure"));
    var bAll = K.btn(K.t("모든 단계 하기", "Do every step"));
    bar.appendChild(sPlan.el); bar.appendChild(bRun); bar.appendChild(bAll);
    root.appendChild(bar);

    var list = K.el("div", "tca-rows");
    list.style.gap = "6px";
    root.appendChild(list);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var res = K.el("ul", "tca-note");
    res.style.paddingLeft = "18px";
    root.appendChild(res);
    root.appendChild(K.el("div", "tca-note", K.t(
      "단계와 결과 문장은 본문에 적힌 것만 옮겼다. 단계를 빼는 것은 그 실수가 생겼다고 가정한 것이다.",
      "Steps and outcomes are only those in the post. Dropping a step assumes that mistake happened.")));

    var rows = [];
    function resetPlan() {
      on = {}; cursor = -1; running = false;
      PLANS[plan].forEach(function (s, i) { on[i] = true; });
      build();
    }
    function build() {
      list.textContent = ""; rows = [];
      PLANS[plan].forEach(function (s, i) {
        var r = K.el("div", "ag-step");
        var ic = K.el("div", "ag-ic", String(i + 1));
        var tx = K.el("div", "ag-tx");
        tx.appendChild(K.el("div", null, s.n));
        var ef = K.el("div", "ag-ef", "");
        tx.appendChild(ef);
        r.appendChild(ic); r.appendChild(tx);
        if (!s.fixed) {
          var b = K.btn(K.t("한다", "do"), true);
          b.addEventListener("click", function () {
            on[i] = !on[i]; K.press(b, on[i]); b.textContent = on[i] ? K.t("한다", "do") : K.t("뺀다", "skip");
            cursor = -1; running = false; draw();
          });
          r.appendChild(b);
        }
        list.appendChild(r);
        rows.push({ r: r, ic: ic, ef: ef });
      });
      draw();
    }
    function draw() {
      var P = PLANS[plan];
      rows.forEach(function (o, i) {
        var done = cursor >= i, s = P[i];
        o.r.setAttribute("data-now", running && cursor === i ? "1" : "0");
        if (!done) { o.ic.textContent = String(i + 1); o.ic.className = "ag-ic"; o.ef.textContent = ""; return; }
        if (on[i]) { o.ic.textContent = "✓"; o.ic.className = "ag-ic tca-good"; o.ef.textContent = ""; }
        else { o.ic.textContent = s.silent ? "?" : "!"; o.ic.className = "ag-ic " + (s.silent ? "tca-warn" : "tca-bad"); o.ef.textContent = s.skip; }
      });
      res.textContent = "";
      var skipped = P.filter(function (s, i) { return !on[i]; });
      if (cursor < 0) { read.className = "tca-read"; read.textContent = skipped.length ? K.t("뺀 단계 " + skipped.length + "개. '절차 실행'을 눌러 본다.", skipped.length + " step(s) dropped. Press Run.") : K.t("모든 단계를 한다. '절차 실행'을 눌러 본다.", "Every step is on. Press Run."); return; }
      if (cursor < P.length - 1) { read.className = "tca-read"; read.textContent = K.t("실행 중 — " + (cursor + 1) + "/" + P.length + "단계", "Running — step " + (cursor + 1) + "/" + P.length); return; }
      if (!skipped.length) { read.className = "tca-read tca-good"; read.textContent = K.t("끝까지 문제 없이 갱신됐다.", "Updated with no problem."); return; }
      var silent = skipped.filter(function (s) { return s.silent; }).length;
      read.className = "tca-read tca-bad";
      read.textContent = K.t("뺀 단계 " + skipped.length + "개", skipped.length + " dropped") +
        (silent ? K.t(" — 그중 " + silent + "개는 에러 없이 지나가는 조용한 실패(?)다.", " — " + silent + " of them fail silently (?).") : K.t(" — 모두 그 자리에서 드러나는 문제(!)다.", " — all show up right away (!)."));
      skipped.forEach(function (s) { res.appendChild(K.el("li", null, s.n + " — " + s.skip)); });
    }
    K.loop(root, function (dt) {
      if (!running) return;
      acc += dt;
      if (acc < 550) return;
      acc = 0;
      cursor++;
      if (cursor >= PLANS[plan].length - 1) { cursor = PLANS[plan].length - 1; running = false; }
      draw();
    });
    bRun.addEventListener("click", function () {
      if (K.reduce) { cursor = PLANS[plan].length - 1; running = false; draw(); return; }
      cursor = -1; acc = 0; running = true; draw();
    });
    bAll.addEventListener("click", function () { resetPlan(); });
    resetPlan();
  });
})();
