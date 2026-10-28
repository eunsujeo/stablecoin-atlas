# ADR0119: 확장 활동 snapshot과 운영 일별 수집

- 날짜: 2026-10-28
- 상태: 구현·기존 Supabase 적용·로컬 화면 확인 완료. 운영 설치/활성화 미실행.

사용자는 저장된18조합의 Supabase/UI 반영과 운영 자동 수집을 요청했고 자동 실행임을 명확히 했다. 기존 v1/35행/구조 버전/판정을 보존하고 별도 snapshot_v2(126행), upgrade_version, collection_day만 추가한다. 기존 writer INSERT/reader SELECT·RLS/FORCE RLS·불변 trigger·Data API 차단과 실제PG17 구조pin 검사를 유지한다. 반복 입력은0이며 최신v2 읽기는 같은 창의v1보다 우선한다.

브라우저 v1을 계속 검증하면서 v2의18개7일 series·등록33개 availability·sourceReceipts를 지원한다. 누락2일과 미수집15쌍을 구분하고 원시각/금액/출처를 보존한다. 서버/브라우저5분 cache, 요청 합치기, Safari getReader, 기존 시장·FX 동작은 유지한다.

운영 수집은 UTC00:20 하루1회 직전7일18GET/36MiB/420초, 간격1초/요청20초/재시도0이다. DB의 불변 날짜PK 선점과 DB UTC당일 predicate로 다른 PC/새root/재시작 중복을 차단한다. 선점 후 실패는 소비하며 complete 원문은0GET으로 게시만 복구할 수 있다. 새 daily root와 공통lock 구현을 사용하고 기존 소비를 재사용하지 않는다. UTC day/lease를 영속화 후 fetch 직전에 다시 검사한다. 전체범위가누락이면 게시하지 않아 last-good를 보존한다.

최대31일의 명시적 period authorization에 policyHash·기간·일별/누적 GET/bytes·비용UNKNOWN_ACCEPTED를 요구한다. 예제는30일540GET/1080MiB 제안이며 승인파일로 가장하지 않는다. 실제 timer 설치·기간 승인 생성/활성화·새 API 호출·운영 Mac mini 직접 배포는 이번 구현으로 수행하지 않는다. 사용자 자동수집 선호와 실제 새 공급자 호출 예산/운영 설치를 구분한다. [운영 절차](../NETWORK_USAGE_AUTOCOLLECTION.md)와 [실제 적용/검증 기록](../research/2026-10-28-usage-v2-supabase-auto.md)을 따른다.
