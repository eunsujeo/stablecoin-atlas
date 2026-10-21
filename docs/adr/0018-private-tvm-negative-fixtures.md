# ADR 0018: 사설 TVM의 결함 transfer Fixture와 검증기 대조

상태: 채택 (2026-10-20). 기존 정상·경계 프로필을 유지하고 `npm run tvm:negative`를 추가한다. 정상 대조와 세 결함 Fixture를 각각 별도의 신규 소유·격리 TVM에 하나씩 배포한다. 외부 Solidity 입력, 운영 키, 공개망 쓰기, 추가 민팅/관리자 기능은 없다.

결함 Fixture는 독립 작성한 `TronNegativeTokens.sol`의 고정 계약이다. 완전한 TRC-20 구현으로 간주하지 않으며 이번 관측은 transfer에 한정한다. owner 초기 발행량·metadata·양수 전송량·caller/recipient 역할은 정상 대조와 같다.

| Fixture | 의도한 단일 결함 | 나머지 필수 관측 |
| --- | --- | --- |
| standard | 없음 | canonical true, Transfer 한 건, 정확한 상태 변화 |
| false-return | canonical 32byte false | 정상 Transfer와 정확한 상태 변화 |
| malformed-return | 미리 고정한 32byte uint 2 | 정상 Transfer와 정확한 상태 변화 |
| missing-event | Transfer 로그 없음 | canonical true와 정확한 상태 변화 |

Compiler는 고정 enum→저장소 파일/contract allowlist만 선택하며 기존 compiler pin을 유지한다. 각 Fixture의 source file/contract/ABI·소스·init/runtime bytecode 해시를 보고한다. 배포 거래 name은 선택한 contract name과 같아야 하며 ABI/bytecode·owner·fee/자원·무자금·permission·TAPOS/protobuf/hash 검증을 완화하지 않는다. 초기 상태·실제 runtime code 일치를 확인한 뒤 호출한다.

호출의 공통 실행 증거 수집과 정상 의미 검증을 분리한다. 실제 receipt SUCCESS, 포함 full block ID/높이·실제 호출 owner/contract/calldata·raw protobuf/hash 바인딩을 먼저 확인한다. 엄격한 정상 검증기를 실행하되 정확한 예상 코드만 별도로 처리하고, 예상된 의미 검증 거부 뒤에도 실제 post-state를 읽는다. owner/recipient 잔액의 정확한 변화와 spender 잔액·supply·allowance 불변을 검증한다. false/malformed에서 반환값 검사가 먼저 실패하므로 정상 Transfer 이벤트도 별도로 검증한다. missing-event는 로그가 실제로 없는지와 canonical true를 확인한다. 여러 결함이나 다른 실행 실패를 지정한 단일 결함 검출로 받아들이지 않는다.

정상 대조가 같은 검증기에 수용돼야 이후 결함 프로브를 실행한다. false/malformed는 `FIXTURE_CALL_RETURN_MISMATCH`, missing-event는 `FIXTURE_CALL_LOG_MISMATCH`만 expected rejection이다. 다른 throw·REVERT·OUT_OF_ENERGY·broadcast/timeout·잘못된 상태·정리 실패는 ERROR다. 중단 뒤 남은 프로브는 NOT_TESTED다. 120초 제한·단일 전파·현재 시각/abort·소유/격리·finally 정리는 기존과 같다.

별도 `TRON_PRIVATE_TVM_NEGATIVE_FIXTURES` envelope는 `fixtureExpectation/fixtureVerdict`와 `validatorRegression`을 구분한다. 결함 Fixture의 FAIL은 정의한 정상 transfer 기대 위반이며 자산 전체 안전성이나 Report 1.0 Assessment 판정이 아니다. 예상 결함이 실제로 관측되고 정확히 거부되면 검증기 회귀 결과는 EXPECTED_REJECTION_OBSERVED, 전체 실행은 OBSERVED/종료 코드 0이다. getter 블록 UNKNOWN을 유지하며 기존 읽기 전용 판정/지원 상태와 스키마는 승격·완화하지 않는다. 반환 raw bytes, 로그, 전후 표본, 기대/실제 오류 코드는 안전한 필드만 보존한다.

후속 범위는 비표준 approve/transferFrom, 추가 오류·자원 한도, TVM 보고서 계약의 버전/검증이다. Mainnet·최종성·자산 안전성은 이번 증거로 검증하지 않는다.
