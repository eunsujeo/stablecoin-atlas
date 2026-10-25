# 공급량 상위 네트워크: 추가 18곳 소스 검토

2026-10-25 사용자의 “모두 승인…총18곳 모두 진행”에 따라 추가18곳의 소스·공식 자료를 조사했다. 기존4곳과 합쳐 선정22곳을 모두 다뤘다. 기준은 **2026-10-22 저장 유통공급 토큰 수량**, USDC10·USDT10·RLUSD2이며 현재 순위가 아니다. RLUSD를 임의로10곳까지 채우지 않았다.

**토큰 로직 소스6곳, 프록시만4곳, 프로토콜·참조·브리지 코드7곳, 공식 문서만1곳**이다. 모두를 같은 수준의 기능 확인 완료로 표시하지 않는다. 소스의 함수·modifier·조건 검토가 목적이며 실제 권한 행사·현재 구현 연결·서비스 지갑 수집을 추가 완료조건으로 요구하지 않는다.

[항목별 조건·근거·53개 응답 hash](../../data/source-review-top10-results.json)가 구조화 정본이다. [선정 기록](2026-10-25-top10-source-review-candidates.md)과 최초 계획은 보존한다. 원문은 로컬 archive에만 있고 Git/웹에 게시하지 않았다. 기존 판정·보고서를 덮어쓰지 않았다.

## 네트워크별 확인 범위

| 자산 | 네트워크 | 확인 범위·조건 | 추가 근거가 필요한 부분 |
|---|---|---|---|
| USDC | Base | 초기 FiatTokenV2_1, 전송·승인·서명·발행·소각·차단·정지·upgrade 조건 | 생성자 초기 구현 후보와 현재 구현을 구분 |
| USDC | Arbitrum | 위와 같은 주요7단위 hash, allowance는 MAX도 차감 | 초기 구현 후보 |
| USDC | Polygon | 위와 같은 주요7단위 hash, pause/caller/from/to 차단 조건 | 초기 구현 후보 |
| USDC | BSC | 초기 BEP20TokenImplementation, owner 및 mintable 조건 발행·자기 소각·승인 | Circle native 인증/담보·현재 mintable 설정은 미확인 |
| USDC | Avalanche | 프록시 admin·upgrade·fallback 조건 | 초기 구현 조회404, 토큰 기능 부재로 해석하지 않음 |
| USDC | Solana | 고정 SPL 소스와 과거 mint 설정, owner/delegate·mint/freeze authority 조건 | 현재 program binary/version을 새로 인증하지 않음 |
| USDC | Stellar | Payment·issuer/trustline·인가·회수의 프로토콜 조건 | USDC issuer의 실제 활성 플래그 미관측 |
| USDC | Hyperliquid L1 | Bridge2 출금·dispute period·finalizer·긴급정지·permit 입금 | 브리지 component는 HyperCore 내부 원장 소스가 아님 |
| USDC | Arc | 공식 wallet 문서의 native18/ERC20 view6 단일 잔액·USDC 가스 | native/predeploy 구현 소스 미확보 |
| USDT | BSC | BEP20USDT, bool 전송·승인·owner mint·호출자 burn | Tether native와 구분, 담보·상환 인증 아님 |
| USDT | Solana | SPL transfer/approve/revoke·mint/burn/freeze 조건 | 저장 설정과 현재 배포 버전을 구분 |
| USDT | Arbitrum | Transparent proxy admin·upgrade·fallback | constructor metadata에 초기 구현 인자 없음 |
| USDT | Polygon | 초기 UChildERC20, DEPOSITOR_ROLE mint·withdraw burn·메타 트랜잭션 | 브리지 초기 구현 후보, Ethereum USDT와 구분 |
| USDT | Plasma | Transparent proxy admin dispatch·fallback | 초기 구현 조회404 |
| USDT | Mantle | Transparent proxy admin dispatch·fallback | 초기 구현 조회404 |
| USDT | TON | 공식 stablecoin 참조 소스의 admin/master 발행·소각·잠금·upgrade | 실제 USDT 배포 코드/library cell 대응 미인증 |
| USDT | Aptos | FA MintRef/BurnRef/TransferRef·일반 frozen/dispatchable hook 조건 | Tether module/hook 소스 미확보 |
| RLUSD | XRPL | AccountSet/TrustSet/Clawback/Payment 조건 및 과거 issuer 설정 | develop 소스와 과거 ledger의 버전/시각 구분 |

네트워크 집계 공급량과 선택한 한 컨트랙트의 물량 대응은18곳 모두 미확정이다. BSC DEX 목록·소스는 주소 후보 근거이며 Circle/Tether native 발행·담보 인증이 아니다. USDT0/브리지 자산과 Ethereum USDT를 혼합하지 않는다. HyperCore를 HyperEVM ERC20으로 대체하지 않는다.

## 기능별 해석

구조화 결과의 각 case는 전송·승인, 공급·관리, 전송 특성, 업그레이드 또는 해당 체인 고유 기능으로 구분하고 소스 단위/줄·원문 hash를 연결한다.

- **소스 확인**: 선택한 함수·modifier·조건을 확인했다. 실제 배포/실행 성공 인증으로 승격하지 않는다.
- **검토 경로에 없음**: 선택 코드에서 해당 분기/진입점이 없다. 자산 전체의 부재 판정이 아니다.
- **공통 프로토콜 기능**: 체인 공통 코드의 조건이다. 개별 자산 설정에서의 활성화는 별도다.
- **공식 문서 기재 / 저장 설정 / 추가 근거 필요 / 해당 없음**을 서로 구분한다.

USDC Base/Arbitrum/Polygon의 초기 FiatTokenV2_1 계열은 approve 덮어쓰기·approve(0), EIP2612 permit/EIP3009 authorization, minter 및 allowance·pause·blacklist 조건을 갖는다. 검토한 transferFrom은 MAX도 차감한다. 토큰 `_transfer`의 수량 이동에는 수수료/재기준화 분기가 없다. 프록시 admin과 토큰 owner/pauser/blacklister/minter 조건은 별개다. 현재 역할 주소나 실제 권한 행사는 수집하지 않는다.

BSC 선택 두 소스도 전송/승인이 bool을 반환하고 MAX 예외 없이 allowance를 차감한다. USDC 초기 구현의 mint는 owner 및 `_mintable` 조건, USDT의 mint는 owner 조건이다. 두 소스의 burn은 호출자 잔액 소각이다. 선택 코드에 pause/blacklist/permit/전송 수수료 분기가 없는 사실을 native USDC/USDT 전체로 확대하지 않는다.

Polygon USDT 초기 UChildERC20은 DEPOSITOR_ROLE deposit 발행·사용자 withdraw 소각이다. NativeMetaTransaction의 nonce·EIP712/self-call/context sender 경로를 ERC2612 permit으로 표시하지 않는다. owner/role/proxy admin을 같은 권한으로 합치지 않는다.

Solana는 Token Account delegate 승인/철회이며 ERC20 allowance가 아니다. owner/delegate·mint 일치·동결·잔액·권한 서명 조건을 검토했다. 고정 SPL 소스와 2026-10-21 저장82byte mint 설정의 mint/freeze authority 존재를 구분한다. 거래 서명을 EIP2612 permit으로 해석하지 않는다. legacy Token Program 경로에 Token-2022 fee 확장/전역 pause 명령이 없는 사실도 선택 경로에 한정한다.

TON 참조 소스는 일반 owner 전송에 outgoing 잠금이 적용되지만 master 전송에는 예외가 있다. wallet burn은 master 전용이고 admin의 call_to가 transfer/burn/set_status를 전달한다. Aptos framework의 capability와 custom dispatch hook은 구분하며 framework만으로 USDT의 fee 부재/실제 발행 권한을 확정하지 않는다.

Stellar는 issuer+asset와 trustline의 모델이며 clawback은 issuer 발신·양수·비native asset·clawback-enabled trustline 등의 조건이다. XRPL classic IOU Clawback은 AllowTrustLineClawback 및 !NoFreeze, trustline·잔액 방향·양수 보유를 검사한다. RLUSD의 저장 ledger107795106은 RequireAuth=false/NoFreeze=false/GlobalFreeze=false/AllowTrustLineClawback=true이며 TransferRate는 필드 미기재다. 미기재를0으로 바꾸거나 현재 설정/실제 회수 성공으로 승격하지 않는다.

## 수행 경로·실패와 수정

공개 자료를 수동 단발 GET으로 취득했다. managed proxy·identity encoding·redirect/retry/자동 fallback0·요청별20초/4MiB·새0700 슬롯/0600 파일·송신 전 intent·원문 hash를 적용했다. compiler·SDK 설치/취득 코드 실행·새 RPC·키·DB·제품UI·거래0이다. 계정 비용 대사나 공급자 usage 조회도 하지 않았다.

| 슬롯 | 실제 GET | bytes | 결과 |
|---|---:|---:|---|
| A `.state/top10-source-intake-20261025-a` | 8 | 258131 | 프록시8 확보 |
| B `.state/top10-source-intake-20261025-b` | 23 | 1186641 | XRPL4경로404·정상 문서 오검출로 종료, 마지막1건 미송신 |
| C `.state/top10-source-links-20261025-c` | 1 | 215 | 필드 selector HTTP400 후 종료·8건 미송신 |
| C2 `.state/top10-source-links-20261025-c2` | 9 | 21126 | 초기 로직 연결8·인자 미기재1 |
| R `.state/top10-source-xrpl-20261025-r` | 4 | 85982 | 이동된 공식 XRPL4경로 확보 |
| D `.state/top10-source-initial-logic-20261025-d` | 8 | 482090 | 초기 로직 소스5 확보·3주소404 |

합계 **53GET/2034185bytes**, HTTP200 45건·404 7건·400 1건이다. 각 계획의 pin·원래 시각·소비 상태는 결과 JSON의 runs에 있다. 모든 슬롯은 소비 완료이며 재사용하지 않는다.

1. A가 모두 프록시임을 확인하고 토큰 기능 완료로 승격하지 않았다.
2. B의 XRPL 기존 경로4건404는 보존했다. GitHub API 트리 수집 도구 실패를 자료 부재로 보지 않고 공식 저장소 디렉터리에서 이동 위치를 확인했다. R은 다른 고정4경로로 취득했다.
3. B의 Tether HTTP200 정상 문서에 포함된 보안 스크립트 URL을 challenge로 잘못 분류해 종료했다. 최초 실패 receipt/미송신 항목은 보존했다. 검출기를 제목/가시 본문 기준으로 수정하고 회귀 검사를 추가했다. 같은 저장 응답에서 공식 protocol/식별자를 오프라인 재확인해 추가 요청0으로 검토했다. 정적 본문 확인이며 렌더링 후 화면 검증은 아니다. 마지막 미송신 문서도 자동 재개하지 않았다.
4. C의2단계 nested selector는 Sourcify 규칙 위반으로 HTTP400이었다. C2는1단계 `creationBytecode.transformationValues`로 수정한 새 계획/슬롯이다. 부모 raw hash·chain/address/match/contract/ABI와 인자 padding/dynamic bytes 경계를 검증했다. BSC 생성자 이름은 실제 부모 소스의 `logic`으로 바로잡았다. 준비 실패 시 송신하지 않았다.
5. D는 초기 생성자 연결8주소만 고정 조회했다.5건200·3건404였다. proxy-resolution/현재 storage RPC로 확대하지 않았다. 소스404/인자 미기재는 기능 부재가 아니다.
6. 수동 분석용 추출에서 공개 sourceUnit의 절대 경로를 로컬 경로로 해석해 권한 거절됐다. 이후 sourceUnitHash+basename의 평탄한 파일명만 사용했다. 수집기는 처음부터 고정 `.bin` 파일에 저장하며 소스 경로를 로컬 파일 경로로 사용하지 않는다.
7. Lead 검토3건의 managed proxy/deadline·본문 분류·부모 hash/ABI 검증 조건을 반영했다. 사설 검사는 한도·중단·404·identity/body·challenge 오검출·constructor 인자 손상·selector 규칙을 검증한다.

## 보존·재현·검증

결과 JSON의 artifacts는 요청 시각·raw SHA256·소스 단위 hash·최초 실패를, runs는 계획 pin/완료 시각/소비 슬롯을 보존한다. 분석일과 원래2026-10-21 설정/2026-10-22 공급 관측 시각을 구분했다. 기존 UNKNOWN/NOT_TESTED를 삭제하거나 재판정하지 않는다.

다음 명령은 오프라인 재현이다. 수집 CLI를 재실행하지 않는다. 원문이 없는 PC에서 archive 검증을 실패 처리해 새 다운로드로 보충하지 않는다.

```sh
node tools/research/verify-top10-source-archive.mjs
node --test tests/source-constructor-link.test.mjs tests/top10-source-intake.test.mjs
npm run check
```

최종 검증: archive 검증 rc0/PASS(18case/53raw hash/추가 요청0); 경계 검사 rc0/tests18/pass18/fail0/cancelled0/skipped0; `npm run check` rc0/tests590/pass590/fail0/cancelled0/skipped0; 세 수집/연결/검증 모듈 `node --check` rc0; `git diff --check` rc0. 로그는 `.state/agent-logs/top10-source-final-{check,boundaries}.log`다. 앞선 단계의578/581/588검사 통과 기록도 같은 로컬 로그에 보존했다.
