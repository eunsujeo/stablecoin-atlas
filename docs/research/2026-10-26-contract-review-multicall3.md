# Contract Review 최초 구현과 Multicall3 검증

## 결과와 범위

2026-10-26 사용자 요청과 [ADR0111](../adr/0111-contract-intelligence-review.md)에 따라 독립 범용 EVM 검토 CLI·소스/ABI 자동 취득·표준 Proxy 후보 관측·AST 기반 함수/호출/자산/권한 조건·보안 패턴/사용 위험·별도 로컬 보고서 대시보드를 구현했다. 실행법·판정 경계는 [사용 문서](../CONTRACT_REVIEW.md)를 따른다. 기존 토큰 검토/호환성 판정과 Atlas 운영 웹·Collector·FX·DB는 변경하지 않았다. 외부 거래/서명·운영 Mac mini/Supabase 접근0이다.

Multicall3 실제 소스를 확보해16함수를 분석했고, 그 소스의 별도 로컬 빌드로 사설 검증10항목을 통과했다. 첫 공개 RPC는 응답을 받지 못해 **실제 기준 블록/온체인 runtime 연결·Proxy 관측은 UNKNOWN**이다. 전체 보고서는 UNKNOWN, 소스 정적 분석은 REVIEW_REQUIRED, 사설 개별 시험은 PASS다. 소스 제공자의 검증 주장과 이 세 상태를 합치지 않는다.

## 수행 경로와 자료

1. 기존 `src/token-review`, `src/lab/anvil.ts`, 웹의 운영 경계를 확인하고 독립 `src/contract-review`와 package scripts를 추가했다. Local Router는 shadow 추천이며 모델 변경/토큰 절감을 주장하지 않는다. 보안 설계 검토 Lead `e8e063d18e884f57be1c56e7239cec0d`의 proceed 조건을 반영했다. 구현 위임/추가 agent 생성0이다.
2. 공식 [Sourcify API](https://docs.sourcify.dev/docs/api/), [Etherscan V2](https://docs.etherscan.io/api-reference/endpoint/getsourcecode), [EIP1967](https://eips.ethereum.org/EIPS/eip-1967), [Multicall3 upstream](https://github.com/mds1/multicall3)을 확인했다. API로 소스/ABI/metadata를 얻었고 HTML 수동 다운로드는 하지 않았다.
3. Ethereum chainId1, `0xca11bde05977b3631167028862be2a173976ca11`에 Sourcify GET1, HTTP200/124087바이트. 원본은 `.state/contract-review-sourcify-initial.json`에0600으로 보존했다. 초기 수동 탐색은 응답을 모두 받은 뒤 크기를 검사한 한계가 있고, 제품 transport는 스트리밍 상한으로 개선했다. JSON의 소스 URL은 추적하지 않았다.
4. 최초 capture를 재사용해 새 실행 디렉터리에서 `--public-rpc` 읽기를 진행했다. 실제 RPC1시도/정상 반환0/수신0바이트/추가 GET0. PIN 단계 READ_OR_VALIDATION_FAILED로 종료했고 endpoint/재시도0이다. 원래 관측 시각 `2026-10-26T00:33:22.564Z`는 실패 시도 시각이며 블록 관측 시각이 아니다. 공급자 자료의 관측시각으로 소급하지 않는다. 네트워크 연결의 구체 원인은 확인되지 않았으므로 endpoint 장애/권한 거절로 단정하지 않는다.
5. 설치 compiler0.8.37로 별도 pragma 공백화 AST를 생성했다. 원본 compiler0.8.12를 실행/다운로드하지 않았다. 원래 소스/metadata hash와16함수·4 CALL/2 internal call을 확보했다. storage 변수·modifier·직접 DELEGATECALL은 이 선택 소스에 없지만 실제 체인의 권한/dispatch 부재로 승격하지 않는다.
6. 새 소유 loopback Anvil에서 실제 source digest의 pragma 제거 사본을 설치 compiler로 빌드해10항목을 검증했다. 각 실행의 폐기 계정과 소유 프로세스만 사용하고 종료했다. fork/공개 체인 쓰기0이다. 결과는 `.state/contract-review-multicall3-local-validation-20261026/experiments.json`에 보존했다.
7. 저장 snapshot·실험 기록으로 새 JSON/Markdown/HTML을 만들었다. 최신 검토본은 `.state/contract-review-multicall3-reviewed-20261026/`다. 원래 시각과 새 분석 시각을 구분하며 실험 동봉 JSON도 인증된 증명으로 취급하지 않는다. 원본 source/키/RPC URL은 Git/웹에 게시하지 않는다.

### 식별자와 hash

| 항목 | 확보 값/상태 |
| --- | --- |
| Chain/address | Ethereum `1` / `0xca11bde05977b3631167028862be2a173976ca11` |
| 기준 block/hash | UNKNOWN; 첫 PIN 실패 |
| 선택 소스 | `Multicall3.sol:Multicall3`,1파일, ABI16함수 |
| 원본 compiler | 공급자 `0.8.12+commit.f00d7308`; 독립 실행 NOT_RUN |
| AST/사설 compiler | `0.8.37+commit.f401782d.Emscripten.clang` |
| source SHA256 | `2054218939d3fa0f52f8ce1a33658d570a550671f63197356ee5744f7e188b1e` |
| metadata source keccak256 | `0x95dfd0a2dd6626c7119ff7c3f214d56b289145f81a0521cd93a6252a326966f6`; 확보 content와 일치 |
| 공급자 onchain/recompiled runtime keccak256 | 양쪽 `0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891` |
| 공급자 주장 | runtime exact_match; metadata 진위/현행 배포 binding 증명과 별개 |
| 새 RPC runtime hash | UNKNOWN; 공급자 hash로 대체하지 않음 |
| 도구 | ContractReview1.0, Node v25.2.1, Slither NOT_RUN/UNKNOWN, AI NOT_USED |

## 함수와 흐름 검토

줄은 원본 `Multicall3.sol`의 UTF-8 위치다. 원본 자체는 비공개 저장소에 보존한다.

| 함수 | 줄 | 관측한 역할 |
| --- | --- | --- |
| aggregate | 41 | payable; 순차 CALL, 필수 성공 배치 |
| tryAggregate | 60 | payable; CALL, requireSuccess 선택 |
| tryBlockAndAggregate | 79 | payable; tryAggregate 내부 호출·블록 정보 |
| blockAndAggregate | 91 | payable; tryBlockAndAggregate 내부 호출 |
| aggregate3 | 98 | payable; 입력 target/calldata CALL, allowFailure별 실패 처리; value 전달 없음 |
| aggregate3Value | 129 | payable; 호출별 value 전달, 실패 선택, unchecked 합계와 마지막 msg.value 비교 |
| getBlockHash | 165 | view; 요청 블록 hash 조회 |
| getBlockNumber | 170 | view; 현재 블록 번호 |
| getCurrentBlockCoinbase | 175 | view; coinbase |
| getCurrentBlockDifficulty | 180 | view; difficulty 명칭 getter; fork/compiler 차이의 실행 의미는 이번 시험 제외 |
| getCurrentBlockGasLimit | 185 | view; gas limit |
| getCurrentBlockTimestamp | 190 | view; timestamp |
| getEthBalance | 195 | view; 명시 주소 ETH balance |
| getLastBlockHash | 200 | view; 이전 블록 hash |
| getBasefee | 208 | view; basefee |
| getChainId | 213 | view; chain ID |

직접 CALL 경로에서 target의 msg.sender는 Multicall3 실행 주소다. aggregate3의 target msg.value는0이고 aggregate3Value는 호출별 값을 전달한다. 외부 wallet이 Multicall3 코드를 DELEGATECALL하면 그 코드의 address/balance/storage 문맥은 wallet이며, 후속 CALL의 target은 wallet을 sender로 본다. Multicall3 자체가 DELEGATECALL한다는 의미가 아니다. 해당 소스에 직접 storage 쓰기는 없으며, 별도 synthetic context code로 delegatecall의 storage/sender/value 보존을 대조했다.

### 주요 검토 항목

| Finding/위험도 | 함수·위치 | 근거와 상태 |
| --- | --- | --- |
| Approval 오용 HIGH | aggregate3:98, aggregate3Value:129 | 임의 token calldata가 executor의 spender 문맥으로 실행됨. 폐기 token/계정의 승인 후 다른 계정이 그 allowance를 사용하는 상태/Transfer event를 사설에서 재현. USAGE_RISK/REVIEW_REQUIRED; 실제 피해/운영 allowance 미조회 |
| payable 잔여 ETH MEDIUM | aggregate3:98 | msg.value를 target으로 보내거나 refund하지 않는 경로. 사설7wei 잔존 재현. USAGE_RISK/REVIEW_REQUIRED |
| 허용 실패 value 잔존 MEDIUM | aggregate3Value:129 | 실패 CALL의 value는 이전되지 않지만 batch는 성공 가능. 사설 추가5wei 잔존/성공 호출2wei 전달 재현. USAGE_RISK/REVIEW_REQUIRED |
| unchecked 합계 HIGH | aggregate3Value:129 | unchecked 덧셈과 마지막 합계 비교의 소스 조건. 일반적인 일치/불일치 rollback만 검증; wrapped-total 공격 실행/완전한 가치 보존 증명은 NOT_TESTED. CODE_PATTERN/REVIEW_REQUIRED |
| delegated 통합 문맥 HIGH | 외부 wallet → aggregate3Value:129 | wallet balance/주소 문맥에서 호출됨. wallet→target sender/value와 별도 storage 대조 시험 통과. wallet 접근 통제/대상 정책은 별도 검토 대상 |
| 조회 배치의 상태 의미 MEDIUM | aggregate3:98 | CALL이므로 앞선 하위 호출이 뒤 결과에 영향을 줄 수 있음. eth_call 내 변경과 실행 후 비영속을 사설 재현. STATICCALL 강제가 아님 |

위험한 코드 패턴/사용 오용과 permissionless executor의 의도된 기능을 구분한다. 현재11개 일반 규칙 finding과4개 digest 기반 finding은 중복될 수 있으며15개 독립 취약점을 발견했다는 뜻이 아니다. 프로필/권한/상환/자산 안전성 인증도 아니다.

권장 사용 조건은 고정 블록·조회 calldata/대상 allowlist·value0·성공 flag 전수 확인, 상태 변경 시 caller/수취인/값/실패 정책 검토, 공개 executor에 대한 ERC20 spender 승인 금지, 잔여 ETH 비보관이다. Delegatecall 통합에는 외부 wallet의 실제 권한과 호출 정책 검토가 추가로 필요하다. [Upstream](https://github.com/mds1/multicall3)의 과거 deployer 침해/Ancient8 예외 안내는 체인별 코드 확인의 필요성을 뒷받침하지만 이번 Ethereum 배포의 진위를 대신 증명하지 않는다.

## 실패·수정과 검증

- 초기 설치 compiler 탐색용 일회 Node 명령에 괄호 오타가 있어 SyntaxError가 났다. 명령을 수정해 정확한0.8.12 pragma는 설치 compiler에서 거절된다는 것을 확인했고, 원본 검증과 별도 AST 사본을 분리했다.
- 최초 제품 회귀12시험 중11성공/1실패: Node fetch가 Host 헤더를 대체해 서버가 정상 Host로 받았다. 테스트를 실제 node:http 요청으로 수정해 잘못된 Host403을 확인했다. 서버 허용 경계는 완화하지 않았다.
- HTML 브라우저 검증 첫 실행은 평가 스크립트의 전역 `const q`가 페이지 변수와 충돌했다. 검증 코드만 IIFE로 격리했고 화면 스크립트를 수정하지 않았다. 최초 실패 로그도 보존했다.
- 실제 RPC 실패는 재실행/다른 endpoint로 숨기지 않았다. 소스 확보와 블록 확보 실패를 분리했고, 사이트의 소스 부재로 단정하지 않았다.
- 최종 제품 추가 시험은14개다. source identity/다중파일/metadata hash/경로/URL-only·AST/상속/guard/Unicode·worker 종료·GET/RPC/시간/바이트 한도·Beacon/UUPS/minimal/cycle/depth·동일 hash/reorg·부분 실패/비밀 제거·HTML 격리/Host/Origin/메서드 경계와 사설 상태/반환/event/오류 경로를 검증했다.
- 실제 source 로컬 validator: rc0,10항목 PASS/FAIL0. `.state/agent-logs/contract-review-real-source-validation.log`.
- `node --use-env-proxy --import tsx --test tests/contract-review*.test.mjs`: rc0, tests14/pass14/fail0/cancelled0/skipped0. `.state/agent-logs/contract-review-targeted-complete.log`.
- `npm run check`: rc0, tests636/pass636/fail0/cancelled0/skipped0. `.state/agent-logs/contract-review-check-final.log`. 마지막 opcode 후보256개 상한 보완 후 추가 단독 시험도 rc0, tests14/pass14/fail0/cancelled0/skipped0 (`contract-review-targeted-last.log`). 최종 게시 전 동일 전체 check를 한 번 더 수행하며 `contract-review-check-release.log`에 보존한다.
- `npm run check:production`: rc0, tests23/pass23/fail0/cancelled0/skipped0. `.state/agent-logs/contract-review-production.log`.
- 실제 Chrome 별도 임시 profile/loopback 렌더링: rc0,11section·검색 필터·390px 수평 overflow없음·Runtime error0·외부 페이지 요청0. `.state/agent-logs/contract-review-browser-final.log` 및 browser.json, `.state/contract-review-{desktop,mobile}.png`. 단순 정적 HTML200만 확인한 결과와 구분한다. 생성된 개인 profile과 소유 browser/server는 정리했다.
- `git diff --check`: rc0. 실제 자료/원문/환경/기존 untracked 인계문은 commit 제외한다.

## 남은 것과 재현 경로

실제 runtime/기준 블록/표준 Proxy 연결, 원래0.8.12 compiler 독립 재컴파일, Slither runner, 외부 target/동적 권한·Multisig/Timelock 구성·custom Proxy·재진입 경로/프로토콜 불변식은 미완료다. 사설 빌드는 원래 배포 재현이 아니다. Slither 설치가 없음을 확인했고 자동 설치/외부 build를 하지 않았다.

기본 재현은 `npm run check`, `npm run check:production`, [CLI/저장 capture/사설 validator/보고서 UI 명령](../CONTRACT_REVIEW.md)이다. 저장된 실제 capture 없이는 synthetic fixture14시험만 독립 재현할 수 있다. 원래 실제 source를 새로 취득하는 실행과 실패한 RPC 소비는 재사용하지 않으며, 후속 외부 실행은 대상/endpoint/한도가 확인된 새 계획으로 진행한다. commit/push는 운영 배포가 아니다.
