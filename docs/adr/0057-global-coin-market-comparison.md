# ADR0057: 코인 전체 시장 지표와 5코인 비교표

## 결정

Overview의 3코인 유통량/총공급량 랭킹과 미확인 거래량 카드를 5코인 비교표로 대체한다. 등록 index의 USDT·USDC·RLUSD·JPYC·JPYSC를 표시하며 USD 연동 그룹 뒤 JPY 연동 그룹을 배치한다. 토큰 수량 정렬은 같은 연동 통화 안에서만 수행하고 전체 순위는 표시하지 않는다. 가격은 USD, 유통량/총공급량은 각 토큰 수량이다. 가격·공급량 원본은 십진 문자열로 보존한다.

기존3코인은 Arkham PRICE/CIRCULATING/COIN_TOTAL 관측만 사용한다. 엔화2코인은 DeFiLlama 상세 응답의 코인 전체 price/일별 circulating만 사용한다. 필드 부재 시 다른 공급자로 전환하지 않는다. 일별 NETWORK_MINTED·unreleased·bridgedTo를 총공급량으로 해석하지 않는다. 집계 기간·단위가 미확인인 Arkham totalVolume은24시간 거래량으로 표시하지 않는다. 없는 값은 `—`이며0과 구별한다. 표의 업데이트는 표시된 지표 중 마지막 수집시각이고 값의 tooltip은 지표별 원본 기준시각/기준일·수집시각을 구분한다. 토큰 기본정보 hover와 명시적 차트 이동을 제공한다. URL 선택 유지 규칙은 ADR0056 그대로다.

## 공급자 필드 계약

확인한 공급자 정본은 peggedassets-server commit `20a43a23318159f9b875548143dee12a0c068c80`의 [getStableCoin.ts](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/api2/routes/getStableCoin.ts)와 [getStableCoins.ts](https://github.com/DefiLlama/peggedassets-server/blob/20a43a23318159f9b875548143dee12a0c068c80/api2/cron-task/getStableCoins.ts)다. 상세 응답은 totalCirculating의 tokens를 최상위에 배치한다. `tokens[].circulating[coin.pegType]`는 코인 전체 토큰 수량이며 chainBalances 상위10개의 합산으로 대체하지 않는다. catalogue의 USD 환산 유통액을 가격/환율로 나누어 수량을 역산하지 않는다.

`price`는 USD 가격 cache 값이며 자체 기준시각이 제공되지 않으므로 `sourceAsOf=null`이다. fetchedAt은 수집시각만 의미한다. 일별 수량은 fetchedAt의 UTC일보다 늦지 않은 최신 일자를 선택한다. null/부재=MISSING, 음수·잘못된 수량·중복 일자·비자정 date=INVALID, 명시0=AVAILABLE이다. id/symbol/gecko/pegType와 등록된 primaryAddress를 재확인하며 잘못된 전체 수량이 체인 합산으로 바뀌지 않는다. mapper는 `defillama-global-market-v1`로 고정한다.

## 저장과 수집

별도 atlas_registration v3의 immutable coin_market_source에 selection/metadata/coin/raw hash/예약 UTC일/fetchedAt/정규화 projection을 저장한다. `(selection,coin,source_hash,request_day)`는 유일하며 같은 원문 재수입은 최초 시각을 보존한다. 같은 키의 내용 hash가 다르면 충돌로 실패한다. 예약일은 receipt/collection reservation에서 명시 전달하며 fetchedAt에서 추론하지 않는다. 자정 직전 시작한 요청의 완료를 위해 다음날 첫60초까지 허용한다.

v2→v3 owner migration은 기존 reader/writer의 SELECT/INSERT 정책을 같은 transaction에 추가한다. runtime은 최소 권한 writer/reader를 유지하고 v1/v2 조회도 계속 지원한다. 기존 market/history/catalog schema와 데이터는 변경하지 않는다. 고정 일별5코인 수집의 같은 응답으로 network import→coin-market import→기존3코인 history import→예약 완료 순서로 처리한다. 단계 중 COMMIT 응답 유실 시 receipt를 재수입하고 새로운 HTTP는 하지 않는다. 완료 예약의 백필도 명시적 import-only이며 예약 초기화·재조회가 없다. 웹 요청은 외부 API를 호출하지 않는다.

## 검증

정확한 소수/지수·JPY/USD 단위·global/chain 구분·누락/음수/0·identity·UTC 자정, 브라우저 DTO 필드, 같은 연동 통화 내 정렬, explicit provider 부재를 검사한다. 소유 격리 PG17에서 v1/v2 조회, 기존 역할의 원자적 v3 갱신, reader DML/UPDATE·writer DDL/UPDATE/EXECUTE 거부, schema/policy drift·원문 충돌, COMMIT 응답 유실 복구와 완료 예약 백필 HTTP0을 확인한다. 실제 적용·테스트 결과는 최신 인계문을 따른다. 데이터 보관기간·호출 예산·원격 supervisor는 ADR0055의 후속 범위를 유지한다.
