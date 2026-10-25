# 자산 프로필 과거 실행 진단 제거
- 목표: 사용자 정정에 따라 과거 실행 진단을 접어두지 않고 자산 프로필에서 제거한다.
- 끝난 것: 기본/Atlas 과거 실행 영역 DOM·선택기·식별/지원/판정/진단 표와 전용 렌더러·상태·이벤트 삭제. 소스 근거 탭의 과거 블록/배포 연결 진단도 제거. 소스 결과·기준일·해석 범위만 표시. Atlas는 자산 화면에서 과거 근거 index를 요청하지 않음. 기존 비교/근거/전체 현황 판정과 원본 연구·발췌/UNKNOWN은 별도 보존. 새 API/RPC/compiler/키/DB 변경0.
- 변경 파일: web/index.html, web/atlas.html, web/evidence.js, web/atlas-evidence.js, web/source-review.js, web/source-review.css, web/preview.test.mjs, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-remove-profile-diagnostics.md, docs/handoff/2026-10-25-remove-profile-diagnostics.md
- 검증: node --check web/{evidence,atlas-evidence,source-review}.js 각rc0; node --check tools/source-review-browser-check.mjs rc0; node tools/source-review-browser-check.mjs http://127.0.0.1:4173 rc0/PASS(기본/Atlas 기록·선택·표 DOM없음, 소스8프로필 결과/문장/상태 동일, 과거관측·binding진단 DOM없음, 비교 경로·전체현황 등급/판정수 유지, 근거503·다크/라이트1440/390px·검색/네트워크/키보드·JS오류0/외부요청0). 최초 npm run check rc1 tests566/pass565/fail1: 삭제한 진단 영역의 migration 링크 기대 불일치. 해당 기대만 수정 후 node --test web/preview.test.mjs rc0 1/1; 최종 npm run check rc0 tests566/pass566/fail0/cancelled0/skipped0. git diff --check rc0. 로그 .state/agent-logs/remove-profile-diagnostics-{browser,check,check-retry,preview}.log. 실제 캡처 .state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png 확인.
- 기다리는 것: 없음
- 다음 행동: 사용자에게 제거된 화면을 확인받고 다음 구체 수정 요청을 처리한다. 추가 기능/조회는 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 수정 요청.
- 읽을 파일: docs/research/2026-10-25-remove-profile-diagnostics.md, docs/adr/0100-reviewed-source-asset-profiles.md

로컬 Lead e51d5310d69f4ac69cade1bbaf01fa29 응답 proceed: 삭제된 진단 영역의 링크 기대 1개 수정 적절, 나머지 경계 검사와 소스/비교 회귀·전체 재검증·원래 판정 보존 조건. 완료. 구현 위임/모델 전환 없음. Chrome 종료·사용자용4173 유지. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 같은 화면의 후속 수정이므로 자동 새 대화 예약 안 함.
