# 소스 기준 자산 프로필 기본 화면

## 사용자 요청과 원인

사용자가 자산 프로필에 UNKNOWN이 너무 많으니 소스 기준으로 정리하라고 요청했다. 화면과 코드를 확인한 결과 이전 수정에서 소스 검토 표를 추가했지만 과거 읽기 보고서의 지원 UNKNOWN·진단 필드가 아래에 펼쳐져 있었다. 기본 화면의 상단 집계도 읽기 보고서 개수/범위여서 소스 검토 범위와 달랐다. 이번 원인은 새 취득 실패나 소스 자료 부재가 아니라 표시 범위의 혼재였다.

## 수행 경로와 변경

[ADR0100](../adr/0100-reviewed-source-asset-profiles.md)에 따라 공통 기본/Atlas 자산 프로필의 첫 탭을 검증 결과로 변경하고, 선택한 자산/명시 chainId의 소스 확인 상태와 기능/권한 항목 수를 표시했다. 원래 소스 functions/authorities의 조건과 SOURCE_REVIEWED를 그대로 사용한다. 새 확인 항목을 만들거나 실제 실행 증거로 환산하지 않았다.

기본 자산 화면의 읽기 보고서 집계·생성시각 상태는 표시하지 않으며 안내를 소스 검토 기준으로 바꾼다. 다른 항목별 근거·비교·보고서 화면에서는 원래 읽기 집계와 안내를 유지한다. 기본/Atlas의 과거 읽기 보고서 선택/원래 판정/지원/진단은 과거 읽기 실행 기록 안에 기본 접힘으로 보존한다. 펼치면 기존 UNKNOWN과 원래 결과를 확인할 수 있다. 소스의 근거·한계 탭과 발췌 링크, 기존 배포 불일치·UNKNOWN도 유지한다. 전역 문자열 치환이나 판정 파일 변경은 없다.

새 API/RPC/compiler/키/DB 변경0. 소스에서 확인한 조건은 완료로 표시하며 실제 권한 행사나 배포 대응을 완료조건으로 추가하지 않았다.

## 검증과 재현

`npm run ui` 또는 기존4173 서버에서 `node tools/source-review-browser-check.mjs http://127.0.0.1:4173` 실행. 기본/Atlas의 첫 탭·기록 기본 접힘·기본 프로필에 UNKNOWN 반복 노출 없음·선택한8프로필의 기존 SOURCE_REVIEWED/문장/항목 수·펼친 기록의 UNKNOWN 보존·선택 전후 원래 읽기 행 동일을 실제 Chrome 렌더링으로 확인한다. 근거503·탭/키보드/검색/네트워크·다크/라이트·1440/390px와 전체 현황 회귀 검사도 유지한다. 정적 HTTP 응답을 렌더링 검증으로 대신하지 않았다.

이번 구문·브라우저 검사는 첫 실행부터 통과했다. 로그 `.state/agent-logs/source-first-profiles-{browser,check}.log`, 캡처 `.state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png`. `node --check web/source-review.js`, `node --check web/evidence.js`, `node --check tools/source-review-browser-check.mjs`, `npm run check`, `git diff --check`의 최종 rc·건수는 [인계문](../handoff/2026-10-25-source-first-profiles.md)에 기록한다. 기존 비공개 원문·주소/설정 취득 여부·실행 미확인과 관측 시각을 유지하며 사용자용4173은 종료하지 않는다.
