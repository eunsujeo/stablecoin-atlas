# Stablecoin Atlas 첫 페이지 Reader 성능 개선

## 범위와 분석

사용자 보고는 `/market-data.json` 약4.7초, 다른 JSON API1~2초다. 이번 작업은 저장소/로컬 Fixture 분석과 수정·검증·commit/push이며 운영 서버/Supabase/공급자를 조회하지 않는다. 사용자 보고 시간을 이번 세션에서 측정한 값으로 표시하지 않는다. [ADR0109](../adr/0109-web-reader-performance.md).

Overview는 여러 JSON을 동시에 요청한다. 기존 `productionConnector`는 전체 동시2개·대기8개로 제한하면서 매 API cache miss마다 `connectDatabase`로 새 pg.Client/TLS 세션을 만들고 전체 권한을 검사한 뒤 종료했다. 따라서 최초 병렬 요청은 슬롯 대기를 겪고 후속 miss도 연결 비용을 반복한다. 시장 응답 캐시의10초 TTL은 화면60초 재독 사이에도 만료된다. market/catalog/history의 다수 순차 쿼리와 검증도 확인했지만 운영 연결/권한/쿼리별 시간을 관측하지 않아 어느 부분이4.7초의 주원인인지는 단정하지 않는다.

## 변경과 유지 조건

- production Web만 최대2개 연결을 재사용한다. idle30초/수명300초, 대기8개/10초, TLS/DB timeout/Reader 최소 권한을 유지한다. 추가 infra/의존성/DB DDL은 없다.
- 매 checkout마다 전체 권한을 검사한다. 반환 전 쿼리 완료를 기다리고 ROLLBACK·DISCARD ALL을 별도 쿼리로 실행한다. 정리에도2회 round trip이 들며 계측에 포함된다. 반환한 facade는 query/end로 다음 lease에 영향을 줄 수 없다.
- 시장 캐시는 기본300초, 성공 단일2MiB 이하, refresh 단일 실행이다. `ttlMs`는 로컬 생성 옵션으로1~300000ms만 허용하며 운영 config/env/키 형식은 바꾸지 않는다. cache hit 동안 원래 관측시각을 유지하고, 만료 후 읽기 실패는503이며 오래된 성공본으로 대체하지 않는다. 다른 API 캐시와 실패 cooldown은 유지한다.
- 전체 권한 검증의 세션 간 TTL 캐시는 추가하지 않았다. 같은 snapshot이라는 이유로 역할/권한 검사를 공유하지 않았다. cache hit의 검증된 응답 재사용으로 불필요한 재연결·재검증을 줄이고, cache miss의 보안/스키마/내용 검사는 보존한다.
- API 본문·오류 코드·HTTP no-store/등록 history ETag·브라우저 갱신 주기·실제 수집 갱신 정책은 그대로다. FX는 공개 JSON 응답 시간만 측정하며 서비스/파일 검증은 수정하지 않는다. Collector/Supabase 스케줄러/FX 서비스 파일은 변경하지 않는다.

## 계측 읽는 법

production `startProduction`은 JSON API 요청마다 `ATLAS_API_TIMING`을 stdout/journal에 기록한다. `startPreviewServer`의 `onTiming`을 주면 로컬에서도 같은 계측을 수집할 수 있다. 공개 JSON 응답에 진단 값을 추가하지 않는다.

| 필드 | 의미 |
| --- | --- |
| route/method/status/aborted | 고정 API 경로·GET/HEAD/OTHER·HTTP 상태·응답 중단 여부 |
| dbWaitMs | 연결 슬롯 대기 시간; timeout/거절 대기 포함 |
| dbConnectMs | 새 물리 연결 open 시간; 재사용이면0 |
| dbVerifyMs | checkout 전체 권한 검증 시간 |
| dbQueryMs/dbQueryCount | 검증·데이터·트랜잭션·반환 정리 쿼리의 누적 시간/수 |
| dbReused | 해당 요청이 재사용한 연결 수 |
| responseMs | 요청 처리 시작부터 응답 finish/close까지 시간; DB 대기·직렬화 포함 |
| cache | 시장 HIT/MISS/COALESCED; 다른 API에는 추가하지 않음 |

dbVerifyMs는 dbQueryMs와 겹치므로 합산하지 않는다. DB 쿼리는 요청한 API의 AsyncLocalStorage 문맥에 귀속한다. 병합된 후속 요청은 자체 DB 쿼리0이며 responseMs는 refresh를 기다린 시간이다. FX는 DB를 사용하지 않아 DB 필드0이다. 소수점2자리 ms는 작은 로컬 시간을0으로 반올림할 수 있다. responseMs는 브라우저 렌더링/인터넷 왕복 시간이 아니다. SQL·인자·쿼리 문자열·인증·접속 URL·오류 원문은 출력하지 않으며 secret canary로 확인한다.

## 수행 경로와 검토

1. 인계 상태와 관련 Web/Reader·연결·캐시·검증·기존 시험을 대상으로 확인했다. 운영 접속은 하지 않았다.
2. 로컬 Router shadow 추천을 사용했다. 동시성 경계 확인 후 Lead `7ab018046d204cbdbe8164e3ea439270`의 `revise_plan`을 수신했다. 권한 검증 공유를 피하고 새 lease facade·query/COMMIT/ROLLBACK/idle error 폐기·진행 중 쿼리 반환 대기·close/open/verify 경합·사설 PG 검증 조건을 반영했다. 모델/effort 또는 운영 승인을 변경한 것이 아니다.
3. 기존 connector를 소유 세션 풀로 바꾸고 시장 TTL/계측만 연결했다. 공통 Collector용 connection/transaction/권한 검사 코드는 수정하지 않았다.
4. 만료/반환 경계를 검토하며 슬롯 대기 실패 시간도 기록하고, 타이머가 아직 실행되지 않은 수명 만료 세션도 checkout에서 폐기하도록 보완했다. 기존10초 기대 시험은 새300초 경계로 변경했다. 풀 도입 후 시작 중 포트 충돌/Reader probe 실패 시 idle 연결이 남을 수 있는 경로를 검토에서 발견해 시작 실패 시 풀 종료와 시험을 추가했다. 병합 시험은 두 요청 수신을 확인한 뒤 gate를 해제해 시간 의존성을 줄였다. 원래 API 실패를 성공으로 바꾸지 않았다.
5. 시험 결과와 재현 명령은 아래에 기록한다. 도구 실패/사이트 자료 부재나 운영 측정 결과로 대체한 항목은 없다. 실제 운영 latency·기존 data 규모의 query plan·CPU/메모리 변화는 미확인이다.

## 검증과 재현

모든 DB 시험은 새 소유·loopback PG17 Fixture이며 운영 DB 접속은0이다. 사설 시험의 TLS transport만 주입하며 production TLS 필수 검사는 유지한다. 작업은10월25일 시작해26일(KST) 최종 검증을 마쳤다.

| 재현 명령 | rc | tests/pass/fail/cancelled/skipped |
| --- | --- | --- |
| `npm run check` | 0 | 618/618/0/0/0 |
| `npm run check:production` | 0 | 23/23/0/0/0 |
| `npm run check:db` | 0 | 58/58/0/0/0 |
| `node --test --test-reporter=tap tests/production-performance.test.mjs` | 0 | 8/8/0/0/0 |
| `node --test --test-reporter=tap tests/postgres/production.test.mjs tests/postgres/preview.test.mjs` | 0 | 2/2/0/0/0 |
| `git diff --check` | 0 | 해당 없음 |

초기 기본 검사는617개/production22개 통과였고 시작 실패 정리 시험을 추가한 뒤618개/23개로 재검증했다. 실행한 검사에 실패·skip은 없다. 신규 합성 시험은 시장 요청 두 개를 한 refresh로 병합하고,5분 내 hit가 DB 쿼리0임을 확인한다. 만료 후503·다음 재시도 회복·금액/원래 시각/응답 bytes 유지·등록 등 기존 회귀를 검증했다. 동일 물리 세션을 여러 refresh와 activity 요청에서 재사용하는 것을 확인했으며, 실제 인터넷/TLS 지연 감소율로 해석하지 않는다. 새 PG 시험에서는 backend PID 재사용·갱신 전후 snapshot 분리·PUBLIC column grant 변경 시 다음 checkout 거절·이전 facade 차단·READ ONLY/실제 DML 거절을 확인했다.

로그: `.state/agent-logs/web-performance-{initial,targeted,postgres,check,production,db}.log`. raw DB/공급자 원문·URL·키를 Git/Web에 남기지 않는다.

## 후속 범위

운영 배포는 이번 요청에서 금지됐다. 이후 사용자가 제공하는 새 SHA의 Web 계측 로그(비밀 제거)에서 MISS/HIT·dbWaitMs·dbConnectMs·dbVerifyMs·dbQueryMs·responseMs를 비교할 수 있다. 운영 적용/조회 없이 실제 지연 감소율을 주장하지 않는다. 추가 쿼리/인덱스 최적화는 이 계측의 병목 근거를 검토한 뒤 별도 작업으로 진행한다.
