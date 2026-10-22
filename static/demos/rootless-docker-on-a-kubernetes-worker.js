/* 「쿠버네티스 워커 노드에서 도커가 필요할 때」 글의 그림: 설치 방식별로 노드 공용 부품에 닿는 것, 루트리스의 uid 대응 */
(function () {
  "use strict";
  var K = window.DemoKit;
  if (!K) return;

  var A = '.tca[data-demo="rootless-touch"] ';
  var B = '.tca[data-demo="rootless-uid"] ';
  K.css("rootless-docker-on-a-kubernetes-worker-css", [
    A + ".rt-g{display:flex;flex-direction:column;gap:5px;margin:0 0 10px}",
    A + ".rt-i{border:1px solid var(--tertiary);border-left-width:4px;border-radius:6px;padding:5px 9px;transition:border-color .3s,opacity .3s}",
    A + ".rt-i.bad{border-left-color:var(--tca-bad)}",
    A + ".rt-i.good{border-left-color:var(--tca-good)}",
    A + ".rt-i.use{border-left-color:var(--tca-accent)}",
    A + ".rt-i.off{opacity:.45}",
    A + ".rt-top{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:13px}",
    A + ".rt-top code{font-size:12px}",
    A + ".rt-d{font-size:12.5px;color:var(--secondary);margin-top:2px}",
    A + ".rt-tag.bad{color:var(--tca-bad);border-color:var(--tca-bad)}",
    A + ".rt-tag.good{color:var(--tca-good);border-color:var(--tca-good)}",
    A + ".rt-tag.use{color:var(--tca-accent);border-color:var(--tca-accent)}",
    B + ".ru-map{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;margin:4px 0 10px}",
    B + ".ru-map .tca-box{text-align:center}",
    B + ".ru-big{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}",
    B + ".ru-arrow{font-size:18px;color:var(--secondary)}"
  ].join(""));

  /* ── 1. 무엇이 노드 공용 부품에 닿나 ── */
  K.register("rootless-touch", function (root) {
    var ITEMS = [
      { g: 0, n: K.t("kubelet이 쓰는 containerd", "The containerd kubelet uses"), c: "/usr/local/bin" },
      { g: 0, n: K.t("파드 네트워크의 iptables 규칙", "iptables rules for the pod network"), c: "Calico · kube-proxy" },
      { g: 0, n: K.t("FORWARD 체인 기본 정책", "FORWARD chain default policy"), c: "" },
      { g: 0, n: K.t("공용 GPU 툴킷 설정", "Shared GPU toolkit config"), c: "/etc/nvidia-container-runtime/config.toml" },
      { g: 1, n: K.t("사용자 폴더의 도커 정적 빌드", "Static Docker build in the user's folder"), c: "~/bin" },
      { g: 1, n: K.t("GPU 설정 사본", "Copy of the GPU config"), c: "~/.config/nvidia-container-runtime/config.toml" },
      { g: 1, n: K.t("도커 데몬에만 주는 환경 변수", "Env var given only to the Docker daemon"), c: "XDG_CONFIG_HOME=%h/.config" }
    ];
    var BAD = ["bad", K.t("건드림", "touched")], OK = ["good", K.t("그대로", "unchanged")], USE = ["use", K.t("씀", "used")], NO = ["off", K.t("쓰지 않음", "unused")];
    var M = {
      sys: [
        [BAD, K.t("도커 패키지가 containerd 패키지를 같이 설치한다. 바이너리와 서비스가 둘이 된다.", "The Docker package pulls in its own containerd — two binaries, two services.")],
        [BAD, K.t("데몬이 시작할 때 iptables에 자기 체인을 만든다.", "The daemon creates its own iptables chains at start.")],
        [BAD, K.t("포워딩을 켜면서 기본 정책을 DROP으로 바꾼다(도커 문서에 적힌 동작).", "It enables forwarding and sets the default policy to DROP (documented behaviour).")],
        [["off", "—"], K.t("이 방식의 GPU 설정은 글에서 다루지 않았다.", "GPU config for this route is not covered in the post.")],
        [NO, ""], [NO, ""], [NO, ""]
      ],
      guide: [
        [OK, K.t("데몬이 사용자 네임스페이스 안에서 일반 사용자 권한으로 돈다.", "The daemon runs as a normal user inside a user namespace.")],
        [OK, K.t("네트워크는 slirp4netns 같은 사용자 공간 스택이 맡아 iptables를 고치지 않는다.", "A user-space stack such as slirp4netns handles networking; iptables is left alone.")],
        [OK, ""],
        [BAD, K.t("안내 문서대로 no-cgroups = true 로 고치면 노드의 GPU 파드에도 같이 적용된다.", "Setting no-cgroups = true here, as the guide says, also applies to the node's GPU pods.")],
        [USE, ""], [NO, ""], [NO, ""]
      ],
      copy: [
        [OK, K.t("데몬이 사용자 네임스페이스 안에서 일반 사용자 권한으로 돈다.", "The daemon runs as a normal user inside a user namespace.")],
        [OK, K.t("네트워크는 사용자 공간 스택이 맡아 iptables를 고치지 않는다.", "A user-space stack handles networking; iptables is left alone.")],
        [OK, ""],
        [OK, K.t("쿠버네티스 쪽은 계속 공용 파일을 읽는다.", "Kubernetes keeps reading the shared file.")],
        [USE, ""],
        [USE, K.t("바꾼 줄은 no-cgroups = true 하나다. 이 데몬이 띄우는 컨테이너만 사본을 읽는다.", "One changed line: no-cgroups = true. Only containers this daemon starts read the copy.")],
        [USE, K.t("systemd 덮어쓰기 파일로 도커 데몬에만 준다. 툴킷은 이 값이 있으면 /etc 대신 사본을 읽는다.", "A systemd drop-in gives it to the Docker daemon only; with it the toolkit reads the copy instead of /etc.")]
      ]
    };
    var mode = "sys";

    K.head(root, K.t("무엇이 노드의 공용 부품에 닿나", "What touches the node's shared parts"),
      K.t("다른 사람의 GPU 파드도 도는 워커 노드에 도커를 올리는 세 가지 방법이다. 방법을 바꾸면 노드 공용 부품 중 무엇을 건드리는지가 바뀐다.",
        "Three ways to get Docker onto a worker node that also runs other people's GPU pods. Each one touches different shared parts."));
    var bar = K.el("div", "tca-bar");
    var sg = K.seg([
      { value: "sys", label: K.t("시스템 도커", "System Docker") },
      { value: "guide", label: K.t("루트리스 + 안내 문서대로 GPU", "Rootless + GPU per the guide") },
      { value: "copy", label: K.t("루트리스 + 사본 설정", "Rootless + config copy") }
    ], mode, function (v) { mode = v; render(); }, K.t("설치 방법", "Install route"));
    bar.appendChild(sg.el);
    root.appendChild(bar);
    var groups = [K.el("div", "rt-g"), K.el("div", "rt-g")];
    root.appendChild(K.el("div", "tca-h", K.t("노드 공용 (쿠버네티스가 쓴다)", "Shared by the node (Kubernetes uses these)")));
    root.appendChild(groups[0]);
    root.appendChild(K.el("div", "tca-h", K.t("내 계정 안", "Inside my account")));
    root.appendChild(groups[1]);
    var els = ITEMS.map(function (it) {
      var d = K.el("div", "rt-i");
      var top = K.el("div", "rt-top");
      top.appendChild(K.el("span", null, it.n));
      if (it.c) top.appendChild(K.el("code", null, it.c));
      var tag = K.el("span", "tca-tag rt-tag");
      top.appendChild(tag);
      d.appendChild(top);
      var det = K.el("div", "rt-d");
      d.appendChild(det);
      groups[it.g].appendChild(d);
      return { d: d, tag: tag, det: det };
    });
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);

    function render() {
      var bad = 0;
      M[mode].forEach(function (m, i) {
        var e = els[i];
        e.d.className = "rt-i " + m[0][0];
        e.tag.className = "tca-tag rt-tag " + m[0][0];
        e.tag.textContent = m[0][1];
        e.det.textContent = m[1];
        e.det.style.display = m[1] ? "" : "none";
        if (ITEMS[i].g === 0 && m[0] === BAD) bad++;
      });
      read.textContent = bad
        ? K.t("노드 공용 부품 ", "Shared parts touched: ") + bad + K.t("곳을 건드린다.", ".")
        : K.t("노드 공용 부품은 하나도 건드리지 않는다. 바꾼 것은 전부 내 계정 안에 있다.", "No shared part is touched; every change lives inside my account.");
    }
    render();
  });

  /* ── 2. 컨테이너 uid 가 호스트에서 되는 번호 ── */
  K.register("rootless-uid", function (root) {
    var ME = 1500, SUB = 100000, RANGE = 65536;
    var cu = 1000, chowned = false;

    K.head(root, K.t("컨테이너 안의 uid가 호스트에서 무엇이 되나", "What a container uid becomes on the host"),
      K.t("루트리스에서는 컨테이너 안의 root가 호스트의 내 계정이고, 나머지 uid는 하위 uid 범위의 다른 번호가 된다. 바인드 마운트한 내 폴더에 쓸 수 있는지가 여기서 갈린다.",
        "In rootless mode the container's root is my host account, and every other uid maps into the subordinate range. That decides whether it can write to my bind-mounted folder."));
    var bar = K.el("div", "tca-bar");
    var sl = K.slider({ label: K.t("컨테이너 안 uid", "Container uid"), min: 0, max: 2000, step: 1, value: cu,
      onInput: function (v) { cu = v; render(); } });
    var b0 = K.btn(K.t("root (0)", "root (0)")), b1000 = K.btn("1000");
    var bCh = K.btn(K.t("쓰기 폴더를 chown 1000:1000", "chown 1000:1000 the folder"), false);
    bar.appendChild(sl.el); bar.appendChild(b0); bar.appendChild(b1000); bar.appendChild(bCh);
    root.appendChild(bar);
    var map = K.el("div", "ru-map");
    var bxC = K.el("div", "tca-box"), bxH = K.el("div", "tca-box");
    bxC.appendChild(K.el("div", "tca-sub", K.t("컨테이너 안", "In the container")));
    var vC = K.el("div", "ru-big"); bxC.appendChild(vC);
    bxH.appendChild(K.el("div", "tca-sub", K.t("호스트에서", "On the host")));
    var vH = K.el("div", "ru-big"); bxH.appendChild(vH);
    var vHn = K.el("div", "tca-note"); bxH.appendChild(vHn);
    map.appendChild(bxC); map.appendChild(K.el("div", "ru-arrow", "→")); map.appendChild(bxH);
    root.appendChild(map);
    var folder = K.el("div", "tca-read tca-num");
    root.appendChild(folder);
    var read = K.el("div", "tca-read");
    read.setAttribute("aria-live", "polite");
    root.appendChild(read);
    root.appendChild(K.el("div", "tca-note", K.t(
      "내 uid 1500 과 하위 uid 범위 시작 100000 은 예시 값이다(실제 값은 /etc/subuid 에 있다). 범위는 65,536개다. 폴더는 소유자만 쓸 수 있는 권한이라고 두었다.",
      "My uid 1500 and the subordinate range starting at 100000 are example values (the real ones are in /etc/subuid); the range holds 65,536 ids. The folder is owner-writable only.")));

    function host(u) { return u === 0 ? ME : SUB + u - 1; }
    function render() {
      var h = host(cu), owner = chowned ? host(1000) : ME;
      vC.textContent = "uid " + cu + (cu === 0 ? " (root)" : "");
      vH.textContent = "uid " + h;
      vHn.textContent = cu === 0 ? K.t("내 계정", "my account") : K.t("하위 범위 ", "subordinate range ") + SUB + "~" + (SUB + RANGE - 1);
      folder.textContent = K.t("바인드 마운트한 쓰기 폴더의 소유자: 호스트 uid ", "Owner of the bind-mounted folder: host uid ") + owner +
        (chowned ? K.t(" (컨테이너 root로 chown 1000:1000 한 뒤)", " (after chown 1000:1000 from container root)") : K.t(" (내 계정)", " (my account)"));
      var ok = h === owner || cu === 0;
      read.className = "tca-read " + (ok ? "tca-good" : "tca-bad");
      read.textContent = (ok ? K.t("쓸 수 있다. ", "Can write. ") : K.t("쓰지 못한다. ", "Cannot write. ")) +
        (cu === 0 && !chowned ? K.t("이미지가 root로 돌면 내 폴더에 그대로 쓴다.", "An image running as root writes to my folder directly.")
          : cu === 0 ? K.t("컨테이너 root는 폴더를 chown 한 쪽이라 하위 범위 번호의 파일도 다룬다.", "Container root did the chown, so it can handle files owned by ids in its range.")
          : cu === 1000 && chowned ? K.t("폴더를 그 사용자 소유로 바꿔 주면 비루트 이미지도 쓴다. 도커 볼륨을 쓰는 방법도 있다.", "Hand the folder to that user and a non-root image can write; a Docker volume also works.")
          : cu !== 0 && !chowned ? K.t("비루트 사용자는 호스트에서 다른 번호라 내 폴더에 쓰지 못한다.", "A non-root user is a different number on the host, so it cannot write to my folder.")
          : K.t("폴더 소유자와 번호가 다르다.", "The number does not match the folder's owner."));
    }
    b0.addEventListener("click", function () { cu = 0; sl.set(0); render(); });
    b1000.addEventListener("click", function () { cu = 1000; sl.set(1000); render(); });
    bCh.addEventListener("click", function () { chowned = !chowned; K.press(bCh, chowned); render(); });
    render();
  });
})();
