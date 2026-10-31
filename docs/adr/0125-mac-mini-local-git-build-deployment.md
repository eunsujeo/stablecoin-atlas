# ADR0125: Mac mini에서 main 소스 테스트·빌드·자동 배포

- 상태: 사용자 선택에 따른 구현. 실제 enable은 별도 승인 전 실행하지 않는다.
- 날짜: 2026-10-31

사용자는 GitHub을 형상관리만 사용하고 Mac mini가 테스트·빌드·자동 배포하는 방식을 선택했다. GitHub Actions ZIP 취득·CI 상태·App token/결과 보고에 의존하는 기존 제어면을 `source: LOCAL_GIT`으로 전환한다. 이전 CI 경로는 보존된 코드·시험용이며 자동 workflow trigger는 제거한다. 기존 secret 파일은 삭제하거나 바꾸지 않는다.

## 결정

고정 GitHub HTTPS repository의 `refs/heads/main`만 `atlasbuild`로 조회한다. root 보호 candidate ID는 이전 CI ID보다 단조 증가하고 SHA/고정 빌드 정책 hash에 묶인다. branch 이동 후에도 취득한 정확 SHA로만 빌드한다. GitHub API·Actions·App token·status endpoint를 사용하지 않고 상태는 로컬 private journal/report에 기록한다. LOCAL_GIT은 web만 허용하며 Collector/Usage 활성화는 거부한다.

고정 root 소유 worker가 systemd transient unit의 atlasbuild UID로 네 단계를 실행한다. 소스의 npm lifecycle은 실행하지 않는다. prepare는 고정 Git 원본의 정확 SHA shallow fetch와 lockfile npm ci, test는 TypeScript build·Node24 deployment/production/web 회귀, production은 omit-dev npm ci, pack은 root 고정 packer와 모든 운영 진입점 import smoke다. 테스트와 pack의 PrivateNetwork로 외부 DB/공급자 접근을 차단하고 loopback Fixture만 허용한다. 로컬 MacBook의 전체 검사와 이 운영 gate의 범위를 구분한다. Node25 보관 시험·Anvil/TVM/PG17 실행을 서버 gate에 포함했다고 표시하지 않는다.

build unit은 ProtectSystem=strict/ProtectHome/PrivateTmp/NoNewPrivileges/빈 capability/전체 cgroup 종료, CPU200%·Memory2GiB·Tasks128을 사용한다. prepare600초/test480초/production300초/pack120초 한도다. root 보호 `/opt/stablecoin-atlas/builds`의 각 UUID job과 기존 atlasbuild npm cache만 쓰기 가능하다. 기존 broker unit의 ReadWritePaths 범위로 root job을 관리하고 기존 서비스 unit을 덮어쓰지 않는다. 운영 사용자·비밀 파일·SSH key·서비스 제어 권한을 builder에 주지 않는다. atlasbuild의 비특권 UID·단일 group·nologin·private cache를 확인하고 임의 계정 수정은 하지 않는다.

npm은 잠금 integrity를 갖는 registry.npmjs.org HTTPS tarball만 허용한다. file/Git/link/다른 host/인증 URL·프로젝트 npmrc를 거부하고 ignore-scripts·fetch-retries0/요청120초·검증 cache 우선·명시 registry·새 빈 user config·기존 OS global CA/proxy config를 사용한다. 관리형 proxy/TLS는 기존 EnvironmentFile/환경과 시스템 신뢰를 유지한다. 새 compiler profile/Foundry/JDK/OS compiler 다운로드는 하지 않는다. 잠금 파일의 기존 npm solc 패키지는 취득될 수 있지만 compiler prepare나 실제 토큰 분석을 실행하지 않는다.

테스트 후 기존 Git index를 신뢰하지 않는다. 별도 private index·원래 HEAD·no-replace·no-external-diff/no-textconv·fsck로 tracked source를 확인하고 원래 index는 변경하지 않는다. tar의 파일 hash·policy·크기192MiB·ARM64/native ABI·안전 경로/regular file 검증은 유지한다. root 고정 단계가 모두 성공하고 unit의 모든 자식이 종료된 뒤 bounded/no-follow FD로 결과를 읽어 root private cache에 저장한다. `ATLAS_LOCAL_RELEASE`와 localBuild policy hash/tested/repository attestation을 사용하며 CI 결과로 가장하지 않는다. CI validator는 이를 기본 허용하지 않는다.

SHA/policy별 불변 claim을 빌드 전에 소비한다. 실패·중단·부분 cache·손상은 동일 SHA 자동 재빌드하지 않고 차단하며 원문/claim/job을 보존한다. 검증된 완성 cache만 재사용한다. 서비스 재시작 전 실패는 기존 pointer/PID를 유지한다. 이후 배포·health·실패 rollback·crash recovery는 기존 journal과 root 고정 controller를 사용한다. 이전 CI release/marker·backup/control plane을 채택하거나 삭제하지 않는다.

## 적용과 승인

최초 migration은 검토한 정확 SHA의 root 소유, builder가 읽을 수 있는 `/opt/stablecoin-atlas/bootstrap-<sha>` checkout에서 수행한다. 기존 disabled config를 새 private 파일로 복사해 source/ bootstrapSha만 바꾸고 plan→install→verify한다. 기존 root receipt가 있으면 먼저 검증하고 WAL/backup/receipt-last 교체를 유지한다. 모듈 디렉터리0755·probe parent0711 수정도 포함한다. 실제 enable/웹 자동 전환 및 push 종단 시험은 verify READY 후 사용자 승인으로만 진행한다. Collector/FX 서비스·DB schema/secret·proxy/TLS는 변경하지 않는다.

한계: 소스/lock package 취득 단계만 외부 네트워크가 필요하다. 별도 root 고정 worker와 user sandbox를 사용해도 허용 main 소스의 테스트 자체가 완전성을 증명하는 것은 아니다. 저장소 main 권한과 운영 OS를 신뢰하며 악성 maintainer의 소스를 안전한 프로그램으로 인증하지 않는다. job/cache/claim은 자동 삭제하지 않으며 disk gate로 공간 부족 시 배포를 차단한다.


Fedora broker의 실제 제한 환경에서는 모듈 로드 후 CAP_SETUID가 없는 상태가 관측되어 직접 UID 전환을 사용하지 않는다. PID 1이 고정 User/Group으로 시작하는 transient service를 소스 조회와 DB 읽기 probe에도 사용한다. broker의 capability/NoNewPrivileges 제한은 유지하며, 자식은 capability가 없고 시간·자원 및 파일 접근이 제한된다. 자세한 재현과 실패 이력은 2026-10-31 연구 기록을 따른다.
