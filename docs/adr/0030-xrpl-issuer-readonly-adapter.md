# ADR 0030: XRPL issuer 읽기를 공통 Adapter/CLI에 연결

상태: 채택, 2026-10-21. 사용자가 Solana 연결 다음 XRPL 발행자 설정 연결 진행을 승인했다. USDC/RLUSD의 issuer AccountRoot 읽기로 한정하며 trust-line/Payment·잔액·공급량·서명·거래·SDK는 추가하지 않는다.

ReadOnlyAssessmentRequest에 optional currencyCode를 추가한다. XRPL에서는 assetAddress=issuer이며 두 값의 정확한 허용 쌍으로 선택한다. 다른 Adapter는 currencyCode를 무시하지 않고 사전 거부한다. CLI는 --chain xrpl --network mainnet|0 --issuer <address> --currency <40hex>를 사용한다. mainnet→0 정규화는 CLI 경계에서만 수행하며 XRPL_RPC_URL을 요구한다. token/holder/spender/profile은 빈 값 포함 거부하고 issuer/currency는 XRPL 외의 assess와 lab에서 거부한다.

AssetIdentity에 XRPL을 추가하고 issuedCurrency:Knowledge<string>를 XRPL에서만 필수로 한다. KNOWN 통화는 검증된 요청/문서 식별자이며 AccountRoot의 currency 발행 증거가 아니다. DOCUMENTED evidence로 구분한다. issuer KNOWN은 검증된 응답 Account 일치에 한정하고 issuerVerificationStatus는 UNKNOWN이다. 실패 시 미관측 issuer를 KNOWN으로 채우지 않는다. decimals/contract/mint/program/implementation은 XRPL에서 NOT_APPLICABLE이다.

Report schemaVersion1.0에 enum/optional 필드와 XRPL 조건부 제약을 추가한다. 기존 EVM/TRON/Solana 보고서는 새 validator에서 유효하게 유지하며 기존 Knowledge·required 제약을 완화하지 않는다. 루트/시나리오 identity 모두 같은 정의를 참조한다. 이전의 고정 schema/소비자는 새 XRPL enum과 필드를 수용하지 못할 수 있다. **모든 구버전 소비자와의 호환을 주장하지 않으며 XRPL 수신 시 갱신된 schema가 필요하다.**

기존 연구 core를 분리해 단일 issuer의 server_info→validated ledger→account_info 최대3회로 재사용한다. network/ledger 실패 뒤 후속 호출을 하지 않는다. hash/index/validated/Account/AccountRoot/uint32를 대조하고 context hash를 evidence에 남긴다. 두 issuer 연구 API는4회 배치를 유지한다. 새 연구 출력의 Adapter 상태만 현재 구현과 맞추고 과거 저장 보고서는 수정하지 않는다.

읽기 결과는 COMPLETED/INCONCLUSIVE/support UNKNOWN이며 오류는 ERROR/INCONCLUSIVE, 미실행 단계는 NOT_EXECUTED/NOT_TESTED다. 동결/회수 설정 관측을 실제 행사로 바꾸지 않는다. ERC20 allowance NOT_APPLICABLE은 trust-line 인가 부재를 뜻하지 않는다. 시점/요청별 상태 격리·오류 비노출·기존 bounded proxy 준수 HTTP·원자적0600 출력·CLI 종료 규칙을 유지한다.

기존 보고서 회귀, XRPL 통화/NA 조건부 schema의 실패 경로, 단일 issuer 호출 수·동시 요청·실패 후 회복·ledger 고정·CLI 입력 거부를 검증한다. 실제 두 CLI 보고서도 각각 검증하며 ledger가 다르면 같은 snapshot으로 합치지 않는다.
