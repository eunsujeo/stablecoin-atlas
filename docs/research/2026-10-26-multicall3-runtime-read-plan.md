# Multicall3 실제 배포 코드의 새 단발 읽기 계획

## 현재 상태와 승인 경계

사용자의 후속 진행 요청에 따라 로컬 실패 진단과 새 실행 범위를 준비했다. **외부 실행은 NOT_TESTED이며 이 문서의 고정 범위에 대한 사용자 승인 전에는 송신하지 않는다.** 최초 실행의 실패·소비·UNKNOWN은 [원래 기록](2026-10-26-contract-review-multicall3.md)에 보존한다. 기존 소스 분석·사설 시험·대시보드의 판정을 변경하지 않는다.

후속 상태: 사용자가 이 고정 범위를 승인해 실행했다. 첫 `eth_chainId`가 TLS_FAILURE로 종료돼 **v2 소비 완료**이며, 배포 코드 읽기는 NOT_TESTED다. 아래 NOT_TESTED/슬롯 없음/승인 대기는 준비 당시 기록이다. 현재 상태는 [별도 실행 결과](2026-10-26-multicall3-runtime-read-result.md)를 따르고 같은 실행을 재사용하지 않는다.

## 로컬에서 확인한 실패

저장 snapshot의 첫 `eth_chainId` 이벤트는 `FAILED`, 수신0바이트, HTTP 상태코드 없음이다. 상위 오류는 `PIN / READ_OR_VALIDATION_FAILED`이며 `eth_getCode`에 도달하지 않았다. `Transport`가 fetch·body·파싱 오류를 모두 `READ_FAILED`로 바꿔 상세 원인을 보존하지 않았으므로 DNS/TLS/프록시/timeout/공급자 장애 중 무엇인지는 **UNKNOWN**이다. 메시지로 원인을 추정하거나 과거 실패를 새 분류로 소급하지 않는다.

당시 로컬 실행 로그와 현재 `package.json` 모두 `node --use-env-proxy`를 사용한다. 따라서 프록시 옵션 누락을 원인으로 확정하지 않는다. 현재 프로세스에서 표준 proxy 변수의 존재 여부만 점검했으며 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY는 모두 미설정이었다. 이는 당시 환경이나 투명한 관리형 프록시의 부재를 입증하지 않는다. 환경 값·URL·키는 출력하지 않았다.

## 고정 대상과 입력

- Ethereum chainId `1`, 단일 주소 `0xca11bde05977b3631167028862be2a173976ca11`. 기존 승인 대상 식별자의 재사용이며 새 공식 주소 인증이 아니다.
- endpoint는 `src/contract-review/network.mjs`의 기존 `publicRPC['1']` **PublicNode 한 개**로 고정한다. `RPC_URL`·다른 endpoint·공급자로 전환하지 않으며 URL은 보고서·로그에 저장하지 않는다. 기존 실패와 같은 선택을 사용하는 **새 승인 실행**이며 자동 재시도가 아니다.
- 소스/ABI/metadata는 새로 취득하지 않는다. 저장 capture `.state/contract-review-sourcify-initial.json`(124087바이트, SHA256 `b41da40a4f7fd443aae7bef93e4e3f517ded3ba9cee8db0228c2cf0962fe083c`)만 오프라인 대조에 사용한다.
- 공급자 저장 onchain/recompiled runtime의 기대 keccak256은 `0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891`이다. 새 관측 runtime과 양쪽 바이트 전체를 비교하고 각 hash도 기록한다. 공급자 artifact의 일치는 원본 compiler 독립 재컴파일 증명이 아니다.
- 기존 실패 plan SHA256 `49c3ae220a91e32412991454d197cbae14545e8c52a61e4d6353c366843ee30f`, snapshot SHA256 `43cbafc6524b653c4660b8b8eb5201d0b887e9ef80fdc82219bcfe770c753fc7`을 실행 전후 검사한다. 원래 파일은 변경하지 않는다.

## 제안하는 실제 읽기 순서와 한도

초기 독립 CLI의 최대32RPC보다 좁은 **최대4RPC**로 배포 코드 읽기만 분리한다. 기존 전체 `review:contract` CLI는 Proxy 후보·소스 추가 취득을 할 수 있으므로 이 계획의 실행 경로로 사용하지 않는다.

| 순서 | 메서드 | 인자·검증 | 최대 횟수 |
| --- | --- | --- | ---: |
| 1 | `eth_chainId` | `[]`; Ethereum `0x1` 확인 | 1 |
| 2 | `eth_getBlockByNumber` | `['latest', false]`; 유효한 높이와32바이트 hash 확보 | 1 |
| 3 | `eth_getCode` | `[위 주소, {blockHash: 확보 hash, requireCanonical: true}]`; 유효하고 비어 있지 않은 runtime | 1 |
| 4 | `eth_getBlockByNumber` | `[확보한 원래 높이의 hex, false]`; 동일 높이·hash 종료 확인 | 1 |

- 전체120초·각 요청15초·각 응답2MiB·전체8MiB 이내. 순차 단일 요청만 사용한다. 소스 GET·탐색 GET·사용량 조회·키·compiler 다운로드/실행0.
- 재시도·redirect·batch·endpoint 전환·EIP1898 거절 후 number/latest fallback0. 오류·체인 불일치·빈 코드·hash 변경·한도 초과 시 즉시 종료하며 미송신 단계는 NOT_TESTED로 남긴다. 성공률이나 무료 이용/비용을 보장하지 않으며 비용은 UNKNOWN이다.
- 전용 wrapper `src/contract-review/runtime-once.mjs`는 Transport를 `rpc:4, get:0`으로 제한하고 위 메서드·순서·인자를 고정한다. 호출자가 주소·endpoint·메서드·한도를 지정하는 CLI 옵션은 없다. wrapper 구현·가상 검증은 완료했고 **실제 송신은 NOT_TESTED**다.
- 새 고정 소비 슬롯 `.state/contract-review-multicall3-runtime-once-20261026-v2/`를 사용한다. 디렉터리0700/파일0600, 입력 hash·한도·대상·endpoint 선택자만 있는 plan을 기록하고 최초 송신 전 배타적 `wx` 소비 marker를 만든다. 실패도 소비 완료로 남긴다. 같은 슬롯 재사용·자동 새 슬롯 생성·기존 실패 소비 재사용은 하지 않는다.
- wrapper 가상 시험은 요청 순서·인자·총4회·동시/중복 소비 거절·체인 불일치·빈 코드·종료 높이/hash 변경·timeout·응답 크기·EIP1898 거절과 재시도0을 검증한다. wrapper는 이번 계획에서 필요한 읽기 경로로만 제한한다.

## 결과와 남기는 자료

새 비공개 runtime/receipt·JSON/Markdown을 별도 슬롯에 보존한다. 입력 hash 불변, 실제 시도/정상 반환/수신량, 단계별 고정 오류 분류, 시작/종료 시각·기준 블록·runtime hash·대조 범위를 기록한다. 원문·RPC URL·키·provider 오류 원문은 Git/웹에 게시하지 않는다. 대시보드 자동 게시·운영 DB/Collector/FX/배포·서명/거래0이다.

모든 단계가 성공해야 그 블록의 runtime과 저장 공급자 artifact의 전체 바이트 비교 결과를 제시한다. 실패는 INCONCLUSIVE이며 실제 배포 연결 UNKNOWN을 유지한다. 일치는 해당 블록의 코드/artifact 대응에 한정하고 소스 진위·원래 compiler 재컴파일·Proxy/dispatch·권한·현재 시점 자산 안전성 인증으로 확대하지 않는다. 실제 Solidity 소스를 체인에서 직접 읽었다고 표현하지 않는다.

## 로컬 진단 보완과 검증 기록

`Transport.events`에 고정 `failureKind`를 추가했다. 연결 단계의 알려진 구조화 code만 DNS/TLS/연결 실패로 분류하며 cause 탐색은5개 노드·순환 방어로 제한한다. 자체 timeout signal, HTTP 상태, body 중단, UTF-8/JSON 오류, byte 한도를 구분한다. HTTP 수신 성공과 RPC error/envelope 오류는 `status`와 `rpcStatus`로 분리한다. 원시 message/stack/cause/code/URL은 직렬화하지 않으며 미상은 UNKNOWN이다. 기존 상위 오류 문자열과 기존 보고서는 보존한다.

Lead `96d34cd7d7634f3a8622fb61a4fc5327`: proceed(로컬 진단·가상 검증·계획 준비). 초기 제안 최대32RPC에서 위4RPC로 좁혔고 후보 추적/소스 취득도 제외했다. Lead 검토는 외부 실행 승인이 아니다.

### 최종 검증 결과

- `npm run check`: rc0, tests647/pass647/fail0/cancelled0/skipped0. `.state/agent-logs/contract-runtime-preparation-check-final.log`. 첫 전체 check도 rc0,646/646이며 마지막 응답 귀속 보완 후 최종647개로 다시 통과했다.
- `node --use-env-proxy --import tsx --test tests/contract-review-transport.test.mjs tests/contract-review-runtime-once.test.mjs`: rc0, tests9/pass9/fail0/cancelled0/skipped0. `.state/agent-logs/contract-runtime-preparation-targeted-final.log`.
- `node --use-env-proxy tools/contract-review-runtime-read.mjs --preflight`: rc0, PREFLIGHT_READY/inputPins3/RPC0/GET0. 연결 성공 검증이 아니다.
- `node .state/agent-logs/contract-runtime-preparation-integration.mjs`: rc0, 가상2항목/pass2/fail0, externalRPC0/liveEvidence false.
- 기존3파일 SHA256 불변, 실제 새 소비 슬롯 없음, `git diff --check` rc0. 외부 조회·키 추가·compiler 실행·운영 데이터 변경0. 최종 문서 기록 추가에서 잘못된 patch 문맥으로1회 거절됐고 문서를 바꾸지 않은 채 올바른 문맥으로 수정했다.
- 인계: [runtime 읽기 준비](../handoff/2026-10-26-contract-runtime-read-preparation.md). 실제 외부 실행 승인 대기 중이므로 세션 갱신은 예약하지 않는다.

### 실행 경로

```sh
# 입력3개 hash·저장 artifact만 확인. 네트워크0, 소비 슬롯 생성0.
node --use-env-proxy tools/contract-review-runtime-read.mjs --preflight

# 아래 명령은 위 고정 범위의 실제 외부 실행을 승인받은 뒤에만 실행한다.
node --use-env-proxy tools/contract-review-runtime-read.mjs --execute
```

인자 없음·두 모드 동시 지정·임의 옵션은 송신 전 거절한다. 입력 pin이 없거나 변했으면 슬롯 생성/송신 전에 종료한다. 기존 슬롯이 있으면 재실행을 거절한다. `--preflight`는 proxy 연결·endpoint 정상 응답을 검증하지 않는다. 원래 timestamp·기존 실패 원인 UNKNOWN을 보존하며 새 실제 시각은 실행 시 별도 기록한다.

### 수행 과정과 실패 수정

저장 snapshot과 실제 실행 로그·package script를 확인하고 환경변수의 존재 여부만 점검했다. 입력3개 바이트/hash를 로컬 manifest `.state/agent-logs/contract-runtime-preparation-inputs.json`에 보존했다. 고정 분류·가상 오류 시험4건 통과 후, 실제 송신 전에 슬롯을 소비하는 전용4RPC wrapper와 가상 시험4건을 추가했다.

첫 통합 가상 시험은8건 중7성공/1실패였다. GET 예산 초과는 Promise rejection인데 시험에서 동기 예외로 검사해 assertion 실패·unhandledRejection이 발생했다. 시험을 `await assert.rejects`로 수정했고 wrapper의 외부/예산 경계는 완화하지 않았다. 원래 로그 `contract-runtime-preparation-targeted-initial.log`를 보존했다. 후속8건은 전부 통과했다. 실제 외부 송신/재시도0이다.

추가 검토에서 RPC 응답이 겹치면 마지막 이벤트에 분류를 붙일 수 있어 요청 전 이벤트 index를 고정했다. 응답 순서를 뒤집는 회귀1건을 추가했고 최종 대상 시험9건이 통과했다. 전체 check의 첫 실행646건 통과 후 이 마지막 변경까지 포함하는 전체 check를 다시 실행했다.

저장 capture를 새 소유 임시 디렉터리에 복사한 오프라인 통합 검증도 수행했다. 가상 RPC가 저장 공급자 runtime을 반환하는 성공 경로와 가상 DNS 오류 경로 각각에서 최초 callback 전에 소비 marker가 존재함,4회/1회 종료, receipt·private runtime/Markdown 저장,0600 권한, 입력 불변 및 재실행 거절을 확인했다.2항목 PASS이며 가상 블록/응답은 실제 체인 증거가 아니다. 임시 디렉터리는 정리했고 실제 고정 소비 슬롯은 만들지 않았다. 재현 스크립트/결과는 비공개 `.state/agent-logs/contract-runtime-preparation-integration.{mjs,log}`다.
