# 공통 Capability

| 그룹 | 개념 |
|---|---|
| Identity | IDENTITY |
| 자산 연산 | TRANSFER, BALANCE, ALLOWANCE, DELEGATION, MINT, BURN |
| 관리 통제 | FREEZE, UNFREEZE, BLACKLIST, PAUSE, CLAWBACK, AUTHORITY_CHANGE, UPGRADEABILITY |
| 운영 동작 | TRANSFER_FEE, DECIMAL_HANDLING, EVENT_TRACKING, SUPPLY_TRACKING, ACCOUNT_INITIALIZATION, FINALITY, RESOURCE_CONSUMPTION, SWEEP_COMPATIBILITY |

타입 정의는 `src/domain/model.ts`가 기준이다. 시나리오 결과의 capability는 주 검증 개념이다. metadata·decimals·events·supply는 개별 시나리오 내부 증거로도 관측하지만 해당 운영 capability 전체를 검증했다고 집계하지 않는다. 별도 시나리오 없는 capability는 summary에서 NOT_TESTED로 남는다.

SUPPORTED는 관측한 기능의 존재, PASS는 선택한 프로필의 특정 조건 충족이다. fee 존재가 SUPPORTED이면서 exact-receipt 결과가 FAIL일 수 있다. NOT_SUPPORTED는 부재의 증거가 있을 때 사용하도록 예약하며, 현재 단일 샘플의 실패에서는 UNKNOWN을 사용한다.

EVM-PROXY-001은 UPGRADEABILITY에 연결된 구조 관측 시나리오다. PASS는 대상 주소와 코드 해석만 의미하며 실제 업그레이드 실행·권한을 검증하지 않아 support는 UNKNOWN이다.
