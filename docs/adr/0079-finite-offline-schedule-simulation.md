# ADR0079 — 유한 UTC tick 오프라인 반복 실행 검증

## 범위

ADR0078 인계 뒤 오프라인 반복 실행·스케줄·장애 검증을 제안했고 사용자가 진행을 재차 지시했다. 이번 단위는 가상 authorization/usage/응답과 새 소유 PG17 Fixture의 실험이다. 실제 예약 서비스·timer·수집 CLI·공급자/usage 호출·키·기존 개발 DB·legacy/live-once는 연결하지 않는다. 실제 일별 수집 승인은 별도로 필요하다.

## 유한 실행과 시간

`tools/allium-schedule-simulation.mjs`의 schedule은 조직 hash·명시 날짜 최대31개·UTC 분·15분 창·최대128 tick을 hash로 고정한다. 날짜는 유효하고 오름차순이며 중복을 허용하지 않는다. 각 tick은 호출자가 명시적으로 실행하는 모듈 API다. timer·자동 재시도·과거 누락일 보충·설치/enable 경로는 없다. UTC일의 지정 분부터15분 미만만 처리하고 늦은 tick은 MISSED_WINDOW로 건너뛴다. 입력 응답 script는26개·개별2MiB 이내다. 실제 전송함수나 callback을 받지 않고 기존 `fakeSend`에만 연결한다.

시각은 Fixture 검증을 통과한 ledger의 `simulationTime()`이 DB `clock_timestamp()`로 읽는다. worker 획득 뒤 날짜·authorization·due를 다시 확인하고, 각 intent/send의 기존 DB 시간 검증도 유지한다. 역행은 세션의 마지막 tick과 영속 `lastEventAt`으로 차단한다. 다일 시험의 가상 시계는 **tests/postgres/allium-schedule.test.mjs의 새 소유 Fixture query wrapper 안에만** 존재한다. 제품 시계 주입 옵션·SQL 설정·DDL 변경은 없다. 이 시험은 실제 시간 경과나 운영 스케줄 실행 증거가 아니다.

## 중복·불명·예약 보존

worker를 얻기 전과 후 원장을 읽으며 그날 usage 또는 예약이 있으면 DAY_CONSUMED로 종료한다. 별도 연결의 worker 충돌과 같은 실행기 내 동시 tick은 추가 송신을 허용하지 않는다. 이전 미완료 예약은 PRIOR_INCOMPLETE다. 공급량/전송량의 기존 순서·상태 polling 상한·응답 검증을 재사용하고 각 fakeSend 전 exact checkpoint를 게시한다. 실제 providerRequests/scheduleWrites는0이다.

commit 성공 후 ACK 유실은 영속 intent/UNKNOWN을 보존하며 재전송하지 않는다. 완전히 rollback된 usage에는 영속 intent가 없지만 자동 재시도하지 않으며 별도 명시 tick만 다시 검토할 수 있다. 송신 gate 실패로 poisoned된 publisher의 잠금은 재획득/삭제하지 않는다. 읽기 전용 관측은 별도로 보존한 trusted checkpoint를 사용하며 publisher 재시작 차단과 원장 관측을 구분한다. 만료·UTC일 전환·worker lock 상실은 fakeSend를 차단한다.

성공한 가상 날짜도 예약을 해제하지 않는다. pending 누계·할당기간·정책·cap 검사와 c_i=0을 그대로 사용하며 날짜/월이 바뀌었다는 이유로 초기화하지 않는다. 비용 귀속·최종성·실제 통제는 계속 UNKNOWN/UNCONFIRMED다. 새 schedule hash는 실제 실행 승인이나 조직 한도 보장이 아니다.

## 검증

단위 검사는 일정 변조·날짜/개수/시간 경계·역행·동시 tick을 확인한다. 새 소유 PG17에서는 다일 성공과 중복/재시작·missed day·잘못된 날짜 authorization·usage rollback/commit ACK 유실·송신 commit ACK 유실·publisher 잠금 보존·별도 연결 충돌·연결 단절·만료/UTC일 전환/worker lock 상실·누적 예산/월 경계 차단을 확인한다. 명령·rc·검사 수는 이번 인계문에 기록한다.

Lead `85fd6917c9df4e5e83058d987bac9d68`의 revise_plan 조건인 시험 전용 시계·유한 UTC 입력·기존 DB 시계/보호 보존을 반영했다. 검토 응답을 실제 수집 승인으로 사용하지 않는다.
