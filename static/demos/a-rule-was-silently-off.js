/* 「규칙 하나가 조용히 꺼진 채로 숫자가 나오고 있었다」 글의 그림: 패턴·환경·폴백 방식에 따른 측정 로그 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("a-rule-was-silently-off-css", [
    '.tca[data-demo="rule-off"] .ro-tree{font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.7}',
    '.tca[data-demo="rule-off"] .ro-tree .ig{color:var(--secondary);text-decoration:line-through}',
    '.tca[data-demo="rule-off"] .ro-log{font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;background:var(--code-bg);border-radius:6px;padding:8px 10px;margin-top:10px;white-space:pre-wrap}',
    '.tca[data-demo="rule-off"] .ro-ctl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center;margin:0 0 12px;font-size:13px}',
    '@media (max-width:600px){.tca[data-demo="rule-off"] .ro-ctl{grid-template-columns:minmax(0,1fr)}}'
  ].join(""));

  K.register("rule-off", function (root) {
    var pat = "loose", env = "local", mode = "silent";
    var VENDOR = "vendor/pipeline/scripts/scope_rules.py";

    K.head(root, K.t("같은 코드, 다른 숫자", "Same code, different numbers"),
      K.t("세 가지를 바꿔 본다. 앵커 없는 패턴은 벤더링한 트리의 scripts/ 까지 제외하고, 새로 클론한 환경에서만 그 파일이 없다. 폴백 방식에 따라 그 사실이 로그에 남거나 사라진다.",
        "Change three things. The unanchored pattern also excludes scripts/ inside the vendored tree, and only a fresh clone lacks the file. The fallback style decides whether the log shows it."));

    var ctl = K.el("div", "ro-ctl");
    function addCtl(label, seg) { ctl.appendChild(K.el("span", "tca-lbl", label)); var w = K.el("div"); w.appendChild(seg.el); ctl.appendChild(w); }
    var sPat = K.seg([{ value: "loose", label: "[Ss]cripts" }, { value: "anchored", label: "/scripts/" }], pat, function (v) { pat = v; render(); }, ".gitignore");
    var sEnv = K.seg([{ value: "local", label: K.t("개발자 로컬", "Developer machine") }, { value: "clone", label: K.t("새로 클론 · 컨테이너 빌드", "Fresh clone · container build") }], env, function (v) { env = v; render(); }, K.t("실행 환경", "Environment"));
    var sMode = K.seg([
      { value: "silent", label: K.t("조용한 폴백 (예전)", "Silent fallback (before)") },
      { value: "header", label: K.t("폴백 + 규칙 헤더 (지금)", "Fallback + rules header (now)") },
      { value: "strict", label: K.t("필수 모듈은 폴백 없음", "No fallback for required modules") }
    ], mode, function (v) { mode = v; render(); }, K.t("하네스", "Harness"));
    addCtl(".gitignore", sPat);
    addCtl(K.t("실행 환경", "Environment"), sEnv);
    addCtl(K.t("하네스", "Harness"), sMode);
    root.appendChild(ctl);

    var two = K.el("div", "tca-two");
    var bTree = K.el("div", "tca-box"); bTree.appendChild(K.el("div", "tca-h", K.t("저장소에 들어간 파일", "Files that reach the repository")));
    var tree = K.el("div", "ro-tree"); bTree.appendChild(tree);
    var chk = K.el("div", "tca-note"); bTree.appendChild(chk);
    var bRes = K.el("div", "tca-box"); bRes.appendChild(K.el("div", "tca-h", K.t("측정 로그", "Measurement log")));
    var log = K.el("div", "ro-log"); log.style.marginTop = "0"; bRes.appendChild(log);
    two.appendChild(bTree); two.appendChild(bRes);
    root.appendChild(two);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "규칙 이름 셋과 헤더 문구는 본문 출력 예시에서 가져왔다(본문은 일부를 …로 줄였다). 파일 경로는 예시다.",
      "The three rule names and header lines come from the post's example output (the post elides some with …). File paths are examples.")));

    function render() {
      var vendorIgnored = pat === "loose";
      var present = env === "local" || !vendorIgnored;
      tree.textContent = "";
      [
        { p: "harness/eval.py", ig: false },
        { p: "scripts/  " + K.t("(최상위)", "(top level)"), ig: true },
        { p: VENDOR, ig: vendorIgnored }
      ].forEach(function (f) {
        var d = K.el("div", f.ig ? "ig" : null, f.p);
        tree.appendChild(d);
      });
      chk.textContent = "$ git check-ignore -v " + VENDOR + "\n" + (vendorIgnored ? ".gitignore:1:[Ss]cripts\t" + VENDOR : K.t("(출력 없음 — 제외되지 않음)", "(no output — not ignored)"));
      chk.style.whiteSpace = "pre-wrap"; chk.style.fontFamily = "ui-monospace,monospace"; chk.style.fontSize = "12px";
      var lines = [], cls = "tca-read", msg;
      var on = function (b) { return b ? "ON" : "OFF"; };
      if (!present && mode === "strict") {
        lines.push("ImportError: No module named 'pipeline.scripts.scope_rules'");
        lines.push(K.t("측정 중단", "measurement aborted"));
        cls += " tca-warn";
        msg = K.t("바로 멈춘다. 본문의 다른 환경이 이렇게 드러났다. 숫자가 나오지 않으니 틀린 숫자도 없다.", "It stops at once — how the other environment in the post surfaced. No number, so no wrong number.");
      } else {
        if (mode !== "silent") {
          lines.push(K.t("[rules] 결합 라우팅=ON · 대화 스코프=", "[rules] combined routing=ON · conversation scope=") + on(present) + K.t(" · 음절 2패스=ON", " · syllable 2nd pass=ON"));
          if (!present) lines.push(K.t("[rules] ⚠ 꺼진 규칙 1개 — 이 수치는 그 상태의 값이다", "[rules] ⚠ 1 rule off — these numbers are for that state"));
        }
        lines.push(K.t("측정 완료 · 수치 출력", "measurement done · numbers written"));
        if (present) { cls += " tca-good"; msg = K.t("규칙이 모두 켜진 상태의 숫자다.", "Numbers with every rule on."); }
        else if (mode === "silent") { cls += " tca-bad"; msg = K.t("대화 스코프 규칙이 꺼진 채 숫자가 나왔다. 로그에는 아무 흔적이 없다.", "The conversation-scope rule is off, yet numbers came out with no trace in the log."); }
        else { cls += " tca-warn"; msg = K.t("숫자는 나오지만, 어떤 구성에서 나온 숫자인지 로그 첫머리에 남는다.", "Numbers still come out, but the log header says which configuration produced them."); }
      }
      if (env === "local") msg += K.t(" 로컬에는 파일이 있어서 테스트도 전부 통과한다.", " Locally the file exists, so every test passes too.");
      log.textContent = lines.join("\n");
      read.className = cls; read.textContent = msg;
    }
    render();
  });
})();
