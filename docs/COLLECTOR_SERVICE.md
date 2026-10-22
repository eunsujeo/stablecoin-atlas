# 주기 수집 운영

서버 CLI가 DB 예약을 확보한 뒤 Arkham을5분 간격, DeFiLlama를 UTC 날짜마다1회 수집한다. 브라우저와 웹 서버 시작은 공급자 API를 호출하지 않는다. 기존 `market:watch`와 새 worker를 함께 실행하지 않는다.

기본 Arkham 예산은 UTC 하루288회(최대2016 GET)다. 24시간 동안5분마다 현재 구간을 수집한다. 실패·중단 예약도 횟수에 포함하며 재시작해도 초기화하지 않는다. DeFiLlama는 하루3 GET로3자산의 두 지표를 함께 가져온다. 이는 앱의 상한이며 공급자 계정 크레딧 보증은 아니다.

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

기본 receipt `.state/collector-state`와 원문 `.state/collector-archive`는 private 영속 디렉터리다. `--state-dir`, `--archive-dir`로 경로를 지정할 수 있다. 서비스 재시작·재배포에도 동일 디렉터리와 동일 DB를 사용한다. 원문은 SHA-256 경로에 gzip으로 압축하되 해제한 원본 바이트/hash를 검증한다. Arkham은 검토된 projection만 보관하고 holder 목록은 저장하지 않는다.

예약은 API 요청 전에 확정한다. 응답을 모두 검증한 뒤 원문/receipt를 fsync하고 DB import를 실행한다. COMMIT 응답 유실은 receipt로 import만 재개한다. receipt 없는 CLAIMED는 UNCONFIRMED로 종료하고 같은 슬롯을 다시 조회하지 않는다. 실패는 기존 정상값을 유지하며 같은 슬롯 재시도·공급자 전환을 하지 않는다. 새 예정 구간은 별도 관측이며 예산을 소비한다. 종료되지 않은 복구가 있으면 새 조회를 진행하지 않는다. receipt/원문은 정상 복구 전 삭제하지 않는다.

## Linux 서버

[systemd 예제](../deploy/atlas-collector.service)는 repo `/opt/multi-chain-asset-compatibility`, 전용 사용자 `atlascollector`, 설정 `/etc/atlas-collector/writer.env`를 전제로 한다. 경로/Node 실행 위치를 서버에 맞춰 검토한다. `/etc/atlas-collector`는0700, 설정/CA는 해당 사용자만 읽도록 배치한다. `reports/market-store`는 해당 사용자가 쓸 수 있어야 하고 UI 사용자는 필요한 파일을 읽을 수 있어야 한다. 원문과 설정은 웹 공개 경로에 두지 않는다.

서비스는 `/var/lib/atlas-collector`를 영속 보관하며 실패 재시작도 기존 DB 예약을 사용한다. 로컬 worker가 같은 DB를 사용 중이면 먼저 종료한다. 서비스 파일을 `/etc/systemd/system`에 설치하고 daemon-reload, enable --now 후 journal/status와 collector:status를 확인한다. 변경된 코드의 npm run check와 npm run check:db를 먼저 완료한다. 이 파일의 추가는 원격 서버 배포 완료를 뜻하지 않는다.
