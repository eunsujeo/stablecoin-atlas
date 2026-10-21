# Stablecoin Atlas

다른 PC에서 시작하려면 [새 PC 설정](docs/NEW_PC_SETUP.md), 작업을 이어갈 때는 [현재 개발 상태](docs/DEVELOPMENT_STATUS.md)를 먼저 읽는다.

```sh
npm ci
npm run setup
npm run doctor
npm run ui
```

Node.js24.5 이상이면 UI를 열 수 있다. Anvil·JDK는 전체 검사에 필요하며 `npm run doctor:full`로 별도 확인한다. 데이터가 없는 새 PC에서는 기존 PC가 내보낸 로컬 이동 파일을 가져와야 현재 근거와 실제 시장 자료가 나타난다. 키나 보고서를 Git에 올려 해결하지 않는다.

**현재 마일스톤 완료:** [완료 범위와 공개망 조회 결과](docs/STABLECOIN_MILESTONE_COMPLETION.md). 당시 구현 검사212개 통과, 새 공개 계정 보고서4개·읽기 RPC14회. 남는 제한을 기록하고 현재 단계는 마감했다.

후속 [XRPL 실제 보유 trust-line 조사](docs/XRPL_HELD_TRUSTLINE_OBSERVATION.md)도 완료했다. USDC·RLUSD AMM 표본의 양수 잔액·양측 설정을 직접 RippleState 연구 조회로 확인했으며, 공통 Adapter의 페이지 제한은 별도로 보존한다.

현재는 스테이블코인을 우선 대상으로 삼아 체인·구현별 기술 호환성을 실행 증거와 소스 검토로 확인하는 CLI다. EVM/ERC-20·TRON/TRC-20 읽기와 사설 Fixture 검사, Solana mint·XRPL issuer 설정의 공통 읽기를 제공한다. 외부 자산은 읽기 전용으로 조회하고, 상태 변경은 새로 생성한 사설 EVM/TVM Fixture에서만 검증한다. 제품 내부 LLM과 DB는 사용하지 않으며, 저장된 자료를 읽는 로컬 대시보드를 제공한다.

체인·네트워크, 실행 환경(EVM/TVM), 토큰 표준(ERC-20/TRC-20), 개별 토큰 컨트랙트와 검증 시나리오를 구분한다. Ethereum과 TRON은 체인, ERC-20과 TRC-20은 컨트랙트가 구현하는 토큰 인터페이스 표준이다.

현재 [스테이블코인 프로필](docs/STABLECOIN_PROFILES.md)은 Ethereum USDC·USDT·RLUSD, TRON USDT, Solana USDC·USDT, XRP Ledger USDC·RLUSD의 8개 조합을 조사한다. Solana는 공식 식별자 조사와 [mint 읽기 연구](docs/SOLANA_MINT_READONLY.md), XRPL은 공식 식별자·계정 모델 조사와 [발행자 설정 읽기 연구](docs/XRPL_ISSUER_READONLY.md)를 수행했다. Solana는 [mint-only 공통 읽기 Adapter](docs/SOLANA_ADAPTER.md)를 연결했고 XRPL도 [issuer 설정 공통 Adapter](docs/XRPL_ADAPTER.md)를 연결했다. [계정 단위 읽기](docs/ACCOUNT_STATE_READONLY.md)로 Solana의 명시 Token Account 잔액·동결·delegate 설정과 XRPL holder trust-line의 잔액·인가·동결 설정도 관측한다. 실제 전송·권한 행사는 추가하지 않았다. 컨트랙트·mint·currency/issuer를 구분해 입출금·승인/위임·발행사 제어의 검증 공백을 연결한다. 기존 주소 기록은 새 조사 시 공식 출처로 재확인한다. [스테이블코인 중심 우선순위](docs/ROADMAP.md)를 따른다.

현재 Phase 1의 구현·로컬 검증 범위와 남은 제약: [완료 점검표](docs/PHASE1_COMPLETION.md).

사설 TVM 실행 보고서는 [별도 v1 계약](docs/adr/0019-private-tvm-report-contract.md)에 따라 공개 전에 검증한다. 승인 결함 대조는 `npm run tvm:allowance-negative -- --out reports/tron-tvm-allowance-suite.json`과 [별도 allowance 보고서](docs/TRON_ALLOWANCE_PROBE_EXECUTION.md)를 사용한다. 과거 버전 없는 파일은 `npm run tvm:validate -- --file <파일> --legacy`로 변경 없이 검사한다.

로컬 버전 기준과 재현·전달 범위: [Phase 1 Git 기준](docs/PHASE1_BASELINE.md).

현재 결과와 완료 기준은 [8개 프로필 통합 비교표](docs/STABLECOIN_COMPATIBILITY_MATRIX.md)와 [근거/hash 요약 JSON](docs/research/stablecoin-compatibility-summary.json)이다. 권한은 소스 확인으로 검토하며 서비스 운영·수탁 내부 장부·실제 권한 행사는 범위 밖이다.

## 빠른 실행

필수 환경: Node.js **24.5 이상**, npm, `anvil` 실행 파일([Foundry 공식 설치 안내](https://getfoundry.sh/introduction/installation/)). 검증한 환경은 Node 25.2.1, Anvil 1.7.1이다. EVM 기본 경로에는 Docker가 필요하지 않다. 전체 검사에는 Java HTTP probe 테스트용 JDK 17/21도 필요하다. 선택적 [사설 TVM 기동·정상 Fixture 배포/전송/승인 검사](docs/TRON_TVM_RUNTIME.md)는 ARM64 Docker Desktop과 JDK 17/21을 사용한다.

```sh
npm ci
npm run check
npm run lab -- --out reports/baseline.json
```

`lab`은 전용 127.0.0.1 Anvil을 시작하고 7종 Fixture를 새로 배포해 검증한 뒤 종료한다. 기존 노드나 외부 네트워크에 거래를 보내지 않는다. 로컬 테스트 계정만 사용하며 개인키 입력이 없다.

**위 lab 명령의 종료 코드 2는 정상적인 PoC 결과다.** FalseReturnToken에서 의도한 시나리오 FAIL 5건을 발견한다. 기본 결과는 PASS 64 / FAIL 5 / INCONCLUSIVE 22이다. 자동 테스트는 이 차이를 정확히 검증하므로 모두 통과한다.

수취량이 요청량과 정확히 같아야 하는 정책도 비교할 수 있다.

```sh
npm run lab -- --profile exact-receipt --out reports/exact-receipt.json
```

이때 FeeToken의 양수 Transfer/TransferFrom/Transfer Fee 시나리오도 FAIL이 되어 PASS 61 / FAIL 8 / INCONCLUSIVE 22이 된다. 수수료의 존재 자체를 모든 프로필에서 실패로 판정하지 않는다.

## 외부 토큰 읽기 전용 조회

아래 기본 경로는 EVM이다. TRON은 `--chain tron`과 별도의 `TRON_RPC_URL`을 사용한다. [TRON 실행·실제 USDT 관측·INCONCLUSIVE 해석](docs/TRON_READONLY.md)을 참고한다. TRON은 --holder와 --spender를 함께 주면 allowance 승인량도 읽는다. 실제 approve/transferFrom은 실행하지 않는다. TRON의 latest 조회는 정확한 상태 블록을 확정하지 않아 조회 성공도 INCONCLUSIVE로 기록한다.

RPC_URL을 환경변수로 제공한다. 실제 인증 정보는 파일·명령행 인자·보고서에 넣지 않는다. 아래 주소는 호출 형식을 보여주는 예시이며 해당 자산을 검증하거나 공식 자산으로 인증했다는 뜻이 아니다.

```sh
export RPC_URL='https://your-authorized-ethereum-rpc.example'
npm run assess -- --network 1 --token 0x1111111111111111111111111111111111111111 --out reports/readonly.json
```

`--holder <address>`를 추가하면 balanceOf도 조회한다. 체인 ID와 계약 코드가 일치해야 진행한다. 외부 assess는 metadata/잔액과 Proxy 구조 신호를 조회하며 전송·승인·관리자 제어는 NOT_TESTED로 남긴다. EIP-1967·ZeppelinOS implementation/admin 슬롯과 canonical ERC-1167 target을 같은 블록에서 검사한다. 구현 주소를 해석해도 실제 위임·업그레이드 권한은 검증하지 않으며 UPGRADEABILITY support는 UNKNOWN이다. issuer/native-or-bridged도 UNKNOWN이다. [USDC/USDT 공식 식별 출처와 실제 읽기 전용 결과](docs/research/ERC20_REFERENCE_ASSETS.md)를 별도로 기록한다. USDC의 ZeppelinOS 선언 대상은 해석했으나 실제 위임·업그레이드 권한은 미검증이다. Fork 실행은 제공하지 않는다.

`--out`을 생략하면 JSON을 stdout에 출력한다. 파일 출력은 비공개 임시 파일에 완성한 뒤 교체하며 신규·덮어쓰기 모두 POSIX 0600 권한을 설정한다. 최종 경로에서 관측한 심볼릭 링크·디렉터리·FIFO는 거부한다. rename 전 저장 실패는 기존 보고서를 유지한다([저장 범위와 한계](docs/adr/0006-atomic-report-output.md)). 요약은 stderr다. npm 자체의 실행 안내 없이 JSON만 얻으려면 `npm run --silent lab -- ...`을 사용한다.

종료 코드: `0` 실행 완료(FAIL 없음), `1` 입력/인프라 오류, `2` 실행 완료(시나리오 FAIL 존재). INCONCLUSIVE/NOT_TESTED를 포함한 코드 0도 자산 취급 승인을 뜻하지 않는다.

## 검증하는 차이

| Fixture | 관측되는 동작 |
|---|---|
| StandardToken | 정상 반환·잔액·이벤트·allowance |
| NoReturnToken | 반환값 EMPTY, 잔액·이벤트로 실제 동작 확인 |
| FalseReturnToken | FALSE, receipt 성공이어도 잔액/승인이 반영되지 않음 |
| FeeToken | 10000 차감 / 9900 수취 / 100 burn |
| ZeroResetToken | nonzero 승인 변경 revert, zero-reset 후 재승인 성공 |
| PausableToken | owner 제어, pause 시 전송 거부, 복구 후 성공 |
| BlacklistToken | owner 제어, blacklist 시 전송 거부, 해제 후 성공 |

기본 7종에는 Proxy 구조가 확인되지 않아 EVM-PROXY-001이 각각 INCONCLUSIVE다. 추가 Proxy/ZeppelinOS/Beacon/clone Fixture 및 슬롯 위조·조회 장애도 자동 검증한다.

ERC20-008은 0 전송을 별도 검사해 사전 반환값·receipt·0 Transfer 이벤트·샘플 잔액/supply 무변경을 확인한다. 0 거부·이벤트 누락·잘못된 상태 이동은 별도 부정 Fixture로 검증한다. 외부 자산에서는 이 항목도 NOT_TESTED다([검사 범위](docs/adr/0008-zero-transfer-scenario.md)).

ERC20-009는 유한한 양수 승인 확인 후 spender의 0 transferFrom과 allowance 무변경도 검사한다. 승인 전제 미충족은 INCONCLUSIVE로 남기며 0 전송을 시도하지 않는다([범위와 결과](docs/ZERO_TRANSFER_FROM_RESULTS.md)).

ERC20-010은 approve 0·Approval 0·allowance 0 및 이후 기존 spender의 양수 전송 거부를 관측한다. 사전 반환값과 실제 receipt의 모순은 거부 성공으로 처리하지 않는다([범위와 결과](docs/ALLOWANCE_REVOCATION_RESULTS.md)).

관리자 setter를 찾지 못했다고 제어 기능이 없다고 단정하지 않는다. 추가 negative Fixture는 잘못된 metadata·이벤트 누락·malformed 반환값을 검증한다.

metadata의 decimals는 정수 0~255를 확인한다. 256 등 범위 밖 응답은 INVALID_RESPONSE/Identity UNKNOWN이며, 정상 0과 빈 name/symbol은 관측값 그대로 유지한다([경계 검증 결과](docs/METADATA_BOUNDARY_RESULTS.md)).

## 보고서 읽기

`assessments[].report`에 자산 주소 기반 Identity, 시나리오 결과, capabilitySummary, evidence를 저장한다. 단일 assess 출력은 report 객체 자체다. 각 결과의 `evidenceReferences`는 같은 보고서의 `evidence[].id`를 참조한다. 증거는 raw RPC 성공 결과, 오류 코드·로컬 분류·원문 생략 표식, 블록, 영수증, 로그, 해석된 상태/반환값을 포함한다. 상위 오류 message/data는 저장하지 않는다([진단 범위](docs/adr/0005-rpc-error-diagnostics.md)). 로컬 보고서는 컴파일러·소스 해시·배포 바이트코드도 보존한다. 금액과 블록은 십진 문자열이며 receipt 내부 원시 RPC 수량은 hex다.

PASS는 특정 시나리오의 조건 충족이다. 미검증은 NOT_TESTED, 증거 부족은 INCONCLUSIVE다. 발행사·규제·상환·준비금·자산 안전성·최종 취급 승인은 평가하지 않는다. metadata는 발행사 인증 자료가 아니다.

## 개발

```sh
npm run build       # strict TypeScript 타입 검사, 파일 출력 없음
npm run test:unit   # Anvil 없이 도메인 테스트
npm test            # 실제 Anvil 통합 테스트 포함
npm run check       # 타입 검사 + 전체 테스트
npm audit
```

`src/domain`은 체인 공통 모델, `src/evm`은 ERC-20 실행/해석, `src/lab`은 사설 체인/Fixture 수명 관리다. 새 버전의 도구를 적용하면 같은 검증을 다시 실행한다. 프록시는 Node의 환경변수 지원을 통해 기존 설정과 NO_PROXY를 존중한다.

문서: [요구사항](docs/REQUIREMENTS.md), [설계](docs/ARCHITECTURE.md), [스택 ADR](docs/adr/0001-stack.md), [시나리오](docs/TEST_SCENARIOS.md), [Capability](docs/ASSET_CAPABILITIES.md), [체인·프로필](docs/CHAIN_CAPABILITIES.md), [PoC 결과](docs/POC_RESULTS.md), [로드맵](docs/ROADMAP.md), [개발 지침](AGENTS.md).

보고서의 JSON 스키마와 호환성 규칙: [보고서·Adapter 계약](docs/REPORT_CONTRACT.md). 스키마 검증은 개발 테스트에서 수행하며 CLI 판정은 기존 결정적 엔진이 담당한다.

관측 블록은 높이 형식과 반환 헤더의 번호·해시를 확인한 뒤 기록한다. 잘못된 초기 블록 응답은 조회를 중단한다. 숫자 블록 태그를 사용하므로 재조직·최종성 검증과는 구분한다([ADR 0007](docs/adr/0007-block-reference-validation.md)).

Proxy 보강 기록: [ADR 0002](docs/adr/0002-proxy-observation.md), [실행 결과](docs/PROXY_RESULTS.md).

0 전송 보강 기록: [0 transfer 결과](docs/ZERO_TRANSFER_RESULTS.md), [0 transferFrom 결과](docs/ZERO_TRANSFER_FROM_RESULTS.md). 최신 CLI 집계: [승인 철회 결과](docs/ALLOWANCE_REVOCATION_RESULTS.md).

개발용 LLM Router의 실제 관측과 한계: [효과 평가](docs/ai/ROUTER_EFFECTIVENESS.md). 제품 내부 LLM과는 별도다.

USDC의 제어 getter 응답을 별도로 관측하는 [연구용 읽기 probe](docs/USDC_CONTROL_READ_PROBE.md)가 있다. source/authority/support 검증과 제품 AssessmentReport 판정은 구분한다.

저장된 공통 보고서는 `npm run validate -- --file <report.json>`으로 오프라인 재검증한다. [보고서 검증 사용법](docs/REPORT_VALIDATION.md)은 정상 FAIL 보고서와 잘못된 보고서·옵션 오류의 종료 코드를 구분한다.


## 로컬 대시보드 · 저장 시장 자료

`npm run ui`로 `http://127.0.0.1:4173/#live`를 연다. 검증 항목·자산 프로필·비교는 기존 저장 보고서를 사용하고, Market은 공급자 실제 관측, Market preview는 가상 데이터를 표시한다. 외부 키는 웹에 제공하지 않는다.

`npm run market:build`는 현재 로컬 연구 보고서 다섯 개(`arkham-api-smoke`, `arkham-market-additional`, `arkham-chain-supply-research`, `arkham-additional-data-research`, `xrpl-gateway-obligations-readonly`의 reports JSON)를 오프라인으로 읽어 시장 자료 묶음을 만든다. 이 연구 보고서들은 저장소에서 제외되며, 없는 경우 명령은 실패하고 이전 정상본을 유지한다. [ADR0035](docs/adr/0035-stored-market-observations.md)에 지표·보존·실패 경계를 기록했다.

코인·네트워크·체인별 자산은 [등록 JSON](data/asset-registry.json)에 추가한다. 고유 ID를 재사용해 주소나 네트워크를 바꾸지 않는다. 등록만으로 새 조회 Adapter나 시장 데이터가 생기지는 않으며, 데이터 매핑이 없으면 미확보로 표시한다. 현재 공급자 체인 집계와의 매핑은 coin/network당 한 deployment이며 네이티브·브리지 형태를 구분할 때는 별도 매핑 설계가 필요하다.

시장 화면은60초마다 로컬 저장본만 다시 읽는다. 브라우저 수와 상관없이 Arkham 요청을 자동 생성하지 않는다. 자동 외부 수집·DB·계정 호출/크레딧 예산·429 처리 수집기는 아직 구현하지 않았다.
