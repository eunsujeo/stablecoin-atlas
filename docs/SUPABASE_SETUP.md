# 새 Supabase 프로젝트 연결

## 1. 프로젝트와 관리자 접속 준비

Supabase Dashboard에서 새 프로젝트를 생성한다. 이름은 `stablecoin-atlas` 등으로 정하고 서버와 가까운 region을 선택한다. DB 비밀번호는 비밀번호 관리자에 보관하며 채팅/Git/로그에 넣지 않는다. 이 구현은 PostgreSQL17+를 요구한다. SQL Editor에서 `select current_setting('server_version_num');`로 확인하며 더 낮은 버전에서는 초기화를 진행하지 않는다.

Connect에서 접속 URI를 복사한다. IPv6 direct가 사용 가능한 서버는 Direct connection을, IPv4 서버는 Session pooler를 사용한다. Session pooler는5432이며 Transaction pooler6543을 이 설정으로 선택하지 않는다. host는 실제 Connect 값 그대로 사용하며 region으로 추정하지 않는다. [공식 접속 안내](https://supabase.com/docs/guides/database/connecting-to-postgres).

로컬 `.env.local`에 관리자 `DATABASE_URL`을 설정한다. 파일의 다른 설정은 유지한다. URL은 DB 비밀번호를 사용하며 API URL/anon/service_role key가 아니다. 특수문자가 있는 user/password는 URI percent-encoding이 필요하다. 실행 중인 shell의 동일 변수가 파일보다 우선하므로 오래된 설정이 남지 않도록 확인한다.

```dotenv
# 예시 형식일 뿐이며 실제 값은 Connect에서 복사한다.
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=verify-full
DATABASE_CA_FILE=
```

인증서 검증을 끄지 않는다. 별도 CA가 필요한 경우 Dashboard의 Database 설정에서 받은 server root certificate를 Git 외부 로컬 파일에 보관하고 `DATABASE_CA_FILE`에 경로를 지정한다. 이 드라이버는 `sslrootcert` URL query를 허용하지 않으므로 별도 변수로 전달한다. 원격 검증에 실패하면 원인을 확인하고 중단하며 자동 endpoint 전환이나 TLS 완화를 하지 않는다. [공식 SSL 안내](https://supabase.com/docs/guides/database/psql).

## 2. 관리자 초기화와 전용 역할

관리자 접속 설정으로 실행한다. 현재/다음 UTC 월과 이전할 원본의 관측월을 명시 준비한다. 아래 날짜는 이 프로젝트 개발 시점의 예시다.

```sh
npm run market:db:init
npm run market:db:partition -- --month 2026-10
npm run market:db:partition -- --month 2026-11
```

SQL Editor 등 관리자 도구에서 기존 이름과 충돌하지 않는 앱 전용 LOGIN을 만든다. 역할 비밀번호는 별도로 안전하게 설정한다. `postgres`/`anon`/`authenticated`/`service_role`의 멤버십을 부여하지 않는다. [공식 역할 안내](https://supabase.com/docs/guides/database/postgres/roles).

```sql
CREATE ROLE atlas_app_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE atlas_app_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
```

```sh
npm run market:db:grant -- --role atlas_app_writer --access writer
npm run market:db:grant -- --role atlas_app_reader --access reader
```

`atlas_market`는 private schema로 유지하고 Supabase Data API의 exposed schemas에 추가하지 않는다. 애플리케이션의 자동 역할 생성/비밀번호 출력/owner 로그인 뒤 SET ROLE은 구현하지 않는다.

## 3. 수집용 로그인으로 교체하고 확인

`.env.local`의 URI를 writer 전용 비밀번호와 로그인으로 교체한다. direct username은 `atlas_app_writer`, shared Session pooler username은 `atlas_app_writer.PROJECT_REF`이다. 해당 이름은 pooler의 접속 이름이며 실제 DB의 current_user/session_user는 앱 역할이어야 한다. 기본5432 host·DB명·TLS 설정은 Connect의 값을 유지한다. 관리자 비밀번호를 수집기에 남겨두지 않는다.

```sh
npm run market:db:check
npm run market:watch -- --database --max-runs 12
```

`check`는 읽기 전용 transaction에서 PG17+·스키마 hash/정책·실제 로그인·권한·현재 UTC 월의 수량/네트워크 두 파티션을 검사한다. reader 확인은 `--access reader`, 과거 월 확인은 `--month YYYY-MM`을 지정한다. README를 따라 명령을 준비했다는 사실은 실제 원격 연결 성공이 아니다. READY 결과를 확인해야 한다.

새 수집 모드는 매 수집 직전 DB를 검사하며120초 수집이 다음 UTC 월로 넘어갈 가능성도 검사한다. 실제 수집한 정확한 UUID projection과 SHA-256을 연결하여 기존 importer로 보존/저장한다. 설정 누락·권한·스키마·파티션 사전 오류이면 공급자를 호출하지 않는다. 자동 DDL/다음 달 생성은 없으므로 월이 바뀌기 전에 관리자 단계에서 준비한다.

DB 모드의 Ctrl+C는 다음 실행을 막고 진행 중인 수집과 DB 저장/연결 정리를 기다린다. HTTP120초 예산과 DB transaction/접속 예산은 별도이며 전체 종료 시간이120초로 고정되지는 않는다.

현재 JSON 전용 scheduler가 실행 중이면 먼저 Ctrl+C로 정상 종료하고 소유 잠금 정리가 끝난 뒤 `--database` 모드로 시작한다. 시작만으로 기존 이력을 DB에 일괄 이전하지 않는다. 기존 이력은 [DB CLI 안내](POSTGRESQL_MARKET_CLI.md)의 명시적 `import`를 사용한다. 서버에서는 `--archive-dir /실제/영속/비공개/경로`를 지정하거나 기본 archive 위치를 영속 보관한다.

## 4. UI와 실패 복구

`npm run ui`의 시장 화면은 아직 로컬 JSON을 읽는다. DB 저장 시도/완료 시각은 별도 기록으로 표시하므로 새 로컬 관측을 DB 최신값이라고 주장하지 않는다. DB 조회 화면 전환과 원격 공개 배포는 후속 작업이다.

로컬 발행과 DB commit은 하나의 transaction이 아니다. 로컬 JSON 게시 이후 DB 실패가 나면 JSON·projection·시각을 보존하고 scheduler를 중단한다. `database-state.json`의 정확한 sourceName/hash를 확인하고 다음처럼 **이미 저장한 파일만** 명시적으로 import한다. 최신 파일 추측이나 공급자 재수집으로 복구하지 않는다.

```sh
npm run market:db:import -- --source market-store/collected/실제UUID.json
```

IMPORTING이 남았거나 UNCONFIRMED이면 crash/COMMIT 응답 유실로 성공 여부가 불명확할 수 있다. 재import는 원문/매핑/기존 행까지 비교해 중복을 방지한다. 수동 import 성공은 별도 CLI 결과이며 이전 자동 수집 상태 파일을 소급 수정하지 않는다. 확인 후 수동으로 scheduler를 재시작한다. 원격 접속은 운영 환경에서 승인된 native PostgreSQL 경로를 사용하며 관리형 네트워크/proxy 설정은 변경하지 않는다.
