# 일별 전송량 저장·조회

[ADR0059](adr/0059-allium-primary-and-daily-transfers.md)에 따라 검토한 Allium Ethereum 5코인의 일별 전송량을 PostgreSQL과 전체 현황에 연결했다. 초기 저장은 2026-10-08~10-22 조회에서 확보한 60행이며 코인별 최신 행은 10/21이다. 10/22와 JPYSC 중간 누락을 0으로 채우지 않는다. 매매 거래량·발행량·소각량과 구분한다.

## 실행

Node 24.5+와 기존 market DB가 필요하다. 비공개 env 파일과 기존 최소 권한 역할을 사용한다. 실제 역할명·키·DB URL은 명령 예시나 Git에 넣지 않는다.

```sh
npm run market:activity:db -- init --env-file .state/market-db-secrets/admin.env
npm run market:activity:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_READER_ROLE --mode reader
npm run market:activity:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_WRITER_ROLE --mode writer
npm run market:activity:db -- import --env-file .state/market-db-secrets/writer.env --source PRIVATE_REVIEWED_RESULT.json --expected-sha256 REVIEWED_RAW_SHA256 --from 2026-10-08 --to 2026-10-22 --archive-dir .state/activity-archive
npm run market:activity:db -- read --env-file .state/market-db-secrets/reader.env
```

역할 자리표시자는 실제 등록된 역할로 바꾼다. 역할의 기존 market 접근 모드와 일치해야 한다. 원문 해시는 import 때 자동 승인하지 않고 검토한 해시를 명시한다. 실제 원문 SQL·계정 query/run 식별자는 비공개 archive에만 보존하고 DB에는 수량·원문 해시·원래 조회시각·기간만 저장한다. 금액과 건수는 십진 문자열이다. 조정 전송량 null은 보존한다.

같은 원문과 mapper 재입력은 추가0행이다. 같은 자연 키의 수정 관측은 새 source에 저장하며 이전 관측을 변경하지 않는다. 최신 선택은 queried_at 기준이고 imported_at 기준이 아니다. 같은 조회시각의 충돌값은 거부한다. advisory lock은 이 importer를 따르는 동시 실행을 직렬화하며 직접 SQL writer를 같은 프로토콜로 강제하는 것은 아니다.

## 권한·웹

`atlas_activity`는 별도 비공개 schema, FORCE RLS와 검증된 역할별 정책을 사용한다. writer는 source/daily_value INSERT만, reader는 SELECT만 허용한다. 갱신/삭제 trigger와 구조·정책·ACL 검증은 변조 시 조회/입력을 실패시킨다. Supabase Data API 역할에 공개하지 않는다. 기존 4개 schema의 구조는 실제 추가 설치 전후 같음을 확인했다.

`--database --database-env .state/market-db-secrets/reader.env` UI는 정확한 `/activity-data.json` 경로로 검토된 projection만 제공한다. 원문 SQL·run ID·키는 제공하지 않는다. 최근 코인당 최대31개 저장 날짜를 읽고 10초 cache·동시 요청 병합을 사용한다. 웹 시작·새로고침은 공급자 API를 호출하지 않는다.

전체 현황은 초기 스켈레톤, 토큰 기본정보, Ethereum 범위, 전송량/환산 USD/전송 건수/기준일을 표시한다. 값의 tooltip은 원래 정확한 문자열을 보존한다. DB 조회 실패 중 현재 화면의 마지막 정상 자료와 날짜를 유지하고 실패 상태를 표시한다. 초기 조회부터 실패한 경우는 자료 미확보와 구분한다. 브라우저 F5 시 로컬 메모리 값을 복원한다고 주장하지 않는다. DB가 정상일 때 저장본을 다시 읽는다.

## 공급자 범위

사용자가 정한 기본은 Allium, 장애 시 보조는 DeFiLlama다. 전송량에는 검증된 동등 DeFiLlama 경로가 없어 자동 대체하지 않는다. 공급량 전체를 Allium 기본으로 전환하는 작업과 실제 DeFiLlama 보조 연결은 아직 구현하지 않았다. [기존 공급량 차이](research/allium-samples/followup.md)를 보존하며, 정의가 다른 값으로 그래프를 이어 붙이지 않는다. `providerChoice`는 현재 화면의 마지막 정상 자료 유지에 사용하며 backup 경로는 동등성이 검증된 호출자가 명시할 때만 선택 가능한 정책 함수다.

이번 단계는 저장된 검토 원문의 import다. 새 Allium query 생성/실행·일별 자동 수집·다른 네트워크 지원은 추가하지 않았다. 다음 수집기는 별도 사용량 예산·실행 영수증·원문 보존·중복/늦은 집계 정책을 적용해야 한다.

## 검증 기록

- 단위/HTTP: 원문 해시·주소/기간·문자열·null·중복 검증, 정확한 라우팅과 오류 은닉, cache·동시 조회.
- PG17: 최소 역할, 중복/동시 import, 구시각/수정/충돌, source 삽입 뒤 fact 오류의 transaction rollback, trigger 변조 시 거부.
- 실제 DB: 60행·5코인·원래 수량/조정값/최신일 대조, replay0, 기존 schema 구조 동일, 새 공급자 요청0.
- 브라우저: 5열 스켈레톤·정확한 값/기준일·오류 시 마지막 정상 자료·복구·F5·dark/light·390px·외부 요청/JS 오류 없음.
