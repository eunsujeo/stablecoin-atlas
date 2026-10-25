# Market MISS 쿼리 성능 개선

## 입력과 범위

사용자가 제공한 운영 관측: `/market-data.json` 응답3299ms, DB100회/누적2914ms, 권한 검증약81ms, 연결 재사용·대기거의0ms. 이번 세션에서 운영 로그/SQL 실행 계획을 직접 취득하지 않았으며 이 숫자는 사용자 보고다. 로컬 소스·새 소유 PG17 Fixture만 사용했다. [ADR0110](../adr/0110-market-miss-query-batching.md). Redis/새 인프라·Collector·FX·캐시/풀 변경·운영 Mac mini/DB 접근0.

## 100회 분류

새 Fixture의 catalog 설치·history v4 정규화·reader 역할과 동일한 checkout/시장 읽기/정리 경로에서100회를 재현했다. 이는 `pg.Client.query` 호출/직렬 왕복 수이며 한 번의 SET 호출 안에 여러 SQL문이 포함될 수 있다. 구조나 선택 스키마가 다른 환경은 숫자가 달라질 수 있다. 정적 등록 정보 대조는 값 조회가 아닌 **검증**으로 분류했다.

| 구분 | 기존 | 변경 | 내용 |
| --- | ---: | ---: | --- |
| 검증 | 80 | 44 | 서버 버전·역할·grant·컬럼/시퀀스 권한·스키마 hash/RLS/정책·등록 정보 |
| 데이터 | 8 | 8 | series 목록·관측 sample·count·network·health·catalog·daily source/value |
| 세션 설정·트랜잭션·정리 | 12 | 12 | SET6·BEGIN2·COMMIT2·ROLLBACK1·DISCARD ALL1 |
| 합계 | 100 | 64 | checkout10·시장88→52·정리2 |

기존100회 번호의 범위(전부 포함):

| 번호 | 구분 | 작업 |
| --- | --- | --- |
| 1,2,4,10 | 세션 | checkout 설정·트랜잭션 |
| 3,5–9 | 검증 | checkout 버전·role·grant·전체 atlas 쓰기 경로 |
| 11,13,18 | 세션 | 시장 snapshot 시작·설정·구조 조회 search_path |
| 12,14–17,19–34 | 검증 | 시장 role·schema/policy/partition·권한·registry |
| 35–39 | 데이터 | series·sample·count·network·health |
| 40–55,57–66 | 검증 | catalog 존재·role·권한·schema/policy·reader grant |
| 56 | 세션 | catalog 구조 조회 search_path |
| 67 | 데이터 | token profile |
| 68–83,85–95 | 검증 | history 존재·role·권한·schema/policy·reader grant |
| 84 | 세션 | history 구조 조회 search_path |
| 96–97 | 데이터 | daily source·value |
| 98–100 | 세션 | 시장 COMMIT·반환 ROLLBACK·DISCARD ALL |

통합한 그룹과 절약 왕복: `safeRole`의2조회×5곳→1조회×5곳(5), market 정책4→1(3), market 권한3조회×3곳→1조회×3곳(6), registry4→1(3), catalog reader 권한3→1(2)/정책 등8→1(7), history reader 권한3→1(2)/정책 등9→1(8). 합계36회. 반복 role/권한 판정은 삭제하지 않았다. SET LOCAL·schema 존재/버전/구조 확인과 이후 검사·최종 data 조회의 의존 순서는 유지했다.

## 순차 왕복과 실행 계획

원래 await 체인은 pg 단일 세션에서 직렬 실행됐다. 같은 세션에 Promise.all만 추가하면 pg 큐가 직렬 전송하므로 왕복을 줄이지 못한다. 대신 동일 snapshot 안의 독립 검증 SELECT를 한 문장에 묶었다. bind 값은 SQL에 보간하지 않으며 데이터 금액은 batch JSON으로 옮기지 않는다. JSON 숫자는 안전한 정수만 허용하고 원래 bigint text/OID·boolean·null·배열 순서/rowCount를 대조했다.

Fixture는205개 관측(고정 소수 문자열)·8프로필·history v4와 오래된 가상 request50,000개를 포함한다. 모든 SELECT/WITH의 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`을 동일 로컬 reader로 읽고 노드/행수/loop/정렬/버퍼를 저장했다. 공급자·운영 DB 데이터나 키를 사용하지 않는다.

확인한 SQL 경로:

- 관측 sample: 기간/series 조건의 partition index scan → WindowAgg2개 → sample+latest 중복 제거 → provenance join/최종 정렬. 약200개 출력이며 기간 내 전체 표본을 계산하는 비용은 남는다. 기존 sample의 끝점·정렬·최신값 포함과 별도 count를 보존했다.
- counts: 관측 partition index scan과 집계. 네트워크: network별 LATERAL/관측 bitmap scan·최신 정렬. catalog:8행 seq scan/정렬. history:source/latest/value 인덱스 경로지만 이 성능 Fixture의 history 값은 비어 있다. 실데이터 이력 정합성은 기존 history 시험으로 확인하며 빈 이력 계획을 운영 성능 근거로 쓰지 않는다.
- **health의 기존 SQL은 request50,205행 seq scan/hash join 후 external merge sort**를 수행했다. 최신 요청 한 건만 필요한데 전체 이력을 정렬했다. 정의별 LATERAL LIMIT1로 먼저 줄인 뒤 기존 그룹별 DISTINCT ON을 적용해 정렬 입력을1행으로 줄였고 기존 인덱스를 사용한다. 버전이 달라도 마지막 시각/ID 우선 선택은 같다. 새 인덱스를 설치하지 않았다.
- role의 전체 쓰기 경로 검사와 structureHash의 catalog UNION/정렬도 별도 비용이 있지만 검사를 생략하지 않았다. 운영 SQL 통계/분포/통신 시간을 확보하지 않아 운영의2914ms 중 서버 실행과 RTT의 비율은 미확인이다.

로컬 관측 한 회(운영 개선율 아님): 직렬100회136.3ms→통합64회75.1ms. 쿼리마다 가상10ms 지연을 넣은 시험1397.1ms→898.7ms. health EXPLAIN 실행37.097ms→0.058ms. 워밍/순서·플래너/표본 크기에 따른 변동이 있으므로 시간 자체는 시험의 합격 조건으로 고정하지 않는다. 테스트는 정확한 쿼리 수·내용 동등성·거절 조건을 고정한다.

예상 효과는 왕복36% 감소다. 예를 들어 실제 RTT가20~30ms라면 왕복에서만 약720~1080ms를 줄일 수 있으나 이는 조건부 추정이다.3299ms에서 약2.2~2.6초 수준은 이 가정 아래의 예상이며 운영 보장이 아니다. health 효과도 운영의 요청 이력/정의 수와 플랜에 달려 있다.

## 수행·실패·검증

1.100회 재현/분류, 작은 Fixture의8개 data SQL 실행 계획을 먼저 읽었다. 소스/캐시/풀 분석과 이력50,000건의 추가 대조로 health의 전체 정렬을 확인했다.
2. Lead `667a6bfe5a304c3bb1c02411b5700581`: proceed. 검증 생략 금지·의존 순서·bind/pg 반환형·실패 폐기·snapshot 대조 조건을 반영했다. 처음 작성한 history 그룹의 writer_grant 조회는 v1/v2에 테이블이 없으므로, 실행 전에 버전>=3일 때만 그룹에 포함하도록 수정했다. 외부 취득/실패나 운영 재시도는 없다.
3. 응답 전체 동등·고정 소수 정밀도·scope 일회 소비/폐기·bind 비보간·unsafe JSON 숫자 거절·오류 후 rollback 회복을 추가했다. 정책 추가·NO FORCE RLS·컬럼 쓰기 grant를 각각 거절하고 복구 후 새 snapshot이 성공함을 확인한다. health는 여러 정의 버전/같은 시각의 ID tie와 SUCCESS/FAILED/NOT_ATTEMPTED/PARTIAL/RECORDED를 기존 SQL에 대조한다. 기존 시험은 schema 부재/미허가·v1/v2/v3/v4·해시/구조 drift·동시 snapshot·캐시 만료/실패·풀 폐기를 검증한다.

최종 검증은 모두 성공했으며 시험 실패0이다. 로그/Fixture 계획은 `.state/agent-logs/market-miss-*.log`, `.state/agent-logs/market-miss-profile.json`에 남긴다. 위 단독 실행 수치는 `.state/agent-logs/market-miss-profile-first-reviewed.json`에 보존했다. 최종 재실행에서도100→64회와 기존 `collection_request_latest` 사용을 확인했다. 원문/키/RPC URL은 Git/Web에 게시하지 않는다.

| 명령 | rc | tests/pass/fail/cancelled/skipped |
| --- | ---: | --- |
| `npm run check` | 0 | 622/622/0/0/0 |
| `npm run check:production` | 0 | 23/23/0/0/0 |
| `npm run check:db` | 0 | 59/59/0/0/0 |
| `node --test tests/market-validation-batch.test.mjs tests/postgres/market-performance.test.mjs` | 0 | 5/5/0/0/0 |
| `git diff --check` | 0 | — |

## 재현과 후속 범위

기존 설치 Node/패키지·Docker28+·이미 캐시된 `postgres:17-alpine`에서 위 명령을 실행한다. Fixture는 새 이름/소유 label·loopback·독립 network·tmpfs·`--pull never`로 생성·정리한다. 환경의 DB URL을 읽지 않는다. profile JSON에100회 census와 변경 후 수·개별 실행 계획을 재생성한다.

후속은 사용자가 제공한 새 SHA의 비밀 제거 계측 로그와 이번64회 기대치를 대조하는 것이다. 실제 운영 SQL 계획 취득·운영 배포/조회/DB 변경은 이번 작업에 포함하지 않으며 별도 사용자 지시가 필요하다.
