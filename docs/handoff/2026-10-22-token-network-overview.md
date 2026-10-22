# Overview 토큰·네트워크별 공급량 추이
- 목표: 사용자 정정대로 전체 현황 그래프를 코인 전체가 아닌 토큰·네트워크별 자료로 바꾸고 검증 후 push한다.
- 끝난 것: Overview 토큰/네트워크 선택, 등록 deployment별 CHAIN_TOTAL 시계열, 동적 토큰·네트워크 제목/총공급량 설명. 토큰 변경 시 유효한 네트워크를 유지하고 없으면 관측이 있는 네트워크부터 고른다. 재독 후 선택 유지. 자료 미확보 XRPL도 선택 가능하나 빈 상태이며 전체 CIRCULATING/obligations로 대체하거나0으로 만들지 않는다. 네트워크 비교 버튼은 그래프/선택을 함께 바꾸며 키보드 focus를 유지한다. 기간·0기준 공급량 축·DB reader·전문가용 기술 영역은 유지했다. 사용자 질문에는 총공급량과 유통량의 개념 및 현재 자료의 범위 차이를 설명했다.
- 변경 파일: web/index.html, web/overview.js, web/styles.css, docs/DEVELOPMENT_STATUS.md, docs/adr/0043-overview-asset-network-rankings.md, docs/handoff/2026-10-22-token-network-overview.md.
- 검증: npm run check rc=0 tests263/pass263/fail0/cancelled0/skipped0(.state/agent-logs/token-network-overview-check.log). node .state/token-network-overview-qa.mjs http://127.0.0.1:4173 rc=0 PASS:8개 토큰·네트워크/6개 실제 CHAIN_TOTAL의 정확한 수량·2개 XRPL 미확보/전체나 obligations 대체 없음/비교 버튼 focus/새로 읽기 선택 유지/다크·라이트/390px/실제8보고서111항목/선택 후 테두리 제거·키보드 표시/실패 유지/외부 페이지 요청0(.state/agent-logs/token-network-overview-browser.log). git diff --check rc=0.
- 기다리는 것: 기존 DB 미리보기 PID96167/세션41199 유지. 기존 DB scheduler PID61634/세션14126은 기본12회 한도를 변경하거나 중복 실행하지 않았다. 기존 다른 작업의 미추적 docs/handoff/2026-10-22-router-lead-review.md는 손대지 않았다. 새 agent/Lead 없음.
- 다음 행동: 사용자 화면 확인. 네트워크별 유통량이 필요하면 발행사/비유통 물량의 정의와 별도 자료를 확보해야 한다. 현재 CHAIN_TOTAL을 유통량으로 바꾸어 부르지 않는다. 발행·소각 추이/거래량 정의 확인·원격 배포는 후속이며 기술 검증은 전문가용 보조 영역을 유지한다. 기존 DB 연결/역할/보관 경계는 이전 인계문 참조.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/adr/0043-overview-asset-network-rankings.md, docs/handoff/2026-10-22-database-market-preview.md, docs/SUPABASE_SETUP.md
