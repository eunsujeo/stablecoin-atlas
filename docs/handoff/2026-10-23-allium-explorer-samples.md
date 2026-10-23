# Allium Explorer 표본 조회·비교
- 목표: 권한/사용량·5코인 공급량/전송량/발행·소각의 소량 실측과 기존 저장본 비교, 완료 후 commit/push.
- 끝난 것: 사용량 GET·compute-profiles GET 모두200. 할당 기간/주기 null, 할당량0을 무료/잔여0으로 해석하지 않았다. 사용자가 화면도 비어 있고 거의 무제한이라고 설명한 후 제한된 실행을 진행했다. SELECT4개 각각 저장/실행1회, 재시도0, 각 상태 조회 최대10회·2초 간격. 고정 Ethereum5주소 registry5행·supply5행·mint/burn5표본·volume0행 성공. 0행은0으로 바꾸지 않았다. USDC/USDT 유통량은 기존 DeFiLlama 같은 날짜 라벨보다 +7.5524%/+17.6807%; 원인 미확인, 자동 대체 안 함. JPYC/JPYSC provider verified=false와 JPYSC prod_ncs_unverified 보존.
- 변경 파일: docs/research/allium-samples/README.md, docs/research/allium-samples/observations.json, docs/research/allium-samples/registry.sql, docs/research/allium-samples/supply-daily.sql, docs/research/allium-samples/supply-change.sql, docs/research/allium-samples/volume-daily.sql, docs/research/allium-data-plan-2026-10-23.md, docs/DEVELOPMENT_STATUS.md
- 검증: python3 .state/allium-analyze.py rc0 validatedRows15, identity/date/duplicate/decimal-string/raw-normalization PASS. 실측4SELECT HTTP200/success. npm run check 최종 결과 .state/agent-logs/allium-explorer-check.log 확인 후 commit/push. SQL 출력금액 문자열이며 원본 수량 컬럼 자료형은 미확인, TO_VARCHAR가 FLOAT 손실을 복구하지 않는다. TIMESTAMP_NTZ 집계 경계도 미확인.
- 기다리는 것: 실행한 쿼리는 전부 success·결과 회수. Lead5481ebb1e0ea47858518d348b81f210d proceed 회수 완료. 이전 Lead6cbad620e2364227804b831418f4d38e의 비용 확인 조건은 후속 사용자 설명과 새 검토로 제한된 실행 진행. 기존 UI/수집기 유지. DB·대시보드 변경 없음.
- 다음 행동: 전송량 제공 최신일/0행 원인 확인, USDC/USDT 정의·시각 차이 분석, 다른 승인 네트워크 등록/공급량 범위 조사 후 상위10선정, 원본 자료형 확인. 새 쿼리는 별도 한정 실행으로 기록하고 기존4개 자동 재실행 금지. private 원문은 .state/allium-sample-probe/, 비교용 기존 저장본은 .state/agent-logs/allium-baseline-*.json. 키·query/run ID를 Git/웹에 게시하지 않는다.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/research/allium-samples/README.md, docs/research/allium-samples/observations.json, docs/DEVELOPMENT_STATUS.md
