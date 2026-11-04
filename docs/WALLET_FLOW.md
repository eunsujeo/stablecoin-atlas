# Wallet Flow Intelligence MVP

첫 분석 대상은 Upbit / TRON / USDT다. 사용자가 제공한 Seed의 실제 입금 TXID로 초기 관측본을 확보했다. 개인과 주소의 연결 정보는 비공개로 보존하고, 공개 라벨·소유권 확정은 등록하지 않았다. 정상 운영 Collector와 별개인 수동 분석 경로다. PostgreSQL migration, timer, 유료 API, 운영 자격증명 변경은 없다.

## 구조와 제공 범위

`tools/wallet-flow/{cli,collector,normalize}.mjs` → 사설 실행 디렉터리 → 검토된 정규화 snapshot → `web/wallet-flow/model.mjs` → GET/HEAD `/wallet-flow-data.json` → `/wallet-flow/index.html`.

사용자가 입력한 TXID는 **이미 수집된 snapshot 안에서** 검색한다. 웹 요청이 공급자 호출을 실행하지 않는다. 미등록 TXID는 수동 수집이 필요하다고 표시한다. 원문과 intent/실패 소비 기록은 사설 디렉터리에만 보존한다. 공개 파일은 `web/wallet-flow/data.json`; 검토된 실제 관측본을 제공하며, empty 상태도 지원한다. fixture는 운영 reader에서 거부한다.

- USDT Transfer: 고정 계약 `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`의 receipt log, TXID+log index 단위. 실패 거래는 수수료·상태만 보존.
- TRX: 외부 `TransferContract`만 수집. 내부 호출의 TRX 이동은 미수집.
- Stake2: DelegateResourceContract / UnDelegateResourceContract를 별도 이벤트로 표현. amount는 SUN 단위 위임 원금이다. Energy 수량이나 USDT 금액이 아니다.
- 잔액: 수집 시점 관측값. 과거 거래 시점 잔액으로 표시하지 않는다. 미제공값은 null, 임의 0 대체 금지.
- 그래프: 최대 12개 직접 상대방, 주소를 선택한 뒤 중심 변경. 연결선에서 전송 방향, 합계, 기간, 이벤트 수와 TXID를 확인한다.
- 경로: 이후 블록의 최대 2단계 후속 전송, 최대 100개 후보. 같은 블록 안의 순서를 가정하지 않는다. 집금 후 개별 고객 자금을 특정 출금에 귀속시키지 않는다.
- 역할: 행동 후보와 반대 근거를 함께 표시. 공개 라벨은 출처 URL/관측 시각과 별개 기록. 소유 확정, 준비금/Hot/Warm/Cold, 실제 고객 입출금 분류는 추가 근거 없이 판단하지 않는다.
- 자원: 같은 제공자·수신자·자원 종류의 위임/전송/회수 시간 관계를 비교. 비용 절감이나 동일 소유를 입증하지 않는다.

## 공급자 비교 — 2026-11-04 확인

| 방식 | 용도 | 제한·비용 | 완전성 |
|---|---|---|---|
| TronGrid 공식 HTTP API | 주소 이력 탐색 + solidified 거래 본문/receipt | 현재 [rate limits](https://developers.tron.network/reference/rate-limits)는 plan/key/network/endpoint별 정책. 과거 고정 QPS·일일 한도를 보장값으로 사용하지 않는다. 무료 여부·남은 quota 확인 필요 | fingerprint 페이지와 시간 범위 사용. 조회 대상 밖·색인 지연·주소별 자원 수신 이력 누락 가능 |
| TRON full node / solidity API | TXID를 아는 거래와 확정 receipt 확인 | 노드 제공자 정책 또는 직접 노드 운영비 | 전체 주소 이력·탐색기 라벨 색인 역할과 다름 |
| Tronscan | 사람이 근거 TXID 확인, 공개 라벨 출처 검토 | [API 인증 문서](https://docs.tronscan.org/en/api/common-network-auth)에 따라 Mainnet key 필요. 무료·요금·quota를 추정하지 않음 | 라벨은 소유권 증명과 다르며 시점·출처 필요. 자동 라벨 수집은 이번 MVP 미구현 |

공식 [주소 거래 이력](https://developers.tron.network/reference/get-transaction-info-by-account-address), [TRC20 이력](https://developers.tron.network/reference/get-trc20-transaction-info-by-account-address)은 후보 TXID 탐색에 사용한다. 실제 이벤트는 [거래 receipt](https://developers.tron.network/reference/gettransactioninfobyid)와 본문을 대조한다. 현재 [위임 조회](https://developers.tron.network/reference/getdelegatedresourcev2)는 과거 위임/회수 이력 전체를 대신하지 않는다. [Resource model](https://developers.tron.network/docs/resource-model)에 따라 자체 스테이크·위임·소각과 사용량을 구분한다.

## 제한된 수동 실행

Node >=24.5 및 기존 의존성만 사용한다. 다운로드·새 라이브러리가 필요하지 않다. 실제 TXID와 필요하면 최대 2개 Seed 주소, 라벨 출처를 먼저 확보한다. 공급자 무료 한도와 비용을 확인하기 전 실제 호출하지 않는다.

```sh
node --use-env-proxy --import tsx tools/wallet-flow/cli.mjs plan --txid "$FLOW_TXID" --hours 6
node --use-env-proxy --import tsx tools/wallet-flow/cli.mjs collect --txid "$FLOW_TXID" --hours 6 --directory "$FLOW_NEW_PRIVATE_RUN"
node --import tsx tools/wallet-flow/cli.mjs export --directory "$FLOW_NEW_PRIVATE_RUN" --output "$FLOW_NEW_REVIEW_FILE"
```

키가 필요한 경우 비공개 환경변수 `WALLET_FLOW_TRONGRID_KEY`를 사용한다. 실제 무료 플랜임을 확인한 뒤에만 `WALLET_FLOW_FREE_TIER=confirmed`를 설정한다. 이 문자열은 요금 확인을 대신하지 않는다. 키를 명령 인자·문서·Git에 넣지 않는다. 유료 API는 별도 사용자 승인 필요.

기본 총 6시간(입금 전 최대 1시간 포함), 최대 24시간. 최대 4개 확장 주소, 24개 거래 본문+receipt, 주소/피드별 2페이지×50행, 80 HTTP, 응답 2MiB / 전체 16MiB / 300초, 요청 간 최소 1.1초. 실패·429·timeout·본문 중단 모두 자동 재시도/공급자 전환 없음. 소비한 디렉터리 재사용 불가. 부분 이력은 partial/not-collected로 표시한다. 새로운 실행은 기존 실패 기록을 보존하고 원인을 검토한 뒤 별도 판단한다.

export는 원문 SHA-256과 거래/이벤트/잔액을 재대조하고 새 파일만 만든다. 이는 공급자 응답 결합과 로컬 무결성 검사이며 독립적인 블록 포함 증명이 아니다. 공개 전 주소/라벨/한도/누락을 검토하고 **정규화된 파일만** 별도 변경으로 반영한다. raw JSON, intent, 실패 기록, 키는 Git에 포함하지 않는다. 운영 파일을 fixture로 바꾸지 않는다.

## 검증 재현

```sh
node --import tsx --test tests/wallet-flow.test.mjs
npm run check
node tools/ui-preview.mjs --port 54875
node --import tsx tools/wallet-flow-browser-check.mjs
```

브라우저 검사는 Chrome CDP로 실제 렌더링하며 localhost의 명시적 `#fixture`에서만 테스트 응답을 주입한다. 테스트 TXID/주소는 가상이며 실제 Upbit 증거가 아니다. 1440×900,1280×800,390×844 / 다크·라이트 / 네 분석 화면, 키보드 선택·거래 상세·필터·미등록 TXID·자원 단위를 검사한다. 결과와 스크린샷은 `.state/wallet-flow-browser/`에 저장한다.

2026-11-04 초기 관측: 실제 입금 6 USDT → 5분36초 뒤 6 USDT 후속 전송 후보, 그 전후 ENERGY/BANDWIDTH 위임·회수를 확인했다. 주소 발견 22개, 거래 24건, 이벤트 23건. 입금 주소의 공급자 이력 페이지는 완료했지만 후속 주소는 거래 한도로 partial, 나머지 20개는 미확장이다. 집금 이후 전체 경로·소유·비용 절감은 미확인이다. 탐색 1GET/418bytes, 분석 56HTTP/236915bytes, 재시도0. 출발 TXID와 모든 연결 근거는 정규화 snapshot에서 확인할 수 있다.

## 분석 결과와 후속 송금 보완

기본 화면은 입금 금액, 첫 후속 송금까지의 시간, 자원 위임·회수의 상대 시각,
후속 수신 주소의 행동과 해당 수신 이후의 송금을 분리한다. 각 항목은 실제 TXID에 연결한다.
주소 역할은 행동 기반 후보이며, 집금된 자금의 특정 출금 귀속·소유권·수수료 절감은 판정하지 않는다.
초기 수집은 입금 전 이력을 포함하므로 거래 한도에 의해 후속 송금이 빠질 수 있다.
이때 기존 근거를 재사용하는 수동 outgoing-continuation을 사용할 수 있다.

```sh
node --import tsx tools/wallet-flow/cli.mjs plan-followup --parent "$FLOW_PARENT_PRIVATE_RUN" --event "$FLOW_FORWARD_EVENT_ID"
node --use-env-proxy --import tsx tools/wallet-flow/cli.mjs followup --parent "$FLOW_PARENT_PRIVATE_RUN" --event "$FLOW_FORWARD_EVENT_ID" --directory "$FLOW_NEW_PRIVATE_RUN"
node --import tsx tools/wallet-flow/cli.mjs export --directory "$FLOW_NEW_PRIVATE_RUN" --output "$FLOW_NEW_REVIEW_FILE"
```

기존 입금의 직접 후속 전송만 anchor로 허용한다. 그 수신 시점부터 원래 기간 종료까지
해당 수신 주소의 outgoing USDT 첫20개 색인 항목만 조회한다. 최대20개 새 거래,
41HTTP/16MiB/180초/재시도0이며 기존 원본을 hash 재검증 후 재사용한다.
다른 방향·전체 주소 이력의 완료 상태로 승격하지 않는다. 웹 요청으로 실행하지 않는다.
2026-11-04 이 보완은 41HTTP/48,316bytes/새 거래20건으로 소비 완료됐다.
통합44거래/43이벤트/42주소, 수신 이후20송금·20상대·39,446.317369 USDT를 관측했다.
이는 수신 주소의 후속 활동 합계이며 선택 입금6 USDT의 추적 금액이 아니다.

분석·보완 테스트는 `node --import tsx --test tests/wallet-flow*.test.mjs`로 실행한다.
브라우저 검증은 분석 결과를 포함한 다섯 화면을 확인한다.
