# Arkham·Allium API 접근 표본 검사 — 2026-10-24

실제 검사 완료 시각: 2026-10-23T23:12:43.341Z UTC. [ADR0083](../adr/0083-bounded-provider-capability-probe.md)의 사용자 승인 단발 검사다.

## 결론

- 새 표본45개를 검사했다. Arkham20·Allium REST9·SQL16이다. 이전 두 지리 거절을 재호출하지 않았고 별도12개 세부 항목은 NOT_TESTED로 구분한다.
- Arkham: HTTP200 JSON14, 요청 인자 오류3, HTTP200 응답 크기 초과2, HTTP500 1. 이번 표본에서 HTTP401/403은 없었다.
- Allium REST: HTTP200 JSON7, 요청 인자 오류1, HTTP500 1. SQL: 실행 성공·확인값1행6, INVALID_TABLES7, 상태 확인창 내 완료 미확인3.
- JSON 응답 확보는 해당 표본 호출 결과이며 모든 필드/자산/체인/기간의 지원·자료 품질을 인증하지 않는다. SQL은 금액/주소 대신 고정 확인값만 조회했다.

## 실행·보존

아래 호출 수는 고정 authorization에 묶인 인증 표본 검사다. 준비 단계의 공개 문서 직접 GET2건은 인증 키 없이 각각403을 받았고 별도로 보존했다. 그 문서 응답을 실제 계정 권한 거절로 해석하지 않는다. 웹 검색/문서 열람도 인증 표본 수에 포함하지 않는다.

실제 105HTTP(Arkham20/Allium85)·SQL 실행 요청16회·보존 응답7448975bytes, 재시도0·페이지 추가0·usage0. 기존 모든 archive bytes/권한 manifest 보존 확인. 앞선 지리 검사/진단과 관련 실제 누적19run/116HTTP이며 조직/타PC 한도나 비용 상한을 인증하지 않는다. 원문·키·계정/query/run 식별자·승인·개별 증거 hash는 비공개 .state에만 보존했다.

각 SQL은 상태3회까지만 읽었다. catalog/balances_daily/supply_change는 마지막 관측 기준 완료 미확인이다. 쿼리를 다시 보내거나 추가 상태 조회/취소를 하지 않았으며 서버 실행 종료·비용 최종성은 미확인이다. 순차 송신은 서버에서 이전 미완료 run이 계속 실행되지 않음을 보장하지 않는다.

## Arkham 20개

| 자료 | 고정 GET 표본 | 결과 |
| --- | --- | --- |
| 토큰 체인 주소 | `/token/addresses/usd-coin` | HTTP200 JSON 응답 확보 |
| 토큰 기본정보 | `/intelligence/token/ethereum/{USDC}` | HTTP200 JSON 응답 확보 |
| 시장정보 | `/token/market/usd-coin` | HTTP200 JSON 응답 확보 |
| 가격 이력 | `/token/price/history/usd-coin` | HTTP200 JSON 응답 확보 |
| 상위 보유자 | `/token/holders/ethereum/{USDC}` | HTTP200 JSON 응답 확보 |
| 주소 잔액 | `/balances/address/{USDC}` | HTTP200 JSON 응답 확보 |
| 기관 잔액 | `/balances/entity/binance` | HTTP200 JSON 응답 확보 |
| 기관 포트폴리오 | `/portfolio/entity/binance` | HTTP400 요청 인자 확인 필요 |
| 기관 이력 | `/history/entity/binance` | HTTP200 JSON 응답 확보 |
| 전송 | `/transfers?base=binance&chains=ethereum&limit=1` | HTTP200 JSON 응답 확보 |
| 유입·유출 | `/flow/entity/binance` | HTTP200; 2MiB 초과·잘림 |
| 토큰 주요 흐름 | `/token/top_flow/ethereum/{USDC}` | HTTP400 요청 인자 확인 필요 |
| 거래 상대방 | `/counterparties/entity/binance` | HTTP500 서버/표본 원인 미확인 |
| 토큰 volume | `/token/volume/ethereum/{USDC}` | HTTP400 요청 인자 확인 필요 |
| 기관 volume | `/volume/entity/binance` | HTTP200; 2MiB 초과·잘림 |
| 기관 정보 | `/intelligence/entity/binance` | HTTP200 JSON 응답 확보 |
| 위험 점수 | `/risk/entity/binance` | HTTP200 JSON 응답 확보 |
| 대출·차입 | `/loans/entity/binance` | HTTP200 JSON 응답 확보 |
| Hypercore 현물 잔액 | `/hypercore/entity/binance/spot-balances` | HTTP200 JSON 응답 확보 |
| Polymarket 담보 잔액 | `/polymarket/wallet/{USDC}/summary/balance` | HTTP200 JSON 응답 확보 |

portfolio 오류는 `time is required`, top_flow는 `timeLast is required`, token volume은 `granularity is required`였다. 유효한 값/단위는 미확인이며 이 오류를 권한 부재나 API 미지원으로 바꾸지 않는다. 거래 상대방의500 원인은 미확인이다. 일반 기관 흐름/volume 응답은 HTTP200이었지만2MiB 상한에서 잘라 완전한 JSON/자료 검토를 하지 않았다. 다른 endpoint로 대체하거나 같은 요청을 반복하지 않았다.

## Allium REST 9개

| 자료 | 고정 읽기 표본 | 결과 |
| --- | --- | --- |
| 최신 가격 | POST `developer/prices` | HTTP200 JSON 응답 확보 |
| 가격 이력 | POST `developer/prices/history` | HTTP200 JSON 응답 확보 |
| 가격 통계 | POST `developer/prices/stats` | HTTP200 JSON 응답 확보 |
| 토큰 기본정보 | POST `developer/tokens/chain-address` | HTTP200 JSON 응답 확보 |
| 현재 지갑 잔액 | POST `developer/wallet/balances` | HTTP400 요청 인자 확인 필요 |
| 지갑 거래 | POST `developer/wallet/transactions?limit=1` | HTTP200 JSON 응답 확보 |
| 지갑 PnL | POST `developer/wallet/pnl` | HTTP500 서버/표본 원인 미확인 |
| DeFi 포지션 | POST `developer/wallet/positions` | HTTP200 JSON 응답 확보 |
| 시장 목록 | GET `markets?quote_asset=USDC&limit=1` | HTTP200 JSON 응답 확보 |

지갑형 주소 표본은 고객이 아닌 USDC 토큰 컨트랙트다. 잔액은 공식 문서 예시 형식의 단일 object body에 `invalid request`를 반환했다. 이 결과는 유효한 지갑 조회를 검증한 것이 아니며 body 스키마 추가 확인이 필요하다. PnL500은 서버/계정 표본/지원 조건 중 원인이 미확인이다. DeFi와 시장 목록의200은 모든 프로토콜/시장 candle·funding·OI·청산 API의 권한을 보장하지 않는다.

## Allium SQL 16개

| 테이블 | 조건 | 결과 |
| --- | --- | --- |
| `stablecoins.registry.catalog` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 상태3회 이내 완료 미확인 |
| `stablecoins.registry.deployments` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 성공·확인값1행 |
| `stablecoins.core.transfers` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 성공·확인값1행; 개별 SOURCE_REVIEWED |
| `stablecoins.core.balances_daily` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 상태3회 이내 완료 미확인 |
| `stablecoins.core.supply_change` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 상태3회 이내 완료 미확인 |
| `stablecoins.core.supply_daily` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 성공·확인값1행; 개별 SOURCE_REVIEWED |
| `stablecoins.metrics.volume_daily` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 성공·확인값1행; 개별 SOURCE_REVIEWED |
| `allium_identity.aggregates.entity_wallet_registry` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `allium_identity.aggregates.cex_deposits_withdrawals` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `allium_identity.aggregates.entity_balances_daily` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `allium_identity.aggregates.category_balances_daily` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `allium_identity.aggregates.geo_balances_exchanges_added_daily` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `allium_identity.aggregates.stablecoin_top_holders` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `allium_identity.common.address_labels` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 failed; INVALID_TABLES |
| `ethereum.dex.trades` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 성공·확인값1행; 개별 SOURCE_REVIEWED |
| `ethereum.raw.logs` | 고정 USDC/기관·날짜형 UTC2026-10-22·LIMIT1 | 실행 성공·확인값1행; 개별 SOURCE_REVIEWED |

echo 차이가 있던5개는 전송·공급량·전송량·DEX trades·raw logs다. 대상/토큰/날짜/조건/정렬/LIMIT가 같고 `::DATE`와 `CAST AS DATE`, `::TIMESTAMP_NTZ`와 `CAST AS TIMESTAMPNTZ`만 다른 것을 각각 검토했다. [CAST](https://docs.snowflake.com/en/sql-reference/functions/cast)와 [TIMESTAMP_NTZ/TIMESTAMPNTZ 동의어](https://docs.snowflake.com/en/sql-reference/data-types-datetime)를 확인했다. 원래 receipt/report의 ECHO_REVIEW_REQUIRED는 덮어쓰지 않고 별도 비공개 sql-review.json에 원문/요청/echo/receipt hash를 결합했다. 추가HTTP는0이다. 일반 SQL 정규화나 다른 원문의 자동 승인 규칙은 추가하지 않았다.

Identity7개는 해당 query/run/SQL의 상세에서 `You used invalid tables: <해당 테이블>`을 확인했다. 현재 호출 문맥의 거절이며 전체 Identity 미지원이나 정확한 권한/계약 원인을 확정하지 않는다.

## 이전 관측 재사용 — 새 호출 아님

| 테이블 | 이전 결과 |
| --- | --- |
| `allium_identity.aggregates.geo_balances_daily` | failed·INVALID_TABLES; [allium-geo-balances](../adr/0081-geographic-balance-collection-diagnosis.md) |
| `allium_identity.aggregates.cex_attributed_flows` | failed·INVALID_TABLES; [allium-cex-attributed-flows](../adr/0082-bounded-country-exchange-flow-query.md) |

## 미검증·제외 — 사용할 수 없다는 판정 아님

| 세부 자료/API | 상태와 이유 |
| --- | --- |
| arkham-swaps | NOT_TESTED — 필수 인자 상세 미확보 |
| arkham-transfer-histogram | NOT_TESTED — 필수 인자 상세 미확보 |
| arkham-price-change-and-token-timeseries | NOT_TESTED — 필수 인자 상세 미확보; 대표 가격/이력 API와 별개 |
| arkham-risk-paths-and-label-update-feeds | NOT_TESTED — 위험 점수/기관 정보 표본과 별개인 세부 경로 미검증 |
| allium-sanctions | NOT_TESTED — 실행 테이블/필수 인자 상세 미확보 |
| allium-payments | NOT_TESTED — 제품 설명만 확인; 실행 스키마 미확보 |
| allium-dex-pools-aggregators | NOT_TESTED — DEX 거래 표본과 별개인 풀/애그리게이터 테이블 미검증 |
| allium-bridges | NOT_TESTED — 개별 테이블·스테이블코인 필터 고정 미완료 |
| allium-decoded | NOT_TESTED — 원시 로그 표본과 별개인 해석 이벤트·호출 조건 고정 미완료 |
| allium-market-candles-and-perp-metrics | NOT_TESTED — 시장 목록 표본과 별개; 고정 시장/필수 인자 미확보 |
| allium-wallet-history-and-defi-nav-health | NOT_TESTED — 현재 잔액/PnL/포지션 표본과 별개; 상세 인자 고정 미완료 |
| streams-alerts-and-custom-entities | NOT_TESTED — 연결 유지·상태 변경 기능은 이번 단발 읽기 검사에서 제외 |

## 재개 조건

현재 단발 슬롯은 소비됐고 재실행/재개하지 않는다. 인자 오류는 필수 값/단위의 공식 스키마, 크기 초과는 지원되는 기간/페이지 인자, 미완료 SQL은 별도 후속 읽기 범위를 먼저 고정해야 한다. 스키마 미확보 항목은 정확한 경로·필수 인자·새 고정 예산이 필요하다. 이번 검사로 자동 수집·API fallback·DB/UI·서명/거래·알림/설정 생성은 추가하지 않았다.

후속 [인자 명세 조사와 단발 후보](provider-api-argument-followup-2026-10-24.md)에서 Allium 잔액의 배열 body 근거를 확보했다. 인증 재호출은 하지 않았고 위 실제 결과·소비 상태는 그대로다. Arkham 3건의 인자 값·단위는 계속 미확인이다.

이후 별도 사용자 승인·새 슬롯의 [ADR0084 배열 body 검사](../adr/0084-single-allium-balance-array-probe.md)는 HTTP200 JSON·1HTTP/0run으로 종료됐다. 위45개 원래 표본·HTTP400·실행 수·소비를 수정하지 않고 별도 후속으로 연결한다. 다음 우선순위는 [확보한 자료의 오프라인 활용](provider-data-use-priorities-2026-10-24.md)이다.
