# ADR 0029: Solana mint 읽기를 공통 Adapter/CLI에 연결

상태: 채택, 2026-10-21. 사용자가 체인 연결 모듈 설명 뒤 다음 진행을 승인했다. 이번 구현은 Solana USDC·USDT mint 설정 읽기에 한정한다. 기존 실행 Adapter 제외 범위에 이 읽기 예외를 추가하고 XRPL 제품 Adapter·holder/delegate·SDK·서명·거래는 추가하지 않는다.

기존 ReadOnlyAdapter와 Report1.0이 SOLANA/mint/program/networkId 문자열을 제공하므로 공통 도메인/schema는 변경하지 않는다. `assess --chain solana --network mainnet-beta --token <mint>`를 추가한다. CLI만 mainnet-beta를 전체 genesis hash로 정규화하며 Adapter는 전체 hash를 요구한다. SOLANA_RPC_URL을 사용하고 암묵적인 공개 endpoint는 선택하지 않는다.

기존 두 mint 연구 reader의 관측 core를 분리해 재사용한다. 제품 Adapter는 선택된 허용 mint 한 개만 getMultipleAccounts로 읽는다. genesis 불일치 시 계정 요청은0회, 정상 시 전체2회다. 연구 reader는 기존 두 mint 배치를 유지하고 제품 Report1.0과 별도 형식이다. 새 연구 출력의 productAdapter 메타데이터는 별도 mint-only Adapter가 생겼음을 반영하며 과거 저장 보고서는 수정하지 않는다.

mintAddress는 요청 후보와 검증된 계정을 구분한다. KNOWN decimals/program은 유효한 초기화된82-byte legacy mint 관측에만 부여한다. symbol/name/issuer/native·표준 적합성은 별도 확인 없이 올리지 않는다. contract/implementation의 EVM 의미는 NOT_APPLICABLE이다. finalized 요청과 응답 context slot을 보존하되 마지막 변경 slot·독립적인 finality/네트워크 인증이라고 쓰지 않는다.

성공적으로 읽은 설정도 이 범위에서는 COMPLETED/INCONCLUSIVE·support UNKNOWN이다. transport/protocol 실패는 실행된 ERROR/INCONCLUSIVE, genesis에서 중단한 이후 mint 단계는 NOT_EXECUTED/NOT_TESTED다. 실제 transfer/mint/burn/freeze/delegation/authority change는 NOT_TESTED다. ERC-20 allowance만 별도 의미 설명과 함께 NOT_APPLICABLE이며 delegation 부재를 뜻하지 않는다. 기존 CLI 종료 규칙은 그대로다:0은 보고서 완료,1은 실행/입력 오류,2는 시나리오 FAIL이다.

요청별 관측/evidence/ID는 독립적이고 이전 실패·동시 요청이 다음 요청을 오염시키지 않는다. 기존 bounded HTTP/프록시 설정·오류문 비노출·원자적0600 출력을 재사용한다. 모든 모의 성공/실패·실제 저장 보고서를 기존 schema/identity/evidence/summary 계약으로 확인하고 EVM/TRON 포함 전체 검사를 실행한다.
