# TRON 승인 결함 프로브의 실행 전 준비

이번 단계는 고정 Fixture 컴파일과 순수 증거 검증기의 준비다. **새 Fixture 배포·서명·broadcast·실제 TVM 호출은 하지 않았다.** 실제 TVM 실행은 NOT_TESTED이며 기존 runtime/deployment/transfer suite와 TVM v1 보고서 계약을 변경하지 않았다. 실제 서비스 계정 입력을 기다리는 동안 진행한 독립 작업이다.

## 고정 Fixture와 단일 결함

[별도 Solidity 소스](../fixtures/TronAllowanceProbes.sol)는 metadata·잔액·승인량과 approve/transferFrom을 가진 사설 대조군이다. 완전한 TRC-20 또는 실제 스테이블코인 구현으로 취급하지 않는다. 외부 관리자·mint/freeze/upgrade·사용자 Solidity 입력은 없다.

[별도 compiler allowlist](../src/tron/lab/compiler.ts)의 compileTronAllowanceProbe만 다음9개 계약을 선택한다. 기존 transfer용 compileTronFixture의4개 enum은 유지한다. compiler version/file/SHA-256/settings는 기존 pin과 같고 각 variant의 ABI·source·init/runtime bytecode hash를 반환한다. 새 소스를 기존 transfer 파일에 합쳐 과거 source hash를 바꾸지 않는다.

| variant | 대상 함수 | 단일 결함 |
|---|---|---|
| standard | 두 함수의 정상 대조 | 없음 |
| approve-false / delegated-false | approve / transferFrom | 상태·로그는 정상, canonical false 반환 |
| approve-malformed / delegated-malformed | 각각 | 상태·로그는 정상, 32byte bool word2 반환 |
| approve-missing-event / delegated-missing-event | 각각 | canonical true·상태는 정상, 해당 이벤트 없음 |
| approve-wrong-allowance / delegated-wrong-allowance | 각각 | canonical true·로그·잔액/supply는 정상, allowance가 호출 전 값으로 유지됨 |

approve 결함 계약의 transferFrom, transferFrom 결함 계약의 approve는 정상 동작으로 정의한다. 후자의 실제 실행 준비에는 정상 approve 후 baseline이 필요하다. 생성자 인자는 각 고정 계약 내부에서 정하며 외부 사용자에게 mode를 받지 않는다.

## 순수 증거 검증

[verifyAllowanceProbe](../src/tron/lab/allowance-negative.ts)는 다음을 독립적으로 확인한다.

1. owner/recipient/spender/contract의 구분·nonzero, 양수 amount·uint256 범위, 정확한5개 십진 상태 필드. approve는 초기 allowance0, transferFrom은 충분한 owner 잔액과 amount 이상·최대 uint256 미만의 유한 allowance를 요구한다. 이 baseline은 이번 단일 결함 대조의 조건이며 일반 자산 정책이 아니다.
2. approve는 owner, transferFrom은 spender가 호출한다. operation·주소·amount로 만든 정확한 selector/전체 calldata를 binding과 대조한다. receipt SUCCESS, 동일 txID·raw protobuf hash, 포함 블록/full ID·호출 body를 기존 검증기로 연결한다.
3. approve는 Approval1건과 allowance 설정·모든 잔액/supply 불변, transferFrom은 Transfer1건과 owner 감소/recipient 증가·spender/supply 불변·정확한 allowance 차감을 정상 기준으로 한다. 이 Fixture의 transferFrom에 별도 Approval 로그를 요구하지 않는다.
4. 고정 return word·로그·각 상태 필드를 따로 확인해 기대한 한 축만 다른지 검사한다. 그 후 기존 정상 verifyCallReceipt/verifyTokenTransition의 정확한 RETURN/LOG/STATE 오류를 대조한다. false 반환이 먼저 거부되더라도 로그와 상태가 정상이라는 근거를 생략하지 않는다.

정상 대조는 PASS/NORMAL_ACCEPTANCE_OBSERVED, 결함 대조는 fixtureVerdict FAIL/EXPECTED_REJECTION_OBSERVED를 반환한다. 이는 정의한 Fixture 기대와 검증기 대조 결과다. **함수가 throw하면 항상 ERROR로 취급해야 하며**, 오류 문자열이 기대 코드와 같다는 이유로 외부에서 expected rejection으로 바꾸지 않는다. 복합 결함·잘못된 caller/calldata/블록/hash·REVERT/OUT_OF_ENERGY·상태 오류는 정상 결과 객체를 반환하지 않는다.

이 함수는 주어진 receipt/state의 연결만 검사한다. 원본 node·신규 소유 runtime·실제 코드 배포·자료 진위는 독립적으로 검증해야 한다. 반환 runtimeOwnership은 NOT_ESTABLISHED_BY_THIS_VERIFIER, getter stateResponseBlock은 UNKNOWN이다. AssessmentReport의 자산 안전성·발행사·권한/지원 인증으로 변환하지 않는다.

## 검증 결과와 다음 단계

추가 테스트5개는 직접 구성한 합성 receipt/block/protobuf/state로 정상2건·결함8건, 잘못된 바인딩/재해시된 다른 calldata, 복합 결함·event emitter/topics/data/개수·상태 변화,0/max/초과 금액·유한 승인 전제,9종 compiler ABI/해시/경로 allowlist를 확인한다. 컴파일은 기존 hash-검증 로컬 cache를 사용했고 네트워크 fetch를 거부한 상태에서 통과했다. 기존 transfer 프로브 테스트4개도 통과했다.

[합성 검증 artifact](../reports/tron-allowance-probe-synthetic.json)는 SYNTHETIC_VALIDATOR_CASES_NOT_TVM_EXECUTION/actualTvmExecution NOT_TESTED다. 내부 SUCCESS receipt 모양은 합성 입력이며 실제 TVM 실행·새 mainnet 관측으로 집계하지 않는다. 기존 실제 보고서와 source/build hash는 유지한다.

다음은 이 별도 enum·컴파일 결과·검증기를 신규 소유·격리 runtime에 연결하는 명시 실행 경로와 별도 보고서 계약이다. 정상 대조 수용 후 각 결함을 개별 신규 환경에서 실행하고 setup 승인·거래 바인딩·전후 표본·정리 결과를 회수해야 한다. 그 연결 전에는 기존 tvm:negative 명령이 새9종을 실행한다고 표시하지 않는다. 공개망 상태 변경·추가 운영 키는 필요하지 않다.

후속 실행은 [별도 사설 TVM 경로](TRON_ALLOWANCE_PROBE_EXECUTION.md)에 기록한다. 이 문서와 합성 artifact의 NOT_TESTED는 실행 전 준비 단계의 이력이다.
