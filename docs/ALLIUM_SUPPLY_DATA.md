# Allium 공급량 오프라인 저장·조회

[ADR0062](adr/0062-offline-allium-supply-storage.md)의 별도 `atlas_supply` CLI다. 현재 수용 범위는 검토한 Ethereum USDC/USDT 2026-10-16~22 표본14행이다. [ADR0063](adr/0063-supply-install-and-api-boundary.md)에 따라 기존 비공개 DB 설치·14행 입력/대조·재생0까지 완료했다. [ADR0064](adr/0064-reviewed-allium-supply-preview.md)로 로컬 Overview의 별도 표본 표에 연결했다. 기존 공급량·수집기의 기본 경로는 유지한다.

## 설치·조회 절차

기존 market DB와 등록된 최소 권한 reader/writer를 사용한다. 관리자·접속 문자열·키·원문을 Git이나 웹에 넣지 않는다. 역할 자리표시자는 실제 등록된 역할로 바꾼다.

```sh
npm run market:supply:db -- init --env-file .state/market-db-secrets/admin.env
npm run market:supply:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_READER_ROLE --mode reader
npm run market:supply:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_WRITER_ROLE --mode writer
npm run market:supply:db -- boundary --env-file .state/market-db-secrets/admin.env
npm run market:supply:db -- import --env-file .state/market-db-secrets/writer.env \
  --source PRIVATE_REVIEWED_RESULT.json --expected-sha256 REVIEWED_RAW_SHA256 \
  --archive-dir .state/allium-supply-archive
npm run market:supply:db -- read --env-file .state/market-db-secrets/reader.env \
  --from 2026-10-16 --to 2026-10-22
npm run market:supply:db -- read --env-file .state/market-db-secrets/reader.env \
  --coin usdc --from 2026-10-22 --to 2026-10-22
```

`boundary`는 Data API 역할의 DB 유효 권한·역할 전환·우회 경로를 읽기 전용으로 검사한다. 미검토 SECURITY DEFINER가 있으면 차단한다. 별도로 검토한 source record를 사용할 때는 다음 두 인자를 함께 지정한다:

```sh
npm run market:supply:db -- boundary --env-file .state/market-db-secrets/admin.env \
  --reviewed-definers PRIVATE_REVIEWED_DEFINERS.json --reviewed-sha256 REVIEWED_MANIFEST_SHA256
```

manifest는 schemaVersion1/kind `SUPPLY_SOURCE_REVIEWED_DEFINERS`의 definers 배열이다. 각 항목은 namespace/name/arguments/state `SOURCE_REVIEWED`/definitionHash/schemaHash를 포함한다. schemaHash는 실제 DB 객체·owner·rewrite rule까지 묶으므로 다른 환경에 그대로 승인하지 않는다. 생성과 대조는 같은 transaction/search_path 문맥에서 해야 한다. boundary 자체는 source review를 만들거나 권한을 바꾸지 않는다. Dashboard exposed schemas는 이 검사에서 계속 UNKNOWN이며 세부 검토 범위와 한계는 ADR0063을 따른다.

import는 고정 두 배포×7일 grid의 완전성·문자열·원문 hash·검토 SQL을 확인한다. 기본 archive는 `.state/allium-supply-archive`이며 저장을 생략할 수 없다. 재입력 때도 archive를 검사·보존하므로 원문 파일이 없으면 같은 검토 바이트로 복구한 뒤 추가0행을 반환한다. 잘못된 원문은 접속 전 검사에서도 거부한다. 검토한 실제 원문 SHA는 [표본 기록](research/allium-samples/followup-observations.json)의 supply-recent 항목에 있다. 이 해시가 다른 파일을 새로 승인하는 값은 아니다.

read의 `totalSupply`, `circulatingSupply`, `adjustedCirculatingSupply`는 독립적인 토큰 수량 문자열/null이며 `isNative`를 함께 반환한다. 원래 `day`, `queriedAt`, `sourceHash`를 유지한다. USD는 `NOT_REQUESTED`, 집계 timezone은 UNKNOWN이며 최소 단위 정밀도는 미검증이다. 정의·누락·실패 처리와 권한 조건은 ADR0062를 따른다. 같은 원문 재입력은0행, 수정/구시각 원문은 이력으로 남고 최신값은 원래 queried_at으로 선택한다.

## 검증 범위

단위 검사4개와 별도 PG17 검사에서 주소/SQL/기간/행수/정밀도·동시 입력·재생0·구시각 역전 방지·같은 시각 충돌·null 수정·source 이후 fact 오류 rollback·원문 재개·최소 권한·trigger/ACL 변조를 확인한다. 검토한 실제 원문도 별도 소유 Fixture에서14행 입력·재생0·14행 수량/시각/hash 일치를 확인했고 정리했다. `npm run check:db`는 이 DB 검사를 포함한다.

기존 비공개 DB에서14행 입력·재생0·14행 수량/null/시각/hash 대조와 필터/미확보 날짜를 확인했다. 기존5개 schema·권한/정책과 시장 표본180건·전송량60건을 보존했다. archive600권한을 확인했고 이 설치 단계의 새 공급자 조회는0이다. 후속 사용자 예외로 수행한 [11배포 조사](research/allium-samples/survey-2026-10-23.md)는 별도 비공개 저장이며 이 DB의14행을 덮어쓰지 않았다. 공급량 기본 전환·보조 연결·일별 수집은 아직 미구현이다.

## 로컬 표본 화면

`npm run ui -- --database --database-env .state/market-db-secrets/reader.env`의 Overview에서 **Allium 공급량 · 과거 표본**을 확인한다. 표본 토큰 필터와 행별 관측 근거를 제공하며 정확한 문자열·null·원래 시각/hash를 보존한다. 누락·조회 실패·미연결과 마지막 정상 자료의 표시 규칙, 웹 읽기 경계는 ADR0064를 따른다. 기본 JSON 모드에는 이 DB 표본을 복제하지 않는다. 원문과 private 검증 자료는 Git/웹에 게시하지 않는다.
