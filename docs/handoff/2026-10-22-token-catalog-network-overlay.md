# 기본정보 DB와 네트워크별 공급량 그래프
- 목표: 토큰 기본정보 DB 저장·hover 설명, 선택 토큰의 여러 네트워크 공급량을 한 그래프에 표시, 하단 업데이트 시각만 유지.
- 끝난 것: private atlas_catalog 설치·8개 공식 출처 프로필 등록·reader SELECT 조회. 재등록8건 unchanged, 기존 시장462/네트워크78 관측 보존. Overview 모든 네트워크 기본값·색상 범례·개별 필터·공통 시간/0 기준 축·정확한 수량 툴팁. 자료 없는 XRPL을 합산/0 처리하지 않음. 기본정보 hover/focus/Enter/Escape/mobile와 출처 링크 구현. DB 시각/관측 수 설명은 Overview 하단에서 제거.
- 변경 파일: db/catalog/001-initial.sql, data/token-profiles.json, tools/market-db/catalog.mjs, tools/market-db/catalog-cli.mjs, tools/market-db/preview.mjs, tools/market-db/schema.mjs, web/token-profile.js, web/token-profile-model.js, web/market-chart.js, web/overview.js, web/market-view.js, web/styles.css, tests/catalog-model.test.mjs, tests/postgres/catalog.test.mjs, web/market-chart.test.mjs
- 검증: npm run check rc0 tests266/pass266/fail0; npm run check:db rc0 tests12/pass12/fail0. Chrome .state/catalog-browser-qa.mjs rc0, .state/catalog-regression-qa.mjs rc0; 실DB8개 프로필, 여러 네트워크 선, 정확한 값, mobile390px, dark/light, keyboard, XSS/URL 거부, 외부 요청0. 실제 Supabase verified TLS, core fingerprint/facts 보존, 추가 공급자API0.
- 기다리는 것: 없음. Lead c2f23d898e9c4f85b3fd1386d19115ac 응답 proceed 회수 완료. 읽기 UI PID70286/포트4173 유지, writer 수집기는 이전12회 완료 후 종료한 상태.
- 다음 행동: 사용자 다음 요청부터 진행. 체인 RPC 공급량 수집 확대는 이번에 구현하지 않음. 기본 JSON 모드는 DB 프로필을 가장하지 않음. unrelated docs/handoff/2026-10-22-router-lead-review.md는 다른 작업 파일로 유지.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/adr/0045-token-profile-catalog-and-popovers.md, docs/MARKET_CHARTS.md, docs/POSTGRESQL_MARKET_CLI.md, docs/DEVELOPMENT_STATUS.md
