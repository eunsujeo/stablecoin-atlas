# ADR0110: Market MISS의 검증 SELECT 통합과 최신 요청 조회

상태: 구현 — 2026-10-26

## 배경

사용자 운영 관측은 응답3299ms·쿼리100회/누적2914ms·권한 검증약81ms이며 연결은 재사용됐다. 운영 서버/DB는 이번 작업에서 조회·변경하지 않는다. [ADR0109](0109-web-reader-performance.md)의 풀·5분 성공 캐시는 유지한다.

## 결정

`databaseMarket`의 READ ONLY REPEATABLE READ 안에서만 임시 query facade를 사용한다. 독립적인 고정 검증 SELECT들은 `json_agg` 하위 쿼리들로 한 SELECT에 묶고 기존 검사 코드가 각각의 결과를 원래 순서로 소비한다. SQL·bind는 내부 정의이며 문자열 인자만 기존 bind 위치로 전달한다. role 판정 후 다른 검증, 선택 스키마 존재·버전·구조 확인 후 해당 정책 검사, SET LOCAL의 순서는 유지한다. `safeRole` 내부의 멤버십과 DDL 권한, 개별 스키마의 권한 메타데이터 조회는 각각 한 그룹으로 읽는다.

중복되는 role/권한 검사는 삭제하거나 공유하지 않는다. 결과는 한 그룹당 한 번만 소비하고 호출 종료/오류 때 폐기하며 이전 facade의 조회를 거절한다. 풀 checkout의 production 권한 검사는 그대로다. 기존 writer/collector/독립 읽기는 facade 없이 동일 SELECT를 순차 실행한다. 내부 `batchValidation:false`는 Fixture 대조용이며 HTTP/config/env 선택지로 노출하지 않는다.

그룹은 권한·정책·정적 등록 정보만 읽는다. OID 등 기존 pg 반환형을 대조하고 큰 정수는 기존 text cast를 유지한다. JSON에 안전한 정수 이외의 숫자가 나타나면 실패한다. 금액·이력·공급량과 provenance는 기존 쿼리/문자열 경로로 읽으며 응답 제한·해시·정합성 검사를 유지한다. 그룹별 ORDER BY/LIMIT·빈 배열·null·별칭·SELECT rowCount 의미를 보존한다. 검증 실패는 트랜잭션 rollback으로 이어진다.

최신 요청 health는 기존 `collection_request_latest(definition_id,observed_at DESC,id DESC)` 인덱스를 이용하도록 정의별 LATERAL LIMIT1 후 기존 provider/path/target별 DISTINCT ON을 적용한다. 같은 그룹의 여러 정의 버전도 기존 `(observed_at,id)` 순서로 최종 선택한다. 최신 실패/누락 집계는 유지한다. 새 인덱스·DDL·인프라는 없다.

## 검증과 한계

전체 스키마 Fixture의100회를 검증80·데이터8·세션12로 분류했고, 변경 후64회(44·8·12)다. SQL 실행 계획·50,205건 부하·응답 동등성·정밀도·정책/권한/RLS 변조 거절·버전1~4·동시 snapshot·rollback/세션 폐기를 로컬에서 검증한다. Collector·FX·운영 Mac mini/DB 설정을 변경하지 않는다. 운영 실행 계획과 실제 개선율은 미확인이다. 재현·결과는 [수행 기록](../research/2026-10-26-market-miss-performance.md)을 따른다.
