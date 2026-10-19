# 시나리오 명세 v1.0.0

모든 로컬 시나리오는 funded owner, 빈 recipient, 별도 spender에서 시작한다. 일반 양수 전송은 정수 base unit 10000, ERC20-008/009는 0n, ERC20-010의 철회 후 probe는 1n을 사용한다. 각 시나리오 종료 후 snapshot을 복원한다. 관리자 주소를 포함한 actor들은 해당 Anvil의 테스트 계정이다.

| ID | 검증 조건 | 실패/불확실 조건 |
|---|---|---|
| ERC20-000 | 잔액 조회 및 Fixture 초기 상태 | 호출/ABI 오류는 INCONCLUSIVE |
| ERC20-001 | name/symbol/decimals/totalSupply 디코딩, decimals 정수 0~255 확인 | 잘못된 ABI 응답·uint8 범위 위반 FAIL, 읽기 실패(선택 필드 revert/RPC 장애) INCONCLUSIVE |
| ERC20-002 | 전송 receipt, raw return, 송수신 잔액, 수취량과 이벤트, 잔액 초과 거부/무변경 | false/malformed, 잔액·이벤트 불일치 FAIL |
| ERC20-003 | 최초 승인, 변경, 필요시 zero→재승인, 최종 allowance, Approval 값 | 반영되지 않는 승인/잘못된 반환·이벤트 FAIL |
| ERC20-004 | transferFrom 수취량·이벤트·allowance 차감, 한도 초과 거부/무변경 | 전송/allowance 불일치 FAIL |
| ERC20-005 | TRUE/FALSE/EMPTY/MALFORMED/REVERT 구분, 상태·이벤트 교차 확인 | FALSE/MALFORMED는 성공 불인정, EMPTY는 다른 증거 필요 |
| ERC20-006 | 차감량·수취량 차이, supply 변화 | 전송 증거 불충분 INCONCLUSIVE, exact-receipt 불일치 FAIL |
| ERC20-007 | Pause와 Blacklist를 별개 결과로 기록, owner·무권한 거부·차단·복구 | Fixture setter 사용 불가 INCONCLUSIVE |
| ERC20-008 | 0 전송의 사전 TRUE/EMPTY·receipt 성공·Transfer(from,to,0), 두 계정 잔액과 샘플 supply 무변경 | 관측된 거부·false/malformed·이벤트/상태 불일치 FAIL, 조회/전송 장애 INCONCLUSIVE/ERROR |
| ERC20-009 | 양수 유한 승인 확인 후 spender의 0 transferFrom, 반환·receipt·Transfer 0, 샘플 잔액/supply/allowance 무변경 | 승인 전제 미충족 INCONCLUSIVE·0 미시도, 0 호출의 관측된 거부/불일치 FAIL, RPC/디코딩 장애 INCONCLUSIVE/ERROR |
| ERC20-010 | 승인 전제 후 approve 0·Approval 0·allowance 0, 기존 spender의 1n probe 거부 및 샘플 상태 무변경 | 전제 미충족 INCONCLUSIVE·후속 호출 미시도, 관측된 철회/상태/반환 불일치 FAIL, 반환과 receipt의 모순 INCONCLUSIVE, RPC/디코딩 장애 ERROR |

추가 입력은 전체 매개변수 공간을 대표하지 않는다. 한 번의 fee 없는 전송으로 수수료 기능의 부재를 주장하지 않는다. ERC20-005와 006은 같은 전송 기능을 다른 조건으로 관측하므로 별도 snapshot에서 반복한다. ERC20-007의 두 결과는 scenarioId와 capability 조합으로 구별한다.

미실행(read-only)은 NOT_TESTED. 상태를 확인할 수 없거나 실행/전송 장애가 있으면 INCONCLUSIVE/ERROR. nonce, 네트워크, receipt 시간 초과 같은 장애는 토큰 revert로 분류하지 않는다.

Unit tests: 관측 증거 gate, UNKNOWN/NA, bigint와 소수 정밀도, 반환값 분류, 미실행 집계, RPC 오류 분류.
Integration tests: 7종 Fixture baseline 2회 결과 재현성, exact-receipt 정책 차이, 증거 참조, negative Fixture, 읽기 전용 허용 RPC 확인, 잘못된 주소·네트워크·EOA.

보고서의 의도된 FAIL과 테스트 실행 실패는 다르다. false 토큰에서 FAIL을 정확히 출력하면 해당 자동 테스트는 통과한다.

## ERC20-001 경계 검증

decimals는 ABI 디코딩 이후에도 number·정수·0~255를 확인한다. 정상 0/255는 KNOWN이고 범위 위반은 INVALID_RESPONSE/Identity UNKNOWN이다. 빈 name/symbol과 큰 supply/balance는 관측값 그대로 보존한다. 메서드 revert·RPC/transport 장애의 READ_FAILED와 잘못된 ABI 응답의 INVALID_RESPONSE를 구분한다. 현재 name/symbol은 string ABI이며 bytes32 fallback 변환은 제공하지 않는다. [로컬 재현과 결과](METADATA_BOUNDARY_RESULTS.md).

## ERC20-008 v1.0.0

0 전송은 일반 전송과 별개 입력으로 검사한다. 0인 잔액 변화만으로 성공 처리하지 않는다. 해당 토큰에서 엄격하게 디코딩한 owner/recipient/value 0 이벤트와 채굴 성공도 필요하다. EMPTY는 기존 호환성 정책이며 bool ABI 준수나 채굴 반환값의 직접 증거가 아니다. 실패 support는 UNKNOWN이고, PASS도 해당 계정·0 입력에 한정된다. 수수료 부재나 모든 계정 상태 무변경을 증명하지 않는다. ERC20-008은 transferFrom의 0 처리와 zero address 수취인을 검사하지 않는다.

0 거부·0 이벤트 누락·0 이벤트와 1 unit 이동을 재현하는 부정 Fixture는 테스트용으로만 추가한다. 기본 lab의 7종 구성은 유지한다. 전송 전 RPC/transport 장애 및 전송 후 조회 오류/malformed 응답에서는 INCONCLUSIVE/ERROR와 복구를 확인한다. 외부 read-only는 새 항목도 NOT_TESTED다. [ADR 0008](adr/0008-zero-transfer-scenario.md)에 판정·호환성을 기록한다.

## ERC20-009 v1.0.0

ALLOWANCE 분류로 owner의 10000n 승인 반환·receipt·Approval·실제 allowance를 확인한 후, 새로 읽은 상태를 기준으로 spender가 owner→recipient 0n을 보낸다. 0 이벤트, 성공 receipt, TRUE/EMPTY, 두 잔액·총공급량·allowance 무변경이 모두 필요하다. 승인 확인 실패 시 zeroTransferAttempted=false와 INCONCLUSIVE를 기록하고 0 거래를 보내지 않는다. 승인과 전송 영수증은 구분한다. 전송만 0에서 거부/false/malformed를 반환하거나 allowance를 1 소비하는 Fixture와 승인 이벤트 누락/잘못된 allowance도 검증한다. RPC/전송/후속 allowance 디코딩 장애는 INCONCLUSIVE/ERROR이며 승인까지 snapshot으로 복원한다. 0 allowance의 권한 의미는 범위 밖이다. [ADR 0009](adr/0009-zero-transfer-from-scenario.md).

## ERC20-010 v1.0.0

승인 10000n을 확인한 뒤 owner가 approve(spender,0)을 실행한다. 성공 반환·receipt·Approval 0·실제 allowance 0·샘플 잔액/supply 불변을 요구한다. 최초 승인 전제 미충족은 INCONCLUSIVE이고 revokeAttempted/probeAttempted는 false다. 관측된 철회 실패는 FAIL이며 probe를 보내지 않는다. 확인된 철회 후 새 기준 상태에서 기존 spender의 transferFrom(owner,recipient,1n)을 실행한다.

후속 거부는 REVERT+실패 receipt 또는 FALSE+성공 receipt와 상태 무변경·Transfer 이벤트 없음으로 확인한다. 실패 receipt만으로 거부 성공을 선언하지 않는다. TRUE/EMPTY/FALSE와 실패 receipt 또는 REVERT와 성공 receipt의 모순은 상태/이벤트 불일치가 없을 때 INCONCLUSIVE다. MALFORMED나 관측된 상태/이벤트 불일치는 FAIL이다. 요청 1n은 JSON 문자열 "1"이며 철회·probe도 snapshot으로 복원한다. PASS는 철회와 후속 거부의 관측이며 철회가 거부의 원인이었다는 증명은 아니다. [ADR 0010](adr/0010-allowance-revocation.md).

## EVM-PROXY-001 v1.1.0

동일 블록에서 지원되는 선언 대상과 코드 존재를 해석하면 PASS. 구조 신호 없음, 잘못된/조회 불가 슬롯, 코드 없는 대상, 슬롯 충돌, 자기 참조, Beacon 오류/호출자별 응답 차이는 INCONCLUSIVE다. Proxy/업그레이드 부재를 증명하지 않는다. UPGRADEABILITY support는 UNKNOWN이다. 로컬 slot-spoof의 구조 해석도 실제 dispatch/권한 증거로 오인하지 않는지 검증한다.

EIP-1967 implementation/beacon과 ZeppelinOS implementation 중 하나의 주소만 존재하고 나머지 대상 슬롯이 성공적으로 ZERO일 때 해석한다. 동일 주소라도 여러 대상 슬롯이 설정되면 미확정이다. ZeppelinOS admin은 해당 패턴의 슬롯 값을 기록하며, 조회 실패는 implementation 해석과 분리한다. 모든 슬롯·대상 코드 조회는 metadata와 같은 블록을 사용한다. canonical ERC-1167은 정확한 runtime 일치로 대상을 해석한다.
