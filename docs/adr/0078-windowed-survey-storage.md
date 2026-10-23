# ADR0078 — 날짜별 7일 snapshot 저장·조회

## 승인과 범위

2026-10-23 사용자가 [ADR0077](0077-offline-live-survey-storage.md) 완료 뒤 다음 진행을 요청했다. 이번 단위는 고정 조사 이후 날짜가 바뀌어도 같은 11배포의 검토 원문을 저장·조회할 수 있는 기간 지원이다. 코드·새 소유 PG17 Fixture·기존 개발용 비공개 DB의 비파괴 명시 upgrade와 로컬 표시를 포함한다. 새 공급자 호출·usage·키·승인 재소비·반복 수집·스케줄·기본 공급자 전환은 포함하지 않는다. 실제 비용/조직 미확인과 예산 전환 차단은 유지한다.

## v1 보존과 날짜별 근거

기존 2026-10-16~22의 v1 SQL/DTO/mapper/source ID와4개 source를 보존한다. 기존 날짜는 계속 v1으로 검증하고 v2로 다시 쓰지 않는다. 다른 날짜의 live 입력은 `allium-stored-survey-window-v2`와 schemaVersion2 snapshot을 사용한다. legacy 수동 조사 manifest를 새 날짜의 근거로 재해석하지 않는다.

등록 자료는 기존 고정 plan hash로 pin한다. 명시한 UTC 실행일 D마다 같은 주소/identity·등록 버전으로 SQL과 `[D-7,D)`를 생성하고, 해당 날짜의 plan/SQL·원래 authorization/approval·UNKNOWN receipt·개별 검토 hash·실행시각을 대조한다. 원래 관측 시각과 나중의 import 시각을 구분하며, 현재 실행 lease나 새 API 키는 요구하지 않는다. 근거 없는 새 날짜·변조·범위 밖 행은 거부한다. 연도/월/윤일의 달력 연산을 지원하지만 공급자 집계 시간대·최종성·과금 reset/DST를 확인한 것은 아니다.

## 명시 upgrade와 구조 검증

`db/survey/002-windowed-snapshots.sql`은 기존 schema_version의 version1행과 source 행을 수정하지 않는다. version 제약과 source mapper/기간 CHECK만 확장하고 version2행을 추가한다. 기존 v1 기간은 계속 고정하며 v2는7일 창만 허용한다. RLS·역할·권한·trigger·source ID·이전 원문은 유지한다. 새 grant나 테이블을 추가하지 않는다.

`upgrade`는 현재 소유자와 기존 v1 구조·보안을 확인하고 같은 advisory lock·단일 transaction에서만 실행한다. 새 구조는 배포 DB에서 관측한 해시를 정답으로 채택하지 않는다. **새 소유 PG17에서 정본001/002 DDL로 생성한 v1/v2 예상 구조 hash를 코드에 고정**하고 실제 구조와 대조한다. version1의 과거 구조 hash도 그대로 검증한다. 예상 밖 DDL과 owner가 저장 hash만 바꾼 상태는 거부한다. 실패는 rollback하고 재실행은 UNCHANGED이며, init/import/read가 자동 upgrade하지 않는다. v1 DB의 기존 읽기·입력은 계속 지원하고 새 기간 입력은 명시 upgrade 전 거부한다.

## 기간 선택과 표시

`read --day D`는 그 기간만 읽는다. 인자가 없으면 저장된 가장 최신 **window**를 선택하고, 그 창 안에서 종류별 원래 queried_at이 가장 늦은 whole snapshot을 읽는다. 새 기간에 공급량만 있으면 전송량을 이전 기간에서 가져오지 않는다. 빈 기간과 행 누락도 그대로 표시한다. 늦게 입력한 과거 자료가 최신 창을 바꾸지 않는다.

v2 envelope는 선택 window를 명시하며 snapshot의 기간 혼합을 거부한다. 기존 v1 기본 응답은 그대로 유지한다. 브라우저의 기간 문구와11×7일 칸은 선택 window로 생성한다. 누락 kind는 같은 기간77칸 모두 MISSING이며 null/0·INCONCLUSIVE를 구분한다. HTTP는 기존 고정 `/survey-data.json` 읽기만 제공하고 URL 명령·수집·파일 생성은 추가하지 않는다. 과거 기간 선택은 이번에는 CLI에서 제공한다.

## 검증과 적용

source/HTTP 검사는 날짜별 근거·변조·v1 고정·기간 혼합·빈 kind·월/연도/윤일을 확인한다. PG17은 실패 rollback·read/import와 upgrade 경합·재실행·원래4행/version1 보존·최소 권한·고정 구조 pin·복수 기간/최신 선택·원문 재입력/시각 충돌을 검증한다. 가상 새 날짜 원문은 Fixture와 브라우저 검증에서만 쓰며 실제 DB에 입력하지 않는다.

검사 통과 후 기존 개발 DB의 대상/소유·전후4source/version1·6개 다른 schema/보안·137개 실제 최신 관측을 대조하며 명시 upgrade한다. 실제 원문/관측은 새로 만들지 않는다. 로컬 읽기 서버는 새 verifier를 쓰도록 재시작한다. 실행 명령·rc·검사 수·실제 적용/브라우저 결과는 이번 인계문을 따른다.

Lead `348fe2aafd034766afe761f9f07c33cf`의 proceed 조건을 반영했다. 이 검토는 새로운 유료 실행·운영 수집·스케줄 승인의 대체가 아니다.
