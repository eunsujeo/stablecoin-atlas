# 엔화 스테이블코인·네트워크 수집 조사

2026-10-22 UTC 확인. 사용자 요청은 JPYSC·JPYC 추가와 기존 코인을 포함한 코인별 최대10개 네트워크의 **검토·설계**다. 아래는 조사 관측이며 실제 registry/DB 등록·자동수집 연결·호환성 PASS가 아니다. 구현 설계는 [확장 설계](../design/YEN_AND_TOP10_NETWORK_COLLECTION.md)를 따른다.

## 자산 식별과 공식 근거

| 자산 | 조사로 확인한 현재 네트워크 | 공식 식별자·주의점 |
| --- | --- | --- |
| JPYC | Ethereum, Polygon, Avalanche C-Chain, Kaia | 네 곳 모두 `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`. 공식 mainnet chain ID는1/137/43114/8217. 현행 전자결제수단형이며 선불형 JPYC와 별개 |
| JPYSC | Ethereum | `0x6781d5631BFe47432b089e64e3EaB3b6eDd26177`. Ethereum 발행과 SBI VC트레이드의 외부 입출고 가능 여부는 별개 |
| RLUSD | XRPL, Ethereum, Base, Ink, OP Mainnet, Unichain, XRPL EVM Sidechain | 공식 목록은7곳. DeFiLlama 응답의 관측 범위는 아래처럼2곳 |

JPYC의 주소/네트워크는 [공식 GitHub 조직](https://github.com/jpycoin)의 Contract Addresses와 선불형 제외 안내를 대조했다. [Kaia 공식 안내](https://www.kaia.io/jpyc)도 같은 주소를 제시한다. 이름/심볼만으로 옛 선불형·브리지 토큰을 현행 JPYC에 합치지 않는다. [공식 개발자 문서](https://faq.jpyc.co.jp/s/article/developer-documentation)는 발행·상환 API가 공개되어 있지 않다고 안내한다. 이 API를 공급량 데이터 공개 API로 가정하지 않는다.

JPYSC는 [Startale 공식 상품 설명](https://www.startale.com/ja/jpysc)의 지원 체인·공식 계약 링크로 Ethereum과 위 주소를 확인했다. [2026-06-24 출시 발표](https://www.startale.com/ja/blog/jpysc-launch)와 [발행 은행 설명](https://www.shinseitrust.com/stablecoin/jpysc.html)은 SBI VC트레이드의 외부 입출고 제한을 명시한다. 공개 계약/공급량이 있다는 사실로 일반 지갑에서 자유롭게 유통 중이라고 판정하지 않는다. 10월의 [상호운용 발표](https://www.startale.com/en/blog/openstandard-startale-sbi)도 상용 결제 개시의 증거로 쓰지 않는다.

RLUSD는 [공식 네트워크 문서](https://docs.ripple.com/products/stablecoin/overview/supported-chains-and-networks)와 [공식 주소](https://docs.ripple.com/products/stablecoin/overview/token-addresses)를 재확인했다. 기존 Ethereum/XRPL 외5곳은 같은 EVM 프록시 주소 `0x8d58c0c60b8d6b88fa98b291a646db34d0f98258`를 제시한다. 이 목록을 공급자의 수량 확보 증거로 바꾸지 않는다. [Circle 공식 목록](https://developers.circle.com/stablecoins/usdc-contract-addresses)과 [Tether 공식 목록](https://tether.to/en/supported-protocols/)도 공급자 집계에 등장하는 브리지 네트워크와 구분해야 한다. Tether의 역사 참고용 폐기 프로토콜을 현행 발행 지원으로 표시하지 않는다.

## DeFiLlama 실제 응답

공식 [무료 API 설명](https://api-docs.defillama.com/llms-free.txt)을 확인하고, 기존 수집기와 별도로 공개 목록1건·새 자산 상세2건을 읽었다. Arkham 추가 인증 호출과 외부 RPC 호출은0건이다. 기존 서비스의 수집 일정은 변경하지 않았다. 아래 목록의 시각은 수신/정리 시각이며 공급자가 모든 체인을 동시에 관측한 시각의 인증은 아니다.

| 자산 | provider asset ID | gecko_id | pegType | 목록에서 확인한 체인 수 |
| --- | --- | --- | --- | --- |
| USDT | 1 | tether | peggedUSD | 130 |
| USDC | 2 | usd-coin | peggedUSD | 157 |
| RLUSD | 250 | ripple-usd | peggedUSD | 2 |
| JPYC | 355 | jpycoin | peggedJPY | 4 |
| JPYSC | 427 | jpysc | peggedJPY | 1 |

목록은 `https://stablecoins.llama.fi/stablecoins?includePrices=true`를2026-10-22T06:24:36.021Z에 정리했다. 모든 체인 수에는 브리지·잔액0·역사적 대상이 포함될 수 있으며 공식 네이티브 발행 수가 아니다. 현재 값 내림차순의 **공급자 집계 후보**는 다음과 같다. 심볼 일치만으로 정식 계약 매핑을 완료한 목록은 아니다.

| 자산 | 공급자 환산 유통가치 기준 후보 순서 |
| --- | --- |
| USDT | Tron → Ethereum → BSC → Solana → Arbitrum → Polygon → Plasma → TON → Aptos → Mantle |
| USDC | Ethereum → Solana → Hyperliquid L1 → Base → Arbitrum → Polygon → BSC → Arc → Avalanche → Stellar |
| RLUSD | Ethereum → XRPL |
| JPYC | Polygon → Ethereum → Kaia → Avalanche |
| JPYSC | Ethereum |

Hyperliquid L1과 HyperEVM은 다른 네트워크다. `BSC`/`Polygon` 같은 공급자 표시명만으로 공식 네이티브 토큰 여부를 추정하지 않는다. 특히 USDT0·USDC.e·수탁 브리지 등은 원자산 연결 근거와 중복 집계 정의가 필요하다.

### 단위: 목록 값과 상세 수량은 다르다

공급자 공개 코드 [getStableCoins.ts](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/api2/cron-task/getStableCoins.ts)는 목록의 `circulating`과 `chainCirculating.current`를 가격/환산 계수로 곱한 **USD 가치**로 만든다. `peggedJPY`라는 키가 붙어도 JPY 금액이나 토큰 수량을 의미하지 않는다. 공개 응답의 `price`가 null일 때 내부 FX fallback이 사용될 수 있으므로 나눗셈으로 토큰 수량을 복원하지 않는다. USD 코인의 목록 값도 수량으로 재사용하지 않는다.

반면 [상세 응답 구성](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/api2/routes/getStableCoin.ts)의 `chainBalances[chain].tokens[].circulating[pegType]`·`minted[pegType]`는 수량 이력이다. 상세355에서는 오늘 Polygon 유통량이 `1705094984.490735` JPYC로 관측됐으며, 목록의 약1,072만이라는 USD 값과 구분된다. 서로 다른 수신 시각의 값을 같은 snapshot인 것처럼 합치지 않는다.

공개 소스는 commit `20a43a23318159f9b875548143dee12a0c068c80`으로 고정해 읽었다. 실제 API 배포 바이너리가 그 commit과 동일함을 인증한 것은 아니다. 공급자 계산은 JavaScript Number를 사용하므로 응답 숫자 lexeme를 문자열로 보존해도 이미 공급자에서 발생한 반올림은 복구할 수 없다.

### 새 자산의 일별 이력·정의

| 자산/네트워크 | 확보한 일별 점 | 최초일 | 최신일 |
| --- | --- | --- | --- |
| JPYC Ethereum/Polygon/Avalanche 각각 | 237 | 2026-02-28 | 2026-10-22 |
| JPYC Kaia | 93 | 2026-07-22 | 2026-10-22 |
| JPYSC Ethereum | 93 | 2026-07-22 | 2026-10-22 |

상세355/427은 각각2026-10-22T06:27:10.912Z/.991Z에 정리했다. 오늘 점은 하루 최종 확정값이 아니다. 최초 관측일을 발행 시작일로 해석하거나 이전 날짜를0으로 채우지 않는다.

[JPYC 공급자 Adapter](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/src/adapters/peggedAssets/jpycoin/index.ts)는 총공급에서 발행·상환 대기분을 제외하는 정의를 사용한다. 이번 조사에서 관련 계정 수집/열거/RPC나 서비스 장부 검증을 하지 않았다. 공급자 정의로만 기록하며 자체 입증 유통량으로 표시하지 않는다.

[JPYSC Adapter](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/src/adapters/peggedAssets/jpysc/index.ts)는 totalSupply를 circulating으로 취급한다. 공식 외부 입출고 제한을 함께 기록해야 하며 공개 시장 유통량/유동성으로 인증하지 않는다. `minted`도 [공급 함수](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/src/adapters/peggedAssets/helper/getSupply.ts)의 발행 잔액 계열이므로 당일 민팅량·누적 민팅 이벤트 총량·소각량이 아니다.

## Arkham 현재 저장본의 범위

추가 호출 없이2026-10-22T06:25:10~21Z의 기존 collected projection을 읽었다. `/token/holders/usd-coin`의 총공급 분포는8곳(Ethereum, Solana, HyperEVM, Base, Arbitrum One, Polygon, Avalanche, Optimism), Tether는4곳(Tron, Ethereum, Solana, Avalanche), RLUSD는Ethereum1곳이었다. 이 범위만으로 상위10 유통량을 완성할 수 없다. DeFiLlama의 Hyperliquid L1을 Arkham의 HyperEVM에 매핑하지 않는다.

JPYC/JPYSC의 Arkham endpoint 존재·계정 권한·단위는 이번에 호출해 확인하지 않았다. gecko_id가 있다고 Arkham pricingId로 자동 등록하지 않는다. 신규404 하나로 기존3코인 수집 전체가 실패하는 현재 일괄 실행 구조를 먼저 분리해야 한다.

## 보존·재현

원문은 Git 제외 `.state/yen-expansion`에 private로 보관했다. 원문을 웹이나 Git에 게시하지 않는다. 다음 hash는 무결성 연결용이며 공식 발행/공급량 인증이 아니다.

| 원문 | bytes | SHA-256 |
| --- | --- | --- |
| 목록 | 553084 | eadfcef3c15e011339187a5046e3864dc00dcfc67a7d0cca8012b063e89b7d15 |
| 상세355 | 107386 | fb42936bc69a73c897b0a8f0e37e37de7e393ce208b7f8df4bd550e22c91afbe |
| 상세427 | 15572 | 93d24ea738165c858872083088f27c5b55b60da9a1a8ad9172d18ba864937e37 |

`.state/yen-expansion/source-manifest.json`과2개 top10 요약은 로컬 재현 보조물이다. 공급자 목록의 아주 작은 값에 exponent 표기도 있었으므로 구현 시 bigint 기반의 제한된 정확 십진 정규화를 설계한다. 조용한 Number 변환·반올림·0 치환은 하지 않는다.
