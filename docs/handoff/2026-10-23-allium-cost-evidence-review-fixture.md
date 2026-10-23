# 읽기 전용 가상 비용 증거 검토 Fixture
- 목표: ADR0074 후속 읽기 전용 가상 증거 검토를 구현·검증하고 commit/push한다.
- 끝난 것: ADR0075의 순수 검토와 PG review-only factory를 구현했다. 조직/키 유효기간·세 기간/UTC 경계·정확 EU·operation/송신·출처/포함/최종성 참조·중복 후보·버전/정정 차단 사유를 검토한다. 완전한 자료도 CONSISTENT_SYNTHETIC_CONTRACT만 표시한다. 원장/보존 원문은 기존 pin/read-only transaction/exact publication으로 검증하고 가상 입력은 메모리에서만 다룬다. 반복/차단/오류 검토에 기존 UNKNOWN·예약·L·c_i=0과 publication을 유지했다. 실제 공급자 진위/최종성은 UNCONFIRMED/UNKNOWN이며 배분/claim/차감/실제 전환·공급자 호출·운영DB·스케줄·웹 변경은 없다. UTC 이외 시간대/DST는 차단하고, 실제 claim 동시성·배분 ACK/복원은 NOT_TESTED다. 기존 미추적 router-lead-review 인계문과 상시 서비스는 유지했다.
- 변경 파일: tools/allium-cost-evidence-review.mjs, tools/market-db/allium-daily-lab.mjs, tests/allium-cost-evidence-fixture.mjs, tests/allium-cost-evidence.test.mjs, tests/allium-daily.test.mjs, tests/postgres/allium-daily.test.mjs, package.json, docs/adr/0075-read-only-synthetic-cost-evidence-review.md, docs/ALLIUM_COLLECTION_PLAN.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-23-allium-cost-evidence-review-fixture.md
- 검증: 최종 npm run check rc0 tests415/pass415/fail0/cancelled0/skipped0(.state/agent-logs/cost-evidence-review-check-final.log). 최종 npm run check:allium-daily rc0 tests57/pass57/fail0/cancelled0/skipped0(.state/agent-logs/cost-evidence-review-daily-final.log). git diff --check rc0, 변경 문서 로컬 링크 누락0. PG 신규3개는 반복/차단/오류·입력 복사·pin/commit ACK 유실·원문 누락·미게시 head를 검증했다. Lead 740aeb3f079746bcb16e37b919edb833 proceed 조건 반영. 실제 claim/배분 ACK/복원 시험은 NOT_TESTED다.
- 기다리는 것: 없음
- 다음 행동: 인계문과 ADR0075를 읽고, 실제 공급자 증거 제공 가능성의 후속 조사 범위를 사용자에게 확인한다. 승인 전 공급자/usage 호출·실제 배분/claim·차감·legacy 전환·운영 연결을 시작하지 않는다.
- 사용자 확인 필요: 예 — 후속 조사 또는 구현 범위 결정.
- 읽을 파일: docs/adr/0075-read-only-synthetic-cost-evidence-review.md, docs/adr/0074-cost-attribution-evidence-contract.md, docs/DEVELOPMENT_STATUS.md
