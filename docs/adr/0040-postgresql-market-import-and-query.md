# ADR0040: PostgreSQL 시장 자료 이전·저장·조회 CLI

상태: 채택, 2026-10-22. 사용자가 ADR0039 다음 단계인 DB 저장·조회 코드와 명시적 이전 CLI 진행을 승인했다. 이번 단계는 PostgreSQL repository·명시적 schema 초기화/월 파티션/역할 권한 명령·저장된 원본의 이전·bounded 조회와 로컬 소유 격리 DB 검증이다. 실제 원격 Supabase에는 접속하지 않으며 자동 수집·공급자 추가·자료 삭제·웹의 DB 전환·공개 배포는 수행하지 않는다.

## 구현 결정

- 검토용 DDL을 제품 전용 private schema의 버전/hash가 고정된 초기 migration으로 옮긴다. 기존 schema 충돌은 덮어쓰지 않는다. 앱 역할은 별도 명시 명령에서 기존 비관리자 역할에 최소 권한/RLS를 부여하며 자식 파티션 직접 권한은 주지 않는다.
- DATABASE_URL은 서버 환경변수/로컬 환경파일에서만 읽는다. URL·인증정보·원본 보고서를 로그/Git/웹에 제공하지 않는다. 원격 TLS는 인증서를 검증하며 endpoint 전환·재시도·관리형 proxy 변경은 없다.
- 고정5개 시장 연구 원본과 명시적으로 선택한 collected projection만 입력한다. 원본 바이트는 별도 private 로컬 artifact 보관소에 보존하고 DB에는 hash/상대 key와 구조화된 값만 저장한다. 원본 배열 위치와 XRPL IMPORTED_UNIT을 보존하고 같은 groupId로 요청을 합치지 않는다.
- 트랜잭션 안에서 import 멱등/충돌 검사·registry/지표/요청 정의·정확한 numeric 관측·legacy 연결·성공 최신값을 저장한다. 값이 같은 새 관측은 유지한다. 현재 collector나 JSON publisher는 변경하지 않는다.
- 조회 repository/CLI는 시계열 목록·최신값·단일 series 기간 조회를 제한된 개수와 cursor로 제공한다. 기존 화면/JSON snapshot은 계속 기존 경로를 읽는다. DB 연결만으로 registry v2·롤업·자동 수집·무제한 이력 조회가 구현된 것으로 표시하지 않는다.

기준 설계는 [ADR0039](0039-postgresql-market-storage-design.md)와 [저장 설계](../design/POSTGRESQL_MARKET_STORAGE.md)다. 구체적인 실행/검증/제약은 [CLI 안내](../POSTGRESQL_MARKET_CLI.md)에 기록한다. 실제 공급자 시각의 nanosecond 원문을 추가 보존하고, IMPORT_BINDING artifact·migration/구조 fingerprint·실제 앱 역할/RLS/trigger 검증을 구현했다. 원격 TLS·Supabase 연결·pooler·웹 전환은 미실행이다.
