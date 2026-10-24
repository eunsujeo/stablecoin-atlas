# USDC 저장 관측과 solc0.6.12 소스 후보의 오프라인 검토

[이전 실제 읽기](2026-10-24-usdc-token-review-live.md)의 compiler 미연결 항목을 보강했다. 새 RPC/HTTP·다운로드·키·DB/UI 변경 없이 기존 pin과 일치하는 로컬 solc0.6.12를 제한된 worker에서 실행하고, 블록26261502의 저장 관측을 별도 입력으로 사용했다. 기존 실제 보고서의 PARTIAL/NOT_RUN/UNKNOWN과 원문·시각·소비 상태는 수정하지 않았다.

## 실행과 결과

compiler 전체 버전 `0.6.12+commit.27d51765.Emscripten.clang`, SHA256 `3e1956c550ca48e289044c7c0bd892403081b4b5e17e77ce707c815ce6c4228f`가 기존 연구 기록과 일치했다. 이는 compiler의 독립 인증이 아니며 NOT_TESTED를 유지한다.

| 입력 | 소스/정적 분석 | 전체 runtime 대조 |
|---|---|---|
| 기존 고정 소스 후보 | 컴파일 성공, 함수91·진입43 | 미링크 library, UNKNOWN |
| 저장 서비스 입력 그대로 | 절대 source path 규칙으로 거절, 원문 보존 | 미실행 |
| 고정 소스 + 저장된 명시 library 설정의 별도 후보 | 컴파일 성공, 함수91·진입43 | RUNTIME_MISMATCH, 배포 연결 UNKNOWN |

별도 후보는 원래 소스의 content·가상 경로를 유지하고 libraries 설정만 저장된 입력에서 가져왔다. 이 설정은 실제 배포 설정이나 현재 library identity로 인증하지 않았다. 원래 입력/과거 source binding UNKNOWN도 보존했다. metadata 삭제·치환·부분 일치로 성공을 만들지 않았다. 전체 결과는 PARTIAL이며 안전성·취약점·지원 여부의 판정이 아니다.

정적 관계는 발행/소각, 주소 제한·정지, 역할/소유 설정 변경, 승인/반환, 관련 내부 호출·modifier와 저장값 변경 위치를 제공한다. 직접 caller 주소 비교 소스 구문12개가 진입 경로별로 기록됐다. 같은 조건 선언을 여러 진입점이 참조할 수 있으므로12명의 권한자나12개의 독립 기능을 뜻하지 않는다. 모든 경로의 권한 보장·실제 동작·키 보유 구조는 UNKNOWN이다.

새 보고서의 모드는 OFFLINE, 현재 블록/새 체인 관측은 없다. archive에는 원래 관측 종료 `2026-10-24T09:07:19.548Z`와 원본 hash·블록을 별도로 기록한다. 이 저장 관측은 독립적인 진위 인증을 받은 것이 아니다. 실제 기록 이후의 업그레이드나 설정 상태를 추정하지 않는다.

## 후보 소스의 항목별 검토

2026-10-25에 저장된 linked 후보의 `source-0.input.json`과 컴파일 결과를 직접 읽어 아래 표를 정리했다. 입력 SHA256은 `3772f524c6e1ad29eb3352ab5fabe440f907bf525e306c1dead961652976f364`다. 근거 위치는 해당 입력 안의 **계약 이름·함수·소스 줄 번호**이며 원문이나 외부 서비스의 절대 경로를 게시하지 않는다. 최종 선택 계약은 `FiatTokenV2_2`다. 같은 이름의 상위 계약 선언만으로 최종 동작을 판단하지 않고 override와 내부 호출을 함께 확인했다.

표의 `SOURCE_REVIEWED`는 제출된 후보 소스의 함수·modifier·조건을 검토했다는 연구 상태다. 기존 보고서의 판정은 변경하지 않는다. 모든 행의 **배포 연결은 UNKNOWN**, 실제 외부 실행은 **NOT_TESTED**다. 전체 권한 보장과 실행 의미는 자동 분석에서도 `NOT_PROVEN`이며, 이 표는 감사나 취약점 판정이 아니다.

| 항목 | 후보 소스에서 확인한 조건·효과 | 근거 위치 | 연구 상태 |
|---|---|---|---|
| 발행 | `mint`는 미정지·minter·호출자/수취인 비제한, 0이 아닌 수취인·양수 금액·minter 한도를 확인한다. 공급량/수취 잔액 증가, 한도 차감, Mint/Transfer와 true 반환 구문이 있다. | FiatTokenV1: mint 121–144, onlyMinters 109–111 | SOURCE_REVIEWED |
| 소각 | `burn`은 미정지·minter·호출자 비제한, 양수·호출자 잔액을 확인하고 그 잔액과 공급량을 줄인다. Burn/Transfer 구문이 있다. 이 경로를 임의 타인 잔액 소각으로 해석하지 않는다. | FiatTokenV1: burn 363–377 | SOURCE_REVIEWED |
| minter 설정/제거 | configureMinter는 masterMinter·미정지 조건에서 minter와 한도를 설정한다. removeMinter는 masterMinter 조건에서 역할과 한도를 지우며 미정지 modifier가 없다. | FiatTokenV1: onlyMasterMinter 150–155, configureMinter 329–338, removeMinter 346–353 | SOURCE_REVIEWED |
| 정지/해제 | pause/unpause는 pauser 조건으로 paused를 설정한다. 발행·소각·일반 전송·승인·서명 승인/전송 진입점의 whenNotPaused를 각각 확인했다. 역할 변경·복구·초기화까지 전부 정지된다는 결론은 내리지 않는다. | Pausable: whenNotPaused 54–56, onlyPauser 62–64, pause/unpause 70–81 | SOURCE_REVIEWED |
| 주소 제한/해제 | blacklist/unBlacklist는 blacklister 조건이다. V2_2는 잔액 저장값의 최상위 비트에 제한 상태를 저장하며, _setBalance는 제한 계정과 255비트 범위 초과를 거절한다. 잔액 조회는 하위 255비트를 읽는다. | Blacklistable: 38–56, 71–83; FiatTokenV2_2: _setBlacklistState 196–203, _setBalance 215–225, _isBlacklisted 231–238, _balanceOf 249–256 | SOURCE_REVIEWED |
| 일반 전송 | transfer는 미정지·호출자/수취인 비제한, transferFrom은 여기에 from과 allowance 조건을 더한다. _transfer는 0 주소·잔액 조건과 양쪽 잔액 쓰기·Transfer를 포함하고, transferFrom은 allowance를 차감한다. 두 외부 함수는 true 반환 구문을 갖는다. | FiatTokenV1: transferFrom 258–278, transfer 287–298, _transfer 306–320; FiatTokenV2_2: _setBalance 215–225 | SOURCE_REVIEWED |
| 승인·증감·철회 | 최종 V2_2의 approve/increaseAllowance/decreaseAllowance에는 미정지 조건이 있고 상위의 notBlacklisted modifier는 없다. _approve는 owner/spender 0 주소를 거절하고 allowance를 대입하며 Approval을 낸다. 증감은 SafeMath로 계산한다. approve(spender,0)는 같은 대입 경로이고, 검토한 경로에 기존 allowance의 선행 0 전환 조건은 없다. 감소 초과는 sub 경로에서 실패한다. | FiatTokenV2_2: 262–310; FiatTokenV1: _approve 239–250; FiatTokenV2: _increaseAllowance 211–217, _decreaseAllowance 225–238 | SOURCE_REVIEWED |
| permit | bytes 및 v/r/s 진입점은 V2_2에서 미정지 조건으로 _permit을 호출하며 주소 제한 modifier는 없다. 내부에서 deadline·nonce 포함 typed data·서명 유효성을 확인하고 _approve를 호출한다. 실제 서명 생성/실행이나 재진입 안전성은 검증하지 않았다. | FiatTokenV2_2: permit 95–102, 275–284; EIP2612: _permit 56–111 | SOURCE_REVIEWED |
| 서명 전송/수신·취소 | 두 형식의 transferWithAuthorization/receiveWithAuthorization는 미정지·from/to 비제한 조건이다. 내부에서 열린 시간 구간(validAfter < now < validBefore), 미사용 nonce·서명을 확인하고 nonce 사용 표시 뒤 _transfer를 호출한다. receive는 to==msg.sender도 요구한다. cancel은 미정지·미사용 nonce·서명 조건으로 취소를 기록한다. 일반 transferFrom allowance 차감과 별도 경로다. | FiatTokenV2: 96–179; FiatTokenV2_2: 116–183; EIP3009: 117–144, 196–224, 252–267, 296–336 | SOURCE_REVIEWED |
| 서명 검증 의존성 | SignatureChecker는 코드 유무에 따라 ECDSA 복구 또는 ERC1271 staticcall의 성공/반환값을 확인한다. linked 후보의 library 설정을 실제 배포 library의 코드·identity 인증으로 보지 않는다. | SignatureChecker: isValidSignatureNow 38–46, isValidERC1271SignatureNow 59–74, isContract 80–85 | SOURCE_REVIEWED |
| 역할/소유 변경 | owner 조건으로 owner·masterMinter·pauser·blacklister·rescuer를 교체하며 각 새 주소의 0 주소 거절 구문이 있다. token owner를 proxy admin이나 단일 개인 키로 동일시하지 않는다. | Ownable: onlyOwner 73–75, transferOwnership 82–90; FiatTokenV1: updateMasterMinter 384–393; Pausable: updatePauser 87–96; Blacklistable: updateBlacklister 89–98; Rescuable: updateRescuer 66–72 | SOURCE_REVIEWED |
| 초기화/버전 이행 | initialize는 미초기화, initializeV2/V2_1/V2_2는 순차 버전 조건을 확인한다. 이 진입점에는 onlyOwner modifier가 없다. V2_1은 계약 보유 잔액의 lostAndFound 전송과 자체 제한 설정, V2_2는 symbol/기존 제한 계정 이행 및 버전 갱신을 포함한다. 현재 배포의 초기화 완료·접근 가능성이나 취약성을 추정하지 않는다. | FiatTokenV1: initialize 67–103; FiatTokenV2: initializeV2 37–45; FiatTokenV2_1: initializeV2_1 34–44; FiatTokenV2_2: initializeV2_2 41–64 | SOURCE_REVIEWED |
| 토큰 복구 | rescueERC20는 rescuer 조건으로 계약 자신이 보유한 지정 tokenContract의 토큰을 safeTransfer로 복구하는 경로다. 호출 대상의 동작·성공과 실제 복구 가능 자산은 실행하지 않았다. | Rescuable: onlyRescuer 43–45, rescueERC20 54–59 | SOURCE_REVIEWED |
| proxy 업그레이드 | 이 후보는 구현 계약 소스다. proxy 업그레이드 함수·관리자 guard의 소스 대응을 이 입력으로 확보하지 못했다. 구현의 onlyOwner로 업그레이드 권한을 대신 인증하지 않는다. | 저장 보고서의 proxy 관측과 후보 구현 소스를 구분 | UNKNOWN |
| 수수료·rebase·감사 대응 | 검토한 _transfer의 잔액 쓰기는 동일 value의 차감/가산이다. 이것만으로 실제 배포의 수수료/rebase 부재를 확정하지 않는다. linked 보고서의 audits 입력은 0개이며 감사 대상 버전·범위·snapshot/배포 연결을 확인할 근거가 없다. | FiatTokenV1: _transfer 306–320; linked 보고서 sources[0].binding 및 audits | UNKNOWN |

이 검토는 발행사 권한의 소스 조건을 정리하는 기존 범위에서 완료했다. 역할 계정 수집·실제 권한 행사·서비스 지갑/장부·준비자산을 추가 완료조건으로 두지 않는다. 실제 배포에 대한 항목별 호환성 결론은 여전히 INCONCLUSIVE이며, 기존 UNKNOWN/NOT_TESTED와 전체 PARTIAL을 유지한다.

## 비공개 결과

- `.state/token-review-usdc-source-20261025/`: 원래 소스 후보, library 미연결 결과.
- `.state/token-review-usdc-service-input-20261025/output/`: 절대 경로를 포함한 입력의 거절 결과.
- `.state/token-review-usdc-linked-candidate-20261025/output/`: 별도 linked 후보의 JSON/Markdown·compiler 입출력·원래 관측 원문·SHA256 묶음.

원문·보고서 본문·제3자 source path는 Git/웹에 게시하지 않는다. [ADR0092](../adr/0092-pinned-legacy-compiler-and-archived-review.md)와 [실행 문서](../TOKEN_TECHNICAL_REVIEW.md)의 한도·상태 의미를 따른다.

남은 근거는 현재 배포의 정확한 원본 빌드 입력/metadata·library 대응, 감사 대상 버전/commit/범위와 배포의 연결이다. 준비자산·내부 키 관리·실제 권한 행사·지갑 시스템 검증을 완료조건으로 확대하지 않는다.
