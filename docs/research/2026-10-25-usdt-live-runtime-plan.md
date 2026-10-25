# USDT 저장 runtime과 신규 고정 해시 코드의 대조 계획

사용자의 후속 진행 승인에 따라 실제 대조의 입력·읽기 범위를 구체화했다. 이 문서는 실행 전 계획이다. 새 RPC·컴파일·다운로드·실제 배포 대조는 수행하지 않았다. 앞서 제시한 후보 중 실제 USDT 배포 대조 계획을 선택했다. 외부 실행은 아래 고정 범위에 대한 사용자 확인 후 진행한다.

## 입력

- chainId `1`, 대상 주소 `0xdAC17F958D2ee523a2206206994597C13D831ec7` 하나. 이는 [기존 저장 입력](2026-10-25-usdt-offline-recompile.md)의 식별자이며 이번에 공식 주소 목록을 새로 확인한 결과가 아니다. 계획은 이 명시 주소의 코드 관측으로 한정한다.
- 저장 artifact `.state/usdt-offline-recompile-20261025/output/artifacts/source-0.compile-result.json`, SHA256 `ed20b9809cddd888d90bf0a8dfb8d33a3fca03dd8ba476c83a72de3fa51efdc9`, 2381870바이트. 원래 보고서의 artifact 목록과 원본 바이트를 실행 전후 검증한다.
- 저장 compiler 전체 버전 `0.4.18+commit.9cf6e910.Emscripten.clang`, `TetherToken.sol:TetherToken`의 deployedBytecode. 생성 runtime 11075바이트, Keccak `0xc60427dda11e864272d53e4327226c4f1b67b81e36124a73e23f197649a8cc27`.
- [ADR0098](../adr/0098-legacy-runtime-omitted-immutable-ranges.md)의 비교기로 저장 결과만 비교한다. `immutableReferences` 필드 부재와 빈 `linkReferences`를 보존한다. compiler 실행·캐시 취득·설정 보정·metadata 제거·부분 비교는 없다.
- 기존 저장 보고서·보조 보고서·그 입력 hash 목록을 먼저 검사하고 실행 전후 불변을 확인한다. 신규 결과는 별도 연구 schema의 JSON/Markdown으로 보존하며 기존 TokenTechnicalReview를 재작성하지 않는다.

## 제안하는 외부 읽기 한도

기존 workspace `RPC_URL` 한 개만 사용하며 값은 출력·저장하지 않는다. 미설정이면 외부 실행 전에 종료한다. 새 키·endpoint 탐색·사용량/과금 조회는 하지 않는다. 관리형 proxy 설정을 유지한다.

| 순서 | 메서드 | 고정 인자/목적 | 최대 횟수 |
| --- | --- | --- | ---: |
| 1 | `eth_chainId` | `[]`, Ethereum `0x1` 확인 | 1 |
| 2 | `eth_blockNumber` | `[]`, 시작 높이 한 번 확보 | 1 |
| 3 | `eth_getBlockByNumber` | `[확보한 높이, false]`, 동일 높이와 유효 hash 확인 | 1 |
| 4 | `eth_getCode` | `[대상 주소, {blockHash: 확보한 hash, requireCanonical: true}]` | 1 |
| 5 | `eth_chainId` | `[]`, 종료 chainId 재확인 | 1 |
| 6 | `eth_getBlockByNumber` | `[같은 높이, false]`, 종료 높이/hash 재확인 | 1 |

- 단발 최대6 HTTP/RPC·전체120초·각 요청10초·각 응답2MiB/합계8MiB. batch·재시도·추가페이지·redirect·endpoint 전환은0이다. 남은 호출 한도로 재실행하지 않는다.
- 비밀을 포함하지 않는 plan/input hash와 새 전용 root0700·파일0600을 만들고 최초 송신 전에 `wx` 영속 소비 marker를 기록한다. 기존 USDC/JPYC/USDT 소비와 원본은 재사용하지 않는다. 실패도 소비 완료로 남긴다.
- 외부 transport 경계는 기존 `ReviewRpc`의 timeout/크기/응답 검사에 더해 실행 wrapper에서 총6회·위 순서/인자만 허용한다. EIP-1898 거절·체인/높이/hash 불일치·빈 코드·응답 오류·한도 초과 시 즉시 종료한다. 숫자 tag/latest로 대체하지 않는다.
- getter·`eth_call`·storage·프록시/구현체/새 의존성 탐색은0이다. 코드에 업그레이드 경로가 있어도 다른 주소를 따라가지 않으며 실제 dispatch는 미확인으로 남긴다.
- RPC 실패 원문·URL·인증정보는 기록하지 않고 정제된 오류 코드만 남긴다. 원시 코드와 상세 보고서는 로컬 비공개 root에만 둔다. 공개 문서에는 높이/hash·요청수·대조 결과와 제한만 적는다.

## 결과와 검증

외부 실행에 앞서 wrapper의 순서/대상/한도 거절·응답 오류·hash 변경·timeout/크기 제한·동시 소비/재사용 거절을 로컬 가상 transport로 검증하고 외부 송신0을 확인한다. 가상 결과를 실제 관측으로 사용하지 않는다. 제품 코드 변경은 필요하지 않으며 실제 실행 전에 원본 hash와 비교기 코드를 pin하고 실행 후 다시 확인한다. 실제 transport에 관리형 proxy 설정이 적용되는지 비밀 없이 확인한다. 전후 header.number가 요청 높이와 다르거나 종료 chainId/hash 재확인이 실패하면, 코드 hash가 같더라도 전체 관측은 `INCONCLUSIVE`다.

실제 관측을 완료하면 metadata를 포함한 전체 runtime hash를 대조하고, 동일 여부를 해당 주소·시각·고정 블록에만 귀속한다. 전체 일치는 저장 생성 코드와 해당 관측의 일치이며 원본 소스 진위·배포 설정/생성자·현재 전체 배포 binding·실제 dispatch 인증으로 승격하지 않는다. 별도 연구 보고서의 binding은 `UNKNOWN`을 유지한다. 불일치 시 차이를 보존하며 설정 변경·재컴파일·추가 조회로 원인을 자동 추적하지 않는다. 관측 실패는 `INCONCLUSIVE`, 실행 전 상태는 `NOT_TESTED`다.

원래 컴파일 시각·이전 저장 분석 시각과 새 관측/비교 시각을 구분한다. 기존 `INVALID_RELOCATION_DATA`·`PARTIAL`·과거 `MISMATCH`·`UNKNOWN`·제품 PASS/FAIL·SOURCE_REVIEWED는 보존한다. 비용은 `UNKNOWN`이며 새 DB/UI·서명/거래·권한 행사·서비스 지갑 수집·자동 반복은 없다.

계획 문서 변경에도 `npm run check`와 `git diff --check`를 실행한다. 실행 후에는 새 보고서/요청 기록·원본 hash 불변·권한·소비 완료를 검증하고 실제 RPC 수와 각 단계 결과를 별도 기록한다.

Lead `92e85a293638425495029c14ea842f01`의 `proceed`는 계획 구체화에 대한 검토이며 외부 실행 승인이 아니다. 위 wrapper 독립 강제·높이/hash 종료 확인·가상 transport 음성 경로·proxy·불변 검증 조건을 반영했다.

계획 준비 시 기존 입력25파일의 SHA256과 compiler artifact의 hash/2381870바이트를 재확인했다(PASS, 외부 호출/컴파일0). `npm run check > .state/agent-logs/usdt-live-runtime-plan-check.log 2>&1`은 rc0·tests551/pass551/fail0/cancelled0/skipped0이다. `git diff --check`는 rc0이다. wrapper 구현/가상 검증·실제 코드 관측/대조는 아직 `NOT_TESTED`다.
