# 저장 자료 기반 로컬 UI 재설계
- 목표: 사용자 승인 가격 표시 계약과 확보한 자료 중심의 UI 전면 재설계를 완성한다.
- 끝난 것: 지정 frontend-design 스킬을 읽고 시각 계획·자료 대조·구현·스크린샷 비평을 수행했다. ADR0085/설계 정본과 별도 /atlas.html 로컬 시안을 추가했다. 공급량 그래프·코인 전체 유통량 비교·전송량·저장 가격·조사 범위, 다크/라이트·코인/기간/정렬·키보드 탐색을 구현했다. 기존 공개용 projection/검증/차트를 재사용한다. 새 연구 가격·보유자·지갑형은 확보 상태만 표시하며 값·비공개 원문을 승격/공개하지 않는다. 현재 JSON 모드의 시장3코인·전송량 경로 비활성을 그대로 표시한다. 새 API/키/비용/운영 DB 접속·쓰기/소비/수집 변경0. 기존 / 유지. Lead a097fe235af1411f8c302677c55a29c4 action proceed 검토 조건을 반영했고 미회수 요청 없음.
- 변경 파일: web/atlas.html, web/atlas.css, web/atlas.js, tools/ui-preview.mjs, web/preview.test.mjs, docs/ui/ATLAS_REDESIGN.md, docs/adr/0085-stored-data-ui-redesign.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-24-stored-data-ui-redesign.md
- 검증: npm run check rc0 tests492/pass492/fail0/cancelled0/skipped0(.state/agent-logs/atlas-redesign-check.log). node .state/atlas-redesign-browser.mjs <소유 loopback 미리보기> rc0 PASS: 실제 JSON projection/그래프·선택/기간/정렬/키보드/테마/화면 전환/가격시각/503·부정응답 후 정상값 보존/복구/미확보/전송량 비활성/390px 가로넘침0/외부요청0·런타임오류0. 별도 시험용 전송량의 긴 십진 문자열·실제0·실패보존도 검증, 운영 데이터 반영0. .state/agent-logs/atlas-redesign-browser.log 및 .state/atlas-redesign-*.png. 최초 재검사 때 Chrome 임시 프로필 정리 경합 ENOTEMPTY를 관측해 프로세스 종료 대기 후 정리하도록 QA harness를 보정했으며 최종 rc0. node --check web/atlas.js rc0, git diff --check rc0.
- 기다리는 것: 없음 — 검사/Lead 회수 완료, 추가 Agent 없음. 이번 소유 미리보기는 종료한다. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md 유지.
- 다음 행동: docs/ui/ATLAS_REDESIGN.md와 새 로컬 시안을 근거로 기본 진입점 전환 여부와 추가 화면 연결 범위를 사용자에게 확인한다. 실행은 npm run ui 후 /atlas.html. 새 외부 호출·연구 원문 공개·새 parser/DB 입력·운영 DB 연결·기본 화면 전환을 자동 실행하지 않는다.
- 사용자 확인 필요: 예 — 새 시안의 기본 화면 전환과 다음 연결 대상. 현재 요청의 설계·로컬 구현·검증은 완료했다.
- 읽을 파일: docs/ui/ATLAS_REDESIGN.md, docs/adr/0085-stored-data-ui-redesign.md, docs/DEVELOPMENT_STATUS.md
