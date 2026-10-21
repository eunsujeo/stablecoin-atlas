# 아키텍처

CLI → 호환 함수 / ReadOnlyAdapter → EVM Assessment Orchestrator → Identity Resolver / 시나리오 목록 → EVM Fixture Executor → RPC 증거 수집 → 결정적 판정 → JSON 보고서.

TRON 분기는 CLI --chain tron → TronReadOnlyAdapter → latest-only JSON-RPC 조회/디코딩 → Report 1.0이다. TRON 전용 request의 spenderAddress로 allowance 조회를 지원한다. 거래 Executor를 연결하지 않는다. [TRON ADR](adr/0011-tron-readonly-adapter.md).

- `src/domain/model.ts`: 체인 공통 Identity, Capability, Support, Verdict, Evidence, Report 모델. 값의 KNOWN/UNKNOWN/NOT_APPLICABLE을 태그로 구분한다.
- `src/domain/adapter.ts`: 체인별 주소 의미를 강제하지 않는 읽기 전용 요청/보고서 계약. 전송·승인·서명 메서드는 없다.
- `src/domain/evaluator.ts`: 관측 증거 없는 PASS 방지, capability 집계, 정확한 십진 금액 처리, JSON bigint 문자열 변환.
- `src/evm/identity.ts`: chain ID와 코드 확인, 동일 블록의 metadata 조회. 읽기 실패의 REVERT/RPC_ERROR/TRANSPORT_ERROR 원인과 ABI decode 오류를 구분한다. 응답이 있는 것만으로 ERC-20 전체나 발행사를 인증하지 않는다.
- `src/evm/proxy.ts`: pinned-block EIP-1967·ZeppelinOS 슬롯 및 canonical ERC-1167의 1차 선언 대상 해석. 코드 존재를 확인하며 실제 위임·권한과 구분한다.
- `src/rpc/json-rpc.ts`: 체인 공통 JSON-RPC 전송·envelope·안전 오류·증거 수집. EVM의 블록/오류 실행 의미를 강제하지 않는다.
- `src/evm/rpc.ts`: 공통 전송을 상속하고 기존 Rpc/RpcError/isRevert 경계를 유지한다. EVM pin과 명시적 revert 분류를 담당한다.
- `src/tron`: Base58Check/41-prefix 주소와 최신 상태의 읽기 전용 ABI만 처리한다. 정확한 응답 블록은 UNKNOWN, 조회 결과는 INCONCLUSIVE이고 전후 head는 별도 증거다.
- `Rpc.pin()`: 유효한 hex 높이와 일치하는 헤더 번호·32바이트 해시를 확인한 뒤 BLOCK_REFERENCE 증거를 남긴다. 실패하면 이전 블록 상태를 UNKNOWN으로 유지한다. 숫자 태그 조회 간 재조직이나 최종성은 검증하지 않는다.
- `src/diagnostics.ts`: CLI의 신뢰된 로컬 진단과 고정된 일반 오류 출력. 임의 예외 원문은 출력하지 않는다.
- `src/evm/executor.ts`: raw eth_call 사전 실행 결과 + 채굴된 영수증 + 정확한 이벤트 디코딩. 각 잔액 조회 블록과 영수증의 블록 해시를 보존한다.
- `src/evm/scenarios.ts`: 공통 시나리오 ID를 모든 Fixture에 동일 적용. 각 시나리오 앞뒤 snapshot/revert로 상태를 분리한다.
- `src/assessment.ts`: 기존 assessReadOnly/assessFixture 함수 입력을 보존하는 호환 경계.
- `src/evm/adapter.ts`: 요청마다 독립 RPC를 생성하는 EVM ReadOnlyAdapter.
- `src/evm/assessment.ts`: EVM 시나리오 순차 실행, 증거 참조, 오류 시 INCONCLUSIVE, capability 집계. 미구현 기능은 summary에 NOT_TESTED.
- `src/lab`: 사설 Anvil 수명 관리, Solidity 컴파일, 7종 Fixture 배포. 시작 실패/검증 실패 시 프로세스를 정리한다. 하드포크는 Shanghai로 고정한다.
- `src/cli.ts`: lab과 외부 read-only assess 명령, JSON 파일/표준출력, 종료 코드.
- `src/report-output.ts`: 직렬화된 보고서를 새 비공개 파일에 완성한 뒤 교체한다. 교체 전 실패와 교체 후 정리 실패를 구분하며 기존 목적 파일을 미리 비우지 않는다.

## 증거와 판정

각 Assessment의 evidence ID 공간은 독립적이다. 시나리오는 자기 실행 중 생성된 증거만 참조한다. 원시 receipt와 log는 디코딩 실패 시에도 보존한다. 상위 RPC 오류 원문은 보존하지 않으며 세부정보 생략을 표시한다. 보고서는 컴파일러 버전·소스 해시·바이트코드·설정·로컬 클라이언트 버전도 포함한다. 로컬 Fixture의 이름은 자산 신뢰 근거로 사용하지 않는다.

Capability support는 실제 관측으로만 SUPPORTED로 설정한다. 예를 들어 전송이 실패하면 TRANSFER support를 UNKNOWN으로 둔다. 한 호출의 실패는 모든 입력에서 기능 부재를 증명하지 않으므로 NOT_SUPPORTED로 단정하지 않는다. 수수료가 발견되지 않은 단일 샘플도 수수료 기능 부재를 증명하지 않는다.

외부 assess는 chainId/code/metadata/balance/TRON allowance/storage/Beacon implementation 조회만 허용한다. chain ID 불일치, 잘못된 주소, EOA는 명령 오류이며 보고서 PASS를 만들지 않는다. 읽기 전용 미실행 시나리오는 NOT_TESTED다. 로컬에서 관리자 setter를 실행할 수 없으면 INCONCLUSIVE이며 모든 제어 기능의 부재를 의미하지 않는다.

사전 eth_call의 반환값은 채굴된 거래 반환값의 직접 증거가 아니다. 영수증은 함수 반환값을 제공하지 않는다. 로컬 단독 실행에서 같은 입력의 사전 호출과 실제 잔액/이벤트를 대조한다. 외부 체인의 동시 변경·리오그·최종성은 검증하지 않는다. 이후 정확한 거래 반환 분석에는 trace 등 추가 증거가 필요하다.

## 실행 경계

SIMULATION만 상태를 변경한다. CLI는 임의 RPC에 거래를 전송하는 옵션이나 개인키 입력을 제공하지 않는다. EVM 실행 대상은 `LocalLab.start()`가 만든 127.0.0.1 프로세스의 신규 Fixture다. 사용자 승인으로 추가한 `src/tron/lab`의 사설 TVM 실행기는 매번 소유·격리를 검증한 새 컨테이너에서 정상 Fixture 하나를 배포하고 receipt/초기 상태를 확인한다([ADR 0015](adr/0015-private-tvm-fixture-deployment.md)). 선택적 `tvm:exercise`는 정상 토큰 전송·승인·이벤트·철회/미승인 REVERT까지 검증한다([ADR 0016](adr/0016-private-tvm-token-scenarios.md)). 별도 신규 환경의 `tvm:boundary`는 0 금액과 잔액/승인량 부족·rollback을 검증한다([ADR 0017](adr/0017-private-tvm-boundary-scenarios.md)). `tvm:negative`는 정상 대조와 세 결함 transfer Fixture를 각각 새 환경에서 실행하고 Fixture 판정과 검증기 회귀 결과를 분리한다([ADR 0018](adr/0018-private-tvm-negative-fixtures.md)). 기존 로컬 체인, 운영 자산, 외부 테스트넷, fork 실행, Controlled Execution은 현재 제공하지 않는다.

공통 인터페이스에 approve/transferFrom을 강제하지 않는다. 향후 Adapter는 공통 보고서를 생성하되 TRON 자원 모델과 Solana delegate/account 의미를 별도 시나리오로 구현한다. DB/REST/LLM/UI는 현재 없다.

Proxy 관측의 판정과 한계는 [ADR 0002](adr/0002-proxy-observation.md)와 [ADR 0003](adr/0003-legacy-proxy-slots.md)를 따른다. `EVM-PROXY-001`의 PASS는 포인터와 코드 해석 성공만 의미하며 upgrade support는 UNKNOWN이다. 기존 metadata result에는 Proxy 증거를 포함하지 않도록 별도 증거 범위를 둔다.

보고서 형식과 Adapter 계약은 [ADR 0004](adr/0004-report-adapter-contract.md) 및 [보고서 계약](REPORT_CONTRACT.md)에 기록한다. JSON Schema는 테스트에서 사용하며 CLI 런타임 판정과 분리한다. 읽기 전용 Adapter의 동시 호출은 지원하지만, 공유 Rpc를 사용하는 로컬 Fixture 평가는 snapshot/revert 및 증거 초기화 때문에 순차 실행한다.

`src/tron/lab`은 별도 사설 TVM runtime smoke다. 소유 label·internal network·무게시·고정 이미지 검사 후 제한된 Java loopback probe로 기동/블록 진행을 관측하고 정리한다. Assessment PASS나 토큰 실행 Adapter가 아니다([ADR 0014](adr/0014-private-tvm-runtime-smoke.md)).
