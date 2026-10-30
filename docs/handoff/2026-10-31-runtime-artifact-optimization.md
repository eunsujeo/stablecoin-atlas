# 운영 runtime artifact 최적화
- 목표: 본문병목의 전송량/반복다운로드를 줄이고 보안/180초·96MiB를 유지해 검사후별도commit/push.
- 끝난 것: 운영8진입점 read-only import추적, pg14패키지closure/런타임source선별·전체native파일보존·압축9·CI추출import. 완성ZIP cache(root-only, fresh후보/재hash·manifest,2개보관)·부분재개0·no retry. metadata/본문/검증/cache/CLI 전체시간·bytes·속도·고정실패 계측. 로컬 ZIP29.20MB→0.545MB/98.13%감소·정책hash2개동일·실제추출import8PASS. Macmini/Collector/FX/Supabase/CF/DB·proxy변경/공급자조회0, 하위에이전트0.
- 변경 파일: .github/workflows/production.yml, tools/deploy/build.mjs, tools/deploy/runtime-files.mjs, tools/deploy/runtime-smoke.mjs, tools/deploy/artifact-cache.mjs, tools/deploy/operation-timing.mjs, tools/deploy/github.mjs, tools/deploy/bootstrap.mjs, tools/deploy/apply.mjs, tests/deploy-automation.test.mjs, tests/deploy-runtime.test.mjs, tests/deploy-artifact-cache.test.mjs, docs/AUTOMATED_DEPLOYMENT.md, docs/adr/0123-runtime-artifact-and-verified-cache.md, docs/research/2026-10-31-runtime-artifact-optimization.md, docs/handoff/2026-10-31-runtime-artifact-optimization.md
- 검증: targeted rc0/78pass/0fail/cancelled0/skip0, offline size/import audit rc0/PASS. npm run check rc0/831pass/0fail/8skip/cancelled0(757+74pass), 기존compiler누락8skip. git diff --check rc0.
- 기다리는 것: 없음
- 다음 행동: 전체검사후이번16파일만commit/main push. 비대상새PC문서2개보존. 운영pin/install/실다운로드는직접수행하지않는다.
- 사용자 확인 필요: 아니오 — 검사/commit/push 명시승인.
- 읽을 파일: docs/research/2026-10-31-runtime-artifact-optimization.md, docs/adr/0123-runtime-artifact-and-verified-cache.md
- 자동 새 대화 예약: 안 함 — 사용자요청완료후보고.
