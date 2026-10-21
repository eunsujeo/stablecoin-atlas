# 확장 PostgreSQL 시장 저장 설계
- 목표: Supabase/PostgreSQL과 많은 코인·네트워크·발행 자산·분 단위 자료를 전제로 설계부터 시작한다. 설계·로컬 검증이며 제품 DB/원격 적용이 아니다.
- 변경 파일: docs/adr/0039-postgresql-market-storage-design.md, docs/design/POSTGRESQL_MARKET_STORAGE.md, docs/design/postgresql-market-schema.sql, docs/design/postgresql-market-validation.sql, docs/design/postgresql-market-capacity.sql, docs/design/POSTGRESQL_MARKET_VALIDATION.md, docs/DEVELOPMENT_STATUS.md
- 검증: 격리/새 cluster/network none/no host ports PostgreSQL17.11에서 최종 DDL·부정 제약·RLS/issuer/0/누락/36자리/동일시각 재관측/UTC-DST 시험과 합성129,600관측 용량/EXPLAIN 모두 rc0. 약41.96MB/일(90시계열,43,200요청; 원문·backup 제외). 정확한 값/한계는 docs/design/POSTGRESQL_MARKET_VALIDATION.md. 전체 npm run check 종료 코드/개수는 세션 최종 응답과 .state/agent-logs/postgresql-design-check.log 참조.
- 남은 문제: 실제 Supabase·writer/import·bounded API·registry v2·역할/secret·주기 수집·archive/restore 미구현. 과거 XRPL 관측은 IMPORTED_UNIT/REPORT_FALLBACK이며 실제 요청 복원으로 바꾸지 않는다. CHAIN_TOTAL COIN_NETWORK 매핑과 legacy 근거를 함께 유지한다. 함수/제약 검증이 운영 성능이나 원본 이전 인증은 아니다.
- 다음 행동: 저장 설계와 검증 기록만 먼저 읽고 ADR0039의 다음 DB 구현 단위를 구체화한다. 기존 수집·원본·판정과 AGENTS.md/기존 Router 인계 변경은 보존한다. 원격 접속·삭제·수집 자동화는 설계 승인으로 실행하지 않는다.
- 미회수 Agent/Lead id: 없음. Lead 4344e9ccd8cc45188b6e71bb5d41f661 answered/revise_plan 보완사항을 반영했다. 이번 작업의 로컬 DB 컨테이너는 검사 후 정리한다.
