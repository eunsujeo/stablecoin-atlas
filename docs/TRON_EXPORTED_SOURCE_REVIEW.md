# TRON USDT 제공 소스 검토

사용자가 내보낸 `tron-usdt-editor-sources.json`에서 Solidity 10개 파일의 전체 본문을 확보했다. 입력은32,081 bytes, SHA-256 `b4c0163910110198f41452e6f8f5d1322df70e4871b2fd35f09968b002480b49`다. [기계 판독 기록](research/tron-export-source-review.json)에 파일별 hash·줄 범위·10개 findings를 연결했다. 검토 상태는 **제공 snapshot의 선택 경로 SOURCE_REVIEWED**다.

## 자료와 연결

원본 JSON과 본문은 [별도 추출 폴더](../source-intake/tron-usdt/extracted-b4c016391011/)에 보존했다. 내용은 재포맷하지 않았고 파일은 배타 생성했다. 모든 model의 `fileNameClaim`은 null이었다. 저장 이름은 고유 contract/library 선언과 import 관계에서 추론한 이름이며 원래 파일명 인증이 아니다. modelIndex·language·원래 null 값과 사용자 주장 capture 시각도 manifest에 보존했다.

10개 파일의 import 9개는 모두 로컬에서 연결된다. `TetherToken`의 경로는 `StandardTokenWithFees`, `StandardToken`, `BasicToken`, `SafeMath`, `Pausable`, `BlackList`, `Ownable`을 포함해8개 파일이다. `Migrations`와 `MultiSigWallet`은 이 경로 밖에 있으며 배포 owner가 multisig라는 근거로 사용하지 않는다. pragma는 토큰 경로 `^0.4.18`, 별도 Migrations `^0.4.4`, MultiSigWallet `^0.4.10`이다. 컴파일·배포 bytecode 대조는 하지 않았다.

계약 주소 `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`는 export에 담긴 사용자 제공 출처 주장이다. 소스와 현재 배포의 동일성은 UNKNOWN이다. 앞서 받은 [부분 HTML 진단](TRON_SOURCE_HTML_INTAKE.md)은 당시 자료의 이력으로 보존한다.

## 전송·승인

아래 local 경로는 `deprecated=false`일 때다. 실제 현재 설정을 조회한 결과가 아니다.

| 함수 | 제공 소스의 조건과 동작 |
|---|---|
| transfer | pause 해제·sender blacklist 해제, nonzero recipient와 잔액 조건. fee를 제외한 금액과 양수 fee의 owner 전송을 별도 처리한다. 각 leg의 주소가 sender/owner와 겹치면 순차 잔액 변경도 영향을 받으므로 단순한 최종 debit을 일반화하지 않는다. |
| transfer 반환 | 최상위 TetherToken은 `super.transfer`를 반환한다. 중간 StandardTokenWithFees는 `returns (bool)`을 선언했지만 BasicToken 반환값을 버리고 명시적 return이 없다. **ABI의 bool 선언만으로 true 성공을 보장할 수 없다.** 실제 반환값·배포 동작은 NOT_TESTED이며 FAIL/취약점 판정은 하지 않는다. |
| transferFrom | pause 해제·from blacklist 해제, nonzero to·잔액·allowance 조건. 순차적으로 from에서 전체 금액 차감, to에 net 금액, owner에 양수 fee를 더한다. 유한 allowance는 전체 금액만큼 차감하고 MAX_UINT는 유지한다. Transfer와 선택적 fee Transfer를 내며 이 경로에 Approval은 없다. 명시적으로 true 반환. |
| approve | pause 해제 후 allowance를 덮어쓰고 Approval·true 반환. 본문에 zero-reset 강제·nonzero spender·blacklist 검사는 없다. 0 초기화를 권하는 주석과 실행 조건을 구분한다. |
| increase/decreaseApproval | pause 해제. increase는 SafeMath 증가, decrease는 부족하면0으로 제한하고 아니면 차감한다. Approval·true 반환. |
| 수수료 | 정수 나눗셈과 maximumFee 상한을 적용한다. 선언 초기값은0이며 현재 값은 미확인이다. owner의 setParams는 basis points를20 미만, 스케일 전 max fee를50 미만으로 제한하고 decimals로 스케일한다. |

transfer/transferFrom의 blacklist 조건을 recipient·spender·caller 전체의 동결 검사로 확대하지 않는다. 제공된 채팅 ABI의 bool 출력과 uint8 decimals 선언은 선택 소스 선언과 맞지만, 별도 ABI 파일의 전수 구조 대조나 실제 반환 확인은 아니다. Ethereum USDT의 무반환·zero-reset 조건도 이 TRON 소스에 복사하지 않는다.

## 권한과 전달 분기

`onlyOwner`는 `msg.sender == owner`다. 소스상 초기 owner는 배포 호출자이고, 소유권 이전은 nonzero 새 owner를 요구한다. 현재 owner·키 통제는 검증하지 않는다.

| 함수 | 권한과 상태·이벤트 |
|---|---|
| pause/unpause | onlyOwner + 현재 pause 상태 조건, Pause/Unpause. 전송·승인/증감 wrapper에 pause 제한이 있다. |
| add/removeBlackList | onlyOwner, 대상 mapping 변경과 Added/RemovedBlackList. |
| issue/redeem | onlyOwner, owner 잔액과 supply를 SafeMath로 증감. Issue/Redeem과 zero 주소 Transfer. redeem은 임의 사용자 잔액 소각이 아니다. |
| destroyBlackFunds | onlyOwner + 대상 blacklist. balanceOf로 금액을 읽고 local 잔액을0, local supply를 차감해 DestroyedBlackFunds를 낸다. 이 본문에는 Transfer가 없다. deprecated이면 balanceOf는 전달될 수 있으므로 전달 대상의 잔액까지 소각한다고 일반화하지 않는다. |
| setParams | onlyOwner + 상한 검사, 수수료 상태 변경과 Params. |
| deprecate | onlyOwner + nonzero target, deprecated와 upgradedAddress 변경·Deprecate. 이 본문에 대상 code/interface 검사는 없다. |

관리자 함수 전체에 pause 제한이 있다고 쓰지 않는다. deprecated이면 전송·승인/증감·balanceOf·allowance·totalSupply가 대상 계약 호출로 갈라진다. 기존 wrapper의 pause/blacklist 조건은 해당 함수에 남는다. 대상 구현은 제공되지 않아 내부 권한·반환·상태 의미는 미검토다. interface의 legacy 호출자 확인 주석은 구현 증거가 아니다. EIP-1967/UUPS 업그레이드로 동일시하지 않는다. `oldBalanceOf`는 deprecated일 때 local 잔액을 반환하며, 그 외 분기에는 명시적 return이 없다.

## 검증 범위

원본/추출 hash, 선언 기반 이름 연결, 중복·경로·크기 경계, import 누락, 인용 줄 구간을 로컬에서 확인했다. 소스·HTML·페이지 JavaScript 실행, 네트워크 요청, 컴파일, 실제 권한 행사·거래는 하지 않았다. 기존 보고서·catalog hash와 제품 판정은 보존한다. 전체 저장소 검사 결과는 [작업 목록](STABLECOIN_EVIDENCE_BACKLOG.md)에 기록한다.

전체 `npm run check`는184개 통과, 실패·skip0이었다. 기존13개 고정 소스/41개 인용 구간, 기존15개 보고서와 catalog hash도 보존됐다. Lead 검토 응답은 proceed였고 출처 인증·실제 반환·배포 권한을 소스 검토와 분리하는 조건을 반영했다.
