# Allium 일별 수집 설계·비용 통제 검토
- 목표: 사용자 요청에 따라 일별 수집의 설계와 비용 통제만 검토한다. 실제 수집·구현·스케줄 활성화는 포함하지 않는다.
- 끝난 것: ADR0068에 기존 실행기의 기간1회/manual-once 제약, 고정 조사 DB/UI와의 분리, daily-v1 비활성 설계, 11배포/[D-7,D)/2run·최대26HTTP+usage1을 기록했다. 조직 공통 PostgreSQL 원장·원자 예약·전송 전 intent·POST/GET 자동 재시도0·기존 예약 전환·UNKNOWN/기간 경계 차단을 제안했다. usage/예약 대사 산식과 registry 합산·실제 예산/공급자 통제 검토 조건을 명시했다. 과거 supply+volume0.09118333333333335EU와 동일비용30/31쌍 산술은 견적/상한으로 취급하지 않는다. Lead9feae398b6e042af8ce79b4554f88ecc의 revise_plan 조건을 반영했다. 공식 문서4개 재확인은 HTTP403이었고 한도 페이지는 Server:cloudflare/error code:1010 원본 서버 제한이었다. 공급자 강제 한도·초과과금 UNCONFIRMED, daily DISABLED를 유지한다. 새 공급자 API/usage/SQL·DB·수집 스케줄 변경0. 기존 loopback 미리보기와 Arkham 상태는 변경하지 않았다.
- 변경 파일: docs/adr/0068-daily-allium-design-and-cost-controls.md, docs/ALLIUM_COLLECTION_PLAN.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-23-allium-daily-design-review.md
- 검증: npm run check rc0 tests380/pass380/fail0/cancelled0/skipped0(.state/agent-logs/allium-daily-design-check.log). git diff --check rc0. 문서3개의 로컬 링크 검사 rc0/missing0. Python Decimal로 일별 합·30/31쌍과27HTTP×30/31 산술 확인 rc0. 일별 원장/장애 시나리오는 설계 조건이며 구현·시험 완료가 아니다.
- 기다리는 것: 없음
- 다음 행동: 이 인계문과 ADR0068을 읽고 사용자 후속 지시를 확인한다. 사용자가 구현을 승인하면 ADR0068의 후속1단계인 외부 호출 없는 disabled daily plan/authorization·예산 계산기·조직 공통 원장 fake transport 검증부터 진행한다. 실제 공급자 호출·예약 전환·스케줄·동적 DB/UI·기본 공급자 변경을 시작하지 않는다. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md는 보존했다.
- 사용자 확인 필요: 예 — 다음 구현 단위의 진행 지시가 필요하다. 이번 요청은 설계·비용 통제 검토로 완료했다.
- 읽을 파일: docs/adr/0068-daily-allium-design-and-cost-controls.md, docs/ALLIUM_COLLECTION_PLAN.md, docs/DEVELOPMENT_STATUS.md
