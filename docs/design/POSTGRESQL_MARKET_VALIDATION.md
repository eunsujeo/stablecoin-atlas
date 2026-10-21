# PostgreSQL 시장 설계 검증 기록

기준: 2026-10-22. 대상은 [후보 DDL](postgresql-market-schema.sql)과 [설계 문서](POSTGRESQL_MARKET_STORAGE.md)다. **제품 DB 연결·이전·자동 수집의 완료 기록이 아니다.**

## 실행 환경과 격리

macOS/ARM64의 로컬 Docker, 이미 캐시된 `postgres:17-alpine`, 실제 엔진 PostgreSQL17.11 / aarch64 Linux musl을 사용했다. 이번 작업이 생성한 새 컨테이너·빈 cluster·tmpfs 데이터 경로이며 network none, host port 바인딩 없음, PostgreSQL listen_addresses 빈 값이었다. 원격 Supabase·다른 DB·체인 RPC·운영 키를 사용하지 않았다. 후보 schema의 최종 전체 적용과 아래 부정 시험은 정상 종료했다. 측정은 새 cluster에서 seed 후1회 결과를 사용했다.

## schema·제약 검증

[합성 fixture SQL](postgresql-market-validation.sql)의 `DESIGN_SQL_VALIDATION_PASS`를 확인했다.

- 같은 코인/네트워크의 두 deployment가 공존하고, subject의 누락/과잉 scope·잘못된 deployment 소속·중복 subject를 거부했다.
- metric scope·provider·endpoint·요청 정의/series 불일치를 거부했다. XRPL의 다른 issuer 대상 연결과 shape의 issuer 불일치를 거부했다. 실제 issuer/RPC 검증이 아니라 합성 대상 제약 시험이다.
- 관측 시각과 요청 시각 불일치, 요청에 없는 series,0을 가진 MISSING·값 없는 OBSERVED, 음수·NaN·Infinity·소수37자리·상한 초과 수량을 거부했다.
- 2^53을 넘는 수량의36자리 소수와 네트워크 tip 정수를 정확히 유지했다. 명시적0과 누락은 구별됐다.
- 값이 같은 다음 시각의 재관측, 같은 artifact/endpoint/시각이지만 원본 배열 위치가 다른 별도 요청을 모두 보존했다. 동일 run key와 동일 observation PK 중복은 거부했다. 이는 DB 제약이며 내용 충돌 검사까지 하는 import CLI는 아직 없다.
- 과거 관측을 조건부 upsert해도 성공 최신값이 역전되지 않았다. 실패/미실행 요청에는 합성값을 생성하지 않았다. 실제 writer의 실패→OBSERVED 차단은 별도 미구현 조건이다.
- legacy ID/groupId·원본 selector·기존 deployment와 COIN_NETWORK 관측의 연결을 저장했다. 불명확한 거래량 단위/기간은 UNKNOWN/NULL/UNCONFIRMED로 유지했다.
- UTC bucket 정렬과 종료시각 제외를 확인했다. 세션을 America/New_York로 바꾸고 DST 종료일인2026-11-01의 일별 bucket도 UTC 경계로 검사했다.
- 정책 없는 RLS에서 비소유 역할의 부모 테이블 조회는0행, insert와 자식 파티션 직접 접근은 거부됐다. 실제 서버용 역할·정책/권한 설계가 완료됐다는 뜻은 아니다.

요청 성공/RECORDED import의 OBSERVED 검증, XRPL 실제 원장 연결, 정의 불변성, 최신 캐시의 성공 상태 강제, 충돌 내용 비교·batch rollback은 writer·DB 권한 통합 시험으로 남는다. 과거 보고서 import를 실제 수행하거나 바이트/시각/개수 대조를 한 것은 아니다.

## 합성 용량·조회 측정

[용량 SQL](postgresql-market-capacity.sql)의 `DESIGN_CAPACITY_MEASUREMENT_PASS`를 확인했다. PostgreSQL core 기능만 사용했다. 대상은30코인·코인별3지표·하루1440분으로 **90시계열,43,200요청,129,600관측**이다. 요청마다 별도 합성 projection artifact 메타데이터를 저장했고,1응답에서3관측을 얻는 분포다. 실제 공급자 값이 아니며 파일/객체 원문은 저장하지 않았다. 전체 시험 쓰기는 ROLLBACK했다. 롤백이 즉시 파일 크기를 원복하는 것은 아니므로 재측정은 새 cluster에서 해야 한다.

| 구분 | 물리 증가 바이트 | 약 MB(10진) |
| --- | ---: | ---: |
| 관측 fact+인덱스 | 17,170,432 | 17.17 |
| 요청+인덱스 | 11,165,696 | 11.17 |
| artifact 메타데이터+인덱스 | 13,590,528 | 13.59 |
| schema 내 테이블·인덱스 합계 증가 | **41,959,424** | **41.96** |

관측 tuple의 평균 `pg_column_size`는63바이트였으나 fact+인덱스는 관측당 약132바이트, 요청·artifact 등까지 배분하면 약324바이트였다. 한 행 크기만으로 DB 용량을 판단할 수 없다. 같은 분포를 단순히30배 하면 월 약1.26GB이며 원본 파일·backup·WAL·provider/시계열/오류 분포 변화·Supabase 플랫폼 공간은 별도다. 무료500MB가 며칠을 보장하는지 단정하지 않는다.

동일 로컬 실행의 EXPLAIN(ANALYZE,BUFFERS):

| 조회 | 관측된 계획/실행 시간 |
| --- | --- |
| 단일 series의 최대1200점 | 월 fact PK Index Scan,0.310ms |
| 최신 요청, 전용 인덱스 제외 | 요청 Seq Scan+sort,1.575ms |
| 최신 요청, 전용 인덱스 포함 | request latest Index Scan,0.062ms |
| 성공 최신값90개와 fact 연결 | 작은 cache와 fact PK 조회,0.325ms |

이 결과를 근거로 request health용 `(definition_id, observed_at DESC, id DESC)` 인덱스를 후보 DDL에 포함했다. 짧은 로컬/단일 실행이며 네트워크 응답 시간·콜드캐시·다중 writer·실사용 Supabase latency·SLA를 검증하지 않는다. 다중 월의 대형 운영 partition pruning과 원본 archive/restore·장기 집계 재작성·대량 import 성능은 아직 미검증이다.

## 재현 순서와 후속 검증

같은 **새 disposable DB**에 `psql -X -v ON_ERROR_STOP=1`로 DDL → validation → capacity 순서로 전달한다. 기존 schema나 다른 DB에 재실행/덮어쓰지 않는다. validation은 별도 합성 schema/역할을 만들고 capacity는 임시 데이터를 넣었다가 rollback한다. 역할명과 schema가 이미 있으면 실패하도록 설계했다. 실제 Supabase 콘솔에 이 SQL을 붙여넣는 운영 절차가 아니다.

다음 구현 단위는 explicit import/writer·읽기 repository·bounded API·서버 역할과 secret 연결이다. 실제 자료 이전 시 기존14원본과 collected projection을 구별하고 hash·legacy ID·selector·범위·시각·값·확정 원장 일치와2회 import 멱등성·충돌 rollback을 검증한다. 보관기간/삭제·외부 주기 수집·원격 적용은 별도 후속 범위다.

Lead 검토 `4344e9ccd8cc45188b6e71bb5d41f661`은 revise_plan이었고, 과거 요청/IMPORT 단위 구분·typed issuer 대상·동일 시각 요청 보존·단일 series 응답 상한·UTC/DST·DDL/용량 검증의 구분을 반영했다. Lead 자체가 PostgreSQL을 실행하거나 원격 상태를 검증했다는 뜻은 아니다.
