# Multicall3 Infura 고정 블록 runtime 읽기 결과

## 결과와 판정 범위

사용자가 [Infura v3 고정 실행 계획](2026-10-26-multicall3-infura-runtime-plan.md)을 승인해 단발 읽기를 실행했다. 실제4RPC가 모두 HTTP200/유효 JSON-RPC로 정상 반환됐으며 GET0·재시도/endpoint 전환0·수신51033바이트로 종료했다. v3 슬롯은 **소비 완료**다.

Ethereum 블록 **26275729**의 Multicall3 runtime **3808바이트**를 EIP1898 `blockHash / requireCanonical:true`로 읽고 종료 시 같은 높이/hash를 재확인했다. 저장 Sourcify capture의 공급자 onchain/recompiled runtime **두 artifact 모두와 전체 바이트가 일치**했다. 관측은 OBSERVED, 해당 블록의 개별 artifact equality는 PASS다.

PASS는 이 고정 블록의 바이트 대조에만 적용한다. 원본 compiler 독립 재컴파일은 NOT_RUN, 소스 진위는 UNKNOWN, 실제 Proxy/권한은 NOT_TESTED다. 소스에 대한 정적 REVIEW_REQUIRED·사설 개별 시험·기존 토큰 호환성 판정/지원 여부는 변경하지 않았다. 과거 최초 실패 UNKNOWN과 PublicNode v2 TLS_FAILURE/소비는 별도 원본으로 보존한다.

## 수행 경로

1. 전용 Infura CLI의 `--preflight`로 입력4개 pin·기존 `RPC_URL`의 허용 형식·TLS 검증 유지 상태를 확인했다. 새 슬롯 부재도 로컬 확인했다. 이 단계는 외부0이다.
2. `node --use-env-proxy tools/contract-review-infura-runtime-read.mjs --execute`를 정확히1회 실행했다. 기존 RPC_URL을 메모리 안에서 고정하고 새 슬롯/plan/배타적 소비 marker를 최초 송신 전에 만들었다.
3. `eth_chainId` → 최신 블록 header → 동일 hash 기준 `eth_getCode` → 같은 높이의 종료 header를 순차 실행했다. chainId1, 유효하고 비어 있지 않은 runtime, 동일 종료 높이/hash를 확인했다. 추가 주소·Proxy 슬롯·권한·getter·공급자 API는 조회하지 않았다.
4. 저장 공급자 두 runtime과 전체 바이트를 비교하고 실행 후 입력4개/선택 설정 불변을 확인했다. 원래 compiler/설정을 실행하거나 metadata 부분을 제거해 비교하지 않았다.
5. 새 receipt·private runtime·Markdown과 별도 검증 manifest를 보존했다. 로컬에서 runtime keccak256을 다시 계산해 receipt와 일치함을 확인했다. 디렉터리0700/결과0600이며 원문·RPC URL·키·키/URL hash는 Git/웹에 게시하지 않는다. 웹 대시보드는 자동 갱신하지 않았다.

## 관측과 근거

| 항목 | 값 |
| --- | --- |
| Chain/address | Ethereum `1` / `0xca11bde05977b3631167028862be2a173976ca11` |
| 실행 시작/종료(UTC) | `2026-10-26T08:40:38.561Z` / `2026-10-26T08:40:39.755Z` |
| 기준 높이 | `26275729` / `0x190ef91` |
| 기준/종료 block hash | `0x043690036588b1cbf06047d1962f591732a4f984882790c18f6cf94bf068179e` |
| 코드 길이 | `3808`바이트 |
| 관측/공급자 두 runtime keccak256 | `0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891` |
| 두 artifact 전체 바이트 일치 | onchain true / recompiled true |
| 요청·수신 | 시도4/정상4/GET0/51033바이트/재시도0/전환0 |
| 입력/설정 불변 | true |
| receipt SHA256 | `fd6a460ebf88de623186d99eb66f48fc7594e47bf2fcd590f693e4f7b4112e51` |
| private runtime 파일 SHA256 | `a8f4e7477406feae9c67cfcf3f55b0f8fb87ad164da388e4501d4f375e52fc7f` |
| 원본 compiler / 소스 진위 | NOT_RUN / UNKNOWN |
| Proxy/권한 / 비용 | NOT_TESTED / UNKNOWN |

위 시각은 실행 시간이며 header timestamp를 대신하지 않는다. 동일 hash 종료 확인은 선택 endpoint에서의 관측이며 독립 합의/모든 노드에 대한 증명이 아니다. Infura의 다른 API 권한·계정 전체 비용 한도/청구 내역은 조회하지 않았다. PublicNode 실패의 정확한 인증서 원인도 이번 성공만으로 확정하지 않는다. OS CA/전역 설정·인증을 바꾸거나 TLS 검증을 비활성화하지 않았다.

## 보존 자료와 오프라인 재현

비공개 슬롯 `.state/contract-review-multicall3-infura-runtime-once-20261026-v3/`의 `plan.json`, `consumed.json`, `receipt.json`, `runtime.private.json`, `result.md`, `verification.private.json`에 보존했다. 실행 로그는 `.state/agent-logs/contract-runtime-infura-live-v3.log`다. 원본 파일은 저장소/웹에 게시하지 않는다.

오프라인 재확인은 private runtime의 keccak256/길이와 저장 capture 두 runtime의 전체 바이트를 비교하고 receipt/manifest의 hash·입력 불변을 검사한다. 이 검사에 새 RPC·소스 취득·compiler가 필요하지 않다. `--execute`를 재호출하거나 새 슬롯을 자동 만들어 실제 조회를 재현하지 않는다. 새 관측이 필요하면 새 대상/endpoint/한도/소비 계획을 별도 승인받는다.

원본 보고서/실패·운영 DB·Collector·FX·기존 웹 요약/production 배포·토큰 판정 변경0이다. 새 CLI 결과를 자동 게시하지 않았으며 공유한 것은 이 검토된 연구 요약뿐이다.

## 검증과 인계

- 실제 전용 CLI `--execute`: rc0, OBSERVED/개별 artifact comparison PASS, 실제4RPC/정상4/GET0/51033바이트. 실행은 위1회만 수행했다.
- 실행 전 `--preflight`: rc0, inputPins4/RPC0/GET0 및 슬롯 없음 확인.
- `node .state/agent-logs/contract-runtime-infura-live-v3-offline-verify.mjs`: rc0, 저장 자료26항목/pass26/fail0/추가 externalRPC0. `.state/agent-logs/contract-runtime-infura-live-v3-offline-verify.log`에 보존했다. 두 artifact 전체 바이트·runtime hash/길이·입력 pin·기존 v2/새 v3 파일 hash·권한·소비 marker·실제 요청 순서/수신량을 확인했다.
- `npm run check > .state/agent-logs/contract-runtime-infura-live-v3-check.log 2>&1`: rc0, tests650/pass650/fail0/cancelled0/skipped0.
- `git diff --check`: rc0. 이전 실패 자료 hash 불변, 실제 실행 원문/환경 파일은 commit 대상에서 제외한다.
- [최종 인계문](../handoff/2026-10-26-contract-runtime-read-v3-infura-result.md). 현재 단발 읽기/대조는 완료됐으며 새 외부 실행 승인은 남아 있지 않다.
