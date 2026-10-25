# 자산 비교와 검증 비교 정리
- 목표: 사용자가 요청한 자산 비교·검증 비교 화면을 저장 근거 기준으로 정리한다.
- 끝난 것: 기본/Atlas #compare에 두 보기를 구현했다. 기본 자산 비교는26프로필의 자산+네트워크2~3개를 선택하여 식별자·검토 범위·검토일·조건·근거를 표시한다. 검증 비교는 기존 읽기 보고서의 시나리오·판정/지원/실행·문서/상세 근거를 유지한다. 보기 전환 시 선택 보존·중복 차단·미선택 안내를 추가했다. scope-0을 조인하지 않고 정확한 그룹+항목명만 행으로 연결하며 미수록/부재/비적용을 구분한다. 새 외부/API/RPC/compiler/키/DB 변경0. 초기 Atlas 동적 버튼 focus 오류는 정적 선택 영역으로 수정했다. 상세 근거 close 이벤트 전에 검사한 도구 오류는 실제 포커스 복귀 대기로 보완했다. Lead b0aa363f7c784b3e9d0355788915e451 proceed 조건을 확인했다.
- 변경 파일: web/comparison.js, web/comparison-model.js, web/comparison.css, web/comparison.test.mjs, web/index.html, web/atlas.html, web/atlas.js, web/evidence.js, web/atlas-evidence.js, tools/ui-preview.mjs, tools/comparison-browser-check.mjs, docs/adr/0103-profile-and-verification-comparison.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-comparison-workspace.md, 이 인계문
- 검증: node tools/comparison-browser-check.mjs http://127.0.0.1:4399 rc0(두 화면26프로필/조건/근거·2/3선택·중복/미선택·키보드·기존 보고서/상세 근거/실패 보존·Atlas 모듈 지연/직접 진입/새로고침/왕복·dark/light·1440/390px·JS오류0/외부요청0). node tools/source-review-browser-check.mjs http://127.0.0.1:4399 rc0(기존26곳 검색/탭/필터/판정 보존). npm run check rc0 tests592/pass592/fail0/cancelled0/skipped0. git diff --check rc0. 로그 .state/agent-logs/comparison-{browser,source-regression,check}.log. 기본 프로필 light390·Atlas 보고서 dark1440·프로필 dark1440 이미지를 실제 열어 확인했다.
- 기다리는 것: 없음
- 다음 행동: 인계문과 연구 기록을 읽고 새 사용자 요청의 구체 화면·동작을 확인한다. 이번 개선은 완료했으므로 임의 기능 확대나 새 외부 조사를 시작하지 않는다.
- 사용자 확인 필요: 예 — 후속 화면 조정이나 연구의 구체 요청 필요.
- 읽을 파일: docs/research/2026-10-25-comparison-workspace.md, docs/adr/0103-profile-and-verification-comparison.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 이번127.0.0.1:4399는 JSON 전용 로컬 미리보기 상시 서비스로 결과 대기 작업이 아니다. 기존 서버를 종료하지 않았다. 원문·키·endpoint는 게시하지 않는다.
