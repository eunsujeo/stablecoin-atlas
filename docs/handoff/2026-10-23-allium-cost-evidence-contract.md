# 비용 귀속·최종성 증거 계약 설계
- 목표: ADR0073 다음 단계로 비용 귀속·최종성에 필요한 증거 계약과 향후 검증표를 설계하고 commit/push한다.
- 끝난 것: ADR0074에 조직/키 교체·기간/시간대·정확 단위·원문 출처/버전·operation별 usage 포함·공급자 최종성의 최소 계약을 정의했다. 중첩 snapshot·다른 root/epoch·소비자 사이 중복 배분 방지, 원자적 claim·재생·commit/publication 불명·복원·정정/취소의 후속 시험 명세를 정리했다. 문서 설계만 완료했으며 새 API/DB/배분/차감 구현은 없다. 공급자 증거 제공 여부는 UNCONFIRMED다. 실제 legacy TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0과 기존 읽기 API를 유지했다. 새 공급자/usage/SQL/HTTP 호출·운영 DB·스케줄·웹 변경은 없다. 기존 미추적 router-lead-review 인계문과 상시 서비스는 유지했다.
- 변경 파일: docs/adr/0074-cost-attribution-evidence-contract.md, docs/ALLIUM_COLLECTION_PLAN.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-23-allium-cost-evidence-contract.md
- 검증: npm run check rc0 tests408/pass408/fail0/cancelled0/skipped0(.state/agent-logs/cost-evidence-contract-check.log). git diff --check rc0, 변경 문서 로컬 링크 누락0. Lead 8738b0f86fea418a90a6b7ca5ad2dd65 proceed 조건 반영. 코드/PG 변경이 없어 check:allium-daily는 재실행하지 않았다. ADR0074의 후속 시험표는 명세이며 실행 결과가 아니다.
- 기다리는 것: 없음
- 다음 행동: 인계문과 ADR0074를 읽고, 읽기 전용 가상 증거 검토 Fixture의 구현 범위를 사용자에게 확인한다. 승인 후 필수 증거 누락/충돌·중복 후보·정정/기간 연결의 차단 사유를 가상 자료로 검증한다. c_i 변경·실제 배분/차감·공급자 호출·legacy 전환·운영 연결은 시작하지 않는다.
- 사용자 확인 필요: 예 — 다음 읽기 전용 가상 증거 검토 Fixture 구현 범위 확인.
- 읽을 파일: docs/adr/0074-cost-attribution-evidence-contract.md, docs/adr/0073-offline-reconciliation-review-fixture.md, docs/DEVELOPMENT_STATUS.md
