# 공급량 상위 네트워크 소스 검토 확대: 대상 선정과 취득 계획

## 사용자 기준과 완료 범위

사용자는 USDC/USDT/RLUSD의 최상위10개 네트워크를 검토하자고 요청하고 공급량 기준이라고 확정했다. 자산별 최대10개로 진행한다. 기존 2026-10-22 저장 상세 응답의 **네트워크별 유통공급량 token 수량**을 기준으로 대상을 재선정했다. 현재 실시간 순위나 모든 실제 네트워크를 완전히 수집한 결과는 아니다. 기능 검토22곳이 새로 완료됐다고 표시하지 않는다.

기존 [백필 선정](../TOP10_NETWORK_BACKFILL.md)은 catalogue의 공급자 USD 환산 가치 기준이었다. 이번에는 가격·catalogue USD 가치·minted를 사용하지 않고 `chainBalances[network].tokens[2026-10-22].circulating.peggedUSD`만 사용한다. 상세 응답의 해당 수량 단위는 기존 historyProjection 계약의 token이다. 같은 USD peg 자산이라도 목록 값과 토큰 수량을 동일 단위로 처리하지 않았다.

## 오프라인 검산·보존

기존 collector receipt의 coinId/sourceHash/fetchedAt을 읽고 내용 주소 archive3개를 읽었다. CLI는 원본 hash를 재대조하고 숫자 lexeme를 문자열로 보존한 뒤 bigint 고정 소수 비교를 사용했다. 날짜는 각 원문의 동일한 UTC 일자2026-10-22로 고정했다. 원래 요청 시각은 USDT06:00:48.789Z·USDC06:00:51.936Z·RLUSD06:00:54.850Z이며 새 분석일2026-10-25와 구분한다. REQUEST clock은 모든 체인의 같은 블록/같은 순간 관측 인증이 아니다. 함수 자체가 receipt 진위를 인증하는 것은 아니며 이번 실행은 별도 receipt의 자산/hash/시각과 연결했다.

USDC157곳/USDT130곳/RLUSD2곳의 저장 일자 기록을 검사했다. 양수129/105/2곳, 누락·중복·잘못된 수량 제외0곳이며 상위10/10/2를 선정했다. 원문 정밀도를 그대로 보존하며 온체인 최소 단위 정확도를 새로 인증하지 않았다. 0은 보존하지만 양수 상위 목록을 채우는 데 사용하지 않는다. 잘못된 수량/누락일/중복일은 제외 사유와 PARTIAL로 남기며 다른 날짜·minted로 대체하지 않는다.

대상 공개 발췌: [후보 JSON](../../data/source-review-top10-candidates.json). 전체 원문·receipt·접속 정보는 비공개다. 기존 metadata/selection/DB/UI/원본 보고서를 덮어쓰거나 현재 순위로 재해석하지 않았다. 공개 후보 파일은 검토 결과나 활성 등록이 아니다.

## 선정 대상과 소스 검토 경로

공급자 네트워크 집계는 단일 공식 발행 토큰의 공급량이라고 확정하지 않는다. 각 행은 동일 네트워크의 native/bridged/수탁·USDT0 등 구성 토큰을 식별한 후 해당 소스와 연결해야 한다. 지금 있는 소스 검토 기록4곳과 설정 관측만 있는3곳을 구분한다. 소스 근거를 추가로 확보해야 하는 곳은18곳이다.

### USDC — 10곳

| 순서 | 네트워크 | 저장 유통공급량(token) | 검토 경로 |
| ---: | --- | ---: | --- |
| 1 | Ethereum | 44826418472.31008 | 기존 선택 소스 검토 재사용 |
| 2 | Solana | 7059202724.939557 | 기존 mint 설정 관측; SPL Program 조건을 별도 검토 |
| 3 | Hyperliquid L1 | 6980836557.776483 | HyperCore/Arbitrum 연계; HyperEVM 주소로 대체하지 않음 |
| 4 | Base | 4348370169.136732 | Circle 공식 USDC 후보; 새 소스 취득 필요 |
| 5 | Arbitrum | 2247709593.0286517 | Circle native 후보와 USDC.e/집계 구분 |
| 6 | Polygon | 1600516115.0492728 | Circle native 후보와 브리지 집계 구분 |
| 7 | BNB Smart Chain | 1589073372.5328343 | 발행/수탁·브리지별 식별자 대응 필요 |
| 8 | Arc | 705178274.613804 | Circle 공식 시스템 주소 후보; Solidity 계약이라고 가정하지 않음 |
| 9 | Avalanche | 441893331.2751326 | Circle native 후보와 USDC.e/집계 구분 |
| 10 | Stellar | 373751082 | asset code+issuer·프로토콜 설정; EVM 항목 강제하지 않음 |

### USDT — 10곳

| 순서 | 네트워크 | 저장 유통공급량(token) | 검토 경로 |
| ---: | --- | ---: | --- |
| 1 | TRON | 92902602077.31282 | 기존 제공 TVM 소스 조건 검토 재사용 |
| 2 | Ethereum | 72556900577.738 | 기존 local/forward 소스 검토 재사용 |
| 3 | BNB Smart Chain | 9184484406.57563 | 원 USDt/수탁·USDT0 등 토큰별 대응 필요 |
| 4 | Solana | 2724820110.3254876 | 기존 mint 설정 관측; SPL Program 조건을 별도 검토 |
| 5 | Arbitrum | 801910961.124479 | USDT0 문서 token/OFT/Legacy Mesh 구분 |
| 6 | Polygon | 760809959.482028 | USDT0 문서 token/OFT와 기존 경로 구분 |
| 7 | Plasma | 728294003.300373 | USDT0 token/OFT 구분 |
| 8 | TON | 490787894.51 | Jetton master/wallet·관리 조건 별도 검토 |
| 9 | Aptos | 466982690.435735 | Fungible Asset/Move module·권한 구조 별도 검토 |
| 10 | Mantle | 448242336.740975 | USDT0 token/OFT 구분 |

### RLUSD — 2곳

| 순서 | 네트워크 | 저장 유통공급량(token) | 검토 경로 |
| ---: | --- | ---: | --- |
| 1 | Ethereum | 1448674399.0854678 | 기존 선택 소스 검토 재사용 |
| 2 | XRPL | 907257606.8615592 | 기존 issuer 설정 관측; trust-line/프로토콜 조건 별도 검토 |

RLUSD의 Base/Ink/OP Mainnet/Unichain/XRPL EVM Sidechain은 기존 공식 후보지만 이번 공급 원문에 수량이 없어 순위를 부여하지 않는다. 0으로 넣거나 임의로10곳까지 채우지 않는다. XRPL과 XRPL EVM Sidechain, Hyperliquid L1/HyperCore와 HyperEVM을 구분한다.

## 공식 문서 확인과 취득 실패

공개 [Circle 주소표](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Tether 지원 프로토콜](https://tether.to/en/supported-protocols/), [USDT0 배포 문서](https://docs.usdt0.to/technical-documentation/deployments)를 확인했다. Circle 표는 native 후보를, USDT0 문서는 token/OFT/Legacy Mesh 후보를 제공한다. 이것만으로 공급자 집계가 해당 주소 하나의 물량이라는 대응이나 현재 실행을 인증하지 않는다. [Hyperliquid 공식 안내](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading)는 HyperCore 입금과 Arbitrum 등의 연계를 설명하므로 HyperEVM ERC-20 검토로 대체하지 않는다. Base chainId8453은 [공식 문서](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId)로 확인했다. 문서 예시 RPC를 실행한 것은 아니다.

Base USDC와 Arbitrum USDC의 공개 explorer source 페이지를 웹 수집 도구로 각1회 확인했지만 둘 다403이었다. 응답 원인은 분리하지 못했으며 사이트에 소스가 없다는 결론은 내리지 않았다. 동일 URL 재시도·다른 방식 우회·키/로그인·소스API 호출은 하지 않았다. 공개 문서 웹 텍스트 확인과 explorer 실패를 실제 source byte 확보나 렌더링 확인으로 혼동하지 않는다.

## 다음 실제 외부 호출: 승인 전 미실행

[고정 소스 취득 계획](../../data/source-review-top10-intake-plan.json)은 공식 문서에서 확인한8후보 주소에 대한 Sourcify v2 조회다. [공식 API 문서](https://docs.sourcify.dev/docs/api/index.html) 및 [필드 설명](https://docs.sourcify.dev/blog/apiv2-lookup-endpoints/)을 확인했으며 lookup을 실행하지 않았다. 현재 v1은 종료됐으므로 v1 재시도 경로는 두지 않는다.

- GET8회·각4MiB/전체32MiB·총180초/요청20초, 재시도0·redirect0·provider 전환0.
- fields는 sources/compilation/abi/metadata만. all·proxyResolution·RPC·verify/POST·code 비교·compiler 다운로드/실행·서명/거래·키·DB/UI 변경 없음.
- proxyResolution은 공식 문서가 매 호출 동적 해석이라고 설명하므로 요청하지 않는다. 구현 주소/외부 source URL을 자동으로 따라가지 않는다. proxy 소스만 있으면 실제 토큰 기능 확인 완료로 표시하지 않는다.
- 404는 source 미확보로 기록하고 다음 고정 대상으로 진행한다. 403/429/5xx·transport·잘못된/초과 응답은 전체 종료한다. 기존 증거와 소비를 보존하고 다른 endpoint로 전환하지 않는다.
- 응답은 비공개 새 영속 슬롯에 의도/소비/바이트/hash를 보존한다. 원본 payload는 Git/웹에 게시하지 않는다. raw source는 실행하지 않고 텍스트로만 다룬다. import closure가 없으면 추가 다운로드 없이 부족을 기록한다.
- 슬롯 `.state/top10-source-intake-20261025-a`는 이번 계획 전용이며 아직 송신/소비하지 않았다. 기존 모든 실제 실행 슬롯을 재사용하지 않는다. 공개 조회·키 미사용 계획이지만 비용을 새로 대사한 것은 아니다.

| 자산 후보 | 네트워크 / chainId | 고정 조회 주소 |
| --- | --- | --- |
| USDC | base / 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC | arbitrum / 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| USDC | polygon / 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| USDC | avalanche / 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| USDT / USDT0 문서 token | arbitrum / 42161 | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| USDT / USDT0 문서 token | polygon / 137 | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| USDT / USDT0 문서 token | plasma / 9745 | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` |
| USDT / USDT0 문서 token | mantle / 5000 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |

정본 canonical 계획 SHA256(`registrationHash`, `planSha256` 필드 제외; 파일 바이트 hash와 다름): `a8ad54e299a13f99c2beaefdf17d8b8fcad70a066cd3122e3719fce5f4409a01`. 이8곳은22곳 전체 검토 완료를 뜻하지 않는 첫 source 취득 묶음이다. BSC token 대응·Arc 시스템 자산·비EVM 소스/설정은 별도 확보 경로로 남는다. API 승인은 사용자 최초 지침의 새 외부 호출 경계 때문에 필요하며, 현재 승인됐다고 간주하지 않는다.

## 재현·검증과 인계

`node tools/source-review-supply-selection.mjs --coin <usdc|usdt|rlusd> --source <private-detail.json> --sha256 <receipt-sourceHash> --day 2026-10-22 --fetched-at <receipt-fetchedAt>`은 파일만 읽고 JSON 후보를 출력한다. HTTP·환경변수 키·DB·수집기/예약은 읽거나 변경하지 않는다. fixture의 숫자 lexeme·가격/minted 배제·동률/10개상한·0/누락/중복·오염된 identity/hash/date를 검증했다. 실제3원문 선정은 rc0·22후보이며 Python Decimal 독립 계산과 순서/문자열 수량이 일치했다. 기존 catalogue 기준 결과는 별도 로그에 보존했다.

로컬 Lead 8ae3e3a9a64f4fb7bb2e42bafaeee7f5 proceed: token 수량/원래 clock/hash 연결·USD기준 기존결과 분리·집계/native/bridge 분리·RLUSD 미확보/원래 판정 보존·외부 실행 고정 계획/사용자 확인·전체 검사 조건이다. 조건을 이번 공개 발췌/계획에 반영했다. 구현 위임이나 모델 전환은 없다.

`node --test tests/source-review-supply-selection.test.mjs` 최종 rc0 tests5/pass5/fail0. 초기 전체 검사는 rc0 tests571/pass571/fail0이었으며 계획 hash 회귀 검사1개 추가 후 전체 검사를 다시 실행한다. `npm run check`·`git diff --check` 최종 결과는 [인계문](../handoff/2026-10-25-top10-source-review-candidates.md)에 기록한다. 로그 `.state/agent-logs/top10-source-review-{unit,check}.log`, 비공개 선정 결과 `.state/agent-logs/top10-source-review-token-selection.json`. 새 RPC0·새 provider API0이며 공개 문서 조회/실패한 explorer2회는 별도다. 기존 모든 원문/보고서·기능 분류·UI·지원/판정을 유지했다.

추가 계획 hash 대조에서 Python sorted-key JSON과 기존 JS 정본의 정수형 key(404) 열거 순서가 달라 1회 불일치했다. 송신 전 검사에서 발견했으며 미승인 초기 계획은 비공개 로그에 보존하고 정본 registrationHash로 통일했다. 순위/대상/예산은 동일하고 소비0이다. 정본 hash와 고정8대상/수동승인/허용필드 검증을 회귀 검사에 포함했다.
