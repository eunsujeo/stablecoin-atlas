# 저장 시장 그래프
- 목표: 첨부한 시장 화면 수준의 목록 추세선·큰 영역형 그래프를 기존 로컬 UI에 추가한다.
- 변경 파일: web/market-chart.js, web/market-chart.test.mjs, web/market-view.js, web/overview.js, web/index.html, web/styles.css, tools/ui-preview.mjs, docs/MARKET_CHARTS.md, docs/DEVELOPMENT_STATUS.md
- 검증: 모델3개/관련 UI32개 통과. Chrome의 실제 저장 자료·키보드·출처·지표/기간·코인/네트워크·다크/라이트/390px·실패 시 이전 차트 유지·누락·Overview 추세선 검증 통과, 외부 요청0건. 별도의 브라우저 내부80점 QA 자료로 영역/기간 필터도 확인했으며 저장하지 않았다. 최종 전체 검사의 종료 코드와 pass/fail은 세션 최종 응답 및 .state/agent-logs/market-chart-check.log 참조.
- 남은 문제: 일부 가격은 실제 저장1점으로 추세 미확보. 그래프를 채우기 위한 외부 조회·가상 과거 값은 추가하지 않았다. 거래량/수집 한도 조사는 docs/research/arkham-volume-and-budget-review.md 참조. 다른 PC 검증은 미실행.
- 다음 행동: 로컬 #live의 그래프를 확인한다. 시계열의 비교 범위·마지막 저장 관측 기준 기간·세로축 확대 의미는 docs/MARKET_CHARTS.md를 유지한다. 실제 자료 수집은 기존 수동 단발 경계다.
- 미회수 Agent/Lead id: 없음. 기존 AGENTS.md 및 Router 인계/README 변경은 보존했다.
