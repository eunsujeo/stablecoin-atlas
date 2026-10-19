# ADR 0003 — ZeppelinOS 선언 대상의 읽기 전용 관측

날짜: 2026-10-19. 상태: 채택. ADR 0002의 legacy 슬롯 제외 범위를 이 패턴에 한해 확장한다.

## 근거와 결정

Mainnet USDC의 EIP-1967 슬롯만으로는 구현 주소를 확정할 수 없었다. Circle 공개 소스는 keccak256("org.zeppelinos.proxy.implementation") 및 keccak256("org.zeppelinos.proxy.admin")을 사용한다. 이 두 슬롯을 같은 pinned block에서 조회한다. 공식 소스는 슬롯 관례의 DOCUMENTED 근거이며 배포 코드 일치나 발행사 인증의 증거가 아니다.

- [Circle UpgradeabilityProxy](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/upgradeability/UpgradeabilityProxy.sol): implementation 슬롯 관례.
- [Circle AdminUpgradeabilityProxy](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/upgradeability/AdminUpgradeabilityProxy.sol): admin 슬롯 관례.
- [Circle FiatTokenProxy](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/v1/FiatTokenProxy.sol): 상속 관계. 공개 소스 확인일 2026-10-19.

일반 계약에서는 EIP-1967 implementation/beacon 및 ZeppelinOS implementation 슬롯 중 한 대상만 설정되고 나머지가 명확히 ZERO일 때만 대상 주소와 코드 존재를 해석한다. 여러 대상 슬롯(같은 주소 포함), 읽기 실패, 잘못된 응답, 자기 참조, 코드 없는 대상은 INCONCLUSIVE다. 새 legacy 슬롯 조회 실패도 기존 EIP-1967 해석을 보류한다. canonical ERC-1167은 기존 정확한 runtime 검사 경로를 유지한다.

pattern은 ZEPPELINOS_IMPLEMENTATION_SLOT이다. adminAddress는 선택한 패턴에 해당하는 슬롯의 주소 관측이며 관리자 실체나 권한 검증이 아니다. admin 읽기 실패만으로 구현 주소 해석을 실패시키지 않는다. 다른 패턴의 admin 값을 대신 쓰지 않는다.

## 증거와 경계

PASS는 1차 선언 대상과 해당 블록의 코드 존재뿐이다. 실제 delegation/upgrade 권한·중첩 대상·최종 실행 코드는 확인하지 않으며 UPGRADEABILITY support는 UNKNOWN이다. 신규 Anvil Fixture로 정상·위조·빈 대상·자기 참조·교차 슬롯 충돌을 검증한다. HTTP 전달 서버에서 읽기 실패/잘못된 응답/대상 코드 조회 오류를 확인한다. 운영 자산의 상태 변경이나 fork 조작은 없다.

## 호환성

공통 schemaVersion은 1.0을 유지한다. EVM-PROXY-001 scenarioVersion은 1.1.0으로 올려 검사 범위 확장을 표시한다. pattern enum 및 probes의 키가 추가되므로 소비자는 이를 허용해야 한다. 기존 관측이 더 많은 슬롯 검사로 INCONCLUSIVE가 될 수 있다. 구버전 결과와 비교할 때 scenarioVersion과 관측 블록을 함께 확인한다.
