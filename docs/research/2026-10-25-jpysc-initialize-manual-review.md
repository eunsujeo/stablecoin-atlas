# JPYSC initialize 저장 소스 수동 보완

**자동 분석이 절단된 `initialize`를 저장 소스와 compiler AST로 수동 검토했다.** 선언42개·소스 참조 간선60개를 추적했고, 이 목록 안의 참조 ID 미해결은0이다. 기존 자동 보고서의 CALL_LIMIT/DECLARATION_LIMIT·STATIC_GRAPH_TRUNCATED와 권한 결론 UNKNOWN은 그대로다. 이번 보완은 별도 연구 기록이며 제품 분석기를 바꾸거나 재컴파일한 결과가 아니다.

## 근거와 방법

[기존 JPYSC 분석](2026-10-25-rlusd-jpysc-offline-source-review.md)의 `StablecoinV1` 저장41소스·입력·AST/출력·보고서만 사용했다. 입력/compiler는 같은 `0.8.34+commit.80d5c536.Emscripten.clang` 산출물이다. 새 분석 시각과 원래 source 취득/컴파일 시각을 분리해 비공개 evidence에 기록했다.

`.state/jpysc-initialize-manual-20261025/`에 input/output/report hash, AST ID·위치·선택 상속·호출/modifier 참조·수동 인자 연결·검토 결과를0700/0600으로 보존했다. `.state/review-jpysc-initialize-20261025.py`가 저장 참조 목록을 만들었으며 함수 본문·guard·대입 순서는 별도로 읽었다. 기존134증거파일 SHA256은 불변이다. 이번에 RPC/서명·권한 행사·compiler 실행은 없다.

아래 경로는 standard JSON의 가상 소스 경로다. `S`는 `src/StablecoinV1.sol`, `I`는 `lib/openzeppelin-contracts/contracts/proxy/utils/Initializable.sol`, `O`는 `lib/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol`, `O2`는 같은 access 경로의 `Ownable2StepUpgradeable.sol`이다. upgradeable 경로의 Initializable 파일은 import wrapper이며 실제 modifier 정의는 `I`에 있다.

## 순서·권한·상태 대입

| 구간 | 저장 소스에서 확인한 내용 | 근거 |
| --- | --- | --- |
| 진입 | `initialize`는 external이고 modifier는 initializer 하나다. onlyOwner/onlyProxy modifier는 붙어 있지 않다 | `S:165`, AST11333 |
| initializer 선행 | 버전0이고 최상위 호출이거나, 버전1이고 해당 문맥의 code.length가0인 construction 조건을 검사한다. 이후 버전1·필요시 initializing=true를 설정한다 | `I:104`, AST1447 |
| 내부 초기화 허용 | onlyInitializing은 `_checkInitializing → _isInitializing`으로 initializing 플래그를 검사한다 | `I:170`, `:178`, `:215` |
| 소유자 | `initialOwner → __Ownable_init → __Ownable_init_unchained`에서0주소를 거절한다. 선택 상속의 `_transferOwnership`은 O2에서 pendingOwner를 지우고 super O의 owner 대입/이벤트로 연결된다 | `O:51`, `:55`, `:113`; `O2:72`, AST111/330 |
| 모듈 초기화 | Pausable/Blacklistable/Whitelistable/Seizable/AssetRecovery/EIP2612/ERC3009의 unchained 초기화 본문7개는 비어 있다. 이 호출들로 pause·잔액·allowance·whitelist·nonce가 초기화/삭제됐다고 해석하지 않는다 | `src/Pausable.sol:39`; 각 모듈의 init/unchained 정의, evidence42개 |
| EIP712 | `tokenName, VERSION("1") → __EIP2612_init → __EIP712_init → __EIP712_init_unchained`로 연결된다. 도메인 name/version 대입과 기존 hashedName/hashedVersion의0 대입이 있다. 이 경로에서 서명을 검증하는 것은 아니다 | `S:67`, `:185`; `src/EIP2612.sol:34`; `lib/openzeppelin-contracts-upgradeable/contracts/utils/cryptography/EIP712Upgradeable.sol:67`, `:71` |
| 토큰 메타데이터 | 이름·symbol·currency·decimals를 StablecoinV1Storage에 대입한다. 이 본문에서 공급량·개별 잔액·minter 한도를 설정하는 구문은 확인하지 않았다 | `S:188` |
| 역할 | 아래8개 인자가 각 경로에서0주소 거절을 거친다. 역할별 저장 영역에 대입하고 변경 이벤트를 낸다 | 아래 역할 표 |
| 세 쌍의 분리 | minterAdmin=whitelistManager, blacklister=seizer, upgradeAuthority=owner이면 각각 거절한다. 모든 역할이 서로 다른8주소라는 조건으로 확대하지 않는다 | `S:195`, `:199`, `:211` |
| initializer 후행 | 최상위 호출이면 initializing=false와 Initialized(1) 이벤트로 연결된다 | `I:104`, AST1447의 `_` 이후 |

초기 소유자 설정은 위의 내부 초기화 경로다. 일반 `transferOwnership/acceptOwnership`의 2단계 경로를 초기 owner 설정에도 요구한다고 해석하지 않는다. 구현 계약 생성자의 `_disableInitializers()` 호출은 `S:136`에서 따로 확인했다. 이것으로 실제 프록시의 초기화 상태를 판정하지 않는다.

## 0주소 거절의 인자 연결

| initialize 인자 | 실제 검사 경로 | 근거 |
| --- | --- | --- |
| initialOwner | __Ownable_init_unchained(initialOwner) | `O:55` |
| initialPauser | _initializePauser(initialPauser) | `src/Pausable.sol:61` |
| initialBlacklister | _initializeBlacklister(initialBlacklister) | `src/Blacklistable.sol:106` |
| initialAssetRecoverer | _initializeAssetRecoverer(initialRecoverer로 전달) | `src/AssetRecovery.sol:65` |
| initialSeizer | _initializeSeizer(initialSeizer) | `src/Seizable.sol:60` |
| initialMinterAdmin | _initializeMinterAdmin(initialMinterAdmin) | `S:930` |
| initialWhitelistManager | _initializeWhitelistManager(initialWhitelistManager) | `src/Whitelistable.sol:90` |
| initialUpgradeAuthority | initialize 본문의 직접 검사 | `S:210` |

소스의 인자 전달·modifier 전후 순서·선택 상속의 override/super 경로를 확인한 것이다. storage getter10개의 assembly 슬롯 지정도 원문에서 확인했지만 모든 저장 충돌·실행 의미·전체 권한 불변식의 증명으로 바꾸지 않는다. initializer 호출 시 owner/각 역할의 실제 주소나 배포 초기화 여부는 이 자료로 관측하지 않았다.

## 기존 자동 결과와 보완의 관계

기존 자동 결과에는 ASSEMBLY_NOT_MODELED, CALL_ARGUMENTS_NOT_SUBSTITUTED, MODIFIER_EXECUTION_ORDER_NOT_PROVEN, STORAGE_ALIAS_NOT_MODELED, UNRESOLVED_CALL/WRITE_TARGET, VIRTUAL_DISPATCH_NOT_PROVEN도 있다. 이번에는 위 특정 entry의 소스 관계를 읽어 보완했고, 기존 보고서의 표시·원문·자동 결론을 수정하지 않았다. 참조 ID를 연결할 수 있다는 결과와 실행 시의 전체 권한 보장은 별개다.

검증은 `.state/review-jpysc-initialize-20261025.py`와 별도 `manual-review.json`의 조건 검사로 수행했다. 선언42/간선60·initializer 위치·Ownable2Step override/super·8개0주소 guard·3쌍 분리·빈 unchained7개·원본134파일 불변을 확인했다(rc0/PASS). 별도 재독도 rc0/PASS로 evidence hash·간선 양끝·guard 수·권한·원본 보존을 확인했다. `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/kaia-jpysc-four-tasks-check.log`)。`git diff --check`: rc0.
