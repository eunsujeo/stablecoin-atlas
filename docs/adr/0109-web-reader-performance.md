# ADR0109: Web Reader 연결 재사용과 API 계측

2026-10-25. 사용자 요청: 첫 페이지 병목 분석 후 최소 수정·로컬 검증·별도 commit/push. 운영 Mac mini/Supabase 적용과 Collector·스케줄러·FX 서비스 변경은 제외한다.

## 결정

새 인프라 없이 production Web connector에 최대2개 물리 연결의 풀을 둔다. 대기8건/10초·TLS 검증·기존 쿼리/트랜잭션 제한은 유지한다. 매 대여마다 새 query/end facade를 발급하고 전체 Reader 권한 검증을 다시 수행한다. 반환 전 진행 중 쿼리를 기다리고 별도 `ROLLBACK`·`DISCARD ALL`로 세션 상태를 지운다. 이전 facade는 재사용할 수 없다. 쿼리/검증/정리 오류 세션은 폐기한다. idle30초·수명5분의 연결을 폐기하며 종료 시 open/verify/대기/반환을 회수한다.

시장 성공 캐시의 기본 TTL은10초에서300초로 변경한다. 단일2MiB 이하 값·단일 refresh·동시 요청 병합·수요 기반 만료 갱신을 유지한다. 원래 관측시각/출처/금액은 바꾸지 않는다. 만료 값은 버리고 실패 시 기존503을 반환한다. 자동 선취·타이머 조회·stale fallback·Collector 변경은 없다. 다른 API의 TTL·실패 cooldown·등록 history의10건/8MiB 한도는 유지한다.

캐시 hit는 검증된 동일 응답을 공유하여 반복 DB 검증을 피한다. 풀 연결을 신뢰해 권한 검증을 생략하지 않는다. market/catalog/history의 반복 역할 검사는 PostgreSQL 권한 변경을 고려해 유지한다. 스키마 검증·repeatable-read snapshot·내용 hash·등록 source pin·응답 검증도 유지한다. 이 변경으로 cold query의 실행 계획이나 인덱스를 조정하지 않는다.

production의 고정 JSON API마다 숫자 중심의 `ATLAS_API_TIMING` JSON 로그를 한 번 기록한다. 고정 경로·정규화한 method·status·완료/중단 상태와 시간/쿼리 수만 기록한다. SQL/인자/URL/Host/오류 원문/응답 본문은 기록하지 않는다. 본문과 HTTP 캐시 정책은 유지하며 계측 실패는 API를 실패시키지 않는다. 계측 정의·재현·한계는 [수행 기록](../research/2026-10-25-web-reader-performance.md)을 따른다.

## 검증과 한계

사설 신규 PG17에서 세션 재대여·권한 변경 거부·READ ONLY·스냅샷 격리를 확인한다. 로컬 합성 시험으로 연결 상한·대기/반환 경합·만료/오류 폐기·단일 refresh·TTL·오류 후 회복·기존 응답/비밀정보 제외를 검증한다. 운영4.7초의 세부 원인 비중과 배포 후 실제 개선 시간은 운영 계측 전까지 미확인이다.
