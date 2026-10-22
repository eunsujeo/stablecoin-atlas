# ADR0042: Supabase 접속 점검과 수집 결과 DB 저장

상태: 채택. 사용자 Supabase 진행·새 프로젝트 선택, 2026-10-22.

## 결정

서버의 기존 PostgreSQL driver/전용 로그인/TLS를 사용한다. Supabase JS SDK·브라우저 DB 자격증명·Data API 노출은 추가하지 않는다. 연결 방식은 [설정 안내](../SUPABASE_SETUP.md)의 공식 출처를 따른다. 실 프로젝트 설정 전 원격 성공은 NOT_TESTED다.

`market:db:check`는 읽기 전용으로 PG17+·현재 역할·스키마/정책/권한·명시 월의 두 파티션을 점검한다. `market:watch --database`는 매 수집 전 현재와120초 후 UTC 월을 확인하고, 실제 projection의 최소/최대 관측월도 import 전에 검사한다. 기존 importer는 transaction 안에서 권한/스키마를 다시 검증하며 파티션 누락은 DB 제약으로 rollback한다. 중간 월을 건너뛴 이력 일괄 이전은 기존 명시 import 경로이며 scheduler 입력은 해당 단발 수집만이다.

collector 성공 결과에 정확한 UUID projection filename/hash를 반환한다. 최신 파일 열거 없이 해당 한 건만 읽고 바이트 hash 일치를 확인하여 기존 importer로 보존한다. 로컬 JSON 게시와 DB commit은 분리되어 있다. 사전 오류는 API0회·DB FAILED이며, 게시 후 실패는 로컬 자료를 유지한다. import 시도 이후 예외는 보수적으로 UNCONFIRMED로 기록한다. crash 뒤 IMPORTING 역시 완료 미확인이다. 자동 재수집/재시도/rollback 성공 단정은 하지 않으며 명시 재import로 멱등 복구한다.

기존 scheduler의 배타 잠금·300초 시작 간격·실행 상한·실패 중단·signal drain을 유지한다. DB 저장 시간까지 한 실행에 포함되어 겹침/밀린 실행을 하지 않는다. DB 새월 생성·역할 생성·운영 secret 입력·자동 재시작은 하지 않는다. 기존 JSON 모드는 그대로 선택 가능하다.

## 검증

모델 검사에서 명시 옵션/예산/UTC 월·접속 실패 시 공급자0회·안전한 상태만 검증한다. 새 소유 loopback PostgreSQL fixture에서 실제 RLS writer/reader/owner 구분·두 월 파티션 사전 검사·정확한 원문 hash/저장·재import 중복 방지·발행 후 schema drift 보존·성공 COMMIT 응답 유실의 UNCONFIRMED와 재import 복구를 검사한다. 기존 DB rollback/권한/동시성 검사를 유지하고 전체 `npm run check`를 실행한다. 실 Supabase와 pooler/TLS 네트워크는 자격증명 설정 후 별도 확인한다.
