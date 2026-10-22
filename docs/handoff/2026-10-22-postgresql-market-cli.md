# PostgreSQL 시장 저장·이전·조회 CLI
- 목표: ADR0039 다음 단계인 서버 DB 저장/조회와 명시적 이전 CLI를 구현한다. 원격 Supabase·자동 수집·웹 DB 전환·배포는 이번 작업에서 실행하지 않는다.
- 변경 파일: db/market/001-initial.sql, tools/market-db/*.mjs, tests/market-db-model.test.mjs, tests/postgres/*.mjs, package.json, package-lock.json, tools/workspace-env.mjs, .env.example, .gitattributes, docs/adr/0040-postgresql-market-import-and-query.md, docs/POSTGRESQL_MARKET_CLI.md, docs/DEVELOPMENT_STATUS.md, docs/NEW_PC_SETUP.md
- 검증: 모델4개·소유 PostgreSQL 실접속 통합9개 통과(원래 실제 로그인/RLS/금액·상태·동시성·rollback·cursor). 별도 실제 저장5원본+1collected의30관측/네트워크6행을 로컬 fixture에 이전하고30 legacy 연결·재이전6개 UNCHANGED·원본 바이트 불변·공급자 nanosecond 원문 보존 확인. 원격 DB/공급자/체인 RPC 호출0. 최종 npm run check 종료 코드/개수는 세션 최종 응답 및 .state/agent-logs/postgresql-cli-check.log 참조.
- 남은 문제: 실제 Supabase 접속/TLS/pooler/서버 경로 미검증. registry v2·bounded 웹 API/화면 전환·수집기 DB 연결·롤업·archive restore/보관기간·배포는 후속이다. 현재 화면/collector는 JSON 경로다. 관리자 URI로 일반 import/read하지 않는다. 원본/비밀/URL을 Git/웹에 올리지 않는다.
- 다음 행동: docs/POSTGRESQL_MARKET_CLI.md부터 읽고 Supabase의 전용 역할·서버 환경을 준비한다. 명시적 init/partition/grant 후 전용 writer import와 reader 조회를 수행하는 단계다. 원격 적용은 실제 대상/접속 경로 확보 후 진행한다. 기존 AGENTS.md와 Router 인계/README 변경은 보존했다.
- 미회수 Agent/Lead id: 없음. 094499cd989e493ab78745fc251325b0 answered/proceed 조건 반영. 임시 DB/전용 network는 시험 종료 시 소유 label 확인 후 정리하며 실제 원본의 검증용 archive는 .state/market-db-real-import-artifacts에 비공개 보존한다.
