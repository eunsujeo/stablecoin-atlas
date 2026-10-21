# ADR 0013: 사설 TVM Fixture 실행 준비안

2026-10-19. 상태: **준비 검토 기록 — 이후 사용자가 제한적 사설 TVM 실행을 승인함**. 아래 범위/관문 상태는 준비안 작성 당시의 기록이며, 현재 기동 구현과 런타임 선택은 [ADR 0014](0014-private-tvm-runtime-smoke.md)를 따른다. 기존 [TRON 읽기 전용 완료 범위](../TRON_READONLY_COMPLETION.md)를 넘어가는 후속 단계의 구체적 준비안이다. 채택된 런타임 결정이나 실제 TVM 테스트 결과가 아니다.

## 현재 경계와 이번 산출물

[AGENTS.md](../../AGENTS.md)는 현재 TRON을 읽기 전용으로 한정하고, 상태 변경을 프로그램이 생성한 신규 사설 Anvil Fixture에만 허용한다. 이 문서는 그 경계를 변경하지 않는다. 이번 작업은 공식 도구 조사, 로컬 도구의 읽기 전용 확인과 후속 구현의 수용 기준 작성이다. 다운로드·설치·노드 기동·키 생성·배포·서명·거래·실행 runner 추가는 하지 않았다.

향후 허용할 범위의 제안은 **프로그램이 새로 생성하고 소유·격리를 확인한 사설 TRON TVM에서만 폐기 가능한 계정과 독립 작성 Fixture를 실행**하는 것이다. 외부 RPC의 읽기 전용 경계, 운영 키 사용 금지, Solana/제품 내부 LLM/UI 제외는 유지한다. 구현 전 이 제한적 쓰기 범위와 AGENTS의 정합성을 확정해야 한다.

## 확인한 환경과 후보

아래는 이번 작업 시점의 로컬 관측이다. 명령의 존재·버전과 실제 TVM 호환성을 구분한다. daemon 설정·전체 환경변수·인증정보는 출력하지 않았다.

| 항목 | 관측 | 아직 검증하지 않은 부분 |
|---|---|---|
| 호스트 | Darwin / arm64 | 사설 TVM 기동·지속 실행·정상 종료 |
| Docker CLI / server | 모두 29.1.2, server 버전 질의 응답 | 선택 이미지의 ARM manifest·digest·실행 호환성 |
| 현재 선택 Java | OpenJDK 21.0.9 | 문서가 요구하는 ARM JDK 17 준비 및 선택 JAR와의 호환성 |
| Node | v25.2.1 | 선택 TRON compiler/SDK/도구 조합의 실제 동작 |
| tronbox | PATH에서 발견되지 않음 | 다른 위치의 설치 유무, 설치·버전 검증 |

| 후보 | 공식 근거 | 남은 확인 |
|---|---|---|
| TronBox TRE | [quickstart](https://tronbox.io/docs/quickstart)는 Docker의 로컬 사설망을 제공하지만 Apple ARM에 최적화되지 않았다고 명시 | immutable image digest/platform, 포함 노드·compiler 버전, ARM 실제 기동/종료, 내부 peer·초기 계정 생성·로그 검토 |
| java-tron 사설 SR + FullNode | [공식 사설망 안내](https://tronprotocol.github.io/documentation-en/using_javatron/private_network/)는 ARM용 JDK 17·aarch64 JAR, SR/FullNode와 사설 genesis/peer 구성을 설명 | 고정 release/JAR checksum, OS별 native library 호환성, 직접 실행 또는 Linux ARM 컨테이너 적합성, 버전별 설정·수명 관리 |

런타임은 **미선정**이다. ARM용 JAR가 있다는 사실은 macOS ARM에서 해당 JAR가 동작한다는 증거가 아니다. Java 21을 선택 중이라는 사실도 JDK 17 요구 충족을 증명하지 않는다. [TronBox 설치 문서](https://tronbox.io/docs/guides/installation)의 Node/Docker 최소 버전 충족만으로 TRE의 기동을 보장하지 않는다. 공식 tron-docker 저장소에는 공개망용과 사설망용 경로가 함께 있으므로 기본 실행 구성을 사설망으로 간주하지 않는다([저장소](https://github.com/tronprotocol/tron-docker)).

## 구현 전 고정할 입력

- java-tron/protocol release·commit, 이미지의 아키텍처별 digest 또는 JAR checksum, JDK/runtime, 설정·TVM proposal 상태, SDK/의존성 버전과 라이선스.
- TRON 대상 compiler 버전·배포물 hash·최적화 설정·입력 소스 hash·ABI/bytecode hash. 현재 EVM solc 0.8.37 산출물이나 `--evm` 모드를 TVM 검증으로 재사용하지 않는다. [TronBox compilation](https://tronbox.io/docs/guides/compile-contracts)과 [별도 EVM 모드](https://tronbox.io/docs/guides/work-with-evm)를 구분한다. 필요한 Fixture 소스는 이 프로젝트에서 독립 작성한다.
- 실행별 ID, 소유한 프로세스/컨테이너·임시 데이터 디렉터리·genesis hash·사설 peer/protocol 설정·사용 포트·시간 제한·자원 한도. 키나 RPC URL은 공유 보고서에 넣지 않는다.

정확한 버전·digest·JDK·자원 수치는 아직 선정/측정하지 않았다. 공개망 FullNode의 권장 사양을 작은 사설망의 실측값으로 가져오지 않는다. 의존성 취득은 허용된 경로와 관리형 프록시 정책을 따르고 전역 모델/인증/프록시 설정을 변경하지 않는다.

## 제안하는 실행 수명과 관문

| 단계 | 구현할 동작 | 통과 증거 / 실패 처리 |
|---|---|---|
| 0. 범위 확정 | 위 제한적 사설 TVM 쓰기 범위를 확정하고 AGENTS·요구사항을 맞춤 | 현재 단계는 미통과. 준비 문서나 Lead proceed만으로 노드를 시작하지 않음 |
| 1. 도구 검증 | 고정한 배포물로 ARM 기동/종료, 준비 상태, CPU·메모리·디스크 실측 | 실제 client/버전·timeout·종료 결과. 실패 시 다른 공개 endpoint로 전환하지 않음 |
| 2. 격리·소유권 | loopback API, 전용 사설망, 명시적 genesis/peer/protocol 구성, 외부 peer 연결 부재 검사 | 생성 주체·프로세스 ID·설정 hash·genesis full ID·실제 peer 목록·접근 범위. localhost나 chainId만으로 통과시키지 않음 |
| 3. 신규 상태 준비 | 실행별 새 데이터와 폐기 계정, genesis 초기 자금, 신규 Fixture 배포 | 이전 DB/운영 계정 사용 없음, 배포 receipt·주소·코드·source/build 연결. 키·mnemonic·키를 출력하는 기동 로그를 공유 증거에 저장하지 않음 |
| 4. 단일 시나리오 | 동일 환경에서 직렬 실행, receipt·이벤트·상태·오류와 자원 증거 수집 | 아래 시나리오 조건을 검증. 접수/txID/timeout을 성공으로 대체하지 않음 |
| 5. 복구·정리 | 첫 구현은 시나리오마다 새 환경 reset. 자기 실행 자원만 종료 | Anvil snapshot/revert API가 TVM에 있다고 가정하지 않음. 강제 중단·준비 실패·배포 실패에서도 owned 자원 정리와 결과 보존 확인 |

P2P 격리는 사설 genesis/protocol뿐 아니라 실제 연결과 실행 네트워크 경계로 확인해야 한다. Docker socket/기존 호스트 디렉터리를 임의 마운트하거나 기존 컨테이너/전체 volume을 일괄 정리하지 않는다. 기동 준비 실패, 잔액 부족, receipt 미수신 등 인프라 오류는 토큰 기능 부재로 판정하지 않는다.

## 첫 Fixture와 검증 순서

아래는 구현할 수용 기준이며 아직 실행하지 않았다. 우선 정상 TRC-20 Fixture 하나에서 흐름을 검증한 뒤 음성 Fixture를 추가한다. 총발행·자금은 해당 사설 genesis/신규 Fixture 안에서만 생성한다.

| 순서 | 검사 | 필요한 증거 |
|---|---|---|
| A | 배포·metadata·잔액 | 신규 계약 배포 receipt, 코드, ABI decode, decimals, 정확한 supply·잔액. Number.MAX_SAFE_INTEGER 초과 금액의 손실 없는 표현 |
| B | 양수/0 transfer | 호출자·수취인, receipt 실행 결과, ABI 반환 관측, Transfer의 계약 주소/topics/data, 전후 잔액·supply. 잔액 초과 거부 뒤 무변경 확인 |
| C | approve/allowance/transferFrom | owner/recipient/spender 분리, Approval, 승인량 설정·사용·한도 초과 거부·철회, 상태와 Transfer. 실제 거래의 반환과 사전 constant simulation을 구분 |
| D | 오류·음성 Fixture | false/no-return/malformed, 누락·모순 이벤트, 잘못된 상태 변화, RPC 장애와 receipt timeout. 예상 FAIL 보고서와 자동 테스트 실패를 구분 |
| E | 자원 관측·격리 반복 | Energy/Bandwidth/fee 필드·단위·지불 주체, 성공/거부의 실제 차이, 재실행 오염 부재와 종료 처리. 수수료 존재 자체를 FAIL로 만들지 않음 |

[GetTransactionById](https://developers.tron.network/reference/wallet-gettransactionbyid)는 거래 본문이고 [GetTransactionInfoById](https://developers.tron.network/reference/gettransactioninfobyid)는 실행 receipt다. HTTP 200, broadcast 접수 또는 txID만으로 성공을 판정하지 않는다. transaction·receipt·포함 블록의 full ID/높이·이벤트의 계약 주소를 연결하고 반환 데이터와 상태 조건을 함께 검사한다. receipt가 아직 없으면 미확정이며 실패나 미지원의 증거가 아니다.

자원량·fee·TRX sun·토큰 금액을 각각 구분한다. uint64/uint256 등 큰 수는 JSON/SDK가 Number로 반올림하기 **전** 손실 없는 파싱 경로를 확인하고 bigint/십진 문자열로 정규화한다. 이 경로는 현재 HTTP/SDK 실행 제품에 구현되어 있지 않다.

## 보고서와 완료 기준

receipt의 포함 블록을 후속 balance/allowance getter의 상태 블록으로 복사하지 않는다. [응답 블록 조사](../research/TRON_RESPONSE_BLOCK_BINDING.md)의 미해결 연결 문제는 사설망에서도 자동 해소되지 않는다. 사설 TVM 성공을 Mainnet 동작·최종성·자산 안전성의 증거로 확대하지 않는다. 기존 TRON READ_ONLY의 UNKNOWN/INCONCLUSIVE/support와 TRC20-003 NOT_TESTED를 유지한다.

현재 [EVM LabReport](../../src/lab/run.ts)는 Anvil chainId/hardfork/build 구조를 가진다. 이를 TVM 실행 보고서로 가장하지 않고, 후속 구현에서 별도 환경 증거·시나리오 버전·보고서 계약을 검토해야 한다. 알려지지 않은 getter 블록을 숨기거나 PASS를 만들기 위해 Report 1.0을 완화하지 않는다.

실제 TVM 단계 완료는 위 관문·정상 및 오류 시나리오·재현·자원 정리의 실행 증거, 보고서 계약 검사와 기존 EVM/TRON 회귀 통과를 요구한다. 현재 준비 완료는 그 실행 완료와 다르다. 후속 첫 작업은 범위 확정 후 도구/배포물 선택·고정과 격리된 기동 검증이며, 모든 시나리오를 동시에 구현하지 않는다.

Lead bridge `dd04c61be65f43cb9c772288595fade1`의 proceed는 연구·준비 문서 범위다. 실제 쓰기 범위의 승인이 아니다. 현재 후보를 채택한 ADR로 취급하지 않는다.

준비안 반영 후 `npm run check`의 타입 검사와 전체 49개 테스트가 통과했다(실패·skip 0). 변경 문서의 로컬 링크 37개와 `git diff --check`를 확인했다. 이 회귀 검사는 TVM Fixture 실행 증거가 아니다.
