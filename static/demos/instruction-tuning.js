/* 「지시문으로 학습시키면 안 배운 일도 한다」 글의 그림: 같은 데이터를 두 형식으로 학습했을 때 추론 입력이 학습 때와 어떻게 맞거나 어긋나는지 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("instruction-tuning-css", [
    '.tca[data-demo="it-format"] .it-rec{border:1px dashed var(--tertiary);border-radius:6px;padding:6px 8px;margin:0 0 6px;font-size:13px}',
    '.tca[data-demo="it-format"] .it-line{display:flex;gap:8px;align-items:baseline;margin:2px 0}',
    '.tca[data-demo="it-format"] .it-k{flex:none;width:46px;font-size:12px;color:var(--secondary)}',
    '.tca[data-demo="it-format"] .it-v{min-width:0}',
    '.tca[data-demo="it-format"] .it-diff{box-shadow:0 0 0 2px var(--tca-warn);border-radius:3px;padding:0 3px}',
    '.tca[data-demo="it-format"] .it-new{box-shadow:0 0 0 2px var(--tca-accent);border-radius:3px;padding:0 3px}',
    '.tca[data-demo="it-format"] .it-none{color:var(--secondary);font-style:italic}',
    '.tca[data-demo="it-format"] .it-other{opacity:.8}',
    '.tca[data-demo="it-format"] .it-shape{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
  ].join(""));

  K.register("it-format", function (root) {
    var L = { ins: K.t("지시문", "Instr."), inp: K.t("입력", "Input"), ans: K.t("정답", "Target"), lab: K.t("라벨", "Label") };
    var PLACE_INS = K.t("다음 텍스트에서 장소를 찾아 JSON 으로 반환하라", "Find the place in the text and return it as JSON");
    var TRAIN_SUP = [
      [[L.inp, K.t("다음 주 화요일 부산 지점에서 회의가 있다", "There is a meeting at the Busan branch next Tuesday")],
        [L.lab, K.t("장소 = 부산 지점", "place = Busan branch")]],
      [[L.inp, K.t("자료는 3층 자료실에 두었다", "I left the files in the 3rd-floor archive")],
        [L.lab, K.t("장소 = 3층 자료실", "place = 3rd-floor archive")]]
    ];
    var TRAIN_INS = [
      [[L.ins, PLACE_INS], [L.inp, K.t("다음 주 화요일 부산 지점에서 회의가 있다", "There is a meeting at the Busan branch next Tuesday")],
        [L.ans, K.t('{"장소": "부산 지점"}', '{"place": "Busan branch"}')]],
      [[L.ins, K.t("다음 문장이 긍정인지 부정인지 답하라", "Say whether the sentence is positive or negative")],
        [L.inp, K.t("배송이 빨라서 좋았다", "Fast delivery, I liked it")], [L.ans, K.t("긍정", "positive")]],
      [[L.ins, K.t("다음 문장을 영어로 옮겨라", "Translate the sentence into Korean")],
        [L.inp, K.t("회의는 오후 세 시에 시작한다", "The meeting starts at 3 p.m.")],
        [L.ans, K.t("The meeting starts at 3 p.m.", "회의는 오후 세 시에 시작한다")]]
    ];
    var INPUT = K.t("금요일에 대전 연구소로 출장을 간다", "On Friday I travel to the Daejeon lab");

    // 추론 때 들어오는 입력: [줄 목록, 강조 종류] — 강조 0 없음, 1 처음 보는 지시, 2 어긋난 지시, 3 자리 없음
    var CASES = {
      sup: {
        seen: { lines: [[L.inp, INPUT]], tag: ["good", K.t("학습 때와 같은 모양", "Same shape as training")],
          say: K.t("학습 때와 같은 모양이다. 모델은 학습한 입력 → 라벨 대응을 그대로 쓴다.",
            "Same shape as in training. The model applies the input → label mapping it learned.") },
        fresh: { lines: [[K.t("요청", "Ask"), K.t("한 줄로 요약해 달라 — 입력에 실을 자리가 없다", "summarize in one line — nowhere to put it"), 3], [L.inp, INPUT]],
          tag: ["bad", K.t("task 를 적을 자리가 없다", "No slot to state the task")],
          say: K.t("입력에 task 를 적을 자리가 없다. 모델이 배운 것은 장소 찾기의 입력 → 라벨 대응뿐이라, 다른 일을 시킬 방법이 없다.",
            "There is nowhere in the input to state a task. The model only learned the place-finding mapping, so there is no way to ask for anything else.") },
        reword: { lines: [[L.ins, K.t("(없음)", "(none)"), 3], [L.inp, INPUT]],
          tag: ["", K.t("해당 없음 — 지시문이 없다", "Not applicable — no instruction")],
          say: K.t("지시문이 없는 형식이라 문구가 어긋날 일은 없다. 대신 task 를 바꿀 수도 없다.",
            "With no instruction there is no wording to drift. But there is also no way to change the task.") }
      },
      ins: {
        seen: { lines: [[L.ins, PLACE_INS], [L.inp, INPUT]], tag: ["good", K.t("같은 지시문, 같은 모양", "Same instruction, same shape")],
          say: K.t("학습 때와 같은 지시문, 같은 모양이다.", "Same instruction and same shape as in training.") },
        fresh: { lines: [[L.ins, K.t("다음 문장을 한 줄로 요약하라", "Summarize the sentence in one line"), 1], [L.inp, INPUT]],
          tag: ["accent", K.t("처음 보는 지시, 같은 모양", "Unseen instruction, same shape")],
          say: K.t("지시문 자리에 처음 보는 task 가 들어간다. 입력의 모양은 학습 때와 같다. 여러 task 를 이 모양으로 함께 학습하면 처음 보는 task 에도 zero-shot 성능이 오른다는 것이 FLAN 의 결과다.",
            "An unseen task goes into the instruction slot, and the input keeps the shape seen in training. FLAN's result is that training many tasks in this shape raises zero-shot performance on tasks never trained on.") },
        reword: { lines: [[L.ins, K.t("텍스트에 나오는 장소 이름을 목록으로 뽑아 줘", "pull out the place names as a list"), 2], [L.inp, INPUT]],
          tag: ["warn", K.t("모양은 같고 지시문이 어긋남", "Same shape, drifted instruction")],
          say: K.t("모양은 같지만 지시문 문구와 출력 형식이 학습 때와 다르다. 학습한 패턴과 다른 입력이라 성능이 떨어질 수 있다. 지시문을 코드 상수가 아니라 학습 입력 분포의 일부로 다루는 이유다.",
            "The shape is the same, but the wording and output format differ from training. The input no longer matches the learned pattern, so performance can drop. That is why the instruction is treated as part of the training input distribution, not a code constant.") }
      }
    };

    K.head(root, K.t("같은 데이터, 두 가지 학습 형식", "Same data, two training formats"),
      K.t("학습 형식과 추론 요청을 골라 보면, 추론 때 들어오는 입력이 학습 때 본 모양과 맞는지가 보인다. 문장은 모두 예시다.",
        "Pick a training format and an inference request to see whether the inference input matches the shape seen in training. All sentences are examples."));

    var fmtV = "ins", caseV = "seen";
    var bar = K.el("div", "tca-bar");
    var segF = K.seg([{ value: "sup", label: K.t("지도학습 형식", "Supervised") }, { value: "ins", label: K.t("instruction 형식", "Instruction") }],
      fmtV, function (v) { fmtV = v; render(true); }, K.t("학습 형식", "Training format"));
    var segC = K.seg([{ value: "seen", label: K.t("학습한 task", "Trained task") }, { value: "fresh", label: K.t("처음 보는 task", "Unseen task") },
      { value: "reword", label: K.t("지시문 문구가 바뀜", "Reworded instruction") }],
      caseV, function (v) { caseV = v; render(true); }, K.t("추론 요청", "Inference request"));
    bar.appendChild(segF.el); bar.appendChild(segC.el);
    root.appendChild(bar);

    var two = K.el("div", "tca-two");
    var boxT = K.el("div", "tca-box"), boxI = K.el("div", "tca-box");
    var hT = K.el("div", "tca-h"), hI = K.el("div", "tca-h", K.t("추론 때 들어오는 입력", "Input at inference"));
    var bodyT = K.el("div"), bodyI = K.el("div");
    boxT.appendChild(hT); boxT.appendChild(bodyT); boxI.appendChild(hI); boxI.appendChild(bodyI);
    two.appendChild(boxT); two.appendChild(boxI);
    root.appendChild(two);

    var shape = K.el("div", "it-shape");
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(shape); root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "파란 테두리는 학습 때 없던 지시, 노란 테두리는 학습 때와 문구가 다른 지시다. 그림은 입력의 모양만 비교하고 성능은 재지 않는다.",
      "Blue outline: an instruction not seen in training. Yellow outline: an instruction worded differently from training. The figure compares input shape only and measures no performance.")));

    function rec(lines, other) {
      var r = K.el("div", "it-rec" + (other ? " it-other" : ""));
      lines.forEach(function (ln) {
        var row = K.el("div", "it-line");
        row.appendChild(K.el("span", "it-k", ln[0]));
        var v = K.el("span", "it-v", ln[1]);
        if (ln[2] === 1) v.className = "it-v it-new";
        if (ln[2] === 2) v.className = "it-v it-diff";
        if (ln[2] === 3) v.className = "it-v it-none";
        row.appendChild(v);
        r.appendChild(row);
      });
      return r;
    }

    function render(pop) {
      bodyT.textContent = "";
      if (fmtV === "sup") {
        hT.textContent = K.t("학습 데이터 — 장소 찾기의 입력·라벨 쌍", "Training data — input/label pairs for place finding");
        TRAIN_SUP.forEach(function (r) { bodyT.appendChild(rec(r)); });
      } else {
        hT.textContent = K.t("학습 데이터 — 같은 레코드를 지시문 형식으로", "Training data — the same records as instructions");
        bodyT.appendChild(rec(TRAIN_INS[0]));
        bodyT.appendChild(K.el("div", "tca-note", K.t("FLAN 처럼 다른 task 도 같은 형식으로 섞는다:", "As in FLAN, other tasks are mixed in the same format:")));
        bodyT.appendChild(rec(TRAIN_INS[1], true));
        bodyT.appendChild(rec(TRAIN_INS[2], true));
      }
      var c = CASES[fmtV][caseV];
      bodyI.textContent = "";
      var r = rec(c.lines);
      var out = K.el("div", "it-line");
      out.appendChild(K.el("span", "it-k", K.t("출력", "Output")));
      out.appendChild(K.el("span", "it-v it-none", "?"));
      r.appendChild(out);
      if (pop && !K.reduce) r.className += " tca-pop";
      bodyI.appendChild(r);

      shape.textContent = "";
      var sh = K.el("span", null, K.t("모양 비교", "Shape check")); sh.style.fontWeight = "600";
      shape.appendChild(sh);
      var tg = K.el("span", "tca-tag", c.tag[1]);
      if (c.tag[0] === "good") tg.style.color = "var(--tca-good)";
      if (c.tag[0] === "bad") tg.style.color = "var(--tca-bad)";
      if (c.tag[0] === "warn") tg.style.color = "var(--tca-warn)";
      if (c.tag[0] === "accent") tg.style.color = "var(--tca-accent)";
      if (c.tag[0]) tg.style.borderColor = tg.style.color;
      shape.appendChild(tg);
      read.textContent = c.say;
    }
    render(false);
  });
})();
