# 신규 자산 등록 계획 도구

[확장 설계](design/YEN_AND_TOP10_NETWORK_COLLECTION.md)의 오프라인 미리보기와 별도 DB 경로다. plan/detail은 **등록 계획/단위 검증 미리보기**이며 결과의 NOT_ACTIVE는 DB 등록·수집 실행·기술 검증 PASS를 뜻하지 않는다. 별도 DB 명령은 아래와 [ADR0053](adr/0053-registration-database-and-filtered-history.md)을 따른다.

## 포함한 정보

`data/market-registration.json` revision1은5코인(기존 USDC/USDT/RLUSD, 신규 JPYC/JPYSC),21개 네트워크 후보,33개 검토된 코인×네트워크 조합과 JPYC4곳/JPYSC1곳의 공식 신규 계약을 담는다. USDC의 기존 XRPL은 현재 상위10 밖에 있더라도 후보/기존 이력 보존을 위해 남긴다. 검토 후보 수와 활성 상위10 제한은 별개다.

공식 주소·상품 제약은 [조사 기록](research/yen-stablecoins-network-coverage-2026-10-22.md)을 근거로 한다. JPYC Prepaid를 현행 JPYC와 섞지 않으며 JPYSC는 Ethereum 공급량과 외부 입출고 가능 여부를 구분한다. 네트워크 identity는 기존 registry/공식 확인/미확인을 구분한다. `identityBasis=PENDING`은 RPC 연결 준비가 끝났다는 뜻이 아니다.

기존 `data/asset-registry.json`과 현재3코인 수집기는 그대로다. 새 metadata는 모든 기존 코인/네트워크 식별자·Arkham binding을 보존하는지 검사한다. 새 두 코인의 Arkham은 UNVERIFIED/null이므로 gecko ID를 자동으로 인증 endpoint에 넣지 않는다. 등록 계획을 기존 runtime registry 파일 대신 사용하지 않는다.

## 실행

기본 검사는 원문·DB·API 키 없이 실행할 수 있다.

```sh
npm run --silent market:registration:plan
```

`METADATA_ONLY` 결과에5코인/신규2코인/신규5계약/검토33조합과 metadata/기존 registry hash가 나온다. 입력 metadata가 기존 binding을 바꾸거나 출처/통화/식별자/정책이 맞지 않으면 거부한다.

저장한 DeFiLlama 목록을 대조할 때는 실제 수신 시각을 함께 명시한다. 다음은 조사 PC의 private 원문 경로다. 다른 PC에 이 파일이 없으면 기본 metadata 검사만 가능하며 이 CLI가 파일을 다운로드하지 않는다.

```sh
npm run --silent market:registration:plan -- \
  --catalogue .state/yen-expansion/defillama-catalogue.json \
  --fetched-at 2026-10-22T06:24:36.021Z
```

숫자 lexeme를 먼저 문자열로 보존하고 공통 USD 환산 유통가치 기준으로 코인별 최대10곳을 정렬한다. 동률은 canonical network ID 순서다. 해당 목록 API는 `peggedJPY` 키 아래 값도 USD 가치이므로 token 수량으로 변환하지 않는다. 공급자 FX 상세 미공개는 `PROVIDER_INTERNAL_NOT_VERIFIED`, 공급자 관측 시각 미공개는 `sourceAsOf=null`/REQUEST clock으로 남긴다.

계획은 원문 hash·수신 시각·선정 정책과 값·제외 사유를 포함한다. 가격이 없다고 값으로 역산하지 않는다. 실제0은 유지하고 누락/오류는 별도 제외한다. 미등록 네트워크가 현재 선정값을 앞설 수 있으면 `REVIEW_REQUIRED`로 보고하며 자동 등록하지 않는다. Hyperliquid L1과 HyperEVM은 자동 별칭으로 묶지 않는다.

코인 하나의 identity 불일치/중복 provider asset ID/비정상 응답은 그 코인의 `selection.state=ERROR`로 분리한다. 다른 코인의 계획은 보존하며 최상위는 `SOURCE_ERRORS`, CLI는 exit1이다. 단순 수량 미확보는 PARTIAL/REVIEW_REQUIRED이며 정상0으로 치환하지 않는다. metadata만 검토한 결과와 실제 공급자 원문 대조 결과를 구분한다.

## 새 엔화 코인의 일별 수량 미리보기

```sh
npm run --silent market:registration:detail -- \
  --coin jpyc --source .state/yen-expansion/llama-355.json \
  --fetched-at 2026-10-22T06:27:10.912Z

npm run --silent market:registration:detail -- \
  --coin jpysc --source .state/yen-expansion/llama-427.json \
  --fetched-at 2026-10-22T06:27:10.991Z
```

상세 원문의 자산 ID/symbol/gecko_id/pegType과 현행 primary contract를 확인한다. `circulating`은 공급자 유통 수량, `minted`는 공급자 발행 잔액 계열로 분리한다. 후자는 당일 발행량·소각량·누적 gross mint를 뜻하지 않는다. 두 결과 모두 unit=token, pegCurrency=JPY다. 원문의 큰 금액과 최대36자리 소수를 보존하고 exponent도 정확한 평문 십진수로 정규화한다. 범위를 벗어나면 반올림·underflow0 대신 거부한다. 공급자 자체의 기존 반올림을 복구한 것은 아니다.

최대1년/366일·10네트워크를 읽고 미확보 날짜를 보간/0 채움하지 않는다. 날짜 중복과 다른 상품 계약은 거부한다. 어느 지표가 없으면 다른 지표의 값을 빌리지 않는다. 후보/응답이10곳을 초과하면 명시 선택이 필요하다.

```sh
npm run --silent market:registration:detail -- \
  --coin jpyc --source .state/yen-expansion/llama-355.json \
  --fetched-at 2026-10-22T06:27:10.912Z --networks ethereum,polygon
```

결과는 stdout JSON이다. 저장할 때는 Git 제외 private 경로에 보관한다. source 원문·계획/preview를 웹 공개 경로에 두지 않는다. planHash/previewHash는 내용 연결과 변경 탐지용이며 발행사 서명·사용자 승인·DB 쓰기 허가가 아니다. 다음 단계의 importer는 원문·metadata revision·기존 registry/DB 정합성과 권한을 다시 검증해야 한다.

## 현재 한계와 다음 단계

등록 CLI는 네트워크/DB/환경변수를 읽지 않는다. 원문 입력 제한은 목록16MiB/상세32MiB, JSON 깊이는32다. 기존 collector ledger·288회 예산·원문 archive와 현재 UI 선택지는 유지한다. 새 코인을 지금 대시보드에서 조회할 수 있게 만든 단계는 아니다.

이번 원문 대조에서는 USDT10/USDC10/RLUSD2/JPYC4/JPYSC1의27개 조합이 선정됐다. RLUSD의 공식 추가5곳은 수량 미확보로 보존한다. 새 상세 수량은 JPYC804점×2지표, JPYSC93점×2지표로 확인했다. 다음은 기존 코인 추가 네트워크 백필·최소 권한 정기수집·화면 연결이다.

## 별도 DB 등록과 저장 자료 조회

`market:registration:db`는 외부 API를 호출하지 않는다. 기존 수집기를 유지하는 `atlas_registration` v1 전용이며 init/grant/install/import는 보관한 owner 설정, read는 명시 grant한 reader 설정을 쓴다. 기존 writer에는 새 권한을 부여하지 않는다. 아래 `<...>`는 실제 로컬 파일·명령 결과·원래 관측 시각으로 대체한다.

```sh
npm run market:registration:db -- init --env-file <admin.env>
npm run market:registration:db -- grant --role atlas_app_reader --env-file <admin.env>
npm run market:registration:db -- install --catalogue <catalogue.json> --fetched-at <원래_REQUEST_UTC시각> --env-file <admin.env>
npm run market:registration:db -- import --selection <설치결과_selectionId> --coin jpyc --source <상세원문.json> --fetched-at <원래_REQUEST_UTC시각> --env-file <admin.env>
npm run market:registration:db -- read --selection <selectionId> --coin jpyc --metric NETWORK_CIRCULATING --from 2025-10-22 --to 2026-10-22 --env-file <reader.env>
```

기본 raw archive는 Git 제외 `.state/registration-artifacts`다. `--archive-dir`로 비공개 영속 경로를 지정할 수 있다. metadata/legacy는 저장소의 검토된 파일을 사용하며 임의 plan 입력/HTTP 수집/활성화 옵션은 없다. 상세 코인은 `jpyc`/`jpysc` 등 metadata에 등록된 ID이고 지표는 `NETWORK_CIRCULATING` 또는 `NETWORK_MINTED`다. 후자는 발행 잔액이다. 최대1년/10개 네트워크를 조회하며, 조회 결과 `sourceId`를 `--source-id`로 지정하면 정정 전 원문에 해당하는 저장값을 확인한다. source가 없으면 MISSING이며0이나 이전 네트워크 값으로 채우지 않는다. 날짜 필터는 저장 자료를 좁힐 뿐 현재 외부 값을 수집하지 않는다.

Overview 그래프 연결은 [ADR0054](adr/0054-registered-supply-overview.md)를 따른다. 기존 `npm run ui -- --database --database-env <reader.env>`로 실행하면 별도 공급량 조회 endpoint를 사용해5코인을 선택할 수 있다. 실행 중인 이전 서버는 재시작해야 새 endpoint가 활성화된다. market 시세 랭킹·기술 검증과 별도이며 새 등록 영역의 일별 자동 갱신은 아래 ADR0055 절을 따른다. 화면 조회는 공급자 호출을 실행하지 않는다.

2026-10-22 Supabase 초기 적용: metadata1/selection1, JPYC4네트워크804점×2지표와 JPYSC1네트워크93점×2지표, 총1,794개 값·4source·4coverage를 저장했다. 같은 원문 재수입은 세 종류 모두 추가0이다. 당시 새 schema의 table/index/TOAST 합계는896KiB(그중 index344KiB)였다. 초기 검증은 [인계문](handoff/2026-10-22-registration-db-history.md)을 따른다.

2026-10-23 [추가 네트워크 백필](TOP10_NETWORK_BACKFILL.md)로 USDT10/USDC10/RLUSD2 조합의13,206개 값을 더해 총15,000개 값·10source·10coverage를 저장했다. 재수입 추가0과 원문별 정확한 날짜/금액 대조를 확인했다. 일부 발행 잔액 이력은 한 점만 있으므로 일별 완전성과 구분한다. 당시 총 크기는4,296KiB(그중 index1,328KiB)였으며, 이 수량으로 앞으로의 무료 용량이 충분하다고 단정하지 않는다.

## 검토된 선정의 일별 자동 갱신

[ADR0055](adr/0055-registered-daily-collection.md)의 v2 migration과 최소 권한 writer로5코인을 매 UTC일 한 번 갱신한다. 현재 검토된27개 조합에 고정하며 매일 상위10 구성을 재선정하지 않는다. 상세5 GET/일이고 기존3코인 history도 같은 원문을 재사용한다.

```sh
npm run market:registration:db -- upgrade --env-file <admin.env>
npm run market:registration:db -- grant-writer --role atlas_app_writer --env-file <admin.env>
# 기존 worker를 정상 종료하고 진행 요청/lock405 해제를 확인한 뒤 실행한다.
npm run collector:run -- --env-file <writer.env> --skip-daily-history
npm run collector:registered -- run --env-file <writer.env> --selection <검토된-selection-id>
```

`--once`는 같은 예약 규칙으로 단발 실행한다. 재실행해도 같은 UTC일의 성공/실패 예약을 재조회하지 않는다. 원문이 있는 미종료 예약은 API 없이 재수입한다. 원문 없는 미종료 예약은 UNCONFIRMED로 보존하고 다음 코인을 진행한다. 실패 코인의 이전 성공 자료/시각은 유지한다. metadata/selection 변경 시 명시 설정을 바꿔야 하며 하루 예약은 초기화되지 않는다. private archive/receipt를 영속 보관하고 owner env를 runtime에 주지 않는다. v2 설치 후 기존 history collect는 HTTP 전에 차단된다. 5분 Arkham 수집은 별도 유지한다.

## 코인 전체 가격·유통량과 시장 비교표

[ADR0057](adr/0057-global-coin-market-comparison.md)의 v3는 동일한 일별 상세 응답에서 전체 토큰 유통량과 USD 가격을 저장한다. 기존 일별5회 요청 수는 늘리지 않는다. owner로 `market-upgrade`를 한 번 적용하면 기존 등록 reader/writer 권한이 원자적으로 확장된다. 진행 중인 일별 worker를 정상 종료한 뒤 새 코드로 재시작한다. v1/v2 조회는 유지하지만 새 필드 저장에는 v3가 필요하다.

```sh
npm run market:registration:db -- market-upgrade --env-file <admin.env>
# 이미 완료한 예약은 archive/receipt의 원본 시각과 UTC 예약일로 import-only 백필한다.
npm run market:registration:db -- market-import --env-file <writer.env> --selection <selection-id> --coin jpyc --source <private-raw.json> --fetched-at <receipt-fetchedAt> --day <receipt-UTC-day>
```

`market-import`는 HTTP를 실행하지 않고 원문을 비공개 archive에 보관한 뒤 저장한다. receipt의 날짜를 원문 파일 mtime이나 현재 시각으로 대체하지 않는다. UI의 price는 USD이며 자체 기준시각이 없는 가격은 수집시각만 표시한다. global circulating과 상위10개 네트워크 합계는 다른 값이다. 엔화 코인의 총공급량·검증된24시간 거래량은 미확보로 남긴다.

## 일별 수집 상태 조회

```sh
npm run collector:registered -- status --env-file <reader.env> --selection <검토된-selection-id>
```

reader 또는 최소 권한 writer로 조회한다. owner/과다 권한 계정은 거부한다. 명령 성공은 진단 조회 성공이며, 수집기 정상 보장을 뜻하지 않는다. `status`에는 `--once`, archive/state 경로, 수집 주기 옵션을 받지 않는다. API 호출·archive 접근·예약 생성·수집 잠금 획득은 실행하지 않는다.

- `day/checkedAt`: DB transaction 시각의 UTC일과 조회 기준시각. 상태·자료 시각은 단일 repeatable-read READ ONLY snapshot이다.
- `workerLockHeld`: 같은 DB의 일별 worker 잠금407이 조회 순간 존재하는지만 뜻한다. pg_locks는 데이터 snapshot과 별개의 순간 관측이고 프로세스 정상/다음 수집 성공/heartbeat를 보장하지 않는다.
- 코인별 당일 `state`: NOT_STARTED(예약 없음), PENDING(DB 예약은 있고 종료 결과 없음), STORED, FAILED, UNCONFIRMED, SELECTION_CHANGED(오늘 예약이 다른 selection에 속함). PENDING만으로 receipt 존재나 안전한 재시도 가능성을 추정하지 않는다. 명령에 고정한 selection 자체가 최신 설정과 다르면 기존 selection-changed 오류로 중단한다.
- `pendingReservations`: 모든 selection·모든 날짜의 DB 미종료 예약 수와 요청 selection/다른 selection의 구분이다. FAILED/UNCONFIRMED처럼 종료 결과가 있는 예약은 포함하지 않는다.
- `networkFetchedAt`: 요청 selection의 코인·지표별 마지막 수집시각 목록이다. `marketFetchedAt`은 같은 selection·코인의 마지막 전체 시장 자료 수집시각이다. 원본 가격의 기준시각이나 시계열의 기준일을 뜻하지 않는다. v2는 `marketClockSupported=false`, 시장 시각은 null이며 v1은 upgrade-required다. 이 명령은 모든 과거 coverage/시계열을 재검증하는 명령은 아니다.
