# Contract Intelligence & Security Review

범용 EVM 컨트랙트의 수집·관측·정적 분석을 기존 자산 호환성/토큰 검토와 분리한 CLI다. Ethereum/Base 공개 RPC 선택 또는 명시 RPC_URL을 지원한다. 토큰 외 Vault/Router/Bridge/Batch/Sweep도 동일한 소스/ABI/함수/호출/권한 조건 분석 경로를 사용하지만 각 프로토콜의 경제적 불변식이나 목적을 자동 증명하지 않는다. 운영 Atlas 웹·Collector·FX·DB와 연결하지 않는다. [ADR0111](adr/0111-contract-intelligence-review.md).

## 실행

Node24.5 이상과 기존 npm 의존성을 사용한다. 네트워크 호출은 수동 CLI 실행에서만 발생한다. `--public-rpc`가 없으면 셸 또는 기존 `.env.local`의 RPC_URL을 사용한다. URL/키를 명령 인자로 받거나 로그에 출력하지 않는다. RPC 요금/계정 한도는 보장하지 않는다. 기존 출력 디렉터리는 재사용할 수 없다.

```sh
npm run review:contract -- --help
# 명시 공개 endpoint 선택. Ethereum 예시; Base는 chain-id 8453.
npm run review:contract -- --chain-id 1 \
  --address 0xca11bde05977b3631167028862be2a173976ca11 \
  --public-rpc --out .state/my-contract-review

# Etherscan V2: ETHERSCAN_API_KEY는 현재 셸에 별도로 설정한 상태.
# .env.local의 기존 허용 변수 목록은 변경하지 않는다.
npm run review:contract -- --chain-id 8453 --address 0xYOUR_ADDRESS \
  --provider etherscan --out .state/my-base-review

# 저장 snapshot 재분석: 네트워크 호출0, 원래 관측과 새 분석 시각 분리.
npm run review:contract -- \
  --offline-snapshot .state/my-contract-review/snapshot.private.json \
  --out .state/my-offline-review

# 별도 loopback 보고서 대시보드. 웹 요청은 분석/수집을 실행하지 않는다.
npm run review:contract:ui -- --dir .state/my-contract-review
```

기본 공급자는 Sourcify다. Etherscan은 `--provider etherscan`으로 명시하며 소스 미등록/API 거절/잘못된 응답을 다른 공급자로 자동 전환하지 않는다. Sourcify의 다중 inline source, ABI, compiler metadata/settings와 Etherscan의 단일 소스·standard JSON·이중 중괄호 JSON을 처리한다. URL-only 소스와 위험한 경로는 거절하며 metadata/import URL을 내려받지 않는다. Etherscan의 다중 파일에서 파일 선택이 없으면 AST에서 동일 이름의 유일한 contract만 선택하고 모호하면 UNKNOWN이다. `SimilarMatch`는 원래 배포 검증으로 취급하지 않는다.

## 출력과 판정

새 실행 디렉터리에 `plan.json`, `snapshot.private.json`, `review.json`, `review.md`, `index.html`을 만든다. snapshot에는 원문 소스/metadata/ABI/runtime와 소스 응답 capture가 들어가므로 Git/웹에 게시하지 않는다. 공개할 자료는 검토한 발췌/요약만 사용한다. 대시보드 서버는 HTML 한 개만 제공하고 snapshot/원본/임의 경로·쓰기 메서드·다른 Host/Origin을 거절한다. HTML의 외부 네트워크 연결은 CSP로 차단한다.

보고서는 Contract Overview, Source Verification, Contract Architecture / Proxy, Function Inventory, Call Flow, Asset Flow, Access Control, Security Findings, Usage Risks, Recommended Usage, Evidence & References의11항목이다. Finding마다 위험도·함수·파일/줄/UTF-8 offset·근거·검토 상태를 넣는다.

| 상태 | 의미 |
| --- | --- |
| PASS | 특정 equality 검사 성공. 전체 컨트랙트 안전 판정에 사용하지 않는다. |
| REVIEW_REQUIRED | 관측된 코드 패턴/사용 조건 검토 필요. 실제 악용 가능한 취약점으로 확정하지 않는다. |
| FAIL | 확보 자료의 명시 runtime/metadata source hash 불일치. 자산 손실/권한 실패와 동일한 뜻이 아니다. |
| UNKNOWN | 소스/기준 블록/실행/검증 근거 부족. 자동 PASS 금지. |

Source Verification은 공급자의 검증 주장, 공급자 metadata와 source content의 hash 비교, 고정 블록 RPC runtime과 공급자 onchain/recompiled artifact의 정확 바이트 비교를 각각 기록한다. 공급자 두 artifact끼리 같은 것은 새 RPC 검증이 아니다. 원래 compiler를 사용한 독립 재컴파일은 첫 버전에서 NOT_RUN이다. 바이트 비교가 실패해도 metadata/immutable/library 차이를 제거해 임의로 PASS로 만들지 않는다.

## 분석과 격리 한계

원래 소스는 보존한다. 별도 분석 사본에서 pragma를 UTF-8 offset을 유지하며 공백으로 바꾸고 설치 solc0.8.37로 AST를 생성한다. 그 결과는 선언·상속·함수/수식/호출 관계의 보조 근거다. 원래 버전의 코드 생성/실행 동등성 증명이 아니다. 구버전 문법/불완전 import/remapping/semantic 차이로 compile이 실패하면 UNKNOWN이다. ABI 또는 source에서 유일한 선택 contract를 찾지 못한 경우도 분석 완료로 표시하지 않는다.

worker는 별도 프로세스, 제한된 환경, 메모리256MiB/20초/출력8MiB이며 import callback·외부 빌드/스크립트·임의 compiler·다운로드가 없다. 이는 악성 compiler 결함까지 막는 OS sandbox가 아니다. 외부 코드를 실행/설치하는 Slither 자동 runner는 구현하지 않았다. 설치 확인 결과 현재 Slither가 없으며 NOT_RUN/UNKNOWN이다. solc AST와 명시 규칙을 사용하고 AI/LLM API는 호출하지 않는다.

함수 목록은 선택 contract와 linearized bases를 포함하며 public/external/internal/constructor를 구분한다. modifier/require/assert/if·msg.sender/msg.value/tx.origin·직접 상태 쓰기와 내부 호출, 주소의 CALL/DELEGATECALL/STATICCALL/send/transfer, typed external call 및 일부 Yul opcode를 위치와 함께 추출한다. 토큰·자산 흐름은 후보이며 임의 calldata의 완전한 의미, modifier 이후 실제 권한, 동적 dispatch/재진입 경로, 외부 표적의 구현은 자동 증명하지 않는다. 소스 없는 runtime은 PUSH 데이터와 구분한 opcode/PUSH4 후보만 제공하며 도달 가능성/실제 selector라고 단정하지 않는다.

Proxy는 EIP1967 implementation/admin/beacon 슬롯·Beacon implementation()·정확한 EIP1167 runtime·직접 구현의 proxiableUUID() 신호를 관측한다. 동일 blockHash/requireCanonical이 미지원이면 UNKNOWN이며 높이로 fallback하지 않는다. Beacon/slot/UUID 실패를 미지원 기능으로 단정하지 않는다. custom proxy/diamond와 실제 upgrade 권한·역할 구성·Multisig/Timelock 설정은 미확인이다.

## Multicall3 재현

기존 로컬 웹 대시보드의 **컨트랙트 분석** 메뉴에서도 검토된 저장 요약을 읽을 수 있다. `npm run ui` 후 `http://127.0.0.1:4173/#contracts`로 연다(`-- --port 0`은 임시 포트). 기존 다크/라이트 테마와 메뉴를 공유한다. 함수·흐름·권한·위험·사용 조건·근거를 표시하며 웹 요청은 CLI/외부 조회를 실행하지 않는다. 원문 보고서/snapshot 대신 연구 기록의 수동 발췌를 제공하므로 새 CLI 출력이 자동으로 목록에 추가되지는 않는다. 새 요약은 검토 후 `web/contract-review-data.js`에 추가한다. 이 메뉴와 전용 자료는 production에서 제외한다. [ADR0112](adr/0112-contract-review-dashboard.md).

[첫 실제 수집·실패·소스 검토·사설 검증](research/2026-10-26-contract-review-multicall3.md). 검토한 source SHA256이 선택된 Multicall3 소스와 일치할 때만 구체 usage profile을 적용한다. 이름/주소가 같다는 이유로 적용하지 않는다.

```sh
# 저장된 최초 Sourcify capture 필요. 추가 외부 호출0.
npm run review:contract:validate -- \
  --capture .state/contract-review-sourcify-initial.json \
  --out .state/unique-multicall3-validation

# 검증 기록을 source hash와 묶어 새 보고서에 동봉한다.
npm run review:contract -- \
  --offline-snapshot .state/contract-review-multicall3-live-20261026/snapshot.private.json \
  --experiments .state/unique-multicall3-validation/experiments.json \
  --out .state/unique-multicall3-report
```

검증기는 고정 source digest만 허용하며 프로그램이 생성한 새 loopback Anvil에서 실행한다. 실제 소스의 pragma를 제거한 별도 설치 compiler 빌드와 관측용 fixture를 사용한다. CALL/delegated 문맥·state/event·부분 실패·가치 불일치 rollback·잔여 ETH·폐기 계정의 Approval 오용을 검증한다. 원래 compiler/실제 배포 bytecode와 동등하지 않으며 실제 체인 거래는 없다. 동봉 실험 JSON은 로컬 기록이지 인증된 제3자 증명이 아니다. unchecked total 공격 실행은 하지 않는다.

## 다음 개발 단위

사용자 승인 후 [Infura v3 실제 읽기](research/2026-10-26-multicall3-infura-runtime-result.md)를 완료했다. 블록26275729의 runtime3808바이트와 저장 공급자 두 artifact가 전체 바이트 일치했고, 실제4RPC/GET0·재시도/전환0에서 소비 완료했다. `node --use-env-proxy tools/contract-review-infura-runtime-read.mjs --preflight`는 기존 `RPC_URL`의 허용 형식과 입력4개 pin만 확인하며, 성공해도 소비한 `--execute`를 다시 실행할 수 없다. 기존 PublicNode v2 원본/실패는 보존한다.

Multicall3의 [새 runtime 단발 읽기 계획](research/2026-10-26-multicall3-runtime-read-plan.md)은 사용자 승인 후 첫 eth_chainId에서 TLS_FAILURE로 종료해 [소비 완료](research/2026-10-26-multicall3-runtime-read-result.md)했다. 실제 배포 코드 읽기는 NOT_TESTED다. `node --use-env-proxy tools/contract-review-runtime-read.mjs --preflight`는 저장 입력만 확인하며 성공해도 이미 소비한 `--execute`를 다시 실행할 수 없다. 기존 첫 실패 원인 UNKNOWN은 보존한다. 새 외부 실행은 새 고정 계획 승인 후에만 진행하고 TLS 검증을 끄거나 다른 endpoint로 자동 전환하지 않는다.

고정 블록 runtime과 저장 공급자 artifact의 대응은 확인했다. 후속 원본 버전 compiler pin/독립 재컴파일, 네트워크 없는 Slither runner, custom Proxy 및 protocol별 권한/자산 불변식 확장은 별도 승인/환경에서 진행한다. 실제 Proxy/권한·소스 진위·안전성 보장은 이번 바이트 일치에 포함하지 않는다. 새 외부 읽기도 정확한 endpoint/한도의 새 계획 승인 전 시작하지 않는다. 소스 자동 수집을 운영 서비스/스케줄러에 연결하지 않는다.

## Supabase 요약 저장 (ADR0113)

사용자가 기존 Supabase 반영까지 승인했다. 별도 private `atlas_contract_review`에 검토된 요약만 불변 저장하며 최초 실패와 v3 고정 블록 결과를 별도 보고서로 보존한다. [저장/권한/적용 경계](adr/0113-contract-review-supabase-summary.md)를 따른다.

`npm run review:contract:db -- init|grant|import|read|boundary`가 명시 관리/저장/읽기 CLI다. `grant`는 `--role 이름 --mode reader|writer`, `import`는 `--source 검토파일 --expected-sha256 파일SHA256`, 모든 명령은 `--env-file 비공개설정`을 받는다. 외부 노출 definer가 있으면 `--reviewed-definers 비공개검토파일 --reviewed-sha256 검토파일SHA256`의 기존 고정 검토가 필요하다. init/grant는 admin, import는 writer, read는 reader 설정으로 실행한다. 새 키/접속 URI를 인자로 전달하지 않는다.

입력은 `web/contract-review-reviewed.js`의 `reviewedContractStore`를 명시 JSON으로 내보내 작성한다. 자동 보고서 탐색/원문 변환은 없다. 로컬 웹 DB 모드는 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`이며 DB 오류에 정적 fallback하지 않는다. production의 컨트랙트 UI/API 제외는 유지한다.

실제 Supabase 적용은 요약2건 입력·동일 입력0건 추가·reader 일치·API 경계·기존8스키마 구조 보존까지 완료했다. [실행/실패 수정/검증/재현 기록](research/2026-10-26-contract-review-supabase.md)·[인계문](handoff/2026-10-26-contract-review-supabase.md).

후속 사용자 정정으로 컨트랙트 화면은 주소/chain별 최신 결과 한 건만 표시한다. 저장 소스 조건 검토·사설 시험의 완료와 저장 코드 대조를 구분하며, 원본 자료의 UNKNOWN 등은 근거/검토 범위에 보존한다. 이전 이력을 별도 카드나 이력 선택으로 제공하지 않는다.

컨트랙트 요약 DB 읽기는 로딩바/스켈레톤을 표시하며 서버의 성공 응답을 1시간 캐시한다. 만료 시 다음 요청에서 재조회하고 오류는 명시적으로 표시한다. 즉시 최신 저장 요약을 읽으려면 로컬 미리보기를 재시작한다. 브라우저와 HTTP 응답은 no-store를 유지한다.
