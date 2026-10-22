/* 「두 방어가 서로 반대 입력을 요구했다」 글의 그림: 정규식에 어떤 텍스트를 넘기느냐에 따라 두 방어가 번갈아 깨지는 모습 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("opp-lanes", function (root) {
    var KO = "사삼구팔-이오구칠", KO_N = "4398-2597";
    var MD = "YYMMDD-123**4567**", MD_SP = "YYMMDD-123  4567", MD_DEL = "YYMMDD-1234567";
    var CONF = [
      { label: K.t("정규식이 정규화본을 본다", "Regex reads the normalized text"),
        sub: K.t("한글 수사 변환을 정규화 계층에 넣었다. 정규화는 마커를 같은 길이의 공백으로 덮는다.", "Numeral conversion added to normalization, which overwrites markers with spaces."),
        ko: [KO, K.t("정규화: 한글 수사 → 숫자", "normalize: numerals → digits"), KO_N, 1, K.t("숫자 그룹을 본다", "sees digit groups")],
        md: [MD, K.t("정규화: 마커 → 공백. 정규식 직전엔 지울 마커가 없다", "normalize: markers → spaces; nothing left to delete"), MD_SP, 0, K.t("그룹 안 공백을 못 넘는다", "cannot cross the space inside a group")] },
      { label: K.t("정규식이 원본을 본다", "Regex reads the original"),
        sub: K.t("마커를 지우려고 정규식이 원본을 보게 바꿨다. 정규식 직전에 마커를 지우고 좌표를 되돌린다.", "Switched the regex to the original so markers can be deleted right before matching."),
        ko: [KO, K.t("원본 그대로 (변환은 모델 입력에만)", "original as is (conversion only for the model)"), KO, 0, K.t("한글을 본다 — 되살아남", "sees Hangul — the evasion is back")],
        md: [MD, K.t("마커 삭제 + 좌표 맵", "delete markers + index map"), MD_DEL, 1, K.t("숫자 그룹을 본다", "sees digit groups")] },
      { label: K.t("최종: 한 함수가 지우고 나서 변환", "Final: one function deletes, then converts"),
        sub: K.t("마커와 zero-width를 지운 뒤에 한글 수사를 변환한다. 좌표는 인덱스 맵으로 원본에 되돌린다.", "Delete markers and zero-width first, then convert numerals; map spans back to the original."),
        ko: [KO, K.t("삭제(지울 것 없음) → 변환", "delete (nothing) → convert"), KO_N, 1, K.t("숫자 그룹을 본다", "sees digit groups")],
        md: [MD, K.t("삭제 → 변환(대상 없음)", "delete → convert (nothing)"), MD_DEL, 1, K.t("숫자 그룹을 본다", "sees digit groups")] }
    ];

    K.css("two-defenses-that-need-opposite-inputs-css", [
      '.tca[data-demo="opp-lanes"] .opp-s{border-left:3px solid var(--tertiary);padding:3px 0 3px 9px;margin:5px 0;transition:opacity .3s,border-color .3s}',
      '.tca[data-demo="opp-lanes"] .opp-s.wait{opacity:.25}',
      '.tca[data-demo="opp-lanes"] .opp-s.cur{border-left-color:var(--tca-accent)}',
      '.tca[data-demo="opp-lanes"] .opp-k{display:block;font-size:12px;color:var(--secondary)}',
      '.tca[data-demo="opp-lanes"] .opp-v{font-family:ui-monospace,monospace;font-size:13.5px;white-space:pre-wrap}',
      '.tca[data-demo="opp-lanes"] .opp-t{font-size:13px}',
      '.tca[data-demo="opp-lanes"] .opp-r{font-weight:600}'
    ].join(""));

    K.head(root, K.t("정규식에 무엇을 넘기는가", "What text the regex receives"),
      K.t("설정을 고르면 두 입력이 차례로 처리된다. 앞의 두 설정은 한쪽을 고치면 반대쪽이 깨진다.",
        "Pick a setting and both inputs are processed step by step. In the first two, fixing one side breaks the other."));

    var cur = 0;
    var bar = K.el("div", "tca-bar");
    var seg = K.seg(CONF.map(function (c, i) { return { value: i, label: c.label }; }), cur, function (v) { cur = v; restart(); }, K.t("설정", "Setting"));
    bar.appendChild(seg.el);
    root.appendChild(bar);
    var sub = K.el("div", "tca-note", "");
    sub.style.margin = "0 0 10px";
    root.appendChild(sub);

    var two = K.el("div", "tca-two");
    var KEYS = [K.t("원본", "Original"), K.t("정규식 앞 처리", "Before the regex"), K.t("정규식이 보는 글", "What the regex sees"), K.t("결과", "Result")];
    function lane(title) {
      var b = K.el("div", "tca-box");
      b.appendChild(K.el("div", "tca-h", title));
      var st = KEYS.map(function (k, i) {
        var s = K.el("div", "opp-s"), kk = K.el("span", "opp-k", k), v = K.el("span", i === 1 ? "opp-t" : i === 3 ? "opp-r" : "opp-v", "");
        s.appendChild(kk); s.appendChild(v); b.appendChild(s);
        return { s: s, v: v };
      });
      two.appendChild(b);
      return st;
    }
    var lKo = lane(K.t("한글 수사 우회", "Korean numeral evasion")), lMd = lane(K.t("마크다운 우회", "Markdown evasion"));
    root.appendChild(two);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var ctl = K.el("div", "tca-bar");
    ctl.style.margin = "10px 0 0";
    var bAgain = K.btn(K.t("다시 보기", "Replay"));
    ctl.appendChild(bAgain);
    root.appendChild(ctl);
    root.appendChild(K.el("div", "tca-note", K.t(
      "두 입력 문자열은 본문에 나온 예시 그대로다(YYMMDD 는 생년월일 자리표시). 본문의 세 번째 깨짐(상대 팀 하네스가 원본 대신 정규화본만 넘김)은 첫 번째 설정과 같은 모양이다.",
      "Both input strings are the post's examples (YYMMDD is a birth-date placeholder). The third break in the post (a harness passing only normalized text) has the shape of the first setting.")));

    var step = 0, t = 0;
    function fill(st, d) {
      var vals = [d[0], d[1], d[2], (d[3] ? "✓ " : "✗ ") + d[4]];
      st.forEach(function (x, i) {
        x.v.textContent = vals[i];
        x.s.className = "opp-s" + (i >= step ? " wait" : "") + (i === step - 1 ? " cur" : "");
        if (i === 3) x.v.className = "opp-r " + (d[3] ? "tca-good" : "tca-bad");
      });
    }
    function paint() {
      var c = CONF[cur];
      sub.textContent = c.sub;
      fill(lKo, c.ko); fill(lMd, c.md);
      if (step < KEYS.length) { read.textContent = ""; return; }
      var a = c.ko[3], b = c.md[3];
      read.textContent = a && b ? K.t("둘 다 통과한다. 지우는 일과 바꾸는 일을 한 함수가 정해진 순서로 한다.", "Both pass: one function deletes and converts in a fixed order.")
        : K.t("한쪽만 통과한다. 한글 수사는 변환된 텍스트가, 마크다운은 마커가 살아 있는 텍스트가 필요하다.", "Only one passes: numerals need converted text, markdown needs the markers still present.");
      read.className = "tca-read " + (a && b ? "tca-good" : "tca-warn");
    }
    function restart() { step = K.reduce ? KEYS.length : 0; t = 0; paint(); }
    bAgain.addEventListener("click", function () { step = 0; t = 0; paint(); if (K.reduce) { step = KEYS.length; paint(); } });
    K.loop(root, function (dt) {
      if (step >= KEYS.length) return;
      t += dt;
      if (t > 700) { t = 0; step++; paint(); }
    });
    restart();
  });
})();
