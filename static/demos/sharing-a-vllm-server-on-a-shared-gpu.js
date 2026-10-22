/* 「공유 GPU를 이미 다른 vLLM 서버가 쓰고 있었다」 글의 그림: 메모리가 모자랄 때의 선택지와 서버 공유 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.css("sharing-a-vllm-server-on-a-shared-gpu-css", [
    '.tca[data-demo="vllm-share"] .vs-gpu{position:relative;height:30px;border:1px solid var(--tertiary);border-radius:5px;background:var(--code-bg);margin:4px 0 4px}',
    '.tca[data-demo="vllm-share"] .vs-b{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;transition:opacity .3s}',
    '.tca[data-demo="vllm-share"] .vs-x{background:repeating-linear-gradient(135deg,var(--tca-bad) 0 3px,transparent 3px 7px);color:var(--primary);border:1px dashed var(--tca-bad)}',
    '.tca[data-demo="vllm-share"] .vs-wrap{padding-right:40px}',
    '.tca[data-demo="vllm-share"] .vs-req{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;min-height:18px}',
    '.tca[data-demo="vllm-share"] .vs-req i{display:inline-block;width:12px;height:12px;border-radius:3px}'
  ].join(""));

  K.register("vllm-share", function (root) {
    var GPU = 16, SERVER = 13.8;
    var choice = "share", conc = 6, otherDone = false;
    var OPTS = [
      { value: "direct", label: K.t("직접 올림", "Load my own copy") },
      { value: "kill", label: K.t("그 프로세스 종료", "Kill that process") },
      { value: "auto", label: K.t("비면 자동 시작", "Auto-start when free") },
      { value: "wait", label: K.t("끝날 때까지 기다림", "Wait for it to finish") },
      { value: "share", label: K.t("서버를 같이 씀", "Share the server") }
    ];

    K.head(root, K.t("GPU 16GB 중 13.8GB를 다른 vLLM 서버가 쓰고 있다", "Another vLLM server holds 13.8 of 16 GB"),
      K.t("선택지를 바꿔 보면 GPU 메모리와 결과가 어떻게 달라지는지 보인다. 서버를 같이 쓸 때는 동시 요청 수를 다른 작업의 상태에 맞춘다.",
        "Switch options to see what happens to GPU memory and to the work. When sharing, match the concurrency to the other job's state."));

    var bar = K.el("div", "tca-bar");
    var sChoice = K.seg(OPTS, choice, function (v) { choice = v; render(); }, K.t("선택지", "Option"));
    bar.appendChild(sChoice.el);
    root.appendChild(bar);
    var bar2 = K.el("div", "tca-bar");
    var lab = K.el("span", "tca-lbl", K.t("내 동시 요청", "My concurrency"));
    var sConc = K.seg([{ value: 6, label: "6" }, { value: 12, label: "12" }], conc, function (v) { conc = v; render(); }, K.t("내 동시 요청", "My concurrency"));
    var bDone = K.btn(K.t("다른 작업의 완료 표시 확인됨", "Other job's completion mark confirmed"), otherDone);
    bar2.appendChild(lab); bar2.appendChild(sConc.el); bar2.appendChild(bDone);
    root.appendChild(bar2);

    root.appendChild(K.el("div", "tca-h", K.t("GPU 메모리 (16GB)", "GPU memory (16 GB)")));
    var wrap = K.el("div", "vs-wrap");
    var gpu = K.el("div", "vs-gpu");
    var bSrv = K.el("div", "vs-b");
    bSrv.style.left = "0"; bSrv.style.width = (SERVER / GPU * 100) + "%"; bSrv.style.background = K.COLORS[0];
    var bMine = K.el("div", "vs-b vs-x");
    gpu.appendChild(bSrv); gpu.appendChild(bMine);
    wrap.appendChild(gpu);
    root.appendChild(wrap);
    var memRead = K.el("div", "tca-note");
    root.appendChild(memRead);

    root.appendChild(K.el("div", "tca-h", K.t("서버가 처리 중인 요청", "Requests in flight on the server")));
    root.lastChild.style.marginTop = "12px";
    var reqOther = K.el("div", "vs-req"), reqMine = K.el("div", "vs-req");
    var lgO = K.el("div", "tca-note"), lgM = K.el("div", "tca-note");
    root.appendChild(lgO); root.appendChild(reqOther); root.appendChild(lgM); root.appendChild(reqMine);

    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "16GB · 13.8GB · 0.85 · 다른 작업의 동시 16 · 내 동시 6과 12 · 명세 1건당 약 5초 · 완료 1건당 약 1.6초 · KV 캐시 사용률 55~65% 는 본문 값이다. 직접 올릴 때 막대 길이는 '수 GB'를 그린 예시다.",
      "16 GB, 13.8 GB, 0.85, the other job's 16, my 6 and 12, about 5 s per spec, about 1.6 s per completion and 55–65% KV usage are from the post. The bar for loading my own copy illustrates 'several GB'.")));

    function dots(el, n, color) {
      el.textContent = "";
      for (var i = 0; i < n; i++) { var d = K.el("i"); d.style.background = color; el.appendChild(d); }
    }
    function render() {
      var shared = choice === "share";
      sConc.el.querySelectorAll("button").forEach(function (b) { b.disabled = !shared; });
      bDone.disabled = !(shared || choice === "wait");
      // 메모리 막대
      bSrv.style.opacity = choice === "kill" ? "0.25" : "1";
      bSrv.textContent = choice === "kill" ? K.t("남의 서버", "someone else's") : K.t("vLLM 서버 13.8GB", "vLLM server 13.8 GB");
      if (choice === "direct") {
        bMine.style.display = "flex";
        bMine.style.left = (SERVER / GPU * 100) + "%";
        bMine.style.width = "calc(" + ((GPU - SERVER) / GPU * 100) + "% + 40px)";
        bMine.textContent = K.t("수 GB 필요", "needs GBs");
        memRead.textContent = K.t("남은 2GB 남짓에 들어가지 않는다. 모델이 올라가지 않는다.", "It does not fit in the ~2 GB left. The model fails to load.");
      } else {
        bMine.style.display = "none";
        bMine.textContent = "";
        memRead.textContent = choice === "kill"
          ? K.t("끝내면 메모리는 비겠지만, 남의 작업이 같이 사라진다.", "Killing it would free memory, and erase someone else's work with it.")
          : shared
          ? K.t("내 작업이 더하는 GPU 메모리 0. vLLM은 시작할 때 KV 캐시를 미리 잡아 둔다.", "My job adds 0 GB. vLLM reserves its KV cache at start-up.")
          : K.t("남은 메모리 2GB 남짓.", "About 2 GB free.");
      }
      // 요청
      var od = otherDone && (shared || choice === "wait");
      var otherN = od ? 0 : 16, mineN = shared ? conc : 0;
      if (choice === "kill") otherN = 0;
      dots(reqOther, otherN, K.COLORS[1]);
      dots(reqMine, mineN, K.COLORS[3]);
      lgO.textContent = K.t("다른 작업: ", "Other job: ") + (choice === "kill" ? K.t("작업이 사라짐", "gone") : od ? K.t("끝남 (상태 파일의 완료 표시)", "finished (completion mark in its state file)") : K.t("동시 16", "16 concurrent"));
      lgM.textContent = K.t("내 작업: ", "My job: ") + (shared ? K.t("동시 ", "") + conc + K.t("", " concurrent") : choice === "direct" ? K.t("메모리 부족으로 시작 못 함", "cannot start") : K.t("대기", "waiting"));
      // 판정
      var cls = "tca-read", msg;
      if (choice === "direct") { cls += " tca-bad"; msg = K.t("직접 올림: 명세 1건당 약 5초 방식이지만, 지금은 올라가지조차 않는다.", "Own copy: about 5 s per spec, but right now it does not even load."); }
      else if (choice === "kill") { cls += " tca-bad"; msg = K.t("하지 않았다. 내가 띄운 프로세스가 아니다. 소유자 확인 없이 끝내면 그 사람의 몇 시간짜리 작업이 사라질 수 있다.", "Not done. It is not my process; killing it could erase hours of someone's work."); }
      else if (choice === "auto") { cls += " tca-bad"; msg = K.t("만들지 않았다. 예전에 이런 대기 장치가 기다리라고 한 뒤에 혼자 시작해 GPU를 15GB 넘게 잡은 일이 있었다.", "Not built. Such a waiter once started on its own after being told to wait and took over 15 GB."); }
      else if (choice === "wait") { msg = od ? K.t("다른 작업은 끝났지만 서버가 떠 있는 동안 메모리는 그대로다. 본문은 이 시점에 같은 서버의 동시 요청을 12개로 올렸다.", "The other job is done, but the server still holds its memory while it is up. The post raised concurrency on that same server to 12 at this point.") : K.t("본문에서 물은 두 선택지 중 하나다. 끝나는 시점은 그 작업의 진행 로그로 가늠했다.", "One of the two options asked about. Its end was estimated from its progress log."); }
      else if (!otherDone && conc === 12) { cls += " tca-warn"; msg = K.t("다른 작업이 아직 돈다. 본문에서는 이때 6개로 붙였고, 완료 표시를 확인한 뒤에 12개로 올렸다. 메모리는 그대로이고 서로 느려질 뿐이다.", "The other job is still running. The post used 6 here and went to 12 only after its completion mark. Memory stays the same; both just slow down."); }
      else if (!otherDone) { cls += " tca-good"; msg = K.t("서버 공유, 동시 6. 이때 서버 로그의 KV 캐시 사용률은 55~65%였다.", "Sharing at 6. KV cache usage in the server log was 55–65%."); }
      else if (conc === 12) { cls += " tca-good"; msg = K.t("서버 공유, 동시 12. 완료 1건당 약 1.6초. 추가 GPU 메모리 0.", "Sharing at 12: about 1.6 s per completion, 0 extra GPU memory."); }
      else { msg = K.t("다른 작업이 끝났으니 동시 요청을 12개로 올릴 수 있다.", "The other job is done; concurrency can go to 12."); }
      read.className = cls;
      read.textContent = msg;
    }
    bDone.addEventListener("click", function () { otherDone = !otherDone; K.press(bDone, otherDone); render(); });
    render();
  });
})();
