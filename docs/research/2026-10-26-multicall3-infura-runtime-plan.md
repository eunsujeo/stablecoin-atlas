# Multicall3 Infura 새 단발 읽기 계획

## 준비 상태와 사용자 지시

사용자가 브라우저에서도 PublicNode 인증서 오류를 보았고 Infura로 변경했다고 알렸다. 브라우저 관측은 사용자 보고이며 도구의 독립 관측과 구분한다. 기존 `workspaceEnvironment`로 읽은 `RPC_URL`이 HTTPS Infura Ethereum mainnet의 허용 형식임을 값/URL/키를 출력하지 않고 확인했다. **Infura 외부 송신은 아직0이며 아래 고정 범위의 별도 승인 전 실행하지 않는다.** 비용은 UNKNOWN이다.

후속 상태: 사용자가 아래 고정 범위를 승인해 실행했고 4RPC 모두 정상 반환됐다. 블록26275729의 runtime3808바이트와 저장 공급자 두 artifact의 전체 바이트가 일치했다. **v3 소비 완료**이며 재사용하지 않는다. 아래 외부0/미실행/슬롯 없음은 준비 당시 기록이고 현재 상태는 [별도 실행 결과](2026-10-26-multicall3-infura-runtime-result.md)를 따른다.

기존 v2 wrapper는 `publicRPC['1']`를 고정 사용한다. 환경변수만 변경하고 같은 wrapper를 재사용하면 새 설정을 선택하지 못하며 기존 슬롯도 이미 소비됐다. 따라서 별도 v3 Infura 고정 profile/CLI/소비 슬롯을 준비한다. 기존 [v2 TLS 실패](2026-10-26-multicall3-runtime-read-result.md)와 첫 실패 UNKNOWN·소비·보고서는 보존한다. 사용자 보고/CA 목록 차이만으로 정확한 TLS 원인을 확정하지 않는다.

## 대상·입력·endpoint

- Ethereum chainId `1`, 단일 주소 `0xca11bde05977b3631167028862be2a173976ca11`. 새로운 주소/다른 체인/Proxy 후보 추적은 없다.
- 기존 셸/`.env.local`의 `RPC_URL`을 기존 우선순위로 읽어 메모리 안에 한 번 고정한다. Infura Ethereum mainnet HTTPS 호스트의 `/v3/<기존 프로젝트 식별자>` 형식만 허용한다. 비기본 port·userinfo·query·fragment·다른 호스트는 송신 전 거절한다. 새 키를 요구/저장/복사/출력하지 않는다.
- plan/receipt는 `RPC_URL:INFURA_ETHEREUM_MAINNET` 선택자만 기록한다. URL·프로젝트 키·키/전체 URL의 hash·인증 header·provider 오류 원문은 저장/출력하지 않는다. 응답은 비신뢰 입력으로 처리한다.
- [v2 계획](2026-10-26-multicall3-runtime-read-plan.md#고정-대상과-입력)의 기존 capture/최초 plan/snapshot3개 hash를 그대로 검사하고, 추가로 v2 receipt SHA256 `6f62fa74a52faa87e15842878296da12f8de992ef80f9897015dae56643f4def`를 pin한다. 입력4개 불변을 전후 검사한다.
- 저장 capture의 공급자 onchain/recompiled runtime만 오프라인 전체 바이트 대조한다. 기대 keccak256 `0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891`. 원본 compiler 독립 재컴파일/소스 진위 증명은 아니다.

## 실제 실행 제안 범위

| 순서 | 메서드 | 고정 인자·검증 | 최대 횟수 |
| --- | --- | --- | ---: |
| 1 | `eth_chainId` | `[]`; Ethereum `0x1` | 1 |
| 2 | `eth_getBlockByNumber` | `['latest', false]`; 유효 높이/hash 확보 | 1 |
| 3 | `eth_getCode` | `[위 주소, {blockHash: 확보 hash, requireCanonical: true}]`; 유효하고 비어 있지 않은 runtime | 1 |
| 4 | `eth_getBlockByNumber` | `[같은 높이의 hex, false]`; 동일 높이/hash 종료 확인 | 1 |

최대4RPC/120초·각15초·각 응답2MiB/합계8MiB·소스 GET0이다. 재시도·redirect·batch·자동 endpoint 전환·EIP1898 거절 뒤 number/latest fallback0이다. Infura의 EIP1898/계정 접근 가능 여부는 미검증이다. 오류·체인 불일치·빈 코드·hash 변경·한도 초과 시 즉시 중단하고 미송신 단계는 NOT_TESTED로 남긴다. 남은 한도로 재실행하지 않는다.

새 고정 슬롯 `.state/contract-review-multicall3-infura-runtime-once-20261026-v3/`에 plan/최초 송신 전 `wx` 소비 marker를 만든다. 디렉터리0700/파일0600을 유지하고 기존 소비 슬롯을 바꾸거나 재사용하지 않는다. 새 슬롯이 있으면 거절하며 자동 대체 슬롯 생성0이다. 선택된 URL은 요청 전체에서 고정하고 입력/설정 변경은 최종 비교를 UNKNOWN으로 남긴다.

TLS 인증서 검증은 유지한다. `NODE_TLS_REJECT_UNAUTHORIZED=0`이면 송신 전 거절한다. `--use-system-ca`·CA 경로·OS 신뢰 저장소·전역 환경/인증 설정은 이번 전환에서 변경하지 않는다. 관리형 proxy 설정을 상속한다. 새 공급자 usage/요금/키 발급/설정 API·자동 compiler/다운로드·서명/거래·운영 DB/Collector/FX/대시보드/배포 변경0이다.

## 출력과 판정

새 비공개 receipt/runtime/Markdown과 입력 불변·실제 요청 수·시각·고정 오류 분류·기준 block/hash·전체 바이트 비교 결과를 보존한다. 모든 요청과 종료 검사가 성공해야 해당 블록 runtime/artifact equality만 PASS/FAIL로 표시한다. 관측 실패는 INCONCLUSIVE/대조UNKNOWN이다. 원본 compiler NOT_RUN·소스 진위 UNKNOWN·Proxy/권한 NOT_TESTED·기존 호환성 판정은 유지한다. 새 결과를 자동으로 웹에 게시하지 않는다.

## 구현·검증·재현

고정 profile 두 개의 내부 공통 읽기/저장 경로를 재사용하며 v2 주소/endpoint/슬롯/입력 pin은 바꾸지 않는다. Infura 전용 CLI는 `--preflight` 또는 `--execute` 중 하나만 허용하고 임의 endpoint/target/한도 옵션은 제공하지 않는다. `--preflight`는 입력4개·설정 형식·TLS 검증 유지 여부만 확인하고 외부 연결/소비 슬롯 생성은 하지 않는다.

```sh
# 로컬 입력·설정 검사만. 외부0.
node --use-env-proxy tools/contract-review-infura-runtime-read.mjs --preflight

# 위 고정 범위의 별도 실행 승인 후에만 사용한다.
node --use-env-proxy tools/contract-review-infura-runtime-read.mjs --execute
```

가상 시험에서 Infura 형식 거절·키/URL 미노출·전용 슬롯/입력4개·요청 순서/한도·성공/오류 저장·재실행 거절 및 기존 v2 동작을 확인한다. 저장 자료를 사용한 가상 응답은 실제 Infura 증거가 아니다. 최종 검증/인계와 Lead 판단은 준비 완료 후 기록한다.

### 수행 경로와 확보/미확인

기존 실행기의 public 고정값을 확인한 뒤 별도 고정 profile을 만들고, 공통 내부 읽기/저장 함수로 기존 v2와 v3를 연결했다. v2의 주소/endpoint/슬롯/입력3개는 유지했다. v3는 기존4RPC 관측 순서를 그대로 사용하면서 입력4개와 기존 설정을 실행 전후 확인한다. profile은 고정 두 객체만 허용한다. URL 파싱의 일반 오류도 고정 문구로 바꿔 키를 노출하지 않는다.

형식 검토 중 빈 query/fragment 구분자도 허용하지 않도록 정규화 URL 전체와 origin+pathname을 비교했고 관련 회귀를 추가했다. 가상 시험에서 Infura endpoint 형식/키 미노출·두 profile별 slot·네 번째 pin·잘못된 모드 거절을 검증했다. 로컬 저장 자료의 새 소유 임시 디렉터리와 가상 RPC로 성공/TLS 실패/설정 변경/receipt 변경/receipt 미제출/다른 endpoint 거절6경로도 검증했다. 성공형 가상 응답은 저장 공급자 runtime을 반환할 뿐 실제 Infura/현재 배포 증거가 아니다. 임시 디렉터리는 정리했다.

기존 v2의 가상 성공/실패2경로도 다시 실행해 public endpoint 고정·소비 기록·receipt/권한·재실행 거절을 확인했다. 실제 소비된 v2 wrapper는 재실행하지 않았다. 기존3파일/v2 receipt/소비 원문 불변을 확인하고 v3 실제 슬롯은 만들지 않았다. 이번 준비 중 실패한 시험이나 실제 외부 요청은 없다. 키/URL을 요구하거나 기존 환경 파일을 수정하지 않았다.

Lead `beedde923e37453893bda03b9744ed15`: proceed(로컬 v3 구현·계획 준비). 정확한 endpoint 형식·기존 소비/원본 보존·비밀 미저장·새 단발 소비·전후 입력 검증·TLS/proxy 유지·가상 검증 조건을 적용했다. 실제 Infura 송신 승인이 아니다. 추가 agent/미회수 agent0.

### 최종 검증 결과

- `npm run check > .state/agent-logs/contract-runtime-infura-check.log 2>&1`: rc0, tests650/pass650/fail0/cancelled0/skipped0.
- `node --use-env-proxy --import tsx --test tests/contract-review-runtime-once.test.mjs tests/contract-review-transport.test.mjs`: rc0, tests12/pass12/fail0/cancelled0/skipped0. `.state/agent-logs/contract-runtime-infura-targeted-final.log`.
- `node --use-env-proxy tools/contract-review-infura-runtime-read.mjs --preflight`: rc0, PREFLIGHT_READY/INFURA_ETHEREUM_MAINNET/inputPins4/RPC0/GET0. 실제 연결 성공/키 권한은 미검증이다.
- `node .state/agent-logs/contract-runtime-infura-integration.mjs`: rc0, 가상6/pass6/fail0/externalRPC0/liveEvidence false. 같은 이름의 `.log` 보존.
- `node .state/agent-logs/contract-runtime-preparation-integration.mjs`: rc0, 기존 v2 가상2/pass2/fail0/externalRPC0. `.state/agent-logs/contract-runtime-infura-v2-regression.log`.
- 기존 입력3개/v2 receipt·plan·소비 marker·Markdown hash 불변, v3 실제 슬롯 없음, `git diff --check` rc0. 실제 Infura 연결/키 권한/비용/기준 블록/runtime 대조는 NOT_TESTED/UNKNOWN으로 남긴다.
- 인계: [Infura v3 준비](../handoff/2026-10-26-contract-runtime-read-v3-infura-preparation.md). 사용자 고정 범위 승인 전 `--execute`를 호출하거나 새 소비 슬롯을 만들지 않는다.
