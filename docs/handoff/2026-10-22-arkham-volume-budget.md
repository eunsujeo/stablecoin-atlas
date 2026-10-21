# Arkham 거래량·수집 예산 조사
- 목표: 공식 거래량 정의와 계정 한도 조건을 확인하고 확인된 범위만 연결한다.
- 변경 파일: docs/research/arkham-volume-and-budget-review.md, docs/DEVELOPMENT_STATUS.md, docs/NEW_PC_SETUP.md, docs/handoff/2026-10-22-arkham-volume-budget.md
- 검증: npm run doctor rc0/UI 준비 완료. npm run check의 종료 코드·pass/fail 요약은 이번 세션 최종 응답과 .state/agent-logs/arkham-volume-budget-check.log를 확인한다. git diff --check 통과.
- 남은 문제: 상세 공식4문서 HTTP403 Forbidden/Server cloudflare. totalVolume 기간·단위·범위 및 계정 계약 미확인. 원본 측 거부이며 Squid 오류 코드 없음. 다른 PC/OS 검증은 미실행.
- 다음 행동: 공식 본문 또는 계정 계약을 확보한 뒤 해당 정의를 검토한다. 거래량 순위 보류와 기존 수동 단발 경계를 유지한다. 인증 API·usage·시장 수집은 이번 작업에서 실행하지 않았다. 새 PC는 docs/NEW_PC_SETUP.md를 따른다.
- 미회수 Agent/Lead id: 없음. 기존 AGENTS.md와 Router Lead 인계/README 변경은 이번 작업 전부터 존재했다.
