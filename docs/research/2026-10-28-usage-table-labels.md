# 전송 비교표 상단 문구 제거와 Canton 수집 경로 재확인

사용자가 인용한 ‘네트워크 전송 활동 비교’, 날짜/ARKHAM/집계시간대/조회시각 안내, ‘USDC · 같은 자산·집계일의 관측값’ 가시 캡션을 제거했다. 비교표의 값·일별 선택·원시각·출처·누락은 변경하지 않았다.

web/supply-overview.js의 표 상단 h2/설명 paragraph를 없애고 caption은 짧은 자산별 접근성 이름으로 바꿔 sr-only 처리했다. 비교표의 컬럼/값과 원시각/providerTime의 cell tooltip, 출처hash는 유지한다. 스크롤 보존·키보드focus·Arkham-only/last-good 정책을 바꾸지 않았다. API/DB/Collector/FX/운영설정 변경0이다.

`node tools/network-usage-browser-check.mjs`는4화면조건에서 h2 없음/가시집계문구없음/접근성caption숨김, 지표전환/정밀도/Allium fallback0·요청0·JS오류0을 확인했다. `node tools/overview-scroll-browser-check.mjs`의8조건64전환도PASS다. 실제로컬reader126행/기대입력canonical 동일과5자산/1440·390×dark·light UI도PASS, 외부HTTP/JS오류0이다. 과거 full-browser helper의 metadata paragraph 준비조건은 표의 실제 행 준비조건으로 갱신했다. 이 작업의 구현/시험 실패는 없었다.

공식 Canton 문서는 [Scan API 범위](https://docs.sync.global/app_dev/scan_api/index.html), [Bulk Data 경로](https://docs.sync.global/app_dev/scan_api/scan_bulk_data_api.html), [OpenAPI](https://docs.sync.global/app_dev/scan_api/scan_openapi.html)를 재확인했다. 공개 CC 관측이력/ACS를 수집하는 API 경로가 문서에 있다. 실제 mainnet 접근·응답·인증/비용·집계 검증은 아직 하지 않았다. DSO관측을 Canton전체기관거래로 확대하지 않으며USDCx전체공급/전송공개범위는별도확인이다. 세부관측과문서링크404/동적디렉터리미렌더링은 [연구범위](2026-10-28-canton-public-data-scope.md)에추가기록했다. 이문서검토를실데이터확보로표현하지않는다. 기존18대상/30일540GET 승인에Canton을추가하지않았다.

검증로그/스크린샷/실제화면요청은 .state/usage-table-copy-20261028 사설보존. 실제iPhone/WebKit시험은아니며Chrome호환성에뮬레이션이다. 전체 npm run check와 diffcheck의최종결과는아래기록을따른다. 현재로컬서버는정적파일을읽으므로새로고침하면UI수정이적용되며운영서버배포는하지않았다.

최종검증: npm run check =755pass/0fail(일반681+네트워크차단74), browser4화면·기존스크롤64전환·실제reader/5자산UI PASS, diffcheck오류0. Canton은문서확인만했으며actualAPI표본/인증/비용/전체성은NOT_TESTED다.
