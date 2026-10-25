# 웹 나머지 화면 로딩·오류 점검
- 목표: 사용자 승인 웹 나머지 로딩·오류 표시 점검과 사용자 제보 스켈레톤 미표시 해결.
- 끝난 것: Atlas 공급량/전송량/가격/프로필/비교에 최초 스켈레톤·finally busy 해제 연결. 공통 loading.css 제공. 기존 근거·Atlas 가격/전송량의 첫 실패/404 비활성/자료 없음 구분. 정상 자료·정상 빈 상태는 재조회 중 유지.4173 이전 서버의 정적 경로 미반영으로 문구만 보이던 제보는 서버 재시작·같은 포트 CSS200/Chrome 라이트240px 도형으로 확인. 별도 JSON4174+명시 가상 전송량으로11경로 장애 검증. harness hash탐색/실제404/실패주입 경합 실패·수정은 연구 기록에 보존. Lead e3b94a6925f64f77a428d61a1454fdcc revise_plan 조건 반영·검증 완료. 공급자 수집/RPC/DB 쓰기0.
- 변경 파일: web/atlas.js, web/atlas-evidence.js, web/atlas.css, web/atlas.html, web/evidence.js, web/index.html, web/styles.css, web/loading.css, tools/ui-preview.mjs, docs/research/2026-10-25-web-loading-error-audit.md, docs/handoff/2026-10-25-web-loading-error-audit.md
- 검증: npm run check — rc0 tests564/pass564/fail0/cancelled0/skipped0 (.state/agent-logs/ui-loading-audit-check.log). node .state/ui-loading-audit-browser.mjs http://127.0.0.1:4174 — rc0/PASS(11경로·최초/재조회 지연·실패·복구·404/비활성·값/날짜 보존·390px·라이트·동작 감소·JS 오류0·외부 요청0). node .state/overview-initial-skeleton-browser.mjs http://127.0.0.1:4173 — rc0/PASS. node .state/overview-shared-skeleton-light.mjs http://127.0.0.1:4173 — rc0/PASS(도형240px). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 사용자 화면 확인 및 다음 구체 작업을 받는다. 완료된 토큰 소스 검토/배포 연결 UNKNOWN을 유지하고 새 외부 조회·컴파일을 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 작업 선택.
- 읽을 파일: docs/research/2026-10-25-web-loading-error-audit.md, docs/research/2026-10-25-token-review-source-summary.md

상시4173 UI는 기존 PostgreSQL reader로 실행 중. 이번 화면 수정의 후속 작업이므로 자동 새 대화 예약 안 함. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다.
