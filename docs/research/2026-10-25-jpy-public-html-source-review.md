# JPYC·JPYSC 공개 HTML 취득과 선택 소스 검토

2026-10-25 KST 사용자 후속 지시로 공개 페이지를 직접 저장했다. **5배포 중 JPYC Ethereum/Polygon/Avalanche와 JPYSC Ethereum의 소스·설정을 확보했고, Kaia는 HTML만 확보했다.** 앞선 [로컬 입력 점검](2026-10-25-jpy-technical-input-inventory.md)의 미확보 기록은 당시 결과 그대로 보존한다.

프록시/구현체 8묶음의 선택 소스를 수동 검토했다. 이 문서의 `SOURCE_REVIEWED`는 고정 snapshot의 함수·modifier·조건을 읽은 연구 상태다. 기술 검토 CLI 실행·compiler/AST 생성·RPC·배포 runtime 비교·실제 권한/전송/서명은 수행하지 않았다. 제품 PASS/지원/전체 권한 보장·감사 완료로 바꾸지 않는다. 기존 CLI 실제 외부 실행 범위는 여전히 Ethereum USDC 1배포다.

## 대상과 공식 식별자 재확인

[JPYC 공식 조직](https://github.com/jpycoin)의 현행 상품 주소·chainId 1/137/43114/8217과 [JPYSC 공식 상품 페이지](https://www.startale.com/ja/jpysc)의 Ethereum 계약 링크를 재확인하고 HTML을 보존했다. JPYC Prepaid는 제외한다. JPYSC 상품 페이지의 외부 입출고 제한을 소스의 전송 함수 존재로 덮어쓰지 않는다.

| 배포 / chainId | 공식 목록의 토큰 주소 | 저장 페이지의 구현체 표시 | 소스 확보·연구 상태 |
| --- | --- | --- | --- |
| JPYC Ethereum / 1 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e` | proxy6 + implementation17 Solidity 파일, SOURCE_REVIEWED |
| JPYC Polygon / 137 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e` | proxy6 + implementation17, SOURCE_REVIEWED |
| JPYC Avalanche / 43114 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e` | proxy6 + implementation17, SOURCE_REVIEWED |
| JPYC Kaia / 8217 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 미확보 | 지원된 인라인 소스 묶음 추출 불가 / INCONCLUSIVE; 소스 검토 NOT_TESTED |
| JPYSC Ethereum / 1 | `0x6781d5631BFe47432b089e64e3EaB3b6eDd26177` | `0xba161409749ae95e9bbc1cf3a2dd3fe3e0af1d5e` | proxy9 + implementation41, SOURCE_REVIEWED |

구현체는 explorer의 표시 후보이며 직접 고정 블록 슬롯 관측이 아니다. 각 체인에서 표시된 주소만 최대 한 단계 따라갔다. JPYC 세 체인의 proxy/implementation 소스 묶음과 후보 입력은 각각 바이트 동일함을 확인했지만 코드·상태·배포 동일성을 인증하지 않는다. Kaia에 같은 구현체를 복사하지 않는다.

취득 페이지: [JPYC Ethereum](https://etherscan.io/address/0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29#code), [Polygon](https://polygonscan.com/address/0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29#code), [Avalanche](https://snowscan.xyz/address/0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29#code), [Kaia](https://kaiascan.io/address/0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29?tabId=contractCode), [JPYSC Ethereum](https://etherscan.io/address/0x6781d5631BFe47432b089e64e3EaB3b6eDd26177#code). 구현체 소스는 같은 host의 표시 주소 `/address/<implementation>`에서 별도 저장했다.

## 취득·추출·컴파일 입력

원본은 Git 제외 `source-intake/jpy-public-html-20261024T170822Z/`에 보존했다. 파일 저장용 HTTPS GET은 공식2 + 토큰5 + 구현체4 = 11회, 전부 HTTP200, 합계7,044,101바이트다. 취득 구간은 **2026-10-24 17:08:22~17:09:35 UTC**이며 분석 날짜 2026-10-25 KST와 구분한다. 사전 웹 읽기 도구 탐색은 이 저장 요청수와 별개이며 일부 explorer 조회는403이었다. 로그인·쿠키 제공·challenge 해결은 하지 않았고 일반 HTTPS 응답을 저장했다.

초기 저장은 고정7URL·개별6MiB·timeout20초·응답 읽기25초·redirect/재시도0으로 제한했다(응답 합계 상한42MiB). 구현체 후속 저장은 표시 후보4URL을 고정한 별도 plan의 개별6MiB/합계24MiB·전체120초·같은 timeout·redirect/재시도0이었다. 응답을 스트리밍 중 크기/시간을 확인했고 기존 파일을 덮어쓰지 않았다. 관리형 프록시 환경은 상속했다. 이들은 RPC/API 키를 사용하는 수집이 아닌 공개 HTML 취득이다.

HTML의 `editor_contractJsonData` 문자열 리터럴을 디코딩한 뒤 JSON으로 파싱했다. 페이지 JavaScript·외부 스크립트·빌드/import 코드는 실행하지 않았다. 중복 JSON 키·동명 경로 충돌·절대/상위/원격 경로를 거절하고 소스명/크기를 제한했다. `sources/settings.json`을 분리 보존했으며 실제 Solidity import의 상대경로/remapping만 로컬 대조했다. **119개 Solidity 파일과 161개 import 연결(체인별 사본 포함), 미해결0**, settings8개다. 이는 compiler가 검증한 AST/상속/완전성 증명이 아니다. 사용되지 않은 remapping 대상은 다운로드하지 않았다.

| 저장 묶음 | 표시 contract / compiler 식별자 | 제공 설정 | import 연결 / 미해결 |
| --- | --- | --- | --- |
| JPYC proxy, 각3체인 | ERC1967Proxy / `v0.8.11+commit.d7f03943` | optimizer true/runs3000, libraries 빈 객체, outputSelection | 각5 / 0 |
| JPYC implementation, 각3체인 | FiatTokenV1 / 같은 표시 버전 | 위와 동일 | 각26 / 0 |
| JPYSC proxy | ERC1967Proxy / `v0.8.34+commit.80d5c536` | optimizer true/runs200, evmVersion osaka, viaIR true, metadata 및 remappings | 8 / 0 |
| JPYSC implementation | StablecoinV1 / 같은 표시 버전 | 위와 동일 | 60 / 0 |

JPYC settings에 evmVersion/metadata/viaIR 필드가 없으므로 값을 보충하지 않았다. JPYSC metadata는 `useLiteralContent=false`, `bytecodeHash=ipfs`, `appendCBOR=true`다. 표시된 compiler 식별자는 보존했지만 설치 compiler의 전체 runtime 버전과 대응은 NOT_TESTED다. 새 compiler 다운로드·실행0이며 explorer 설정을 원래 배포 build의 독립 증명으로 취급하지 않는다.

설치 패키지 메타데이터의 solc 버전은0.8.37이며, 기존 compiler profile registry에는 위0.8.11/0.8.34 식별자가 없다. 이 점검은 파일 읽기만으로 수행했고 다른 버전으로 대체 컴파일하지 않았다. 여기서 compiler/AST 미실행은 취득한 실제 대상 소스에 관한 것이며, 필수 `npm run check`의 기존 사설 Fixture 검증과 구분한다.

소스/설정/ABI/추출 manifest와 `compiler-input.candidate.json` 8개를 신규 디렉터리에0600, 디렉터리0700으로 보관했다. candidate는 제공 설정을 합친 오프라인 입력이며 컴파일 성공이나 재현된 배포 입력이 아니다. Kaia HTML에서는 지원한 인라인 묶음이나 Solidity pragma를 확인하지 못했다. 동적 화면에서 소스를 제공할 가능성은 남기며 소스 부재·미검증 계약으로 판정하지 않는다. 내부 API 추측·다른 explorer 전환은 하지 않았다.

## JPYC 선택 소스 조건

아래 `J`는 `jpyc-ethereum-implementation-extracted-62ef84737596/sources/`다. 동일 hash를 별도 확인한 Polygon/Avalanche snapshot에도 같은 텍스트 관측만 적용한다. 줄 번호는 추출 파일 기준이다. 함수 본문과 관련 modifier/호출을 수동 검토했으며 전체 실행 경로·현재 역할값은 증명하지 않는다.

| 항목 | 고정 소스에서 읽은 조건 | 근거 (`J` 아래 파일:줄) |
| --- | --- | --- |
| 전송·위임 전송 | transfer는 정지·송신/수신 차단 검사 후 내부 전송. transferFrom은 spender/from/to 차단과 allowance 확인·차감, 최대uint allowance는 차감 생략 | `contracts/v1/FiatTokenV1.sol:287`, `:315`, `:333` |
| 승인·철회 | approve와 승인0은 같은 정지·caller/spender 차단 조건. _approve는 주소0 검사 후 allowance 대입. 이 본문에 이전 allowance를0으로 요구하는 분기는 관측되지 않음 | `contracts/v1/FiatTokenV1.sol:251`, `:269` |
| 발행 | onlyMinters·정지·caller/수신 차단, 양수 amount·발행 allowance 상한, 공급/잔액 증가와 발행 allowance 차감 | `contracts/v1/FiatTokenV1.sol:140`, `:152` |
| minter 관리·소각 | configureMinter는 onlyMinterAdmin·정지 조건, removeMinter는 onlyMinterAdmin. burn은 minter·정지·caller 차단·양수/잔액 조건 후 공급 감소 | `contracts/v1/FiatTokenV1.sol:180`, `:357`, `:374`, `:391` |
| 정지·차단 | pause/unpause는 pauser 일치. blocklist/unBlocklist는 blocklister 일치. pauser/blocklister 변경에는 onlyOwner | `contracts/v1/Pausable.sol:62`, `:70`, `:78`, `:94`; `contracts/v1/Blocklistable.sol:53`, `:65`, `:86`, `:100` |
| 소유권·업그레이드 | onlyOwner는 owner()와 caller 비교. 소유권 이전은 해당 조건·새 주소0 거절. UUPS 진입의 onlyProxy와 _authorizeUpgrade의 onlyOwner를 구분 | `contracts/v1/Ownable.sol:48`, `:57`; `contracts/upgradeability/UUPSUpgradeable.sol:82`, `:95`; `contracts/v1/FiatTokenV1.sol:598` |
| 서명 기반 경로 | permit/authorization 전송·취소 진입과 EIP2612/EIP3009 의존 소스 존재. cancelAuthorization 진입에는 whenNotPaused | `contracts/v1/FiatTokenV1.sol:495`, `:533`, `:566`, `:586` |
| 다른 ERC20 회수 | rescueERC20는 rescuer 일치 후 외부 tokenContract.transfer 호출. 외부 토큰 동작·자금 통제 범위는 UNKNOWN | `contracts/v1/Rescuable.sol:49`, `:60` |

선택 소스의 반환 true/이벤트/대입을 실제 반환·로그·잔액 변화의 관측으로 바꾸지 않는다. 보관·입출금 서비스, 상환·준비자산·안정성은 이 검토 대상이 아니다.

## JPYSC 선택 소스 조건

아래 `S`는 `jpysc-ethereum-implementation-extracted-f85fc70ce612/sources/`다. 역할 계정 수집이나 실제 권한 행사는 완료조건으로 요구하지 않는다.

| 항목 | 고정 소스에서 읽은 조건 | 근거 (`S` 아래 파일:줄) |
| --- | --- | --- |
| 전송·위임 전송 | transfer에 정지·caller/수신 차단 조건. transferFrom에 caller/from/to 차단·allowance 소비 후 내부 전송. 최대uint allowance 차감 생략 | `src/StablecoinV1.sol:319`, `:368`, `:869`, `:914` |
| 승인·철회 | approve와 승인0은 정지·caller/spender 차단 조건. _approve는 주소0 검사와 allowance 대입. 발행 allowance의 별도 zero 조건과 혼동하지 않음 | `src/StablecoinV1.sol:348`, `:896` |
| 발행 | onlyMinter·정지·caller/수신 차단·minter별 수신 whitelist, 양수 amount·발행 allowance 상한과 차감 | `src/StablecoinV1.sol:108`, `:658`; `src/Whitelistable.sol:45` |
| 발행 대상·한도 관리 | whitelist 변경은 onlyWhitelistManager. configureMinter는 minterAdmin·대상 차단 검사, 현재 발행 allowance가0이어야 함. 일반 ERC20 approve의 zero-reset 조건이 아님 | `src/Whitelistable.sol:38`; `src/StablecoinV1.sol:592`, `:621`, `:636`, `:645` |
| 소각 | minter·정지·caller 차단, 자기 잔액 한도, 공급/잔액 감소. 발행 allowance는 본문에서 증가하지 않음 | `src/StablecoinV1.sol:694` |
| 정지·차단 | pause/unpause는 pauser 일치. blacklist/bulk와 해제는 blacklister 일치. 역할 변경은 기존 역할 또는 owner 경로와 주소/역할 분리 조건을 구분 | `src/Pausable.sol:32`, `:47`; `src/Blacklistable.sol:37`, `:42`, `:69`, `:81`; `src/StablecoinV1.sol:759`, `:774`, `:792` |
| 강제 이전 | seize는 seizer 일치·수신 차단 검사·송신 차단 필요·주소0/잔액 조건 후 양측 잔액 이동. 진입/본문에는 pause 검사가 없고 공급량을 갱신하지 않음 | `src/Seizable.sol:36`; `src/StablecoinV1.sol:722` |
| 소유권·업그레이드 | 소유권은 상속한 onlyOwner와 2단계 수락, renounceOwnership는 revert. UUPS 업그레이드는 별도 upgradeAuthority 비교; owner와 같지 않아야 하는 갱신 조건 존재 | `src/StablecoinV1.sol:124`, `:231`, `:246`, `:257`, `:266`; `lib/openzeppelin-contracts-upgradeable/contracts/access/Ownable2StepUpgradeable.sol:62`, `:81`; `lib/openzeppelin-contracts/contracts/proxy/utils/UUPSUpgradeable.sol:88` |
| 서명 취소 차이 | cancelAuthorization 진입에는 정지·차단 modifier가 없으며 상속 함수의 서명/nonce 검사로 연결. 서명 생성/검증 실행은 NOT_TESTED | `src/StablecoinV1.sol:528`; `src/ERC3009.sol:119` |
| 다른 ERC20 회수 | assetRecoverer 조건 뒤 외부 tokenContract에 safeTransfer. 해당 외부 코드의 효과는 UNKNOWN | `src/AssetRecovery.sol:36`, `:53` |

whitelist는 선택 mint 경로의 조건이며 일반 transfer/approve의 필수 조건으로 확대하지 않는다. seize 주석의 법원 명령, 업그레이드 주석의 timelock48시간·다중서명은 실제 제도/배포 설정 증거가 아니다. 역할 분리 검사를 모든 경로의 불변식 보장이나 현재 운영 설정 인증으로 바꾸지 않는다. 수수료·rebase·전체 외부 효과·감사 진위에 대한 배포 결론은 UNKNOWN이다.

## 고정 바이트 연결과 검증

전체 HTML/소스별 hash와 URL/취득시각은 비공개 `download-manifest.json`, `implementation-download-manifest.json`, `extraction-summary.json` 및 각 추출 `manifest.json`에 있다. 원문은 Git/웹에 추가하지 않는다. 아래 SHA256은 비교한 입력의 연결이며 원본 진위·배포 대응 인증이 아니다.

| 후보 standard JSON | SHA256 |
| --- | --- |
| JPYC proxy, 각각 취득한3체인 동일 | `0865719818cc27e64bb979f9d7e570a14f62c7bf5f49b333f714a7c42ec05590` |
| JPYC implementation, 각각 취득한3체인 동일 | `e757eaeb5caf9fc33530efa23e1b87215fd7d1ea2e79f03123c239fc4dc7745c` |
| JPYSC proxy | `b4d01c7511a28af3d4b7c32a9b2bb8ab49c03759ad17db53257358bacfd8d7df` |
| JPYSC implementation | `e2b5263126df9a55f2d587959bd8d99343ec540c47b9584cfff5df4e230e3ecd` |

검증 기록은 `.state/agent-logs/jpy-html-validation.json`이다. 저장 HTML11개 hash 불변, 추출한 모든 소스의 hash 일치, 후보8개 import161연결/미해결0, JPYC3체인 후보 동일성과0600/0700을 확인했다. 추출기의 실행 표현식·중복키·위험 경로 거절과 주석 안 import 제외도 로컬 입력으로 확인했다. 추출 스크립트는 `.state/extract-jpy-public-html.py`에 보관한다.

이번 공개 HTML 취득·선택 소스 검토는 완료했다. **새 실제 배포 검증·compiler 실행은 시작하지 않았다.** Kaia 동적 소스의 별도 제공물 확보 또는 정확한 compiler profile/제공 입력을 이용하는 후속 분석은 그 입력과 실행 경계를 먼저 정한다. 현재 모든 배포 binding은 UNKNOWN, 미실행 검사는 NOT_TESTED이며 기존 보고서·시장 누락·판정은 보존한다.
