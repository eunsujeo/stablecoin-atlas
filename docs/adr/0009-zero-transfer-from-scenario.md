# ADR 0009 — 승인 후 0 transferFrom

날짜: 2026-10-19. 상태: 채택.

## 결정

[ERC-20 명세](https://eips.ethereum.org/EIPS/eip-20#transferfrom)는 0 transferFrom도 정상 전송으로 취급하고 Transfer 이벤트를 요구한다. 일반 transfer의 0 입력 성공이나 양수 transferFrom 결과로 이 동작을 추정할 수 없다.

ERC20-009 v1.0.0 / ALLOWANCE를 추가한다. 기존 ERC20-004의 delegated-transfer 분류를 따른다. 신규 사설 Anvil Fixture의 서로 다른 owner/spender와 nonzero recipient를 사용한다. owner가 유한한 10000n을 승인한 뒤 TRUE/legacy EMPTY, 성공 receipt, 해당 토큰의 Approval(owner,spender,10000), 실제 allowance 10000을 모두 확인한다. 전제를 관측했으나 충족하지 못하면 zeroTransferAttempted=false, INCONCLUSIVE/COMPLETED/support UNKNOWN으로 종료하고 0 거래를 보내지 않는다. RPC/디코딩 장애는 기존 INCONCLUSIVE/ERROR 경로다. 승인 실패 자체는 ERC20-003에서 별도로 평가한다.

승인 확인 후 상태를 새로 읽고 spender가 transferFrom(owner,recipient,0n)을 실행한다. PASS에는 TRUE/EMPTY, 성공 receipt, 해당 토큰의 엄격히 디코딩된 Transfer(owner,recipient,0), 두 잔액·총공급량·양수 allowance 무변경이 필요하다. 관측된 거부/false/malformed, 이벤트 또는 상태 불일치는 FAIL/support UNKNOWN이다. 누락된 관측을 0이나 거부로 대체하지 않는다. 승인 및 0 전송의 transactionHash/receipt는 별도 증거로 보존한다.

모든 실행은 시나리오별 snapshot에서 일어나며 승인과 잘못된 상태 변경까지 복원한다. 외부 read-only에서는 ERC20-009도 NOT_TESTED/NOT_EXECUTED/UNKNOWN이다. baseline 7종과 기존 시나리오 의미는 유지한다. Report/Lab 1.0에 결과 한 건을 추가하여 자산당 12건, 합계 84건이 된다. 금액은 JSON 십진 문자열이다.

## 한계와 검증

EMPTY는 호환성 수용이며 bool ABI 준수가 아니다. preflight는 채굴 반환 데이터가 아니다. 이 검사는 0 allowance의 권한 의미, 다른 계정/입력, 모든 상태 무변경, 수수료 부재나 전체 자산 안전성을 증명하지 않는다. 과거 77건·70건 및 외부 보고서는 당시 관측으로 유지한다.

Lead 검토 `21cd03f819c240a1977b2ca4ac3397bd`의 proceed 응답 조건을 반영했다. 새 부정 Fixture는 0 delegated 전송만 거부, allowance 1 소비, false/malformed 반환, 승인 이벤트 누락 및 잘못된 승인량을 재현한다. 기존 0 이벤트 누락/잔액 변경/거부 Fixture도 사용한다. 실제 승인·전송 receipt/이벤트·반환·상태, 승인 미확인 시 거래 미전송, RPC/transport/후속 allowance 디코딩 실패, snapshot 복구 및 read-only 무변경을 검증한다. 검토 자체는 테스트 결과나 운영 승인과 별개다.
