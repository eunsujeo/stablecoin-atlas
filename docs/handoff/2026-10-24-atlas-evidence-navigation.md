# Atlas 자산별 근거 탐색 연결
- 목표: 사용자 승인대로 화면 구성을 기획하고 자산 프로필·비교를 Atlas 조사 범위에서 연결한다.
- 끝난 것: 설계 정본에 목적별 진입점·자료 확보 기록·복귀 흐름을 먼저 기록했다. 조사 범위 상단에 설명이 있는 자산 프로필/비교 링크 두 개, 아래에 기술 검증/보고서 링크를 배치했다. 기존 자료 확보 기록과 UNKNOWN/NOT_TESTED 의미는 보존했다. 근거 화면 제목 옆에 Atlas 조사 범위 복귀 링크를 추가했다. 시장 읽기 실패에도 링크를 사용하며 모바일은 한 열이다. 기존 공개용 근거/화면을 재사용하고 새 API·외부 호출·키·비용·DB 입력·수집·새 집계·비공개 연구 표본 공개는 없다. 추가 Agent/Lead 요청 없음.
- 변경 파일: web/atlas.html, web/atlas.css, web/index.html, web/preview.test.mjs, docs/ui/ATLAS_REDESIGN.md, docs/adr/0085-stored-data-ui-redesign.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-24-atlas-evidence-navigation.md
- 검증: npm run check rc0 tests492/pass492/fail0/cancelled0/skipped0(.state/agent-logs/atlas-evidence-entry-check.log). node --test web/preview.test.mjs rc0 tests1/pass1/fail0. node .state/atlas-evidence-entry-browser.mjs <소유 loopback 미리보기> rc0 PASS: Tab/Enter 프로필 진입·실제 프로필 상세/비교 행·validation/reports·조사 범위 복귀·뒤로 가기·시장503 중 이동·다크/라이트·390px 가로넘침0·44px 터치 영역·외부 요청0·런타임 오류0(.state/agent-logs/atlas-evidence-entry-browser.log). 다크 desktop/라이트 mobile 스크린샷을 직접 검토했다(.state/atlas-evidence-entry-*.png). git diff --check rc0.
- 기다리는 것: 없음 — 시험 서버/Chrome 종료 완료. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md 유지.
- 다음 행동: 후속 UI 요청이 오면 설계 정본의 목적별 탐색을 기준으로 이미 공개된 자료/화면을 재사용한다. 새 자료 정규화·DB 입력·원격 연결·수집이 필요하면 작업 전 구체적 승인 범위를 확인한다. 이번 추천 연결의 기획·구현·검증은 완료했다.
- 사용자 확인 필요: 예 — 이번 연결을 넘어서는 추가 자료/화면 대상. 이미 승인된 프로필·비교 연결을 재확인하지 않는다.
- 읽을 파일: docs/ui/ATLAS_REDESIGN.md, docs/adr/0085-stored-data-ui-redesign.md, docs/DEVELOPMENT_STATUS.md
