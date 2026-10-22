# ADR0055: 검토된 네트워크의 5코인 일별 자동 수집

- 상태: 구현
- 기준: 2026-10-23
- 선행: [등록 DB](0053-registration-database-and-filtered-history.md), [Overview](0054-registered-supply-overview.md)

새 Overview의 원문은 기존 3코인 worker가 갱신하지 않았다. 별도 일별 worker와 atlas_registration v2를 추가한다. 기존 core/history SQL은 변경하지 않는다.

## 승인된 선정 범위와 권한

worker는 명시 `--selection`의 검토된 metadata/selection에 고정한다. USDT10/USDC10/RLUSD2/JPYC4/JPYSC1의 일별 원문5 GET/UTC일이며 목록 재조회는 하지 않는다. 매일 상위10 구성을 다시 선정하는 기능은 후속이다. 새 선정의 부분 발행으로 다른 코인의 기존 자료가 사라지는 일을 피한다. metadata/선정/계약 변경은 owner만 수행하고, runtime은 현재 최신 metadata/selection과 일치하지 않으면 중단한다. import의 재검사는 owner 설치와 동일 transaction lock406 아래 수행한다.

owner의 원자 migration으로 writer_grant/collection_run/collection_result를 추가하고 기존 reader에 SELECT/RLS 정책을 함께 제공한다. v1 읽기와 v2 읽기를 모두 지원하며 v1 SQL hash 및 v2 현재 구조 hash를 검증한다. writer는 안전한 기존 market writer 역할이어야 하며 SELECT와 coverage/daily_value/daily_source/collection_run/collection_result INSERT만 갖는다. UPDATE/DELETE/DDL/함수 실행/metadata 변경을 허용하지 않는다. 상속과 열 권한도 검사한다. 소스·값·예약·종료는 불변이다.

## 예약과 장애 경계

독립 session lock407은 기존 Arkham worker405와 충돌하지 않는다. DB UTC 날짜+coin UNIQUE 예약을 COMMIT한 뒤 요청한다. selection 변경으로 하루 예산을 초기화하지 않는다. 요청 직전 같은 backend/lock/DB UTC일/미종료 예약을 재확인한다. 시작이 다음 날로 밀리면 GET 없이 실패한다. HTTP가 자정을 넘으면 시도 예산은 시작일, source 시각은 원래 응답 완료 시각이다. 고정5개 endpoint·redirect 금지·30초 timeout·32MiB 상한이며 자동 retry/fallback/지난 슬롯 catch-up은 없다. 연결 상실은 진행 요청도 취소한다. 예약 COMMIT 결과가 불명이면 그 실행은 GET하지 않는다.

receipt는 job/coin/UTC slot/metadata/selection/raw hash/원래 fetchedAt을 결합한다. gzip raw와 receipt를 private hash 경로에 fsync한 뒤 import한다. 재시작 시 CLAIMED+receipt는 API 없이 같은 원문을 재수입한다. CLAIMED+receipt 없음은 terminal UNCONFIRMED이고 재조회하지 않는다. 뒤늦게 원문을 찾으면 명시 offline import만 허용하며 종료 행을 고치지 않는다. 깨진 receipt/DB import/COMMIT 응답 유실은 CLAIMED를 남겨 import-only 복구한다. 자동 복구 대기는 최대25건이며 초과하면 운영 점검을 요구한다.

registration import → 기존3코인 legacy import → 종료 INSERT는 별도 멱등 단계다. 뒤 단계가 실패해도 receipt를 유지하고 같은 순서로 재실행한다. 각 source는 원래 시각/hash를 유지하며 기존 성공 source를 가짜 새 시각으로 바꾸지 않는다. 두 영역의 일시적 갱신 차이를 허용하지만 source를 섞어 조회하지 않는다. 코인별 404/정의 오류는 다른 코인의 갱신을 막지 않는다.

## 전환과 조회 지연

구 worker를 정상 종료하고 진행 요청/lock405 해제를 확인한 뒤 v2 migration·grant, Arkham worker의 `--skip-daily-history`, 새 일별 worker를 시작한다. v2가 있으면 기존 periodic/manual history collect 경로는 HTTP 전에 거부한다. offline import/기존 receipt 복구는 유지한다. 당일 기존 DEFILLAMA receipt가 있으면 raw hash/원래 시각을 재사용해 전환 중 중복 GET도 막는다. 웹 요청은 외부 수집을 하지 않는다. 자동 재시작·원격 service supervisor·보관 정책은 후속이다.

차트 조회는 10초 이내 유효한 index cache의 source ID/기간을 재사용한다. index를 새로 받아놓고 같은 목록을 DB에서 다시 읽던 지연을 줄인다. 캐시가 만료하면 다시 검증하고 실패 시 만료 자료로 대체하지 않는다. 같은 source pin으로 원문 정합성을 유지하며 새 index를 받으면 이전 history cache를 무효화하고 cache hit도 source pin을 대조한다. 응답/대기열 한도는 유지한다. Overview 범례의 날짜/점 개수는 제거하고 정확한 수량 내림차순으로 정렬한다. 상세 값/기준일은 차트 내부 pointer tooltip과 키보드/터치에서 확인한다.

## 검증

격리 PG17에서 v1→v2 재실행/reader 보존·writer 최소 권한·405/407 분리·동시 worker 거부·404 격리·동일일 재실행 GET0·기존 성공 시각 보존·선정 변경 차단·열 권한 drift·불변 종료를 검사한다. 단위 검사는 receipt 유실/COMMIT 응답 유실의 import-only 복구, session/day guard, 고정 endpoint/무재시도와 cache의 source pin/만료 실패를 확인한다. 완료 결과와 실제 운영 상태는 최신 인계문을 따른다.
