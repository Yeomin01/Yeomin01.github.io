/* 「인코딩은 judge의 사각지대다」 글의 그림: 전량 재검증과 계열 게이팅에서 두 공격 계열이 지나는 길 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  K.register("encoding-gate-lanes", function (root) {
    var mode = "all", playing = !K.reduce;
    // 글 본문 값: 2차 뒤 탈옥 74%, 암호 치환 1차 100% → 2차 뒤 18%
    var LANES = [
      { id: "jb", y: 62, keep: 0.74, label: K.t("탈옥 프롬프트 — 의미가 표면에 있다", "Jailbreak prompts — meaning on the surface") },
      { id: "ci", y: 142, keep: 0.18, label: K.t("암호 치환 — 의미를 인코딩으로 감췄다", "Substitution cipher — meaning hidden by encoding") }
    ];
    var X1 = 78, XJ = 250, XE = 430, JW = 92;

    K.head(root, K.t("judge에 다 태우기 vs 계열별로 게이팅", "Send everything to the judge vs gate by family"),
      K.t("점 하나가 1차가 공격으로 본 세션 하나다. 2차 judge는 의미를 읽어서 판단한다. 암호 치환은 읽을 의미가 표면에 없어 대부분 정상으로 되돌아간다. 게이팅으로 바꾸면 그 계열은 judge를 건너뛴다.",
        "Each dot is a session stage 1 flagged. The judge decides by reading meaning; a cipher has no surface meaning to read, so most are sent back as benign. With gating that family skips the judge."));

    var bar = K.el("div", "tca-bar");
    var sg = K.seg([{ value: "all", label: K.t("전량 재검증", "Re-check everything") }, { value: "gate", label: K.t("계열 게이팅", "Gate by family") }],
      mode, function (v) { mode = v; render(); }, K.t("라우팅", "Routing"));
    var bP = K.btn(playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"));
    bP.addEventListener("click", function () { playing = !playing; bP.textContent = playing ? K.t("일시정지", "Pause") : K.t("재생", "Play"); });
    bar.appendChild(sg.el); bar.appendChild(bP);
    root.appendChild(bar);

    var sv = K.svg("svg", { "class": "tca-svg", viewBox: "0 0 480 196", role: "img",
      "aria-label": K.t("두 공격 계열이 1차와 2차를 지나는 길", "Paths of two attack families through stage 1 and stage 2") }, root);
    function box(x, y, w, h, txt) {
      K.svg("rect", { x: x - w / 2, y: y, width: w, height: h, rx: 6, fill: "var(--code-bg)", stroke: "var(--tertiary)" }, sv);
      var t = K.svg("text", { x: x, y: y + 15, "font-size": 12, "text-anchor": "middle" }, sv);
      t.textContent = txt;
      return t;
    }
    var paths = {};
    LANES.forEach(function (L) {
      var lt = K.svg("text", { x: 4, y: L.y - 26, "font-size": 12, "class": "muted" }, sv);
      lt.textContent = L.label;
      paths[L.id] = K.svg("path", { fill: "none", stroke: "var(--tertiary)", "stroke-width": 2 }, sv);
    });
    box(X1, 2, 84, 22, K.t("1차 BERT", "Stage 1 BERT"));
    box(XJ, 2, JW, 22, K.t("2차 judge", "Stage 2 judge"));
    box(XE, 2, 84, 22, K.t("최종", "Final"));
    LANES.forEach(function (L) {
      K.svg("rect", { x: X1 - 14, y: L.y - 12, width: 28, height: 24, rx: 4, fill: "none", stroke: "var(--tertiary)" }, sv);
      K.svg("rect", { x: XJ - 18, y: L.y - 12, width: 36, height: 24, rx: 4, fill: "none", stroke: "var(--tertiary)" }, sv);
    });
    var bypassTxt = K.svg("text", { x: XJ, y: 190, "font-size": 12, "text-anchor": "middle", "class": "muted" }, sv);

    function laneY(L, x, route) {
      if (route !== "skip") return L.y;
      var a = XJ - 70, b = XJ + 70;
      if (x <= a || x >= b) return L.y;
      var u = (x - a) / (b - a);
      return L.y + 32 * Math.sin(Math.PI * u);
    }
    function drawPaths() {
      LANES.forEach(function (L) {
        var r = L.id === "ci" && mode === "gate" ? "skip" : "judge", d = "";
        for (var x = 20; x <= 460; x += 10) d += (x === 20 ? "M" : "L") + x + " " + laneY(L, x, r).toFixed(1) + " ";
        paths[L.id].setAttribute("d", d);
      });
      bypassTxt.textContent = mode === "gate" ? K.t("암호 계열은 judge를 건너뛰고 1차 판정을 따른다", "the cipher family skips the judge and keeps stage 1's call") : "";
    }

    // 점 풀
    var dots = [], spawnAcc = [0, 260], serial = [0, 0];
    LANES.forEach(function (L, li) {
      for (var i = 0; i < 9; i++) {
        var e = li === 0 ? K.svg("circle", { r: 6 }, sv) : K.svg("rect", { width: 11, height: 11, rx: 2 }, sv);
        e.style.display = "none";
        dots.push({ e: e, L: L, li: li, on: false });
      }
    });
    // 글의 비율과 맞도록 50개 단위로 남길 점을 고르게 정한다
    function kept(L, n) { return ((n * 7) % 50) < Math.round(L.keep * 50); }
    function place(d) {
      var y = laneY(d.L, d.x, d.route);
      var col = d.x < X1 ? "var(--secondary)" : (d.state === "rel" ? "var(--tca-good)" : "var(--tca-bad)");
      d.e.setAttribute("fill", col);
      if (d.li === 0) { d.e.setAttribute("cx", d.x.toFixed(1)); d.e.setAttribute("cy", y.toFixed(1)); }
      else { d.e.setAttribute("x", (d.x - 5.5).toFixed(1)); d.e.setAttribute("y", (y - 5.5).toFixed(1)); }
    }
    function step(dt) {
      if (!playing) return;
      LANES.forEach(function (L, li) {
        spawnAcc[li] += dt;
        if (spawnAcc[li] >= 520) {
          spawnAcc[li] = 0;
          for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            if (d.li === li && !d.on) {
              d.on = true; d.x = 20; d.state = "blk"; d.route = null; d.n = serial[li]++; d.e.style.display = ""; break;
            }
          }
        }
      });
      dots.forEach(function (d) {
        if (!d.on) return;
        d.x += dt * 0.11;
        if (d.route === null && d.x >= XJ - 80) d.route = d.L.id === "ci" && mode === "gate" ? "skip" : "judge";
        if (d.route === "judge" && d.state === "blk" && d.x >= XJ && !kept(d.L, d.n)) d.state = "rel";
        if (d.x > 465) { d.on = false; d.e.style.display = "none"; return; }
        place(d);
      });
    }

    var rows = K.el("div", "tca-rows");
    rows.style.setProperty("--tca-lw", "70px");
    rows.style.setProperty("--tca-rw", "112px");
    rows.style.marginTop = "6px";
    function row(label) {
      var r = K.el("div", "tca-row"), tr = K.el("div", "tca-track"), f = K.el("div", "tca-fill"), v = K.el("div", "tca-row-r");
      tr.appendChild(f);
      r.appendChild(K.el("div", "tca-row-l", label)); r.appendChild(tr); r.appendChild(v);
      rows.appendChild(r);
      return { f: f, v: v };
    }
    var rh = K.el("div", "tca-h", K.t("최종 재현율", "Final recall"));
    rh.style.marginTop = "6px";
    root.appendChild(rh);
    var rJ = row(K.t("탈옥", "Jailbreak")), rC = row(K.t("암호 치환", "Cipher"));
    root.appendChild(rows);
    var lg = K.el("div", "tca-legend");
    [["var(--tca-bad)", K.t("공격으로 유지(차단)", "kept as attack (blocked)")], ["var(--tca-good)", K.t("judge가 정상으로 되돌림", "sent back as benign by the judge")]]
      .forEach(function (x) { var s = K.el("span"), i = K.el("i"); i.style.background = x[0]; s.appendChild(i); s.appendChild(document.createTextNode(x[1])); lg.appendChild(s); });
    root.appendChild(lg);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "74%·100%·18%는 글 본문 값이고, 점은 그 비율에 맞춰 고르게 칠했다. 탈옥 74%는 1차와 2차를 다 거친 최종 값이라, 놓친 몫이 어느 단계에서 생겼는지는 그림이 구분하지 않는다. 게이팅의 결과는 글에서 따로 재지 않았다. 계열 구분이 정확하다고 두고 1차 측정값을 그대로 옮긴 것이다.",
      "74%, 100% and 18% are from the post; dots are coloured evenly to match. Jailbreak 74% is the final value after both stages, so the figure does not say where the misses happen. The post did not measure gating itself; it assumes the family is identified correctly and carries over the stage-1 value.")));

    function render() {
      sg.set(mode);
      drawPaths();
      rJ.f.style.width = "74%"; rJ.f.style.background = "var(--tca-bad)"; rJ.v.textContent = "74%";
      if (mode === "all") {
        rC.f.style.width = "18%"; rC.v.textContent = K.t("18% (1차 100%)", "18% (stage 1: 100%)");
        read.textContent = K.t("전량 재검증: 1차가 100% 잡던 암호 치환이 judge를 지나며 18%만 남는다. judge 입장에서 치환된 요청은 해독 안 되는 잡음이라 정상이라고 답한다.",
          "Re-check everything: the cipher family stage 1 caught at 100% drops to 18% after the judge, which reads the substituted request as undecodable noise and calls it benign.");
      } else {
        rC.f.style.width = "100%"; rC.v.textContent = K.t("1차 유지 100%", "stage 1 kept 100%");
        read.textContent = K.t("계열 게이팅: 탈옥은 그대로 judge가 보고, 암호 치환은 표면 패턴을 외운 1차의 판정을 따른다. 각 층이 강한 곳에만 그 층을 쓴다.",
          "Gate by family: the judge still reviews jailbreaks, while the cipher family keeps the call of stage 1, which memorised the surface pattern. Each layer is used only where it is strong.");
      }
      rC.f.style.background = "var(--tca-bad)";
    }
    K.loop(root, step);
    render();
    // 움직임 줄이기일 때도 한 장면은 보이도록 점을 미리 깔아 둔다
    (function seed() {
      var was = playing; playing = true;
      for (var k = 0; k < 40; k++) step(100);
      playing = was;
    })();
  });
})();
