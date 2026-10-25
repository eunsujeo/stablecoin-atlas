# 전체 현황 기술 검증의 소스 확인 기준 반영
- 목표: 사용자가 요청한 전체 현황의 기술 검증 영역을 소스 확인 기준으로 업데이트한다.
- 끝난 것: 기술 검증 상단에 5자산·4네트워크·8프로필의 소스 확인 현황/조건/근거 링크 연결. 자산 프로필과 같은 정적 데이터를 재사용. 소스로 확인한 기능·권한은 소스 확인 완료로 표시. 기존 읽기 판정·점수·랭킹·산정 정책은 기본 접힌 실행 기록에 보존. 읽기 자료503과 독립적으로 소스 현황 표시. 새 RPC/API/compiler/DB 변경0. 직접 실행·권한 행사를 추가 완료조건으로 요구하지 않음.
- 변경 파일: web/index.html, web/overview.js, web/styles.css, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-overview-source-status.md, docs/handoff/2026-10-25-overview-source-status.md
- 검증: node --check web/overview.js rc0; node --check tools/source-review-browser-check.mjs rc0; node tools/source-review-browser-check.mjs http://127.0.0.1:4174 rc0/PASS(8프로필 전체 조건/확인상태/근거, 5/4/8집계, 읽기 원본 판정수 보존, 기본 접힘, 근거503 격리, 다크/라이트·1440/390px, 열 내부 줄바꿈, JS오류0·외부요청0). npm run check rc0 tests566/pass566/fail0/cancelled0/skipped0. git diff --check rc0. 로그 .state/agent-logs/overview-source-{browser,check}.log. 캡처 .state/overview-source-{dark,light}-{1440,390}.png. 실제 렌더링 검증이며 정적 응답과 구분함.
- 기다리는 것: 없음
- 다음 행동: 사용자의 다음 구체 화면/기능 요청을 확인한다. 현재 요청은 완료됐으며 추가 구현/외부 조회/실행을 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 작업 선택.
- 읽을 파일: docs/research/2026-10-25-overview-source-status.md, docs/adr/0100-reviewed-source-asset-profiles.md

초기 캡처에서 공통 nowrap 때문에 긴 조건의 열 겹침을 발견해 이 표의 줄바꿈/행간을 수정하고 재검증했다. 잘못된 문서 패치 문맥은 적용 전 거절돼 정확한 절 제목으로 수정했다. 검증용4174·임시 Chrome 종료, 사용자용4173 유지. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 커밋·push 후 저장소 지침에 따라 자동 새 대화 예약을 시도한다.
