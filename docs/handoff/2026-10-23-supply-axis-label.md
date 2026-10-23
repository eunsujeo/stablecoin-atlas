# 공급량 축 눈금과 실제 값 구분
- 목표: USDT TRON 유통량 929.02억이 축 눈금 1,000억으로 보이는 혼동 개선. 앞선 Allium 인증 확인을 끝내고 작업하며 완료 후 commit/push.
- 끝난 것: Allium 인증·환경변수 로더 수정은 d13ba3b push 완료, 전체 검사329/pass329/fail0. 공급량 그래프에 눈금(tokens/%) 제목, 1,000억 형식과 불필요한 .00 제거, 가장 큰 네트워크 최신 값의 선 끝 라벨을 추가했다. tooltip 표시 중 최신 라벨을 숨기고 Escape/blur 시 복원한다. 로그 축·실제 금액·증감률 계산은 변경하지 않았다.
- 변경 파일: web/market-chart.js, web/styles.css, docs/DEVELOPMENT_STATUS.md
- 검증: node .state/supply-latest-browser.mjs http://127.0.0.1:4173 rc0. TRON 최신 값=범례, 눈금 분리, 로그 유지, tooltip 표시/복원, dark/light/390px와 증감률, 외부 요청/JS 오류 없음 확인. npm run check 최종 결과는 .state/agent-logs/supply-axis-check.log에서 확인 후 commit/push한다.
- 기다리는 것: 기존 UI와 수집기 유지. Allium 추가 API 요청 없음. 전체 검사 후 commit/push.
- 다음 행동: Allium 공급량·전송량 API 상품 권한/쿼리 경로·비용 확인. 인증 성공은 Ethereum USDC Realtime 통계 한 요청에 한정되며 자동 수집/대시보드 연결은 미구현. 조사 문서 참조.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/DEVELOPMENT_STATUS.md, docs/research/allium-data-plan-2026-10-23.md, web/market-chart.js
