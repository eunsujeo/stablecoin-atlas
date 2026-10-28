# Arkham 전체 등록 범위 메타데이터 단발 실행 결과

후속: 아래13후보도 추가 승인 후 완료·소비했다. [실제13GET 결과](2026-10-28-arkham-usage-expansion-result.md)를 따른다. 아래 미승인은 당시 준비 상태 기록이다.

상태: 승인된 4GET 실행 완료·소비. 추가 histogram/DB/UI/Collector/FX/운영 배포는 실행하지 않았다.

## 승인과 실제 소비

사용자는 직전 고정 4GET·기존 키·총8MiB/120초/재시도0·비용 미확인 제시에 “추가 승인할께”라고 응답했다. 승인 원문/문맥/hash는 `.state/usage-discovery-live-20261028/approval.txt`에 비공개 보존했다. 기존 5GET authorization과 현재 키의 hash가 같음을 실행 직전에 검사했고 키/URL/원문은 게시하지 않았다.

고정 계획: `data/arkham-network-usage-discovery-20261028-plan.json`, 파일SHA256 `175d14a1bc2c6324808d3b66116bc247bec6109f7d83ac469258329136c9a011`.

| 요청 | 결과 | 수신 바이트 | 검토 요약 |
| --- | --- | ---: | --- |
| 체인 메타데이터 | HTTP200 | 162 | 목록16개 |
| USDC 주소 메타데이터 | HTTP200 | 450 | chain-address 항목8개 |
| USDT 주소 메타데이터 | HTTP200 | 215 | 항목4개 |
| RLUSD 주소 메타데이터 | HTTP200 | 58 | 항목1개 |
| 합계 | 4GET·정상4 | 885 | 비용 UNKNOWN |

새 슬롯 `.state/allium-executor/arkham-network-usage-discovery-20261028-v1`과 기존 공통 송신 잠금을 사용했다. exclusive 디렉터리와 요청별 intent를 송신 전에 영속 기록했다. `Node --use-env-proxy`로 실행했고 proxy 설정/endpoint/CA를 변경하지 않았다. 응답별2MiB/전체8MiB·120초·요청20초·간격1초·재시도/redirect/추가페이지/전환0이었다. 이전 root 전체 manifest가 실행 전후 같았다. 원문/승인/authorization/receipt는 사설 보존한다. receiptSHA256 `34213f119f4ea3d54ea4095dbbac8649725a0ba84c7a55271b881339d6ace7d2`. 실행은 소비 완료이며 다시 실행하지 않는다.

## 등록33쌍 검토 결과

| 구분 | 조합 수 | 의미 |
| --- | ---: | --- |
| 기존 실제 histogram 저장 | 5 | 앞선35관측/원래 기간을 재사용하며 재수집하지 않음 |
| 추가 histogram 조회 후보 | 13 | 체인이 목록에 있고 기존 저장 검토의 정확한 주소가 있음. 실제 색인/집계는 NOT_TESTED |
| 이번 체인 목록 미등재 | 13 | 조회 가능한 chain key 미확보. API 전체 지원 불가로 단정하지 않음 |
| 체인은 등재·저장 정확 주소 미확보 | 2 | RLUSD Base/Optimism. 주소/토큰ID 추측 안 함 |

추가 후보13: USDT BSC/Arbitrum/Polygon3, USDC Base/Arbitrum/Polygon/BSC/Avalanche5, RLUSD Ethereum1, JPYC Ethereum/Polygon/Avalanche3, JPYSC Ethereum1.

미등재13: USDT Plasma/TON/Aptos/Mantle4, USDC Hyperliquid L1/Arc/Stellar/XRPL4, RLUSD XRPL/Ink/Unichain/XRPL EVM4, JPYC Kaia1. HyperEVM/HyperCore를 Hyperliquid L1로, XRPL EVM을 XRPL로 바꾸지 않는다. `arbitrum_one`은 등록 Arbitrum의 명시 별칭으로 사용한다.

주소 metadata와 기존 후보 주소가 같은 추가 후보는5개, 해당 token metadata에 없는 후보는8개다. 후자도 체인+명시 주소로 조회할 후보일 뿐 색인/발행사 지원 인증이 아니다. 토큰 metadata 부재를 0/지원 불가로 만들거나 다른 주소로 바꾸지 않는다. 저장 소스 검토 당시 주소/브리지·토큰 참조 범위·기존 판정을 유지한다. 금액·전송 건수·지갑 수·결제량은 이번 metadata로 새로 관측하지 않았다.

등록33 밖의 provider 메타데이터 항목(예: USDC의 HyperEVM/Optimism, USDT Avalanche)은 자동으로 등록/수집하지 않는다. 기존33쌍 범위와 구분한다.

## 다음 고정 승인안 — 아직 실행하지 않음

`data/arkham-network-usage-expansion-20261028-plan.json`에 기존 검토 주소13개, 정확한 chain/token 인자, 등록/소스 파일hash와 이번 discovery receipt hash를 고정했다. 파일SHA256 `2914dcf96dc7f28c2abd6b8704498c6fae3925cbe8a0a6234c0eebf490934031`.

같은 2026-10-21~27 기간의 GET /transfers/histogram 13건, base=all·granularity=1d·고정 chain/token, 최대13GET/0run/응답2MiB/총26MiB/300초/요청20초/간격1초·재시도/redirect/페이지/전환0·첫 실패 종료·비용UNKNOWN이다. 새 expansion 슬롯/기존 공통lock을 사용하고 기존5쌍은 제외한다. 자동 수집이나 기존 소비 재사용이 아니다. 실행 도구/확장 입력 검증은 승인 후 해당 고정 목록에 맞춰 구현한다. 실제 histogram 및 DB/Supabase 형식 확장·입력은 이번4GET 승인에 포함하지 않는다.

## 구현·실패·검증과 재현

`tools/arkham-usage-discovery.mjs`는 정확한 계획 파일hash만 받아들이며 기존 archive manifest만 export해 재사용한다. 4회/8MiB/120초와 송신 전 intent·partial body 보존·즉시 실패 종료를 강제한다. getReader와 strict UTF-8/중복키 거절을 사용하고 숫자 lexeme을 금액 Number로 변환하지 않는다.

검토에서 strict parser의 Numeric 루트를 객체로 오인하는 결함을 발견해 배열/실제 JSON object만 허용하도록 수정했다. `123`/문자열/boolean/null 루트 거절을 회귀에 추가했다. transport 실패에는 body 파일이 없는데 테스트가 이를 읽던 오류도 수정했다. 실제 실행 실패는 없었고 두 초기 오프라인 실패 로그는 사설 보존했다.

- 관련 회귀: `node --use-env-proxy --import tsx --test tests/arkham-usage-discovery.test.mjs tests/network-usage.test.mjs` → 25pass/0fail.
- 전체: `npm run check` → 일반658 + net차단74 = 총732pass/0fail.
- 잘못된 plan/승인, 공통 lock, deadline, 403/429/redirect/timeout/partial/oversize/UTF-8/JSON/중복키/proxy 오류, 첫 실패 후 후속 송신0, 소비 재사용 거절, 원본 보존을 가상 응답으로 검증했다.
- Lead491a2f0184f44a668e5c8c186df7f1e7의 수정 요구를 반영했고 a921f8ac6dc341c8918939e0a15d817a는 proceed 및 discovery13회귀 통과를 확인했다. 이는 사용자 승인 대체가 아니다.

사설 재현 경로: `.state/usage-discovery-live-20261028`의 approval/collect/review 스크립트와 검증 로그, 위 소비 슬롯의 원문/receipt. collect 스크립트는 소비 완료이므로 다시 실행하지 않는다. 오프라인 review만 원본hash를 대조해 등록 목록과 다음 계획을 재현할 수 있다. 기존 Allium 수집 종료·원문/DB·기존 snapshot과 operating Mac mini는 변경하지 않았다.

후속 계획 오프라인 일관성 대조도 통과했다. 등록33쌍·고유13조회·기존5제외, 소스4파일pin/실제 discovery receipt hash, 각 저장 주소/기간/endpoint가 일치했다. 이 대조의 HTTP/DB 접근은0이다.
