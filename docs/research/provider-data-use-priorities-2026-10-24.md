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

## 다음 구현 단위

저장된 Allium 가격3개 원문의 오프라인 필드 계약과 검토 보고서를 우선한다. API·키·DB 없이 입력 hash·숫자 문자열·토큰/체인·관측시각·기간·누락/오류를 검증하고, 검토 전에는 제품의 기본 공급자를 바꾸지 않는다. 새 실제 수집·스케줄·DB/UI 연결은 별도 범위다. 과거 원문을 새 관측으로 표시하거나 비어 있는 필드를0으로 채우지 않는다.
