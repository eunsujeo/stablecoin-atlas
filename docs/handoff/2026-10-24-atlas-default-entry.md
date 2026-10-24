# Atlas 기본 진입점 전환
- 목표: 사용자가 승인한 Atlas 기본 화면 전환과 기존 화면 보존을 완료한다.
- 끝난 것: `/`·`/index.html`은 Atlas, `/atlas.html`은 같은 화면 별칭으로 제공한다. 기존 화면은 `/legacy.html`로 보존하고 Atlas의 기술 검증·보고서·시장 상세·기존 화면 링크를 연결했다. 기존 화면에 Atlas 홈 링크를 추가했다. 고정 문서 경로의 길이 제한 query만 허용하여 기존 화면의 공유 설정을 유지한다. 새 API·비용·키·운영 데이터/DB 변경·수집·추가 자료 연결은 없다. Lead 요청·추가 Agent 없음.
- 변경 파일: tools/ui-preview.mjs, web/atlas.html, web/index.html, web/preview.test.mjs, docs/ui/ATLAS_REDESIGN.md, docs/adr/0085-stored-data-ui-redesign.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-24-atlas-default-entry.md
- 검증: npm run check rc0 tests492/pass492/fail0/cancelled0/skipped0(.state/agent-logs/atlas-default-check.log). node --test web/preview.test.mjs rc0 tests1/pass1/fail0. node .state/atlas-default-browser.mjs <소유 loopback 미리보기> rc0 PASS: 기본 공급량 그래프·하단 기존 화면·validation/reports/live/overview·홈 왕복·공유 query, 외부 요청0·런타임 오류0(.state/agent-logs/atlas-default-browser.log). git diff --check rc0. 시험용 서버/Chrome 종료 완료.
- 기다리는 것: 없음
- 다음 행동: 사용자가 추가 연결할 자료나 화면을 지정하면 docs/ui/ATLAS_REDESIGN.md의 기존 공개용 projection·가격 계약에 맞춰 범위를 구체화한다. 외부 호출·새 parser/DB 입력·비공개 연구 원문 공개는 자동 진행하지 않는다.
- 사용자 확인 필요: 예 — 추가 연결 대상과 필요한 자료 처리 범위. 이번 기본 진입점 전환은 완료했다.
- 읽을 파일: docs/ui/ATLAS_REDESIGN.md, docs/adr/0085-stored-data-ui-redesign.md, docs/DEVELOPMENT_STATUS.md
