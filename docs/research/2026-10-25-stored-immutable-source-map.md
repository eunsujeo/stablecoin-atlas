# RLUSD·JPYSC·JPYC 저장 immutable 소스 참조표

**세 저장 입력에서 `__self` 선언·초기화와 참조 위치를 확인했다. 실제 배포 연결은 모두 UNKNOWN을 유지한다.** [직전 인계](../handoff/2026-10-25-rlusd-jpysc-offline-review.md)의 다음 행동에 따라 저장 소스·compiler AST/출력만 읽었다. 새 외부 조회·다운로드·재컴파일·runtime 대조·immutable 값 제출은 모두0이다. 이 문서는 별도 소스 참조표이며 기존 TokenTechnicalReview1.2 보고서나 판정을 교체하지 않는다.

## 입력과 시각

분석 시각은 UTC `2026-10-25T01:32:32.466124Z`다. RLUSD·JPYSC는 [기존 오프라인 분석](2026-10-25-rlusd-jpysc-offline-source-review.md)의 저장 출력, JPYC는 [기존 Ethereum 단발 검토](2026-10-25-jpyc-token-review-live.md)의 구현체 출력을 사용했다. 원래 자료 취득·분석·블록 관측 시각을 이번 시각으로 바꾸지 않는다. 이번에 공식 식별자·최신 배포를 재확인하지 않았다.

| 입력 | 저장 compiler 전체 버전 | 선택 계약 | immutable AST ID |
| --- | --- | --- | --- |
| RLUSD | `0.8.29+commit.ab55807c.Emscripten.clang` | `StablecoinUpgradeableV2` | 650 |
| JPYSC | `0.8.34+commit.80d5c536.Emscripten.clang` | `StablecoinV1` | 1623 |
| JPYC Ethereum | `0.8.11+commit.d7f03943.Emscripten.clang` | `FiatTokenV1` | 173 |

ID는 각 입력/출력 안에서만 유효하다. 세 ID의 동일한 변수명·초기화 식은 같은 배포·버전·runtime의 증명이 아니다. 입력/출력 SHA256과 소스 경로·행 번호·AST 참조·상속 목록에서 선택한 정의는 비공개 `.state/immutable-source-map-20261025/evidence.json`에 보존했다. 원문은 Git/웹에 게시하지 않는다.

## 선언·생성 시 초기화

아래 경로는 standard JSON 안의 **가상 소스 경로**이며 저장소의 Solidity 파일 경로가 아니다. `U_R`은 `lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol`, `U_J`는 `lib/openzeppelin-contracts/contracts/proxy/utils/UUPSUpgradeable.sol`, `U_P`는 `contracts/upgradeability/UUPSUpgradeable.sol`을 뜻한다. 행 번호는 원본 content 기준이다.

| 자산 | 선언/초기화 위치 | 선택 계약 계층의 생성자에서 확인한 구문 | 구분 |
| --- | --- | --- | --- |
| RLUSD | `U_R:22`, private address immutable `__self`의 선언 초기화 식 `address(this)` | `src/main/contracts/eth/StablecoinUpgradeableV2.sol:19`, 기반 `src/main/contracts/eth/StablecoinUpgradeable.sol:34`에서 `_disableInitializers()` 호출 | initializer 잠금 호출과 immutable 선언 초기화는 별도 구문 |
| JPYSC | `U_J:23`, 같은 선언 초기화 식 | `src/StablecoinV1.sol:136`에서 `_disableInitializers()` 호출 | upgradeable 경로 파일은 import만 포함하며 ID1623 선언은 `U_J`에 존재 |
| JPYC | `U_P:23`, 같은 선언 초기화 식 | 기반 `contracts/v1/Ownable.sol:34`에서 `_transferOwnership(msg.sender)` 호출 | owner 설정 호출은 `__self` 값의 제출 근거가 아님 |

세 UUPS AST에는 명시적 constructor 함수가 없고 변수 선언의 초기화 식이 있다. [JPYC의 기존 해석](2026-10-25-jpyc-immutable-input-research.md#id173에서-확인한-사실)처럼 **해당 소스의 생성 코드가 그 인스턴스에서 실행됐다는 전제 아래** `address(this)`는 생성되는 계약 자신의 주소를 의미한다. 이 전제의 실제 충족·원래 생성 코드·배포 이력은 이번 저장 소스 읽기로 증명하지 않았다. 구현체 주소나 저장 runtime으로 값을 추정·추출·채우지 않았다.

## onlyProxy·notDelegated 참조

| 항목 | RLUSD | JPYSC | JPYC |
| --- | --- | --- | --- |
| `onlyProxy` | `U_R:51` → `_checkProxy:101` | `U_J:52` → `_checkProxy:97` | `U_P:32`에서 직접 require |
| 첫 `__self` 참조 | `U_R:103`, `address(this) == __self`일 때 거절 분기 | `U_J:99`, 같은 조건 | `U_P:34`, `address(this) != __self`를 요구 |
| 두 번째 참조 | `U_R:104`, `ERC1967Utils.getImplementation() != __self`일 때 거절 분기 | `U_J:100`, 같은 조건 | `U_P:38`, `_getImplementation() == __self`를 요구 |
| `notDelegated` | `U_R:60` → `_checkNotDelegated:114` | `U_J:61` → `_checkNotDelegated:110` | `U_P:48`에서 직접 require |
| 세 번째 참조 | `U_R:115`, `address(this) != __self`일 때 거절 | `U_J:111`, 같은 조건 | `U_P:50`, `address(this) == __self`를 요구 |
| `onlyProxy` 사용 진입점 | `upgradeToAndCall`, `U_R:92` | `upgradeToAndCall`, `U_J:88` | `upgradeTo`, `U_P:82` 및 `upgradeToAndCall`, `U_P:95` |
| `notDelegated` 사용 진입점 | `proxiableUUID`, `U_R:78` | `proxiableUUID`, `U_J:74` | `proxiableUUID`, `U_P:64` |
| 선택 상속 계층의 `_authorizeUpgrade` 구현 | `src/main/contracts/eth/StablecoinUpgradeable.sol:161`, `onlyRole(UPGRADER_ROLE)` | `src/StablecoinV1.sol:246`, `onlyUpgradeAuthority` | `contracts/v1/FiatTokenV1.sol:598`, `onlyOwner` |

저장 AST의 `referencedDeclaration`으로 각 ID에 연결된 참조3곳을 확인했다. `onlyProxy`는 호출 문맥/구현체 포인터 검사이고 호출자 권한 구문은 `_authorizeUpgrade` 쪽에 따로 있다. JPYSC의 `onlyUpgradeAuthority`는 `src/StablecoinV1.sol:124`에서 `msg.sender`와 저장 `_upgradeAuthority`를 비교한다. 소스 주석의 timelock/다중서명 설명은 실제 운영 설정의 증거로 사용하지 않았다. 역할 계정·현재 owner/authority·실제 권한 행사를 확인하거나 수집하지 않았다.

위 표는 저장 구문과 상속 참조 위치다. 전체 실행 의미·실제 delegatecall/dispatch·전체 권한 보장을 판정하지 않는다. JPYSC 기존 `initialize` 경로의 CALL_LIMIT/DECLARATION_LIMIT과 STATIC_GRAPH_TRUNCATED를 유지한다.

## 저장 runtime 위치와 남은 입력

| 자산 | 저장 compiler의 immutableReferences 시작 byte offset | 각 범위 길이 | 실제 값 |
| --- | --- | --- | --- |
| RLUSD ID650 | 7186, 7348 | 32바이트 | 미제출 |
| JPYSC ID1623 | 6886, 7049 | 32바이트 | 미제출 |
| JPYC ID173 | 4570, 4720, 7950, 8100, 8351 | 32바이트 | 미제출 |

이는 생성 runtime 안의 compiler relocation 위치이며 실제 배포 코드의 관측값이 아니다. AST 참조 수3과 생성 runtime 범위 수2/2/5는 서로 다른 자료의 수다. 위치·범위 확인을 값 일치나 배포 대조로 승격하지 않았다.

다음 대조에는 정확한 입력/compiler/배포에 연결된 원래 build·생성/배포 자료와 근거를 동반한 immutable 제출값이 필요하다. RLUSD·JPYSC는 별도 고정 블록 코드 관측도 미확보이고, JPYC의 이전 프록시 CONFIRMED는 구현체를 인증하지 않는다. [잔여 작업 집계](2026-10-25-token-review-remaining-work.md)의 자산 UNKNOWN5/5·추가체인 포함8/8을 유지한다. 신규 외부 취득/실행은 정확한 별도 계획 확인 전 시작하지 않는다.

## 검증

`python3 .state/map-stored-immutables-20261025.py`: rc0/PASS, 저장3입력의 immutable 선언·초기화 AST·선택 상속 포함·참조 각3곳·범위 길이/경계를 확인했다. 기존107파일을 포함한134파일의 SHA256이 읽기 전후 같았고 새 증거 디렉터리0700/파일0600을 확인했다. compiler·RPC·runtime 대조 실행은0이다.

별도 재독에서도134파일 불변·세 UUPS의 명시적 constructor 부재·문서 로컬 링크를 확인했다(rc0/PASS). `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/immutable-source-map-check.log`). `git diff --check`: rc0.
