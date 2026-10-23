# Allium 중심 데이터 조회 검토

사용자 방향: 공급량·활동 지표를 한 대시보드에서 확인하고 수집 경로를 단순화한다. 공개 공식 문서 조사와 제한된 인증 확인을 기록한다. 확인일: 2026-10-23. 사용자가 설정한 비공개 키로 Ethereum USDC의 Realtime 가격 통계를 단 한 번 요청해 HTTP 200과 1건 응답을 확인했다. 가격·1시간/24시간 고저가·변동률 필드가 있으며 이 응답에 거래량 필드는 없었다. 공급량·전송량·Explorer SQL·요금/잔여 한도는 미확인이고 자동 수집·대시보드 연결은 아직 구현하지 않았다.

## 우선 확인할 데이터

| 목적 | 공식 데이터 | 적용 조건 |
| --- | --- | --- |
| 토큰·네트워크 기본정보 | `stablecoins.registry.deployments` | 기존 승인된 자산 식별자와 대조. native/bridged, decimals, 통화를 보존한다. 공급자의 verified 표시는 제품 검증 PASS와 다르다. |
| 일별 공급량 | `stablecoins.core.supply_daily` | total, circulating, adjusted circulating을 별도 지표로 저장한다. adjusted는 공급자 추정치이며 일반 유통량을 대체하지 않는다. |
| 발행·소각 추이 | `stablecoins.core.supply_change` | mint/burn과 순증감을 구분한다. 온체인 발행·소각이 실제 법정화폐 입금·상환을 입증하지 않는다. |
| 네트워크 활동 | `stablecoins.metrics.volume_daily` | 전송량·전송 건수로 표시한다. 매매 거래량과 구분하며 조정 지표는 `has_adjusted_volume`이 참인 경우만 사용한다. |
| 가격 | Realtime 가격 API | DEX 기반 가격의 범위·유동성·시각을 확인한다. 전 세계 시장 대표 가격이나 거래량으로 간주하지 않는다. |

공급량의 원본 단위와 USD 환산 값을 분리한다. 날짜·네트워크·발행 자산별 값과 코인 전체 값을 섞거나 bridged 물량을 단순 합산하지 않는다. 금액은 정확한 십진 문자열을 사용한다. 공급 변화 이벤트에는 `amount_str` 등 문자열 필드를 우선하며, 공급량/집계 SQL 결과도 정밀도 손실 없이 문자열로 받을 수 있는지 표본 검증한다. 확보하지 못한 값은 누락으로 유지한다.

## 연결 순서

1. 발급 키의 상품 권한·요금·조회 제한과 실제 사용 가능한 endpoint를 확인한다. 공식 문서는 Explorer API를 기업 계정 대상으로 설명하고 Issuer Intelligence는 얼리 액세스로 안내한다. 키 발급 자체가 두 상품 접근을 보장하지 않는다. 키는 서버의 비공개 설정에만 둔다.
2. 기존 USDT·USDC·RLUSD·JPYC·JPYSC와 승인된 발행 자산 목록을 대상으로 소량 읽기 표본을 조회한다. XRPL·TRON·엔화 코인 지원과 과거 기간은 미확인이다. 플랫폼 전체 지원 체인 수를 개별 API 지원으로 해석하지 않는다.
3. 기존 공급자와 같은 날짜·단위의 공급량을 비교하고 차이는 정의·제외 계정·가격 기준으로 설명한다. 지원이 확인된 자산에 한해 유통량 기준 상위 10개 네트워크를 선정한다. 10개 미만이면 확보된 전체를 사용한다.
4. 검증 후 별도 ADR로 수집 주기·예산·보존 기간·DB 키를 확정한다. 일별 데이터는 일별 작업으로 수집하며 브라우저 새로고침은 DB 저장본만 읽는다. 현재 수집기와 충돌하는 자동 수집을 추가하지 않는다.
5. 서버 수집 → 원문/정규화·공급자·기준시각 저장 → 기존 조회 API → 대시보드 순서로 연결한다. 공급자별 자연 키와 원문 해시로 중복 저장을 방지하고 수정된 일별 값의 처리 규칙을 정한다. 실패 시 이전 값·시각을 보존하며 공급자를 자동 전환하지 않는다.

기존 관측 자료는 비교 근거로 유지한다. 실제 지원·정의·비용 검증 전 일괄 교체하지 않는다. 전체 보유자 열거, 거래·서명, 새로운 실행 Adapter는 이 조사에 포함하지 않는다.

## 공식 출처

- [API 상품 구분](https://docs.allium.so/api/overview), [키 발급 방식](https://docs.allium.so/api/getting-started), [API별 가용성](https://docs.allium.so/api/developer/availability)
- [발행 자산 등록부](https://docs.allium.so/historical-data/stablecoins/registry)
- [일별 공급량과 세 가지 정의](https://docs.allium.so/historical-data/stablecoins/supply-daily)
- [발행·소각 이벤트](https://docs.allium.so/historical-data/stablecoins/supply-change)
- [일별 전송량과 조정 지표](https://docs.allium.so/historical-data/stablecoins/volume-daily)
- [Realtime 가격 통계](https://docs.allium.so/api/developer/prices/token-price-stats), [Issuer Intelligence 접근 안내](https://docs.allium.so/app/issuer-intelligence/overview)
