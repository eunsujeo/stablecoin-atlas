# ADR 0002 — 읽기 전용 Proxy 신호와 업그레이드 검증 분리

날짜: 2026-10-19. 상태: 채택.

## 결정

Identity 조회 시 같은 관측 블록에서 EIP-1967 implementation/beacon/admin 슬롯과 정확한 canonical ERC-1167 runtime을 검사한다. 신규 `EVM-PROXY-001` 시나리오는 선언된 대상 주소와 해당 블록의 코드 존재를 확인한다. 이는 업그레이드 권한·실제 dispatch·자산 안전성을 검증하지 않으며 UPGRADEABILITY support는 UNKNOWN을 유지한다.

슬롯 신호의 결과는 `EIP1967_IMPLEMENTATION_SLOT` / `EIP1967_BEACON_SLOT`이다. 슬롯이 있다고 실제 Proxy라고 확정하지 않는다. Identity의 KNOWN implementationAddress는 **관측한 1차 선언 대상**이라는 의미이며 최종 실행 구현을 보증하지 않는다. 동등한 슬롯을 가진 비위임 Fixture에서도 주소 해석은 PASS지만 upgrade support는 UNKNOWN임을 회귀 테스트한다.

Beacon은 implementation 슬롯이 성공적으로 ZERO로 확인된 경우만 해석한다. Beacon 자체 코드, `implementation()` 응답과 대상 코드를 조회한다. 호출자는 Proxy 주소와 zero 주소를 각각 관측하고 서로 다르면 해석을 보류한다. 두 샘플의 일치는 모든 호출자에 대한 독립성을 보증하지 않는다.

두 슬롯 동시 설정, 슬롯 조회 실패/잘못된 응답, 자기 참조, 대상 코드 없음, Beacon 오류/호출자별 차이는 INCONCLUSIVE로 둔다. admin 슬롯 주소는 관측 값일 뿐 실제 관리자나 권한 행사의 증명이 아니다. 빈 슬롯으로 불변성이나 관리자 부재를 주장하지 않는다.

## 범위와 실행 경계

기존 CLI에 거래 옵션을 추가하지 않는다. 외부 assess에 추가되는 RPC는 `eth_getStorageAt` 및 pinned-block `eth_getCode`/`eth_call`뿐이다. 테스트용 Proxy/Beacon/slot-spoof/clone은 직접 생성한 Anvil에 새로 배포한다. 운영 코드나 외부 자산에 쓰기 호출을 하지 않는다.

Fork의 실제 자산을 조작하는 실행 경로는 현재 AGENTS.md의 신규 Fixture 경계와 맞지 않아 도입하지 않는다. 향후 별도 정책 결정이 필요하다. 이번 변경은 Proxy 권한 테스트, 업그레이드 실행, 재귀 Proxy, legacy storage, clone 변형, Diamond 등을 구현하지 않는다.

## 보고서 호환성

공통 모델과 schemaVersion 1.0은 유지한다. 시나리오 ID가 추가되므로 소비자는 고정 결과 개수 대신 ID/capability로 처리한다. 7종 기본 토큰에는 알려진 구조가 없어 INCONCLUSIVE가 각각 한 건 추가된다. 기존 ERC20 시나리오 판정은 동일하다.

## 공식 근거

- [ERC-1967](https://eips.ethereum.org/EIPS/eip-1967): 표준 저장 슬롯과 Beacon 조회 순서.
- [ERC-1167](https://eips.ethereum.org/EIPS/eip-1167): 고정된 표준 runtime의 target 추출. canonical 형식만 구현하며 다른 형식을 부정하지 않는다.

## 후속 결정

[ADR 0003](0003-legacy-proxy-slots.md)이 ZeppelinOS implementation/admin 슬롯에 한해 legacy 제외 범위를 확장한다. 최신 Proxy 시나리오 버전은 1.1.0이다. 나머지 실제 위임/권한 검증 및 실행 경계는 유지한다.
