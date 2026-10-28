# 인계: 전체 자산 네트워크 Arkham 메타데이터 완료

사용자 “추가 승인할께”는 직전 제시한 메타데이터4GET/8MiB/120초/재시도0·기존 키·비용UNKNOWN의 고정 계획 승인이다. 실제4GET 모두HTTP200/총885bytes(162/450/215/58)로 완료·소비했다. 기존 키 hash 일치와 기존 root 전체 manifest 보존을 확인했다. Node --use-env-proxy 사용, 우회/재시도/DB/Collector/FX/운영 배포0이다. Allium 수집 종료는 유지한다.

원문/승인/receipt/스크립트는 .state/usage-discovery-live-20261028 및 .state/allium-executor/arkham-network-usage-discovery-20261028-v1에 비공개 보존했다. 소비를 재사용하지 않는다. receiptSHA34213f119f4ea3d54ea4095dbbac8649725a0ba84c7a55271b881339d6ace7d2, 고정 planSHA175d14a1bc2c6324808d3b66116bc247bec6109f7d83ac469258329136c9a011.

등록33쌍: 기존5저장 + 신규13조회후보 + chain목록미등재13 + RLUSD Base/Optimism 정확주소미확보2. 후보는 실제 index/지원 인증이 아니다. 미등재를 지원 불가/0으로 만들지 않는다. HyperEVM과Hyperliquid L1, XRPL과XRPL EVM을 구분한다. 등록33밖 metadata항목도 자동추가하지 않는다.

다음13후보: USDT BSC/Arbitrum/Polygon3, USDC Base/Arbitrum/Polygon/BSC/Avalanche5, RLUSD Ethereum1, JPYC Ethereum/Polygon/Avalanche3, JPYSC Ethereum1. 정확주소는 기존 registry/저장 소스 검토를 사용하고 metadata에 없는8후보는 미확인임을 명시했다. 공식 현행주소 인증으로 승격하지 않는다.

다음 승인안 data/arkham-network-usage-expansion-20261028-plan.json(파일SHA2914dcf96dc7f28c2abd6b8704498c6fae3925cbe8a0a6234c0eebf490934031)에13개의정확 chain/token, 기존5제외, 원래기간2026-10-21~27·일별, 최대13GET/26MiB/300초/요청20초/간격1초/재시도redirect페이지0/첫실패종료/비용UNKNOWN, 새전용slot/기존lock을 고정했다. 아직미승인/실제histogram0. 승인 후 고정목록용collector/확장입력검증을 구현한다. DB형식(v1/35행)/Supabase/UI확장은 현재미변경·별도범위다. 승인 전 시작하지 않는다.

npm run check 총732pass/0fail(일반658+net차단74), 관련25회귀통과. Numeric루트오인과 transport무응답파일테스트 오류를 오프라인에서 수정했다. Lead491a2f... revise후 a921f8... proceed. 수행/실패/수정/검증은 docs/research/2026-10-28-arkham-usage-discovery-result.md. 기존별도untracked docs/handoff/2026-10-22-router-lead-review.md는 건드리지 않았다. 로컬 UI 서버와 과거 실제DB확인은 앞선 network-usage-live 인계문을 따른다. 이번서버재시작/DB조회0.
