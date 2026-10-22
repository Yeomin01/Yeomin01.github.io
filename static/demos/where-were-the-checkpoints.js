/* 「체크포인트는 어디에 있었나」 글의 그림: 포인터는 있는데 내용이 없는 상태 만들어 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("where-were-the-checkpoints-css", [
    '.tca[data-demo="ckpt-pointer"] .cp-f{display:flex;align-items:center;gap:6px;font-size:12.5px;padding:3px 6px;border-radius:4px;background:var(--code-bg);margin:3px 0}',
    '.tca[data-demo="ckpt-pointer"] .cp-f.gone{background:transparent;border:1px dashed var(--tertiary);color:var(--secondary);text-decoration:line-through}',
    '.tca[data-demo="ckpt-pointer"] .cp-p{font-family:ui-monospace,monospace;font-size:12px;padding:4px 6px;border:1px solid var(--tca-accent);border-radius:4px;margin:3px 0}',
    '.tca[data-demo="ckpt-pointer"] .cp-e{font-size:12.5px;color:var(--secondary);margin:3px 0}',
    '.tca[data-demo="ckpt-pointer"] .cp-x{height:6px;border-radius:3px;background:var(--code-bg);overflow:hidden;margin-top:6px}',
    '.tca[data-demo="ckpt-pointer"] .cp-x i{display:block;height:100%;width:0;background:var(--tca-accent)}'
  ].join(""));

  K.register("ckpt-pointer", function (root) {
    var FILES = [K.t("가중치", "weights"), K.t("학습 설정", "training config"), K.t("데이터 요약", "data summary")];
    var S, xfer = null;

    K.head(root, K.t("포인터가 있다 ≠ 내용을 받을 수 있다", "A pointer exists ≠ the content can be fetched"),
      K.t("단계를 눌러 등록해 본 뒤 두 가지 방법으로 확인한다. push 를 빼면 포인터 확인은 통과하고, 다른 위치에서 내려받기는 실패한다.",
        "Register by pressing the steps, then check two ways. Skip push and the pointer check passes while fetching from elsewhere fails."));

    var bar = K.el("div", "tca-bar");
    var bAdd = K.btn("dvc add"), bCommit = K.btn("git commit"), bPush = K.btn("dvc push"), bClean = K.btn(K.t("로컬 디스크 정리", "Clean local disk"));
    [bAdd, bCommit, bPush, bClean].forEach(function (b) { bar.appendChild(b); });
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var bChk1 = K.btn(K.t("확인 ① 포인터가 있나", "Check ① is there a pointer")), bChk2 = K.btn(K.t("확인 ② 다른 위치에서 dvc pull", "Check ② dvc pull elsewhere"));
    var bCase = K.btn(K.t("본문 상황 (push 빠짐)", "The post's case (no push)")), bReset = K.btn(K.t("처음으로", "Start over"));
    [bChk1, bChk2, bCase, bReset].forEach(function (b) { bar2.appendChild(b); });
    root.appendChild(bar2);

    var three = K.el("div", "tca-three");
    function box(title) { var b = K.el("div", "tca-box"); b.appendChild(K.el("div", "tca-h", title)); var c = K.el("div"); b.appendChild(c); three.appendChild(b); return c; }
    var cLocal = box(K.t("학습 서버 로컬 디스크", "Training server local disk"));
    var cGit = box(K.t("git 저장소", "git repository"));
    var cRemote = box(K.t("DVC 원격 (공유 스토리지)", "DVC remote (shared storage)"));
    root.appendChild(three);
    var prog = K.el("div", "cp-x"); var progI = K.el("i"); prog.appendChild(progI);
    root.appendChild(prog);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    var read2 = K.el("div", "tca-note");
    root.appendChild(read2);
    root.appendChild(K.el("div", "tca-note", K.t(
      "포인터에 적히는 것(디렉터리 해시·파일 수·전체 크기)과 파일 세 개는 본문 그대로다. 해시 값은 예시다.",
      "What the pointer records (directory hash, file count, total size) and the three files are from the post. The hash value is an example.")));

    function reset() { S = { add: false, commit: false, push: false, clean: false, chk: "" }; xfer = null; draw(); }
    function files(el, gone) {
      FILES.forEach(function (f) { el.appendChild(K.el("div", "cp-f" + (gone ? " gone" : ""), f)); });
    }
    function pointer(el) { el.appendChild(K.el("div", "cp-p", K.t("md5: 3f9a… (예시)\nnfiles: 3\nsize: 전체 크기", "md5: 3f9a… (example)\nnfiles: 3\nsize: total bytes"))); el.lastChild.style.whiteSpace = "pre-line"; }
    function draw() {
      cLocal.textContent = ""; cGit.textContent = ""; cRemote.textContent = "";
      files(cLocal, S.clean);
      if (S.clean) cLocal.appendChild(K.el("div", "cp-e", K.t("디스크를 비우려고 지웠다고 가정", "assume it was deleted to free the disk")));
      if (S.add && !S.commit) { pointer(cLocal); cLocal.appendChild(K.el("div", "cp-e", K.t(".dvc 포인터 (아직 커밋 전)", ".dvc pointer (not committed)"))); }
      if (S.commit) { pointer(cGit); cGit.appendChild(K.el("div", "cp-e", K.t("포인터가 커밋 이력에 있다", "pointer is in the commit history"))); }
      else cGit.appendChild(K.el("div", "cp-e", K.t("포인터 없음", "no pointer")));
      if (S.push) files(cRemote, false);
      else cRemote.appendChild(K.el("div", "cp-e", S.add ? K.t("그 해시의 내용이 없다", "no content for that hash") : K.t("비어 있다", "empty")));
      bCommit.disabled = !S.add || S.commit; bAdd.disabled = S.add || S.clean;
      bPush.disabled = !S.add || S.push || S.clean || !!xfer; bClean.disabled = S.clean;
      progI.style.width = xfer ? (xfer.p * 100) + "%" : "0%";
      var r = "", c = "tca-read";
      if (S.chk === "1") {
        if (S.commit) { r = K.t("확인 ①: 통과. 포인터가 커밋돼 있다.", "Check ①: pass. The pointer is committed."); c += " tca-good"; }
        else { r = K.t("확인 ①: 실패. 커밋된 포인터가 없다.", "Check ①: fail. No committed pointer."); c += " tca-bad"; }
        if (S.commit && !S.push) r += K.t(" 그러나 원격에는 내용이 없다 — 이 확인은 그 사실을 보지 못한다.", " But the remote has no content — this check cannot see that.");
      } else if (S.chk === "2") {
        if (S.commit && S.push) { r = K.t("확인 ②: 통과. 다른 위치에서 파일 3개를 내려받았다. 여기까지 해야 등록이다.", "Check ②: pass. Three files fetched elsewhere. Registration ends here."); c += " tca-good"; }
        else if (!S.commit) { r = K.t("확인 ②: 실패. 내려받을 포인터가 없다.", "Check ②: fail. No pointer to fetch."); c += " tca-bad"; }
        else { r = K.t("확인 ②: 실패. 원격 캐시에 그 해시가 없다. 포인터가 존재하지 않는 내용을 가리킨다.", "Check ②: fail. The remote cache has no such hash; the pointer points at content that does not exist."); c += " tca-bad"; }
      } else if (xfer) {
        r = (xfer.kind === "push" ? K.t("원격에 올리는 중… ", "Uploading… ") : K.t("다른 위치에서 내려받는 중… ", "Fetching elsewhere… ")) + Math.round(xfer.p * 100) + "%";
      } else {
        r = K.t("단계: ", "Steps: ") + ["add", "commit", "push"].filter(function (k) { return S[k]; }).join(" → ") + (S.add ? "" : K.t("아직 없음", "none yet"));
      }
      read.className = c; read.textContent = r;
      read2.textContent = S.clean && !S.push ? K.t("로컬까지 지웠다면 내용은 어디에도 없다. 본문의 배포 모델은 배포 번들 안에 사본이 있어서, 크기와 파일 목록으로 같은 내용임을 확인할 수 있었다.",
        "Delete the local copy too and the content is nowhere. In the post the deployed model had a copy inside the deployment bundle, matched by size and file list.") : "";
    }
    K.loop(root, function (dt) {
      if (!xfer) return;
      xfer.p = Math.min(1, xfer.p + dt / 900);
      if (xfer.p >= 1) {
        var k = xfer.kind; xfer = null;
        if (k === "push") S.push = true; else S.chk = "2";
      }
      draw();
    });
    function start(kind) { S.chk = ""; if (K.reduce) { if (kind === "push") S.push = true; else S.chk = "2"; draw(); return; } xfer = { kind: kind, p: 0 }; draw(); }
    bAdd.addEventListener("click", function () { S.add = true; S.chk = ""; draw(); });
    bCommit.addEventListener("click", function () { S.commit = true; S.chk = ""; draw(); });
    bPush.addEventListener("click", function () { start("push"); });
    bClean.addEventListener("click", function () { S.clean = true; S.chk = ""; draw(); });
    bChk1.addEventListener("click", function () { if (xfer) return; S.chk = "1"; draw(); });
    bChk2.addEventListener("click", function () {
      if (xfer) return;
      if (S.commit && S.push) start("pull"); else { S.chk = "2"; draw(); }
    });
    bCase.addEventListener("click", function () { reset(); S.add = true; S.commit = true; draw(); });
    bReset.addEventListener("click", reset);
    reset();
  });
})();
