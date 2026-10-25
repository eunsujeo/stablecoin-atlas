# 전체 현황 초기 스켈레톤 복구
- 목표: 로딩 완료 전 기술 검증 현황 제목만 보이는 화면 수정.
- 끝난 것: 현재 공급량·전송량 영역에 정적 초기 스켈레톤/상태 추가. survey 선완료에도 history 대기 중 유지, 완료/실패 시 제거·aria-busy 해제. 정상 자료 재조회 유지. 첫 실패의 잘못된 이전 정상 자료 안내 수정. 기존 DB reader 설정으로 로컬 UI 실행 중이며 공급자 수집·DB 변경 없음. 첫 브라우저 검증 실패 원인/수정과 최종 결과는 연구 기록에 보존. Lead 688c6bfbe2bb4a42982ce122d9d52e4a proceed 회수.
- 변경 파일: web/index.html, web/supply-overview.js, docs/research/2026-10-25-overview-loading-skeleton.md, docs/handoff/2026-10-25-overview-loading-skeleton.md
- 검증: npm run check — rc0 tests564/pass564/fail0/cancelled0/skipped0 (.state/agent-logs/overview-initial-skeleton-check.log). node .state/overview-initial-skeleton-browser.mjs http://127.0.0.1:4173 — rc0/PASS(초기·survey 선완료/history 대기·성공·재조회·첫 history/index 실패·aria-busy·JS 오류0·외부 요청0). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 사용자의 화면 확인과 다음 구체 작업 지시를 받는다. 기존 토큰 소스 검토 완료와 배포 연결 UNKNOWN을 유지하며 새 외부 조회/컴파일을 자동 시작하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 작업 선택.
- 읽을 파일: docs/research/2026-10-25-overview-loading-skeleton.md, docs/research/2026-10-25-token-review-source-summary.md

자동 새 대화 예약은 같은 화면의 작은 후속 수정이므로 하지 않는다. 상시 UI 서버 http://127.0.0.1:4173 은 PostgreSQL 읽기 전용이다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다.
