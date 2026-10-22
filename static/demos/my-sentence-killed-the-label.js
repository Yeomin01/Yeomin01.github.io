/* 「탐지기가 아니라 내 문장이 라벨을 죽였다」 글의 그림: 같은 기관명 값을 두 캐리어 문장에 넣었을 때 기준선이 8%와 100%로 갈리는 모습 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("carrier-baseline", function (root) {
    var VALS = ["가람물산", "누리전자", "다솜건설", "마루통상", "바다해운", "새벽출판", "아름제약", "자람교육", "차오름물류", "하늬화학",
      "고운섬유", "나래항공", "단비유통", "별빛미디어", "소담건축", "여울식품", "윤슬전기", "푸름농산", "한결보험", "그루가구",
      "늘봄의료", "도담기계", "미르게임즈", "보람전자", "시루제과"];
    var HIT_UNBOUND = [6, 18]; // 25개 중 2개 = 8%. 어느 값인지는 예시
    // 캐리어 문장과 값은 한국어 자료라 영어판에서도 그대로 둔다
    var CAR = {
      unbound: { pre: "고객님 확인된 정보는 ", post: " 입니다. 맞으신가요?" },
      bound: { pre: "홍길동 고객님은 ", post: " 소속으로 등록되어 있습니다." }
    };
    var car = "unbound", n = 0, acc = 0, playing = !K.reduce, PER = 260;

    K.css("my-sentence-killed-the-label-css", [
      '.tca[data-demo="carrier-baseline"] .cb-s{font-size:15px;border:1px solid var(--tertiary);border-radius:6px;padding:10px;margin:0 0 10px;background:var(--theme)}',
      '.tca[data-demo="carrier-baseline"] .cb-s b{border-bottom:2px solid var(--tca-accent);padding:0 2px}',
      '.tca[data-demo="carrier-baseline"] .cb-g{display:grid;grid-template-columns:repeat(25,minmax(0,1fr));gap:2px}',
      '@media (max-width:600px){.tca[data-demo="carrier-baseline"] .cb-g{grid-template-columns:repeat(13,minmax(0,1fr))}}',
      '.tca[data-demo="carrier-baseline"] .cb-g i{display:block;height:16px;border-radius:3px;background:var(--code-bg);border:1px solid var(--tertiary)}',
      '.tca[data-demo="carrier-baseline"] .cb-g i.y{background:var(--tca-good);border-color:var(--tca-good)}',
      '.tca[data-demo="carrier-baseline"] .cb-g i.n{background:var(--secondary);opacity:.45}',
      '.tca[data-demo="carrier-baseline"] ol{margin:8px 0 0;padding-left:20px;font-size:13px}',
      '.tca[data-demo="carrier-baseline"] ol li[data-on="1"]{color:var(--tca-bad);font-weight:600}'
    ].join(""));

    K.head(root, K.t("같은 값, 다른 캐리어 문장", "Same values, different carrier sentence"),
      K.t("기관명 값 25개를 캐리어 문장의 {값} 자리에 차례로 넣어 탐지한다. 개인과의 결합이 없는 문장에서는 정책이 정상적으로 걸러 내고, 개인을 묶는 문장에서는 전부 잡힌다.",
        "25 organization names go one by one into the {value} slot of a carrier sentence. With no link to a person the policy correctly filters them; in a sentence that ties a person, all are caught."));

    var bar = K.el("div", "tca-bar");
    var cSeg = K.seg([{ value: "unbound", label: K.t("결합 없는 캐리어", "Unlinked carrier") }, { value: "bound", label: K.t("개인을 묶는 캐리어", "Person-linked carrier") }], car,
      function (v) { car = v; restart(); }, K.t("캐리어 문장", "Carrier sentence"));
    var bPlay = K.btn("", playing);
    var bAgain = K.btn(K.t("처음부터", "Restart"));
    bar.appendChild(cSeg.el); bar.appendChild(bPlay); bar.appendChild(bAgain);
    root.appendChild(bar);

    var sent = K.el("div", "cb-s");
    root.appendChild(sent);
    var grid = K.el("div", "cb-g");
    var cells = VALS.map(function () { var c = document.createElement("i"); grid.appendChild(c); return c; });
    root.appendChild(grid);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var ol = document.createElement("ol");
    var steps = [K.t("내 문장이 그 라벨을 살릴 수 있는 문장인가", "Can my sentence make that label hold?"),
      K.t("내 값이 애초에 탐지 대상인가", "Is my value a detection target at all?"), K.t("탐지기가 고장났나", "Is the detector broken?")]
      .map(function (s) { var li = K.el("li", "", s); ol.appendChild(li); return li; });
    root.appendChild(K.el("div", "tca-h", K.t("기준선이 낮을 때 의심하는 순서", "What to suspect first when the baseline is low")));
    root.lastChild.style.marginTop = "10px";
    root.appendChild(ol);
    root.appendChild(K.el("div", "tca-note", K.t(
      "캐리어 문장 둘과 8%·100%는 본문 값이다. 기관명 25개는 지어낸 예시이고, 결합 없는 문장에서 어느 두 값이 잡혔는지도 예시다.",
      "Both carriers and the 8% / 100% are from the post. The 25 names are invented, and which two were caught in the unlinked carrier is illustrative.")));

    function hit(i) { return car === "bound" || HIT_UNBOUND.indexOf(i) >= 0; }
    function restart() {
      n = 0; acc = 0; playing = !K.reduce;
      if (K.reduce) n = VALS.length;
      render();
    }
    function render() {
      var c = CAR[car];
      sent.textContent = "";
      sent.appendChild(document.createTextNode(c.pre));
      sent.appendChild(K.el("b", "", n > 0 ? VALS[n - 1] : "{" + K.t("값", "value") + "}"));
      sent.appendChild(document.createTextNode(c.post));
      var y = 0;
      cells.forEach(function (e, i) {
        if (i < n) { e.className = hit(i) ? "y" : "n"; if (hit(i)) y++; } else e.className = "";
        e.title = VALS[i];
      });
      read.textContent = K.t("잡힌 값 ", "Caught ") + y + " / " + n + (n ? " (" + Math.round(y / n * 100) + "%)" : "") +
        (n >= VALS.length ? (car === "bound" ? K.t(" — 기준선 100%. 가드도 데이터도 멀쩡했다.", " — baseline 100%. Guard and data were fine.")
          : K.t(" — 기준선 8%. 이 문장에는 개인과의 결합이 없다.", " — baseline 8%. This sentence has no link to a person.")) : "");
      steps.forEach(function (li, i) { li.setAttribute("data-on", n >= VALS.length && car === "unbound" && i === 0 ? "1" : "0"); });
      bPlay.textContent = playing ? K.t("일시정지", "Pause") : (n >= VALS.length ? K.t("다시 재생", "Replay") : K.t("재생", "Play"));
      K.press(bPlay, playing);
    }
    bPlay.addEventListener("click", function () {
      if (n >= VALS.length) { n = 0; acc = 0; playing = true; }
      else playing = !playing;
      render();
    });
    bAgain.addEventListener("click", restart);
    K.loop(root, function (dt) {
      if (!playing) return;
      acc += dt;
      if (acc < PER) return;
      acc = 0; n++;
      if (n >= VALS.length) { n = VALS.length; playing = false; }
      render();
    });
    restart();
  });
})();
