# 자산 프로필의 항목별 검증 결과 반영

## 요청과 수행 경로

사용자가 전체 현황에 이어 자산 프로필의 항목별 검증 결과에도 최신 소스 검토를 반영해야 한다고 지적했다. 확인 결과 기존 하단 표는 저장된 읽기 실행 보고서만 표시했으며, 새 소스 검토는 위 기술 프로필의 기능·권한 목록에만 있었다.

[ADR0100](../adr/0100-reviewed-source-asset-profiles.md)에 따라 공통 프로필에 검증 결과 탭과 항목별 검증 결과 표를 제공했다. 선택한 자산/chainId에 해당하는 기존 공개 소스 발췌의 functions/authorities 각 문장을 하나의 기능/권한 검토 행으로 표시한다. 원래 문장을 요약해 새 판정을 만들지 않고, SOURCE_REVIEWED를 소스 확인 완료로 표시한다. 소스 조건 확인과 실행 PASS/FAIL은 표 설명에서 구분한다. 기존 근거·한계/주소/시각과 네트워크 선택을 유지한다.

기본 화면과 Atlas 하단의 이전 표는 저장된 읽기 실행 결과로 제목을 고치고 소스 결과 탭으로 안내한다. 원래 보고서 내용·판정·지원·실행·근거·선택은 유지하며 이름만으로 소스 프로필에 합치지 않는다. CLI/판정 원본/보고서 바이트는 변경하지 않았다. 외부 API/RPC·compiler·키·운영 DB 변경은 없다.

## 실패·수정 및 확보 범위

이번 구현의 구문·브라우저 검사는 첫 실행부터 통과했다. 브라우저 검사를 보강해 기본/Atlas 양쪽의 8프로필 전체 항목 수·문장·SOURCE_REVIEWED, 프로필 선택 전후의 읽기 표 원문 동일, 키보드 탭과 모바일 표시를 확인했다. 모바일은 표를 항목별 세로 배열로 표시한다. 추가 원본 취득은 없으며 기존 UNKNOWN·실행 미확인·불일치와 소스 확인 범위를 유지한다.

## 검증과 재현

기존 로컬 서버 또는 `npm run ui` 실행 후 `node tools/source-review-browser-check.mjs http://127.0.0.1:4173`으로 실제 Chrome 렌더링을 확인한다. 프로필마다 저장 functions+authorities 개수와 표시 행 수·내용/상태가 일치하며, 소스 선택으로 기존 읽기 결과를 바꾸지 않는지 검사한다. 근거503 격리·검색·체인 선택·키보드·다크/라이트·1440/390px·JS오류0·외부요청0과 전체 현황 회귀 검증을 포함한다. 정적 HTTP 응답과 렌더링 검증은 별도다.

로그 `.state/agent-logs/profile-item-results-{browser,check}.log`, 실제 결과 탭 캡처 `.state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png`. `node --check web/source-review.js`, `node --check web/evidence.js`, `node --check tools/source-review-browser-check.mjs`, `npm run check`, `git diff --check` 최종 결과는 [인계문](../handoff/2026-10-25-profile-item-results.md)에 기록한다. 검증 Chrome은 종료하고 사용자 서버4173은 유지한다.
