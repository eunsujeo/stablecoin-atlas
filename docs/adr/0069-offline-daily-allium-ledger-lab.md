# ADR0069 — 비활성 Allium 일별 계획과 오프라인 예산 원장 Lab

## 승인과 범위

2026-10-23 사용자는 남은 작업 중 권고한 1~3단계인 비활성 일별 계획·예산 계산기·조직 공통 예약 원장의 오프라인 구현과 장애 검증 진행을 승인했다. 설계 정본은 [ADR0068](0068-daily-allium-design-and-cost-controls.md)이다. 이번 구현은 **가상 권한·가상 usage·가상 응답과 새 소유 PostgreSQL17 Fixture만** 사용한다. 실제 Allium/usage/SQL 호출, 운영 DB 설치, 기존 예약 전환, 동적 날짜 자료 import/화면, 스케줄, 기본 공급자 전환은 수행하지 않는다.

`executionEnabled=false`, `providerRequests=0`, `billingStatus=UNCONFIRMED`를 유지한다. 기존 `allium:execute`와 연결하지 않으며 새 실행·설치 CLI나 운영 enable 경로가 없다. 로컬 모듈 API와 시험 명령만 추가한다. 가상 통제의 true 필드는 실제 공급자 통제 증거가 아니다.

## 계획·권한·계산

`tools/allium-daily-plan.mjs`는 공개 로컬 registry/metadata와 기존 alliumPlan을 사용한다. 명시 UTC일 D의 `[D-7,D)`·11배포·supply/volume SQL2개를 고정하고 매 검증 때 재생성해 전체 구조와 hash를 비교한다. registry는 일별 job에서 제외하고 XRPL은 NOT_TESTED로 보존한다. 2run·최대26HTTP+usage1·GET/POST 재시도0·77행/78 sentinel·페이지1·응답2MiB를 정책에 결합한다. compute 항목은 고정된 기본 정책 식별자이며 실제 공급자 profile을 확인했다는 뜻이 아니다.

권한은 `ALLIUM_DAILY_SIMULATION_AUTHORIZATION`만 허용하며 실제 strict/manual authorization과 혼용하지 않는다. schema/단위/조직·키·통제·가상 전환 hash, 일별 planHash, 별도 청구/할당/한도 구간, 최대1시간 lease, 일별/기간 예산과 run별 상한을 검사한다. 새 키도 같은 조직 예산을 사용한다. 같은 할당기간 안의 예산 정책을 임의 변경하지 않는다.

EU는 최대18자리 소수의 십진 문자열과 BigInt로 처리한다. 금액 Number·음수·지수 표기·정밀도 초과·누락을 거부한다. ADR0068의 네 입장 산식을 적용하고 registry는 **회계 전용 예약**으로만 조직 총량에 합산한다. registry SQL이나 가상 송신 경로는 추가하지 않는다.

이번 원장에는 대사 차감/환급 API가 없으며 **c_i=0**이다. 성공 응답의 비용 meta·시간 경과·새 usage만으로 P를 줄이지 않는다. 가상 실행이 성공해도 상한 전액은 예약 누계와 pending에 남는다. 다음 할당/한도기간으로 귀속이 바뀌면 자동 초기화하지 않고 차단한다. 이는 보수적인 검증 기반이며 실제 기간 전환·대사 구현 완료가 아니다.

## Fixture와 원장

`tests/postgres/fixture.mjs`가 생성한 Docker28+/PG17의 소유 label·loopback publish·새 tmpfs 데이터·단독 network를 확인한다. 그 안에 실행별 난수 이름의 새 DB를 만들고 비밀이 아닌 가상 marker를 붙인다. 새 모듈은 loopback client·DB명/marker·초기 namespace 공백을 검사한다. 생성·소유 확인은 시험 harness가 수행하며 **marker만으로 임의 서버의 소유권을 인증하지 않는다**. 운영 환경변수·DB URL 파일을 읽거나 기존 DB를 탐색하지 않는다.

`atlas_allium_daily_lab`의 configuration/entry는 private schema·FORCE RLS·최소권한을 적용한다. 소유자/reader는 runtime 쓰기를 수행하지 못하고, NOBYPASSRLS 일반 writer만 SELECT/INSERT를 받는다. UPDATE/DELETE/TRUNCATE·설정 변경·함수 직접 호출은 허용하지 않는다. trigger는 SECURITY INVOKER·고정 pg_catalog search_path이고 PUBLIC 함수 권한이 없다. 원래 role이 다른 role을 상속하거나 다른 role에 부여되면 차단한다.

각 이벤트는 조직·ordinal·이전 hash·canonical payload hash를 연결한다. DB trigger도 조직 잠금·순서/hash를 검사하며 usage UTC일과 예약 slot은 unique index로 보호한다. 읽기와 쓰기 모두 구조·migration hash·ACL·RLS·trigger/함수 정의·role을 확인하고 전체 의미 replay를 수행한다. 읽기는 repeatable-read다. 조직당8192개 이벤트/16MiB, 이벤트3MiB 상한을 둔다. 원장·응답은 가상 Fixture 자료이며 제품 보고서나 실제 공급자 receipt가 아니다.

조직 advisory transaction lock 아래 예약·누계 검사를 원자화한다. usage도 UTC일당 단 한 번의 intent를 commit하고 실패/미응답/만료 뒤 같은 날 다시 선점하지 못한다. usage 감소·기간 불일치·신선도 초과를 오류로 처리한다.

## commit·연결 상실과 가상 송신

예약은 RESERVE commit의 성공 응답을 받은 후 별도 CONFIRM_RESERVATION을 남긴다. 첫 commit 응답이 불명확하면 예약은 UNKNOWN으로 남고 중복 예약을 거부한다. 두 commit의 성공 응답을 모두 받은 현재 handle만 후속 intent를 만들 수 있다. 예약 확인·intent의 성공 응답 여부는 메모리에도 보존하며 재시작으로 복구했다고 추정하지 않는다. 이번 단계에는 자동 resume이 없다.

가상 작업자는 조직 session advisory lock·backend PID·난수 token으로 구분한다. 매 intent와 FAKE_SEND 직전 DB 시각·lease·plan/권한·총예산·선행 job 상태·현재 session lock을 재검증한다. intent를 먼저 별도 commit하고, 그 성공 응답을 받은 현재 handle만 FAKE_SEND 이벤트를 기록할 수 있다. commit 응답 유실·연결/잠금 상실·새 프로세스는 옛 intent의 가상 송신을 수행하지 못한다. FAKE_SEND는 **DB의 가상 이벤트 기록**이며 네트워크 송신·외부 callback이 아니다. 이 시험으로 실제 네트워크 송신의 원자성이나 exactly-once를 인증하지 않는다.

create→run→status(각최대10회)→result의 순서와 supply 완료 뒤 volume 진행을 검사한다. create/run 반복·응답 없는 intent의 반복·다른 job 선행을 거부한다. status 실패는 FAILED, polling 소진·접수/응답 불명·금액/행 검증 실패·절단·비용 상한 초과·미검토 echo는 UNKNOWN으로 다음 job을 막는다. 원래 응답은 가상 원장에 남기고 실패를 비용 환급이나 SQL 재실행 사유로 사용하지 않는다.

실제 HTTP transport가 없으므로 polling2초 대기·HTTP20초 timeout을 수행하는 실행기는 아니다. 이 값은 계획에 고정된 후속 실행 정책이며 가상 시험의 wall-clock 지연이나 실제 호출 속도 검증으로 표시하지 않는다.

result는 기존 조사 검증기를 통해 실제0/null·십진 문자열·식별자·기간·완전성을 검증한다. exact SQL echo만 수용하며 ADR0066의 원문별 manifest를 일별 자동 승인으로 승계하지 않는다. 원문별 검토/import-only 복구는 후속 범위다.

## 검출 한계와 검증

hash replay는 중간 변조·순서 오류·의미가 잘못된 직접 INSERT를 검출한다. 그러나 **유효한 원장 꼬리 삭제/과거 백업 복원을 신뢰된 별도 checkpoint 없이 증명할 수 없다**. handle이 이미 확인한 head 또는 호출자가 제공한 trusted checkpoint보다 짧거나 다른 원장은 차단한다. 처음 접속한 무기준 reader에는 `REQUIRES_TRUSTED_CHECKPOINT`를 표시하며 누락 검출 보장을 하지 않는다. 별도 영속 checkpoint 보관·복원 대사·기존 예약 전환은 아직 미구현이다. 권한 있는 writer/DB 관리자가 일관된 가상 증거 전체를 조작하는 경우를 공급자 인증이나 암호학적 진실성으로 막는 제품도 아니다.

```sh
npm run check:allium-daily
npm run check
```

첫 명령은 새 소유 로컬 PG Fixture와 가상 자료만 사용한다. 정확한 비용 경계·조직/registry 합산·키 교체·같은 날 경합·예약/intent commit 유실·INSERT 후 rollback·두 독립 Node 프로세스의 worker 잠금/연결 상실·실제 DB 시각 만료·UNKNOWN 보존·usage 단발/감소·기간 경계·권한/구조/체인 변조·trusted checkpoint와 무기준 검출 한계를 검증한다. 실제 결과는 이번 인계문에 기록한다. 실제 소비 상한이나 운영 보안·기간 전환 완료로 확대하지 않는다.

Lead `3c8b9b23d8364048a6338c7418e36c4e`의 proceed 조건을 반영했다. 해당 검토는 실제 수집·기존 예약 전환의 승인이 아니다. 다음 작업은 기존 예약/소비의 전환 계획과 신뢰된 checkpoint/대사 검토이며, 운영 자료를 다루기 전에 별도 범위를 확인한다.
