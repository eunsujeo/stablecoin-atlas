# DeFiLlama 네트워크별 일별 유통량 조사

2026-10-22 · 사용자 승인: 기존 네트워크별 그래프에 과거3개월/1년 추이를 연결한다. 구현 결정과 DB/화면 연결은 [ADR0046](../adr/0046-daily-network-circulation-history.md)을 따른다.

## 공식 자료와 의미

- [무료 API 문서](https://api-docs.defillama.com/llms-free.txt)의 stablecoin/{asset}는 스테이블코인의 과거 체인 분포를 제공하며 인증이 필요 없다. 유료 Pro는 이번 자료 조회에 사용하지 않는다.
- 실제 공개 stablecoins.llama.fi 서비스의 stablecoins 목록과 stablecoin/1, /2, /250을 읽어 Tether/USDT/tether, USD Coin/USDC/usd-coin, Ripple USD/RLUSD/ripple-usd의 식별자를 대조했다. 요청은 고정 GET만 사용하고 키/거래/체인 RPC는 사용하지 않는다.
- [Tether 공식 공급자 코드](https://github.com/DefiLlama/peggedassets-server/blob/master/src/adapters/peggedAssets/tether/index.ts), [USDC 공급자 코드](https://github.com/DefiLlama/peggedassets-server/blob/master/src/adapters/peggedAssets/usd-coin/index.ts)는 발행량·미유통량·브리지 관련 값을 별도 처리한다. `chainBalances[chain].tokens[].circulating.peggedUSD`는 공급자의 네트워크별 유통량이다. 가격을 곱한 USD 시총이나 특정 계약 totalSupply() 관측으로 바꾸지 않는다.
- 원본 minted/circulating/bridgedTo/unreleased를 비교해도 현재 Arkham CHAIN_TOTAL과 다른 값이 확인된다. 따라서 두 공급자 이력을 한 선으로 이어 붙이지 않는다. 공급자 집계는 등록 계약 한 개만의 수량으로 인증하지 않는다.

## 이번에 확보한 범위

등록 네트워크만 선택하면 USDT Ethereum/Tron/Solana, USDC Ethereum/Solana/XRPL, RLUSD Ethereum/XRPL의8개 시계열이 있다. 각 시계열은2025-10-22~2026-10-22의366개 원본 일별 관측을 포함한다. 원본 JSON은 비공개 `.state`에 있으며 전체 원문·공급자 집계 밖 체인/지갑 정보를 Git/웹에 싣지 않는다.

USDT/USDC 전체 응답은 각각 약21/22MiB여서 초기8MiB 읽기 한도에 도달했다. 같은 endpoint를32MiB 한도로 제한해 다시 확인했다. HTTP 차단이나 자격 증명 오류가 아니며 다른 endpoint/프록시로 우회하지 않았다. 앞으로 명시 수집 CLI도 응답당32MiB·깊이32·30초·고정3회 이내로 제한한다. 실패 시 자동 재시도/공급자 전환은 없다.

JSON reviver의 context.source로 수량의 원본 십진 숫자 문자열을 보존한다. 표본은 금액 Number 변환/반올림 없이 정규화했다. 중복 날짜·비일별 timestamp·음수·범위 밖 소수 정밀도·다른 자산 식별자는 거부한다. 조회 구간 밖 날짜는 제외하며 누락을0이나 보간값으로 채우지 않는다.

## 최신값의 한계와 화면 제안

XRPL USDC/RLUSD에도2026-10-22 기준 일별 값이 있다. 이 시각의 실시간 공급량이나 분 단위 현재값을 뜻하지 않는다. 공급자 기준일과 자료 다운로드 시각은 별도 보존한다. 기존 XRPL obligations는 범위가 다른 지표로 유지한다.

Overview의 지표 선택에 `일별 유통량 · DeFiLlama`와 `최근 총공급량 · Arkham`을 둔다. 일별 이력은1년 기본,3개월/30일과 네트워크별 겹침 그래프를 제공한다. 기존0 기준 축과 정확한 값 툴팁을 유지한다. 하단 업데이트는 공급자 일별 기준일이며, 다운로드 시각을 최신 원장 관측으로 표시하지 않는다.

## DB 설계

기존 market/catalog v1 hash와 fact/수집기 권한을 유지하는 별도 private atlas_history에 연결한다. 소스 원문은 비공개 hash 아카이브, DB에는 coin/network 단위 유통량·원본 hash·수집시각·기간이 든 최대512KiB 불변 스냅샷을 둔다. 고정3개 자산·8개 네트워크·366일 한도, 최신 스냅샷 인덱스와 동일 hash 멱등성, owner만 명시 설치/import/grant, reader SELECT/RLS, 자체 구조 hash/권한 검증을 적용한다. 웹 요청과 서버 시작으로 외부 수집하지 않는다. 검토 bridge 전달 실패 후 사용자가 이번 작업을 단독 검증 후 진행하도록 승인했다.
