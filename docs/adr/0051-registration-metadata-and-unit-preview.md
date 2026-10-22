# ADR0051: 자산 등록 metadata·단위·상위10 미리보기

2026-10-22 · 사용자는 [ADR0050](0050-yen-and-top-ten-network-design.md) 설계 후 다음 진행을 승인했다. 첫 구현 단위는 metadata/통화·지표 계약/선정 규칙을 검증하는 오프라인 도구다.

새 `data/market-registration.json`은 현재 runtime registry와 분리된 version2 등록 후보다. 기존3코인의 식별자와 Arkham binding을 대조하며 신규 JPYC/JPYSC는 공식 상품/계약·JPY peg·DeFiLlama binding·미확인 Arkham 상태를 갖는다. 기존 USDC XRPL을 보존한 검토 후보33조합 중 코인별 최대10곳을 선정한다. 계약 없는 공급자 집계 네트워크와 공식 신규5계약, 아직 chain identity 미확인인 metadata를 구분한다.

목록 API의 USD 환산 유통가치와 상세 API의 token 수량은 다른 측정 계약이다. raw 숫자 lexeme·최대78자리 정수/36자리 소수·제한된 exponent를 손실 없이 정규화한다. 명시적0·누락·잘못된 수량·미등록 상위권 후보·provider identity 오류를 별도 상태로 둔다. 목록의 공개되지 않은 내부 FX와 체인별 실제 관측 시각을 추정하지 않는다. 발행 잔액을 당일 발행/소각으로 바꾸지 않는다.

CLI는 저장 파일에서 등록 계획 또는1년 이내 일별 preview만 생성한다. source/metadata/기존 registry hash·정책/제외 사유를 담되 plan hash를 DB 등록 권한으로 쓰지 않는다. 외부 API/DB·환경변수·서명/거래·holder 계정 열거를 실행하지 않으며 현재 수집기/DB/대시보드는 바꾸지 않는다. 다음 단계의 DB importer/reader 확장은 별도 버전과 최소 권한 검증으로 진행한다.

검증은 legacy 보존·통화/peg·출처·계약/asset ID mismatch, JS safe integer를 넘는 정밀값·exponent 경계, top10 동률/0/누락·HyperEVM 구분·미등록 후보, 코인별 오류 격리, 일별 날짜 중복/미확보 지표, CLI 파일/민감 오류 처리와 네트워크 호출 차단을 포함한다. 명령과 실제 원문 대조 결과는 [사용 안내](../MARKET_REGISTRATION.md)와 최신 인계문을 따른다.
