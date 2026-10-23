# 저장된 공급자 표본 활용 우선순위

다음 작업은 이미 확보한 가격·시장·공급량·전송량 자료의 필드와 의미를 오프라인으로 검토하는 것이다. 인자 미확인·접근 거절·500·미완료 항목은 보류하고 같은 요청을 반복하지 않는다. 사용자의 2026-10-24 후속 지시에 따른 정리이며 새 수집이나 DB/UI 변경을 실행하지 않았다.

## 확보한 자료에서 진행할 일

아래 모양·개수는 ADR0083의 저장된 REST 원문을 로컬에서 다시 읽은 관측이다. 주소·가격·잔액 값은 공개하지 않고, 허용한 필드 이름과 배열 크기만 확인했다. 원문의 숫자는 lexeme 문자열로 읽었다. JSON 확보와 금액·단위·완전성 검증은 구분한다.

| 순서 | 자료 | 현재 근거 | 다음 오프라인 검토 |
| --- | --- | --- | --- |
| 1 | Allium 최신 가격·가격 이력·가격 통계 | 각각 object의 items 배열1개 | 토큰/체인 일치, 가격 통화·시각·기간·숫자 정밀도·누락 필드 계약을 고정하고 실제 저장본에서 추출 가능한 필드만 검증 |
| 2 | Arkham 시장·가격 이력 | 시장 object에 price/circulatingSupply/totalSupply; 이력은 배열1225개 | 전체 코인 유통량과 총공급량을 구분하고 이력 시각/기간·공급자 정의를 확인; 전체 코인 값을 체인별 공급량에 대입하지 않음 |
| 3 | Allium 공급량·전송량 기존 저장 조사 | [기존 저장 검증 기록](../ALLIUM_SURVEY_DATA.md)의 공급량70·전송량67관측과 별도 미일치/누락 | 이미 연결된 표와 정밀도·기간·누락 의미의 일치부터 확인; 이번 SQL 접근 표본6건은 probe_id만 있어 실제 시계열 입력으로 사용하지 않음 |
| 4 | Allium 토큰 기본정보·Arkham 등록/보유자 | Allium 토큰은 배열1개; Arkham holders는 token/totalSupply가 있는 object | registry의 Ethereum USDC 식별과 공급량 정의·원문 필드 계약 검토; 상위 표본을 전체 보유자 분포로 확대하지 않음 |
| 5 | 전송·지갑형·포지션·시장 목록 | Arkham transfers object에 transfers/count; Allium transactions items1·positions items4·markets items1 및 cursor | 조회 표본의 의미와 커서/누락만 기록; 고객 지갑·모든 프로토콜·시장 세부 지표 지원으로 해석하지 않음 |

지갑형 Allium 표본 주소는 USDC 토큰 컨트랙트다. 자료가 있더라도 고객의 보유 자산·지갑 활동을 대표하지 않는다. 최신 잔액 배열 후속 검사의 실제 결과는 [ADR0084](../adr/0084-single-allium-balance-array-probe.md)에 별도로 기록하며 기존 HTTP400을 덮어쓰지 않는다.

## 가격3종의 오프라인 필드 관측

별도 인증 호출 없이 저장된 가격 원문3개의 hash를 원래 receipt와 대조했다. 각 items1개의 chain은 ethereum, address 또는 mint는 고정 USDC, decimals는6과 일치했다. 각 금액·변화율은 Number로 바꾸지 않고 숫자 lexeme 문자열의 문법만 검사했다. 다음은 소스가 제공한 필드 모양이며 제품 PASS·가격 정확성 인증은 아니다.

| 저장 표본 | 확인한 필드와 조건 | 남겨 둔 한계 |
| --- | --- | --- |
| 최신 가격 | address, chain, decimals, timestamp와 price/open/high/close/low; timestamp의 UTC Z 형식·파싱 가능, 숫자 필드 모두 존재/문법 유효 | 가격 통화는 이 원문 관측에서 UNKNOWN; OHLC 구간 의미·외부 가격 대사 미검증 |
| 가격 이력 | mint, chain, decimals, prices; 내부1개에 timestamp/price/open/high/close/low; UTC 시각과 price 문법 유효, 요청한5분 범위 안의 관측 | 내부 OHLC 수치 문법은 별도 미검증; 1개 점만으로 요청 창 전체의 완전성을 인증하지 않음 |
| 가격 통계 | mint, chain, decimals, timestamp, latest_price, low/high의24h·1h, percent_change의24h·1h; UTC 형식과 숫자 필드 존재/문법 유효 | 가격 통화·변화율 단위·24h/1h 창 정의 미확인 |

개별 source/receipt hash와 검토 요약은 비공개 `.state/provider-price-review/20261024-observation.json`에 결합했다. 원래 가격·주소·시각 값은 이 문서에 복사하지 않았고 기존 수집 receipt는 바꾸지 않았다. 이번 관측용 일회성 로컬 검사와 재사용 가능한 제품 파서는 구분한다.

## 이번에 보류하는 항목

| 항목 | 보존하는 상태 | 재개 기준 |
| --- | --- | --- |
| Arkham portfolio/top_flow/token volume | 인자 값·단위 UNKNOWN | 공식 요청 계약이 별도로 확보되고 새 검사를 명시 요청할 때 |
| Arkham 흐름/기관 volume | HTTP200 뒤 2MiB 초과 | 잘린 원문을 정규 자료로 사용하지 않음; 새 범위 승인 전 재호출 없음 |
| Arkham counterparties·Allium PnL | HTTP500 원인 미확인 | 자동 진단·재시도 없이 보존 |
| Allium catalog/balances_daily/supply_change | 기존 관측창 내 완료 미확인 | 추가 polling·취소·재전송 없음; 서버 최종 상태/비용 UNKNOWN 유지 |
| Identity·국가 귀속 자료 | 해당 테이블 INVALID_TABLES, 실제 국가별 자료 미확보 | 다른 테이블 이름을 추측하거나 다른 공급자로 전환하지 않음 |
| 나머지12개 세부 API | NOT_TESTED | 현재 우선순위에서 제외; 전체 기능 부재로 단정하지 않음 |

## 재사용 가능한 가격 검토

`tools/provider-price-review.mjs`와 `tests/provider-price-review.test.mjs`에 저장본 전용 필드 계약을 구현했다. 독립적으로 검토한 receipt SHA-256을 입력받아 고정 ADR0083 plan·job·POST 경로/body hash·HTTP200 JSON·단일 시도·원문 hash/바이트 수를 확인한다. 원본 receipt와 응답은 읽기만 하고 영속 소비 슬롯을 사용하지 않는다. 통화·완전성·변화율 단위·창 정의는 계속 UNKNOWN이다. 원본 확보와 가격 정확성 인증을 구분한다.

```sh
node tools/provider-price-review.mjs <검토한-receipt-sha256> <새-보고서명.json>
```

고정 입력은 `.state/allium-executor/api-capabilities-20261024`이며 보고서는 `.state/provider-price-review`에 새 이름으로만 생성한다(디렉터리0700·파일0600). 기존 보고서를 덮어쓰지 않는다. CLI는 항목별 상태/오류 코드만 출력하고 원래 가격·주소·시각 값은 비공개 보고서에만 보존한다. API·키·DB/UI·환경설정 읽기는 없다. receipt pin은 로컬 무결성 연결이며 공급자 인증이나 receipt까지 함께 바꾼 변조의 진위 증명은 아니다.

계약의 범위는 다음과 같다.

- 모든 입력: 최대2MiB·엄격한 UTF-8/JSON·깊이32·중복 key 거절. 숫자는 Number로 변환하지 않고 지수/소수 자릿수까지 원문 lexeme 문자열로 보존한다. 숫자 위치의 quoted string은 이번 관측 계약과 달라 INCONCLUSIVE다.
- 공통 자산: items 정확히1개·ethereum·고정 USDC address/mint·숫자 decimals6. 가격/통계는 원래 timestamp, 이력은 각 점의 timestamp를 보존한다. UTC Z와 실제 달력 날짜를 확인한다(소수 초는 최대3자리).
- 최신 가격/이력: price/open/high/close/low 전부 존재와 숫자 문법을 확인한다. 통계는 latest_price·low/high의24h/1h·percent_change의24h/1h를 확인한다. 값의 정확성·양수성·OHLC 관계·외부 가격 대사는 인증하지 않는다.
- 이력: 빈 prices·중복/역순 시각·고정 요청창 밖을 거절한다. 로컬 검토창은 `[2026-10-22T00:00:00Z, 2026-10-22T00:05:00Z)`로 제한한다. 이 경계는 로컬 검토 정책이며 공급자의 끝점 포함 규칙을 인증하지 않는다. 1개 점으로 전체 창의 완전성을 판정하지 않는다.
- 누락/null·빈 배열·오류 envelope·추가 cursor·자산/시각/숫자/원문 불일치는 INCONCLUSIVE와 고정 오류 코드로 남긴다. 관측값은 null이며0으로 채우지 않는다. receipt 구조/요청·바이트 수 오류나 파일 접근 실패는 보고서 생성 전 중단한다. 새 수집은 실행하지 않는다.

실제 저장본3종은 `FIELD_CONTRACT_OBSERVED`이며 `.state/provider-price-review/20261024-field-contract.json`에 receipt/source hash·원래 요청시각·숫자 문자열을 보존했다. 이전 일회성 observation 파일도 유지한다. 이 상태는 제품 PASS·SOURCE_REVIEWED·현재 가격·지원 인증이 아니다. 가상 부정 표본은 별도 임시 디렉터리에서만 시험하며 실제 보고서에 섞지 않는다.

## Arkham 시장·가격 이력의 오프라인 필드 관측

`tools/arkham-price-review.mjs`는 같은 ADR0083 archive의 `arkham-market`·`arkham-price-history` 응답 두 개만 읽는다. 기존 가격 검토와 공통 무결성 검사를 사용하여 독립적으로 pin한 receipt·고정 plan·GET 경로·body 없음·단일 HTTP200 JSON 시도·응답 hash/바이트 수를 결합한다. 기존 Allium 보고서의 receipt pin과도 대조했다. 새 호출·키·소비·DB/UI 변경은 없다.

```sh
node tools/arkham-price-review.mjs <검토한-receipt-sha256> <새-보고서명.json>
```

입력·출력 경로와 파일 보호·중복 key/엄격한 JSON/UTF-8·최대2MiB·숫자 lexeme 보존 규칙은 [기존 가격 검토](#재사용-가능한-가격-검토)와 같다. 응답에 자산 식별자와 시장 기준시각 필드가 없어 자산은 고정 요청 경로의 `usd-coin`에만 연결한다. 응답 자체 자산 식별과 시장 기준시각은 UNKNOWN이다. 요청시각을 공급자 기준시각으로 대입하지 않는다. 현재 컨트랙트/체인 인증으로 확대하지 않는다.

| 저장 표본 | 관측 계약 | 보존한 한계 |
| --- | --- | --- |
| 시장 | price·totalVolume·price24hAgo·maxPrice24h·minPrice24h·circulatingSupply·totalSupply·price7dAgo·price30dAgo·price180dAgo·allTimeHigh·allTimeLow·marketCap·fullyDilutedValue의14개 숫자 lexeme | circulatingSupply는 전체 코인 유통량, totalSupply는 전체 코인 총공급량 필드로 분리한다. 체인별 공급량은 NOT_OBSERVED이며 이 값을 대입하지 않는다. 공급자 산식·단위/기간 정의·외부 대사·가격 통화는 UNKNOWN |
| 가격 이력 | 배열1225점의 time·usd·volume24h·marketCap. 각 UTC Z/달력 날짜·필수 숫자·중복 없는 엄격한 시각 오름차순 확인. 원래 시각과 실제 첫/끝 시각을 비공개 보고서에 보존 | `usd`는 원문 필드명으로만 보존하며 통화 인증은 UNKNOWN. 요청에 기간 인자가 없어 requestedWindow는 null이며 실제 관측 범위와 구분한다. 점 개수·순서로 이력 완전성/일정 간격·volume24h/marketCap 정의를 인증하지 않음 |

누락/null·문자열 금액·빈 이력·오류 envelope·시각/순서/원문 불일치는 INCONCLUSIVE와 고정 오류 코드로 남기고 관측값은 null로 보존한다. 값을0으로 채우지 않는다. receipt/요청/바이트 수·파일 보호 위반은 보고서 생성 전 중단한다. 가상 부정 표본과 실제 저장 관측을 분리한다.

실제 두 응답은 `FIELD_CONTRACT_OBSERVED`이며 `.state/provider-price-review/20261024-arkham-field-contract.json`에 원문/receipt hash·원래 요청시각·원래 숫자/시각을 결합했다. report 생성시각을 새 공급자 관측시각으로 사용하지 않으며 기존 원문/판정은 보존한다. FIELD_CONTRACT_OBSERVED는 제품 PASS·SOURCE_REVIEWED·가격/지원 인증이 아니다. 비용은 UNCONFIRMED다.

## 다음 구현 단위

우선순위3의 기존 Allium 공급량·전송량 저장 조사와 로컬 표 연결에서 정밀도·기간·누락 의미를 오프라인으로 대조한다. [기존 저장 검증 기록](../ALLIUM_SURVEY_DATA.md)의 고정 자료와 코드만 읽고, 실제 시계열 입력이 아닌 probe_id 표본6건은 분리한다. 차이가 있으면 원본·기존 DB/UI를 바꾸지 않고 비공개 검토 기록으로 남긴다. 새 실제 수집·스케줄·DB/UI 변경·기본 공급자 전환은 별도 범위다.
