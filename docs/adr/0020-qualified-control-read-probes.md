# ADR 0020: 소스 연결이 미확인인 제어 getter의 한정 읽기 관측

상태: 채택, 2026-10-20.

USDC의 고정 후보와 검증 서비스 입력은 metadata 제외 runtime 본문을 재생성했으나 전체 source binding은 UNKNOWN이다. 앞선 연구 문서는 exact binding을 getter 조회 구현의 전제로 두었다. 이는 연구 단계에서 둔 제한으로, 외부 RPC 읽기 자체를 금지하는 저장소 지침은 아니다. 사용자의 후속 진행 요청에 따라 조회 응답과 권한 검증을 분리한다.

별도 연구 도구 `tools/research/usdc-control-probe.ts`에서 qualified read-only probe를 허용한다. 제품 CLI·공통 도메인·AssessmentReport의 지원/판정은 변경하지 않는다. 소스 연결이 미확인인 ABI를 검증된 배포 ABI로 등록하지 않는다.

- CLI는 Ethereum chain 1, 공식 USDC proxy, 기준 구현 주소와 proxy/구현의 전체 runtime Keccak-256을 고정한다. 새 블록에서 모든 전제가 성립한 경우만 무인자 getter `owner`, `pauser`, `paused`, `blacklister`, `masterMinter`를 호출한다. mismatch·실패·UNKNOWN이면 다른 ABI/주소로 재시도하지 않는다.
- RPC allowlist와 정확한 `to`, zero `from`, selector, 번호 block tag를 강제한다. 서명/send/setter·state override·임의 calldata·latest fallback은 없다. implementation 코드 조회와 proxy 대상 호출을 구분한다.
- 끝에 같은 높이 헤더와 proxy/구현 코드·구조를 재확인한다. 실패·차이는 CONSISTENCY_ERROR로 기록하고 응답을 일관된 상태 snapshot으로 사용하지 않는다. 이 검사는 atomic hash pinning·재조직 부재·최종성 증명이 아니다.
- 32바이트 word의 address padding과 bool 0/1만 디코딩한다. 실패는 READ_FAILED/INVALID_RESPONSE이며 false나 NOT_SUPPORTED로 대체하지 않는다. isBlacklisted는 계정 표본이 없어 NOT_TESTED로 둔다.
- 별도 v1 JSON schema와 참조/값/호출 문맥 검증 후 기존 0600 원자 저장기를 사용한다. OK는 응답 디코딩이고 전체 verdict는 INCONCLUSIVE다. source/dispatch/권한·발행사/출처·지원은 UNKNOWN, 실제 행위 실행은 NOT_TESTED로 유지한다.

이 결정은 반복적인 metadata 조사 때문에 허용된 읽기 관측을 미루지 않으면서, 완전한 소스 인증·역할 행사·전송 허용 판정과의 경계를 유지한다. 공개망 상태 변경 허용 범위는 확대하지 않는다.

후속 확장 `--role-code`는 실행별 getter 증거에서 얻은 주소 4개를 코드 조회에만 허용한다. optional v1 `roleCodeReadings` 필드에 EMPTY/PRESENT·바이트/hash·getter/코드/후행 증거를 연결한다. 성공 코드 재조회 뒤 마지막 헤더를 확인하며 변화/실패는 CONSISTENCY_ERROR다. 역할 주소의 함수·storage 호출이나 제어 주체 판정을 추가하지 않는다. 기본 모드와 과거 보고서는 그대로 유지한다.

별도 명시 management 명령 `usdc-minter-management-probe.ts`는 새 role-code gate에 의존해 고정 MasterMinter target의 `owner()`/`getMinterManager()` 두 무인자 view 후보만 읽는다. 기존 두 모드의 함수 allowlist는 확대하지 않는다. USDC masterMinter·대상 code·마지막 header를 재확인하고 별도 v1 계약으로 저장한다. baseProbe와 management evidence namespace, token owner와 관리 owner를 분리한다. 제3자 0.4.24 ABI는 현재 공식 0.6.12 소스와 합치지 않으며 source/실제 authority는 UNKNOWN이다.

후속 RLUSD 연구 명령 `rlusd-control-probe.ts`도 이 경계를 적용한다. 사용자 제공 ABI와 고정 소스의 초기화 함수명 차이·상속 dependency 공백을 유지한 채, 고정 Ethereum proxy/구현 전체 코드·EIP-1967 선언 슬롯을 새 블록 전후로 확인하고 무인자 paused와 역할 ID 6개만 zero caller로 조회한다. bytes32 역할 ID와 실제 역할 보유자는 구분하며, 후보 literal MATCH/MISMATCH는 source binding 판정이 아니다. 역할/계정 인자 함수·별도 proxy/MultiSign ABI는 추가 호출하지 않는다. 별도 v1 보고서와 제한된 transport를 사용하며 기존 USDC 모드나 제품 평가 경로는 확대하지 않는다.

별도 `rlusd-role-admin-probe.ts`는 같은 실행의 새 무인자 baseProbe와 role getter6개의 coherent canonical 응답을 전제로 getRoleAdmin(bytes32) 관계 읽기만 허용한다. base snapshot/hash와 증거 namespace를 동결하고 번호 블록을 재선택하지 않는다. 새 명령의 전후 구조/역할/chain/마지막 header 검사와32요청 제한을 별도로 적용한다. 기본 bounded transport의 보호된 전송 처리만 재사용하며 기본 allowlist/24요청 제한은 유지한다. 반환 ID를 재귀 탐색하거나 실제 계정/서명/권한으로 해석하지 않는다.

USDT 연구 명령도 고정 chain/address/fullruntime hash 및 source-study hash로 한정한다. 새 블록에서 무인자7개 address/bool/uint256 응답을 관측하며 fee는 bigint→십진 문자열이다. EIP-1967 전제를 강제하지 않고 upgradedAddress/owner를 자동 추적하지 않는다. 전후 code/chain/마지막 header와 별도 보고서 계약을 검사한다. 공유 protected bounded transport를 연구 모듈로 분리했으며 기본 request는 거부하고 각 자산/모드 validator·기존 한도를 유지한다.

별도 USDT owner 표본 모드는 같은 실행의 validated coherent base와 일치한 nonzero owner 두 응답을 전제로 한다. 선정 주소 하나에 대한 USDT blacklist 두 view 응답 및 코드만 허용하고 owner 대상 함수는 호출하지 않는다. base/source/hash·namespace·16+16=32요청 제한을 고정하고 owner/최초 성공 코드/USDT code/chain/마지막 header를 재검사한다. 기본 probe와 제품 지원 범위는 유지하며 표본을 서비스 계정·운영자·권한으로 승격하지 않는다([상세](../USDT_OWNER_SAMPLE_PROBE.md)).

USDC owner 표본 확장은 별도 명령에서만 fresh 기본5getter의 coherent canonical nonzero owner 주소 하나를 허용한다. USDC proxy의 isBlacklisted(address) 한 호출과 전후 owner/고정5slot/proxy·implementation 전체 코드/chain/마지막 header를 검증한다. 기존 control guard 뒤 보호된 send hook으로 bounded transport를 주입해 새 base32/sample24/총56요청·10초/1MiB·redirect 거부를 강제한다. 기본/role-code/management 모드는 원래 transport와 보고서 형태를 유지한다. 표본을 서비스 계정·운영자 인증으로 변환하지 않는다([상세](../USDC_OWNER_SAMPLE_PROBE.md)).
