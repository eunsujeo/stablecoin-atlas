# 네트워크 활용 지표 수집 가능성 — 2026-10-27

사용자 요청은 먼저 수집 가능성을 확인하는 것이다. 저장된 코드/연구와 공개 공식 문서를 확인했다. 이번 조사에서 인증 API/체인 RPC/usage 호출, 키 읽기, DB/UI/Collector/FX 변경은 없으며 기존 소비 슬롯을 재사용하지 않았다.

## 확인 결과

| 지표 | 확보 근거 | 실제 수집 상태 |
| --- | --- | --- |
| 전송 건수·전송 포함 트랜잭션 수 | 기존 `web/survey-model.js`와 저장 volume snapshot의 `transfer_count`, `transfer_tx_count` | 기존 확보 범위에서 오프라인 표시 가능. 네트워크 전체 거래 수가 아님 |
| 일별 송신·수신 주소 수 | 공식 volume_daily의 `sender_count`, `recipient_count` | 공개 스키마 확인. 기존 importer가 저장한 필드는 아니므로 새 필드 조회 필요 |
| 송수신 합집합 활성 주소 | 공식 transfers의 from/to 주소로 서버측 DISTINCT 집계 가능 | 쿼리 후보. 송신자 수+수신자 수로 합집합을 계산하지 않음. 주소를 사람 수로 표시하지 않음 |
| DEX 스왑 건수·거래 트랜잭션 수·USD 금액 | 공식 dex.trades 스키마와 ADR0083의 Ethereum USDC 확인값 조회 성공 | 실제 금액 집계/현재 권한/다른 체인은 미검증 |
| 조정 전송량 | 기존 hasAdjusted/adjusted_volume_usd와 공식 정의 | 결제 외 Investment/Trade·Store as Value도 포함하므로 결제량으로 표시 불가 |
| 결제 건수·금액 | 공식 Payments Pipeline 링크 존재 | 링크가 로그인으로 이동. 공개 실행 스키마/현재 계정 권한 미확인. 테이블 이름 추측/로그인/재시도 안 함 |

근거:

- [일별 전송 지표](https://docs.allium.so/historical-data/stablecoins/volume-daily): 일별/체인/토큰 집계, 주소 수와 조정 지표 의미.
- [전송 스키마](https://docs.allium.so/historical-data/stablecoins/transfers): 송수신 주소와 트랜잭션 식별자.
- [DEX 스왑](https://docs.allium.so/historical-data/supported-blockchains/evm/core-schemas/dex/trades): 매매 이벤트와 USD 산식/자료형.
- [Payments Pipeline](https://docs.allium.so/historical-data/payments/overview): 이번 열람에서 login redirect, 본문 미확보. 자료 부재나 계정 권한 거절의 증거가 아님.
- [기존 실제 접근 검사](provider-api-capabilities-2026-10-24.md), [기존 자료 활용 검토](provider-data-use-priorities-2026-10-24.md), [저장 조사](../ALLIUM_SURVEY_DATA.md).

공개 문서 열람/검색은 인증 수집과 별개다. 공식 docs index도 확인했으며 machine payments는 API 요금 결제 방식 설명이므로 스테이블코인 실사용 결제 통계로 해석하지 않았다. 문서/검색만으로 현재 키의 권한·가격·전체 체인 지원을 인증하지 않는다.

## 실제 인증 표본 후보 — 아직 실행하지 않음

최소 검사는 기존 성공 표본과 같은 Ethereum USDC 한 배포, UTC 2026-10-22 하루로 한정한다. 주소는 기존 registry의 `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`이며 새로운 공식 주소 인증을 뜻하지 않는다. 이 검사는 과거 데이터의 조회 가능성만 확인하며 최신성/지연이나 멀티체인 비교 완성을 뜻하지 않는다.

| 항목 | 고정 한도 |
| --- | --- |
| 공급자/자격 | 기존 Allium Explorer 자격만 사용, 새 키/상품/공급자 없음 |
| 작업 | 아래 세 SQL 각 한 번, 각 최대 1결과행 |
| 송신 | 최대3run/18HTTP: 각 create1/run1/status최대3/result최대1 |
| 시간/크기 | 전체15분, HTTP당20초, 응답당2MiB/전체6MiB |
| 재실행 | 재시도0·추가페이지0·endpoint전환0·추가polling0 |
| 소비/보존 | 새 전용 영속 슬롯과 기존 root/공통 송신 lock 필요. 기존 실행/실패/원문 보존 |
| 비용 | UNCONFIRMED. LIMIT와 결과행 제한은 스캔량/금전 상한이 아님 |
| 제외 | 결제/Identity 재검사, usage, 전체 주소 열거/원문 주소 반환, 자동수집/스케줄, DB/UI/운영배포 |

소비 슬롯·authorization·SQL hash와 아래 의미 검증을 기존 실행기로 준비/검증한 뒤 시작해야 한다. 이 문서는 실행 가능한 authorization이 아니며, 비용 미확인을 포함한 위 고정 범위의 사용자 승인 전 인증 호출을 시작하지 않는다. 실패/미완료는 보존하고 인자를 바꿔 다시 보내지 않는다.

### 1. 일별 건수·주소 수

```sql
SELECT TO_VARCHAR(transfer_count) AS transfers,
       TO_VARCHAR(transfer_tx_count) AS transactions,
       TO_VARCHAR(sender_count) AS senders,
       TO_VARCHAR(recipient_count) AS recipients
FROM stablecoins.metrics.volume_daily
WHERE chain = 'ethereum'
  AND LOWER(token_address) = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  AND activity_date = '2026-10-22'::DATE
LIMIT 1;
```

빈 결과를 0으로 바꾸지 않는다. 집계 키의 유일성은 공식 계약이며, LIMIT1만으로 실제 데이터의 유일성을 인증하지 않는다.

### 2. 활성 주소 합집합 수

```sql
WITH t AS (
  SELECT LOWER(from_address) AS sender, LOWER(to_address) AS recipient
  FROM stablecoins.core.transfers
  WHERE chain = 'ethereum'
    AND LOWER(token_address) = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    AND block_timestamp >= '2026-10-22'::TIMESTAMP_NTZ
    AND block_timestamp < '2026-10-23'::TIMESTAMP_NTZ
), a AS (
  SELECT sender AS address FROM t UNION SELECT recipient AS address FROM t
)
SELECT TO_VARCHAR(COUNT(*)) AS active_addresses
FROM a
WHERE address IS NOT NULL AND address <> ''
  AND address <> '0x0000000000000000000000000000000000000000';
```

제로 주소를 제외한 송수신 주소 합집합 수다. 0금액 이벤트와 mint/burn의 비제로 상대 주소도 포함하며 컨트랙트/라우터/거래소를 포함한다. 사람/고객 수나 유기적 이용자 수가 아니다. 기간별 unique를 일별 unique의 합으로 구하지 않는다.

### 3. 한쪽에 USDC를 포함하는 DEX 스왑

```sql
SELECT TO_VARCHAR(COUNT(*)) AS swap_rows,
       TO_VARCHAR(COUNT(DISTINCT unique_id)) AS distinct_swaps,
       TO_VARCHAR(COUNT(DISTINCT transaction_hash)) AS transactions,
       TO_VARCHAR(COUNT_IF(usd_amount IS NULL)) AS missing_usd_rows,
       TO_VARCHAR(SUM(usd_amount)) AS usd_volume
FROM ethereum.dex.trades
WHERE (LOWER(token_sold_address) = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    OR LOWER(token_bought_address) = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
  AND block_timestamp >= '2026-10-22'::TIMESTAMP_NTZ
  AND block_timestamp < '2026-10-23'::TIMESTAMP_NTZ;
```

같은 행의 매수/매도 양쪽을 이중 가산하지 않는다. 다만 multihop은 여러 pool swap을 포함하므로 최종 고객 주문 수/순경제량이 아니다. 다른 토큰을 별도 취득한 뒤 합칠 때도 중복 방지가 필요하다. swap_rows와 distinct_swaps가 다르면 금액을 정규 표시에 사용하지 않는다. NULL금액/빈 결과를 0으로 바꾸지 않는다.

missing_usd_rows가 양수면 SUM은 알려진 행만의 부분합이다. 완전한 USD 총량으로 표시하지 않는다. 정상 완료된 집계의 swap_rows=0/건수0은 조회 실패나 일별 행 부재와 구분하며, 이때 NULL SUM은 그대로 둔다. 활성 주소 집계의 정상 완료된 COUNT=0도 같은 원칙을 따른다.

공식 usd_amount는 FLOAT/가격 보완값이며 SQL SUM을 TO_VARCHAR로 반환해도 원래 정밀도가 회복되지는 않는다. 공급자 추정 USD로 저장/표시하고 최소 단위의 엄밀 금액과 구분한다. 건수는 정수 문자열로, 원래 관측 시각/출처/SQL/응답hash는 비공개 기록에 보존한다.

## 검증·다음 행동

코드 변경 없음. 변경 후 `npm run check` 결과는 인계문에 기록한다. 위 실제 호출은 미실행이다. 전체 네트워크 확장은 최소 표본 결과와 체인별 의미/비용 확인 뒤 별도 계획으로 진행한다. 결제는 정확한 공개/제공 스키마 확보까지 보류한다.

Lead 검토 `1ffed6bf62454c39870e666c42ad4917`의 revise_plan 조건(USD 부분합/정상 집계0과 부재 구분)을 반영했다. 호출 승인으로 해석하지 않는다.
