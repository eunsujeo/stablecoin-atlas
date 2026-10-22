# ADR0048: DB 예약 기반 주기 수집과 일별 값 정규화

2026-10-22 · 사용자 승인: 자동수집을 진행하고 중복 저장을 방지한다. 기존 단독 검증·DB 적용·완료 후 push 승인을 유지한다.

## 수집 일정

서버 worker가 DB 시계의5분 Arkham 슬롯/UTC 일별 DeFiLlama 슬롯을 예약한 후 기존 고정 endpoint만 조회한다. 기본 Arkham은12회/UTC일, DeFiLlama는1회/일이다. 예산은 실패를 포함하며 날짜별 불변 DB 행이다. 운영 설정과 실제24시간 간격의 차이는 [실행 안내](../COLLECTOR_SERVICE.md)에 명시한다. 웹은 저장본만 읽는다. 엔드포인트 전환·동일 슬롯 재조회·누락 구간 따라잡기는 없다.

동일 DB의 worker는 session advisory lock으로 하나만 실행한다. DB 트랜잭션 잠금과 job+slot 고유키, DB trigger의 일별 상한으로 동시 예약/다중 프로세스에서도 중복 요청을 억제한다. 전용 writer만 사용하고 관리자·DDL 권한은 runtime에서 거부한다. 슬롯은 CLAIMED에서 STORED/FAILED/UNCONFIRMED로 한 번만 전이한다.

## 일별 저장 v3

기존 history v1/v2 SQL/hash와 snapshot을 변경하지 않고003 migration으로 별도 source 메타데이터·불변 daily_value·daily_latest 포인터·예약 장부를 추가한다. 명시 owner normalize가 기존 snapshot을 동일 transaction에서 검증/이전한다. 기본정보/catalog와 core 시장 스키마/facts는 변경하지 않는다.

daily_value의 content hash는 coin+metric+network+day+정규 십진 수량이다. 소수 뒤 불필요한0만 제거하며 bigint/문자열 정밀도를 유지한다. 같은 원문/기간 재import는 멱등, 새 원문의 변하지 않은 일별 값은 재사용한다. 날짜가 달라진 동일 수량은 별도 관측이다. A→B→A 정정은 불변 값 A/B와 원문 source를 남기고 최신 포인터가 A를 다시 참조한다. 오래된 import는 최신값을 덮지 않는다. source는 실제 coverage 날짜 목록과 원본 hash/시각을 보존한다. 읽기는 최신 source coverage에 있는 날짜만 합성하고 projection/value hash를 재검증하여 누락을0이나 이전 관측으로 채우지 않는다.

writer는 SELECT와 지정5개 테이블 INSERT, latest 포인터와 예약 종료 열 UPDATE만 가진다. DELETE/TRUNCATE/기존 snapshot INSERT/DDL/function EXECUTE는 허용하지 않는다. FORCE RLS·정확 정책/열 권한·구조/migration hash·API role 비공개를 검증한다. reader는 계속 SELECT만 가진다.

## 원문과 장애 복구

DeFiLlama 원문은 원본 바이트 hash를 유지한 gzip private archive로 저장한다. 동일 원문은 동일 파일을 검증해 재사용한다. 대용량1년 원문의 일별 재수집을 전체 snapshot 값의 매일 중복 INSERT로 바꾸지 않는다. 새 원문/정정 이력과 source coverage의 보관 비용은 남으며 보관 정책/오브젝트 저장소는 후속 운영 범위다.

API 전에 예약, 검증 후 원문/receipt 영속화, 이후 DB import 순서다. 응답/COMMIT 유실은 archive와 receipt를 재사용해 import만 복구한다. receipt 없는 예약은 요청 여부를 추측하지 않고 UNCONFIRMED로 종료한다. 복구 중 불확실성이 남으면 새 조회를 중단한다. 재배포 시 receipt/archive를 보존한다. 기존 정상값·원본 시각을 유지한다.

## 검증

격리 PostgreSQL17에서 반복 import·정정/역정정·오래된 source·병렬 import·동시 예약·예산 고정·terminal 전이·session lock·새 연결 재실행과 최소 권한을 검사한다. private 압축 원문의 바이트/hash/파일 충돌·복구 시 추가 API0회·실패 후 같은 슬롯 재시도0회를 시험한다. 실제 Supabase 적용/가동과 전체 검사 결과는 최신 인계문에 기록한다. Linux systemd 파일은 배포 예제이며 실제 원격 호스트 배포와 구분한다.
