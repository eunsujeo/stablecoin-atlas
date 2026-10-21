# ADR 0012: TRON allowance 읽기 전용 조회

2026-10-19, Accepted. 사용자 승인 TRON 후속 범위이며 ADR 0011의 외부 읽기 전용·latest 경계를 유지한다.

TRON 전용 request가 공통 ReadOnlyAssessmentRequest를 확장해 optional spenderAddress를 받는다. 공통 도메인에는 승인 메서드나 spender를 강제하지 않는다. CLI --spender는 tron assess와 --holder(owner) 조합에서만 허용한다. 주소·조합 검증은 RPC 전에 수행하고 owner/spender 순서로 각각 41-prefix를 제거해 ABI 주소로 인코딩한다. 결과에는 정규 Base58 pair를 보존한다. 동일 주소 pair도 조회할 수 있다.

[TRON 공식 ITRC20 인터페이스](https://raw.githubusercontent.com/tronprotocol/tron-contracts/master/contracts/tokens/TRC20/ITRC20.sol)의 allowance(address owner,address spender) view returns(uint256)만 ABI에 추가한다. 새 TRC20-007은 이 getter의 관측이며 기존 TRC20-003 approve/transferFrom 실행은 NOT_TESTED다. 서명·승인·전송·계정 활성화는 추가하지 않는다.

성공은 readStatus OK와 uint256 bigint의 십진 문자열 allowance로 기록한다. 0은 유효 관측값이다. 잘못된 응답·RPC/transport 실패에는 amount가 없고 개별 상태와 증거를 보존한다. pair 미지정은 NOT_TESTED/no call이다. 최신 상태 응답의 정확한 블록은 UNKNOWN이므로 조회 성공도 INCONCLUSIVE/support UNKNOWN이다. 전후 head로 상태 블록을 대체하지 않는다.

Report 1.0에 시나리오와 선택적 allowance 금액 검증만 추가한다. 두 ALLOWANCE 시나리오의 요약은 각 결과를 포함하므로 소비자는 capability만으로 실행 성공을 추론하지 않고 scenarioId를 확인한다. 기존 7개 결과 보고서는 그대로 유효하다. 0 승인량은 전체 계정의 승인 부재나 향후 transferFrom 성공/실패를 증명하지 않는다.

검증: owner/spender 순서·정규화·동일 pair, 0/최대값, 동시 요청 증거 격리, 잘못된 입력 RPC 0건, no-pair no-call, read/decode 오류와 복구, CLI/스키마 및 전체 EVM 회귀. 합성 HTTP 응답을 TVM 실행 증거로 해석하지 않는다. 실제 USDT 조회는 별도 선택적 읽기 관측이다.
