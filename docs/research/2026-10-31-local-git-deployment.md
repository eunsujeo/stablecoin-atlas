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

## a93b471 실제 서버 gate와 restrictive umask

a93b471490b9320201f4d2875a8c5c918a5cfd9c는 prepare6382ms를 완료하고 test9795ms에 LOCAL_BUILD_TEST_FAILED로 중단됐다. root phase log는 성공한 tsc 출력 뒤 자식 시험 stdout이 유실돼 generic code만 남았다. worker는 실패 stdout/stderr/code를 root private phase log로만 전달하도록 보완했다. CLI/Git/web에는 원문을 게시하지 않는다.

동일한 umask077 gate를 로컬에서 재현해 fixture의 명시0755/0640이700/600으로 걸러지는 문제를 확인했다. 기존 metadata 보존 시험과 drift 시험의 입력이 의도와 달랐다. fixture helper/unit 두 파일만 chmod로 정확한 의도 mode를 만들고 private prefix0700은 유지했다. 실제 배포 umask·권한 검사/회귀 assertion을 느슨하게 하지 않았다. 같은 builder gate(tsx 포함)252pass/0fail/0skip을 확인했고, child umask077 fixture metadata 회귀도 추가했다.

추가 진단의 TTY/FD 전달 경로에서 transient start 오류/지연을 만났고 이번 진단 Node caller만 Ctrl-C로 종료했다. root manager query와 명시 system bus 조회는 rc0/대기job0을 확인했으며 어떤 OS service도 restart/reload하지 않았다. build unit 메모리peak476.9MiB·kernel OOM기록0, 웹PID45865/CollectorPID33973·FX active를 재확인했다. 기존 claims/jobs/checkout/로그는 보존했다. 실제 시험 실패는 위 로컬재현과 다음 새 SHA의 gate로 확인하며 이전 claim을 재시도하지 않는다.

fixture 수정 후 최종 전체check800개중792pass/0fail/8skip+보관74pass/0fail=866pass/0fail/8skip·종료0이다. restrictive umask gate252pass/0fail/0skip도 함께 확인했다.

314157867016d88571964172dbcabb8e337472d6의 prepare5659ms·test10143ms 후 실패를 새 private log에서 확인했다. 깨끗한 source checkout에 .state가 없어 artifact-cache 시험4개의 mkdtemp가 ENOENT였다. 시험 fixture 자체에서 private 부모를 준비하고 fresh checkout·기존 sentinel 보존 회귀를 추가했다. 중첩 Node test subprocess는 NODE_TEST_CONTEXT를 제거하고 pass1을 확인해 실제 실행 없는 false positive도 차단했다. 실제 캐시 모듈의 missing-parent 처리/소유·mode·digest 검사는 변경하지 않았다. restrictive umask077 gate253pass/0fail/0skip 후 전체check를 실행한다. 이전 실패 claim·소스·로그·운영 상태는 보존한다.

전체검사와 별도로 이전 실패 job에서 pack-only 오프라인 진단을1322ms/rc0으로 확인했다. 진단 결과는 builder 소유 raw output일 뿐 localBuild root attestation/완성rootcache/stage/current를 게시하지 않았다. 실패claim을 다시 소비하거나 정상 시험으로 승격하지 않았고 새 SHA의 실제 pipeline은 모든 gate를 다시 실행한다.

clean-checkout fixture 수정 최종 npm run check는801개중793pass/0fail/8skip+보관74pass/0fail=867pass/0fail/8skip·종료0이다.

## 첫 LOCAL 설치 성공과 SQL 검증 자산 보완

4b2593168a3fa3ff28164dad1c65fe8b7e49238c는 실제 prepare5587ms/test10242ms/production5561ms/pack1287ms, 총25360ms/rc0으로 INSTALLED_DISABLED가 됐다. verify는 control-plane/파일/unit/pointer/rollback-baseline READY이나 database:web의 DEPLOY_PROBE_FAILED였다. 동일 atlasweb UID의 새 private 임시 reader copy로 read-only 진단해 ENOENT/OPEN과 schema.mjs→preview.mjs frame만 출력했고 secret/SQL/원래 error는 출력하지 않았다. temp copy는 finally로 제거했다.

원인은 runtimeSource가 db/market/001-initial.sql 등 schema hash 검증용 원본을 빠뜨린 것이다. root DB 연결과 reader 역할 검사 이후 이 파일을 읽다가 실패했다. db 하위 SQL만 runtime에 포함하고21개 기존 schema 원본의 비어 있지 않은 존재를 offline smoke에서 검증한다. 각1개를 빼는21거부 사례를 추가했다. DDL을 실행하거나 DB schema/role·secret·원 시각/자료를 바꾸지 않는다. SQL code는 검증용 read asset이며 migration CLI를 호출하지 않는다. targeted18pass/0fail/0skip 후 전체check·새SHA 설치/verify로 이어간다. 기존CI/cache/실패claim/previous CP를 보존한다.

SQL 자산 보완 최종 npm run check도867pass/0fail/8skip·종료0이다.

## 준비 완료: 사용자 enable 승인 직전

266faa90c68b760a4c51177eb267d5f8c39faac3를 main에 push하고 실제 Mac mini의 전체 pipeline을 다시 수행했다. test253pass/0fail/0skip·production5516ms·pack1243ms, install총25475ms/rc0·INSTALLED_DISABLED다. verify는9505ms/rc0·READY, database:web을 포함한 모든check READY/providerRequests0이다. schema SQL 자산을 포함한 새 제어면을 설치했으며 migration/grant/import나 비밀 파일 변경은 하지 않았다.

private baseline 대조: protected11파일 hash/UID/GID/mode 변화0·4pointer 변화0·운영 서비스 상태/시작시각 변화0. 웹PID45865/CollectorPID33973 유지·FX active·agent timer inactive·config.enabled=false·source LOCAL_GIT을 확인했다. 기존 CI/cache/백업/실패claim과 job을 모두 보존했다. 실제 운영 웹은 기존 ad2312756d4bbb913543130c42295e064960a82c를 계속 서비스한다. 자동 배포 시작과 웹 전환은 하지 않았다.

다음은 사용자 승인 후에만 atlas-deploy-admin enable을 실행하고 최초 웹 자동 전환/health를 확인하는 단계다. 이후 이 완료 기록/인계문을 별도 git commit/push해 실제 main 감지→비특권test/build→stage→웹전환/health→durable local report를 종단 검증한다. 이 문서의 마지막 결과는 승인 요청 시 로컬에 보존하고 종단 검증 push에 포함한다. GitHub Actions/API status는 사용하지 않는다. DB schema/secret·Collector/FX·Cloudflare/proxy/TLS·기존 release/backup은 그대로 유지한다.

## enable 승인 후 첫 트리거 권한 보완

사용자가 READY 보고 후 진행을 명시 승인했다. enable9314ms/rc0·AUTOMATION_ENABLED까지 완료했지만 atlaspull agent가 interactive authentication 필요로 broker 시작을 거부당했다. 웹45865/Collector33973·현재ad231는 그대로였고 apply/transaction은 시작되지 않았다. 원인은 deployment-owned public polkit rule root:root0600이었다. /etc/polkit-1/rules.d는root:polkitd0750이지만 file0600은polkitd가읽을수없다. 이전umask 생성과 metadata보존이잘못된mode를유지했다.

이번새배포timer만일시stop하고기존운영서비스는유지했다. 고정50-atlas-deploy.rules 경로의root/nlink1/non-symlink·최대64KiB·receipt와검토source의양쪽hash를확인한정확0600만0644로atomic same-content교체한다. owner/group/내용은유지하며새tmp에만metadata를설정한다. 다른mode/owner/hash/links는거부한다. 파일watcher로polkit이재적재하게하며daemon restart·sudoers·secret 권한변경은하지않는다. mode보정은WAL commit후별도명시public-file migration이며backup/기존metadata이력은보존한다.

bootstrap install후보정과verify/enable의trigger-policy검사를추가해앞으로권한이잘못된상태를READY로표시하지않는다. 현재고정제어면266faa9는그대로검증하고,검토한새checkout의root-only repair CLI로public rule만수정한뒤기존timer를재개한다. 수정CLI는임의경로/인자를받지않는다. 별도CLI와순수library로분리해module await cycle도예방했다. 4회귀시험은atomic mode repair·내용/소유권보존·idempotency·wrong hash/owner/mode/link거부·CLI인자거부를검증한다. code검사후push/실서버수정/자동종단시험으로이어간다.

trigger 보완 전체 npm run check rc0: 870pass/0fail/8skip(주suite796pass+보존suite74pass). 이후 추가한CLI인자거부를포함한trigger전용4pass/0fail도확인했다.
