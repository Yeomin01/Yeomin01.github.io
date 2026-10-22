/* 「생성 모델이 턴을 덜 쓰면, 스키마로 강제한다」 글의 그림: 프롬프트로 부탁할 때와 스키마로 강제할 때 생성되는 대화 모양 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("force-the-shape-with-a-schema-css",
    '.tca[data-demo="schema-turns"] .sc-chat{display:flex;flex-direction:column;gap:5px;min-height:60px}' +
    '.tca[data-demo="schema-turns"] .sc-ex{display:flex;flex-wrap:wrap;gap:5px;align-items:stretch}' +
    '.tca[data-demo="schema-turns"] .sc-b{font-size:12.5px;padding:3px 9px;border-radius:10px;border:1px solid var(--tertiary)}' +
    '.tca[data-demo="schema-turns"] .sc-u{background:var(--code-bg)}' +
    '.tca[data-demo="schema-turns"] .sc-a{color:var(--secondary)}' +
    '.tca[data-demo="schema-turns"] .sc-doc{font-size:12px;padding:3px 9px;border-radius:4px;border:1px dashed var(--tertiary)}' +
    '.tca[data-demo="schema-turns"] .sc-doc.bad{border-color:var(--tca-bad);color:var(--tca-bad)}' +
    '.tca[data-demo="schema-turns"] .sc-doc.good{border-color:var(--tca-good);color:var(--tca-good)}' +
    '.tca[data-demo="schema-turns"] .sc-json{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;' +
    'background:var(--code-bg);border-radius:6px;padding:8px 10px;margin:0}');

  K.register("schema-turns", function (root) {
    var st = { how: "prompt", n: 7, fmt: "chat", shown: 0, acc: 0 };
    var ATTACH = 2;      // 문서를 붙일 유저 턴(예시)
    var DOC_SHORT = 380; // 프롬프트 방식의 문서 길이(예시, 글: 230~520자)

    K.head(root, K.t("부탁한 모양 vs 강제한 모양", "Asked-for shape vs enforced shape"),
      K.t("4B급 모델에게 유저 턴 수를 정해 대화를 만들게 한다. 프롬프트로만 부탁하면 요청의 60% 정도에서 대화를 끝낸다. 교환 한 쌍을 배열 원소로 받고 길이를 고정하면 정확히 그 수가 나온다.",
        "A 4B-class model writes a dialogue with a set number of user turns. Asked in the prompt, it stops at about 60% of the request. Receive each exchange as an array item with a fixed length and the count comes out exact."));

    var bar = K.el("div", "tca-bar");
    var sgHow = K.seg([{ value: "prompt", label: K.t("프롬프트로 부탁", "Ask in the prompt") }, { value: "schema", label: K.t("JSON 스키마로 강제", "Enforce with JSON schema") }],
      st.how, function (v) { st.how = v; restart(); }, K.t("방식", "Method"));
    var sgFmt = K.seg([{ value: "chat", label: K.t("대화", "Dialogue") }, { value: "doc", label: K.t("문서 붙여넣기", "Pasted document") }],
      st.fmt, function (v) { st.fmt = v; restart(); }, K.t("형식", "Format"));
    var sl = K.slider({ label: K.t("요청한 유저 턴", "Requested user turns"), min: 3, max: 7, step: 1, value: st.n, onInput: function (v) { st.n = v; restart(); } });
    var bGo = K.btn(K.t("다시 생성", "Generate again"));
    bGo.addEventListener("click", restart);
    [sgHow.el, sgFmt.el, sl.el, bGo].forEach(function (e) { bar.appendChild(e); });
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    var left = K.el("div", "tca-box"), right = K.el("div", "tca-box");
    left.appendChild(K.el("div", "tca-h", K.t("생성된 대화", "Generated dialogue")));
    var chat = K.el("div", "sc-chat");
    left.appendChild(chat);
    right.appendChild(K.el("div", "tca-h", K.t("요청에 붙는 것", "Attached to the request")));
    var json = K.el("pre", "sc-json");
    right.appendChild(json);
    two.appendChild(left); two.appendChild(right);
    root.appendChild(two);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "118px");
    rows.style.setProperty("--tca-rw", "80px");
    rows.style.marginTop = "12px";
    [[K.t("첫 시도(수정 전)", "First try (before)"), 1 / 8, "1/8"], [K.t("수정 후 첫 시도", "First try (after)"), 0.78, "78%"],
      [K.t("재시도 최대 3회 뒤", "After up to 3 retries"), 0.963, "963/1,000"]].forEach(function (q) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r", q[2]);
      f.style.width = q[1] * 100 + "%"; f.style.background = "var(--tca-good)";
      tr.appendChild(f);
      r.appendChild(K.el("div", "tca-row-l", q[0])); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
    });
    root.appendChild(K.el("div", "tca-h", K.t("명세 통과율 (글 본문)", "Spec pass rate (from the post)")));
    root.lastChild.style.marginTop = "12px";
    root.appendChild(rows);
    root.appendChild(K.el("div", "tca-note", K.t(
      "60%(7턴 → 4턴, 5턴 → 3턴), 문서 230~520자, 판정 기준 600자, minLength 700, 통과율은 글 본문 값이다. 3·4·6턴의 결과는 60%를 반올림한 예시다. 문서 길이 380자, 붙일 턴 2, 배열 이름 exchanges 는 예시다.",
      "60% (7 → 4, 5 → 3), documents of 230–520 characters, the 600-character check, minLength 700 and the pass rates are from the post. Results for 3, 4 and 6 turns round 60% as an example; the 380-character document, attach turn 2 and the array name exchanges are examples.")));

    function target() { return st.how === "schema" ? st.n : Math.max(1, Math.round(st.n * 0.6)); }
    function restart() { st.shown = K.reduce ? target() : 0; st.acc = 0; draw(); }
    function draw() {
      var tgt = target();
      chat.textContent = "";
      for (var i = 1; i <= st.shown; i++) {
        var ex = K.el("div", "sc-ex" + (K.reduce ? "" : " tca-pop"));
        ex.appendChild(K.el("span", "sc-b sc-u", K.t("유저 ", "User ") + i));
        if (st.fmt === "doc" && i === Math.min(ATTACH, tgt)) {
          var ok = st.how === "schema";
          ex.appendChild(K.el("span", "sc-doc " + (ok ? "good" : "bad"),
            ok ? K.t("붙여 넣은 문서 · 700자 이상", "pasted document · 700+ chars") : K.t("붙여 넣은 문서 · " + DOC_SHORT + "자", "pasted document · " + DOC_SHORT + " chars")));
        }
        ex.appendChild(K.el("span", "sc-b sc-a", K.t("응답 ", "Reply ") + i));
        chat.appendChild(ex);
      }
      if (st.how === "schema") {
        json.textContent = '"exchanges": {\n  "type": "array",\n  "minItems": ' + st.n + ', "maxItems": ' + st.n +
          ',\n  "items": { "user": …, "assistant": … }\n}' +
          (st.fmt === "doc" ? ',\n"document": { "type": "string", "minLength": 700 },\n"attach_turn": { "type": "integer" }' : "");
      } else {
        json.textContent = K.t("프롬프트 문장: \"유저 턴 " + st.n + "개로 작성할 것\"", "Prompt line: \"write it with " + st.n + " user turns\"") +
          (st.fmt === "doc" ? K.t("\n\"문서를 붙여 넣은 대화로 작성할 것\"", "\n\"include a pasted document\"") : "");
      }
      var done = st.shown >= tgt;
      if (!done) { read.textContent = K.t("생성 중… 교환 ", "Generating… exchange ") + st.shown; return; }
      var turnsOk = st.shown === st.n, docOk = st.fmt !== "doc" || st.how === "schema";
      var msg = K.t("유저 턴 ", "User turns ") + st.shown + "/" + st.n + (turnsOk ? K.t(" · 맞음", " · ok") : K.t(" · 명세 위반", " · spec violated"));
      if (st.fmt === "doc") msg += st.how === "schema"
        ? K.t(" · 문서는 document 필드로 받아 코드가 " + ATTACH + "번째 유저 턴에 붙였다", " · document received as a field and attached to user turn " + ATTACH + " by code")
        : K.t(" · 문서 " + DOC_SHORT + "자 < 판정 기준 600자, 형식 실패", " · document " + DOC_SHORT + " chars < the 600 check, format fails");
      msg += turnsOk && docOk ? K.t(" → 통과", " → pass") : K.t(" → 버림", " → rejected");
      read.textContent = msg;
    }
    K.loop(root, function (dt) {
      if (st.shown >= target()) return;
      st.acc += dt;
      if (st.acc >= 420) { st.acc = 0; st.shown++; draw(); }
    });
    restart();
  });
})();
