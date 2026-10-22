/* 「419개 추가했더니 멀쩡한 ORG 가 사라졌다」 글의 그림: ORG 접미사 룰의 앞·뒤 조건을 바꿔 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("skew-org-suffix", function (root) {
    // 본문의 접미사 12종. 재단(법인)은 "재단법인"을 먼저 시도한다.
    var SUFFIX = "위원회|진흥원|공단|공사|재단법인|재단|학회|박물관|도서관|미술관|연합회|연구원|연구소";
    var HANGUL = /[가-힣]/;
    // 본문에 실린 시험 8개: 문장과 기대 결과(null = 없음)
    var CASES = [
      { s: "한국수자원공사가 댐을 관리한다", want: "한국수자원공사" },
      { s: "한국문화관광연구원의 보고서", want: "한국문화관광연구원" },
      { s: "방송통신위원회 회의 결과", want: "방송통신위원회" },
      { s: "한국전력공사 본사", want: "한국전력공사" },
      { s: "한국전자통신연구원장이 말했다", want: null, why: K.t("직책 회피", "title, skip") },
      { s: "공사장에서 일한다", want: null, why: K.t("직책 회피", "title, skip") },
      { s: "다음 위원회 회의에서", want: null, why: K.t("단독 명사", "bare noun") },
      { s: "박물관에 갔다", want: null, why: K.t("단독 명사", "bare noun") }
    ];
    var TAILS = {
      jang: { src: "(?!장)", label: K.t("(?!장) · 본문", "(?!장) · post") },
      all: { src: "(?![가-힣])", label: K.t("(?![가-힣]) · 한글 전체", "(?![가-힣]) · any Hangul") },
      none: { src: "", label: K.t("뒤 조건 없음", "no tail check") }
    };
    var PREFIX = {
      p2: { src: "{2,12}", label: K.t("2~12자 · 본문", "2–12 chars · post") },
      p0: { src: "{0,12}", label: K.t("0~12자", "0–12 chars") }
    };
    var tail = "jang", pre = "p2";

    // 뒷보기(lookbehind)를 못 쓰는 브라우저도 있으니, 시작 위치 앞 글자는 직접 확인하고 나머지는 sticky 정규식으로 맞춘다.
    function findAll(text) {
      var re = new RegExp("[가-힣]" + PREFIX[pre].src + "(?:" + SUFFIX + ")" + TAILS[tail].src, "y");
      var out = [], i = 0;
      while (i < text.length) {
        if (i > 0 && HANGUL.test(text.charAt(i - 1))) { i++; continue; }
        re.lastIndex = i;
        var m = re.exec(text);
        if (m && m[0].length) { out.push({ at: i, str: m[0] }); i += m[0].length; } else i++;
      }
      return out;
    }

    K.css("small-data-distribution-skew-css", [
      '.tca[data-demo="skew-org-suffix"] .sk-re{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;',
      'background:var(--code-bg);border-radius:6px;padding:6px 8px;margin:0 0 10px;overflow-wrap:anywhere}',
      '.tca[data-demo="skew-org-suffix"] .sk-re b{color:var(--tca-accent)}',
      '.tca[data-demo="skew-org-suffix"] .sk-list{display:flex;flex-direction:column;gap:6px}',
      '.tca[data-demo="skew-org-suffix"] .sk-item{border:1px solid var(--tertiary);border-radius:6px;padding:6px 8px;min-width:0}',
      '.tca[data-demo="skew-org-suffix"] .sk-s{font-size:14px}',
      '.tca[data-demo="skew-org-suffix"] .sk-s mark{background:var(--code-bg);color:var(--primary);',
      'border-bottom:2px solid var(--tca-accent);padding:0 1px;border-radius:2px}',
      '.tca[data-demo="skew-org-suffix"] .sk-m{font-size:12.5px;color:var(--secondary);margin-top:2px;display:flex;flex-wrap:wrap;gap:2px 10px}',
      '.tca[data-demo="skew-org-suffix"] .sk-ok{font-weight:600}'
    ].join(""));

    K.head(root, K.t("ORG 접미사 룰의 앞·뒤 조건 바꿔 보기", "Change the guards of the ORG suffix rule"),
      K.t("본문의 한 줄 룰과 시험 문장 8개를 그대로 돌린다. 뒤 조건이나 앞 글자 수를 바꾸면 어떤 문장이 깨지는지 보인다.",
        "Runs the one-line rule and the eight test sentences from the post. Change the tail check or the prefix length to see which sentences break."));

    var bar1 = K.el("div", "tca-bar");
    bar1.appendChild(K.el("span", "tca-lbl", K.t("뒤 조건", "Tail")));
    var segTail = K.seg(Object.keys(TAILS).map(function (k) { return { value: k, label: TAILS[k].label }; }), tail,
      function (v) { tail = v; render(); }, K.t("뒤 조건", "Tail check"));
    bar1.appendChild(segTail.el);
    var bar2 = K.el("div", "tca-bar");
    bar2.appendChild(K.el("span", "tca-lbl", K.t("앞 한글", "Prefix")));
    var segPre = K.seg(Object.keys(PREFIX).map(function (k) { return { value: k, label: PREFIX[k].label }; }), pre,
      function (v) { pre = v; render(); }, K.t("앞 한글 글자 수", "Prefix length"));
    bar2.appendChild(segPre.el);
    var bReset = K.btn(K.t("본문 룰로", "Back to the post's rule"));
    bar2.appendChild(bReset);
    root.appendChild(bar1); root.appendChild(bar2);

    var reBox = K.el("div", "sk-re");
    root.appendChild(reBox);

    var list = K.el("div", "sk-list");
    var items = CASES.map(function (c) {
      var it = K.el("div", "sk-item");
      var s = K.el("div", "sk-s");
      var m = K.el("div", "sk-m");
      var want = K.el("span", null, K.t("기대: ", "Expected: ") + (c.want ? "ORG " + c.want : K.t("없음", "none") + " (" + c.why + ")"));
      var got = K.el("span");
      var ok = K.el("span", "sk-ok");
      m.appendChild(want); m.appendChild(got); m.appendChild(ok);
      it.appendChild(s); it.appendChild(m);
      list.appendChild(it);
      return { it: it, s: s, got: got, ok: ok, last: null };
    });
    root.appendChild(list);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "본문의 시험 21개 가운데 글에 실린 8개다. 접미사는 본문 12종이고, 앞 글자가 한글이면 매칭을 시작하지 않는 조건(?<![가-힣])은 늘 켜 둔다.",
      "These are the eight of the post's 21 tests that appear in the text. The suffixes are the post's twelve, and the lookbehind (?<![가-힣]) stays on.")));

    function render() {
      reBox.textContent = "";
      reBox.appendChild(document.createTextNode("(?<![가-힣])[가-힣]"));
      reBox.appendChild(K.el("b", null, PREFIX[pre].src));
      reBox.appendChild(document.createTextNode("{suffix}"));
      reBox.appendChild(K.el("b", null, TAILS[tail].src || K.t("(없음)", "(none)")));
      var good = 0;
      CASES.forEach(function (c, i) {
        var ms = findAll(c.s), r = items[i];
        r.s.textContent = "";
        var pos = 0;
        ms.forEach(function (m) {
          if (m.at > pos) r.s.appendChild(document.createTextNode(c.s.slice(pos, m.at)));
          r.s.appendChild(K.el("mark", null, m.str));
          pos = m.at + m.str.length;
        });
        if (pos < c.s.length) r.s.appendChild(document.createTextNode(c.s.slice(pos)));
        var gotStr = ms.map(function (m) { return m.str; }).join(", ");
        r.got.textContent = K.t("결과: ", "Got: ") + (gotStr ? "ORG " + gotStr : K.t("없음", "none"));
        var pass = c.want ? (ms.length === 1 && ms[0].str === c.want) : ms.length === 0;
        if (pass) good++;
        r.ok.textContent = pass ? K.t("✓ 맞음", "✓ ok") : K.t("✗ 틀림", "✗ wrong");
        r.ok.className = "sk-ok " + (pass ? "tca-good" : "tca-bad");
        if (r.last !== null && r.last !== gotStr) {
          r.it.classList.remove("tca-pop"); void r.it.offsetWidth; r.it.classList.add("tca-pop");
        }
        r.last = gotStr;
      });
      var why = [];
      if (tail === "all") why.push(K.t("조사(가·의)가 붙은 기관명까지 막힌다.", "Names followed by a particle (가·의) are blocked too."));
      else if (tail === "none") why.push(K.t("연구원장 같은 직책이 기관명으로 잡힌다.", "Titles such as 연구원장 are taken as organizations."));
      if (pre === "p0") why.push(K.t("앞 글자를 0자까지 허용하면 단독 명사도 잡힌다.", "Allowing a zero-length prefix lets bare nouns match."));
      read.textContent = K.t("기대와 맞는 문장 ", "Sentences matching expectation ") + good + " / " + CASES.length +
        (why.length ? " — " + why.join(" ") : "");
    }
    bReset.addEventListener("click", function () {
      tail = "jang"; pre = "p2"; segTail.set(tail); segPre.set(pre); render();
    });
    render();
  });
})();
