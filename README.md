# Multi-Chain Asset Compatibility Lab

금융 서비스의 디지털 자산 취급 전 기술·운영 호환성을 실제 실행 증거로 확인하는 CLI다. 첫 PoC는 ERC-20만 지원한다. LLM/API 키/웹 서버/DB가 필요하지 않다.

현재 Phase 1의 구현·로컬 검증 범위와 남은 제약: [완료 점검표](docs/PHASE1_COMPLETION.md).

로컬 버전 기준과 재현·전달 범위: [Phase 1 Git 기준](docs/PHASE1_BASELINE.md).

## 빠른 실행

필수 환경: Node.js **24.5 이상**, npm, `anvil` 실행 파일([Foundry 공식 설치 안내](https://getfoundry.sh/introduction/installation/)). 검증한 환경은 Node 25.2.1, Anvil 1.7.1이다. Docker는 필요하지 않다.

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
