# Stablecoin Atlas Market MISS 쿼리 개선
- 목표: 사용자 운영3299ms/100쿼리 관측을 바탕으로 로컬 분석·최적화·검증·별도 commit/push. 운영 DB/Mac mini·Collector·FX 변경 금지.
- 끝난 것: 새 소유 PG17에서100회=검증80/데이터8/세션12 재현·전체 번호 분류. 같은 READ ONLY REPEATABLE READ 안의 독립 검증 SELECT만 한 SQL로 묶어64회=44/8/12. 모든 역할/권한/schema/RLS/정합성 검사·5분 캐시·풀 유지. 결과는 일회 소비/종료 폐기·이전 facade 차단. writer/collector는 기존 순차 경로. health는 기존 collection_request_latest로 정의별 최신1건 후 원래 그룹/시각/ID 선택.50,205요청 Fixture EXPLAIN에서 전체 external sort37.097ms→인덱스0.058ms. 가상10ms/쿼리 시험1397.1→898.7ms, 운영 개선율은 미확인. Lead667a6bfe5a304c3bb1c02411b5700581 proceed 조건 반영. history v1/v2의 writer_grant 부재 분기를 실행 전 수정했고 최종 시험 실패0. 이번 변경만 단일 commit/push 대상.
- 변경 파일: tools/market-db/{validation-batch,connection,schema,catalog,history,preview}.mjs, tests/market-validation-batch.test.mjs, tests/postgres/market-performance.test.mjs, docs/DEVELOPMENT_STATUS.md, docs/adr/0110-market-miss-query-batching.md, docs/research/2026-10-26-market-miss-performance.md, 이 인계문.
- 검증: npm run check rc0 tests622/pass622/fail0/cancelled0/skipped0; npm run check:production rc0 tests23/pass23/fail0/cancelled0/skipped0; npm run check:db rc0 tests59/pass59/fail0/cancelled0/skipped0; node --test tests/market-validation-batch.test.mjs tests/postgres/market-performance.test.mjs rc0 tests5/pass5/fail0/cancelled0/skipped0; git diff --check rc0. .state/agent-logs/market-miss-{check,production,db,profile-test}.log 및 profile JSON/first-reviewed JSON. 외부/운영 조회0.
- 기다리는 것: 없음
- 다음 행동: 사용자가 제공한 새 SHA의 비밀 제거 ATLAS_API_TIMING MISS 로그를64회 기대치와 비교하고 응답/쿼리/검증 시간을 연구 기록에 추가한다. 로그가 없으면 제공 요청 또는 구체적 후속 작업을 확인한다. 운영 배포/SQL 계획 취득/DB 변경은 시작하지 않는다.
- 사용자 확인 필요: 예 — 새 SHA 계측 로그 또는 구체적 후속 작업 필요. 운영 접근은 이번 요청에서 금지됐다.
- 읽을 파일: docs/research/2026-10-26-market-miss-performance.md, docs/adr/0110-market-miss-query-batching.md, docs/PRODUCTION_DEPLOYMENT.md.

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존·커밋 제외. Git push는 운영 배포가 아니다.
