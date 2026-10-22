# ADR0050: 엔화 자산과 네트워크 상위10 수집 설계

2026-10-22 · 상태: **설계안, 미구현/미적용**. 사용자는 JPYSC·JPYC 추가와 각 코인별 최대10개 네트워크의 검토·설계를 요청했다. 기존3코인도 대상에 포함한다.

정본은 [수집 확장 설계](../design/YEN_AND_TOP10_NETWORK_COLLECTION.md), 실제 출처/응답/식별자·미확보 범위는 [조사 기록](../research/yen-stablecoins-network-coverage-2026-10-22.md)이다. 현재 registry/DB/수집기·UI와 이전 migration은 변경하지 않는다.

공급자 네트워크 유통 분포에서 코인별 최대10곳을 선정하고 부족하면 확보 전체를 사용한다. 공식 발행과 bridge/공급자 집계는 독립 상태로 보존한다. RLUSD의 공식7곳과 현재 DeFiLlama2곳을 구분한다. JPYC는 현행4곳과 선불형을 분리하고 JPYSC는 Ethereum 공급량과 외부 입출고 제약을 함께 설명한다.

목록 API의 USD 환산액과 상세 API의 token 수량을 별도 계약으로 저장한다. `peggedJPY` 키는 단위 인증이 아니다. 새 통화·정의 버전·provider capability·자산×네트워크 coverage를 registry/deployment/호환성 판정에서 분리한다. 공급자 발행 잔액을 당일 발행량·소각량으로 해석하지 않는다.

후속 구현은 versioned metadata·선정 이력·지표 단위 계약과 coin/metric별 제한 조회를 먼저 준비한다. 그다음2코인 일별 자료, 상위10네트워크, 검증된5분 자료를 순서대로 연결한다. 불변 원문/정정·중복 방지·예산/예약/최소 권한/기존 정상 자료를 유지한다. 이번 조사 성공을 제품 수집/Adapter/PASS 완료로 표시하지 않는다.
