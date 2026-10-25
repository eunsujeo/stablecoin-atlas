# 자산 프로필의 과거 실행 진단 제거

## 요청과 원인

사용자는 과거 실행 진단 정보를 제거하라고 명시했다. 이전 구현은 원본 기록 보존을 화면 노출 유지로 해석해 접힌 기록을 남겼으므로 사용자의 화면 정리 의도에 맞지 않았다. 이번 변경은 원본 보존과 화면 노출을 분리한다. [ADR0100](../adr/0100-reviewed-source-asset-profiles.md)의 기본 접힘 결정을 이번 제거 결정으로 대체한다.

## 수행 경로와 변경

기본/Atlas 자산 프로필의 과거 실행 기록 DOM·보고서 선택·식별/지원 UNKNOWN·판정/진단 표를 삭제했다. 기본 evidence.js의 selectReport/renderAssets와 전용 이벤트·로딩 대상도 제거했다. Atlas의 과거 profile 렌더러·식별 helper·선택 상태와 이벤트를 삭제하고 기존 비교 경로만 유지한다. Atlas는 자산 화면 진입으로 과거 근거 index를 요청하지 않고 비교 화면에서만 읽는다. 기본 자산 화면에는 공유 읽기 보고서 조회 오류/갱신 버튼도 노출하지 않는다. 다른 기존 근거 화면에서는 그대로 동작한다.

공통 소스 프로필의 근거 탭에서 과거 블록 관측/배포 연결 진단을 제거했다. 선택한 소스의 함수·modifier·조건 확인 결과·시각과 검토 범위를 제공한다. JPYC/JPYSC/RLUSD의 소스 해석 한계는 기존 limitations를 그대로 유지한다. USDC/USDT의 과거 실행/네트워크/소스 대응 진단은 연구 기록에만 두고, 공통 소스 확인 범위를 안내한다. JPYSC의 특정 초기화 경로 보완/전체 의미론 보장 제한 등 소스상 중요한 한계는 유지했다.

원래 공개 발췌 데이터·생성 문서·연구 원문·기존 제품 보고서·UNKNOWN/PASS/FAIL은 삭제하거나 재판정하지 않았다. 새 API/RPC/compiler/키/DB 변경은 없다. 제거 영역을 숨긴 상태로 남겨 두지 않았으며 전용 렌더링 경로도 삭제했다.

## 검증과 재현

로컬 서버에서 `node tools/source-review-browser-check.mjs http://127.0.0.1:4173` 실행. 실제 Chrome에서 기본/Atlas 과거 기록/선택/표 노드 없음·8프로필 소스 결과 동일·과거 observation/bindingDetail 문자열이 소스 DOM에 없음·비교 화면 진입/자료 표시·기존 전체 현황 판정수/등급 유지·근거503 격리·검색/네트워크/키보드·다크/라이트1440/390px·JS오류0/외부요청0을 확인했다. 정적 HTML 응답과 렌더링 검증을 구분한다.

구문/브라우저 검사는 첫 실행부터 통과했다. 최초 전체 검사는 rc1·566건 중565통과/1실패였다. web/preview.test.mjs가 제거한 진단 영역 안의 /legacy.html#assets 이동 링크를 계속 요구한 것이 원인이었다. 제거된 링크의 필수 기대만 갱신하고 기존 loopback/CSP/경로 차단 검사를 유지했다. 해당 preview 검사 재실행은 rc0·1/1통과였고, 전체 검사를 다시 실행했다. 이 실패를 RPC/자료 부재로 해석하지 않는다. 로그 `.state/agent-logs/remove-profile-diagnostics-{browser,check}.log`, 실제 결과 캡처 `.state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png`. `node --check web/source-review.js`, `node --check web/evidence.js`, `node --check web/atlas-evidence.js`, `node --check tools/source-review-browser-check.mjs`, `npm run check`, `git diff --check` 최종 rc/건수는 [인계문](../handoff/2026-10-25-remove-profile-diagnostics.md)에 기록한다. Chrome 종료·사용자용4173 유지.

로컬 Lead 검토 `e51d5310d69f4ac69cade1bbaf01fa29`는 proceed로 응답했다. 판단 범위는 삭제된 진단 영역의 migration 링크 기대 1개 갱신이며, 나머지 migration/소스 프로필/비교/loopback/CSP 검사와 원래 판정 보존·전체 재검증을 조건으로 했다. 구현 위임이나 모델 전환은 없다.
