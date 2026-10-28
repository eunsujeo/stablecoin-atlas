# Arkham 수집→DB→UI 경로 준비 — 2026-10-28

이 문서는 실행 전 준비 기록이다. 이후 사용자 승인으로 [실제5GET·Supabase 반영](2026-10-28-network-usage-live.md)을 완료·소비했다. 아래의 미실행/확인 대기는 준비 당시 상태이며 현재 정본은 실제 결과를 따른다.

사용자가 최신 자료 수집·DB 저장·화면 연결 진행을 요청했다. 기존 단발2GET 승인은 소비 완료이므로 재사용하지 않는다. 먼저 [ADR0117](../adr/0117-arkham-network-usage-pipeline.md)의 전체 로컬 경로와 [최초 고정 실행안](../NETWORK_USAGE_COLLECTION.md)을 구현/검증했다. **실제 공급자 호출·키 읽기·Supabase init/grant/import·운영 배포는 아직0**이다. 가상 결과를 실제 자료로 올리지 않았다.

## 준비한 경로

1. 기존 registry의 USDT Ethereum/TRON/Solana, USDC Ethereum/Solana와 고정2026-10-21~27 histogram5개 계획을 만들고 registry/metadata·계획 전체 hash로 고정했다. 최초 예산은5GET/10MiB/120초/재시도0·자동반복0, 비용 UNCONFIRMED다. 정확한 요청/주소는 data/arkham-network-usage-20261028-plan.json을 따른다.
2. 수동 실행기는 기존 root/common lock과 새 날짜별 exclusive slot을 사용한다. 송신 전 intent·승인/authorization·원문·부분 수신·hash·바이트/시간/실패를 영속 보존하고 기존 근거 manifest를 대조한다. 웹/서버 시작/화면 요청과 연결하지 않았다.
3. 오프라인 projector는 계획/receipt/승인/hash·요청 인자·전체 완료·partial/크기/시간을 검사하고 strict UTF-8/JSON·중복 key·숫자 lexeme·중복/범위 밖 버킷을 확인한다. 5배포×7일35칸의 관측/누락으로 정규화하며 raw providerTime·원 집계일/요청시각/출처 hash를 보존한다. 일부 날짜의 생략은 MISSING/null이다. 전부 빈 응답이면 API 근거만 보존하고 DB용 snapshot을 만들지 않는다.
4. 별도 private atlas_network_usage에 immutable snapshot을 저장하는 CLI·DDL·최소권한 grant·구조/정책/유효 API 경계 검사를 준비했다. runtime writer SELECT/INSERT, reader SELECT만 허용한다. 같은 입력 추가0·충돌 거절·transaction rollback을 지원한다. 조회는 window와 원 queried_at을 우선해 늦게 입력된 오래된 자료가 최신 자료를 덮지 않는다.
5. DB reader→GET/HEAD /network-usage-data.json→기존 검증/IndexedDB 경로→전체 현황을 연결했다. 새 API와 서버 캐시는5분이며 같은 기존2MB보다 엄격한128KiB DTO 한도를 사용한다. 서버/화면은 공급자를 호출하지 않는다. Arkham 수집 저장과 Allium 기존 저장을 명시 선택하며 실패 시 다른 공급자로 자동 전환하지 않는다. 지표 선택/출처 전환 자체는 새 요청을 만들지 않는다.

Arkham histogram에는 토큰 수량/고유 트랜잭션 수가 없어null/미지원으로 보존한다. USD/전송 이벤트 수와 이벤트당 평균만 제공한다. PROVIDER_DAY/집계 시간대 UNKNOWN과 마지막 초의 하위 초 범위 미확인을 유지한다. 평균은 합산/비중화하지 않고 사람/고래/안전성/결제량으로 판정하지 않는다.

## 실패·검토와 수정

- 첫 DDL pin 작업은 기존 structureHash의 namespace 허용목록에 새 schema가 없어 INVALID_IDENTIFIER로 중단했다. structureHash와 유효 API 경계 검사에 정확한 atlas_network_usage만 추가했고 기존 검사 query/namespace는 유지했다.
- 초기 시험의 문법/옮긴 함수 export 이름 오류를 수정했다. 둘 다 가상/새 소유 Fixture 단계이며 실제 API/DB에는 닿지 않았다.
- 최초 schema pin 뒤 원 queried_at 우선 정렬을 보강해 다시 고정했다. 이어 전체 MISSING 방어 CHECK를 추가해 최종 pin은5a19f99626ccd958de1357795eb4fed2327b4fad30644b34e7e6cd06a449d905다. 이전 시험 pin 파일은 비공개에 보존했으며 실제 DB에 적용한 이전 버전은 없다.
- Lead 3eba93ff5ded459095b0feed0d532dc1의 조건으로 raw providerTime을 DTO/reader에 추가했고 하위 초 포함 불확실성을 명시했다. 새 문서/공급자 조회는 하지 않았다.
- Lead 19672e75da0c483888740e259744d0f0은 projector와 별도로 직접 import가 전체 MISSING을 허용하는 우회를 발견했다. 공통 validator와 SQL CHECK에 최소1개 OBSERVED 조건을 넣었고 올바른 hash의 전체 MISSING CLI 입력/직접 SQL 입력 거절 및 기존 snapshot 유지 시험을 추가했다. 정상 묶음의 일부 MISSING은 계속 허용한다.

## 검증

- 가상 수집/원문·snapshot·reader/API 시험12개: 다섯 고정 GET/1초 간격·기존 근거 보존·슬롯 재소비 차단·승인/계획 변경·미완료 날짜·403/429/redirect/timeout·부분/2MiB 초과·숫자/중복 key·날짜/버킷·빈 묶음/미지원·캐시/안전 오류 응답을 확인했다.
- 소유 PG17: 동시 동일 입력은1/0, 동일id 다른값 거절, INSERT 뒤 예외 rollback, 오래된 queried_at의 역전 방지, 전체 MISSING import/직접 SQL 거절과 기존 자료 유지, reader/writer/owner·PUBLIC/Data API·role전이·default privilege·trigger/hash tamper를 확인했다. reader→실제 loopback HTTP JSON도 원 snapshot과 대조했다. 기존 asset-review PG17 회귀와 함께2시험 통과/실패0이다.
- Chrome 가상 화면: 1440/390px·두테마·Safari stream API 부재 조건에서 기존 Allium과 새 Arkham의 명시 선택·두 지원 지표/tx 미지원·숫자/시각·빈 칸/평균·last-good/오류·자동 fallback0을 확인했다. 새 Arkham API 읽기는1회, 재독은 IndexedDB, 출처/지표 전환 요청0·외부요청/JS오류0이다. 실제 iPhone/WebKit 시험은 아니다.
- 오프라인 production/FX·실제 Chrome IndexedDB 캐시 회귀도 통과했다. 초기 전체 검사713개는 통과했고 이후 방어/시험 보강을 반영한 최종 npm run check는715개 통과/실패0(rc0)이다.

로그는 비공개 .state/network-usage-pipeline-20261028에 보존한다. 재현 명령은 [운영 안내](../NETWORK_USAGE_COLLECTION.md)를 따른다. 실수집 CLI 실행으로 시험을 재현하지 않는다.

## 실제 적용 전 확인할 범위

고정5GET·비용 미확인과 실제 새 private schema init/기존 두 역할 grant/검토된 snapshot1건(최대35관측·누락칸) 입력/동일 reader·로컬 화면 확인을 사용자에게 제시한다. 기존10개 schema의 구조/자료·비공개 원본·판정을 유지하며 미검토 definer/노출 경계 문제가 있으면 중단한다. 실패·부분·전부 빈 수집에는 DB 작업을 시작하지 않는다. 운영 Mac mini·자동 반복·새 키·추가 페이지/다른 지표/공급자 fallback은 제외다.
