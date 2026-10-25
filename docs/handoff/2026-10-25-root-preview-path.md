# 미리보기 기본 경로 정리
- 목표: 단일 UI의 정식 주소를 legacy 이름 없이 `/`로 통일한다.
- 끝난 것: `/`가 기본이며 `/index.html`도 같은 화면이다. `/legacy.html`은 GET/HEAD308으로 `/`에 이동하고 query/hash를 보존한다. same-origin·허용 메서드 검사 뒤 처리하고 긴/변형 경로는404로 유지한다. DB 미리보기4399를 기존 reader 설정의 PostgreSQL 읽기 전용 모드로 재시작하고 기본 주소를 브라우저에 열었다. Atlas·검증 근거·자산 비교 제거와26프로필·보고서/원본 판정은 유지한다. 브라우저 검사 경합이 재현되어 Fetch promise뿐 아니라 같은 page session의 진행 Network requestId도 추적하고 실제 종료·150ms 안정 구간을 전체20초 안에서 기다리도록 보완했다. 오류를 무시하지 않는다. Lead c5660e48ffe2469080ea0513a0ca31e7 proceed 조건과 DB모드 반복 브라우저 검사를 완료했다.
- 변경 파일: tools/ui-preview.mjs, tools/source-review-browser-check.mjs, web/preview.test.mjs, docs/adr/0104-legacy-only-preview.md, docs/DEVELOPMENT_STATUS.md, docs/ATLAS_DASHBOARD.md, docs/research/2026-10-25-legacy-only-preview.md, 이 인계문
- 검증: node --test web/preview.test.mjs rc0 tests1/pass1/fail0. node tools/source-review-browser-check.mjs http://127.0.0.1:4399 rc0 두 번(.state/agent-logs/root-path-browser.log, root-path-browser-repeat.log): root/이전주소 redirect·pathname/hash·기존26프로필·근거503·삭제메뉴 fallback·dark/light·390px·JS오류0/외부요청0. npm run check 첫 실행 rc0 tests584/pass584/fail0/cancelled0/skipped0(.state/agent-logs/root-path-check.log). 도구 보완 후 최종 npm run check rc0 tests584/pass584/fail0/cancelled0/skipped0(.state/agent-logs/root-path-check-final.log). git diff --check rc0. 최초 CDP 재현 실패는 root-path-browser-interception-failure.log와 연구 기록에 보존한다.
- 기다리는 것: 없음
- 다음 행동: 이 인계문과 연구 기록을 읽고 사용자의 다음 구체 요청을 확인한다. 기본 주소는 `/`를 사용한다.
- 사용자 확인 필요: 예 — 현재 요청 완료, 추가 요청 필요.
- 읽을 파일: docs/research/2026-10-25-legacy-only-preview.md, docs/adr/0104-legacy-only-preview.md

4399는 읽기 전용 DB 미리보기 상시 서비스다. 키·접속 설정·원문은 게시하지 않는다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 같은 작업의 작은 후속 수정이므로 별도 대화 갱신은 예약하지 않는다.
