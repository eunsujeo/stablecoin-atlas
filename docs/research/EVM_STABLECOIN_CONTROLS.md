# Ethereum 스테이블코인 제어 기능 읽기 검증 공백

현재 범위 변경: [소스 기반 호환성 검토](../STABLECOIN_COMPATIBILITY_MATRIX.md)를 완료 기준으로 사용한다. 아래의 계정별 권한/실제 행사/소스 전체 재현 요구는 과거 조사 공백이며 현재 필수 완료 조건이 아니다. 과거 관측·미확인 상태는 그대로 보존한다.

검토일: 2026-10-20 UTC. 대상은 Ethereum mainnet(network ID `1`)의 USDC·USDT·RLUSD다. 공식 자료·저장된 관측·로컬 후보 빌드를 대조한 조사이며 새 RPC 조회·거래·제품 ABI 구현은 하지 않았다. 프로필 및 원본 보고서 해시는 [카탈로그](stablecoin-profiles.json)를 따른다. 행위 제어 시나리오는 **NOT_TESTED**, 지원·실제 권한은 **UNKNOWN**이다. 후속 USDC 한정 getter 응답 관측은 아래 별도 절을 따른다.

## 현재 관측과 자산별 다음 근거

| 프로필 / proxy 또는 토큰 주소 | 기존 관측 블록 / 선언 구현 대상 | 제어 ABI 조사 근거 | 다음에 필요한 근거 |
|---|---|---|---|
| USDC / `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | `26223078` / `0x43506849D7C04F9138D1A2050bbF3A0c054402dd` | Circle 공식 소스의 역할·getter 후보 아래 참조; 배포 연결 UNKNOWN | 소스 commit·빌드 조건·실제 배포 연결, 역할별 읽기와 계정별 제한 표본 |
| USDT / `0xdac17f958d2ee523a2206206994597c13d831ec7` | `26223078` / UNKNOWN | 공식 주소 참조 + Sourcify 제3자 소스·ABI 후보9개 고정; 배포 binding UNKNOWN | 최신 코드/블록 고정 후 무인자7개 한정 응답과 계정 표본 보강 |
| RLUSD / `0x8292bb45bf1ee4d140127049757c2e0ff06317ed` | `26230253` / `0x9747a0d261c2d56Eb93f542068e5d1E23170fa9e` | 공식 설계·소스 commit tree 고정 및 사용자 제공 ABI의 관리 view 후보 10개; 배포 ABI 연결 UNKNOWN | 접근 가능한 공식 소스·ABI와 관측 구현 연결, 역할 체계 확인 |

위 주소와 블록은 각각의 과거 보고서에 연결된 관측이다. 새로운 시점의 조회에는 구현 대상 변경 여부도 다시 확인해야 한다. USDC의 legacy admin 슬롯 주소 관측이나 RLUSD의 EIP-1967 admin 슬롯 ZERO는 실제 권한·운영자 실체·불변성을 판정하지 않는다. USDT의 proxy INCONCLUSIVE 역시 proxy나 업그레이드 부재를 의미하지 않는다.

## 공식 출처와 후보의 범위

아래 링크는 2026-10-20에 확인한 DOCUMENTED 근거다. 초기 소스 후보 링크는 `master` 참조다. 후속 USDC 조사는 아래 별도 절에서 commit·파일 해시를 고정하고 후보를 컴파일했다. 전체 bytecode 일치는 확인되지 않았다. 현재 mainnet에서 해당 함수·역할을 관측했다는 주장이 아니다.

| 출처 / 절 | 확인한 자료 | 이 자료로 확정하지 않는 항목 |
|---|---|---|
| [Circle token design / Roles](https://github.com/circlefin/stablecoin-evm/blob/master/doc/tokendesign.md) | owner, proxy admin, pauser, blacklister, masterMinter, minters, rescuer 역할 구분 | 현재 배포의 역할 주소·실제 제어 주체·모든 버전의 동작 |
| [Circle Pausable.sol](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/v1/Pausable.sol) | `pauser() → address`, `paused() → bool` getter 후보 | 현재 pause 값·권한 행사 가능성 |
| [Circle Blacklistable.sol](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/v1/Blacklistable.sol) | `blacklister() → address`, `isBlacklisted(address) → bool` 후보 | 실제 배포의 계정 제한·approve/transfer 적용 범위 |
| [Circle FiatTokenV1.sol](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/v1/FiatTokenV1.sol) | `masterMinter() → address` 후보 | 현재 minter 목록·민팅 한도·권한 실행 |
| [Tether integration / Ethereum](https://tether.to/en/supported-protocols/) | 토큰 주소 참조와 transfer Boolean 미반환 설명 | 관리 ABI·현재 owner·pause·주소 제한 상태 |
| [Ripple RLUSD on EVM / Smart contracts, Mainnet](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-ethereum) | proxy 사용 지침, mainnet proxy/implementation 주소·decimals 참조 | 관리 역할·제어 getter·실제 dispatch |

Ripple 문서가 연결한 `https://github.com/ripple/RLUSD-Implementation/blob/main/doc/rlusd-ethereum-design.md`는 이번 조회에서 HTTP 404였다. 해당 링크의 접근 결과이며 소스나 제어 기능의 부재를 뜻하지 않는다. 별도 이름의 저장소·유사 토큰 ABI를 공식 배포의 근거로 채택하지 않았다. USDT도 출처가 확인되지 않은 복제 소스의 getter를 확정 목록으로 넣지 않았다.

## 후속 RLUSD 공식 설계 출처 확인

2026-10-20에 공식 EVM 페이지의 Further reading → `ripple/RLUSD-Implementation` → README의 EVM Compatible Implementation 순서로 [현재 설계 문서](https://github.com/ripple/RLUSD-Implementation/blob/3632128f690aa8aaf1d23628adb54f4be60303f1/doc/rlusd-evm-compatible-design.md)를 확인했다. 앞선 `rlusd-ethereum-design.md`의 404 기록은 그대로 보존한다. README가 연결하는 파일은 `rlusd-evm-compatible-design.md`다. 전체 연결·파일 해시는 [기계 판독 출처 기록](rlusd-control-provenance.json)에 있다.

공식 저장소 commit `3632128f690aa8aaf1d23628adb54f4be60303f1`에서 README와 설계 문서를 취득했고 GitHub Contents 응답의 blob SHA-1을 파일 내용으로 계산한 값과 대조했다. 설계 문서의 SHA-256은 `4835c4e56be6331189b5ff9e37023fa16153b723f6b1a3f3a62c78d7d83aa52f`다. 이는 설계 자료의 revision 고정이며 배포 소스 revision이나 runtime 일치를 인증하지 않는다. 로컬 원문 snapshot은 `.state/rlusd-controls/`에 보존했다.

설계 문서는 Role Admin 및 Minter·Burner·Pauser·Clawbacker·Upgrader 역할, UUPS 업그레이드, 별도 MultiSign 구조를 설명한다. 이는 **DOCUMENTED 설계 주장**이다. 현재 역할 주소·서명자·정족수·실제 동작·업그레이드 권한은 UNKNOWN이다. 기존 RLUSD 보고서의 admin 슬롯 ZERO와 문서상 역할 체계를 혼동하지 않는다. 관리 getter의 정확한 signature·출력·view 여부를 제공하는 소스/ABI는 확보하지 못했으므로 읽기 후보 목록은 비워 두었다. USDC의 owner/isBlacklisted 또는 Fixture ABI를 옮기지 않는다.

GitHub 웹 도구의 contracts 경로 조회는 `Failed to fetch restricted URL`이었다. README·설계 문서를 저장한 뒤 선택적 LICENSE 조회에서 `HTTP 403 rate limit exceeded`가 발생했다. 응답 헤더는 저장하지 않아 reset 시각·정책 차단 여부는 확인하지 못했다. 이후 추가 다운로드나 우회는 하지 않았다. 원격 build/install/script, RPC 조회, 거래는 실행하지 않았다. 다음은 접근이 가능한 시점에 정확한 제어 소스·ABI를 확보하고, 기존 proxy/선언 구현 관측과 분리한 한정 읽기를 계획하는 것이다.

USDT는 [공식 integration 문서](https://tether.to/en/supported-protocols/)의 Ethereum 주소 참조를 재확인했지만 연결 explorer 조회가 `HTTP 403 Forbidden`이었다. 헤더가 없어 원인·해제 시점은 UNKNOWN이다. 주소 링크를 explorer 소스/ABI에 대한 발행사 인증으로 취급하지 않으며, 자료 미확보를 관리 기능 부재로 판정하지 않는다. 관리 ABI 공백은 유지한다.

## 사용자 제공 RLUSD ZIP·ABI의 로컬 대조

앞선 접근 실패 이후 사용자가 고정 commit ZIP과 `rlusd-implementation-abi.json`을 제공했다. [로컬 소스·ABI 조사 기록](rlusd-control-abi-study.json)에 원본 SHA-256, 소스 5개의 hash·pragma, ABI 후보와 한계를 기록했다. 기존 [설계 조사](rlusd-control-provenance.json)의 미확보 상태와 오류는 당시 기록으로 보존한다.

ZIP의 경로·파일 유형·중복·개수·크기·압축비를 확인하고 소스/문서만 전용 디렉터리에 추출했다. 전체 15개 파일의 Git blob과 mode로 Git tree를 재구성한 결과 `4901f0b35e551f9315c31bae29662f34876c226d`로, 앞서 공식 GitHub API에서 확보한 commit의 tree와 일치했다. README·설계 문서도 기존 취득본과 byte 일치했다. 따라서 이 ZIP의 파일 내용은 확보한 commit tree에 연결된다. 배포 runtime과의 동일성은 별개이며 UNKNOWN이다. 원격 명령·설치·컴파일·RPC는 실행하지 않았다.

제공 ABI는 총 79항목(function 40, view 22)이다. provenance는 **사용자 제공 구현 ABI 후보**이며, 별도 explorer 재취득·주소 연결·배포 ABI 인증은 하지 않았다. 읽기 후보는 다음 10개로 한정했다. role ID getter는 bytes32 상수이며 역할 보유자 주소가 아니다.

| signature | selector | 출력 | 로컬 소스 근거 |
|---|---|---|---|
| `paused()` | `0x5c975abb` | bool | 제공 ABI, 상속 dependency 원문 미포함 |
| `accountPaused(address)` | `0xbc8c4b4f` | bool | AccountPausableUpgradeable 직접 선언 |
| `hasRole(bytes32,address)` | `0x91d14854` | bool | 제공 ABI, AccessControl 상속 dependency 원문 미포함 |
| `getRoleAdmin(bytes32)` | `0x248a9ca3` | bytes32 | 제공 ABI, AccessControl 상속 dependency 원문 미포함 |
| `DEFAULT_ADMIN_ROLE()` | `0xa217fddf` | bytes32 | 제공 ABI, 상속 dependency 원문 미포함 |
| `MINTER_ROLE()` | `0xd5391393` | bytes32 | StablecoinUpgradeable public constant |
| `BURNER_ROLE()` | `0x282c51f3` | bytes32 | StablecoinUpgradeable public constant |
| `PAUSER_ROLE()` | `0xe63ab1e9` | bytes32 | StablecoinUpgradeable public constant |
| `CLAWBACKER_ROLE()` | `0x475ca324` | bytes32 | StablecoinUpgradeable public constant |
| `UPGRADER_ROLE()` | `0xf72c0d8b` | bytes32 | StablecoinUpgradeable public constant |

소스의 역할 ID는 literal 값을 그대로 기록했다. 역할 이름의 hash나 관례상 zero로 대신 계산하지 않는다. 함수 입력·출력·view와 selector는 제공 ABI에서 대조했으며, 빠진 OpenZeppelin dependency의 구현·호출 제한은 미확인이다. 계정 인자가 있는 두 후보는 선정 근거가 있는 공개 계정 표본이 필요하며 임의 주소를 넣지 않았다.

전체 소스·ABI 동일성은 **미확인**이다. ZIP의 V2 소스는 `reinitialize()`를 선언하지만 제공 ABI에는 `initializeV2`·`reinitializeV2`가 있고 `reinitialize()`는 없다. 이 차이의 원인을 다른 배포 버전이나 잘못된 파일로 단정하지 않는다. 소스 pragma도 토큰/계정 제어는 `0.8.29`, proxy/MultiSign은 `0.8.26`으로 나뉘며 빌드 설정·dependency는 확보하지 않았다. 완성 ABI 재생성·배포 bytecode 비교를 한 결과가 아니다.

`StablecoinProxy.getImplementation()`은 proxy 소스의 별도 후보로만 기록했고 구현 ABI에 합치지 않았다. MultiSign의 조회 기능도 토큰이나 실제 역할 주소의 기능으로 합치지 않았다. `proxiableUUID` 등 상속 호출 문맥이 미확인인 항목은 이번 토큰 proxy 조회 계획에서 제외한다. 현재 값·권한·지원·배포 연결은 UNKNOWN, getter와 행위 실행은 NOT_TESTED다. 다음 단계는 최신 chain/header/proxy 슬롯/코드를 고정한 별도 한정 읽기 계획이며, 이 문서 조사에서 호출하지 않았다.

## USDC 소스 고정과 배포 연결 조사 결과

[기계 판독 조사 기록](usdc-source-binding.json)에 공식 저장소 commit `fc85788bc7c23cefe3df1a757133048bfddadeaa`와 파일 7개의 Git blob SHA-1·파일 SHA-256을 기록했다. 내려받은 파일의 Git blob hash를 해당 commit의 tree 항목과 대조했다. 이는 공식 저장소 파일 내용의 고정이며 배포 소스 인증은 아니다. 원격 빌드·설치 스크립트는 실행하지 않았다.

| getter 후보 signature → 출력 | selector | 고정 소스 |
|---|---|---|
| `owner() → address` | `0x8da5cb5b` | [Ownable.sol](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/v1/Ownable.sol) |
| `pauser() → address` | `0x9fd0506d` | [Pausable.sol](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/v1/Pausable.sol) |
| `paused() → bool` | `0x5c975abb` | 같은 Pausable.sol |
| `blacklister() → address` | `0xbd102430` | [Blacklistable.sol](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/v1/Blacklistable.sol) |
| `isBlacklisted(address) → bool` | `0xfe575a87` | 같은 Blacklistable.sol |
| `masterMinter() → address` | `0x35d99f35` | [FiatTokenV1.sol](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/v1/FiatTokenV1.sol) |

모두 소스의 view getter 후보이며 완성된 배포 ABI를 추출한 결과가 아니다. selector는 입력 signature로 계산하며 출력 형식은 selector에 포함되지 않는다. selector 충돌이나 proxy의 호출 처리 때문에 signature만으로 실행 의미를 확정할 수 없다. 이 함수들을 공용망에서 호출하지 않았다.

기존 `usdc-readonly.json`의 `e15`는 블록 `26223078`의 선언 구현 주소에 대한 `eth_getCode` 증거다. 런타임은 23,464바이트이며 디코딩한 바이트 배열의 SHA-256·Keccak-256, 블록 헤더 hash와 원본 보고서 hash를 조사 기록에 연결했다. 마지막 길이 필드로 분리한 51바이트 CBOR metadata의 형식·필드 길이를 확인했고 `solc` 태그는 `0.6.12`였다. 이 태그가 실제 컴파일 입력이나 소스 commit을 인증하지는 않는다.

고정 저장소의 hardhat 설정은 compiler `0.6.12`, 기본 optimizer runs `10000000`을 제시한다. 환경변수 override가 가능한 저장소 기본값이므로 관측 배포의 설정으로 대입하지 않는다. 확인한 캐시 runtime/creation 파일은 **Optimism proxy**용이어서 Ethereum USDC 구현 런타임 비교에서 제외했다. Sourcify의 해당 구현 주소 `full_match`와 `partial_match` metadata 경로는 각각 HTTP 404였다. 이는 조회한 URL의 응답이며 다른 검증 자료의 부재를 입증하지 않는다.

### 고정 후보 로컬 컴파일과 비교

관측 CBOR의 IPFS multihash를 CID `QmNhkGfa5zEkiTbpnDmyvm2DjSGTFDazKhc5xbZq3Sgs58`로 변환했다. 해당 metadata 조회는 proxy CONNECT 단계에서 `Tunnel connection failed: 503 Service Unavailable`로 실패했다. X-Squid-Error는 미확인이며 이 오류만으로 정책 차단이나 인증 문제를 단정하지 않는다. 관리형 proxy 설정은 유지했고 다른 gateway로 전환하지 않았다.

별도 실험으로 공식 고정 소스의 전이 import를 따라 **23개 source unit**과 OpenZeppelin contracts **3.4.2**를 준비했다. npm registry의 `solc@0.6.12`와 의존성 tarball은 registry dist.integrity SHA-512 SRI를 검증했다. 설치 스크립트는 실행하지 않고 컴파일러만 별도 작업 디렉터리에서 로드했다. 이는 registry 내용 무결성 확인이며 독립적인 컴파일러 배포 인증은 아니다.

compiler full version은 `0.6.12+commit.27d51765.Emscripten.clang`이다. optimizer enabled/runs `10000000`, EVM Istanbul, IPFS metadata, 비-literal source metadata 설정을 고정했다. 이는 저장소 기본값과 명시한 후보 선택이며 배포 metadata를 복원한 값이 아니다. source unit 경로·내용 hash·Standard JSON 입력/출력 hash는 조사 기록에 보존했다. upstream config/build 스크립트나 네트워크 import callback은 실행하지 않았다.

첫 컴파일은 `SignatureChecker` library link reference가 남아 비교 대상이 아니었다. 컴파일러의 두 20바이트 참조 위치(18391, 20106)에서 관측 코드가 동일한 `0x800c32eaa2a6c93cf4cb51794450ed77fbfbb172` 값을 갖는지 확인한 뒤, 그 주소를 **추정 library 입력**으로 넣어 두 번째 컴파일을 수행했다. 관측 코드에 임의 patch를 적용하지 않았다. library 자체의 코드·신원·실제 호출 경로는 미검증이며 이 추정의 독립성 한계를 남긴다. 소스/optimizer 조합을 바꾸며 일치할 때까지 탐색하지 않았다.

| 비교 범위 | 결과 |
|---|---|
| 전체 deployed runtime 23,464바이트 | **MISMATCH** |
| 각 runtime의 검증된 CBOR suffix를 따로 제외한 본문 23,411바이트 | **MATCH** |
| 배포 소스·컴파일 설정의 완전한 재현 | **UNKNOWN / INCONCLUSIVE** |
| 생성된 후보 ABI | 72개 항목, hash 기록; 검증된 배포 ABI로 등록하지 않음 |

runtime hash는 hex 문자열이 아닌 디코딩한 바이트 배열을 기준으로 계산했다. 이 결과는 metadata를 제외한 고정 후보 본문의 일치이며 전체 source binding, 실제 proxy dispatch·library 동작·권한의 인증이 아니다. metadata 불일치 원인을 파일 경로·소스 내용·설정 중 하나로 단정하지 않는다. [Solidity metadata 명세](https://docs.soliditylang.org/en/v0.6.12/metadata.html)의 설명처럼 metadata에는 소스 hash와 설정 등이 연결되므로 원본 자료가 더 필요하다.

### 공식 v2 조회 자료와 독립 재컴파일

Sourcify의 [공식 contract lookup API](https://docs.sourcify.dev/docs/api/)를 확인하고 해당 구현 주소의 `GET /v2/contract/1/{address}?fields=all`로 기존 검증 자료를 확보했다. 앞선 legacy 파일 경로의 404는 이 자료의 부재를 의미하지 않았다. 검증 POST·추가 RPC·IPFS gateway 변경은 하지 않았다. 원본 응답·입력/출력·metadata·ABI·소스 hash와 저장 시각은 조사 JSON의 `verificationServiceStudy`에 기록했다. 서비스의 `verifiedAt`은 과거 서비스 기록 시각이며 새 체인 관측 시각이 아니다.

서비스는 `runtimeMatch=match`를 보고하지만, offset `23411`의 `cborAuxdata`를 교체하는 변환도 보고한다. 변환은 적용하지 않고 각 원본 byte 배열을 비교했다.

| 원본 비교 | 전체 runtime | metadata 제외 본문 |
|---|---|---|
| 서비스 onchain 코드 ↔ 기존 e15 관측 | EXACT_MATCH | MATCH |
| 서비스 재컴파일 코드 ↔ 기존 e15 관측 | MISMATCH | MATCH |
| 확보 입력의 독립 로컬 재컴파일 ↔ 기존 e15 관측 | MISMATCH | MATCH |
| 독립 로컬 재컴파일 ↔ 서비스 재컴파일 코드 | EXACT_MATCH | MATCH |

따라서 **서비스 입력의 재컴파일은 재현했지만, 과거 배포 runtime 전체의 재현은 미확인**이다. `match`를 전체 바이트 동일성이나 배포 원본 입력 복원 성공으로 바꾸지 않는다. 확보한 metadata 역시 서비스 재컴파일용 자료이며 관측 CID에 인증된 원문으로 취급하지 않는다.

서비스 입력과 기존 고정 후보는 optimizer·EVM 설정은 같지만 논리 source unit 경로와 library namespace가 다르다. 서비스 source unit은 절대 경로 형태이지만 JSON의 논리 키로만 사용했고 호스트 경로에 추출하지 않았다. 공식 고정 commit의 대응 소스 19개 중 2개는 내용 전체가 같고 17개는 달랐으며, OpenZeppelin 대응 파일 4개는 같았다. 모든 서비스 소스의 Keccak-256은 서비스 metadata의 content hash와 대조했다. 이 결과만으로 metadata 차이의 단일 원인을 확정하거나 다른 파일들이 의미상 다른 동작을 한다고 단정하지 않는다.

로컬 재컴파일은 확보 입력의 source unit·내용·library namespace를 유지하고 outputSelection만 추가했다. 준비된 content 외 import callback 없이 기존 SRI 검증 컴파일러를 사용했으며 subprocess 30초·Node old-space 512 MiB 등 실행 한도를 뒀다. 생성 ABI는 72개 항목으로 서비스 ABI와 구조적으로 일치하며 getter 후보 6개의 signature·selector·출력을 확인했다. JSON 객체의 key 순서에 따른 직렬화 hash와 구조적 동일성은 별도로 기록한다. 실제 proxy에서 getter를 실행한 증거는 아니다.

검증된 배포 ABI로 등록하려면 배포 metadata 또는 검증된 입력과 후보의 차이를 해소해야 한다. 다만 한정된 응답 관측은 ADR 0020에 따라 별도로 허용한다. 기존 issuer/native/support/authority와 시나리오 판정은 변경하지 않았다. 연구용 [runtime 비교 도구](../../tools/research/runtime-comparison.ts)는 전체 bytes 비교와 제한된 Solidity CBOR 제외 비교를 분리하며 미지원·잘못된 suffix는 UNKNOWN으로 남긴다. 서비스의 변환 포함 match를 전체 재현으로 승격하지 않는 검사와 잘못된 chain/address/관측 코드 연결 거부 검사를 포함한다.

### 후속 USDC 한정 응답 관측

[ADR 0020](../adr/0020-qualified-control-read-probes.md)은 exact source binding을 모든 getter 조회의 전제로 둔 앞선 제한을 정정한다. source/authority 검증과 별도로 [USDC 연구 probe](../USDC_CONTROL_READ_PROBE.md)를 추가했다. 블록 26230386에서 getter 5개가 OK 형식으로 응답했고 paused=false였다. 전후 헤더·코드 기준은 일치했지만 전체 해석은 INCONCLUSIVE다. 서비스 계정이 없어 isBlacklisted는 NOT_TESTED이며 권한·지원 상태는 UNKNOWN이다. 기존 소스 조사 JSON의 NOT_TESTED는 그 과거 조사 단계의 기록이며 새 보고서로 덮어쓰지 않는다.

## 현재 엔진과 Fixture의 차이

제품의 [외부 EVM 평가 경로](../../src/evm/assessment.ts)는 metadata, 인식 가능한 proxy 슬롯/대상 코드, 선택한 holder의 balance를 읽는다. PAUSE·BLACKLIST는 외부 경로에서 실행하지 않는다. [Fixture 제어 시나리오](../../src/evm/scenarios.ts)는 소유한 사설 Fixture의 `setPaused`/`setBlacklisted`를 실행해 차단·복구·비권한 호출을 검사한다.

Fixture의 `blacklisted(address)`와 Circle 소스의 `isBlacklisted(address)`는 다른 ABI다. `owner()`도 모든 자산·권한 체계에 공통인 관리 증명이 아니다. Fixture 검사를 실제 자산에서 실행하거나 그 결과를 실제 자산의 기능 검증으로 옮기지 않는다. 공통 도메인에 이 ABI들을 강제하지 않는다.

## 읽기 구현에 필요한 증거

1. **배포와 소스 연결**: network ID, 토큰/proxy 주소, 관측 블록 번호·헤더 hash, 코드 hash, 선언 구현 주소를 기록한다. 후보 소스는 commit permalink·파일·ABI signature·selector를 고정한다. compiler·설정·metadata·라이브러리 linking 차이를 포함해 bytecode 연결 여부를 명시한다. selector 존재·decode 성공·슬롯 대상 코드만으로 실제 함수 의미나 dispatch를 인증하지 않는다.
2. **호출 대상과 문맥**: 적합한 ABI를 배포에 연결한 뒤 proxy 주소의 저장 상태를 읽는 계획이다. implementation 직접 호출은 별도 초기화·저장소 상태일 수 있다. 실제 `from` 또는 생략 여부·인자·블록 태그·원시 응답과 proxy admin의 caller 제한을 기록한다. admin 사칭이나 setter 호출은 이 계획에 포함하지 않는다.
3. **역할 분리**: owner·proxy admin·pause 담당·주소 제한 담당·발행 담당을 각각 기록한다. 주소 조회는 주소 관측이며 서명자·법적 주체·multisig threshold·timelock·권한 실행 가능성을 증명하지 않는다. 추가 계약이 역할을 가지면 별도 구조 검증이 필요하다. zero 주소/슬롯을 권한 부재로 해석하지 않는다.
4. **계정 표본**: 입금 송신자·수신자·출금/sweep 계정·spender 등 필요한 역할별 공개 표본과 선정 이유가 필요하다. 현재 서비스 계정 표본은 미지정이며 임의 주소로 대체하지 않았다. 실제 고객 정보나 비밀은 자료에 추가하지 않는다. 단일 주소의 false를 전체 계정·모든 입출금 허용으로 일반화하지 않는다.
5. **판정 분리**: getter 미호출은 NOT_TESTED/값 UNKNOWN이다. 향후 revert·RPC 실패·잘못된 ABI 응답은 원인·실행 상태와 INCONCLUSIVE/UNKNOWN을 보존하며 false나 NOT_SUPPORTED로 치환하지 않는다. `paused=false`는 해당 시점 값이고 기능 부재가 아니다. 조회가 성공해도 transfer/approve 차단 동작은 별도 미실행 상태다. 권한 존재 자체는 FAIL이나 취약점이 아니다.

USDC의 별도 한정 getter probe는 구현·관측했고 다음은 계정별 제한 표본과 역할 계약의 추가 읽기 근거 정리다. 검증된 배포 ABI 등록을 위한 exact source binding 공백은 별도 유지한다. 이 단계에서도 공용망 거래·서명·mint/freeze·운영 권한 실행은 추가하지 않는다. TRON·Solana·XRPL은 각각의 Adapter와 상태 모델에서 별도 조사하며 이 Ethereum 계획을 그대로 적용하지 않는다.

## 후속 RLUSD 한정 응답 관측

[RLUSD 연구 probe](../RLUSD_CONTROL_READ_PROBE.md)를 별도로 구현해 블록 26231053에서 무인자 view 7개 응답을 디코딩했다. paused=false, DEFAULT_ADMIN_ROLE은 bytes32 zero였고 다른 role ID 5개는 소스 literal과 MATCH였다. 전후 코드/슬롯·마지막 헤더는 일치했으며 22개 RPC 요청·23개 증거를 저장했다. source/권한/지원 UNKNOWN, 전체 INCONCLUSIVE를 유지하며 이전 소스 조사 단계의 NOT_TESTED를 덮어쓰지 않는다. getRoleAdmin은 role 인자 범위 밖, hasRole/accountPaused는 계정 표본 미지정으로 NOT_TESTED다.

후속 [RLUSD 역할 관리 관계 관측](../RLUSD_ROLE_ADMIN_PROBE.md)은 블록 26231164에서 6개 getRoleAdmin 응답을 디코딩했고 전부 같은 실행의 DEFAULT_ADMIN_ROLE ID와 같았다. 해당 ID는 bytes32 zero이며 실제 관리자 주소나 권한 부재를 뜻하지 않는다. 후행 역할/코드/슬롯/chain/헤더 검사는 일치했다. membership/실제 권한 행사는 미검증이며 이전 무인자 단계의 getRoleAdmin NOT_TESTED는 그 단계의 기록으로 유지한다.

후속 [RLUSD 공개 표본 조사](../RLUSD_ACCOUNT_CANDIDATES.md)는 Sourcify 배포 참조와 사용자 제공 RoleGranted ABI를 고정했지만 현재 RPC의 영수증 null로 중단했다. 후보 없음과 조회 실패를 구분해 별도 ERROR 연구 보고서에 기록했고 계정별 조회는 NOT_TESTED를 유지한다.

## 후속 USDT 소스·ABI 후보 확보

[USDT 조사 문서](../USDT_CONTROL_SOURCE_RESEARCH.md)와 [기계 판독 기록](usdt-control-provenance.json)에 Tether 공식 주소 참조와 Sourcify의 별도 출처를 연결했다. 단일 TetherToken.sol·ABI44항목·compiler0.4.18을 확보했고 source hash는 서비스 metadata와 일치했다. 서비스 onchain 코드11075바이트는 과거USDT e4와 전체 일치하지만 재컴파일 코드는 전체 불일치이며 metadata replace 정보가 있어 source binding은 UNKNOWN이다. 독립 컴파일·새RPC는 하지 않았다.

무인자 owner/getOwner/paused/deprecated/upgradedAddress/basisPointsRate/maximumFee와 계정 인자 isBlackListed/getBlackListStatus의9후보를 constant/view·signature/selector·입출력·소스 행에 연결했다. deprecated 전달 분기는 EIP-1967 관측과 구분한다. 현재 값·지원·권한과 계정별 제한은 미확인이며 실행은 NOT_TESTED다. ABI decimals 출력은 uint256이며 제품 엔진/기존보고서는 변경하지 않았다.

후속 [USDT 한정 응답 관측](../USDT_CONTROL_READ_PROBE.md)은 블록26231540에서7개 canonical 응답과 owner/getOwner MATCH, paused/deprecated false, fee 문자열0을 기록했다. 전후 code/chain/header는 일치했지만 지원·현재 권한·실제 동작은 미확인이다. isBlackListed/getBlackListStatus는 표본 미지정 NOT_TESTED다.

## 후속 USDT owner 표본 관측

[별도 표본 연구](../USDT_OWNER_SAMPLE_PROBE.md)는 fresh owner/getOwner 일치 주소 하나를 선정해 블록26231630에서 isBlackListed/getBlackListStatus 모두false, 코드 PRESENT5705바이트를 관측했다.26요청·27증거, owner/code/USDT/chain/마지막 header 확인이 일치했다. 서비스/고객 계정 표본이나 실제 권한·전송 허용의 증거는 아니며 해당 공백과 source/authority/support UNKNOWN은 유지한다.

## 후속 USDC owner 표본 관측

[새 표본 연구](../USDC_OWNER_SAMPLE_PROBE.md)는 블록26231733에서 fresh owner 응답 주소 하나의 isBlacklisted=false를 관측했다.46개 읽기 RPC/49개 증거와 전후 owner·proxy/implementation code·5slot·chain·마지막 header 일치를 보존했다. source/authority/support UNKNOWN, 전체 INCONCLUSIVE, 실제 행위 NOT_TESTED다. RLUSD receipt-null은 새 근거가 없어 반복하지 않았으며 계정 표본은 미확보다.
