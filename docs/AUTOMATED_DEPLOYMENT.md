# Stablecoin Atlas 서버 빌드 자동 배포

2026-10-31 사용자 선택: **GitHub은 형상관리만 사용하고 Mac mini에서 테스트·빌드·자동 배포한다.** 현재 방식은 [ADR0125](adr/0125-mac-mini-local-git-build-deployment.md)의 `source: LOCAL_GIT`이다. [구현·운영 검증 기록](research/2026-10-31-local-git-deployment.md)을 따른다. 아래 GitHub Actions 방식은 이전 이력이며 자동 workflow trigger는 제거했다. App/token/Actions/reporting variable을 LOCAL_GIT의 배포 조건으로 요구하지 않는다. 기존 비밀 파일과 CI 릴리스/backup은 보존한다.

Mac mini는 고정 원본의 main SHA를 확인하고 atlasbuild로 소스·잠금 의존성을 취득한다. TypeScript build·Node24 웹/배포 회귀·운영 import smoke를 통과한 LOCAL manifest 산출물을 root private cache에 저장한 뒤 기존 health/rollback controller로 배포한다. DB schema hash 검증에 필요한 `db/**/*.sql` 원본도 runtime에 포함하고21개 필수 자산을 오프라인으로 확인한다. 파일을 읽는 것이며 DDL/migration을 실행하지 않는다. 테스트/pack은 외부 네트워크 차단, npm lifecycle 금지, CPU200%·Memory2GiB·단계별 시간 제한을 유지한다. root는 저장소 빌드 코드를 직접 실행하지 않는다. LOCAL_GIT은 web만 허용하고 Collector/Usage 자동 전환은 거부한다.

최초 전환은 검토한 정확 SHA의 root 소유 `/opt/stablecoin-atlas/bootstrap-<sha>` checkout에서 한다. 기존 disabled 설정을 새 root0600 파일로 보존 복사해 `source: LOCAL_GIT`과 `bootstrapSha`만 바꾸고 plan→install→verify한다. 기존 reader·CA·writer·policy/secret hash는 그대로 유지한다. enable 직전 사용자 승인을 받고, 승인 후에만 timer 시작 및 웹 전환/실제 push 종단 검증을 진행한다. 실패·부분 cache·미확인 상태는 자동 claim 삭제/반복/강제 채택으로 우회하지 않는다.

## 이전 GitHub Actions 방식과 권한 수정 기록

2026-10-31 런타임 접근 권한: Bootstrap과 broker의 `umask 077`을 유지하면서 새 staging tree의 모든 디렉터리를 명시0755, regular file을 manifest 정규화0644/0755로 전개한다. 최상위 경로만0755로 바꾸면 `atlasweb`의 모듈 import가 실패하므로 하위 `tools`·`node_modules`도 포함한다. 기존 설치본·release·backup에 재귀 chmod하지 않는다. 배포 전용 `/run/atlas-deploy-probes`는 root 소유 no-follow FD로 검사하고 이전 umask의 정확0700만0711로 보정한다. 다른 mode/owner/link는 거부하며 자식probe0700·reader0600은 유지한다. 새 CI SHA의 Bootstrap install로 제어면을 교체하고 verify한다. [운영 검증 기록](research/2026-10-31-bootstrap-runtime-permissions.md)을 따른다.

2026-10-31 Fedora 설치·재실행은 [ADR0124](adr/0124-fedora-bootstrap-install-recovery.md)를 따른다. root 소유의 정확한 `/usr/local/sbin -> bin`만 허용하고 실제 `/usr/local/bin` 파일·조상과 logical 조상의 root/non-writable을 모두 확인한다. 다른 symlink를 일반화하거나 시스템 링크/소유권/권한을 고치지 않는다. `plan`의 기존 `checks` 외 `installPaths`와 unit plan/실제 unit 경로 검사도 확인한다.

`install`은 경로/계정/기존 state를 먼저 검증하고 private `bootstrap-install.json`과 `bootstrap-backups/UUID`로 원래 파일·제어면을 보존한다. 파일 UID/GID/mode는 유지하고 새 임시 파일의 atomic rename으로 내용만 갱신하며 마지막에 receipt를 게시한다. 실패/프로세스 종료 후 명시 install 재실행은 commit marker를 확인해 복구하거나 이미 끝난 commit으로 닫는다. 외부 편집·손상·불명확 상태는 `BOOTSTRAP_RECOVERY_BLOCKED`로 남기며 강제 덮어쓰지 않는다. 저널이 pending이면 verify/apply/enable은 차단된다. 기존 CI release/ATLAS_RELEASE/cache/previous tree를 삭제하거나 임의로 receipt를 작성하지 않는다. 서비스 start/stop/restart와 포인터 변경은 install에 없고, missing usage-current 초기 생성도 명시 enable에서만 수행한다. Collector state directory는 이미 올바른 owner/private 조건으로 준비돼 있어야 하며 install에서 생성/chown하지 않는다. [로컬 검증·운영 재실행 경계](research/2026-10-31-fedora-bootstrap-install-recovery.md).

2026-10-31 런타임 번들·완성 ZIP 캐시는 [ADR0123](adr/0123-runtime-artifact-and-verified-cache.md)를 따른다. CI는 운영 자산과 pg의 lock 고정 의존성만 묶고 선택 패키지의 native 파일을 보존하며 압축9/추출본 진입점 import 검사를 수행한다. 개발용 CLI/연구·문서·시험 파일은 이 운영 bundle의 실행 범위가 아니다. 빌드 JSON의 source/dependency/payload byte와 압축 추정을 CI summary에서 확인할 수 있다. 로컬 측정과 실제 ARM64 CI/다운로드 관측은 [검증 기록](research/2026-10-31-runtime-artifact-optimization.md)에서 구분한다.

2026-10-30 후속 [ADR0122](adr/0122-frankfurter-daily-fx.md): 새 코드의 FX preflight는 명시 Frankfurter DB reader를 사용한다. [추가 승인 조회·실제 DB/로컬 웹 반영](research/2026-10-30-frankfurter-live-completion.md)을 완료했다. 최초 운영 bootstrap/고정 제어면 설치·운영 배포·자동수집 활성화 완료를 뜻하지 않는다. 향후 만료/부재503을 무시하거나 ECB/file fallback으로 통과시키지 않는다.

정본 결정은 [ADR0120](adr/0120-pull-based-production-automation.md)이다. 이 구현은 최초 운영 bootstrap을 수행하기 전까지 서비스를 변경하지 않는다. Bootstrap 완료 후 일반 main Push는 개발 PC나 SSH 없이 테스트→ARM64 릴리스→운영 pull→웹 검증→실패 롤백으로 이어진다. 운영 서버에는 GitHub Actions runner를 설치하지 않는다.

## 평상시 작업

```sh
git push origin main
```

GitHub의 `Atlas CI release`는 GitHub-hosted `ubuntu-24.04-arm`에서 Node25.2.1·Java21·고정 Foundry/기존 hash-pinned compiler로 전체 검사한다. 보존 Allium 시험의 네트워크 권한 차단을 유지하기 위한 시험 runtime이며 실제 수집을 허용하지 않는다. 이후 Node24로 웹/배포 회귀를 별도 실행하고 production 의존성을 새로 준비·빌드한다. 운영 Node 버전은 바꾸지 않는다. 검증된 Git 추적 소스와 production node_modules를 regular-file 전용 `release.tar`로 만들고 `release.json`과 함께14일 보관한다. 환경파일·로컬 원문·모델·`.state`·reports는 포함하지 않는다. 서버는 npm/git 빌드를 하지 않는다.

운영 timer는60초 간격으로 고정 root broker의 시작만 요청한다. Broker는 고정 저장소ID·검토된 workflow ID/blob·현재 main SHA·event·CI 성공·run attempt·아티팩트 digest·manifest/payload/platform/정책을 독립 검증한다. 더 최신 main이 있으면 이전 CI는 배포하지 않고 결과 workflow에 SUPERSEDED로 표시한다. 과거 run으로의 역행과 동일 attempt 재배포를 막는다. 같은 SHA에 여러 component가 완료되면 component별 처리 이력에 따라 미처리 후보를 차례로 선택한다. 이전 확정 결과의 ACK 복구가 남았으면 새 저널로 교체하지 않는다. 같은 component의 더 최신 run/attempt가 처리되면 이전 결과 workflow는 SUPERSEDED로 표시한다.

GitHub `Atlas deployment result`와 commit status `atlas/web`에서 결과를 확인한다. 요청 SHA·현재/마지막 성공 버전·서비스 상태·실패/롤백 사유가 표시된다. run attempt별 URL로 결합하므로 이전 재실행의 성공을 새 재실행의 성공으로 오인하지 않는다. 서버 통신/자격증명 장애로 ACK를 받을 수 없으면 결과 workflow가 유한 시간 후 실패한다. 배포 시점 snapshot이며 지속 모니터링을 대신하지 않는다.

## 권한과 구성

| 구성 | 권한/책임 |
|---|---|
| GitHub-hosted CI | 저장소 read, 사설 Fixture 검사/ARM64 bundle. 운영 비밀·서버 SSH 권한 없음 |
| atlaspull service | 네트워크/비밀/코드 쓰기 권한 없음. polkit으로 `atlas-deploy-apply.service`의 start만 허용 |
| root broker | 최초 검토한 `/usr/local/lib/atlas-deploy` 고정 설치본만 실행. stage/atomic switch/systemctl·보안파일 해시 검증 |
| atlasweb | 기존 Supabase reader만, writer/provider/GitHub key 미전달 |
| atlascollector | 기존 writer·승인된 공급자·영속 원장/상태 경로 유지 |

Root broker는 릴리스 디렉터리의 JavaScript를 root로 실행하지 않는다. root 설치본·전이 import/의존성·상위 경로·unit hash가 바뀌면 차단한다. Archive는 symlink/hardlink/special/절대경로/traversal/중복을 거절하고 크기·파일 수를 제한한다. stage/activate/rollback/admin은 같은 OS flock을 사용한다. 파일·디렉터리·pointer·journal은 fsync 후 다음 단계로 넘어간다. CI bundle에 native `.node`가 있으면 Node ABI도 같아야 한다.

Node heap·systemd Memory/CPU/Tasks 한도를 두고 한 번에 배포 하나만 실행한다. CI 검사 병렬도는 기존2, 사설 PG는1이다. Cloudflare Tunnel/DNS/WAF/서비스 설정, 실제 DB schema/grant, collector 호출 주기·예산·원문·기존 데이터는 일반 웹 Push로 변경하지 않는다.

## 최초 1회: GitHub와 운영 보안 저장소 준비

운영 보안 담당자가 해당 저장소에만 설치한 GitHub App을 준비한다. 필요한 repository permissions는 **Contents read, Actions read, Commit statuses write, Variables read**뿐이다. SSH·Contents write·Actions write·Secrets write·관리자 권한을 주지 않는다. main과 workflow 변경은 저장소의 검토/보호 규칙으로 통제한다. Workflow blob 변경은 제어면 업그레이드로 재검토한다.

App private key와 다음 파일은 **운영 보안 저장소**에서 관리한다. 개발 PC의 `.state`나 개인 SSH agent를 운영 의존성으로 쓰지 않는다. GitHub App은 서버 안에서 RS256 JWT로 저장소 한정의 단기 token을 발급하며 token을 디스크/Git/로그에 저장하지 않는다. App 대신 기존 fine-grained PAT를 쓰는 경우 `github.env`에는 `GITHUB_TOKEN` 하나만 넣고 만료/교체를 보안 저장소에서 관리한다.

- `/etc/atlas-deploy/github-app.pem`: root0600
- `/etc/atlas-deploy/github.env`: root0600, `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_FILE=/etc/atlas-deploy/github-app.pem` 세 변수만
- `/etc/atlas-web/reader.env`, `web.json`, `/etc/atlas-ca/supabase.crt`: 기존 reader/Host/CA를 사용
- Collector를 승인할 때만 기존 writer/registered-writer/schedule 및 영속 `/var/lib/atlas-collector` 필요
- Usage를 승인할 때만 `/etc/atlas-usage`의 config/authorization/writer/reviewed-definers와 기존 `/var/lib/atlas-usage` 필요

`verifyConfiguredFile()`의 상위 경로 소유권 예외는 정확히 `/etc/atlas-collector/schedule.env`의 root 소유0644 파일이 직상위 `/etc/atlas-collector`의 atlascollector 소유0700 디렉터리에 있는 조합만 허용한다. 파일 SHA-256은 승인 설정과 일치해야 한다. 다른 파일·상위 조상 경로·임의 소유자나0700 외 collector 디렉터리로 확장하지 않는다. 모든 경로의 symlink와 group/other 쓰기를 거부하고, 이 예외에서는 파일을 `O_NOFOLLOW`로 열어 inode/소유권/권한/크기·해시와 읽기 후 파일/직상위 디렉터리 동일성을 확인한다. 기존 소유권·권한을 고치거나 디렉터리를 생성하지 않는 읽기 전용 검사다. Vault 복원 등의 별도 정책은 변경하지 않는다.

GitHub repository variable `ATLAS_DEPLOY_REPORTING_ENABLED=true`를 한 번 설정한다. 이 변수는 **결과 보고**용이며 서버 배포를 켜거나 끄지 않는다. Bootstrap의 enable은 보고 권한·이 변수·status 생성까지 검증한다. 설정 전에는 결과 workflow가 NOT_ENABLED라고 표시하며 CI 성공을 운영 배포 성공이라고 하지 않는다.

Node24.5 이상/지원 proxy flag, Linux ARM64, systemd/polkit/flock/systemd-creds와 기존 atlasweb/atlascollector 계정이 필요하다. Node·OS 업데이트나 SELinux/TLS/proxy 변경을 자동 수행하지 않는다. Node ABI 불일치/권한/파일 누락은 preflight에서 해결한다. 관리형 proxy 설정은 유지한다.

환율 웹 읽기는 [ADR0121](adr/0121-shared-fx-database.md)에 따라 공통 DB reader를 사용한다. FX preflight도 DB 자료의 무결성과 유효기간을 검사하며 로컬 공개 환율 파일을 요구하지 않는다. 만료 자료는 원래 시각을 유지하므로 배포 준비 완료로 통과시키지 않는다. 이 고정 제어면 변경은 운영 적용 전에 검토한 새 제어면 설치가 필요하며 기존 설치본은 자동으로 바뀌지 않는다.

## 최초 1회: bootstrap 실행

운영자가 **검토한 CI 성공 SHA의 root 소유 checkout**에서 실행한다. 기존 서버의 readonly repository를 사용하거나 운영 인증으로 GitHub에서 취득한다. 다른 PC 경로·개인 인증을 복사하지 않는다. 초기 진입점 `deploy/atlas-bootstrap`은 위험한 Node 주입 변수를 제거하고 기존 proxy 환경을 유지하며 공통 flock을 잡는다. 아래 명령은 운영자 절차이며 이번 개발 작업에서 실행하지 않았다.

```sh
# root-owned checkout에서, 최초 GitHub App 자료를 운영 보안 저장소에서 준비한 뒤:
bash deploy/atlas-bootstrap inspect --output /root/atlas-bootstrap.json
bash deploy/atlas-bootstrap plan --config /root/atlas-bootstrap.json
```

inspect는 GitHub의 실제 repo/workflow ID·검토 blob·CI SHA, 고정 파일 해시/소유권, 등록 collector 선정/서비스명, 타이머를 읽어0600 설정을 새로 생성한다. 기존 출력 파일은 덮어쓰지 않는다. 비밀값은 출력하지 않는다. 애매한 다중 등록 worker, 잘못된 owner/mode, 검토 source와 다른 workflow, 성공 CI 부재는 차단한다.

설정은 기본 `enabled=false`, web만 허용한다. 기존 Collector 코드 전환도 허용하려면 최초 보안 검토에서 `components.collector.enabled=true`로 명시한다. inspect가 찾은 selection/registeredUnit/policyHash를 유지한다. Usage는 기본 false이며 기존 승인 파일/검토본이 모두 준비됐을 때만 true로 한다. `activateTimerOnBootstrap=true`를 별도로 명시하지 않으면 Usage timer를 새로 시작하지 않는다. 일반 웹 Push는 이를 바꾸지 않는다.

```sh
bash deploy/atlas-bootstrap install --config /root/atlas-bootstrap.json
/usr/local/sbin/atlas-deploy-admin verify --config /etc/atlas-deploy/config.json
```

install은 정확 bootstrap SHA의 CI bundle을 검증해 고정 제어면·제한 polkit·timer·barrier drop-in·로그 정책을 설치하고 systemd-analyze verify/daemon-reload를 수행한다. 기존 웹/Collector/FX/Tunnel service를 stop/start/restart하지 않는다. 기존 base unit·custom 설정을 덮어쓰지 않으며 누락된 알려진 unit만 production 작업 경로와 함께 설치한다. Managed 파일 충돌은 차단한다. 기존 atlas-release wrapper와 제어면은 root 보호 backup/previous 경로에 보존한다. 새 상태 디렉터리는 필요한 경우에만 생성하고 기존 데이터·owner·claim은 바꾸지 않는다.

verify는 필수 파일/부모 권한/hash·고정 제어면/unit·실행 경로/버전·디스크·TLS/DB 역할·공급량 선정·예약/lock/예산·private review·FX·현재 웹의 롤백 가능 baseline을 한 번에 검사한다. FAILED일 때 모든 check ID/사유와 rc1을 반환하고 enable하지 않는다. 상세 JSON은 `/var/lib/atlas-deploy/preflight.json`에도 남는다. 비활성 component의 DB 권한/스케줄을 검증 완료로 표시하지 않는다. 웹 rollout은 writer의 장애·만료 예산을 수정하거나 전환하지 않는다.

기존 운영 웹이 새 필수 API/정적 자산을 아직 지원하지 않으면 rollback-baseline 검사가 차단한다. 최초 운영 검토에서 기존 `atlas-release stage <tested-sha>`/`activate <tested-sha>`로 호환 baseline을 준비·검증한 뒤 enable한다. 자동으로 DB migration/grant/미검증 구버전 원문을 보충하지 않는다.

```sh
# verify가 READY이고 최초 보안 점검을 끝냈을 때만:
/usr/local/sbin/atlas-deploy-admin enable --config /etc/atlas-deploy/config.json
```

이 명령은 검증된 설정 해시를 pin하고 pull timer를 켠다. 이후 main의 성공 CI를 실제 웹에 적용할 수 있다. 이미 활성인 timer의 재실행은 중복 broker를 만들지 않는다. 신규 Usage 활성화는 별도 명시 flag/유효한 기존 기간 승인/DB 권한/원문/정책 검증이 있어야 한다. 승인된 2026-10-29~11-27 UTC·18GET/일·총540GET 예산은 [기존 승인](NETWORK_USAGE_AUTOCOLLECTION.md)을 그대로 사용하며 재승인·자동 연장·다른 root로의 재소비를 하지 않는다.

## Collector와 Usage 독립 코드 전환

GitHub `Atlas CI release`의 Run workflow에서 component를 collector 또는 usage로 명시한다. 서버에서 해당 component를 허용했고 코드의 collection policy hash가 일치해야 한다. Source target·endpoint/송신 모듈·주기/예산 관련 파일 변경은 정책 변경으로 차단하며 별도의 검토/승인이 필요하다. 일반 웹 Push는 항상 web이고 두 pointer·worker·timer를 전환하지 않는다.

| component | 코드 링크 | 전환 대상 |
|---|---|---|
| web | current | atlas-web만 |
| collector | collector-current | 기존 atlas-collector, 등록 collector, atlas-fx 및 기존 FX timer 상태 |
| usage | usage-current | atlas-usage와 해당 timer만 |

Writer 전환은 durable barrier→타이머 정지→continuous worker 정상 종료/진행 중 oneshot 완료 대기→PID0→다른 호스트 DB lock·pending reservation·일별 budget·FX/Usage 소비 원문 검증→pointer 전환→기존 활성 상태만 복원 순서다. 새 oneshot을 강제로 실행하지 않는다. Persistent FX tick을 놓쳤다면 당일 claim/receipt 확인 없이는 catch-up을 유발하지 않는다. Usage 기간이 경계에서 만료되면 재개하지 않는다. 기존 역할·스케줄·원문/예약·예산은 유지하며 관측 소비를 롤백하거나 잠금을 지워 재수집하지 않는다.

중단/실패/불명 상태에서는 이전 pointer를 복구하고 실제 health를 확인한다. DB gate를 통과하지 못하면 복원됐다고 기록하지 않고 실제 pointer와 RECOVERY_BLOCKED를 남기며 writer를 멈춘 채 보존한다. 등록/Arkham session lock과 Usage 날짜 claim은 협력하는 기존 수집기 범위의 보호이며 임의 외부 프로그램의 조직 전체 호출을 인증하지 않는다.

## 비공개 파일 백업·복구

운영 보안 저장소에서 다음 명령으로 고정 파일만 encrypted backup으로 만든다. 웹·writer를 다시 시작하지 않는다.

```sh
/usr/local/sbin/atlas-deploy-admin seal --config /etc/atlas-deploy/config.json
```

출력한 `/var/lib/atlas-vault/bundle-...`에는 sealed credential과 root0600 manifest만 있다. 원래 파일을 지우지 않는다. `systemd-creds --with-key=host`의 host key는 `/var/lib/systemd/credential.secret`에 있고 **별도의 운영 보안 저장소에 보호 백업해야 한다**. Host key와 sealed bundle을 모두 잃으면 ciphertext만으로 복구할 수 없다. TPM 보장을 주장하지 않는다. manifest/host key/원문/인증을 GitHub artifact나 개발 PC로 보내지 않는다.

복구할 bundle을 root-only 운영 경로에 놓고 실행한다.

```sh
/usr/local/sbin/atlas-deploy-admin provision --manifest /secure/restore/bundle/manifest.json
/usr/local/sbin/atlas-deploy-admin verify --config /etc/atlas-deploy/config.json
```

cipher/plaintext SHA-256·credential 이름·소유/권한·고정 목적지를 전체 검증한 후 누락 파일만 복원한다. 같은 기존 파일은 보존하고 다른 파일·symlink·hash 불일치는 거절한다. 키 교체는 기존 파일을 무조건 덮어쓰는 복구와 구분해 운영 보안 절차로 수행하고 새 해시를 다시 승인한다. Supabase schema/grant나 reviewed-definers 내용을 자동 생성하지 않는다. hash만으로 사라진 원본을 복원할 수 없으며 최초 검토본은 운영 보안 저장소에 한 번 적재해야 한다.

영속 수집 root/claim/receipt/raw archive·FX store는 기존 운영 볼륨 백업을 보존한다. 이 도구는 해당 데이터를 삭제·초기화·이동하지 않는다. 손실된 소비 원문은 정확한 기존 백업에서 복구하고 project 검증을 통과해야 하며 새 root나 fake COMPLETE로 재송신하지 않는다.

## 장애·롤백·관측

완성 ZIP 캐시는 기존 보호된 state 부모가 있을 때만 `/var/lib/atlas-deploy/artifacts`에 root0700/파일0600으로 생성한다. fresh GitHub 후보 검증 후 같은 digest의 완성본만 읽고 SHA/manifest/크기/ABI/policy 검증을 다시 수행한다. 정상 hit는 ZIP 요청0·수신0bytes지만 후보 API 검증은 생략하지 않는다. 손상/unsafe cache는 자동 재다운로드로 숨기지 않고 차단한다. timeout/취소/부분 본문은 게시하지 않으며 Range 재개와 서명 URL 저장/자동 갱신은 없다. 완성본2개 보관, crash 임시 `.partial`은 사용하지 않는다. 캐시 쓰기 불가만 발생하면 이미 검증한 네트워크 릴리스는 유지한다.

`ARTIFACT_DOWNLOAD`에는 `stage`, `source`, `totalElapsedMs`, `artifactBytes`, `bytesPerSecond`와 `progress/verified/complete/cache_hit/cache_stored/cache_unavailable` 단계가 추가됐다. `elapsedMs`는 네트워크 본문 EOF에서 고정하고 total은 cache 게시까지 포함한다. `DEPLOY_OPERATION`은 bootstrap/apply CLI 전체 시간, `ARTIFACT_DISCOVERY`는 후보 조회 시간·metadata byte를 구분한다. 실패는 timeout/취소, HTTP/host, hash/ZIP/manifest/ABI/policy, cache 읽기/쓰기의 고정 코드로 나누며 비밀/원래 오류문을 출력하지 않는다. 기존 아래180초/96MiB 경계는 유지한다.

Actions 아티팩트 ZIP 다운로드는 요청 시작부터 헤더 수신과 본문 EOF까지 같은180초 제한을 사용한다. GitHub API 요청은 기존20초, 압축 ZIP은96MiB, 재시도는0회다. `ARTIFACT_DOWNLOAD` JSON 진단은 stderr에 `started`, `headers`, `body_complete` 또는 `failed` 단계와 단조 시계의 `elapsedMs`, `receivedBytes`, HTTP `status`, `timeoutMs`, `limitBytes`를 남긴다. HTTP200의 `headers`는 본문 완료가 아니며, `body_complete`도 뒤따르는 SHA-256/불변 릴리스 검증 성공을 뜻하지 않는다. 실패 원인은 고정 코드 `TIMEOUT`, `ABORTED`, `HTTP_LIMIT`, `DOWNLOAD_FAILED`로 제한하며 URL·서명 쿼리·인증·응답 본문·원래 오류 메시지는 출력하지 않는다. 본문 읽기 중 취소는 즉시 읽기를 종료하고 stream을 취소한다. 진단 출력 실패가 검증을 우회하거나 재시도를 시작하지 않는다.

자동/수동 모두 공통 flock과 durable journal을 쓴다. 수동 web 경로는 다른 component 후보와 미완료 복구를 거절하고, 기존 COMMITTED 결과의 cache/report를 복구한 뒤 새 저널을 작성한다. 수동 실패도 이전 포인터와 실제 웹 health가 모두 확인돼야 종료 처리한다. journal의 COMMITTED가 권위 있는 결과이고 versions/reports는 재구성 가능한 조회본이다. 배포 성공 후 GitHub ACK나 report 저장이 실패해도 코드를 다시 배포하지 않고 보고만 복구한다. 프로세스 crash/전원 복구에서는 미완료 전이를 검사하고 이전 코드로 복구한다. 원래 writer 상태·DB gate·timer 경계를 다시 확인한다. 자동 복구가3회 실패하면 재개하지 않고 명시 재검토를 요구한다.

```sh
/usr/local/sbin/atlas-deploy-admin status --config /etc/atlas-deploy/config.json
# 원인/비밀/권한/원문 복구 후, 소비를 바꾸지 않고 복구 검사만 재무장:
/usr/local/sbin/atlas-deploy-admin recover --config /etc/atlas-deploy/config.json
# 새 배포 중지. 웹/수집기는 중지하지 않는다:
/usr/local/sbin/atlas-deploy-admin disable --config /etc/atlas-deploy/config.json
# 기존 웹 수동 롤백 인터페이스:
/usr/local/sbin/atlas-release rollback previous
```

`/var/lib/atlas-deploy`의 transaction/versions/latest/preflight와 최근1000개 sanitized report, journal을 보관한다. 마지막 성공 버전과 소비 기록은 정리 대상이 아니다. 기존 stage log에는 별도8주 logrotate를 제공한다. 웹은 시작 readiness 후 정확 SHA, 필수 정적 자산 hash, market/등록 index와 history/자산 검토/Usage/FX JSON을 검증한다. 실패하면 이전 SHA로 전환해 같은 검증으로 복구를 확인하며 실패 원인을 GitHub에 남긴다. Cloudflare 외부 경로의 기존 운영 설정은 변경하지 않는다.

## 검증 경계

개발 환경의 실제 temp FS·child-process crash·loopback HTTP·사설 PG17과 가상 GitHub/systemd 경로로 검증한다. 실제 Fedora의 systemd/SELinux/polkit·GitHub App/hosted CI·운영 배포/롤백의 종단 성공은 최초 bootstrap에서 확인해야 한다. 준비를 운영 활성화 완료라고 보고하지 않는다.

참고: [GitHub Actions artifacts API](https://docs.github.com/en/rest/actions/artifacts), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), [commit statuses](https://docs.github.com/en/rest/commits/statuses), [systemd-creds](https://www.freedesktop.org/software/systemd/man/latest/systemd-creds.html).


LOCAL_GIT broker는 PAM `runuser`나 자체 UID 전환 대신 PID 1이 고정 비특권 User/Group으로 실행하는 transient service를 사용한다. 소스 조회와 DB 읽기 검사도 capability 없는 별도 서비스이며 shell/임의 사용자·경로를 허용하지 않는다. 기존 capability 및 systemd sandbox는 유지한다. 공개 polkit 규칙은 receipt/source 해시·root 소유·비링크를 검증하고 정확한 legacy 0600만 0644로 복구하며, verify/enable은 읽을 수 없는 규칙을 거부한다. `disable`은 배포 timer를 중지하고 deployment config의 enabled도 false로 저장한다. 운영 웹·Collector·FX는 중지하지 않는다.
