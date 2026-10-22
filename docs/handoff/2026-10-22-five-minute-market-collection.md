# 5분 시장 자동 수집
- 목표: 사용자 요청의5분 자동 수집으로 로컬 UI에 실제 관측 이력을 누적한다. 첨부 CoinGecko/DefiLlama는 그래프 참고이며 없는 과거/전체 시장 합계를 만들지 않는다.
- 끝난 것: 별도 market:watch CLI, 기본12회/최대84 GET·명시1~288회 예산, 단조 시계300초 간격·지연 슬롯 생략·scheduler/기존 writer 잠금·오류 무재시도 중단·signal drain·안전한 UI 실행 기록. JSON publisher를 재사용하며 DB 자동 이전/Supabase 연결은 아직 없다. 실제2회/14 GET 성공으로30→48→66관측. 시작 간격300.005초를 확인했다. 전체253검사 통과.
- 변경 파일: tools/market-watch.mjs, tools/market-collect.mjs, tools/market-store.mjs, web/market-model.js, web/market-view.js, web/market-watch.test.mjs, package.json, docs/MARKET_AUTO_COLLECTION.md, docs/adr/0041-five-minute-market-collection.md, docs/DEVELOPMENT_STATUS.md, docs/NEW_PC_SETUP.md
- 검증: npm run check rc=0 tests253/pass253/fail0/cancelled0/skipped0(.state/agent-logs/market-watch-check-final.log). node --test web/market-watch.test.mjs rc=0 tests5/pass5/fail0. node .state/market-watch-browser-qa.mjs 로컬 미리보기 rc=0 PASS1/fail0, dark/light/390px·실제 그래프·자동 수집 기록·실패 유지·외부 페이지 요청0. git diff --check rc=0. 실제 수집2회/총14 GET 성공, .state/agent-logs/market-watch-real-runs.log.
- 기다리는 것: 사용자 로컬 확인용 UI PID48479(실행 세션42221)와 collector PID48600(실행 세션89393)을 유지한다. 현재2/12회 완료·WAITING. 수집 기본12회 후 종료, UI는 계속 실행한다. Lead4d6e33f3c24b414c865cd3755e5ad20b는 answered/proceed이며 미회수 검토 없음. 다음 예정은 실행 기록으로 확인하며 비정상 종료 후 잠금 강제 회수 금지.
- 다음 행동: 실행 상태/관측 이력을 확인하고 사용자 후속 요청에 따라 Supabase 전용 역할·TLS·DB 수집 연결을 진행한다. 현재 프로세스가 실행 중이면 새 scheduler를 시작하지 않는다. 다른 세션의 router/handoff 변경은 건드리지 않는다.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/MARKET_AUTO_COLLECTION.md, docs/adr/0041-five-minute-market-collection.md, docs/POSTGRESQL_MARKET_CLI.md, docs/DEVELOPMENT_STATUS.md
