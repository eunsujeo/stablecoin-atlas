# 자산 프로필 항목별 소스 검증 결과
- 목표: 자산 프로필의 항목별 검증 결과에도 기존 소스 확인을 반영한다.
- 끝난 것: 공통 기본/Atlas 프로필에 검증 결과 탭·항목별 결과 표. 선택한 자산/chainId의 functions/authorities 원문을 기능/권한 행으로 표시하고 SOURCE_REVIEWED를 소스 확인 완료로 제공. 기존 읽기 보고서 표 제목은 저장된 읽기 실행 결과로 변경하고 소스 결과 위치 안내. 기존 판정·지원·실행·근거·선택·UNKNOWN은 보존. 외부 API/RPC/compiler/키/DB 변경0.
- 변경 파일: web/source-review.js, web/source-review.css, web/evidence.js, web/atlas.html, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-profile-item-results.md, docs/handoff/2026-10-25-profile-item-results.md
- 검증: node --check web/source-review.js rc0; node --check web/evidence.js rc0; node --check tools/source-review-browser-check.mjs rc0; node tools/source-review-browser-check.mjs http://127.0.0.1:4173 rc0/PASS(양쪽8프로필 전체 소스행 수·내용·상태, 선택 전후 기존 읽기 표 동일, 검색/네트워크/키보드/근거503 격리, 다크/라이트·1440/390px, JS오류0·외부요청0, 전체 현황 회귀); npm run check rc0 tests566/pass566/fail0/cancelled0/skipped0; git diff --check rc0. 로그 .state/agent-logs/profile-item-results-{browser,check}.log. 실제 렌더링 캡처 .state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png 확인.
- 기다리는 것: 없음
- 다음 행동: 사용자의 다음 구체 화면 수정 요청을 처리한다. 추가 조회/기능을 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 수정 요청.
- 읽을 파일: docs/research/2026-10-25-profile-item-results.md, docs/adr/0100-reviewed-source-asset-profiles.md

이번 구문/브라우저 검사는 첫 실행부터 통과했고 읽기 표 보존·결과 캡처 검증을 보강했다. 새 원본 취득은 없으며 실제 실행 미확인/배포 연결 등 기존 한계를 보존했다. 임시 Chrome 종료·사용자용4173 유지. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 같은 화면의 작은 후속 수정이므로 자동 새 대화 예약하지 않음.
