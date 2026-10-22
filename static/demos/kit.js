/*
 * 블로그 글 속 움직이는 그림의 공통 도구.
 * 글마다 static/demos/<글 이름>.js 가 DemoKit.register("이름", init) 으로 그림을 등록하고,
 * 글 본문의 {{< demo name="이름" >}} 자리(.tca[data-demo])에 그려진다.
 * 색은 테마(PaperMod)의 CSS 변수를 따라가서 라이트·다크 모드가 같이 바뀐다.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.DemoKit) return;

  var CSS = [
    ".tca{--tca-good:#2a9d5c;--tca-bad:#d62728;--tca-warn:#b8860b;--tca-accent:#4e79a7;",
    "border:1px solid var(--tertiary);border-radius:8px;padding:14px;margin:24px 0;",
    "background:var(--entry);color:var(--primary);font-size:14px;line-height:1.5;overflow-wrap:anywhere}",
    ":root[data-theme='dark'] .tca{--tca-good:#5cc290;--tca-bad:#ff6b6b;--tca-warn:#e0bd4a;--tca-accent:#7ea6d8}",
    ".tca *{box-sizing:border-box}",
    ".tca-title{font-weight:600;font-size:15px;margin:0 0 2px}",
    ".tca-sub{color:var(--secondary);font-size:13px;margin:0 0 10px}",
    ".tca-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 12px}",
    ".tca-seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--tertiary);border-radius:6px;overflow:hidden}",
    ".tca-btn{font:inherit;font-size:13px;line-height:1.4;padding:4px 10px;border:1px solid var(--tertiary);",
    "background:var(--theme);color:var(--primary);border-radius:6px;cursor:pointer}",
    ".tca-seg .tca-btn{border:0;border-radius:0}",
    ".tca-seg .tca-btn+.tca-btn{border-left:1px solid var(--tertiary)}",
    ".tca-btn[aria-pressed='true']{background:var(--primary);color:var(--theme)}",
    ".tca-btn:focus-visible,.tca input:focus-visible{outline:2px solid var(--tca-accent);outline-offset:2px}",
    ".tca-btn:disabled{opacity:.45;cursor:default}",
    ".tca-lbl{display:inline-flex;align-items:center;gap:6px;font-size:13px}",
    ".tca-lbl input[type=range]{width:130px;accent-color:var(--tca-accent)}",
    ".tca-num{font-variant-numeric:tabular-nums}",
    ".tca-read{font-variant-numeric:tabular-nums;margin:12px 0 0}",
    ".tca-note{color:var(--secondary);font-size:13px;margin:8px 0 0}",
    ".tca-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--secondary);margin-top:8px}",
    ".tca-legend i{display:inline-block;width:14px;height:10px;margin-right:5px;vertical-align:-1px;border-radius:2px}",
    ".tca-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}",
    ".tca-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}",
    "@media (max-width:600px){.tca-two,.tca-three{grid-template-columns:minmax(0,1fr)}}",
    ".tca-box{border:1px solid var(--tertiary);border-radius:6px;padding:10px;min-width:0}",
    ".tca-h{font-weight:600;font-size:13.5px;margin:0 0 6px}",
    ".tca-tag{display:inline-block;font-size:12px;padding:1px 8px;border-radius:10px;border:1px solid var(--tertiary);color:var(--secondary)}",
    ".tca-chip{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;",
    "padding:0 7px;border-radius:12px;font-weight:600;font-size:12px;color:#111;flex:none}",
    ".tca-rows{display:flex;flex-direction:column;gap:4px}",
    ".tca-row{display:flex;align-items:center;gap:8px;min-height:22px}",
    ".tca-row-l{flex:none;width:var(--tca-lw,96px);font-size:12.5px;color:var(--secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tca-track{position:relative;flex:1;min-width:0;height:16px;background:var(--code-bg);border-radius:3px;overflow:hidden}",
    ".tca-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--tca-accent);transition:width .35s ease}",
    ".tca-row-r{flex:none;width:var(--tca-rw,64px);text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums}",
    ".tca-svg{display:block;width:100%;height:auto;overflow:visible}",
    ".tca-svg text{fill:var(--primary);font-family:inherit}",
    ".tca-svg .muted{fill:var(--secondary)}",
    ".tca-good{color:var(--tca-good)}.tca-bad{color:var(--tca-bad)}.tca-warn{color:var(--tca-warn)}",
    ".tca-pop{animation:tca-pop .35s ease-out}",
    "@keyframes tca-pop{from{transform:scale(.6);opacity:.2}to{transform:scale(1);opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.tca-pop{animation:none}.tca-fill{transition:none}}"
  ].join("");

  var COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#59a14f", "#b07aa1", "#76b7b2", "#edc948", "#9c755f"];
  var reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lang = ((document.documentElement && document.documentElement.lang) || "ko").toLowerCase().indexOf("en") === 0 ? "en" : "ko";
  var registry = {}, started = false;

  function css(id, text) {
    if (document.getElementById(id)) return;
    var s = document.createElement("style");
    s.id = id;
    s.textContent = text;
    document.head.appendChild(s);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function btn(label, pressed) {
    var b = el("button", "tca-btn", label);
    b.type = "button";
    if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
    return b;
  }
  function press(b, on) { b.setAttribute("aria-pressed", on ? "true" : "false"); }
  // 여러 개 중 하나를 고르는 버튼 묶음. options = [{value, label}], onChange(value)
  function seg(options, value, onChange, ariaLabel) {
    var wrap = el("span", "tca-seg");
    wrap.setAttribute("role", "group");
    if (ariaLabel) wrap.setAttribute("aria-label", ariaLabel);
    var bs = options.map(function (o) {
      var b = btn(o.label, o.value === value);
      b.addEventListener("click", function () { set(o.value); onChange(o.value); });
      wrap.appendChild(b);
      return b;
    });
    function set(v) { bs.forEach(function (b, i) { press(b, options[i].value === v); }); }
    return { el: wrap, set: set };
  }
  // 슬라이더. o = {label, min, max, step, value, fmt(v), onInput(v)}
  function slider(o) {
    var lab = el("label", "tca-lbl");
    var r = document.createElement("input");
    r.type = "range"; r.min = String(o.min); r.max = String(o.max); r.step = String(o.step || 1); r.value = String(o.value);
    var out = el("span", "tca-num", o.fmt ? o.fmt(o.value) : String(o.value));
    lab.appendChild(document.createTextNode(o.label));
    lab.appendChild(r); lab.appendChild(out);
    r.addEventListener("input", function () { var v = +r.value; out.textContent = o.fmt ? o.fmt(v) : String(v); if (o.onInput) o.onInput(v); });
    return { el: lab, input: r, set: function (v) { r.value = String(v); out.textContent = o.fmt ? o.fmt(v) : String(v); } };
  }
  // 제목·설명을 붙인다
  function head(root, title, sub) {
    root.textContent = "";
    root.appendChild(el("div", "tca-title", title));
    if (sub) root.appendChild(el("div", "tca-sub", sub));
  }
  // 화면에 보일 때만 step(dtMs) 를 매 프레임 부른다. dt 는 최대 100ms 로 자른다.
  function loop(root, step) {
    var visible = false, last = 0, running = false;
    function frame(now) {
      if (!visible) { running = false; return; }
      var dt = last ? Math.min(100, now - last) : 0;
      last = now;
      try { step(dt); } catch (e) { visible = false; running = false; throw e; }
      requestAnimationFrame(frame);
    }
    function setVisible(v) {
      visible = v;
      if (v && !running) { running = true; last = 0; requestAnimationFrame(frame); }
    }
    if (typeof IntersectionObserver !== "function") setVisible(true);
    else new IntersectionObserver(function (es) { es.forEach(function (e) { setVisible(e.isIntersecting); }); }, { threshold: 0.1 }).observe(root);
  }
  function t(ko, en) { return lang === "en" && en != null ? en : ko; }
  function fmt(n, d) {
    var s = Number(n).toFixed(d == null ? 0 : d);
    var p = s.split(".");
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return p.join(".");
  }

  function initRoot(r) {
    var name = r.getAttribute("data-demo"), fn = registry[name];
    if (!fn || r.getAttribute("data-demo-on")) return;
    r.setAttribute("data-demo-on", "1");
    fn(r);
  }
  function start() {
    started = true;
    css("tca-kit-css", CSS);
    Array.prototype.forEach.call(document.querySelectorAll(".tca[data-demo]"), initRoot);
  }
  function register(name, init) {
    registry[name] = init;
    if (started) Array.prototype.forEach.call(document.querySelectorAll('.tca[data-demo="' + name + '"]'), initRoot);
  }

  window.DemoKit = { register: register, css: css, el: el, svg: svg, btn: btn, press: press, seg: seg, slider: slider,
    head: head, loop: loop, t: t, fmt: fmt, COLORS: COLORS, reduce: reduce, lang: lang };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else setTimeout(start, 0);
})();
