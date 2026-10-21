# Ethereum USDT 관리 조회 후보의 소스·ABI 출처

대상은 Ethereum mainnet chain1의 `0xdAC17F958D2ee523a2206206994597C13D831ec7`이다. 이번 작업은 공식 주소 참조·제3자 검증자료·기존 보고서의 로컬 대조다. **새 RPC·컴파일·설치·제품 ABI 등록·거래는 실행하지 않았다.** 관리 getter의 현재 값·실행은 UNKNOWN/NOT_TESTED다.

## 출처와 배포 연결의 한계

[Tether 공식 integration 문서](https://tether.to/en/supported-protocols/)의 Ethereum USD₮ 주소 참조를 다시 확인했다. 이 페이지의 주소 링크는 Sourcify 소스·ABI에 대한 발행사 인증이 아니다. 앞선 explorer HTTP403Forbidden은 과거 접근 결과로 보존하고 재시도하지 않았다.

[Sourcify 공식 contract lookup API](https://docs.sourcify.dev/docs/api/)로 해당 chain/address 한 건의 자료를 확보했다. [기계 판독 조사 기록](research/usdt-control-provenance.json)에 조회 URL·UTC·원본/소스/ABI/metadata hash·compiler·이전 관측을 연결했다. 원본 `.state/usdt-controls/sourcify.json`은232094바이트이며 SHA-256은 `2e255dcfa76b39884b55c2165b66b5fff2e1607ff8377101908c34fb4e212886`다.

자료는 단일 `TetherToken.sol`14888바이트, ABI44항목(function32/view19), compiler `0.4.18+commit.9cf6e910`을 포함한다. 서비스 metadata에 기재된 source Keccak과 취득한 내용의 hash는 일치했다. 이는 **서비스 자료 내부의 무결성 확인**이며 발행사 저장소 commit 인증이나 배포 원본 소스 복원이 아니다. 원격 build/install/script와 compiler를 실행하지 않았다.

기존 [USDT 보고서](../reports/usdt-readonly.json)의 block26223078/e4와 변환 전 전체 runtime을 바이트 단위로 대조했다.

| 비교 | 결과 |
|---|---|
| 서비스 onchainBytecode ↔ 과거 e4 코드 | EXACT_MATCH,11075바이트 |
| 서비스 recompiledBytecode ↔ 과거 e4 코드 | MISMATCH |
| 독립 로컬 재컴파일 | NOT_TESTED |
| 완전한 source-to-runtime binding | UNKNOWN |

과거 runtime Keccak은 `0xb44fb4e949d0f78f87f79ee46428f23a2a5713ce6fc6e0beb3dda78c2ac1ea55`다. 서비스는 match를 보고하지만 offset11032에 cborAuxdata replace 정보도 포함한다. 변환은 적용하지 않았다. match를 전체 재현 성공으로, 과거 코드 복사본의 일치를 최신 독립 체인 검증으로 바꾸지 않는다.

## 읽기 후보 9개

서비스 ABI의 `constant:true`와 `stateMutability:view`가 함께 일치하는 항목만 선정했다. signature 대소문자·selector·입출력과 실제 소스 선언 위치를 연결했다. source의 public 변수/mapping getter와 직접 constant 함수를 구분했다.

| signature | selector | 출력 | 소스 근거 |
|---|---|---|---|
| owner() | 0x8da5cb5b | address | Ownable public 변수 |
| getOwner() | 0x893d20e8 | address | BlackList 직접 constant 함수 |
| paused() | 0x5c975abb | bool | Pausable public 변수 |
| deprecated() | 0x0e136b19 | bool | TetherToken public 변수 |
| upgradedAddress() | 0x26976e3f | address | TetherToken public 변수 |
| basisPointsRate() | 0xdd644f72 | uint256 | BasicToken public 변수 |
| maximumFee() | 0x35390714 | uint256 | BasicToken public 변수 |
| isBlackListed(address) | 0xe47d6060 | bool | BlackList public mapping |
| getBlackListStatus(address) | 0x59bf1abe | bool | BlackList 직접 constant 함수 |

앞7개는 무인자 후보이며 뒤2개는 근거 있는 공개 계정 표본이 필요하다. USDC의 isBlacklisted나 Fixture의 blacklisted로 이름을 바꾸지 않는다. owner/getOwner도 서로 다른 selector의 응답 후보이며 실제 운영자·서명 권한을 인증하지 않는다. source getter 선언에 접근 제한 modifier가 없다는 사실과 실제 배포 호출 문맥은 별개다. 향후 uint256 fee 값은 bigint/십진 문자열로 저장해야 하며 Number로 금액을 직렬화하지 않는다.

추가로 서비스 ABI의 decimals() 출력은 **uint256**, transfer(address,uint256)의 출력 목록은 비어 있다. 기존 metadata 결과decimals6 및 엔진은 변경하지 않았다. Boolean 미반환 설명과 ABI/소스의 정합성은 실제 전송 성공·수수료·수령량 검증이 아니다.

## deprecated/upgradedAddress 분기

소스는 deprecated인 경우 transfer/transferFrom/balanceOf/approve/allowance/totalSupply의 일부 처리를 upgradedAddress로 전달한다. 이는 소스에 있는 일반 호출 분기이며 EIP-1967 implementation 슬롯 관측으로 바꾸지 않는다. 기존 proxy INCONCLUSIVE는 이 경로의 존재/부재를 확정한 결과가 아니다.

이 후보 소스의 owner·pause·blacklist·deprecated·upgradedAddress·fee getter는 로컬 변수/mapping을 읽는다. 모든 getter가 같은 target으로 위임된다고 일반화하지 않는다. transfer는 msg.sender 제한, transferFrom은 from 제한 및 각각 pause 검사를 source 경로에서 확인했다. approve의 forwarding/로컬 분기는 별도다. zero-reset 요구는 로컬 StandardToken.approve 경로에서 확인했으며 알려지지 않은 전달 대상까지 동일하게 적용한다고 단정하지 않는다. 현재 deprecated 값·대상 주소·대상 코드·실제 dispatch/권한·제한 동작은 미조회다.

다음은 chain/address와 전체 runtime hash를 고정한 새 블록에서 무인자7개를 한정 조회하는 계획이다. 반환 upgradedAddress를 자동 추적하거나 setter·전송을 추가하지 않는다. 실제 지원·issuer/native/authority와 source binding은 UNKNOWN, 제어 행위는 NOT_TESTED로 유지한다.

후속 [USDT 한정 probe](USDT_CONTROL_READ_PROBE.md)에서 무인자7개를 별도 조회했다. 이 소스 조사 JSON의 NOT_TESTED는 당시 단계의 기록으로 보존하며 새 관측 보고서로 덮어쓰지 않는다.
