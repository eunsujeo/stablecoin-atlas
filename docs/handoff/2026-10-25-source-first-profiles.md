# 소스 기준 자산 프로필 기본 화면
- 목표: UNKNOWN 과다 노출을 정리하고 소스에서 확인한 기능·권한 중심으로 자산 프로필을 제공한다.
- 끝난 것: 기본/Atlas 공통 첫 탭을 검증 결과로 변경. 소스 확인 상태·기능/권한 항목 수 표시. 기본 자산 화면의 읽기 집계/생성시각은 감추고 안내를 소스 기준으로 변경(다른 근거 화면은 유지). 과거 읽기 선택·판정·지원 UNKNOWN·진단은 접힌 실행 기록에 보존. 소스 조건/원문·근거/한계·배포 연결/UNKNOWN·제품 판정을 재작성하지 않음. 새 API/RPC/compiler/키/DB 변경0.
- 변경 파일: web/source-review.js, web/source-review.css, web/evidence.js, web/index.html, web/atlas.html, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-source-first-profiles.md, docs/handoff/2026-10-25-source-first-profiles.md
- 검증: node --check web/source-review.js rc0; node --check web/evidence.js rc0; node --check tools/source-review-browser-check.mjs rc0; node tools/source-review-browser-check.mjs http://127.0.0.1:4173 rc0/PASS(기본/Atlas 기본 검증탭·기록접힘·기본 프로필 UNKNOWN 반복노출 없음·8프로필 소스행/상태 동일·펼친 기록 UNKNOWN/원래 읽기 행 보존·근거503·검색/네트워크/키보드·다크/라이트1440/390px·JS오류0/외부요청0·전체현황 회귀). npm run check rc0 tests566/pass566/fail0/cancelled0/skipped0. git diff --check rc0. 로그 .state/agent-logs/source-first-profiles-{browser,check}.log. 실제 캡처 .state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png 확인.
- 기다리는 것: 없음
- 다음 행동: 사용자의 다음 구체 화면 수정 요청을 처리한다. 추가 기능/조회는 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 수정 요청.
- 읽을 파일: docs/research/2026-10-25-source-first-profiles.md, docs/adr/0100-reviewed-source-asset-profiles.md

이번 구문/브라우저 검사는 첫 실행부터 통과. 원인은 취득 실패가 아니라 과거 읽기 지원/진단을 소스 프로필 아래 펼쳐 둔 표시 범위 혼재였다. SOURCE_REVIEWED를 실제 실행 인증으로 변경하지 않으며 역할 행사/배포 연결을 추가 완료조건으로 요구하지 않음. Chrome 종료·사용자용4173 유지. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 같은 화면의 후속 수정으로 자동 새 대화 예약하지 않음.
