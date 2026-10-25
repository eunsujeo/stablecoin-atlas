# Stablecoin Atlas Web Reader 성능 개선
- 목표: 첫 페이지 DB/API 병목 분석·최소 로컬 수정·검증·별도 commit/push. 운영 Mac mini/Supabase 적용 금지, Collector/스케줄러/FX 서비스 변경0.
- 끝난 것: API별 비밀 없는 ATLAS_API_TIMING(슬롯 대기·새 연결·권한 검사·쿼리 합계/수·응답), 시장 성공 캐시 기본300초/단일2MiB/동시 refresh 병합/만료 후503, 최대2개 세션 풀(대기8건/10초·idle30초·수명300초). 매 대여 전체 권한 검사·새 facade·이전 참조 차단·쿼리 완료 후 ROLLBACK/DISCARD ALL·오류 폐기·시작/종료 경합 회수. 다른 cache/갱신/응답/Reader 최소 권한 보존. 초기617/22 시험 뒤 시작 실패 정리 추가·최종618/23 통과. Lead7ab018046d204cbdbe8164e3ea439270 revise_plan 조건 반영, 권한 검사 공유 생략. 실제4.7초 원인 비중/운영 개선율 미확인.
- 변경 파일: tools/production-database.mjs, tools/production-web.mjs, tools/web-timing.mjs, tools/ui-preview.mjs, tools/market-db/preview.mjs, tests/production-performance.test.mjs, tests/production.test.mjs, tests/market-db-preview.test.mjs, tests/postgres/production.test.mjs, docs/PRODUCTION_DEPLOYMENT.md, docs/DEVELOPMENT_STATUS.md, docs/adr/0109-web-reader-performance.md, docs/research/2026-10-25-web-reader-performance.md, 이 인계문.
- 검증: npm run check rc0 tests618/pass618/fail0/cancelled0/skipped0; npm run check:production rc0 tests23/pass23/fail0/cancelled0/skipped0; npm run check:db rc0 tests58/pass58/fail0/cancelled0/skipped0; node --test --test-reporter=tap tests/production-performance.test.mjs rc0 tests8/pass8/fail0/cancelled0/skipped0; node --test --test-reporter=tap tests/postgres/production.test.mjs tests/postgres/preview.test.mjs rc0 tests2/pass2/fail0/cancelled0/skipped0; git diff --check rc0. .state/agent-logs/web-performance-{check,production,db,targeted,postgres}.log. 새 소유 PG17만 사용, 외부/운영 조회0.
- 기다리는 것: 없음
- 다음 행동: 사용자가 제공한 새 SHA의 API 타이밍 로그(비밀 제거)를 정본 필드와 대조해 MISS/HIT·연결/권한/쿼리/대기 비중을 기록한다. 로그가 없으면 구체적 후속 요청을 확인한다. 운영 배포/서버 조회/DB 또는 수집 전환은 시작하지 않는다.
- 사용자 확인 필요: 예 — 사용자 제공 계측 로그 또는 구체적 후속 작업 요청 필요. 운영 적용은 이번 요청에서 명시 금지됨.
- 읽을 파일: docs/research/2026-10-25-web-reader-performance.md, docs/adr/0109-web-reader-performance.md, docs/PRODUCTION_DEPLOYMENT.md.

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존하며 이번 커밋에서 제외한다. Git push는 운영 배포가 아니다.
