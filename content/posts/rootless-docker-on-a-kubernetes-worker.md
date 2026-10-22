---
title: "쿠버네티스 워커 노드에서 도커가 필요할 때 — 루트리스 도커와 GPU"
date: 2026-10-22
draft: false
tags: ["도커", "루트리스", "쿠버네티스", "GPU", "containerd", "AppArmor", "납품"]
categories: ["시스템"]
summary: "납품용 GPU 이미지를 고객과 같은 방식으로 설치해 보려 했는데, 쓸 수 있는 GPU 서버가 쿠버네티스 워커 노드였다. 시스템 도커를 깔면 노드의 containerd와 네트워크 규칙을 건드린다. 사용자 계정 안에서만 도는 루트리스 도커로 구성하고, GPU는 노드의 공용 설정을 고치지 않고 사본 설정으로 붙였다."
---

## 시험할 서버가 워커 노드였다

[폐쇄망 납품 묶음](/posts/shipping-models-to-air-gapped-servers/)은 도커 이미지, 모델 묶음, 설치 스크립트로 되어 있다. 받는 쪽에서는 `docker` 와 `docker compose` 로 설치한다. 이걸 고객과 같은 방식으로 직접 설치해 보려면 도커가 있어야 했고, GPU 이미지라 GPU 서버도 필요했다.

쓸 수 있는 GPU 서버는 쿠버네티스 클러스터의 워커 노드였다. kubelet, kube-proxy, Calico가 돌고 있었고, 컨테이너 런타임 containerd는 패키지가 아니라 `/usr/local/bin` 에 직접 설치한 2.x였다. 다른 사람의 GPU 파드도 이 노드에서 돈다.

## 시스템 도커를 깔지 않은 이유

`docker.io` 나 `docker-ce` 패키지를 깔면 두 군데가 노드에 닿는다.

- 도커 패키지는 containerd 패키지를 같이 설치한다. 노드에는 kubelet이 쓰는 containerd가 이미 따로 있다. 바이너리와 서비스가 둘이 되면 어느 쪽이 뜨는지, 업그레이드가 어느 쪽을 덮는지부터 따져야 한다.
- 도커 데몬은 시작할 때 iptables에 자기 체인을 만들고, 포워딩을 켜면서 FORWARD 체인의 기본 정책을 DROP으로 바꾼다. 도커 문서에 적힌 동작이다. 파드 사이 통신은 Calico와 kube-proxy가 만든 규칙 위에서 도는데, 여기에 도커 규칙이 끼어들면 노드의 파드 네트워크가 영향을 받을 수 있다.

시험 한 번을 위해 공유 노드의 런타임과 네트워크를 건드릴 수는 없었다. 그래서 사용자 계정 안에서만 도는 루트리스 도커를 골랐다.

## 루트리스 도커의 구성

루트리스 모드에서는 도커 데몬이 일반 사용자 권한으로 돈다. rootlesskit이 사용자 네임스페이스를 만들고 그 안에서 데몬과 컨테이너를 띄운다. 컨테이너 안의 root는 호스트에서 그 사용자 계정이다. 네트워크는 slirp4netns 같은 사용자 공간 스택으로 처리해서 호스트의 iptables를 고치지 않는다.

루트 권한이 필요한 일은 네 가지였다. 비밀번호가 필요한 단계라 명령을 정리해 두고 권한이 있는 사람이 직접 실행했다.

1. `uidmap`(newuidmap·newgidmap)과 `slirp4netns` 설치
2. `/etc/subuid`·`/etc/subgid` 에 그 사용자의 하위 uid 범위(65,536개)가 있는지 확인
3. AppArmor 프로필 추가 (다음 절)
4. `loginctl enable-linger <사용자>` 로 로그아웃한 뒤에도 사용자 서비스가 살아 있게 하기

나머지는 사용자 권한으로 했다. 도커 정적 빌드와 rootless extras를 `~/bin` 에 풀고, 함께 들어 있는 `dockerd-rootless-setuptool.sh` 로 사용자 systemd 서비스를 만들었다. compose는 CLI 플러그인으로 `~/.docker/cli-plugins/` 에 넣었다.

```
~/bin/                          docker, dockerd, rootlesskit, dockerd-rootless.sh …
~/.config/systemd/user/docker.service
/run/user/<uid>/docker.sock     CLI context "rootless" 가 가리키는 소켓
~/.local/share/docker/          이미지·컨테이너 저장소
```

데몬은 `systemctl --user status docker` 로 보고, CLI는 `docker context use rootless` 로 이쪽에 붙인다. `docker info` 의 Security Options에 `rootless` 가 보이면 제대로 붙은 것이다.

## Ubuntu 24.04의 AppArmor

Ubuntu 23.10부터는 권한 없는 사용자가 사용자 네임스페이스를 만드는 것을 AppArmor가 막는다(`kernel.apparmor_restrict_unprivileged_userns = 1`). rootlesskit은 사용자 네임스페이스가 있어야 돈다. 배포판에도 `rootlesskit` 프로필이 들어 있지만 `/usr/bin/rootlesskit` 경로에만 걸려 있다. 정적 빌드를 `~/bin` 에 두었으니 그 경로용 프로필을 따로 만들었다.

```
# /etc/apparmor.d/home.<사용자>.bin.rootlesskit
abi <abi/4.0>,
include <tunables/global>

/home/<사용자>/bin/rootlesskit flags=(unconfined) {
  userns,
  include if exists <local/home.<사용자>.bin.rootlesskit>
}
```

파일 이름은 실행 파일 경로의 `/` 를 `.` 으로 바꾼 것이다. 파일을 넣은 뒤 AppArmor를 다시 읽혀야(`systemctl restart apparmor`) 적용된다.

## GPU는 공용 설정을 건드리지 않고

루트리스 컨테이너에서 GPU를 쓰려면 NVIDIA Container Toolkit 설정에 `no-cgroups = true` 가 있어야 한다. 루트리스 데몬은 장치 cgroup을 다룰 수 없기 때문이다. 안내 문서는 `/etc/nvidia-container-runtime/config.toml` 을 고치라고 한다.

그 파일은 노드에 하나뿐이고, 쿠버네티스 GPU 파드도 같은 툴킷과 같은 파일을 쓴다. 여기를 바꾸면 그 설정이 노드의 GPU 파드에도 같이 적용된다. 내 시험 때문에 남의 파드가 도는 방식을 바꿀 수는 없었다.

툴킷은 `XDG_CONFIG_HOME` 이 설정돼 있으면 `/etc` 대신 `$XDG_CONFIG_HOME/nvidia-container-runtime/config.toml` 을 읽는다. 그래서 공용 파일은 그대로 두고 사본을 `~/.config/nvidia-container-runtime/` 에 만들었다. 사본에서 바꾼 줄은 하나다.

```diff
- #no-cgroups = false
+ no-cgroups = true
```

그리고 도커 데몬에만 `XDG_CONFIG_HOME` 을 주는 systemd 덮어쓰기 파일을 넣었다.

```ini
# ~/.config/systemd/user/docker.service.d/10-nvidia-user-config.conf
[Service]
Environment=XDG_CONFIG_HOME=%h/.config
```

이 데몬이 띄우는 컨테이너만 사본을 읽고, 쿠버네티스 쪽은 계속 공용 파일을 읽는다. `docker run --gpus all` 과 compose의 GPU 예약(`deploy.resources.reservations.devices`, `driver: nvidia`)이 둘 다 동작했다.

## 루트리스에서 달라지는 것

- 컨테이너 root는 호스트의 내 계정이다. 이미지가 root로 돌면 바인드 마운트한 내 폴더에 그대로 쓴다. 반대로 이미지가 비루트 사용자(예: uid 1000)로 돌면, 그 사용자는 호스트에서 하위 uid 범위의 다른 번호가 되어 내 폴더에 쓰지 못한다. 쓰기 폴더를 컨테이너 root로 그 사용자 소유로 바꿔 주거나(`chown 1000:1000`), 바인드 마운트 대신 도커 볼륨을 쓴다.
- 1024 아래 포트는 그대로는 열지 못한다. `net.ipv4.ip_unprivileged_port_start` 를 낮추거나 높은 포트를 쓴다.
- 이미지 저장소가 홈 아래(`~/.local/share/docker`)라 로컬 디스크에 쌓인다. 이 글을 쓰는 날 이 서버의 루트 디스크는 93%가 차 있었다. 이미지 수 GB와 모델 묶음 십수 GB를 풀면 같은 디스크를 쓰는 다른 작업까지 영향을 받는다. 시험용 폴더와 이미지는 끝나면 지울 대상으로 적어 두었다. 저장소 위치(`data-root`)를 다른 로컬 디스크로 옮길 수는 있지만, 네트워크 드라이브(CIFS)는 overlay 저장소로 쓸 수 없다.
- linger가 꺼져 있으면 로그아웃할 때 사용자 서비스가 같이 내려간다.

## 받는 쪽 입장에서 설치 스크립트를 읽으며 본 것

설치를 돌리기 전에 스크립트를 먼저 읽었다. 고객 서버에서 그대로 걸릴 만한 기본값이 몇 가지 있었다.

- 기본 설치 경로가 스크립트 옆 폴더였다. 공유 폴더에 있는 납품 원본에서 바로 실행하면 원본 폴더 안에 풀린다. 원본은 바꾸지 않는 폴더라 로컬로 복사하고 체크섬을 대조한 뒤 거기서 실행하기로 했다.
- 외부 캐시 서버(Redis) 주소는 형식만 검사하고 접속은 해 보지 않는다. `localhost` 는 컨테이너 자신이라 막아 둔 것은 맞지만, 주소가 틀려도 설치는 통과하고 실패는 서비스가 뜬 뒤에야 보인다.
- 선택 기능 하나가 기본으로 켜져 있어서, 그대로 엔터를 누르면 그 기능의 API 키를 요구한다. 그 기능을 쓰지 않는 고객은 여기서 멈춘다.
- 모델 암호화 키를 넣는 단계는 터미널(TTY)이 있어야 돈다. 비대화형으로 돌리면 경고만 남기고 건너뛴다. 받는 쪽 시험은 실제 터미널에서 해야 이 단계까지 확인된다.

## 메모

- 공유 노드에 도커가 필요하면 시스템 도커 대신 루트리스 도커를 쓴다. 노드의 containerd와 iptables를 건드리지 않는다.
- Ubuntu 23.10 이후에서는 rootlesskit 경로용 AppArmor 프로필이 필요하다. 배포판 프로필은 `/usr/bin` 경로에만 걸려 있다.
- GPU용 `no-cgroups = true` 는 공용 설정이 아니라 사본에 두고, 도커 데몬에만 `XDG_CONFIG_HOME` 으로 그 사본을 가리키게 한다.
- 컨테이너 root는 호스트의 내 계정이다. 비루트 이미지의 바인드 마운트 쓰기, 낮은 포트, 홈 아래 이미지 저장소를 먼저 확인한다.
- 받는 쪽 시험은 원본을 복사한 위치에서, 실제 터미널로 한다.

### 참고 문헌

- Docker. _Rootless mode._ Docker Docs. (사용자 네임스페이스로 데몬을 일반 사용자 권한에서 띄우는 방법, 설치 도구, Ubuntu AppArmor 프로필, 낮은 포트 제한)
- Docker. _Packet filtering and firewalls._ Docker Docs. (도커 데몬이 만드는 iptables 체인과 FORWARD 정책 변경)
- NVIDIA. _NVIDIA Container Toolkit — Rootless mode._ (루트리스 도커에서 `no-cgroups = true` 가 필요한 이유와 설정)
- Ubuntu. _Ubuntu 23.10 release notes — Unprivileged user namespace restrictions._ (권한 없는 사용자 네임스페이스를 AppArmor 프로필로만 허용하는 변경)
