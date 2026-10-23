# Allium 공급량 오프라인 저장·조회

[ADR0062](adr/0062-offline-allium-supply-storage.md)의 별도 `atlas_supply` CLI다. 현재 수용 범위는 검토한 Ethereum USDC/USDT 2026-10-16~22 표본14행이며 실제 자료를 신규 사설 PG17 Fixture에서 검증했다. **기존 비공개 DB 설치는 Lead 검토 미완료로 보류 중**이다. 이 문서의 명령은 설치 재개 후 실행하는 절차이며, UI/기존 공급량/수집기에는 연결하지 않았다.

## 설치 재개 절차

기존 market DB와 등록된 최소 권한 reader/writer를 사용한다. 관리자·접속 문자열·키·원문을 Git이나 웹에 넣지 않는다. 역할 자리표시자는 실제 등록된 역할로 바꾼다.

```sh
npm run market:supply:db -- init --env-file .state/market-db-secrets/admin.env
npm run market:supply:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_READER_ROLE --mode reader
npm run market:supply:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_WRITER_ROLE --mode writer
npm run market:supply:db -- import --env-file .state/market-db-secrets/writer.env \
  --source PRIVATE_REVIEWED_RESULT.json --expected-sha256 REVIEWED_RAW_SHA256 \
  --archive-dir .state/allium-supply-archive
npm run market:supply:db -- read --env-file .state/market-db-secrets/reader.env \
  --from 2026-10-16 --to 2026-10-22
npm run market:supply:db -- read --env-file .state/market-db-secrets/reader.env \
  --coin usdc --from 2026-10-22 --to 2026-10-22
```

import는 고정 두 배포×7일 grid의 완전성·문자열·원문 hash·검토 SQL을 확인한다. 기본 archive는 `.state/allium-supply-archive`이며 저장을 생략할 수 없다. 재입력 때도 archive를 검사·보존하므로 원문 파일이 없으면 같은 검토 바이트로 복구한 뒤 추가0행을 반환한다. 잘못된 원문은 접속 전 검사에서도 거부한다. 검토한 실제 원문 SHA는 [표본 기록](research/allium-samples/followup-observations.json)의 supply-recent 항목에 있다. 이 해시가 다른 파일을 새로 승인하는 값은 아니다.

read의 `totalSupply`, `circulatingSupply`, `adjustedCirculatingSupply`는 독립적인 토큰 수량 문자열/null이며 `isNative`를 함께 반환한다. 원래 `day`, `queriedAt`, `sourceHash`를 유지한다. USD는 `NOT_REQUESTED`, 집계 timezone은 UNKNOWN이며 최소 단위 정밀도는 미검증이다. 정의·누락·실패 처리와 권한 조건은 ADR0062를 따른다. 같은 원문 재입력은0행, 수정/구시각 원문은 이력으로 남고 최신값은 원래 queried_at으로 선택한다.

## 검증 범위

단위 검사4개와 별도 PG17 검사에서 주소/SQL/기간/행수/정밀도·동시 입력·재생0·구시각 역전 방지·같은 시각 충돌·null 수정·source 이후 fact 오류 rollback·원문 재개·최소 권한·trigger/ACL 변조를 확인한다. 검토한 실제 원문도 별도 소유 Fixture에서14행 입력·재생0·14행 수량/시각/hash 일치를 확인했고 정리했다. `npm run check:db`는 이 DB 검사를 포함한다.

후속은 Lead 검토 확보→별도 schema의 기존 비공개 DB 설치/원문 import 검증이다. 실제11배포 SQL 조사는 ADR0061의 과금 통제 증거 확보가 별도로 필요하다. 공급량 기본 UI·보조 연결·일별 수집은 아직 미구현이다.
