# PostgreSQL 시장 자료 CLI

[ADR0040](adr/0040-postgresql-market-import-and-query.md)의 서버 전용 도구다. PostgreSQL17+에 저장된 시장 자료를 명시적으로 이전·조회한다. 기본 웹 화면과 `market:collect`는 기존 JSON 경로를 사용하고, 웹의 명시적 DB 모드는 reader로 조회한다. 명시 `market:watch --database`로 단발 결과를 자동 import할 수 있다. [Supabase 설정](SUPABASE_SETUP.md)을 따른다. 웹 DB 읽기 API는 [ADR0044](adr/0044-read-only-database-market-preview.md), 실행은 [Supabase 설정](SUPABASE_SETUP.md#4-ui와-실패-복구)을 따른다. 롤업·보관기간 삭제·운영 배포는 아직 없다.

## 환경과 연결

`npm ci` 후 서버의 `.env.local`에 `DATABASE_URL`을 입력한다. 일반 PostgreSQL 접속 URI이며 Supabase REST URL/anon key/service role key를 입력하는 곳이 아니다. shell 환경이 파일보다 우선한다. URL이나 비밀번호를 CLI 인자·Git·로그·채팅에 넣지 않는다.

원격 연결은 항상 인증서를 검증한다. URL query는 `sslmode=require` 또는 `sslmode=verify-full`만 허용하며 둘 다 이 구현에서는 인증서 검증을 수행한다. URL의 TLS 우회/CA/호스트/실행 옵션은 거부한다. 별도 신뢰 CA가 필요하면 `DATABASE_CA_FILE`에 로컬 일반 PEM 파일 경로를 지정한다. CA 파일은1MiB 이내이며 symlink는 거부한다. URI는 driver에 분해 전달하여 URL 옵션이 SSL 설정을 덮어쓰지 못하게 한다.

프로그램이 생성한 loopback DB의 저장/복구 검사 외에 실제 Supabase PostgreSQL17.11의 인증서 검증 TLS·session pooler 접속·초기화·역할/파티션 READY 점검을 확인했다. 실제 원격 데이터18파일 이전·전체 재import의 UNCHANGED·원본/시각 보존·DB 모드의 실제 공급자 수집 저장도 확인했다. 부하·장애 복구·원격 운영 자동 재시작은 아직 미검증이다. pg는 native PostgreSQL 프로토콜이며 HTTP proxy 지원을 뜻하지 않는다. 관리형 네트워크 설정은 변경하지 않으며 승인된 원격 서버의 연결 경로는 해당 운영 환경에서 별도로 확인한다. endpoint 재시도/전환이나 TLS 검증 완화는 없다.

지속 서버에서는 direct/session 연결을 우선 검토한다. pooler는 실제 `current_user=session_user`와 앱 역할·TLS·PostgreSQL17+ 조건을 만족하는지 먼저 확인한다. 관리자 로그인 뒤 SET ROLE로 앱을 흉내 내는 연결은 거부한다.

## 읽기 전용 접속 점검

전용 writer URI로 `npm run market:db:check`를 실행한다. READY는 현재 UTC 월의 두 파티션·스키마/정책·로그인/권한을 읽기 전용으로 확인한 결과다. reader는 `--access reader`, 특정 월은 `--month YYYY-MM`을 지정한다. 관리자 계정은 이 런타임 점검에서 거부한다. 관리자 초기화에는 아래 별도 명령을 사용한다.

## 관리자 단계

관리자 URI는 아래 세 종류 명령에서만 사용한다. 이후에는 전용 앱 로그인 URI로 바꾼다. schema는 `atlas_market`이며 Supabase의 공개 Data API schema에 추가하지 않는다.

```sh
npm run market:db:init
npm run market:db:partition -- --month 2026-10
```

`init`은 migration 버전/hash와 catalog 구조 fingerprint를 기록한다. 이미 같은 schema면 검증 후 UNCHANGED이며, 다른 schema/수정된 migration/구조/정책은 거부한다. 기존 schema를 자동 삭제/수정하거나 설계용 `atlas_market_design`을 재사용하지 않는다. SQL 파일은 LF 바이트를 유지한다.

`partition`은 한 번에 UTC 한 달만 준비한다(2020-01~2100-12). 부모·정확한 경계·RLS를 검사하고 자식에 직접 권한을 주지 않는다. import가 월 파티션을 자동 생성하지 않으므로 자료의 원본 관측월을 먼저 준비한다. 다음 달 준비도 명시 실행이다.

서버에 전용 LOGIN 역할을 별도로 준비한다. 예를 들어 관리자 도구에서 다음 역할을 만들고 비밀번호는 별도로 안전하게 설정한다. 이 CLI는 역할이나 비밀번호를 생성/출력하지 않는다.

```sql
CREATE ROLE atlas_app_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE atlas_app_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
```

```sh
npm run market:db:grant -- --role atlas_app_writer --access writer
npm run market:db:grant -- --role atlas_app_reader --access reader
```

대상은 소문자/숫자/underscore의 기존 역할이다. owner·superuser·BYPASSRLS·관리자 역할 멤버십/SET ROLE 경로·DB/schema CREATE 권한·공용 Supabase/pg 역할은 거부한다. reader는 부모 테이블 SELECT만, writer는 필요한 INSERT·sequence USAGE와 run 종료/cache 포인터의 제한된 컬럼 UPDATE만 받는다. fact/정의 UPDATE·DELETE·자식 파티션 권한은 없다. 역할별 정책과 실제 유효 권한을 검사하며 수동으로 넓힌 권한이 있으면 멈춘다.

등록된 역할의 access 종류를 같은 이름으로 바꾸는 명령은 제공하지 않는다. 역할/정책/정의의 불변성은 migration 또는 명시적 운영 변경으로 검토해야 한다. 일반 import/read는 관리자·owner 접속을 거부하고, RLS를 실제 적용받는 로그인 역할을 요구한다.

## 오프라인 이전 계획과 실제 이전

입력은 다음5개 연구 원본과 명시적으로 선택한 `market-store/collected/<uuid>.json` projection뿐이다.

- arkham-api-smoke.json
- arkham-market-additional.json
- arkham-chain-supply-research.json
- arkham-additional-data-research.json
- xrpl-gateway-obligations-readonly.json

```sh
npm run market:db:plan -- --source arkham-api-smoke.json --source xrpl-gateway-obligations-readonly.json
```

`plan`은 DB 설정을 읽거나 DB/공급자/체인에 접속하지 않는다. 원본을 읽어 저장할 행 수와 매핑하지 않은 근거 단위 수만 출력한다. 다른 PC의 파일은 `--reports-dir`와 `--registry`로 지정한다. 파일명/경로·일반 파일·크기·JSON·지표·민감 필드를 검증하고 symlink를 거부한다. 한번에 최대12파일/파일당2MiB/수량+네트워크 관측 합계5000개다. 전체 DB 이력의 한도가 아니라 단일 이전 배치의 한도다. 입력 상한은 처리량 보장이 아니며 원격 지연/대량 bulk 성능은 미검증이므로 작은 배치부터 검증한다.

전용 writer URI를 서버 환경에 준비한 뒤:

```sh
npm run market:db:import -- --source arkham-api-smoke.json --source arkham-market-additional.json --source arkham-chain-supply-research.json --source arkham-additional-data-research.json --source xrpl-gateway-obligations-readonly.json
```

collected 자료는 실제 존재하는 uuid 파일을 `--source market-store/collected/실제UUID.json`으로 추가한다. 경로를 자동 열거/수집하거나 없는 자료를 외부 API에서 채우지 않는다.

기본 archive는 `.state/market-db-artifacts`이며 `--archive-dir`로 서버의 별도 영속 디렉터리를 지정할 수 있다. 원본 바이트와 로컬 매핑 근거(IMPORT_BINDING)를0600 파일/0700 디렉터리에 내용 hash로 보존한 뒤 DB에 metadata를 commit한다. DB에는 원문 blob을 넣지 않는다. 동일 hash 파일의 길이/바이트·기존 metadata가 다르면 중단한다. archive root를 웹 경로나 Git에 넣지 않는다. 기존14원본 이동 파일에 DB/archive/collected 전체가 추가된 것은 아니다.

동시 파일 보존은 완성된 임시 파일을 원자적으로 연결하고 파일/디렉터리를 flush한다. DB 초기화/관리/이전은 advisory transaction lock으로 직렬화하며 lock timeout 뒤 자동 재시도하지 않는다. 같은 pg client의 겹치는 transaction은 거부한다. DB rollback/중단 뒤 참조되지 않은 archive가 남을 수 있으며 자동 삭제하지 않는다.

한 배치의 DB 이전은 하나의 transaction이다. 같은 input 재이전은 원본 위치·관측·수량·시각·scope·legacy 연결·요청/원장·행 수까지 비교한 뒤 UNCHANGED로 처리한다. 같은 key의 다른 내용은 전체 배치를 rollback한다. 같은 값의 새 관측이나 같은 시각의 서로 다른 배열 위치는 보존한다. 내용이 같은 두 파일에 별도 실행 식별자가 없다면 실제 별개 HTTP 실행이었다고 추정하지 않는다. IMPORT 성공은 이전 transaction의 성공이며 온체인 검증 PASS나 모든 공급자 요청 성공이 아니다.

CHAIN_TOTAL은 COIN_NETWORK에 연결하되 기존 deployment/id/groupId/selector/sourceHash는 legacy bridge에 보존한다. XRPL은 원래 issuer/currency·ledger hash/index·REPORT_FALLBACK과 IMPORTED_UNIT/RECORDED를 유지하며 HTTP 성공으로 바꾸지 않는다. networkBinding의 과거 보고 상태도 요청 shape에 보존하고 명시된 mainnet 조건과 registry가 충돌하면 거부한다. 입력 artifact가 projection이면 연구 원본/원격 응답 원본으로 승격하지 않는다.

## 제한된 조회

reader 또는 writer URI를 사용한다. 모든 수량/numeric·요청 bigint ID는 JSON 문자열이며, 미확보는 NULL이다. 실패한 요청이 마지막 정상값을 지우거나 과거 import가 최신 시각을 되돌리지 않는다.

```sh
npm run market:db:series -- --coin usdc --limit 100
npm run market:db:latest -- --coin usdc --limit 100
npm run market:db:history -- --series 1 --from 2026-10-21T00:00:00Z --to 2026-10-23T00:00:00Z --limit 1200
npm run market:db:networks -- --provider ARKHAM --limit 100
npm run market:db:network-history -- --network ethereum --provider ARKHAM --from 2026-10-21T00:00:00Z --to 2026-10-23T00:00:00Z
```

series ID는 목록 결과에서 고른다. 목록/최신값은 최대200행이며 `next`를 `--after`로 전달한다. history는 단일 series, network-history는 단일 network/provider만 조회한다. 최대31일/1200점이며 `next`는 동일 조건의 `--cursor`로 전달한다. 서로 다른 series/기간/provider cursor는 거부한다. 모든 응답은512KiB 이내이며 초과하면 더 작은 limit으로 명시 재조회한다.

관측키는 PostgreSQL의 마이크로초를 보존하며 `(observed_at, request_id)`로 정렬한다. request_id는 결정적 tie-break일 뿐 공급자의 정정 순서 인증이 아니다. 현재 원본의 공급자 `source_at`에는7~9자리 소수가 있어서 원래 문자열을 추가 보존한다. DB 보조 timestamp는6자리로 절삭하고 조회 응답은 원래 문자열을 우선한다. 자료 시각을 수입 시각으로 대체하지 않는다. 관측키 자체가 마이크로초보다 세밀한 입력은 현재 거부하며 자동 반올림하지 않는다.

latest의 각 값은 독립 시계열이다. 최신 요청 상태/시각·명시적 필드 상태를 정상값의 원래 시각과 구분한다. CHAIN_TOTAL 목록을 서로 다른 request에서 합쳐 같은 시점 순위로 만들지 않는다. REPORTED_VOLUME의 UNKNOWN/UNCONFIRMED·obligations의 별도 범위는 유지한다. network의 active는 공급자 보고이며 실제 원장 건강 인증이 아니다.

## 검증과 현재 한계

```sh
npm run check
npm run check:db
```

기본 check에는 순수 모델·파일/설정 경계 시험을 포함한다. check:db는 별도 실제 PostgreSQL 시험이며 Docker28+와 캐시된 postgres:17-alpine 이미지가 필요하다. 이미지를 자동 다운로드하지 않는다. 실행별 새 cluster·폐기 비밀번호·tmpfs·단독 NAT bridge·127.0.0.1 임의 포트를 만들고 소유 label/단독 peer/포트 바인딩을 확인한다. PostgreSQL 외부 공급자 호출은 없으며 HTTP proxy 설정을 바꾸지 않는다. network none인 설계 DDL 시험과 달리, 실제 Node pg 접속 시험을 위해 loopback publish를 사용한다. Docker의 native client/daemon 설정을 우회하지 않는다.

실제 비관리자 로그인으로 정확한 수량·0/누락·micro/nanosecond·과거/동일 시각 입력·중복·동시 이전·충돌 rollback·RLS/권한·원장 필수·최신 성공값·bounded cursor를 검사했다. 별도 로컬 검증에서는 저장된5원본+1collected의30관측/네트워크6행을 이전하고 기존30 legacy 연결과 재이전·원본 바이트 불변을 확인했다. 해당 fixture DB는 정리했고 private archive만 보존했다. Supabase나 물리적으로 다른 서버에서 실행한 검증은 아니다.

DB schema는 복수 deployment를 허용하지만 현재 input registry v1의256개·coin/network당1개 제약은 유지한다. registry v2, 24시리즈를 넘는 웹 선택/페이지 조회, 시간/일 집계, archive 복구·보관기간 정리·운영 배포는 후속이다. 수집기 DB 연결과 명시적 reader 웹 조회는 구현했다. `DATABASE_URL`을 입력하거나 웹을 시작하는 것만으로 DB 초기화·이전·외부 수집이 실행되지 않는다.

기술 근거: [node-postgres 쿼리](https://node-postgres.com/features/queries), [transaction](https://node-postgres.com/features/transactions), [TLS](https://node-postgres.com/features/ssl), [Docker loopback publish](https://docs.docker.com/engine/network/port-publishing/).

## 토큰·네트워크 기본정보

[ADR0045](adr/0045-token-profile-catalog-and-popovers.md)의 별도 private catalog를 명시적으로 관리한다. 현재 데이터의 식별자·표준·출처는 `data/token-profiles.json`에서 검토한다. 설치 전에 기존 market schema/배포 등록이 있어야 한다.

```sh
npm run market:catalog:init -- --env-file .state/market-db-secrets/admin.env
npm run market:catalog:import -- --env-file .state/market-db-secrets/admin.env
npm run market:catalog:grant -- --env-file .state/market-db-secrets/admin.env --role atlas_app_reader
```

env 파일은 비공개 관리자 설정이며 이름은 이 PC의 예시다. 서버별 실제 안전한 reader role을 지정한다. `import --file`로 다른 검토 JSON도 지정할 수 있으나 고정 registry/공식 URL/동일 revision 충돌 검사를 통과해야 한다. 새 설명은 revision을 올려 저장하며 과거 버전은 보존한다. reader/collector가 자동으로 변경하지 않는다. `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`에서 DB 프로필을 읽어 정보 툴팁을 제공한다.

## 과거 일별 유통량

[ADR0046](adr/0046-daily-network-circulation-history.md)의 별도 private schema다. 관리자 환경은 기존 writer 환경과 분리한다.

```sh
npm run market:history:init -- --env-file .state/market-db-secrets/admin.env
npm run market:history:grant -- --env-file .state/market-db-secrets/admin.env --role atlas_app_reader
npm run market:history:collect -- --env-file .state/market-db-secrets/admin.env --archive-dir .state/supply-history-artifacts
```

collect는 무료 공개 DeFiLlama 고정3개 endpoint를 한 번씩 읽는다. 키/자동 반복/재시도/공급자 전환은 없다. 원문은32MiB/30초/깊이32, UI는 기존 읽기 전용이며 수집을 실행하지 않는다. 부분 응답 실패는 DB 최신 snapshot을 바꾸지 않는다. 현재 작업은 이미 다운로드한 자료를 재사용했으므로 위 collect를 추가 실행할 필요가 없다.

오프라인 import는 `market:history:import -- --env-file <관리자파일> --manifest <비공개디렉터리>/manifest.json --archive-dir <비공개아카이브>`로 수행한다. manifest는 `{"schemaVersion":1,"sources":[{"coinId":"rlusd","fetchedAt":"2026-10-22T04:50:00.000Z"}]}` 형태이고 같은 디렉터리의 고정 `<coinId>.json` 원문을 읽는다. 실제 다운로드 완료시각을 보존한다. DTO 파일을 원문 대신 제출하거나 수량을 Number로 다시 직렬화하지 않는다. 동일 원문/기간은 unchanged, 원문 변경은 이전 snapshot을 유지하며 새 snapshot으로 추가한다.

조회 응답의 supplyHistory는 NETWORK_CIRCULATING/DEFILLAMA를 별도 제공한다. market.observation/series_latest에 합치지 않으며 XRPL obligations와도 다르다. 주기 갱신은 이번에 추가하지 않았다.

### 일별 발행량과 v2

[ADR0047](adr/0047-daily-minted-and-relative-comparison.md)에 따라 신규 init은 v2까지 설치한다. 기존 v1 설치는 다음 명시 관리 명령으로 업그레이드한다.

```sh
npm run market:history:upgrade -- --env-file .state/market-db-secrets/admin.env
```

v1 SQL과 기존 유통량 payload는 보존한다. collect/import는 같은3개 원문에서 유통량·발행량을 별도 metric으로 저장하므로 호출 수는 여전히 최대3회다. v2가 아니면 import는 HISTORY_UPGRADE_REQUIRED다. 기존 manifest 재사용은 외부 요청0회이며 이번 PC에는 이미 적용했다. supplyHistory는 최대6개 coin/metric snapshot, 전체16개 네트워크 시계열이다. 자동 일별 실행 일정은 추가하지 않았다.
