# 스테이블코인별 체인 프로필과 검증 공백

현재 완료 기준(2026-10-20)은 [소스 기반 호환성 검토표](STABLECOIN_COMPATIBILITY_MATRIX.md)다. 권한은 소스 확인으로 충분하고, 아래 과거 서비스/역할 계정 표본 요구는 현재 필수 backlog가 아니다. 실제 권한/배포 binding의 UNKNOWN과 과거 판정은 보존한다.

조사 기준: 2026-10-20 UTC. 공식 문서를 다시 확인하고 기존 관측을 연결한 **조사 자료**다. [기계 판독 카탈로그](research/stablecoin-profiles.json)의 reviewedAt은 이 자료를 검토한 UTC 시각이다. 각 RPC 관측 시각은 별도의 observedAt에 기록한다. Ethereum RLUSD는 2026-10-20에 기존 읽기 전용 엔진으로 추가 조회했다. 기존 읽기 전용 보고서와 판정은 수정하지 않았다.

사용자 요청을 반영해 Ethereum·TRON뿐 아니라 Solana와 XRP Ledger를 조사 목록에 포함했다. Ripple은 회사/브랜드, XRP Ledger는 네트워크, XRP는 네이티브 자산, RLUSD는 별도의 스테이블코인이다. 여기서 XRP는 스테이블코인 프로필이 아니다. XRPL과 XRPL EVM Sidechain도 다른 네트워크로 구분한다. 아래 8개 조합은 이번 우선 목록이며 모든 지원 체인·스테이블코인의 전체 목록은 아니다.

## 대상과 현재 구현

| 체인 | 조사 자산 | 식별/실행 의미 | 현재 코드·실제 관측 |
|---|---|---|---|
| Ethereum mainnet | USDC·USDT·RLUSD | EVM, ERC-20 컨트랙트 주소 | 읽기 전용 엔진 구현. USDC·USDT 기존 관측, 2026-10-20 RLUSD metadata/proxy 및 별도 USDC·RLUSD 제어 응답 관측 연결 |
| TRON mainnet | USDT | TVM, TRC-20 컨트랙트 주소 | 읽기 전용 엔진 및 사설 Fixture. 실제 USDT는 과거 읽기 관측만 있음 |
| Solana mainnet | USDC·USDT | mint + 실제 owner Token Program | [mint 연구 reader로 program/초기화/decimals/supply/authority 관측](SOLANA_MINT_READONLY.md). [공통 mint-only Adapter 연결](SOLANA_ADAPTER.md), SDK·holder/delegate·행위 실행 없음 |
| XRP Ledger mainnet | USDC·RLUSD | currency + issuer, validated ledger | [issuer 연구 reader로 동일 ledger의 AccountRoot 설정 관측](XRPL_ISSUER_READONLY.md). [공통 issuer 설정 Adapter](XRPL_ADAPTER.md), SDK·trust-line/행위 실행 없음 |

Circle은 Ethereum과 Solana의 USDC 주소를 [공식 주소 표](https://developers.circle.com/stablecoins/usdc-contract-addresses)에 연결하고, 각 소개 페이지에서 해당 체인의 native USDC라고 설명한다([Ethereum](https://www.circle.com/multi-chain-usdc/ethereum), [Solana](https://www.circle.com/multi-chain-usdc/solana)). 이 발행사 문구는 DOCUMENTED이며 기존 엔진의 nativeOrBridged/issuerVerificationStatus를 변경하지 않는다.

Tether의 [공식 integration 문서](https://tether.to/en/supported-protocols/)는 Ethereum·TRON·Solana의 USD₮ 주소를 각각 연결한다. Ethereum transfer의 Boolean 미반환 설명은 Ethereum 항목의 DOCUMENTED 특성이며 TRON·Solana에 일반화하지 않는다. 이번에 실제 transfer를 실행한 증거도 아니다.

Ripple의 [RLUSD 네트워크 목록](https://docs.ripple.com/products/stablecoin/overview/supported-chains-and-networks)과 [주소 문서](https://docs.ripple.com/products/stablecoin/overview/token-addresses)는 XRPL issuer와 Ethereum proxy 주소를 구분한다. USDC의 XRPL 식별자는 Circle 주소 표가 연결한 currency/issuer 조합이다. 익스플로러 링크는 공식 페이지의 참조 대상이며 온체인 계정·코드를 새로 확인했다는 의미가 아니다.

## 공식 식별 참조

| 프로필 | 계약·mint 또는 currency/issuer 참조 | 출처 절 |
|---|---|---|
| Ethereum USDC | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | Circle Mainnet / Ethereum |
| Ethereum USDT | `0xdac17f958d2ee523a2206206994597c13d831ec7` | Tether Ethereum / USD₮ |
| Ethereum RLUSD | `0x8292bb45bf1ee4d140127049757c2e0ff06317ed` | Ripple Ethereum proxy |
| TRON USDT | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | Tether TRC20 / Tron |
| Solana USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Circle Mainnet / Solana |
| Solana USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | Tether Solana Token |
| XRPL USDC | `5553444300000000000000000000000000000000` / `rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE` | Circle Mainnet / XRPL 링크 |
| XRPL RLUSD | `524C555344000000000000000000000000000000` / `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` | Ripple XRPL issuer + [currency 문서](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl) |

Solana는 [공식 Token 문서](https://solana.com/docs/tokens)의 mint·Token Account·owner Program을 구분해 조사해야 한다. 발행사 주소 참조만으로 실제 mint owner, Original Token Program/Token-2022, authority 또는 extension을 확정하지 않는다. XRPL의 [trust-line token 모델](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)은 currency와 issuer를 함께 사용한다. 이들을 ERC-20 contractAddress나 approve ABI로 억지로 정규화하지 않는다. 공통 도메인 모델은 이번 조사에서 바꾸지 않았다.

## 확인된 증거와 미확인 항목

| 대상 | 기존 실제 읽기 관측 | 핵심 공백 |
|---|---|---|
| Ethereum USDC | metadata·선언 구현, 제어5getter·역할 코드·관리 응답, block26231733 owner 표본 blacklist=false | 실제 controller/minter·권한·dispatch·전송/승인/철회·운영 최종성 |
| Ethereum USDT | metadata/decimals6·proxy INCONCLUSIVE, 제어7getter, block26231630 owner 표본 blacklist 두 응답false·코드 | 무반환·zero-reset의 실제 동작, 실제 권한·취급 실행 |
| TRON USDT | 2026-10-19, metadata/decimals 6·잔액·allowance 읽기, 정확한 getter 블록 UNKNOWN | 응답 블록 연결, 권한·실행·Energy/Bandwidth 조건 |
| Ethereum RLUSD | metadata/decimals18·선언 구현, 제어7getter·역할 관리 관계6개 | 계정별 역할/제한·실제 dispatch·권한 행사·전송/승인/철회·최종성 |
| Solana USDC·USDT | 2026-10-21, 같은 finalized context slot459436079의 mint program/초기화/decimals6/supply/authority 필드 | holder/Token Account/delegate·실제 동결/전송·권한 행사 |
| XRPL USDC·RLUSD | 2026-10-21, 같은 validated ledger107795106의 issuer AccountRoot 설정 | 개별 trust-line·Payment 실수령·amendment 활성·실제 동결/회수 |

기존 Ethereum 보고서는 [USDC](../reports/usdc-readonly.json), [USDT](../reports/usdt-readonly.json), TRON 보고서는 [USDT self-pair](../reports/tron-usdt-allowance-readonly.json)다. 카탈로그에 원래 관측 시각·체인·주소·블록·시나리오별 판정·파일 해시를 보존했다. TRON의 allowance 0은 owner=spender=토큰 계약 주소인 표본이며 서비스 계정의 승인 상태나 권한을 입증하지 않는다. head 관측을 정확한 getter 블록으로 사용하지 않는다.

Ethereum RLUSD의 [읽기 전용 보고서](../reports/rlusd-readonly.json)는 network ID `1`, 관측 시각 `2026-10-20T00:37:35.295Z`, 블록 `26230253`에서 **PASS 2 / NOT_TESTED 11**을 기록했다. PASS는 `ERC20-001`의 metadata 조회 조건과 `EVM-PROXY-001`의 선언 pointer/코드 확인 조건에 한정한다. 이름·심볼은 RLUSD, decimals는 18이고 선언 구현 대상은 `0x9747a0d261c2d56Eb93f542068e5d1E23170fa9e`다. 실제 delegatecall 경로·업그레이드 권한·전송/승인 성공을 검증한 결과가 아니다. 모든 support와 issuer/native/authority 상태는 UNKNOWN이다.

해당 EIP-1967 admin 슬롯의 ZERO는 그 슬롯의 관측값이다. 관리자·owner/role 부재, UUPS 여부, 불변성이나 업그레이드 불가능을 뜻하지 않는다. 번호 블록으로 고정한 조회와 헤더 hash는 RPC 제공자의 응답이며 독립 검증·최종성 확정은 아니다. 보고서 SHA-256은 `b164f5a99ff8ba3c6248e08e616f45cec113052c0ae8cc0f1c25aa449b6575ba`, 블록 hash는 `0x74d3f973aace560fc8d3053fb54ea7b808d0cf1301cc88718991835b9334cc0f`다. 발행사의 공식 주소 참조 DOCUMENTED와 실제 조회 OBSERVED를 분리해 연결했다. decimals 18은 금액 단위 정보이며 가격·상환가치의 증거가 아니다.

자산별 관리자·일시정지·주소 제한의 [읽기 검증 공백](research/EVM_STABLECOIN_CONTROLS.md)을 정리했다. 제품 외부 평가 엔진은 제어 시나리오를 실행하지 않으며, 별도 [USDC 연구 probe](USDC_CONTROL_READ_PROBE.md)와 [RLUSD 연구 probe](RLUSD_CONTROL_READ_PROBE.md)에서 한정 getter 응답을 조회했다. Fixture ABI를 실제 자산 ABI로 대입하지 않는다. USDC는 source binding 공백을 유지한 채 한정 응답을 관측했다. RLUSD는 사용자 제공 ZIP의 전체 commit tree 일치와 ABI 후보 10개를 대조했다. 소스·ABI 전체 동일성과 배포 연결은 미확인이며, USDT는 제3자 소스·ABI 후보9개를 확보했으며 배포 연결은 미확인이다. 이 조사는 기존 관측·판정을 변경하지 않는다.

## 다음 검사 순서

1. **식별·권한 읽기 공백**: USDC는 한정 getter·역할 코드·MasterMinter 관리 응답까지 관측했다. 과거 관리자 이력은 RPC null/오류 4444 때문에 미확인이다. 동일 요청 반복이나 끝없는 metadata 탐색을 우선하지 않는다. RLUSD는 [소스·ABI 로컬 대조](research/rlusd-control-abi-study.json)로 관리 view 후보 10개를 확보했다. 초기화 함수명 차이와 빠진 상속 dependency 때문에 전체 소스·ABI 동일성은 미확인이다. 새 한정 읽기는 블록 26231053에서 무인자 getter 7개를 디코딩했다. 역할 관리 관계 6개도 별도 조회했다. 다음은 적절한 공개 계정 표본의 역할 보유/동결 상태와 실제 취급 근거다. USDT는 블록26231540에서 무인자7개 응답을 관측했다. owner 제어 주소 한 표본의 코드·blacklist 응답을 후속 관측했다. 다음은 서비스/고객 계정 문맥과 실제 취급 근거다. source/authority/support는 UNKNOWN이며 setter는 호출하지 않는다.
2. **취급 시나리오 매핑**: 입출금·수령량·반환값·이벤트·승인/철회·제어 제한의 필요한 근거를 자산별로 나눈다. EVM approve와 Solana delegate, XRPL trust line을 같은 기능으로 판정하지 않는다.
3. **신규 체인 구현 계획**: Solana와 XRPL은 해당 계정/토큰/ledger 모델의 읽기 Adapter가 별도로 필요하다. 이번 문서 조사는 이를 구현하거나 실행한 것이 아니다.
4. **운영 조건**: 체인별 자원·정확한 상태 시점·최종성·대사 요구를 연결한다. 카탈로그 gapDefinitions에 필요한 증거·현재 근거·미확인 이유·허용된 다음 행동을 기록했다.

[사설 EVM Fixture](PHASE1_COMPLETION.md)와 [사설 TVM Fixture](TRON_TVM_RUNTIME.md)는 검증기의 동작 대조군이다. 실제 스테이블코인에서 전송/승인/철회·동결을 실행한 증거로 옮기지 않는다. 실제 자산 미실행은 NOT_TESTED, 미확인 권한/출처는 UNKNOWN으로 남긴다. 발행사의 상환·준비자산·규제·내부 정책 검토는 기술 호환성과 독립이며 이 조사로 취급 승인·가격 안정성 점수를 만들지 않는다.

검증: 최신 `npm run check` **212개 통과**, 실패·skip 0. 새 카탈로그 검사는 체인별 식별자 구분·출처/참조·중복·증거 축과 미구현 상태를 확인한다. 공식 출처의 진위나 온체인 계정 상태를 자동 인증하는 테스트는 아니다. 기존 실제 읽기 보고서 3개의 SHA-256이 보존됐음을 확인했다. Ethereum RLUSD의 새 보고서 계약·17개 증거 참조·읽기 전용 RPC 메서드·고정 블록 태그와 카탈로그 해시를 확인했다. 운영 거래·Solana/XRPL Adapter 구현은 수행하지 않았다.

후속 USDC 후보 빌드 검증은 전체 runtime과 metadata 제외 비교를 분리하는 연구 도구의 회귀 검사 4개를 추가했다. metadata 제외 일치를 배포 동일성이나 권한 확인으로 승격하지 않는다.

Sourcify의 변환 포함 match와 원본 runtime 전체 일치를 구분하고, 잘못된 chain/address/관측 코드 연결을 거부하는 회귀 검사 2개를 추가했다. 서비스 ABI의 재생성은 실제 proxy 제어 getter 실행과 구분한다.

USDC의 새 한정 읽기 관측은 블록 26230386, getter 5개 OK/paused=false, 전체 INCONCLUSIVE다. 카탈로그 qualifiedControlObservations에서 기존 AssessmentReport 4개와 분리해 참조한다. 실제 권한·거래는 미검증이다.

USDC 역할 코드 관측(block 26230421)은 owner/pauser/blacklister EMPTY, masterMinter PRESENT 7667바이트이며 후행 코드·최종 헤더 확인을 통과했다. 코드 존재와 실제 제어 주체는 구분하며, [한정 probe 문서](USDC_CONTROL_READ_PROBE.md)에 근거를 연결했다. 기존 보고서 5개를 보존하고 별도 새 보고서를 추가했다.

USDC의 [masterMinter 관리 응답](USDC_MINTER_MANAGEMENT_PROBE.md)(block 26230486)에서 관리 owner는 token owner와 다른 주소였고 getMinterManager는 USDC proxy를 반환했다. 이는 pointer/응답 관측이며 실제 권한 행사나 민팅 실행 증거가 아니다.

[USDC 과거 관리 이력 조회](USDC_ADMIN_HISTORY.md)는 현재 RPC의 null 거래/receipt·블록 오류 4444로 배포 근거를 확인하지 못했다. 로그 검색은 NOT_TESTED이며, 과거 권한 행사 부재로 판정하지 않는다. 실패 조사 보고서는 historicalAdminInvestigations로 별도 참조한다.

RLUSD 공식 설계 출처를 후속 확인해 역할·UUPS·MultiSign 설명과 README 연결을 고정했다. 설계 문서 확보와 온체인 관리 getter 실행은 구분하며, getter는 NOT_TESTED다. GitHub API의 `403 rate limit exceeded`와 USDT explorer의 `403 Forbidden` 때문에 추가 자료 취득은 멈췄고 원인·해제 시점을 추정하지 않았다.

사용자 제공 RLUSD ZIP은 확보된 공식 commit tree와 전체 파일 내용이 일치했고 ABI는 79항목이었다. 관리 view 후보 10개의 signature·selector·타입을 기록했지만 실제 호출은 하지 않았다. 소스의 `reinitialize()`와 ABI의 V2 초기화 함수명 차이를 보존하며, 배포 ABI 인증으로 승격하지 않는다.

RLUSD [한정 제어 응답 관측](RLUSD_CONTROL_READ_PROBE.md)은 블록 26231053에서 7개 OK/paused=false, role ID 5개 후보 literal MATCH를 기록했다. 22개 RPC 요청·23개 증거이며 전체 verdict INCONCLUSIVE와 authority/support/source UNKNOWN을 유지한다. 계정별 역할·동결 상태·실제 거래·권한 행사는 미검증이다.

RLUSD의 [역할별 관리자 역할 관측](RLUSD_ROLE_ADMIN_PROBE.md)은 블록 26231164에서 6개 adminRole ID가 모두 같은 실행의 DEFAULT_ADMIN_ROLE ID와 같음을 기록했다. zero/self 관계도 역할 ID의 응답이며 실제 계정·서명·권한 인증은 아니다. 48개 RPC 요청·49개 증거와 별도 namespace/base snapshot hash를 보존했다. 계정별 역할 보유· 동결·권한 행사는 NOT_TESTED다.

RLUSD의 [공개 계정 후보 조사](RLUSD_ACCOUNT_CANDIDATES.md)는 제3자 자료에서 배포 참조를 확보했지만 RPC 영수증이 null이어서2요청에서 중단했다. stage ERROR/INCONCLUSIVE이며 계정·역할 부재로 해석하지 않는다. 계정 표본과 membership/freeze 조회는 미확보·미실행 상태다. 의미 있는 새 근거 전에는 반복 조회하지 않고 USDT 관리 ABI 등 독립 공백을 우선한다.

USDT의 [관리 소스·ABI 조사](USDT_CONTROL_SOURCE_RESEARCH.md)는 공식 주소 참조와 제3자 검증자료를 구분해 조회 후보9개(무인자7개)를 확보했다. 서비스 onchain 코드와 과거보고서 e4는 전체 일치하지만 재컴파일 runtime은 전체 불일치였다. 새 RPC·컴파일·제품 ABI 등록 없이 현재값/권한/지원 UNKNOWN, getter/행위 NOT_TESTED를 유지한다.

USDT의 [한정 제어 응답 조회](USDT_CONTROL_READ_PROBE.md)는 블록26231540에서7개 OK, owner/getOwner MATCH, paused/deprecated false, fee 설정 문자열0을 관측했다.14개 RPC 요청·15개 증거와 전후 code/chain/header 일치를 보존했다. 실제 전송 수수료·권한·계정별 제한의 검증은 아니며 전체 INCONCLUSIVE/authority·support·source UNKNOWN이다.

USDT의 [owner 표본 관측](USDT_OWNER_SAMPLE_PROBE.md)은 블록26231630에서 fresh owner 두 응답의 일치 주소 하나에 대해 blacklist 두 응답false와 코드 PRESENT5705바이트를 기록했다.26요청·27증거이며 전후 확인이 일치했다. 카탈로그에 별도 qualifiedControlObservations로 연결했다. 남은 공백은 서비스/고객 계정 문맥과 실제 자산 행위·권한 근거이며 전체 INCONCLUSIVE를 유지한다.

USDC의 [owner 표본 관측](USDC_OWNER_SAMPLE_PROBE.md)은 블록26231733에서 fresh owner 주소 하나의 isBlacklisted=false를 기록했다.46개 읽기 RPC·49개 증거와 전후 확인 일치를 별도 카탈로그 항목으로 연결했다. 서비스/고객 계정·controller/minter 문맥과 실제 권한/취급은 미검증이다. RLUSD 계정 후보는 새 근거 미확보로 기존 receipt-null 요청을 반복하지 않았다.

후속 작업은 [증거 공백·시작/완료 조건](STABLECOIN_EVIDENCE_BACKLOG.md)과 [정적 계정 증거 인덱스](research/stablecoin-account-evidence.json)를 따른다. owner 제어 표본2개와 서비스 계정 미확보를 구분하며, [서비스 계정 입력·출처의 로컬 검증](SERVICE_ACCOUNT_CONTEXT.md)을 구현했다. 이 기능은 네트워크를 호출하지 않고 실제 계정 표본 미확보 상태를 유지한다.

[서비스 계정 read-only runner](SERVICE_ACCOUNT_READONLY.md)를 기존 Adapter에 연결하고 합성 로컬 HTTP로 검증했다. 실제 서비스 계정/RPC 관측은 추가하지 않았으며 기존14개 보고서와 서비스 표본 미확보 상태는 유지한다.

[EVM allowance의 명시적 읽기](EVM_ALLOWANCE_READONLY.md)를 합성 HTTP와 신규 소유 사설 Anvil로 검증했다. 실제 서비스/스테이블코인 조회·거래는 추가하지 않았다.

[TRON 승인 결함 프로브 준비](TRON_ALLOWANCE_PROBE_PREPARATION.md)는 합성/컴파일 대조이고 [후속 실행](TRON_ALLOWANCE_PROBE_EXECUTION.md)은 별도 사설 TVM 경로다. 두 증거를 구분하며 실제 USDT 거래·서비스 계정 관측으로 집계하지 않는다.

[Solana·XRPL 계정 모델 조사](STABLECOIN_ACCOUNT_MODELS.md)에서 mint/Token Account/delegate와 currency+issuer/trust-line/실수령량의 증거 요구를 정리했다. 공식 프로토콜 조사이며 실제 자산 설정·계정·거래 관측 및 Adapter 구현은 미완료다.

사용자 제공 TRON USDT holder의 [일반 잔액 관측](TRON_HOLDER_BALANCE_OBSERVATION.md)을 별도 보존했다. raw 잔액0/decimals6의 읽기 응답은 확보했고, 정확한 getter 블록·서비스 운영 목적·소유권·실제 권한/전송 가능성은 미확인이다. 기존 catalog14개 참조·hash를 변경하지 않았다.

RLUSD는 [사용자 제공 explorer HTML](RLUSD_EXPLORER_SOURCE_INTAKE.md)에서 OpenZeppelin을 포함한35개 Solidity를 추출하고 선택 상속 동작을 소스 검토했다. 새 자료의 초기화 함수명은 기존 ABI와 일치하며 이전 ZIP은 별도 버전으로 보존한다. 실제 배포 source binding/권한 행사는 인증하지 않는다.

## TRON 제공 소스 보강

[사용자 export 소스 검토](TRON_EXPORTED_SOURCE_REVIEW.md)에서10개 전체 본문과9개 import·선택 경로10개 findings를 확인했다. 연구 상태만 SOURCE_REVIEWED로 보강하며 기존 catalog/보고서·실제 미실행 상태는 유지한다. local approve의 zero-reset 미강제와 transfer의 중간 상속 return 생략을 Ethereum USDT와 구분했다. 원래 파일명/배포 동일성은 인증하지 않았다.

## Solana mint 실제 읽기 보강

[2026-10-21 별도 연구 관측](SOLANA_MINT_READONLY.md)에서 USDC·USDT가 Original Token Program의 초기화된82-byte mint이며 decimals6과 mint/freeze authority 필드를 갖는 것을 공통 finalized context slot459436079에서 읽었다. 이전 catalog는 hash와 이력을 보존하고 새 결과는 [보강 JSON](research/solana-mint-observation.json)에 연결한다. 제품 Adapter·전송/위임 실행·키 통제/발행사 인증은 미구현/미검증이다.

## XRPL issuer 실제 읽기 보강

[2026-10-21 별도 연구 관측](XRPL_ISSUER_READONLY.md)에서 USDC·RLUSD 발행자 AccountRoot의6개 설정 비트를 동일 validated ledger107795106에서 읽었다. Clawback 허용 비트는 USDC=false/RLUSD=true, GlobalFreeze는 둘 다false였으며 실제 권한 행사·개별 trust-line 상태를 뜻하지 않는다. 이전 catalog/report는 유지하고 [보강 JSON](research/xrpl-issuer-observation.json)으로 연결한다.

현재8개 프로필의 조건과 증거는 [최신 통합 비교표](STABLECOIN_COMPATIBILITY_MATRIX.md)와 [고정 참조/hash 요약](research/stablecoin-compatibility-summary.json)을 따른다. 별도 연구 reader와 제품 Adapter의 구현 범위를 구분한다.

후속 승인으로 [Solana 공통 mint-only 읽기 Adapter](SOLANA_ADAPTER.md)를 연결했다. 위 별도 연구 도구만 있던 당시 설명과 구분하며 과거 report/catalog는 변경하지 않는다.

후속 승인으로 [XRPL issuer 공통 Adapter](XRPL_ADAPTER.md)를 연결했다. 과거 catalog의 미구현 상태는 당시 이력이며 새 구현은 별도 통합 증거에 기록한다.
