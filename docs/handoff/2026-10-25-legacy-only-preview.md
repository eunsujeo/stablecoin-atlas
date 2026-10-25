# 기존 UI 정리와 DB 읽기 연결
- 목표: Atlas 별도 화면·검증 근거·자산 비교 제거와 기존 개발 DB 읽기 연결.
- 끝난 것: 사용자 후속 요청대로 legacy UI만 남겼다. `/`·`/index.html`·`/legacy.html`은 같은 화면이다. Atlas 전용 파일·비교 전용 모듈/스타일/시험·검증 근거/자산 비교 메뉴와 페이지·연결 동작을 제거했다. 예전 #validation/#compare는 전체 현황으로 표시한다. 자산 프로필26곳·전체 현황·시장·보고서·원본 판정은 보존한다. UNKNOWN 소스 표시 조정 중간 구현은 사용자 페이지 제거 요청으로 제거했다. DB 질문에는 처음4399가JSON임을 확인했고 사용자 연결 요청 후 기존 비공개 reader 환경파일로 PostgreSQL 읽기 전용 모드로 재시작했다. 실제 market JSON source=POSTGRESQL/관측2162건/DB 오류없음을 확인했다. 외부 공급자/API/RPC·수집·DB 변경0. DB 브라우저 검사 CDP InterceptionId 경합은 Fetch promise 추적·15초 제한 배수로 보완했다. Lead f17056d65153432fb7826590f54ab5f0 proceed 조건과 재검사를 완료했다.
- 변경 파일: web/atlas* 삭제, web/comparison* 삭제, tools/comparison-browser-check.mjs 삭제, web/evidence.js, web/index.html, web/overview.js, web/preview.test.mjs, tools/ui-preview.mjs, tools/source-review-browser-check.mjs, docs/adr/0104-legacy-only-preview.md, docs/research/2026-10-25-legacy-only-preview.md, docs/DEVELOPMENT_STATUS.md, docs/ATLAS_DASHBOARD.md, docs/ui/ATLAS_REDESIGN.md, 이 인계문
- 검증: npm run check rc0 tests584/pass584/fail0/cancelled0/skipped0(.state/agent-logs/legacy-only-check-complete.log). node --test web/preview.test.mjs rc0 tests1/pass1/fail0. node tools/source-review-browser-check.mjs http://127.0.0.1:4399 rc0(JS오류0/외부요청0·26프로필·dark/light·390px·삭제hash fallback·근거503·원래판정 보존, .state/agent-logs/legacy-only-source-db.log). git diff --check rc0. 실제4399 Atlas/비교 자산404 확인. 중간 삭제 시점의 이전 검사rc1과 최초CDP오류·수정은 연구 기록에 별도 보존했다.
- 기다리는 것: 없음
- 다음 행동: 인계문과 연구 기록을 읽고 사용자의 다음 구체 요청을 확인한다. 제거한 메뉴를 재추가하거나 외부 수집을 시작하지 않는다.
- 사용자 확인 필요: 예 — 현재 요청 완료, 추가 화면/연구 요청 필요.
- 읽을 파일: docs/research/2026-10-25-legacy-only-preview.md, docs/adr/0104-legacy-only-preview.md

4399는 기존 reader 환경파일을 명시한 읽기 전용 DB 미리보기 상시 서비스다. 결과 대기가 아니며 종료하지 않는다. 접속 설정·키·원문은 Git에 포함하지 않는다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다.
