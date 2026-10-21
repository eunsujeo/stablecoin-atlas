# ADR0039: 확장 가능한 PostgreSQL 시장 저장 설계

상태: 설계 초안, 2026-10-22. 사용자가 원격 서버와 Supabase/PostgreSQL, 향후 다수 스테이블코인·네트워크 수집을 전제로 설계 시작을 요청했다. 이번 승인은 설계와 로컬 격리 검증이며 원격 DB 접속/이전·자동 수집·원본 삭제·배포 승인이 아니다.

## 결정

고정 coin/network 조합과 전체 JSON snapshot을 확장 저장의 기본 단위로 쓰지 않는다. 정수 ID의 registry·범위/지표/공급자별 series·공통 요청 근거·좁은 관측 fact·성공 최신값·시간/일 집계를 분리한다. 원본/projection의 비공개 artifact와 legacy ID 연결을 보존한다. 동일 coin/network의 복수 deployment를 허용하고 COIN/COIN_NETWORK/DEPLOYMENT 범위를 구분한다.

정확한 numeric과 십진 문자열, 값/실패/미확보 구분, 재관측과 재import 멱등성, 시각/원장/출처 보존을 우선한다. fact는 UTC 월 파티션과 시계열/시각 PK를 사용하며 추가 인덱스·보관기간·수집 주기는 실제 규모/용량 측정 후 정한다. 무료 DB 용량 안에서 무제한1분 이력을 보장하지 않는다.

정본 설계와 검토용 SQL은 [저장 설계](../design/POSTGRESQL_MARKET_STORAGE.md), [후보 DDL](../design/postgresql-market-schema.sql)에 있다. 실제 제품 DB나 migration이 아니며 앱 동작을 변경하지 않는다. 시장 DB는 기존 호환성 검증 판정/원본 보고서 저장과 별개다.

## 유지하는 경계와 후속 조건

현재 수집/발행은 [ADR0037](0037-manual-market-collector.md), 지표 의미는 [ADR0038](0038-overview-scenario-results.md), 호환성 검토 범위는 [ADR0026](0026-source-based-compatibility-scope.md)을 유지한다. registry v2·bounded 조회 API·DB writer/import·역할/secret·원본 보관/복구·주기 수집은 설계의 후속 구현이다. 외부 체인 쓰기·새 Adapter/SDK·전체 보유자 수집은 포함하지 않는다.
