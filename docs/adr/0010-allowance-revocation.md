# ADR 0010 — 승인 철회와 후속 spender 거부 관측

날짜: 2026-10-19. 상태: 채택.

## 문제

승인 변경·한도 초과 및 0 transferFrom 검사는 approve(spender,0) 이후 양수 전송 거부를 별도로 확인하지 않는다. [ERC-20 명세](https://eips.ethereum.org/EIPS/eip-20#approve)는 재승인이 allowance를 덮어쓰며 성공한 approve에 Approval 이벤트를 요구한다. 이 시나리오는 명세의 승인 동작과 기존 호환성 정책에 따라 샘플 상태를 관측한다.

## 결정

ERC20-010 v1.0.0 / ALLOWANCE를 추가한다. 프로그램이 시작한 사설 Anvil의 신규 Fixture에서만 실행한다. owner/spender/recipient는 별도 로컬 계정이다. 외부 read-only는 NOT_TESTED/NOT_EXECUTED/UNKNOWN이며 쓰기 RPC를 추가하지 않는다.

1. owner가 10000n을 승인한다. 사전 TRUE/legacy EMPTY·성공 receipt·해당 토큰의 Approval(owner,spender,10000)·실제 allowance 10000을 모두 확인한다. 관측된 전제 미충족은 INCONCLUSIVE/COMPLETED, revokeAttempted=false/probeAttempted=false다.
2. 승인 후 잔액·총공급량을 기준으로 owner의 approve(spender,0)을 실행한다. 사전 TRUE/EMPTY·성공 receipt·Approval(owner,spender,0)·실제 allowance 0 및 샘플 잔액/supply 불변을 요구한다. 관측된 불일치는 FAIL/support UNKNOWN이며 spender probe는 보내지 않는다.
3. 철회 후 기준 상태를 새로 읽어 owner 잔액 1 이상, allowance 0, 서로 다른 세 actor를 확인한다. 전제 미충족은 INCONCLUSIVE이며 probe를 보내지 않는다. 확인되면 기존 spender가 transferFrom(owner,recipient,1n)을 시도한다.

후속 probe의 PASS에는 다음 두 반환/receipt 조합 중 하나와 두 잔액·총공급량·allowance 무변경, 해당 토큰의 Transfer signature 로그 없음이 모두 필요하다. 잘못된 ABI 로그가 엄격한 디코딩에서 제외돼도 해당 raw topic이 있으면 PASS를 차단한다.

| 사전 반환 | 실제 receipt | 해석 |
|---|---|---|
| REVERT | 실패 | 거부 관측 |
| FALSE | 성공 | 거부 반환과 상태/이벤트 무변경 관측 |
| TRUE/EMPTY/FALSE | 실패 | 모순된 실행 신호만으로 거부를 확정하지 않음, INCONCLUSIVE |
| REVERT | 성공 | 모순된 실행 신호, INCONCLUSIVE |
| MALFORMED | 어느 쪽이든 | 관측된 반환 호환성 실패, FAIL |
| TRUE/EMPTY | 성공 | 거부 조건 미충족, FAIL |

샘플 상태 변경이나 Transfer 이벤트가 관측되면 모순된 반환/receipt보다 관측된 불일치를 우선하여 FAIL이다. 조회·RPC·transport·디코딩 실패는 기존 INCONCLUSIVE/ERROR다. 알 수 없는 관측을 0이나 거부로 대체하지 않는다. 실패 receipt만으로 성공을 선언하는 기존 rejected helper는 이 시나리오에 사용하지 않는다.

## 증거와 한계

초기 승인·철회·probe의 raw/preflight, 별도 transactionHash/receipt·이벤트·상태를 보존한다. 모든 변경은 시나리오 snapshot으로 복원한다. requested는 probe의 1n이며 JSON 문자열 "1"이다. 철회 금액 0은 approve 인자와 Approval 값에 보존한다. supplyBeforeNegative/supplyAfterNegative는 비음수 십진 문자열 계약을 추가한다. Report/Lab schemaVersion 1.0을 유지하고 기본 7종에 결과 한 건씩 추가한다.

PASS는 샘플 철회 조건 및 이후 거부를 관측했다는 뜻이다. 원래 모든 전송을 거부하는 토큰도 후속 probe를 거부할 수 있어 철회가 거부의 원인임을 증명하지 않는다. 이를 위한 양수 승인 대조 실험은 이 시나리오에 추가하지 않았다. 다른 계정·입력·대체 권한·다른 상태·전역 안전성은 미검증이다. EMPTY는 기존 호환성 수용이며 Boolean ABI 준수가 아니다. preflight는 채굴 반환 데이터가 아니다.

Lead `3d1670071dff43d4b5e50541db17e288`의 revise_plan 조건을 반영했다. 반환/receipt 일치, 철회 후 새 기준 상태, 전제 실패 시 probe 미전송, 인과 주장 제한을 적용했다. 검토는 소스 검토이며 실제 테스트나 운영 승인을 대신하지 않는다.
