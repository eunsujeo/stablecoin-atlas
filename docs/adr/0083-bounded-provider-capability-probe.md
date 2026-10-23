# ADR0083 — Arkham·Allium 읽기 API의 단발 접근 표본 검사

## 사용자 요청

2026-10-24 사용자는 앞서 나열한 스테이블코인 자료 API들이 호출되는지 간단한 실제 테스트로 확인하라고 요청했다. 새 수집 상품 구현이 아닌 자료군별 읽기 호출 표본 검사다. 동일 응답이 여러 항목을 다루면 묶고, 조회 성공을 전체 코인/체인/기간·관련 모든 세부 endpoint의 지원 인증으로 바꾸지 않는다. 기존 자료·판정·DB/UI·수집기는 바꾸지 않는다.

## 고정 계획과 출처

`tools/provider-capability-plan.mjs`의 `providerCapabilityPlan()`이 정본이다. Arkham20 GET, Allium REST9 읽기(GET1·조회 POST8), Allium Explorer16 테이블·각 최대1run의 총45개 새 표본이다. Ethereum USDC와 공개 고정 entity `binance`만 사용한다. 지갑형 endpoint의 주소 표본은 USDC 토큰 컨트랙트 자체로, 고객 지갑을 수집하지 않는다. 빈 결과는 해당 표본의 결과이며 일반 지갑의 자료 제공을 인증하지 않는다. Arkham 기본 응답은 기간/개수가 미확인일 수 있으며 첫 응답 바이트만 제한한다. 페이지·다른 주소·다른 체인을 이어서 탐색하지 않는다.

공식 [Arkham 목록](https://arkm.com/llms.txt)의 완성된 path를 사용하고 필수 인자가 상세에만 있는 세부 기능은 계획의 NOT_TESTED에 명시한다. 전송 조회의 base/chain/limit 인자는 [구 공식 문서](https://arkham-intelligence.notion.site/Arkham-API-Access-9232652274854efaa8a67633a94a2595)의 계약이며 현재 인자 오류 가능성을 남긴다. 기존 market/holders 호출은 저장소 수집기에도 사용한 경로다. 개별 최신 문서와 공개 Postman은 이번 열람에서도 접근하지 못했고 Postman 원본 측 응답은 HTTP403·Server cloudflare·HTML·X-Squid-Error 없음이었다. 이를 관리형 프록시 차단으로 단정하거나 우회하지 않는다.

준비 단계의 별도 공개 문서 직접 GET은2건(Postman 및 Allium 공개 openapi 경로), 모두 인증 키 없이 HTTP403이었다. 후자는 원인 미확인의 JSON403이며 현재 키의 API 권한 판정으로 사용하지 않는다. 아래125HTTP 상한과 실제105HTTP는 새 authorization에 묶인 인증 표본만 계수하며 이 준비 문서2건 및 웹 검색/열람 트래픽은 포함하지 않는다.

Allium REST는 공식 가격 최신/이력/통계, 토큰 chain-address, 지갑 잔액/거래/PnL/포지션, 시장 목록의 경로·body를 읽어 고정했다. 가격 이력은 UTC2026-10-22의5분, 거래와 시장 목록은 limit1이다. [API 목록](https://docs.allium.so/llms.txt)과 정본 plan의 각 source 링크를 따른다. 시장 목록은 USDC quote 필터이며 특정 시장의 candle·funding·OI·청산 endpoint를 검증한 것으로 확대하지 않는다.

SQL은 stablecoins.registry의 catalog/deployments, core의 transfers/balances_daily/supply_change/supply_daily, metrics.volume_daily, Identity의 entity_wallet_registry/cex_deposits_withdrawals/entity_balances_daily/category_balances_daily/geo_balances_exchanges_added_daily/stablecoin_top_holders/premium labels, Ethereum DEX trades/raw logs다. 공식 [스테이블코인](https://docs.allium.so/historical-data/stablecoins), [Identity 집계](https://docs.allium.so/historical-data/identity/aggregates), [Premium](https://docs.allium.so/historical-data/identity/premium), [DEX Trades](https://docs.allium.so/historical-data/supported-blockchains/evm/core-schemas/dex/trades), [Logs](https://docs.allium.so/historical-data/supported-blockchains/evm/core-schemas/raw/logs)의 열에만 고정한다. 각 SELECT는 실제 금액/주소/라벨 대신 고정 probe_id만 최대1행 반환한다. 시각 열이 있는 자료는 UTC2026-10-22 하루·USDC로 필터한다. 상품/기관/주소형 메타데이터와 top holders view는 해당 공식 식별자 조건만 사용한다. LIMIT1은 스캔·과금 상한이 아니다.

## 예산과 영속 소비

정본 canonical plan SHA-256은 `149428d2cf485ed5d3489f885656983a74741221f4b8ade0b2110254e903e2dd`다. authorization은 전체 plan/각 SQL 바이트를 함께 포함하며 CLI에서 임의 endpoint/SQL/상한을 받을 수 없다.

같은 `.state/allium-executor`/공통 reservation-lock 안에서 별도 `api-capabilities-20261024` 디렉터리를 송신 전 영속 소비한다. 기존 manual/live/geography 소비를 지우거나 재사용하지 않는다. 새 승인 원문 hash·전체 plan/SQL·양쪽 키 hash·기존 모든 archive의 bytes/권한 manifest·15분 lease를 결합한다. 각 HTTP intent와 receipt를 송신 전에 fsync한다. crash·timeout·응답 유실·새 authorization·날짜/키 변경 후에도 같은 슬롯을 재소비하거나 재개하지 않는다.

새 상한은 Arkham20HTTP/0run, Allium105HTTP/16run, 합계125HTTP/16run이다. Allium REST9HTTP와 각 SQL의 create/run/status최대3/result 또는 실패상세1을 포함한 최대6HTTP를 합산한다. 각 응답2MiB·전체32MiB·개별 요청20초·전체15분·페이지1·재시도0이다. 앞선 지리 조회/진단 실제3run/11HTTP와 합한 이 PC의 이번 관련 누적 최대는19run/136HTTP다. 다른 작업·PC·조직의 전체 사용량 상한을 인증하지 않는다. 비용 통제·귀속·초과 과금·조직/타PC 배타성은 미확인이다. 새 usage 호출은 없다.

매 송신 전 전체/공급자/작업별 HTTP·run·시간·누적 bytes를 검사한다. allium-executor의 surveyRequest 재시도는 사용하지 않는다. 순차 실행하며 응답 불명·proxy 오류·429·전체 상한·만료는 묶음을 중단한다. 개별 REST 응답이2MiB를 넘으면 본문을 잘라 파싱하지 않고 RESPONSE_TOO_LARGE로 기록하며 나머지 고정 표본만 계속한다. 이는 재시도나 대체 endpoint 호출이 아니다. 명시 SQL failed에만 동일 query/run/SQL의 오류 상세GET1회를 같은 한도에서 읽는다. 기존 두 거절 테이블은 앞선 관측을 참조하고 새로 호출하지 않는다. redirect는 금지하고 실행 환경의 관리형 proxy 설정을 그대로 따른다. proxy X-Squid-Error는 코드만 보존하고 해당 프록시 오류 본문은 저장하지 않는다. 원본 HTTP451 자체를 proxy 정책 차단으로 단정하지 않는다.

## 판정·보고·제외

HTTP200 JSON, 명시 빈 배열, HTTP200 오류 본문, 401 인증 거절, 403 Forbidden, 404 경로/표본 미확인, 400/405/422 요청 거절, 429 제한을 분리한다. 인자 오류나 빈 결과를 기능 부재로 바꾸지 않는다. SQL은 실행 성공과 고정1행/빈 결과를 분리하고 echo가 다르면 개별 의미 검토 전 `QUERY_SUCCEEDED_ECHO_REVIEW_REQUIRED`로 남긴다. 새로운 금액·자료 품질·지원 판정을 발행하지 않는다. 숫자는 원문 lexeme 문자열로 파싱하며 요약에는 금융 금액을 넣지 않는다.

원문·식별자·승인·키 hash는 비공개 `.state`에만 보존하고 공개 문서에는 검토한 endpoint id·HTTP/SQL 상태·한계만 쓴다. 전체 목록의 남은 세부 인자/스키마 미확보와 스트리밍/알림/설정 변경 제외를 계획의 NOT_TESTED로 매핑한다. 이전 두 테이블 실패는 과거 관측임을 명시하며 재검사로 꾸미지 않는다. 전체 보유자 열거·서명/거래·계정 변경·DB/UI·스케줄·자동 공급자 전환은 없다.

## 검증

가상 transport로 실제 송신 전 intent, 기존 archive bytes 보존·구승인/새승인 재사용 차단·잠금/만료·키/승인/plan/원문 변경·lost response·proxy/429 중단·빈 결과/요청 거절·SQL echo·전체125HTTP 경계·2MiB/32MiB를 검증한다. 실제 호출 전에 `npm run check`를 통과한다. Lead `3f453b950de84bd9a5c3078f16976a49` revise_plan의 고정 계획·예산·누적 bytes·별도 lease·영속 소비·판정 분리 조건을 반영한다.

## 실제 결과

45개 표본 검사를 완료했다. 실제105HTTP(Arkham20/Allium85)·SQL 실행 요청16회·보존 응답7448975bytes이며 재시도/추가 페이지/usage는0이다. 기존 archive manifest는 보존됐다. 앞선 지리 검사/진단과 합한 관련 실제 누적은19run/116HTTP이며 다른 작업/PC/조직의 전체 사용량은 아니다. 새 슬롯은 소비됐고 재실행하지 않는다.

Arkham은 HTTP200 JSON14·인자 오류3·HTTP200 크기 초과2·HTTP500 1이다. Allium REST는 HTTP200 JSON7·인자 오류1·HTTP500 1, SQL은 성공 확인값1행6·INVALID_TABLES7·3회 상태 확인 내 완료 미확인3이다. 이번 새 표본에 HTTP401/403은 없었으며 인자/서버 오류를 권한 부재로 해석하지 않는다. SQL echo5개는 CAST/동의어 표기만 다른 것을 개별 SOURCE_REVIEWED로 결합했고 원래 receipt/report의 상태는 바꾸지 않았다. catalog/balances_daily/supply_change는 완료/최종 비용이 미확인이며 추가 polling/취소는 하지 않았다. 순차 HTTP 송신이 공급자 서버의 이전 run 종료를 보장하지 않는다.

항목별 결과·이전 두 실패·12개 NOT_TESTED와 추가 확인 조건은 [접근 표본 보고서](../research/provider-api-capabilities-2026-10-24.md)가 정본이다. 실제 실행 전 `npm run check` rc0 tests474/pass474/fail0/cancelled0/skipped0, 경계 단위시험 rc0 tests7/pass7/fail0/cancelled0/skipped0를 확인했다. 이는 API 접근 표본 검사이며 제품 지원·모든 필드/자산/체인/기간·과금 상한의 인증은 아니다.
