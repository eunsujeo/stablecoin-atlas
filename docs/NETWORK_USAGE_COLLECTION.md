# 네트워크 활동 자료 수집·저장

현재: [실제v2/126행 Supabase·로컬UI반영과운영자동수집준비](research/2026-10-28-usage-v2-supabase-auto.md)를완료했다. [자동수집설치/기간예산절차](NETWORK_USAGE_AUTOCOLLECTION.md)를따른다. 아래이전단계의DB미반영표시는당시기록이다.

추가13GET도 [실제 완료·소비](research/2026-10-28-arkham-usage-expansion-result.md)했다. 기존5쌍과 합쳐18쌍의 사설검토본을 확보했으나 DB/UI의 기존35행은 변경하지 않았다. 아래 과거 실행 명령을 재사용하지 않는다.

메타데이터4GET의 [실제 완료·소비와 다음13후보](research/2026-10-28-arkham-usage-discovery-result.md)를 확인한다. 추가histogram/DB 변경은 미실행이다. 전체 등록33쌍 확대와 Allium 수집 종료는 [후속 준비 기록](research/2026-10-28-all-asset-usage-expansion.md)을 따른다. 아래 최초5쌍 기록은 보존하며 추가28쌍 수집 완료를 의미하지 않는다.

[ADR0117](adr/0117-arkham-network-usage-pipeline.md)의 수동 도구다. 최초 승인 실행은 실제5GET/HTTP200다섯건/2535bytes·35관측/DB snapshot1건으로 완료·소비했다. [실제 결과](research/2026-10-28-network-usage-live.md)를 따른다. 아래 수집 명령을 다시 실행하지 않으며 가상 자료를 실제 DB에 넣지 않는다. 웹은 저장 자료만 읽는다. Collector/FX/자동수집/운영 배포와 분리한다.

## 고정 최초 실행 — 완료·소비

| 항목 | 값 |
| --- | --- |
| 대상 | USDT Ethereum/TRON/Solana, USDC Ethereum/Solana |
| 요청 범위 | 2026-10-21T00:00:00Z ~ 2026-10-27T23:59:59Z, inclusive timeLte |
| endpoint | 각 GET /transfers/histogram, base=all, chains/token 주소 명시, granularity=1d |
| 상한 | 5GET/0run, 응답2MiB/총10MiB, 요청20초/전체120초, 송신간격1초 |
| 반복 | 재시도0·추가페이지0·redirect0·공급자 전환0·스케줄0 |
| 비용 | UNCONFIRMED. 요청 수 상한은 금전 상한이 아님 |
| 원문 슬롯 | .state/allium-executor/arkham-network-usage-20261028-v1 |
| plan hash | 3a0b22eb59ee06965a51bbfe0d5be95c1676215324cec7e1094dd4ac67d644ab |
| 고정 파일 SHA256 | cb0c8a538575fc5ead304b0fc9ba94e21cfe3142c31820ddca0938cf894cd755 |

대상 주소와 정확한 인자는 [JSON 계획](../data/arkham-network-usage-20261028-plan.json)에 있다. 기존 registry와 metadata hash가 달라지면 계획을 임의로 고치거나 주소를 추정하지 않는다. 날짜 변경도 새 계획/소비 범위다. 원문 providerTime을 보존하나 일말 하위 초 포함 범위·집계 시간대/금액 정확성을 인증하지 않는다.

## 명령 — 실제 실행 승인 후에만

아래는 사용법 기록이다. 이번 최초5GET·DB 적용은 이미 완료/소비했으므로 그대로 재실행하지 않는다. 새 기간에는 새 고정 계획/승인/소비가 필요하다.

계획 작성은 키/API/DB 없이 로컬 파일만 읽는다.

```sh
npm run market:usage -- plan --day 2026-10-28
```

아래 자리표시자는 실제 사용자 승인 bytes와 검토한 원문 hash로 채운다. 승인 파일/원문/URL/키는 비공개 .state에만 보존한다. 기존 ARKM_API_KEY를 사용하며 새 키·usage 조회는 필요하지 않다.

```sh
npm run market:usage -- collect \
  --plan data/arkham-network-usage-20261028-plan.json \
  --plan-sha256 cb0c8a538575fc5ead304b0fc9ba94e21cfe3142c31820ddca0938cf894cd755 \
  --approval PRIVATE_APPROVAL --approval-sha256 REVIEWED_APPROVAL_HASH
npm run market:usage -- project \
  --archive .state/allium-executor/arkham-network-usage-20261028-v1 \
  --plan-sha256 cb0c8a538575fc5ead304b0fc9ba94e21cfe3142c31820ddca0938cf894cd755 \
  --receipt-sha256 REVIEWED_RECEIPT_HASH --approval-sha256 REVIEWED_APPROVAL_HASH \
  --output PRIVATE_NEW_SNAPSHOT.json
```

송신 전 intent를 영속 기록하며 슬롯은 한 번만 생성된다. lost response·429·거절·timeout·한도 초과 뒤 소비를 재사용하지 않는다. partial 원문도 hash/바이트와 함께 보존한다. 모든 결과가 빈 배열이어도 수집 근거는 보존하지만 새 관측 snapshot을 만들지 않는다. 일부 날짜의 생략은 MISSING으로 보존한다.

## 실제 DB 적용 — 최초 반영 완료

db/network-usage/001-initial.sql의 새 private atlas_network_usage만 생성한다. PG17 구조 pin은5a19f99626ccd958de1357795eb4fed2327b4fad30644b34e7e6cd06a449d905이다. 기존10개 schema의 구조/자료를 변경하지 않는다. 기존 writer/reader만 사용하고 API용 역할/PUBLIC의 직접 접근과 미검토 SECURITY DEFINER 경로를 차단한다.

아래 init/grant/import에 기존 DB의 검토된 definer manifest가 필요하면 `--reviewed-definers PRIVATE_MANIFEST --reviewed-sha256 REVIEWED_HASH`를 함께 지정한다. 과거 파일명만으로 재사용하지 않고 실제 함수/SQL/schema hash 일치를 확인한다. 경계 검사가 실패하면 실행을 멈춘다. 새 역할/키·PUBLIC/anon/authenticated/service_role grant·기존 권한 변경은 없다.

```sh
npm run market:usage:db -- init --env-file .state/market-db-secrets/admin.env
npm run market:usage:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_WRITER_ROLE --mode writer
npm run market:usage:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_READER_ROLE --mode reader
npm run market:usage:db -- import --env-file .state/market-db-secrets/writer.env --source PRIVATE_NEW_SNAPSHOT.json --expected-sha256 REVIEWED_SNAPSHOT_HASH
npm run market:usage:db -- read --env-file .state/market-db-secrets/reader.env
```

실제 첫 적용은 검토한1개 snapshot(35개 관측/누락 칸)까지만 한다. 같은 입력의 재import는 추가0을 검증한다. 이전 schema/원문·비용 미확인·판정은 유지하며 실패 수집을 정상 자료로 입력하지 않는다.

## 읽기와 화면

로컬 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`는 새 reader를 사용한다. 화면은 새 API의 정상 응답을5분 캐시하고 Arkham 수집 저장/Allium 기존 저장을 분리한다. 새 DB/table이 없으면 조회 실패/미연결로 표시하고 다른 공급자 자료로 자동 대체하지 않는다. 실제 reader/로컬 화면에서35관측을 대조했다. 기존 운영 웹에 실제 배포하지 않았다.

Arkham은 USD금액/전송 이벤트 건수와 그 평균만 제공한다. 토큰 수량/고유 트랜잭션 수·활성 주소·중앙값·전체 DEX·결제 분류는 이 수집에서 얻지 않는다. 평균·금액·빈도는 사람 수/고래/안전성/결제량 판정이 아니다.

## 로컬 재현

```sh
node --test tests/network-usage.test.mjs
node --use-env-proxy --test tests/postgres/network-usage.test.mjs
node tools/network-usage-browser-check.mjs
node tools/production-browser-check.mjs --fx-isolation --safari-streams
node tools/browser-cache-browser-check.mjs
npm run check
```

Postgres 시험은 설치된 postgres:17-alpine만 쓰는 새 소유 Docker loopback Fixture다. 시험 자료·키는 가상이며 운영 DB/공급자 호출은 없다. 브라우저도 가상 저장 DTO와 소유 loopback만 사용한다.
