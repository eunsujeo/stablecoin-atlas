# Legacy 대시보드 기본 화면 복원
- 목표: 사용자가 지정한 legacy UI를 기본 대시보드로 다시 사용한다.
- 끝난 것: `/`·`/index.html`을 `/legacy.html`과 같은 기존 UI로 연결했다. 기존 다크·라이트·메뉴·저장 자료 기능을 유지하고 별도 분석 화면은 `/atlas.html`에 보존했다. legacy의 별도 분석/조사 범위 링크를 해당 경로로 수정했다. 로컬 JSON 미리보기를 재시작했다. 외부 수집·비용·새키·DB 변경 없음. 추가 Agent 없음.
- 변경 파일: tools/ui-preview.mjs, web/index.html, web/preview.test.mjs, docs/ATLAS_DASHBOARD.md, docs/DEVELOPMENT_STATUS.md, docs/ui/ATLAS_REDESIGN.md, docs/handoff/2026-10-24-legacy-dashboard-restored.md
- 검증: npm run check rc0 tests499/pass499/fail0/cancelled0/skipped0(.state/agent-logs/legacy-restore-check.log). git diff --check rc0. 로컬 HTTP 확인 rc0: `/`·`/index.html`·`/legacy.html`은 기존 app.js 문서200, `/atlas.html`은 별도 atlas.js 문서200. 문서 동등성·공유 query·HEAD·보안 경계는 기존 preview 시험 갱신으로 검증했다.
- 기다리는 것: 없음 — npm run ui의 127.0.0.1:4173 로컬 JSON 서비스 유지. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md 보존.
- 다음 행동: legacy UI를 기준으로 사용자 화면 피드백이나 구체적 다음 구현 지시를 받는다. 기존 통합 대시보드 후속 구현을 자동 재개하지 않는다.
- 사용자 확인 필요: 예 — 다음 변경 범위. 같은 주제의 작은 후속 수정이므로 자동 새 대화는 예약하지 않는다.
- 읽을 파일: docs/handoff/2026-10-24-legacy-dashboard-restored.md, docs/DEVELOPMENT_STATUS.md, tools/ui-preview.mjs, web/index.html
