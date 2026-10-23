# ADR0067 — 고정 Allium 다중 체인 조사의 오프라인 저장과 화면

## 승인과 범위

2026-10-23 사용자는 확보한 공급량70행·전송량67행의 DB 입력·화면 연결·누락 보존·검증·커밋/push 진행을 승인했다. [조사 결과](../research/allium-samples/survey-2026-10-23.md)의 고정11배포·10/16~22만 연결한다. 새 공급자 조회, SQL 실행, 자동 수집, 기본 공급자 전환은 포함하지 않는다. ADR0065/0066의 단발 예약·원래 UNKNOWN·비공개 원문은 그대로 보존한다.

## 저장과 무결성

기존 Ethereum 전용 atlas_supply/atlas_activity와 원본 표본을 유지하고 별도 private `atlas_survey` v1을 추가한다. source 한 행이 한 종류의 전체 검토 snapshot이며 일별 행을 서로 다른 응답에서 합치지 않는다. 고정 plan hash와 등록 식별자, 명시적 원문/SQL-review manifest hash, manifest가 가리킨 원래 UNKNOWN receipt hash와 해당 result hash를 연결하고 `alliumSurveyResult`로 재검증한다. 종류·mapper·plan·원문·review·receipt·원래 시각/기간·선별 projection hash를 source ID로 묶는다. SQL·run/query ID·계정 정보는 DB payload에 포함하지 않는다.

원문·manifest·기존 receipt 바이트는 전용700 디렉터리/600 파일의 hash archive에 보존한다. archive 확인은 replay 때도 실행한다. 입력은 공통 advisory transaction lock 아래 원자적 INSERT하며 같은 ID는 추가0, 같은 종류/plan/원래 시각의 다른 snapshot은 거부한다. snapshot 불변 trigger, FORCE RLS, writer INSERT/reader SELECT, 구조·정책·ACL·역할 검사와 기존 Data API 경계 검사를 적용한다. 경계 검사 namespace는 atlas_supply/atlas_survey만 허용하며 기본값과 기존 검사는 유지한다. Dashboard exposed schemas는 UNKNOWN이다. 기존 Vault 개별 source review는 해당 함수/namespace hash가 그대로일 때만 재사용한다.

## 읽기와 표시

고정 plan/기간의 종류별 최신 whole snapshot을 원래 queried_at으로 선택하고 read-only repeatable-read transaction에서 ID·projection·구조·상한을 재검증한다. 날짜가 없는 최신 응답을 이전 값으로 채우지 않는다. `/survey-data.json`은 정확한 경로의 로컬 GET/HEAD만 허용하며128KiB 상한·단일 진행 조회·성공/실패10초 cache를 적용한다. 서버 시작/웹 요청은 DB 읽기만 수행한다. JSON 모드는404 미연결이다.

Overview의 별도 저장 조사 표는 종류/토큰/네트워크 필터와11×7 날짜 grid, 공급량6필드/전송량5필드, 정확한 십진 문자열·null·0·원래 시각/hash·네트워크 식별을 표시한다. 공급자 미일치1행은 해당 배포 전체 기간의 INCONCLUSIVE 근거이며 관측된7행으로 세지 않는다. JPYSC 날짜 누락은 MISSING, XRPL2개는 NOT_TESTED다. 실패 시 현재 화면의 마지막 정상 자료를 유지하고 초기 실패/미연결/미확보를 구분한다. 기존 차트·Ethereum 활동표·과거 표본은 별도로 유지한다.

## 검증 기준

Lead `fdde8fc37949449d9fd9e319053e43f1`의 proceed 조건을 반영한다. 원문/manifest/receipt/plan 변조·정확 문자열·null/0·누락, replay/경합/동일시각충돌/구시각·원자 rollback·권한/trigger/구조 변조·읽기 전용 HTTP/cache·실제 DB 원문 대조와 브라우저 두 테마/모바일·실패 복구를 검증한다. 실제 실행 결과는 이번 인계문에 기록한다.
