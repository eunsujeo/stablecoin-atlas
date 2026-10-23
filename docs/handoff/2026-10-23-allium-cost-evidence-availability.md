# Allium 실제 비용 증거 제공 가능성 조사
- 목표: ADR0075 후속으로 공개 공식 문서의 실제 비용 증거 제공 가능성을 조사·기록하고 commit/push한다.
- 끝난 것: 공식 문서7개의 제목·URL·관련 절·확인일을 기록했다. 조직 집계 API·CSV·EU 한도/초과 사용 제어는 공개 설명을 확인했으며 계정별 적용은 UNCONFIRMED다. 미국 동부 시간의 reset·한도 설정 이후 누계·화면/청구서 반올림 차이를 구분했다. 요청별 정확 EU·과금 항목 identity·특정 usage 버전의 포함/최종성·정정 계보·갱신 지연은 미확인이다. workflow 본문2개 도구 오류는 근거에서 제외했다. 실제 전환은 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0을 유지한다. 인증 API/usage/SQL·계정 화면·CSV 취득·공급자 연락·claim/배분/차감·운영 연결은 수행하지 않았다. Lead 6b6fe9dee5ff40a6ab441a592f01abc1 proceed 조건 반영. 기존 미추적 router-lead-review 인계문은 유지했다.
- 변경 파일: docs/research/allium-cost-evidence-availability-2026-10-23.md, docs/ALLIUM_COLLECTION_PLAN.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-23-allium-cost-evidence-availability.md
- 검증: npm run check rc0 tests415/pass415/fail0/cancelled0/skipped0(.state/agent-logs/allium-cost-evidence-availability-check.log). git diff --check rc0. 변경 문서 로컬 링크 누락0. 문서만 변경하여 PG 추가 시험은 실행하지 않았다. 실제 공급자 자료의 검증은 NOT_TESTED다.
- 기다리는 것: 없음
- 다음 행동: 인계문과 조사 기록을 읽고 사용자에게 기존 CSV/명세/설정 근거 제공 가능성과 비공개 오프라인 사전 목록 검토 범위를 확인한다. 승인 전 인증 호출·계정 설정·공급자 연락·실제 증거 import/parser·후속 Fixture·실제 claim/차감을 시작하지 않는다.
- 사용자 확인 필요: 예 — 계정 자료 제공 가능성과 후속 검토 범위 결정.
- 읽을 파일: docs/research/allium-cost-evidence-availability-2026-10-23.md, docs/adr/0074-cost-attribution-evidence-contract.md, docs/adr/0075-read-only-synthetic-cost-evidence-review.md
