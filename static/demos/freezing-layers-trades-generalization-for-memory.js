/* 「얼린 레이어는 메모리를 아끼고 일반화를 깎는다」 글의 그림: 학습 메모리를 단계별로 쌓아 보기 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var S = '.tca[data-demo="freeze-memory"] ';
  K.css("freezing-layers-trades-generalization-for-memory-css", [
    S + ".fm-r{margin:0 0 10px}",
    S + ".fm-top{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin:0 0 3px}",
    S + ".fm-top b{font-variant-numeric:tabular-nums}",
    S + ".fm-bar{position:relative;display:flex;height:24px;border-radius:4px;background:var(--code-bg)}",
    S + ".fm-bar div{height:100%;transition:width .35s ease;border-right:1px solid var(--entry)}",
    S + ".fm-line{position:absolute;top:-4px;bottom:-4px;width:2px;height:auto!important;background:var(--tca-bad);border:0!important}",
    S + ".fm-ax{position:relative;height:16px;font-size:11.5px;color:var(--secondary)}",
    S + ".fm-ax span{position:absolute;transform:translateX(-50%);white-space:nowrap}",
    "@media (prefers-reduced-motion:reduce){" + S + ".fm-bar div{transition:none}}"
  ].join(""));

  K.register("freeze-memory", function (root) {
    var W = 0.4, G = 0.4, M = 0.8, ACT = 0.2, ACT_CK = 0.05, BUDGET = 1.5, MAX = 2.6;
    var PARTS = [
      { k: "w", n: K.t("가중치", "Weights"), c: K.COLORS[0] },
      { k: "g", n: K.t("그레디언트", "Gradients"), c: K.COLORS[1] },
      { k: "m", n: K.t("옵티마이저 모멘트", "Optimizer moments"), c: K.COLORS[2] },
      { k: "a", n: K.t("활성화", "Activations"), c: K.COLORS[3] }
    ];
    var batch = 8, ck = false, frz = false, bf = false;

    K.head(root, K.t("학습 메모리를 단계별로 쌓아 보기", "Stacking training memory by phase"),
      K.t("AdamW는 학습하는 파라미터마다 모멘트 두 개를 따로 든다. 이 몫은 배치 크기와 상관없는 고정비용이고, 옵티마이저 스텝에서 한꺼번에 잡힌다. 하나씩 켜 보며 어느 단계에서 넘치는지 본다.",
        "AdamW keeps two moments for every trainable parameter. That is a fixed cost independent of batch size, allocated at the optimizer step. Toggle the options and see which phase overflows."));

    var bar = K.el("div", "tca-bar");
    var sB = K.seg([{ value: 8, label: K.t("배치 8", "Batch 8") }, { value: 2, label: K.t("배치 2", "Batch 2") }], batch,
      function (v) { batch = v; render(); }, K.t("배치 크기", "Batch size"));
    var bCk = K.btn("gradient checkpointing", false);
    var bFr = K.btn(K.t("하위 절반 동결", "Freeze lower half"), false);
    var bBf = K.btn(K.t("순수 bf16", "Pure bf16"), false);
    bar.appendChild(sB.el); bar.appendChild(bCk); bar.appendChild(bFr); bar.appendChild(bBf);
    root.appendChild(bar);

    function stack(title) {
      var r = K.el("div", "fm-r");
      var top = K.el("div", "fm-top");
      top.appendChild(K.el("span", null, title));
      var v = K.el("b");
      top.appendChild(v);
      r.appendChild(top);
      var b = K.el("div", "fm-bar");
      var segs = PARTS.map(function (p) { var d = K.el("div"); d.style.background = p.c; b.appendChild(d); return d; });
      var ln = K.el("div", "fm-line");
      ln.style.left = (BUDGET / MAX * 100) + "%";
      b.appendChild(ln);
      r.appendChild(b);
      root.appendChild(r);
      return { v: v, segs: segs };
    }
    var sF = stack(K.t("순전파·역전파 중", "During forward and backward"));
    var sS = stack(K.t("옵티마이저 스텝", "At the optimizer step"));
    var ax = K.el("div", "fm-ax");
    [0, 0.5, 1, 1.5, 2, 2.5].forEach(function (g) {
      var s = K.el("span", null, g + "GB" + (g === BUDGET ? K.t(" 여유", " free") : ""));
      s.style.left = (g / MAX * 100) + "%";
      ax.appendChild(s);
    });
    root.appendChild(ax);
    var lg = K.el("div", "tca-legend");
    PARTS.forEach(function (p) {
      var s = K.el("span"), i = K.el("i");
      i.style.background = p.c;
      s.appendChild(i); s.appendChild(document.createTextNode(p.n));
      lg.appendChild(s);
    });
    var li = K.el("span"), ii = K.el("i");
    ii.style.background = "var(--tca-bad)"; ii.style.width = "3px";
    li.appendChild(ii); li.appendChild(document.createTextNode(K.t("빨간 선 = 남은 여유", "Red line = free memory")));
    lg.appendChild(li);
    root.appendChild(lg);
    var fixed = K.el("div", "tca-read tca-num");
    root.appendChild(fixed);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "예시 값이다. 파라미터 1억 개(글의 예)를 fp32로 두면 가중치 0.4GB, 그레디언트 0.4GB, 모멘트 0.8GB다. 활성화는 샘플당 0.2GB, checkpointing이면 0.05GB로 두었다. 동결은 학습 대상 파라미터를 절반으로 줄이는 것으로만 그렸다. 여유는 1.5GB로 두었다(글: 2GB가 채 안 됐다).",
      "Example values. With 100 M parameters (the post's example) in fp32: weights 0.4 GB, gradients 0.4 GB, moments 0.8 GB. Activations are 0.2 GB per sample, 0.05 GB with checkpointing. Freezing is drawn only as halving the trainable parameters. Free memory is set to 1.5 GB (the post: under 2 GB).")));

    function render() {
      var sc = bf ? 0.5 : 1, tf = frz ? 0.5 : 1;
      var w = W * sc, g = G * sc * tf, m = M * sc * tf, a = (ck ? ACT_CK : ACT) * sc * batch;
      var fw = { w: w, g: g, m: 0, a: a }, st = { w: w, g: g, m: m, a: 0 };
      function draw(s, o) {
        var tot = o.w + o.g + o.m + o.a;
        PARTS.forEach(function (p, i) { s.segs[i].style.width = (o[p.k] / MAX * 100) + "%"; });
        var over = tot > BUDGET + 1e-9;
        s.v.className = over ? "tca-bad" : "tca-good";
        s.v.textContent = tot.toFixed(2) + "GB · " + (over ? "OOM" : K.t("통과", "fits"));
        return over;
      }
      var oF = draw(sF, fw), oS = draw(sS, st);
      fixed.textContent = K.t("배치와 무관한 고정비용(가중치+그레디언트+모멘트): ", "Fixed cost independent of batch (weights + gradients + moments): ") + (w + g + m).toFixed(2) + "GB";
      var txt;
      if (oF) txt = batch === 8 && !ck ? K.t("평소 배치로는 순전파·역전파에서 바로 OOM이 난다.", "At the usual batch size it runs out of memory right in forward/backward.")
        : K.t("순전파·역전파에서 넘친다.", "Forward/backward overflows.");
      else if (oS) txt = ck ? K.t("checkpointing은 활성화만 줄인다. 넘치는 곳은 고정비용이 잡히는 옵티마이저 스텝이라 같은 자리에서 OOM이 난다.",
        "Checkpointing only shrinks activations. The overflow is at the optimizer step, where the fixed cost lands, so it fails in the same place.")
        : K.t("배치를 줄여 순전파·역전파는 통과했지만, 옵티마이저 스텝에서 모멘트가 한꺼번에 잡히며 OOM이 난다.",
          "A smaller batch gets through forward/backward, but the moments are allocated at the optimizer step and it runs out there.");
      else {
        txt = K.t("들어간다.", "It fits.");
        if (bf) txt += K.t(" 다만 순수 bf16에서는 AdamW 기본 eps(1e-8)가 반올림 오차에 묻혀 몇 백 스텝 안에 손실이 발산했다. eps 1e-5 에서도 재현됐다.",
          " But in pure bf16 AdamW's default eps (1e-8) vanished in rounding and the loss diverged within a few hundred steps; eps 1e-5 reproduced it.");
        if (frz) txt += K.t(" 동결한 파라미터는 그레디언트도 모멘트도 필요 없어 고정비용이 준다. 대신 하위 레이어는 사전학습 시점의 표현에 고정된 채 학습된다.",
          " Frozen parameters need no gradients or moments, so the fixed cost drops. The lower layers, though, stay fixed at their pretrained representations.");
      }
      if (read.textContent !== txt) read.textContent = txt;
    }
    function tog(b, get, set) {
      b.addEventListener("click", function () { set(!get()); K.press(b, get()); render(); });
    }
    tog(bCk, function () { return ck; }, function (v) { ck = v; });
    tog(bFr, function () { return frz; }, function (v) { frz = v; });
    tog(bBf, function () { return bf; }, function (v) { bf = v; });
    render();
  });
})();
