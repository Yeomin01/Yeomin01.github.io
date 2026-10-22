/* 「평가셋을 보지 않고 갭 분석용 dev 셋을 만들었다」 글의 그림: 값을 생성기가 쓰느냐 코드가 채우느냐에 따른 정답 스팬 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("dev-set-built-without-seeing-the-gold-css", [
    '.tca[data-demo="devset-placeholder"] .dsp-doc{font-size:14px;line-height:2;padding:8px 10px;border:1px solid var(--tertiary);border-radius:6px;background:var(--theme);margin:6px 0 0}',
    '.tca[data-demo="devset-placeholder"] .dsp-ph{font-family:ui-monospace,monospace;font-size:12.5px;padding:1px 4px;border-radius:4px;background:var(--code-bg);border:1px dashed var(--tertiary)}',
    '.tca[data-demo="devset-placeholder"] .dsp-sp{padding:1px 3px;border-radius:4px;color:#111}',
    '.tca[data-demo="devset-placeholder"] .dsp-miss{text-decoration:underline wavy var(--tca-bad);text-underline-offset:4px}',
    '.tca[data-demo="devset-placeholder"] .dsp-steps{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}',
    '.tca[data-demo="devset-placeholder"] .dsp-steps .tca-tag[data-on="1"]{border-color:var(--tca-accent);color:var(--primary)}'
  ].join(""));

  K.register("devset-placeholder", function (root) {
    // 문장 조각: 글자 / 자리표시자 / 생성기가 직접 쓴 값
    var NAME = K.t("한도윤", "Han Doyun"), ORG = K.t("가나은행", "Gana Bank"), RRN = "●●●●●●-●●●●●●●";
    var TXT = {
      a: K.t(" 님의 급여 계좌는 ", ", your salary account is at "),
      b: K.t(" 입니다. 본인 확인을 위해 ", ". For verification, please write "),
      c: K.t(" 를 적어 주세요. ", " here. "),
      d: K.t(" 님 확인 후 처리합니다.", " will be confirmed before we proceed.")
    };
    var MODES = {
      // 생성기가 이름·기관명을 직접 쓰고 감싸게 한 방식 — 이름은 감싸지 않았다
      direct: [
        { raw: NAME, label: "NAME", wrapped: false },
        { text: TXT.a },
        { ph: "[[ORG:" + ORG + "]]", label: "ORG", val: ORG, src: K.t("생성기가 씀", "written by the generator") },
        { text: TXT.b },
        { ph: "[[RRN]]", label: "RRN", val: RRN, src: K.t("검증기 통과 난수", "random value that passes the validator") },
        { text: TXT.c },
        { raw: NAME, label: "NAME", wrapped: false },
        { text: TXT.d }
      ],
      // 모든 개인정보를 자리표시자로만 쓰고 값은 코드가 채우는 방식
      slot: [
        { ph: "[[NAME#1]]", label: "NAME", val: NAME, src: K.t("무작위 합성 · #1 은 같은 이름", "random synthetic · #1 is the same name") },
        { text: TXT.a },
        { ph: K.t("[[ORG:은행]]", "[[ORG:bank]]"), label: "ORG", val: ORG, src: K.t("닫힌 목록에서 고름", "picked from a closed list") },
        { text: TXT.b },
        { ph: "[[RRN]]", label: "RRN", val: RRN, src: K.t("검증기 통과 난수", "random value that passes the validator") },
        { text: TXT.c },
        { ph: "[[NAME#1]]", label: "NAME", val: NAME, src: K.t("#1 과 같은 값", "same value as #1") },
        { text: TXT.d }
      ]
    };
    var COLOR = { NAME: K.COLORS[0], ORG: K.COLORS[1], RRN: K.COLORS[5] };
    var mode = "direct", step = 0;
    var STEPS = [K.t("1. 생성기 출력", "1. Generator output"), K.t("2. 코드가 값 채우기", "2. Code fills values"), K.t("3. 정답 스팬", "3. Answer spans")];

    K.head(root, K.t("값을 누가 쓰느냐에 따라 정답이 달라진다", "Who writes the value decides the answer key"),
      K.t("같은 문장을 두 방식으로 만든다. 마지막 단계의 문장은 두 방식이 글자까지 같지만, 정답 스팬 수는 다르다.",
        "The same sentence, built two ways. At the last step the text is identical character for character, but the number of answer spans is not."));

    var bar = K.el("div", "tca-bar");
    var sMode = K.seg([
      { value: "direct", label: K.t("생성기가 값을 쓰고 감싼다", "Generator writes and wraps values") },
      { value: "slot", label: K.t("자리표시자만, 값은 코드가", "Placeholders only, code fills") }
    ], mode, function (v) { mode = v; step = 0; render(); }, K.t("생성 방식", "Generation method"));
    var bNext = K.btn(K.t("다음 단계", "Next step"));
    var bReset = K.btn(K.t("처음으로", "Start over"));
    bar.appendChild(sMode.el); bar.appendChild(bNext); bar.appendChild(bReset);
    root.appendChild(bar);

    var steps = K.el("div", "dsp-steps");
    var stepTags = STEPS.map(function (s) { var t = K.el("span", "tca-tag", s); steps.appendChild(t); return t; });
    root.appendChild(steps);
    var doc = K.el("div", "dsp-doc");
    root.appendChild(doc);
    var spans = K.el("div", "tca-rows");
    spans.style.marginTop = "10px";
    spans.style.setProperty("--tca-lw", "60px");
    root.appendChild(spans);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "이름·은행명은 예시 값이고 주민번호는 그림에서 가렸다. 본문 시범에서 생성기는 자리표시자는 지키면서 자기가 지어낸 이름은 감싸지 않았다.",
      "The name and bank are example values; the ID number is masked here. In the post's pilot, the generator kept placeholders but did not wrap names it made up itself.")));

    function chip(text, label, extra) {
      var c = K.el("span", "dsp-sp" + (extra ? " " + extra : ""), text);
      c.style.background = COLOR[label];
      return c;
    }
    function render() {
      var parts = MODES[mode];
      stepTags.forEach(function (t, i) { t.setAttribute("data-on", i === step ? "1" : "0"); });
      bNext.disabled = step >= STEPS.length - 1;
      doc.textContent = "";
      spans.textContent = "";
      var pos = 0, found = [], missing = 0;
      parts.forEach(function (p) {
        if (p.text != null) { doc.appendChild(document.createTextNode(p.text)); pos += p.text.length; return; }
        if (p.raw != null) {
          var e = K.el("span", step === 2 ? "dsp-miss" : null, p.raw);
          doc.appendChild(e);
          missing++;
          pos += p.raw.length;
          return;
        }
        if (step === 0) { doc.appendChild(K.el("span", "dsp-ph", p.ph)); return; }
        var c = chip(p.val, p.label, "tca-pop");
        if (step === 2) c.title = p.label;
        doc.appendChild(c);
        found.push({ label: p.label, s: pos, e: pos + p.val.length, src: p.src });
        pos += p.val.length;
      });
      if (step === 0) {
        read.className = "tca-read";
        read.textContent = mode === "direct"
          ? K.t("생성기 출력: 자리표시자 " + parts.filter(function (p) { return p.ph; }).length + "개. 이름은 생성기가 지어 쓰고 감싸지 않았다.",
            "Generator output: " + parts.filter(function (p) { return p.ph; }).length + " placeholders. The name was written but not wrapped.")
          : K.t("생성기 출력: 자리표시자 " + parts.filter(function (p) { return p.ph; }).length + "개. 개인정보 값은 하나도 직접 쓰지 않았다.",
            "Generator output: " + parts.filter(function (p) { return p.ph; }).length + " placeholders. No personal value is written directly.");
        return;
      }
      found.forEach(function (f) {
        var r = K.el("div", "tca-row");
        var l = K.el("div", "tca-row-l");
        l.appendChild(chip(f.label, f.label));
        var m = K.el("div", null, (step === 2 ? K.t("위치 ", "chars ") + f.s + "–" + f.e + " · " : "") + f.src);
        m.style.fontSize = "12.5px";
        m.style.minWidth = "0";
        r.appendChild(l); r.appendChild(m);
        spans.appendChild(r);
      });
      if (step === 1) {
        read.className = "tca-read";
        read.textContent = K.t("코드가 값을 채우는 순간 그 자리의 위치를 안다.", "The code knows each position the moment it fills a value.");
        return;
      }
      read.className = "tca-read " + (missing ? "tca-bad" : "tca-good");
      read.textContent = missing
        ? K.t("정답 스팬 " + found.length + "개. 물결 밑줄의 이름 " + missing + "곳은 정답에 없어서 잴 수 없다.",
          found.length + " answer spans. The " + missing + " wavy-underlined names are missing from the key and cannot be measured.")
        : K.t("정답 스팬 " + found.length + "개. 생성기의 판단과 무관하게 모든 자리가 정답에 들어갔다.",
          found.length + " answer spans. Every slot is in the key regardless of the generator's judgement.");
    }
    bNext.addEventListener("click", function () { if (step < STEPS.length - 1) { step++; render(); } });
    bReset.addEventListener("click", function () { step = 0; render(); });
    render();
  });
})();
