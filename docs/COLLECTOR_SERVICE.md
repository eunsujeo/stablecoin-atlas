# 주기 수집 운영

Mac mini production의 별도 `collector-current`·서비스 계정/권한·기존 FX 저장본 이전/check/publish·활성화 승인·롤백은 [운영 복구 절차](COLLECTOR_PRODUCTION_RECOVERY.md)를 따른다. 아래 `/opt/multi-chain-asset-compatibility`는 base unit 경로이며 production drop-in은 이를 대체한다. 이번 변경은 기존 DB 준비 명령의 재실행을 요구하지 않는다.

서버 CLI가 DB 예약을 확보한 뒤 Arkham을5분 간격, DeFiLlama를 UTC 날짜마다1회 수집한다. 브라우저와 웹 서버 시작은 공급자 API를 호출하지 않는다. 기존 `market:watch`와 새 worker를 함께 실행하지 않는다.

기본 Arkham 예산은 UTC 하루288회(최대2016 GET)다. 24시간 동안5분마다 현재 구간을 수집한다. 실패·중단 예약도 횟수에 포함하며 재시작해도 초기화하지 않는다. 현재 등록 v3 구성은 별도 일별 worker가 하루5 GET로5자산의 네트워크 지표와 코인 전체 시장 지표를 함께 가져온다. 5분 worker에는 `--skip-daily-history`를 지정해 기존3자산 일별 경로를 끈다. 이는 앱의 상한이며 공급자 계정 크레딧 보증은 아니다.

`--arkham-runs-per-day 0`은 Arkham만 끈다. 명시적으로 더 낮은 상한도 설정할 수 있다. 프로세스 중지/PC 절전 중 빠진 구간을 몰아서 조회하지 않는다. 공급자가 거부한 요청은 같은 슬롯에서 재시도하지 않는다.

기존12회 설정을 사용한 DB는 아래 관리자 `continuous` 전환이 필요하다. 오늘 이미 사용한 횟수/예약을 지우지 않고 오늘의12회 상한만288회로 올린다. 다른 기존 상한이면 자동 변경하지 않는다. 일반 runtime은 계속 날짜별 예산을 변경할 수 없다.

## DB 준비

기존 [Supabase 설정](SUPABASE_SETUP.md)과 [DB CLI](POSTGRESQL_MARKET_CLI.md)로 core schema·월 파티션·writer/reader를 준비한다. 신규 프로젝트는 history init 후 normalize가 필요하다. 기존 v1은 upgrade 후 normalize한다. continuous를 실행할 때는 같은 DB의 수집기를 먼저 종료한다. 아래 작업은 관리자 전용이며 수집 서비스에 관리자 설정을 전달하지 않는다.

```sh
npm run market:history:normalize -- --env-file .state/market-db-secrets/admin.env
npm run market:history:continuous -- --env-file .state/market-db-secrets/admin.env
npm run market:history:grant-writer -- --env-file .state/market-db-secrets/admin.env --role atlas_market_writer
```

역할 이름은 실제 core writer 이름으로 바꾼다. reader의 새 테이블 SELECT/RLS는 normalize가 확장한다. 기존 v1/v2 snapshot·원문은 보존한다. v3 일별 값은 자산·네트워크·지표·날짜·정확 수량별 한 번 저장하고 정정된 값은 별도 불변 값과 최신 포인터로 유지한다. 같은 수량도 날짜나 네트워크가 다르면 정상적인 별도 관측이다. 월 파티션은 기존 관리자 CLI로 다음 달 이전에 준비해야 하며 worker는 DDL을 수행하지 않는다.

## 실행과 복구

Node24.5 이상과 npm ci가 필요하다. writer.env에는 DATABASE_URL, 필요한 DATABASE_CA_FILE, ARKM_API_KEY를 넣고 파일은0600으로 보관한다. TLS 인증서 검증을 유지하고 Session pooler 또는 direct connection을 사용한다. session advisory lock을 유지할 수 없는 transaction pooler는 지원하지 않는다.

```sh
npm run collector:run -- --once --env-file .state/market-db-secrets/writer.env
npm run collector:status -- --env-file .state/market-db-secrets/writer.env
npm run collector:run -- --env-file .state/market-db-secrets/writer.env
```

`--once`는 현재 구간만 처리하는 진단용이다. DB 예약이 이미 있으면 외부 재조회 없이 건너뛴다. 실제 계속 실행은 마지막 명령이다. 전용 writer 설정에 API 키가 없다면 기존 로컬 `.env.local`을 명시해 사용한다. 관리자·reader 설정을 섞지 않는다.

기본 receipt `.state/collector-state`와 원문 `.state/collector-archive`는 private 영속 디렉터리다. `--state-dir`, `--archive-dir`로 경로를 지정할 수 있다. 5분 worker의 `--market-dir`는 projection/수집 상태/복구 mirror를 저장할 별도 경로다. 현재 고정 원문 경로 규칙 때문에 마지막 디렉터리 이름은 `market-store`여야 한다. 생략 시 기존 reports/market-store를 유지한다. 서비스 재시작·재배포에도 동일 디렉터리와 동일 DB를 사용한다. 원문은 SHA-256 경로에 gzip으로 압축하되 해제한 원본 바이트/hash를 검증한다. Arkham은 검토된 projection만 보관하고 holder 목록은 저장하지 않는다.

예약은 API 요청 전에 확정한다. 응답을 모두 검증한 뒤 원문/receipt를 fsync하고 DB import를 실행한다. COMMIT 응답 유실은 receipt로 import만 재개한다. receipt 없는 CLAIMED는 UNCONFIRMED로 종료하고 같은 슬롯을 다시 조회하지 않는다. 실패는 기존 정상값을 유지하며 같은 슬롯 재시도·공급자 전환을 하지 않는다. 새 예정 구간은 별도 관측이며 예산을 소비한다. 종료되지 않은 복구가 있으면 새 조회를 진행하지 않는다. receipt/원문은 정상 복구 전 삭제하지 않는다.

## Linux 서버: 두 수집 서비스와 영속 상태

[Arkham 서비스](../deploy/atlas-collector.service)와 [일별 등록 서비스](../deploy/atlas-registered-collector@.service)를 사용한다. Node24.5 이상·systemd Linux와 repo `/opt/multi-chain-asset-compatibility`, 전용 사용자 `atlascollector`를 전제로 한다. Node 실행 경로는 `/usr/bin/env node`이며 시스템 서비스의 PATH에서 지원 Node가 선택되어야 한다. 사용자 홈의 버전 관리자 설치는 ProtectHome 설정으로 접근되지 않을 수 있다.

| 경로 | 내용 |
|---|---|
| `/opt/multi-chain-asset-compatibility` | 코드·node_modules, root 관리·서비스 사용자 읽기 전용 |
| `/etc/atlas-collector/writer.env` | 5분 수집용 DB writer·CA 경로·Arkham 키 |
| `/etc/atlas-collector/registered-writer.env` | 일별 수집용 DB writer·CA 경로, Arkham 키 제외 |
| `/var/lib/atlas-collector/receipts` | 두 worker가 공유하는 불변 복구 receipt |
| `/var/lib/atlas-collector/archive` | 두 worker가 공유하는 private 원문/검토 projection |
| `/var/lib/atlas-collector/market-store` | 5분 수집 projection·상태 mirror·로컬 writer lock |

설정 디렉터리/영속 디렉터리는 atlascollector 소유0700, env는 해당 사용자 소유0600이다. CA는 서비스가 읽을 수 있고 다른 사용자가 쓰지 못해야 한다. 코드 폴더와 원문을 웹 정적 경로로 공개하지 않는다. 두 서비스는 StateDirectory를 공유하므로 소유 사용자를 다르게 설정하지 않는다. 서비스 시작 전 아래 영속 하위 디렉터리도 준비한다. [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)의 StateDirectory는 정지 후에도 남지만 서버 디스크 분실에 대한 백업은 아니다.

```sh
sudo install -d -m 0700 -o atlascollector -g atlascollector /etc/atlas-collector /var/lib/atlas-collector /var/lib/atlas-collector/receipts /var/lib/atlas-collector/archive /var/lib/atlas-collector/market-store
```

실제 env/CA는 별도 비공개 전달로 배치한다. 관리자 env는 서비스에 전달하지 않는다. 기존 서버 네트워크 설정을 유지한다. 예제에는 특정 프록시 주소나 인증값을 넣지 않는다.

## 전환과 시작

1. 배포 코드에서 npm ci, npm run check, npm run check:db를 통과시킨다. DB에는 history v4와 registration v3, 검토된 selection, writer 최소 권한과 다음 월 파티션을 준비한다. 변경되지 않은 DB에 owner migration을 재실행하지 않는다.
2. 같은 DB를 사용하는 기존 로컬/다른 호스트 수집기를 정상 종료하고 잠금405/407 해제를 확인한다. 미종료 legacy DEFILLAMA 예약이 있으면 원문 기반 복구와 결과 확정을 먼저 해결한다. 이를 건너뛰거나 예약을 지워 새 조회를 허용하지 않는다.
3. 정지 상태에서 기존 receipts·archive·reports/market-store를 표의 새 경로로 함께 이관한다. 새 호스트의 서비스 UID와 private 권한을 맞추고 원래 hash/시각/파일명을 보존한다. 비어 있는 새 archive로 기존 DB만 연결하지 않는다.
4. 아래 doctor를 실제 서비스 사용자로 실행한다. 파일 존재·권한·디렉터리·Node/프록시 flag 지원을 읽기만 검사하며 DB·HTTP·파일 생성을 하지 않는다. READY의 범위는 로컬 구성뿐이다. 별도로 DB check와 등록 status로 접속/권한/selection을 확인한다.

```sh
sudo -u atlascollector /usr/bin/env node /opt/multi-chain-asset-compatibility/tools/collector-deploy.mjs check --kind arkham --env-file /etc/atlas-collector/writer.env --state-root /var/lib/atlas-collector
sudo -u atlascollector /usr/bin/env node /opt/multi-chain-asset-compatibility/tools/collector-deploy.mjs check --kind registered --selection <selection-id> --env-file /etc/atlas-collector/registered-writer.env --state-root /var/lib/atlas-collector
```

5. 두 unit 파일을 `/etc/systemd/system`에 설치한다. 다음 명령은 서버 운영자가 위 검증과 기존 수집기 종료를 확인한 뒤 실행하는 전환 절차다. 이 저장소를 수정하는 것만으로 서비스가 설치/시작되지는 않는다.

```sh
sudo systemd-analyze verify /etc/systemd/system/atlas-collector.service /etc/systemd/system/atlas-registered-collector@.service
sudo systemctl daemon-reload
sudo systemctl enable --now atlas-collector.service atlas-registered-collector@<selection-id>.service
sudo systemctl status atlas-collector.service atlas-registered-collector@<selection-id>.service
sudo journalctl -u atlas-collector.service -u atlas-registered-collector@<selection-id>.service -n 50
```

서비스 이름의 `<selection-id>`는 검토된64자리 소문자 hash로 바꾼다. 동시에 다른 selection의 등록 서비스를 시작하지 않는다. 잘못된 instance는 doctor에서 HTTP 전에 거부된다. 부팅 시작과 실패 시60초 후 재시작을 설정하며15분 안의 시작은3회로 제한한다. [systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)의 재시작은 프로세스 실패 복구이며 공급자 같은 슬롯 재조회 권한이 아니다. 한도 도달 시 journal·DB 상태·영속 파일을 점검한 후에만 reset-failed/start한다. 상태 조회 성공이나 lock 존재만으로 수집 건강을 보장하지 않는다.

## 정지·강제 종료·백업·롤백

SIGTERM 정상 정지에는45초를 부여한다. SIGKILL/전원 손실 때는 receipt 유무에 따라 기존 DB 복구 규칙을 적용한다. `market-store/.writer-lock`는 활성 writer를 임의로 탈취하지 않으므로 강제 종료 시 남을 수 있다. 두 서비스와 다른 writer가 완전히 정지했고 DB 세션 잠금도 해제된 것을 확인한 뒤, 남은 lock을 별도 private 격리 경로로 보존하고 운영자가 복구를 검토한다. 이를 재시작 스크립트에서 자동 삭제하지 않는다.

보관 기본 정책은 **자동 삭제 없음**이다. 용량/파일 수를 점검하고, receipt와 참조 원문을 함께 보존한다. 백업은 두 서비스 정지→예약/DB 상태 확인→영속 트리의 private snapshot과 같은 시점의 DB 백업 확보→복원 검증 순서다. backup 위치도 비공개0700/파일0600으로 유지한다. 롤백은 서비스 정지 후 검증된 코드와 동일 영속 경로로 재시작하는 방식이다. DB ledger·등록 cutover 상태는 되돌리거나 지우지 않고, legacy 일별 수집을 임의로 다시 켜지 않는다. 다른 호스트 이관 전 receipt·원문 hash와 읽기 전용 status를 확인한다. 실제 보관기간 삭제/DB partition 정리는 별도 설계·검증 전까지 실행하지 않는다.

현재 검증은 로컬 소유 Linux 컨테이너의 unit 정적 검사와 격리 PG의 외부 영속 경로·원문 재사용이다. 실제 원격 systemd에서 부팅/재시작/강제 종료·백업 복원을 검증하기 전에는 원격 배포 완료로 표시하지 않는다. 웹 UI 공개 배포는 이 두 수집 서비스와 별도다.

## 원화 참고 환산용 FX timer

[ADR0058](adr/0058-reference-krw-prices.md)의 ECB 환율은 DB writer/API 키가 없는 별도 oneshot이다. `/var/lib/atlas-collector/fx-store` 전체(claim/receipt/snapshot/raw XML)를 다른 영속 자료와 함께 보관한다. 한 호스트·같은 root의 UTC일 claim이며 다른 호스트 사이의 전역 예산은 아니다. 사용자 웹 프로세스가 이 private 저장본을 읽는 구조로 연결하며 공개 정적 폴더에 원문을 복사하지 않는다. 기본 서비스 사용자는 atlascollector이며 readonly preview를 다른 계정으로 운영할 경우 필요한 읽기 권한/게시 경계를 별도로 설계한다. 수집기만 설치하는 이 예제로 공개 웹 서버를 실행하지 않는다.

`atlas-fx.service`와 `atlas-fx.timer`를 설치·verify한 뒤 `systemctl enable --now atlas-fx.timer`로 UTC00:10 갱신을 예약한다. 환경변수/DB 키는 FX unit에 넣지 않는다. 실패일에는 같은 UTC일 재요청을 하지 않고 이전 검증본의 기준일을 유지한다. claim만 남았으면 운영자가 원문/receipt를 조사하며 claim을 지워 API를 재시도하지 않는다. 실제 remote timer 실행은 별도 서버 검증 대상이다.
