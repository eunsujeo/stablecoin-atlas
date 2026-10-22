# 관측 구간 증감 제거와 로딩 스켈레톤
- 목표: 사용자 요청대로 ‘관측 구간 ±수량’을 제거하고 로딩 스켈레톤을 적용한 뒤 검증/commit/push한다.
- 끝난 것: 공통 시장 차트의 첫/끝 관측 차이 문구만 제거하고 현재값·원본 시각·차트/키보드 읽기는 유지했다. web/loading.js의 공통 장식 스켈레톤을 Overview/시장/검증 목록·프로필·비교·보고서/근거 상세/목데이터 차트 첫 조회에 적용했다. aria-busy와 aria-hidden, 올바른 목록/표 구조, 동작 줄이기 설정에서 animation 정지를 적용했다. 재조회는 이전 자료·시각을 유지한다. 성공/실패 모두 원래 미완료 영역만 복원해 스켈레톤을 정리하고 완료된 실제 내용을 덮어쓰지 않는다. WeakMap 소유 토큰으로 이전 근거 상세 응답이 새 dialog의 busy/스켈레톤을 해제하지 못하게 했다. 웹의 공급자 조회/DB 쓰기는 추가하지 않았다.
- 변경 파일: web/loading.js, web/market-chart.js, web/overview.js, web/market-view.js, web/evidence.js, web/app.js, web/styles.css, tools/ui-preview.mjs, docs/MARKET_CHARTS.md, docs/handoff/2026-10-22-loading-skeletons.md.
- 검증: npm run check rc=0 tests263/pass263/fail0/cancelled0/skipped0(.state/agent-logs/loading-check.log). node .state/loading-browser-qa.mjs http://127.0.0.1:4173 rc=0 PASS: 실제 요청 보류로 초기 skeleton/실패 해제/재시도/재조회 기존 값·시각 유지/동시 dialog 소유권/시장·목데이터/다크·라이트·390px/reduced motion/잔여 skeleton0/외부 페이지 요청0(.state/agent-logs/loading-browser.log). node .state/token-network-overview-qa.mjs http://127.0.0.1:4173 rc=0 PASS:8개 토큰·네트워크/6개 정확한 CHAIN_TOTAL·2개 XRPL 미확보/선택 유지·키보드·기술 검증 분리/기존8보고서111항목(.state/agent-logs/loading-regression-browser.log). git diff --check rc=0.
- 기다리는 것: 새 loading.js 정적 경로 반영을 위해 이 세션이 관리하던 이전 DB preview PID96167을 정상 종료하고 같은 reader 설정으로 재시작했다. 현재 DB preview PID40572/세션80210 유지. 기존 DB scheduler는12회 한도로 종료했고 재시작하지 않았다. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md는 손대지 않았다. 추가 agent/Lead 없음.
- 다음 행동: 사용자 화면 검토. 첫 조회와 기존 값이 있는 재조회 동작을 구분해 유지한다. 토큰·네트워크별 그래프는 CHAIN_TOTAL, XRPL 미확보는 다른 지표로 대체하지 않는다. 원격 배포/발행·소각/거래량 정의는 기존 후속 범위다.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/MARKET_CHARTS.md, docs/handoff/2026-10-22-token-network-overview.md, docs/handoff/2026-10-22-database-market-preview.md
