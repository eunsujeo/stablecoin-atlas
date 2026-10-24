# 저장 토큰 기본정보·등록·보유자 표본 오프라인 검토
- 목표: 우선순위4의 저장 Allium 토큰 기본정보·Arkham 등록/보유자 표본을 오프라인 검토한다.
- 끝난 것: 기존 가격 보고서2개의 동일 receipt pin과 고정 plan·요청·단일200시도·원문 hash/바이트 수·파일 보호를 대조했다. Allium token1개·Arkham 등록 네트워크8개 중 Ethereum·token-intelligence·holders의 고정 USDC가 로컬 registry/profile과 일치한다. holders의 Ethereum 주소100개는 중복0이며 balance/usd/pctOfCap 숫자를 lexeme로 보존했다. entityTopHolders는 빈 object이고 전체 분포/기관 부재를 뜻하지 않는다. Allium attributes13개 숫자와 생성시각 문자열을 보존했다. 공급량 정의/단위·holders_count 모집단·시장 기준시각·완전성 UNKNOWN, 최소 단위 미검증·비용 UNCONFIRMED를 유지한다. 비공개 .state/provider-token-review/20261024-token-holders-observation.json(0600/디렉터리0700)과 일회성 .state/review-token-holders-offline-20261024.mjs에 보존했다. 입력10파일 불변·API/DB접속0·기존 DB/UI/소비 변경0이다. 현재 공식 주소 재인증이나 제품 parser/지원 판정을 추가하지 않았다.
- 변경 파일: docs/research/provider-data-use-priorities-2026-10-24.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-24-offline-token-holder-review.md
- 검증: node .state/review-token-holders-offline-20261024.mjs rc0 sources4/registryMatches4/holderSample100/unique100/입력10불변/API0/DB접속0·보고서 재독/0600/0700 확인. npm run check rc0 tests492/pass492/fail0/cancelled0/skipped0(.state/agent-logs/token-holders-offline-check.log). git diff --check rc0. 문서 변경이며 제품 코드/시험 추가 없음.
- 기다리는 것: 없음 — 전체 검사 회수. Lead/추가 Agent 없음. 기존 UI는 상시 서비스. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md 유지.
- 다음 행동: 우선순위5의 저장 전송·지갑형·포지션·시장 목록 표본을 오프라인 검토한다. 토큰 컨트랙트 표본과 고객 지갑을 구분하고 커서/누락·필드 단위·확보 범위를 확인한다. 기존 원문/판정/시각·DB/UI를 유지하고 새 API·키·재시도·소비·공급자 전환을 하지 않는다.
- 사용자 확인 필요: 아니오 — 승인된 저장 자료의 오프라인 활용만 진행한다. 새 수집/비용/DB/UI 변경은 별도 확인한다.
- 읽을 파일: docs/research/provider-data-use-priorities-2026-10-24.md, docs/DEVELOPMENT_STATUS.md, tools/provider-capability-plan.mjs, tools/provider-price-review.mjs
