# 전체 현황 기술 검증 요약 개선

## 요청과 변경

사용자가 전체 현황의 기술 검증 영역이 읽기 어렵고 등급과 상태를 요약해야 한다고 정정했다. [ADR0100](../adr/0100-reviewed-source-asset-profiles.md)에 따라 긴 8프로필 함수·권한 표를 5자산 요약 카드로 교체했다. 상단에는 소스 확인 8/8·자산5·네트워크4·기존 읽기 실행 등급을 표시한다. 읽기 등급에는 기존 통과 점수와 판정 완료 비율을 함께 표시하며, 소스 확인을 등급에 합산하지 않는다. 기술 검증 요약은 기본 노출하고 상세 실행 기록은 접힌 상태를 유지한다.

자산별 카드는 이름·네트워크·소스 확인 상태·확인 프로필 수와 상세 이동만 제공한다. 기능·권한 조건과 근거·한계는 기존 자산 프로필에 유지한다. 새 API/RPC/compiler/키/DB 변경은 없다.

## 수행 경로와 수정

기존 source-review-data의 공개 발췌를 자산 단위로 묶고, 기존 overviewSummary의 읽기 등급을 상단에 재사용했다. 새 산식이나 판정은 만들지 않았다. 첫 브라우저 검사는 신규 요약 카드에 사용한 data-coin-id가 기존 자산 프로필의 전역 선택자와 충돌해 실패했다. 요약에는 별도 data-source-coin 속성을 사용하고 상세 이동은 프로필 내부 선택자로 한정해 수정했다. 재검사는 통과했다. 상세 이동은 이전 자산 검색을 초기화한 뒤 해당 자산을 선택하므로, 검색 결과가 없는 상태에서도 동작한다. 소스 취득 실패나 자료 부재가 아니다.

## 검증과 재현

로컬 미리보기 실행 후 `node tools/source-review-browser-check.mjs http://127.0.0.1:4173`을 실행한다. 실제 Chrome 렌더링에서 5자산 요약·8/8 집계·기존 등급과 원본 판정 수 동일·다섯 자산 상세 이동·근거503 시 소스 표시와 등급 미산정·다크/라이트·1440/390px·JS오류0·외부요청0을 검증했다. 정적 HTML 응답 확인과 구분한다. 기존 자산 프로필의 탭·검색·네트워크·키보드 검증도 유지한다.

로그: `.state/agent-logs/overview-summary-browser.log`, `.state/agent-logs/overview-summary-check.log`. 캡처: `.state/overview-source-{dark,light}-{1440,390}.png`. `node --check web/overview.js`, `node --check tools/source-review-browser-check.mjs`, `npm run check`, `git diff --check` 결과는 [인계문](../handoff/2026-10-25-overview-technical-summary.md)에 기록한다. 사용자용4173은 유지한다.
