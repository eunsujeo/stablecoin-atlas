# Overview 종합 결과
- 목표: 기본 화면에 범위별 시나리오 통과 점수·잠정 등급·판정 완료 비율·결과 건수와 시장 순위를 표시한다.
- 변경 파일: web/index.html, web/evidence.js, web/overview.js, web/overview-model.js, web/overview.test.mjs, web/styles.css, web/market-model.js, tools/market-store.mjs, tools/market-collect.mjs, tools/ui-preview.mjs, docs/adr/0038-overview-scenario-results.md, docs/DEVELOPMENT_STATUS.md
- 검증: npm run check rc0/241pass/0fail/0cancelled/0skipped. 점수·지표 모델5개 포함. Chrome Overview·시장·근거의 다크/라이트·390px·기본/직접 경로·음성FAIL 이동·읽기 실패 유지·외부 요청0건 확인.
- 남은 문제: totalVolume 기간·단위 미확인이므로 거래량 순위는 보류한다. 근거 없는24h/USD 가정은 금지한다.
- 다음 행동: ADR0038의 지표 의미를 유지하고 실제 거래량 정의가 확인되면 해당 순위를 연결한다.
- 미회수 Agent/Lead id: 없음. 50b76a3c34b54c2fafa333091bcfccb2 응답 proceed.
