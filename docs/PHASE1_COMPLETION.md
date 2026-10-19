# Phase 1 완료 점검표

점검일: 2026-10-19. 대상은 점검 당시 작업 디렉터리의 코드와 로컬 증거다. 당시에는 Git HEAD가 없었다. 이후 로컬 버전 기준 보존 절차는 [Phase 1 기준 커밋](PHASE1_BASELINE.md)에 기록한다. 이 점검은 특정 릴리스에 대한 인증 기록은 아니다.

**판정: 현재 명시한 Phase 1의 구현·로컬 검증 완료.** [필수 요구사항](REQUIREMENTS.md)에 대응하는 구현과 테스트를 확인했으며, 이 범위에서 미구현 필수 항목은 확인되지 않았다. 자산 안전성·금융기관 취급 승인·운영 배포 준비 완료는 이 판정의 대상이 아니다. 아래 제약은 완료 범위와 함께 유지한다.

## 완료 기준

- [x] Phase 1 필수 기능마다 코드와 실제 실행 또는 오류 경로 테스트가 있다.
- [x] 기본 7종 Fixture를 신규 사설 Anvil에서 실행하고 시나리오별 snapshot을 복원한다.
- [x] 개별 관측 FAIL, 증거 부족 INCONCLUSIVE, 미실행 NOT_TESTED와 지원 여부를 구분한다.
- [x] 외부 assess는 읽기 전용이며 로컬 gateway에서 읽기 RPC와 상태 무변경을 검증한다.
- [x] 금액의 bigint/십진 문자열, Report/Lab 1.0 계약과 증거 참조를 검증한다.
- [x] CLI 출력·오류·저장 실패 및 JSON 파일 권한을 검증한다.
- [x] `npm run check`의 타입 검사와 전체 테스트 43개가 통과한다(실패/skip 0).

## 요구사항과 근거

아래의 완료는 명시한 샘플·프로필의 구현과 검증을 의미한다. 모든 토큰·입력 조합의 표준 준수 판정은 아니다.

| 요구사항 | 상태 | 구현 | 검증 근거 |
|---|---|---|---|
| 네트워크·주소·RPC 입력 | 완료 | [CLI](../src/cli.ts), [Identity](../src/evm/identity.ts) | [통합 검사](../tests/integration.test.ts): 잘못된 네트워크·주소·EOA 거부, [CLI 검사](../tests/cli-output.test.ts) |
| 주소 기반 Identity·metadata | 완료 | [Identity](../src/evm/identity.ts) | [경계 테스트](../tests/metadata-boundaries.test.ts): decimals 0/255/범위 위반, empty/Unicode, 최대 uint256, revert/잘못된 ABI 구분 |
| balance 조회 | 완료 | [EVM assessment](../src/evm/assessment.ts), [executor](../src/evm/executor.ts) | [Adapter 계약](../tests/adapter-contract.test.ts): 선택 holder·잔액 0·동시 요청 증거 격리·미지정 NOT_TESTED |
| 양수 transfer·반환·이벤트 | 완료 | [시나리오](../src/evm/scenarios.ts) ERC20-002/005 | [통합 검사](../tests/integration.test.ts): 실제 receipt·잔액·이벤트·잔액 초과 거부·프로필 차이 |
| 0 transfer | 완료 | ERC20-008 | [0 전송 테스트](../tests/zero-transfer.test.ts): 이벤트·상태·supply, 거부·누락·잘못된 이동·관측 장애 |
| approve/allowance·zero-reset | 완료 | ERC20-003 | [통합 검사](../tests/integration.test.ts): 최초·변경·zero-reset·Approval·최종 allowance |
| 양수 transferFrom·한도 초과 | 완료 | ERC20-004 | [통합 검사](../tests/integration.test.ts): 승인량·수취량·allowance 차감 및 한도 초과 시 상태 무변경 |
| 0 transferFrom | 완료 | ERC20-009 | [0 delegated 전송 테스트](../tests/zero-transfer-from.test.ts): 승인 전제·spender·이벤트·잔액/supply/allowance·전제 실패 시 미시도 |
| 승인 철회·후속 거부 | 완료 | ERC20-010 | [철회 테스트](../tests/allowance-revocation.test.ts): 단계별 전제, 실제 거부, FALSE와 상태 변경, raw Transfer 모순, receipt/preflight 불일치 |
| 반환/revert와 인프라 오류 구분 | 완료 | [ABI](../src/evm/abi.ts), [RPC](../src/evm/rpc.ts) | [도메인](../tests/domain.test.ts), [RPC 오류](../tests/rpc-errors.test.ts), 시나리오별 오류 주입 |
| 수수료·프로필 | 완료 | ERC20-006, baseline/exact-receipt | [통합 검사](../tests/integration.test.ts): 10000 차감/9900 수취, supply 변화, 정확 수취 정책의 별도 FAIL |
| Fixture 관리자 제한 | 완료 | ERC20-007 PAUSE/BLACKLIST | [통합 검사](../tests/integration.test.ts): owner·무권한 거부·차단·복구; setter 실패는 기능 부재로 단정하지 않음 |
| Proxy 구조 관측 | 완료한 보강 | [Proxy](../src/evm/proxy.ts), EVM-PROXY-001 v1.1.0 | [Proxy 테스트](../tests/proxy.test.ts): EIP-1967/Beacon/ZeppelinOS/canonical clone, 충돌·위조 슬롯·빈 코드·조회 실패 |
| 공통 모델·판정 경계 | 완료 | [모델](../src/domain/model.ts), [평가기](../src/domain/evaluator.ts), [Adapter](../src/domain/adapter.ts) | [도메인](../tests/domain.test.ts), [Adapter 계약](../tests/adapter-contract.test.ts): UNKNOWN/비적용, 증거 gate, 요청별 격리 |
| JSON 증거·버전·집계 | 완료 | [Assessment 스키마](../schemas/assessment-report.v1.schema.json), [Lab 스키마](../schemas/lab-report.v1.schema.json) | [보고서 계약](../tests/report-contract.test.ts): 금액·태그·증거 참조·Identity·집계·추가 필드 호환 |
| CLI 저장·진단 | 완료 | [파일 출력](../src/report-output.ts), [진단](../src/diagnostics.ts) | [저장 테스트](../tests/report-output.test.ts), [CLI](../tests/cli-output.test.ts), [RPC 오류](../tests/rpc-errors.test.ts): 완성 후 교체·0600·기존 파일 보존·안전한 오류 문구 |
| 관측 블록 | 완료한 보강 | [RPC pin](../src/evm/rpc.ts) | [블록 참조 테스트](../tests/block-reference.test.ts): 수량·헤더 번호·해시 확인, 오류 시 이전 참조 제거 |
| 반복 실행·격리 | 완료 | [Anvil 수명](../src/lab/anvil.ts), [lab](../src/lab/run.ts) | [통합 검사](../tests/integration.test.ts): baseline 2회 판정 재현, exact-receipt, 각 시나리오 snapshot 복원 |

## 보존된 실행 증거

로컬 파일은 `reports/`에 있으며 Git 제외 대상이다. 점검 시 여섯 파일의 각 Assessment 계약·증거 참조·EVM 블록 참조·해당 Solidity 소스 해시·POSIX 0600을 확인했다. build의 소스 해시는 Fixture 소스에 대한 값으로 전체 엔진이나 실행 환경의 해시는 아니다.

| 파일 | 표본/전체 결과 수 | 아래 집계의 대상 | PASS | FAIL | INCONCLUSIVE |
|---|---:|---|---:|---:|---:|
| baseline.json | 7 / 91 | 전체 시나리오 | 64 | 5 | 22 |
| exact-receipt.json | 7 / 91 | 전체 시나리오 | 61 | 8 | 22 |
| zero-transfer-local.json | 9 / 117 | ERC20-008만 | 3 | 6 | 0 |
| zero-transfer-from-local.json | 15 / 195 | ERC20-009만 | 3 | 8 | 4 |
| allowance-revocation-local.json | 21 / 273 | ERC20-010만 | 5 | 12 | 4 |
| metadata-boundaries-local.json | 12 / 156 | ERC20-001만 | 3 | 5 | 4 |

기본 두 파일은 CLI LabReport다. 나머지는 컴파일·배포 정보와 전체 평가를 담은 테스트 보조 envelope로서 LabReport와 형식이 다르다. 표의 집중 집계를 전체 결과 수와 혼동하거나 표본을 합산해 독립 자산 수로 계산하지 않는다. 일부 오류 주입 평가는 같은 신규 Fixture를 재사용한다.

baseline의 의도된 FAIL 5건은 FalseReturnToken이다. exact-receipt는 FeeToken의 양수 검사 3건을 추가 FAIL로 기록한다. 두 lab 명령의 종료 코드 2는 실행 완료 후 관측 FAIL을 나타내며 자동 테스트 실패가 아니다. 종료 코드 0도 INCONCLUSIVE/NOT_TESTED를 포함할 수 있다.

[0 전송](ZERO_TRANSFER_RESULTS.md), [0 transferFrom](ZERO_TRANSFER_FROM_RESULTS.md), [철회](ALLOWANCE_REVOCATION_RESULTS.md), [metadata](METADATA_BOUNDARY_RESULTS.md), [Proxy](PROXY_RESULTS.md)의 당시 결과와 제약을 함께 보존한다. 과거 63/70/77/84건 및 테스트 수는 해당 단계의 기록으로 해석한다. 기존 USDC/USDT mainnet 보고서는 역사적 읽기 전용 관측이며 이번 점검에서 외부 RPC를 재조회하거나 보고서를 소급 수정하지 않았다.

## 완료 범위에 남기는 제약

| 영역 | 현재 상태와 해석 |
|---|---|
| 실제 자산 실행 | 외부 RPC는 metadata/선택 holder/지원 Proxy 신호 읽기만 수행. 전송·승인·관리자 제어는 NOT_TESTED이며 운영 키·외부 거래·fork 실행을 제공하지 않음 |
| Proxy·권한 | 1차 선언 대상과 코드 존재만 확인. 실제 dispatch·재귀 대상·범용 변형·업그레이드 권한은 미검증. 구조 PASS여도 UPGRADEABILITY support는 UNKNOWN |
| 발행사·원산·안전성 | issuer/검증 상태/native-or-bridged는 UNKNOWN. labels·주소 후보 조회는 발행사 인증·준비금·규제·취급 승인 증거가 아님 |
| metadata·ABI | decimals의 uint8 범위 검사와 현재 string ABI 지원. bytes32 label 변환과 모든 ABI의 canonical 검증은 미구현 |
| 실행·상태 | preflight는 채굴 반환 데이터가 아님. 샘플 계정/금액/상태에 한정하며 EMPTY는 기존 호환성 수용. 철회 뒤 거부는 철회가 원인임을 입증하지 않음 |
| 블록·최종성 | 번호/헤더/해시 형식과 일치를 확인. 숫자 태그 사용으로 재조직·모든 조회의 해시 고정·최종성은 미검증 |
| 보고서 저장·진단 | 완성 파일 교체와 관측한 최종 링크 거부. 동시 writer는 마지막 rename이 남으며 잠금·전원 손실 영속성·적대적 부모 교체 방어는 제공하지 않음. 상위 오류 원문은 생략하나 모든 성공 데이터의 범용 비밀 제거 기능은 아님 |
| 추가 Capability | mint/burn 실행, sweep, finality, arbitrary authority 및 전용 시나리오 없는 capability는 NOT_TESTED. fee로 인한 supply 변화 관측을 별도 BURN 기능 검증으로 집계하지 않음 |

## 다음 범위와 전달 준비

위 제약을 미구현 Phase 1 필수 기능과 섞어 처리하지 않는다. 추가 ABI/Proxy 지원, TRON, Solana, Token-2022, 운영 프로필, AI 보조, 웹 UI는 [로드맵](ROADMAP.md)의 별도 범위다. 이번 완료 점검은 후속 단계 구현이나 외부 상태 변경을 시작하지 않는다.

공유·릴리스를 준비하려면 [로컬 기준 커밋](PHASE1_BASELINE.md)을 바탕으로 전달할 코드 기준, 생성 증거의 보관·전달 정책과 대상 실행 환경에서의 재현 범위를 정리해야 한다. 완료 점검표를 작성한 작업에서는 게시·배포를 수행하지 않았다. 운영 배포 검증도 이 로컬 완료 점검에 포함되지 않는다.

개발용 Router는 제품과 별도다. shadow 추천·조건부 Lead 검토 절차는 유지하며 실제 토큰 절감은 입증되지 않았다([효과 관측](ai/ROUTER_EFFECTIVENESS.md)). 이번 문서 정리는 새로운 기술 결정이나 위험한 실행 변경을 추가하지 않아 별도 Lead 요청을 만들지 않았다.
