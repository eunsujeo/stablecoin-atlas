# 새 기준의 읽기 전용 EVM 토큰 기술 검토
- 목표: 사용자 보완 명세에 따라 입력→근거 수집→소스 검토→JSON/Markdown의 최소 CLI를 완성한다. 기존 보고서·판정·UI/DB는 보존한다.
- 끝난 것: 별도 TokenReviewConfig1.0/TokenTechnicalReview1.0, 명시 chainId/주소, EIP-1898 hash/requireCanonical과 종료 재검증, 제한된 getter/프록시·의존 코드 관측, 설치 solc worker·소스/상속/modifier/조건/호출/대입/반환/selector 위치, 전체 runtime 일치, 감사 bytes/제출 버전·commit·범위 UNKNOWN, 사설 append-only 근거·SHA256 묶음. AI/Slither NOT_RUN. 선언/후보/현재 관측/배포 연결을 분리하고 의미·완전성 미확인은 UNKNOWN이다. 사설 두 체인/시험 토큰과 프록시를 검증했고 실제 다섯 토큰의 외부 조회는 하지 않았다. Lead 96c98758894a4003bbeeac1518132fc9 proceed 회수·조건 반영. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 건드리지 않았다.
- 변경 파일: src/token-review/, src/cli.ts, src/lab/anvil.ts, package.json, schemas/token-review-config.v1.schema.json, schemas/token-technical-review.v1.schema.json, tests/token-review.test.ts, tests/fixtures/TokenReview.sol, AGENTS.md, README.md, docs/TOKEN_TECHNICAL_REVIEW.md, docs/adr/0090-readonly-token-technical-review.md, docs/DEVELOPMENT_STATUS.md
- 검증: npm run check > .state/agent-logs/token-review-final-check.log 2>&1 — rc=0, pass519/fail0/skipped0. node --use-env-proxy --import tsx --test tests/token-review.test.ts — rc=0, pass11/fail0. npm run review:token -- --help — rc=0. node --use-env-proxy --import tsx .state/token-review-smoke.mts — rc=0, COMPLETED/binding CONFIRMED/failures0、사설 Fixture뿐이다. 예제 .state/token-review-smoke/output/report.md와 report.json/bundle.json; 사설 체인/서버는 종료했다. git diff --check — rc=0.
- 기다리는 것: 없음
- 다음 행동: 사용자가 실제 배포 검토를 요청하면 정확한 chainId·주소·허용 RPC·로컬 소스 standard JSON/compiler 버전·선택 감사 자료를 확인하고 고정 1배포 설정을 만든다. 외부 호출·비용·키·승인 범위가 필요하면 실행 전에 구체적 확인을 받는다. 주소/버전은 추측하지 않는다. 초기 compiler는 설치 버전만 지원하며 자동 다운로드·AI·Slither·운영 DB/UI/수집기 확장은 하지 않는다.
- 사용자 확인 필요: 예 — 실제 1배포의 입력과 허용 RPC 읽기 실행 범위. 기존 자료 삭제·재판정이나 외부 조회를 미리 실행하지 않는다.
- 읽을 파일: docs/TOKEN_TECHNICAL_REVIEW.md, docs/adr/0090-readonly-token-technical-review.md, src/token-review/review.ts, tests/token-review.test.ts

자동 새 대화 예약은 기존 일일20회 상한 도달 상태 때문에 재시도/초기화하지 않는다. 이번 로컬 증거는 Git/웹에 게시하지 않는다.
