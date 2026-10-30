# Stablecoin Atlas 자동 CI/CD

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

GitHub repository variable `ATLAS_DEPLOY_REPORTING_ENABLED=true`를 한 번 설정한다. 이 변수는 **결과 보고**용이며 서버 배포를 켜거나 끄지 않는다. Bootstrap의 enable은 보고 권한·이 변수·status 생성까지 검증한다. 설정 전에는 결과 workflow가 NOT_ENABLED라고 표시하며 CI 성공을 운영 배포 성공이라고 하지 않는다.

Node24.5 이상/지원 proxy flag, Linux ARM64, systemd/polkit/flock/systemd-creds와 기존 atlasweb/atlascollector 계정이 필요하다. Node·OS 업데이트나 SELinux/TLS/proxy 변경을 자동 수행하지 않는다. Node ABI 불일치/권한/파일 누락은 preflight에서 해결한다. 관리형 proxy 설정은 유지한다.

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
