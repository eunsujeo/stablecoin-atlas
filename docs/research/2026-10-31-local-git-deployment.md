# Mac mini 소스 기반 자동 배포 전환

## 요청과 확인

원래 작업은 Bootstrap database:web의 module 접근 실패 해결이었다. 사용자 승인된 Herdr SSH 공유 연결/root 패널에서 운영 상태를 확인했고 26734be로 umask077의 module directory/probe parent 권한 오류를 수정·전체855pass/0fail/8skip 후 push했다. 이 시점까지 실제 Bootstrap 교체와 서비스 재시작은 하지 않았다. 이후 사용자가 GitHub은 형상관리만 사용하고 `Mac mini에서 테스트·빌드·자동 배포`를 명시 선택했다. GitHub CI 대기/아티팩트 경로 대신 ADR0125로 변경한다.

운영 Node24.18/npm11.16·Linux aarch64·systemd-run/git/flock·atlasbuild UID978/단일atlasbuild group/nologin·private npm cache를 확인했다. CPU8개·메모리약7.5GiB·disk가용156GiB다. GCC/make 미설치는 관측했지만 서버 production gate에는 필요하지 않아 설치하지 않는다. 실행 전 외부 다운로드 목록을 알렸다: 고정 GitHub 소스와 lockfile의 npm tarball136항목(플랫폼 선택 포함). npm cache0이며 별도 compiler profile/Foundry/JDK/OS tool 다운로드는 하지 않는다. npm lifecycle/자동 compiler 준비0이다.

## 구현과 검토

source LOCAL_GIT일 때 API/token/Actions 결과를 사용하지 않는 source adapter와 고정 worker를 추가했다. prepare/test/production/pack을 비특권 transient service로 실행하고 test/pack은 외부 네트워크를 차단한다. CPU/Memory/time·고정 원본/lock integrity·source SHA·정규 tar/manifest/ABI·root snapshot을 검증한다. CI와 다른 LOCAL manifest를 사용한다. 같은 SHA/policy 실패를 자동 재시도하지 않고 완성 cache만 재사용한다. 기존 controller의 pointer/health/rollback/crash journal을 유지한다. 자동 GitHub workflow trigger는 제거하고 기존 recipe는 수동 보존한다.

초기 root cache 부모를 builder 소유 cache 아래에 두려던 설계는 부모가 항목을 교체할 수 있어 `/opt/stablecoin-atlas/builds`의 root 부모로 수정했다. 새 시험은 Git assume-unchanged로 숨긴 변경을 기존 index read-tree만으로는 거부하지 못하는 실패를 발견했다. 별도 private index와 no-replace/fsck/no-ext-diff/no-textconv로 수정하고 거부 및 정상 pack을 확인했다. npm 설정의 user/global을 모두 /dev/null로 지정하면 double-loading 오류임을 다운로드 없는 config 조회로 발견해, 새 빈 user config와 기존 OS global CA/proxy 설정을 사용하도록 수정했다. strict TLS 검증과 명시 registry는 유지한다. 테스트 실패를 source 부재로 표시하거나 검사 조건을 완화하지 않았다.

## 시험

local source 전용9개는 config의 CI/token 불필요·web-only·고정sandbox/네트워크/자원·lock origin/integrity 거부·monotonic candidate·manifest kind/attestation/SHA/ABI/손상·완성/손상/부분cache·no-follow/foreign/writable/size·실패commit 무재시도/무재시작·Git index 우회 거부/정상pack을 확인한다. 기존 deployment 포함 targeted87pass/0fail/0skip 및 전체check798개중790pass/0fail/8skip+보관74pass/0fail=864pass/0fail/8skip을 확인했다. compiler 캐시 미보유8skip은 유지하며 새compiler를 다운로드하지 않았다. 이후 LOCAL_GIT에서 사용하지 않는 GitHub 파일을 gate에서 제외한 최종 변경까지 npm run check를 다시 실행했다. 실제 서버 build/install/verify는 완료 후 아래에 추가한다.

재현: source .state/dev-env.sh; node --use-env-proxy --test tests/deploy-local-source.test.mjs; npm run check. 비공개 로그 .state/agent-logs/local-git-unit.log, local-git-targeted.log, local-git-check-push.log. 기존 unrelated 새PC 문서2개와 비공개 파일은 보존한다. 하위 Agent·새 API key·공급자 API/RPC·DB schema/secret 변경0이다.

## 운영 경계

이 문서의 구현은 enable 완료를 뜻하지 않는다. 자동 deploy enable과 실제 push 기반 웹 전환은 사용자 승인 직전에 중단한다. 기존 web/Collector PID·FX timer·release pointers·secret hash/mode/owner는 private baseline과 비교한다. 기존 CI release/marker/cache·control plane backup은 삭제하지 않는다. GitHub은 소스 형상관리만 사용한다. 실제 서버 결과와 남은 승인 단계는 후속 기록으로 구분한다.

## 첫 서버 계획과 Git 조회 수정

1d7357d6bcb2dda1fda765e1718de56a76864a79를 push한 뒤 root 보호 checkout/새LOCAL 계획을 생성했다. plan의 reader/web/CA·unit/effective path·설치 경로는 모두READY였다. install은 LOCAL_SOURCE_UNAVAILABLE로265ms에 중단됐다. 빌드 claim/worker·제어면 교체·서비스 전환은 시작되지 않았다.

원인은 sudo 관리자 셸 cwd=/root를 비특권 Git이 상속한 접근 거부(exit128)였다. 고정 /var/cache/atlas-build cwd를 지정하니 같은 서버에서 BUILDER_MAIN_LOOKUP_READY를 확인했다. localMainCommand를 분리하고 builder cwd·고정 원본/ref·proxy/CA만 전달·SSH agent/token/TLS-disable 환경 미전달의 회귀 시험을 추가했다. 진단 helper의 regex escape 오류는 plain string 분류로 고쳤고 비밀 stderr를 출력하지 않았다. 최종 local전용10pass/0fail 및 npm run check799개중791pass/0fail/8skip+보관74pass/0fail=865pass/0fail/8skip, 종료0을 확인한 뒤 수정 commit으로 이어간다. 첫 checkout/config/실패 출력과 기존 설치본은 보존한다.

9b1c6222df5cc7a9345e27086d1171379d218952의 plan도READY였고 main 조회는 통과했다. install은 빌드 명령 생성 전 LOCAL_BUILD_COMMAND로718ms에 종료됐다. fileURLToPath의 directory URL 끝 slash가 canonical path guard와 충돌한 원인을 확인하고 source client에서 resolve로 정규화했다. 실제 bootstrap의 trailing-slash 입력으로 sandbox command까지 만드는 회귀를 추가해10pass/0fail을 확인했다. 이 시도는 claim과 빈 job/npm cache 디렉터리를 만든 뒤 중단됐고 worker unit/다운로드·제어면 교체·운영 서비스 변경0이다. 소비 claim/job/checkout/config는 보존하며 재사용/삭제하지 않는다.

경로 정규화 수정 후 전체check도865pass/0fail/8skip·종료0이다. 실제 서버에서 동일한 User/PrivateNetwork/ProtectSystem/NoNewPrivileges/자원 제한의 별도 sandbox self-check를 실행해 uid978/Node24.18/rc0을 확인했다. source worker나 운영 서비스를 실행한 것으로 계산하지 않는다.
