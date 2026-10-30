# Stablecoin Atlas 운영 배포

2026-10-30: 신규 설치와 배포 자동화의 정본은 [자동 CI/CD와 최초 bootstrap](AUTOMATED_DEPLOYMENT.md)이다. 아래 수동 설치·부분 helper 복사·Git/npm stage 명령은 이전 운영 기록이다. 새 bootstrap 이후에는 고정 제어면과 CI artifact 기반 `atlas-release`를 사용하며, 기존 부분 helper 설치 명령을 재실행하지 않는다. 기존 수집 계약·보존 데이터·설정은 유지한다.

사용자는 `094a225cd95d6cbd74053e7eda065a3e339b0df6`의 Mac mini 웹/Reader/Tunnel 정상, FX503·공개 파일0바이트와 collector/timer 미설치를 보고했다. 이는 사용자 제공 운영 상태이며 이 작업의 직접 서버 관측은 아니다. 후속 최소 수정과 운영자가 적용할 정확한 수집기/FX 복구 순서는 [운영 복구 절차](COLLECTOR_PRODUCTION_RECOVERY.md)를 따른다. 아래 최초 준비 기록과 실제 서버 검증을 구분한다.

이 문서는 Mac mini M1·8GB·Fedora Asahi Remix 44 Server(aarch64)에 대한 **배포 준비**다. 이 작업에서 실제 Fedora 설치·SSH 배포·Cloudflare 계정/DNS 변경·서비스 활성화는 실행하지 않았다. 실제 도메인은 운영자가 정한다. 기존 Supabase 스키마·데이터·판정·수집 주기/예산은 바꾸지 않는다. 기본 진입 경로는 `/`다.

## 구성과 공개 범위

```text
HTTPS 도메인 → Cloudflare 관리 Tunnel → cloudflared → 127.0.0.1:4173
                                                      atlasweb → Supabase reader (TLS)
atlascollector → 기존 예약/상한/receipt → Supabase writer (TLS)
```

웹은 `npm start -- --config <web.json> --reader-env <reader.env> --revision-file <REVISION>`로 실행한다. 개발용 `npm run ui`는 기존 로컬 Preview와 동일하다. 운영 설정 누락·reader 거절 시 웹이 시작되지 않으며 JSON/mock로 전환하지 않는다. 브라우저는 Supabase에 직접 연결하지 않는다.

운영에서는 전체 현황·자산 프로필·저장 시장 projection과 검토된 정적 소스 발췌만 제공한다. `/mock-data.json`, mock JS, `/evidence/*`, 저장 지리 연구, 임의 파일·보고서·키 경로를 기본 차단한다. private 읽기 실행/보고서와 mock 화면은 운영 HTML에서 제거하며 해당 자료를 요청하는 코드를 실행하지 않는다. 개발 Preview에서는 기존 기능을 유지한다. 공개 가능 파일/endpoint는 `tools/production-policy.mjs`의 명시 목록에 있어야 한다.

`/healthz`는 `{status:"ok",commit:"40자리 SHA"}`만 반환하는 생존 확인이다. 외부 Host 또는 loopback health Host만 허용한다. 생존 응답은 DB의 지속 건강을 보증하지 않는다. 배포 확인은 SHA 일치에 더해 `/market-data.json`의 PostgreSQL 읽기 성공까지 확인한다. DB 실패는 각 endpoint의 일반503이며 URL·비밀번호·상위 오류 원문을 출력하지 않는다. 실패 시 브라우저의 이전 정상값/시각 보존 정책은 유지한다.

## 먼저 확인할 기존 상태

[Supabase 설정](SUPABASE_SETUP.md)·[수집 운영](COLLECTOR_SERVICE.md)을 기준으로 현재 스키마·월 파티션·reader/writer·등록 selection·영속 원문/receipt를 확인한다. 이미 준비된 DB에 init/upgrade/grant/continuous 명령을 반복하지 않는다. 다음 UTC 월 파티션은 기존 관리자 절차로 별도 관리하며 웹/배포 도구/worker는 DDL을 하지 않는다.

기존 수집기: Arkham5분/UTC하루288예약·최대2016GET, 등록 일별5자산/하루5GET, FX기존 UTC00:10 timer다. 누락 구간 몰아 조회·동일 예약 재호출·예산 초기화·자동 공급자 전환을 추가하지 않는다. 재시작은 기존 원문 기반 복구를 재개하며 상세 계약은 수집 운영 문서를 따른다. 다른 PC의 동일 DB 수집기를 함께 켜지 않는다.

## Fedora 준비 명령

다음 명령은 **실제 서버에서 운영자가 실행할 명령**이며 이 작업에서 실행하지 않았다. `atlas.example.com`, 저장소 SSH 주소와 SHA는 실제 값으로 교체한다.

```sh
uname -m                         # aarch64 확인
getconf PAGE_SIZE                # Asahi 실제 커널 페이지 크기 기록
sudo dnf install git nodejs npm ca-certificates curl util-linux tar findutils
/usr/bin/node --version         # 24.5 이상; 배포 당시 지원되는 보안 패치 버전 선택
/usr/bin/node -p 'process.platform + "/" + process.arch'
/usr/bin/node -e 'if(!process.allowedNodeEnvironmentFlags.has("--use-env-proxy"))process.exit(1)'
```

Fedora 패키지가 요구 버전보다 낮으면 시작하지 말고 지원되는 공식 ARM64 Node 설치를 별도 준비한다. 홈 디렉터리의 nvm/asdf에 의존하지 않는다. 운영 서버에는 Anvil·JDK·Docker·PostgreSQL을 설치할 필요가 없다. 전체 개발 시험은 별도 검증 환경에서 Anvil/JDK와 고정 compiler 캐시를 준비하여 수행한다. CI의 사설 PG 시험이 필요하면 별도 격리 시험 runner를 사용한다.

```sh
sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin atlasweb
sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin atlascollector
sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin atlastunnel
sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin atlasbuild
sudo install -d -m 0755 /opt/stablecoin-atlas /opt/stablecoin-atlas/releases /usr/local/lib/atlas-deploy
sudo install -d -m 0700 -o atlasbuild -g atlasbuild /var/cache/atlas-build
sudo install -d -m 0755 /etc/atlas-web
sudo install -d -m 0700 /etc/atlas-tunnel /var/log/atlas-deploy
sudo install -d -m 0755 /etc/atlas-ca
sudo install -d -m 0700 -o atlascollector -g atlascollector /etc/atlas-collector /var/lib/atlas-collector
sudo install -d -m 2750 -o atlascollector -g atlasweb /var/lib/atlas-public
```

기존 사용자가 있으면 재생성하지 않고 UID·소유권을 점검한다. 계정/디렉터리 준비는 서버 운영 단계다. root가 관리하는 `/opt/stablecoin-atlas/repository`에 저장소를 clone하고 원격 인증은 서버의 SSH agent 등 비공개 수단으로 준비한다. 서비스 계정에는 저장소 인증을 전달하지 않는다. 배포 경로와 도구는 root 소유이고 atlasbuild/서비스 계정이 수정할 수 없어야 한다.

```sh
sudo git clone <저장소-SSH-주소> /opt/stablecoin-atlas/repository
```

## 환경 파일과 reader 분리

`deploy/web.config.example.json`을 `/etc/atlas-web/web.json`에 배치하고 hosts를 실제 도메인으로 바꾼다. wildcard·URL·포트·대문자 Host는 거부한다. 표준 HTTPS Host 이름만 최대8개 허용한다. port는4173, fxFile은 `/var/lib/atlas-public/fx.json`을 사용한다. 설정 파일은 root:root0644이며 부모 `/etc/atlas-web`도0755로 설정한다. reader 파일 자체는0600을 유지한다.

```sh
sudo install -m 0644 /opt/stablecoin-atlas/repository/deploy/web.config.example.json /etc/atlas-web/web.json
sudo install -m 0600 /opt/stablecoin-atlas/repository/deploy/reader.env.example /etc/atlas-web/reader.env
sudoedit /etc/atlas-web/web.json /etc/atlas-web/reader.env
```

`deploy/reader.env.example`을 참고해 `/etc/atlas-web/reader.env`에 기존 전용 reader 접속 URI와 필요한 CA 경로만 넣는다. root:root0600이며 systemd `LoadCredential`이 atlasweb 전용 런타임 credential로 전달한다. writer·admin·Arkham/Allium 키를 넣으면 시작하지 않는다. URI는 Supabase의 실제 direct/session pooler 설정을 사용하며 지역으로 host를 추측하지 않는다. 서버와 가까운 Seoul 프로젝트를 그대로 사용한다. CA는 `/etc/atlas-ca/supabase.crt` 등 공개 인증서 파일로 root 소유0644로 관리한다.

원본 파일과 systemd가 전달한 파일의 소유권/권한은 다를 수 있다. [ADR0106](adr/0106-systemd-reader-credential.md)에 따라 production은 `CREDENTIALS_DIRECTORY=/run/credentials/<단일 unit>`과 정확한 `${CREDENTIALS_DIRECTORY}/reader.env`만 Credential 정책으로 읽는다. root 소유0400/0440 또는 서비스 UID 소유0400/0600을 허용하며 실제 open 성공도 필요하다. root 소유 상위 디렉터리의 쓰기 제한, unit 디렉터리의 root/서비스 소유·other 접근 금지, 전체 경로의 symlink 부재를 검사한다. root unit 디렉터리의 group r/x는 systemd ACL mask를 고려해 허용하지만 group 쓰기는 거절한다. 특수 권한·다른 파일/외부 경로·다른 소유자는 거절하며, 환경변수가 설정됐을 때 일반 파일로 fallback하지 않는다. 환경변수가 없는 직접 실행은 기존 서비스 UID 소유·group/other 권한0 정책을 유지한다. 전달 파일을 chown/chmod하거나 원본0600을 완화하지 않는다. 사용자별 systemd manager 경로는 지원하지 않는다.

원격 TLS의 `rejectUnauthorized=true`를 강제하며 검증 실패 시 중단한다. `NODE_TLS_REJECT_UNAUTHORIZED=0`은 거부한다. web의 각 DB 연결은 reader 등록·실제 로그인과 모든 `atlas_*` 앱 schema의 직접/상속/PUBLIC/컬럼 쓰기권한·소유권·sequence·실행 함수 경로를 검사하고 세션을 읽기 전용으로 설정한다. 기존 invoker `trigger` 반환형 함수만 직접 호출 불가능한 경로로 구분한다. 일반 함수·procedure·event_trigger·security definer trigger는 callable이면 거부한다. 거절될 때 서비스가 GRANT를 고치거나 schema를 변경하지 않는다.

웹 전체 reader가 동시에 최대2개 물리 연결을 재사용하며 대기 최대8개/10초를 공유한다. 매 checkout 전체 Reader 권한을 재확인하고 반환 전 세션 상태를 초기화하며 오류 세션을 폐기한다. idle30초/수명5분이다. 기존 DB 접속5초·client query15초·statement10초·transaction60초 제한을 재사용한다. 시장 성공 캐시 기본5분·단일2MiB·동시 refresh 병합이며 만료 후 오류는503이다. 다른 cache와 등록 history 한도는 유지한다. API별 연결/쿼리/응답 시간은 비밀 없는 `ATLAS_API_TIMING` journal 로그로 남긴다([정의/검증/한계](research/2026-10-25-web-reader-performance.md)). 운영용 웹 계정은 collector의 credential/receipt/archive에 파일 접근도 할 수 없다.

collector의 기존 writer.env/registered-writer.env는 `/etc/atlas-collector`의 atlascollector 소유0600으로 분리한다. admin은 어느 서비스에도 전달하지 않는다. 실제 값을 명령행·journal·Git·브라우저에 붙이지 않는다.

## systemd 설치

저장소의 배포 파일을 신뢰한 정확 SHA에서 설치한다. 웹 release 전환은 root 관리 도구 사본으로 수행하며 새 release의 임의 스크립트를 sudo로 실행하지 않는다.

```sh
cd /opt/stablecoin-atlas/repository
sudo install -m 0755 deploy/atlas-release /usr/local/sbin/atlas-release
sudo install -m 0644 tools/release-stage.mjs tools/release-switch.mjs tools/loopback-http.mjs /usr/local/lib/atlas-deploy/
sudo install -m 0644 deploy/atlas-web.service /etc/systemd/system/
sudo install -m 0644 deploy/atlas-cloudflared.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/atlas-web.service /etc/systemd/system/atlas-cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable atlas-web.service
```

웹은 atlasweb 비관리자·read-only 코드/파일시스템·빈 capability·별도 credential·journal 로그로 실행한다. SIGTERM/SIGINT는 HTTP 요청 종료 후 DB 연결을 정리하며20초 뒤 남은 HTTP 연결을 닫는다. systemd는45초 종료 유예·실패10초 후 재시작·5분3회 제한을 둔다.

기존 세 수집 unit/FX timer와 production drop-in도 설치한다. base 파일은 예산·실행 인자·재시작 정책을 그대로 둔다. drop-in의 WorkingDirectory는 `/opt/stablecoin-atlas/collector-current`이며 웹 current와 **별도**다. `collector-current`는 검증된 정확 release를 가리키게 한 번 설정한다. 웹 배포는 이 포인터나 collector 서비스를 변경하지 않는다.

```sh
sudo install -m 0644 deploy/atlas-collector.service deploy/atlas-registered-collector@.service deploy/atlas-fx.service deploy/atlas-fx.timer /etc/systemd/system/
sudo install -d /etc/systemd/system/atlas-collector.service.d /etc/systemd/system/atlas-registered-collector@.service.d /etc/systemd/system/atlas-fx.service.d
sudo install -m 0644 deploy/atlas-collector.service.d/production.conf /etc/systemd/system/atlas-collector.service.d/
sudo install -m 0644 deploy/atlas-registered-collector@.service.d/production.conf /etc/systemd/system/atlas-registered-collector@.service.d/
sudo install -m 0644 deploy/atlas-fx.service.d/production.conf /etc/systemd/system/atlas-fx.service.d/
```

기존 호스트의 worker를 정상 정지하고 DB lock·복구 상태를 확인한 뒤 receipt/archive/market-store를 원래 hash·파일명·시각을 보존하여 이관한다. 비어 있는 원문 디렉터리로 기존 DB 수집을 재개하지 않는다. [수집기 전환 순서](COLLECTOR_SERVICE.md#전환과-시작)의 doctor와 실제 writer/selection 읽기 점검을 먼저 실행한다. 이 문서의 배포 도구는 worker를 재실행하거나 예약을 지우지 않는다.

첫 release stage 이후 운영자가 검증한 SHA와 selection을 사용하여 다음을 실행한다. 기존 수집 주기를 바꾸거나 다른 호스트의 worker와 중복 시작하지 않는다.

```sh
sudo ln -s /opt/stablecoin-atlas/releases/<SHA> /opt/stablecoin-atlas/collector-current
sudo systemctl daemon-reload
sudo systemctl enable --now atlas-collector.service atlas-registered-collector@<selection-id>.service atlas-fx.timer
```

FX drop-in은 기존 수집 성공 후 **이미 검증된 projection만** `/var/lib/atlas-public/fx.json`에 원자적으로 게시한다. 새 ECB 요청을 추가하지 않는다. archive·receipt는 collector 전용 경로에 남는다. 최초 수집 전에도 기존 FX 저장본을 같은 도구로 수동 게시할 수 있다. 공개 projection이 없거나 만료되면 원화 참고값은 미확보이며0으로 대체하지 않는다.

M1 8GB의 시작 자원 한도는 web768MiB(메모리 high512MiB, Node heap384MiB), 두 collector 각1GiB, FX256MiB, tunnel256MiB다. 이는 부하 검증 결과가 아니며 실제 `systemctl show -p MemoryCurrent,MemoryPeak`와 journal로 조정한다. 디스크·원문 보관의 자동 삭제 정책은 추가하지 않는다.

## 최초 배포·검증·롤백

테스트한 정확40자리 SHA를 사용한다. 개발/CI 검증은 `npm ci`, `npm run check`이고 새 운영 DB 검증은 별도 사설 fixture에서 수행한다. 현재 데이터베이스에 시험 데이터를 넣지 않는다. 서버 stage는 root 관리 repository의 고정 origin/main만60초 제한으로 fetch하고 테스트 SHA가 그 이력에 포함되는지 확인한다. 다른 URL/ref나 최신 SHA로 자동 대체하지 않는다. 이60초는 Git 프로세스 제한이며 SSH 자식 트리 전체의 강제 종료 보장은 아니다. 중단 후에는 stage lock과 남은 프로세스를 운영자가 확인한다. archive는64MiB로 제한한다. 해당 SHA의 tracked 파일만 추출하고 atlasbuild로 `npm ci --omit=dev --ignore-scripts`를 수행한다. 코드/의존성은 root 소유로 잠근 뒤 SHA 디렉터리로 게시한다. npm 설치 로그는 root 전용 `/var/log/atlas-deploy/<SHA>-<attempt>.log`다. 서버의 `.env`·원문·키는 release에 복사하지 않는다.

```sh
sudo /usr/local/sbin/atlas-release stage <40자리-검증한-SHA>
sudo /usr/local/sbin/atlas-release activate <동일-SHA>
curl --fail http://127.0.0.1:4173/healthz
curl --fail -H 'Host: atlas.example.com' http://127.0.0.1:4173/market-data.json -o /dev/null
sudo systemctl status atlas-web.service
sudo journalctl -u atlas-web.service -n 30
```

stage는 root 소유 배타 잠금 아래 동작하고 최종 대상 경로를 mkdir로 독점 확보한 뒤 완성된 트리만 원자적으로 게시한다. 기존 대상/깨진 symlink도 교체하지 않는다. 전환은 별도 파일시스템 잠금 아래 current symlink를 원자적으로 교체하고 **웹만** 재시작한다. health의 정확 SHA·DB 읽기가 실패하면 이전 symlink로 돌려 재시작/재검증한다. 첫 배포 실패 시 current를 제거하고 웹을 정지한다. 이전 버전의 상태 확인까지 실패하면 `DEPLOY_ROLLBACK_UNHEALTHY`로 종료하고 운영자가 확인한다. 자동 롤백을 반복하지 않는다. 첫 배포 전 이전 release가 없다는 사실을 보존한다. 같은 SHA가 이미 stage돼 있으면 덮어쓰지 않고 거절한다. 재시도할 때는 기존 release와 원래 실패 기록을 확인한 뒤 같은 SHA의 activate만 명시 실행한다.

```sh
sudo /usr/local/sbin/atlas-release rollback previous
```

웹 롤백은 DB·collector·예산·영속 데이터·환경 파일을 되돌리지 않는다. schema가 동일한 검증 release만 사용한다. stale stage/deployment lock은 활성 배포가 없는지 확인 후 운영자가 보존/해제하며 도구가 강제로 훔치지 않는다. root 관리 배포 도구 자체의 변경은 review 후 별도 설치한다. 배포 권한을 주려면 `atlas-release stage/activate/rollback`만 허용하는 별도 운영 계정과 제한된 sudo 정책을 준비한다. 임의 systemctl/node/shell sudo를 허용하지 않는다.

## Cloudflare Dashboard 관리 Tunnel

Cloudflare 공식 RPM 저장소 안내를 검토하여 cloudflared를 설치한다. 실제 Fedora/aarch64 호환 버전을 `dnf repoquery`·패키지 서명·`cloudflared --version`으로 확인한다. token-file은2025.4.0 이상이 필요하다. 다음은 운영자 명령이며 여기서는 실행하지 않았다.

```sh
curl -fsSLo /tmp/cloudflared.repo https://pkg.cloudflare.com/cloudflared.repo
# 공식 저장소/GPG 설정 내용을 확인한 뒤 설치
sudo install -m 0644 /tmp/cloudflared.repo /etc/yum.repos.d/cloudflared.repo
sudo dnf repoquery --arch=aarch64 cloudflared
sudo dnf install cloudflared
/usr/bin/cloudflared --version
```

Dashboard의 Networking → Tunnels에서 **remotely-managed Tunnel**을 만들고 published application 한 개를 설정한다.

| 항목 | 값 |
| --- | --- |
| Hostname | 실제 `atlas.<도메인>` — web.json hosts와 정확히 동일 |
| Service | `http://127.0.0.1:4173` |
| HTTP Host Header | 실제 공개 hostname과 동일(포트/스킴 없음) |
| HTTPS | Cloudflare 관리; edge의 HTTPS 강제 적용 |
| 추가 경로 | SSH/Cockpit/collector/private 파일 경로 추가하지 않음 |

Tunnel Token만 `/etc/atlas-tunnel/tunnel.token` root:root0600 파일에 비공개로 배치한다. systemd LoadCredential로 atlastunnel에 전달하며 명령행/Git에 token을 넣지 않는다. `cloudflared service install <token>`과 이 unit을 중복 설치하지 않는다. API Token·로그인 인증서가 이 운영 경로에 필요하지 않다.

```sh
sudo systemctl enable --now atlas-cloudflared.service
sudo journalctl -u atlas-cloudflared.service -n 30
ss -ltn                        # 4173/metrics가127.0.0.1인지 확인
curl --fail https://atlas.example.com/healthz
```

cloudflared metrics도127.0.0.1:49312만 사용한다. 공유기 포트포워딩·80/443 개방은 필요하지 않다. Tunnel의 outbound 연결은 기존 방화벽 정책 안에서 허용한다. 앱은 Forwarded/X-Forwarded-Host/CF IP 헤더를 권한 근거로 신뢰하지 않는다. Origin이 있다면 허용 Host와 같은 HTTPS Origin만 받는다. 외부 검색/링크에서 들어오는 Origin 없는 최상위 공개 문서 navigation은 허용하고 cross-site 데이터 요청/iframe은 거부한다. 개발 Preview의 기존 cross-site 거부는 유지한다. Host 덮어쓰기 값이 다르면403이며 TLS 검증 해제나 wildcard로 고치지 않는다. loopback의 일반 페이지 Host는 공개 hostname을 명시한 요청만 허용한다. healthz만 loopback Host를 허용한다.

## 향후 GitHub Actions

`.github/workflows/production.yml`은 수동 workflow_dispatch만 제공하며 자동 push 배포는 켜지 않는다. deploy=false가 기본이다. `atlas-ci` 라벨의 별도 Linux/ARM64 시험 runner에 Node24.5+·Anvil·JDK17/21·기존 고정 TRON compiler 캐시를 `/var/cache/atlas-ci/tron-0.8.26.cjs`에 별도 준비한다. checkout 뒤 이 파일만 workspace에 복사하고 doctor가 pin hash를 검증한다. 누락 compiler를 workflow가 새로 취득하지 않는다. npm run check의 skip 수와 사유를 보존하며 이번 Mac 검증을 해당 runner 성공으로 대신하지 않는다.

배포를 선택하려면 main·production environment 승인과 별도 `atlas-deploy` 라벨 runner를 준비한다. 이 runner는 Tailscale SSH 접근·고정 known_hosts·외부에서 관리한 SSH agent와 제한 sudo 권한을 사용한다. repository variable `ATLAS_DEPLOY_HOST`에 비밀이 아닌 Tailscale/MagicDNS host만 설정한다. Tailscale token·SSH key·DB/공급자 credential을 저장소나 job body에 넣지 않는다. 테스트 job의 정확 SHA만 stage/activate에 전달한다. stage가 고정 origin/main에서 정확 SHA를 확보하며 root의 비공개 저장소 읽기 인증/known_hosts를 미리 준비해야 한다. 도구가 다른 commit으로 대체하지 않는다. CI job과 배포 job은 자격증명·작업 디렉터리를 분리한다. self-hosted runner에 불특정 PR 코드를 실행시키지 않는다.

## 검증 범위와 남은 것

로컬 검증 결과/실패·수정은 [작업 기록](research/2026-10-25-production-readiness.md)을 따른다. 로컬 HTTP/사설 PG·실제 기존 Supabase reader/시뮬레이션 HTTPS proxy·Chrome 검증과 실제 Fedora systemd/외부 Tunnel 검증은 분리한다.

운영 전 남는 일은 실제 도메인·환경 파일·CA 배치, Fedora/aarch64 Node/cloudflared 실행, systemd verify/hardening/boot·실제 SIGTERM·메모리/부하 확인, 기존 worker 정지·영속 상태 이관/복구 점검, SSH/Tailscale runner·롤백 실증, Cloudflare 외부 HTTPS·차단 경로 검증이다. 이 단계들을 실행하기 전에는 실제 운영 배포 완료로 표시하지 않는다.

공식 근거: [Fedora Node.js](https://developer.fedoraproject.org/tech/languages/nodejs/nodejs.html), [Cloudflare 설치](https://pkg.cloudflare.com/index.html), [Tunnel origin parameters](https://developers.cloudflare.com/tunnel/reference/origin-parameters/), [token-file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/), [systemd credentials](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html), [PostgreSQL trigger](https://www.postgresql.org/docs/17/plpgsql-trigger.html).
