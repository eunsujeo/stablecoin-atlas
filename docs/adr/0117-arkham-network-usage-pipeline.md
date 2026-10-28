# ADR0117: Arkham 수동 수집·불변 DB·명시 출처 UI

- 상태: 사용자 고정 승인 아래 최초 실제5GET·Supabase 반영 완료/소비. [실제 결과](../research/2026-10-28-network-usage-live.md). 자동 반복/운영 배포 제외.
- 날짜: 2026-10-28

## 결정

기존 등록 USDT Ethereum/TRON/Solana와 USDC Ethereum/Solana의 histogram을 수동 한 묶음으로 취득하고 검토한 뒤, 별도 private atlas_network_usage에 불변 snapshot으로 저장한다. 기존 Allium schema·판정·금액을 바꾸거나 Arkham 결과를 Allium으로 위장하지 않는다.

원본/승인/계획/authorization/송신 전 intent/receipt는 기존 .state/allium-executor root의 새 날짜별 슬롯에 비공개 보존하고 기존 공통 송신 lock을 사용한다. 이미 소비한 Arkham2GET 슬롯은 재사용하지 않는다. 부분 수신·실패·429는 중단하며 재시도/페이지/endpoint전환은 없다. 다섯 응답을 모두 검증한 묶음만 projection하며 전부 빈 응답이면 원문을 보존하고 DB 입력용 자료는 만들지 않는다.

providerTime 원문·원래 집계일/요청시각/hash·숫자 lexeme를 유지한다. API가 생략한 버킷은 MISSING/null이며0을 만들지 않는다. explicit0과 구분한다. histogram에 없는 토큰 수량·고유 트랜잭션 수는 null/미지원으로 남긴다. PROVIDER_DAY/집계 시간대 UNKNOWN, 마지막 초의 하위 초 범위 미확인을 보존한다.

DB의 source payload는 최대35관측칸(5배포×7일)을 담은 JSON snapshot1건이다. 기존 writer의 SELECT/INSERT와 reader의 SELECT만 추가하며 RLS/FORCE RLS·불변 trigger·구조 hash·정책/유효 접근 검사로 보호한다. 같은 id의 중복 입력은0건, 다른 내용 충돌은 거절하며 실패 transaction은 rollback한다. reader는 window와 원 조회시각 순으로 고르므로 늦게 입력한 오래된 관측으로 되돌아가지 않는다.

GET/HEAD /network-usage-data.json은 DB reader만 사용한다. 웹/서버 시작/화면 전환은 공급자를 호출하지 않는다. 5분 서버 캐시와 기존 공통 IndexedDB/요청 병합/동시성2/429/UTF-8/AbortSignal 경로를 적용한다. 화면의 Arkham/Allium 출처는 명시 선택하며 오류 시 다른 공급자로 자동 전환하지 않는다. 같은 자산/출처/window/집계일만 비교하고 평균은 비중/합계에 사용하지 않는다.

## 최초 실제 실행 — 완료·소비

정본 [계획](../../data/arkham-network-usage-20261028-plan.json): UTC요청2026-10-21T00:00:00Z~2026-10-27T23:59:59Z, granularity1d. 최대5GET/0run·각2MiB/총10MiB·각20초/총120초·간격1초·재시도/추가페이지/redirect0, 비용 UNCONFIRMED. 기존 키만 사용한다. 이것은 최초 단발 범위이며 자동 반복·일별 스케줄/사용량 조회·운영 Mac mini 배포 승인이 아니다.

검증된 실자료 확보 후에만 신규 schema init·기존 두 역할 grant·snapshot1건 import·동일 reader/로컬 화면 대조를 진행한다. 기존 schema/자료/권한과 Data API 유효 경계를 전후 검사한다. 실패/미완료이면 실제 DB를 변경하지 않는다.

## 검증

가상 fetch·새 소유 PG17·loopback/Chrome Fixture로 요청 예산/소비/보존/숫자/날짜/중복·원자성·권한·source 선택·마지막 정상·단위/모바일·캐시를 확인한다. 실제 iPhone/WebKit과 Chrome의 Safari API 부재 조건 모사는 구분한다. 실제 첫 실행의 성공을 로컬 준비 결과로 대신하지 않는다.
