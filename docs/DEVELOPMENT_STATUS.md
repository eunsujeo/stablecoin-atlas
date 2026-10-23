# 현재 개발 상태

기준: 2026-10-23. 이 문서는 다른 PC/새 작업 세션이 읽는 Git 공유 인계다. 로컬 `.state`나 API 키가 없어도 코드의 범위와 다음 행동을 파악할 수 있도록 유지한다.

## 완료 범위

- 대시보드는 실제 자산의 저장 조회만 표시한다. 개발용 Fixture는 UI 집계/목록에서 제외하고 원본·CLI 검사는 보존한다. 이 PC의 UI는8보고서/111항목, 원본 저장소는15보고서/202항목이다.

- Overview 자산별/네트워크별 검증 랭킹: SCENARIO_SUCCESS_V1의 통과 점수·판정 완료 비율을 항목 수로 합산하고 정렬 기준을 선택한다. 미산정은 순위 없음, 정확한 동점은 공동 순위다. 시장 지표와 분리한다. [ADR0043](adr/0043-overview-asset-network-rankings.md), 최종 검토 상태는 최신 인계문을 따른다.
- 기본 Overview: 일반 이용자를 위한 토큰·네트워크별 공급량 추이·네트워크별 공급량 비교·시장 비교표를 먼저 표시한다. 기술 검증은 기본 접힌 전문가용 보조 영역에 두고 검토한 자산/네트워크 수·통과 점수·판정 완료 범위·항목 이동을 제공한다. 기존 집계 공식은 [ADR0038](adr/0038-overview-scenario-results.md), 현재 화면 범위는 ADR0043을 따른다.
- EVM/ERC-20·TRON 읽기와 프로그램이 생성한 격리 사설 Fixture 검사.
- Solana mint/명시 Token Account, XRPL issuer/명시 holder trust-line의 공통 읽기. 공개망 거래·서명·실제 관리자 권한 행사는 없다.
- 로컬 저장 근거의 항목별 현황, 자산 프로필·비교, 보고서 문서. 소스 확인과 실제 실행 판정을 구분한다.
- 실제 저장 시장 자료 화면 `#live`: 코인 전체 유통량 순위, 같은 코인의 체인별 총공급량, 관측 이력·원본 수량·출처, 공급자 네트워크 상태. UI는 다크/라이트·모바일을 지원하며 순위 행 선택으로 비교 대상을 바꾼다.
- 시장 그래프: 가격·유통량·코인 전체 총공급량의 영역형 차트, 순위별 작은 추세선, 기간 선택·포인터/키보드 관측 선택·원본 출처 연결. 의미와 저장 이력 제한은 [그래프 안내](MARKET_CHARTS.md)를 따른다.
- 등록 모델: coin/network/deployment ID, 계약·mint·issuer+currency 식별. 현재3코인/4네트워크/8발행 자산. 등록은 Adapter 지원 인증과 별도다.
- Arkham 체인별 `totalSupply`와 전체 `circulatingSupply`를 분리한다. XRPL `gateway_balances.obligations`는 별도 범주이며 순위·합계에 섞지 않는다.
- 서버 수동 단발 Arkham 수집(`npm run market:collect`): 최대7회 읽기·실패 중단·공통 writer 잠금·원자적 발행·별도 수집 상태. 웹 요청은 외부 호출을 실행하지 않는다. [ADR0037](adr/0037-manual-market-collector.md).
- 5분 자동 수집 CLI(`npm run market:watch`): 기본12회·최대84 GET 후 종료, 단조 시계·중복 잠금·실패 중단·UI 실행 기록. [실행 안내](MARKET_AUTO_COLLECTION.md), [ADR0041](adr/0041-five-minute-market-collection.md). 웹은 계속 저장본만 읽는다.
- 새 PC 환경 진단·빈 설정 생성·키를 출력하지 않는 읽기 CLI wrapper·고정14보고서 로컬 이동. [설정 순서](NEW_PC_SETUP.md).

원본 집합을 가진 PC에서는15보고서/202항목을 복원할 수 있다. ADR0038 이후 원본5개 시장 입력의 기초 관측은18개이며, 초기 단발 수집 자료와 합친 기초 관측은30개였다. 이후5분 수집 이력은 계속 추가되므로 현재 수량은 최신 인계문과 실제 DB/화면을 따른다. 과거 입력의 시각과 기존 XRPL의2개 관측은 그대로다. 새 PC에서의 새 관측·새 실행으로 해석하지 않는다. 원본 집합은 Git에서 제외한다. 웹60초 갱신은 저장본만 읽는다.

## PostgreSQL 설계와 로컬 CLI

- 확장 등록 DB: [ADR0053](adr/0053-registration-database-and-filtered-history.md)의 별도 atlas_registration v1에 검토 metadata/측정 계약·상위10 선정·불변 일별 source/coverage/value를 보관한다. owner 수입과 reader의 coin/metric/selection/날짜 제한 조회를 제공하며 기존 수집기/대시보드는 유지한다. 실행은 [등록 안내](MARKET_REGISTRATION.md), 실제 Supabase 적용·행 수·검증은 최신 인계문을 따른다.
- 추가 네트워크 백필: USDT10/USDC10/RLUSD2 조합에 일별 유통량·발행 잔액13,206개 값을 저장하고 원문/DB 대조와 재수입 추가0을 확인했다. JPY를 포함한 총15,000개 값이며 [날짜별 확보 범위](TOP10_NETWORK_BACKFILL.md)는 시리즈마다 다르다. 그래프 연결은 ADR0054를 따르며 새 영역의 일별 자동수집은 ADR0055를 따른다.
- 확장 공급량 UI: [ADR0054](adr/0054-registered-supply-overview.md)의 별도 index/history read-only endpoint로 Overview에5코인·최대10개 네트워크를 연결했다. 기존 시세/검증 랭킹과 분리하며 짧은 이력·날짜 공백·JPY 단위·발행 잔액을 구분한다. [ADR0055](adr/0055-registered-daily-collection.md)에서 검토된 선정에 고정한5코인 일별 수집·최소 권한 writer·코인별 예약/실패 격리를 추가했다. 매일 상위10 재선정·서비스 자동 재시작은 후속이다.

사용자가 Supabase/PostgreSQL과 다수 스테이블코인·네트워크 확장을 전제로 설계를 요청했다. [ADR0039](adr/0039-postgresql-market-storage-design.md)의 후보 DDL·범위/지표별 시계열·공통 요청 근거·legacy 이전·용량/조회 설계를 작성했다. 로컬 격리 PostgreSQL17.11에서 제약 시험과 합성30코인×3지표×1440분의129,600관측을 측정했다. 메타데이터/인덱스 포함 약42MB/일이며 원문·backup은 별도다. 정본은 [저장 설계](design/POSTGRESQL_MARKET_STORAGE.md), 실제 수행/미검증 구분은 [검증 기록](design/POSTGRESQL_MARKET_VALIDATION.md)이다. [ADR0040](adr/0040-postgresql-market-import-and-query.md)의 명시적 init/partition/grant/import·저장/제한 조회 CLI와 서버 환경 연결을 구현했다. 격리 로컬 DB에서 기존30관측/네트워크6행 이전·legacy/바이트/시각 보존과 재이전, 실제 비관리자 역할/RLS·동시성·rollback을 검증했다. [실행 안내](POSTGRESQL_MARKET_CLI.md). 실제 Supabase PostgreSQL17.11에 인증서를 검증하는 TLS로 연결하여 초기화·2026-10/11 파티션·writer/reader 전용 로그인과 권한을 준비했다. 명시적 웹 DB 읽기 모드는 ADR0044로 추가했으며 공개 배포는 아직 하지 않았다. ADR0042의 `market:watch --database`와 읽기 전용 `market:db:check`를 구현했으며, 소유 로컬 DB로 저장/접속 점검/복구를 검증했다. 실제 원격 writer/reader의 두 달 읽기 전용 READY 점검을 완료했고 .env.local은 writer로 전환했다. 관리자/reader 접속 정보는 Git 제외 비공개 설정으로 보관한다. 실제 원격으로 기존18파일의246관측/42네트워크 이력을 이전하고18파일 재이전이 모두 UNCHANGED임을 확인했다. 5분 수집은 명시 DB 모드로 전환해 새 projection/JSON과 DB의 원본 hash 및 행 수를 대조했다. 이후 누적 수량은 최신 실행 기록을 따른다. [새 프로젝트 설정](SUPABASE_SETUP.md).

- 공급량 화면 개선: [ADR0056](adr/0056-supply-scale-and-source-cache.md)의 자동 로그 눈금/실제0 분리, 최대10개 목록 높이 제한, 같은 일별 source 재사용/조건부 HTTP, 확장 코인 기본정보 hover를 추가했다.

- 코인 시장 비교표: [ADR0057](adr/0057-global-coin-market-comparison.md)의 등록 v3에 상세 응답의 전체 유통량·USD 가격을 저장한다. Overview는5코인을 연동 통화별로 묶고 기존3코인의 Arkham 지표와 엔화2코인의 일별 지표를 명시적으로 선택한다. 총공급량/24시간 거래량 부재는0으로 대체하지 않는다. 같은 수집 응답을 재사용하며 추가 API 호출은 없다. 실제 적용·검증 상태는 최신 인계문을 따른다.

- 원화 가격·시장표 밀도: [ADR0058](adr/0058-reference-krw-prices.md)에 따라 USD/KRW 선택·ECB 기준일 표시·BigInt 참고 환산을 추가한다. 토큰 정보를 한 줄로 묶고 미확인 거래량 열을 숨겨 여백을 줄인다. 환율은 private 일별 snapshot이며 웹 요청이 수집하지 않는다. 실제 원격 FX timer 설치는 미실행이다.

Allium은 [Explorer 표본](research/allium-samples/README.md)에 이어 [최근 전송량·공급량 차이](research/allium-samples/followup.md)를 분석했다. Ethereum 5코인 전송량 60행의 최신 관측일은 10/21이며 10/22 누락은 0으로 바꾸지 않는다. USDC·USDT 7일 공급량 비교는 날짜 경계와 브리지/준비금 정의 차이를 보여주지만 브리지 원문 상세만으로는 잔차가 남는다. 원본 수치형·실제 마감 시각·다른 체인 지원은 추가 확인 대상이다. 실패 SQL과 교정 실행을 보존했다. 연구 후 전송량 저장·UI는 아래 단계로 연결했으며 공급량 기본 전환·Allium 자동 수집은 미구현이다.

## 토큰 기본정보

- [Allium 다중 체인 저장 조사](ALLIUM_SURVEY_DATA.md): ADR0067의 별도 atlas_survey에 고정11배포·7일 공급량70행·전송량67행과 미일치2행을 snapshot2개로 저장하고 Overview의 종류·토큰·네트워크 필터 표에 연결했다. 재입력0·137관측의 값/null/시각/hash 대조와 기존6개 schema/자료 보존을 확인했다. 누락/미일치와 기존 Ethereum 표본을 보존한다. 시험·화면 검증 결과는 이번 인계문을 따른다. 새 공급자 호출·자동 수집·기본 공급량 전환은 없다.

- [일별 전송량 DB·UI](ACTIVITY_DATA.md): Allium Ethereum5코인 60행을 별도 atlas_activity에 저장하고 전체 현황에 최신 기준일과 표시했다. 같은 원문 replay0·최소 권한·수정 이력·구시각 import·동시성·원자성 검증. 기존 schema와 공급량은 유지한다. Allium 기본/DeFiLlama 보조 방향은 ADR0059이며 공급량 전환·실제 보조 연결·Allium 자동 수집은 후속이다.
- [Allium 조사 계획·단발 실행기](ALLIUM_COLLECTION_PLAN.md): ADR0060/0061의 고정11배포·7일 조사와 영속 예약을 구현했다. 후속 사용자 승인 ADR0065/0066의 수동 예외·GET 지수 백오프·개별 SQL echo 검토로 실제 SQL3회/17HTTP를 완료했다. [실제 결과](research/allium-samples/survey-2026-10-23.md)는 등록11·공급량70·전송량67 OBSERVED이며 Kaia JPYC 일별 미일치·JPYSC 전송량3일 미확보를 구분한다. meta 비용 합계0.13373333333333335EU, 과금 한도 UNCONFIRMED·DB/스케줄 변경0. XRPL2개 NOT_TESTED·공급량 기본 전환·일별 수집 미구현은 유지한다.
- [Allium 별도 공급량 저장·조회](ALLIUM_SUPPLY_DATA.md): ADR0062/0063의 오프라인 CLI·atlas_supply를 기존 비공개 DB에 설치하고 검토 Ethereum USDC/USDT14행 입력·대조·재생0을 확인했다. 기존5개 schema·권한/정책·시장 표본180건·전송량60건 보존. API 역할의 DB 권한·전환 경로와 source pin을 검사했으며 Dashboard exposed schemas는 UNKNOWN이다. [ADR0064](adr/0064-reviewed-allium-supply-preview.md)로 DB 읽기 모드 Overview의 별도 과거 표본 표를 연결했다. 기존 공급량의 기본 전환·실제11배포 지원·일별 수집으로 표시하지 않는다.

- 공급량 차트는 축 눈금에 `눈금 (tokens)`를 표시하고 `1,000억`처럼 정리한다. 가장 큰 네트워크의 최신 실제 값은 선 끝에 별도 색상으로 표시하며 hover/키보드 tooltip 중에는 숨겨 겹침을 줄인다. 로그 축·원본 공급량·증감률 계산은 유지한다.

[ADR0045](adr/0045-token-profile-catalog-and-popovers.md)의 별도 private DB catalog에8개 deployment의 표준·설명·식별자·공식 출처/확인시각을 revision으로 저장하고 reader API로 조회한다. Overview와 시장에서 마우스·키보드·모바일 정보 패널을 제공한다. 실제 Supabase8개 등록/재등록/조회와 기존462관측/78네트워크 이력 보존을 확인했다. 이는 기본정보이며 지원/검증 PASS와 별도다.

## 아직 구현하지 않은 것

- 공급자 계정의 실제 rate/credit 계약 확인, 보관기간 정책, 자동 재시도/backoff, 자동 공급자 전환. 앱의 날짜별 호출 상한과 재시작 가능한 worker는 ADR0048로 구현했다.
- 다수 시리즈의 선택/페이지 조회·롤업/보관기간 정리·서비스 배포·공개 호스팅. 실제 Supabase 이전과 제한된5분 수집 저장은 완료했다.
- 실제 안전성 점수/등급. Overview의 시나리오 통과 점수는 별도 집계다. 가상 `Market preview`의 점수는 제품 판정이 아니다.
- 네이티브/브리지별 중복 제거, 서로 다른 공급자의 공급량 정의 통일, registry v2/기존 화면의 동일 coin/network 복수 deployment 매핑(DB schema는 허용).
- 거래량 순위: totalVolume 기간·단위 확인 전 비교를 보류한다.
- Arkham WebSocket. 현재 목표에는 도입하지 않기로 했다.

## 다음 개발 단위

[ADR0080](adr/0080-bounded-allium-geographic-data.md)의 Allium 지리 자료 수집/UI 요청과 후속 직접 호출 지시를 진행했다. 브라우저 HTML에서 Geo 링크를 확보했지만 문서 로그인이 필요했다. 계정 지리 메타데이터와 공개 공식 geo_balances_daily를 각각 직접1회 조회했으며 합계2run/6HTTP는 HTTP200 뒤 provider `failed`·UNKNOWN으로 종료됐다. 상세 사유는 미확인이다. UI에는 직접 조회한 잔액 INCONCLUSIVE/미확보·사용량/국가간 흐름 NOT_TESTED를 연결했다. 검토된 잔액 집계 표/필터 경로는 가상 자료로만 확인했으며 실제 국가별 숫자는 **미확보**다. 두 슬롯을 재소비하지 않으며 기존 live-once·원문·공급량/전송량을 보존했다. 근거는 [조사 결과](research/allium-geography-availability-2026-10-24.md)를 따른다.

[ADR0078](adr/0078-windowed-survey-storage.md)의 동적7일 기간 저장·조회·표시를 완료했다. 개발 DB의 비파괴 v2 upgrade 후 기존4source/version1·137관측·6schema 보존을 확인했다. 후속 [ADR0079](adr/0079-finite-offline-schedule-simulation.md)는 가상 자료·새 소유 PG17에서 유한 UTC tick 반복 실행과 중복/재시작·ACK 유실·누적 예산·시간 경계를 검증한다. 실제 timer/스케줄·새 공급자/usage 호출·기존 DB 변경은 없다. 실제 반복 실행·비용·예약 범위는 별도 사용자 확인이 필요하며 소비된 live-once를 재사용하지 않는다.

[ADR0077](adr/0077-offline-live-survey-storage.md)로 실제 수집 저장본의 오프라인 입력·기존 표 연결을 완료했다. [저장 현황](ALLIUM_SURVEY_DATA.md)의 source2→4·최신137관측·원래 시각/미일치/누락 보존·기존6schema 불변을 확인했다. 새 Allium 호출·DB schema/권한 변경·일별 자동 수집은 없다. 다음 동적 기간/자동 수집 범위는 사용자 확인 후 결정한다.

[ADR0076](adr/0076-user-authorized-local-live-collection.md)의 사용자 명시 실제 호출 선택으로 로컬 수동 1회 supply/volume CLI와 같은 lease의 개별 echo 검토 checkpoint를 추가했다. [실제 수집](research/allium-samples/live-2026-10-23.md)은 SQL2회/12HTTP 모두200·공급량70/전송량67 OBSERVED이며 Kaia 미일치·JPYSC 전송량3일 미확보를 보존했다. 두 echo 원문별 SOURCE_REVIEWED·최종 SUCCEEDED·legacy 불변을 확인했다. 계정 증거 없이 허용한 실행 예외이며 실제 비용 인증·조직 예산 전환·일별 자동 예약·DB/UI 연결 완료를 뜻하지 않는다. 검증 결과는 해당 인계문을 따른다.

[Allium 실제 비용 증거 제공 가능성 조사](research/allium-cost-evidence-availability-2026-10-23.md)를 완료했다. 공개 CSV/한도 기능 설명은 확인했지만 계정별 설정·요청별 비용 귀속/최종성은 미확인이다. 실제 전환은 계속 차단하며 후속 계정 자료의 비공개 오프라인 검토 범위는 사용자 확인이 필요하다.

Allium 일별 수집의 [설계·비용 통제 검토](adr/0068-daily-allium-design-and-cost-controls.md)를 완료했다. 권고는 비활성 daily 계획·조직 공통 예산 원장부터 검증하는 것이며, 실제 일별 수집은 DISABLED다. 기존 manual-once·고정 조사·UNKNOWN을 유지하고 공급자 강제 한도·초과 과금 설정은 UNCONFIRMED로 남긴다. 이번 검토에서 공급자 API/usage/SQL·DB·스케줄 변경은 없다. 구현과 실제 실행은 별도 후속이다.

후속 사용자 승인으로 [ADR0069의 비활성 일별 Lab](adr/0069-offline-daily-allium-ledger-lab.md)을 구현했다. 1~3단계의 계획·가상 authorization·정확 EU 계산·새 소유 PG Fixture의 조직 공통 append-only 예약/usage/intent/가상응답과 장애 검증이다. 실제 공급자 호출·운영 DB 설치·기존 예약 전환·동적 DB/UI·스케줄은 없다. 대사 차감은 c_i=0으로 닫아 두며 trusted checkpoint 없는 꼬리 삭제 검출은 보장하지 않는다. 다음 범위는 기존 예약/소비 전환 계획과 checkpoint/대사 검토다.

[ADR0070의 전환·영속 checkpoint/대사 검토](adr/0070-legacy-allium-transition-and-checkpoint-review.md)에서 기존 로컬18개 intent/response·3개 UNKNOWN/검토 연결과 전후 원본 무변경을 읽기 확인했다. 실제 전환은 TRANSITION_BLOCKED다. 저장 usage는 run 전 자료이며 할당기간·안정 조직 연결·비용 상한/귀속이 미확인이다. 별도 비공개 검토 JSON만 보존했고 새 호출/예약·운영DB 변경은 없다. 다음 권고는 가상 자료/새 소유 PG Fixture의 영속 checkpoint publisher·복원 대사 검증이며 실제 비용 차감/legacy 이관은 포함하지 않는다.

후속 사용자 승인으로 [ADR0071의 영속 publisher Fixture](adr/0071-offline-durable-checkpoint-fixture.md)를 구현했다. 불변 record·exclusive publisher/CAS·별도 trusted head·pin된 가상 송신 gate와 DB/저장소/공동복원·ACK/commit 유실·옛 intent 차단을 검증한다. 기준까지 함께 복원되는 경우의 freshness는 인증하지 않는다. 실제 legacy는 계속 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0이며 운영 연결/호출/스케줄은 추가하지 않았다. 최신 시험 결과는 이번 인계문을 따른다.

후속 승인으로 [ADR0072의 가상 원문 보존·import-only 복구 Fixture](adr/0072-offline-response-evidence-import-fixture.md)를 구현했다. 원문 바이트와 송신 ancestry를 결합하고 중복 import/commit ACK 유실·복원 오류를 검증한다. 복구 API는 읽기/import/게시만 제공하며 원래 UNKNOWN·예약·c_i=0을 유지한다. 실제 공급자 호출·legacy 이관·비용 차감·운영 연결은 없다. 검증 결과는 이번 인계문을 따른다.

후속 진행으로 [ADR0073의 오프라인 대사 준비 검토 보고서 Fixture](adr/0073-offline-reconciliation-review-fixture.md)를 추가했다. 별도 review-only factory는 publisher를 DB read-only transaction/commit까지 pin하고 exact published head와 원문을 확인한다. 미송신·미import·일반 응답·import 검토와 result 내용을 구분하며 비용 귀속/최종성은 UNKNOWN·c_i=0으로 보존한다. 실제 차감/전환/호출·스케줄·웹 연결은 추가하지 않았다. 다음 범위는 별도 사용자 확인이 필요하다.

[ADR0074의 비용 귀속·최종성 증거 계약](adr/0074-cost-attribution-evidence-contract.md) 설계를 완료했다. 필요한 증거와 향후 시험 기준의 정본이며 공급자 지원·실제 최종성은 미확인이다. 현재 API와 c_i=0을 유지한다. 후속 읽기 전용 가상 증거 검토 구현은 ADR0075를 따른다.

후속 승인으로 [ADR0075의 읽기 전용 가상 비용 증거 검토 Fixture](adr/0075-read-only-synthetic-cost-evidence-review.md)를 구현했다. 조직/키·기간/UTC 경계·정확 EU·operation/송신·포함/최종성 참조·중복 후보·버전/정정 차단 사유를 검토한다. PG reader 조회는 기존 pin/read-only 경계를 유지한다. 가상 일관성만 판정하고 실제 귀속/최종성 UNKNOWN·c_i=0을 유지하며 공급자 호출·실제 배분/전환은 없다. 다음 범위는 별도 사용자 확인이 필요하다.

[ADR0044](adr/0044-read-only-database-market-preview.md)의 DB 읽기 전용 시장 API/화면 연결을 구현했다. `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`로 실행하며 화면에 PostgreSQL 조회 완료와 조회 기간/표본 여부를 표시한다. DB 조회와 수집 상태는 별도다. 기본 `npm run ui`는 기존 JSON 모드다. `collector:registered -- status`로 reader 또는 최소 권한 writer가 일별5코인의 UTC 당일 결과·전체 미종료 예약 수·선정별 마지막 저장 시각·잠금407 관측을 읽기 전용으로 확인한다. 잠금은 건강 보장이 아니며 조회가 수집을 실행하지 않는다. Linux용 두 수집 서비스·코드 밖 영속 경로·로컬 구성 doctor·전환/백업/롤백 절차는 [수집 운영](COLLECTOR_SERVICE.md)에 준비했다. 실제 원격 설치·부팅/재시작·백업 복원 검증은 다음 단계다. 계정 예산·보관 정책·24시리즈 초과 조회 확장도 남았다. 기존 market:watch의 프로세스12회 상한은 유지한다. 후속 ADR0048/0049의 worker는 UTC 하루288회 상한과 DB 예약으로 계속 실행하며 공개 배포는 별도다.

새 PC는 `npm ci` → `npm run setup` → `npm run doctor`로 준비한다. 과거 근거는 별도 이동 파일을 가져와 두 publisher로 복원한다. 시장 자료만 새로 받으려면 `.env.local`의 ARKM_API_KEY를 설정하고 `npm run market:collect`를 명시적으로1회 실행한다. 새 collected 이력은 기존14원본 이동 파일에 포함되지 않는다.

무제한 운영 전 계정 한도·기간·요청별 크레딧을 확인해야 한다. 승인된 로컬 확인은 프로세스당 실행 상한을 적용한다. usage1회는 HTTP200 및 totalLimit10000이었으나 잔여량/기간/단가 계약은 미확인이다. 이번 실행은 usage1건과 자료7건이었다. 사용자 화면 수는 외부 요청 수를 늘리지 않는다.

2026-10-22 공식 문서 재확인에서도 거래량 기간·단위와 계정 한도 정의를 확보하지 못했다. 상세4문서는 Cloudflare HTTP403이었다. 당시 거래량 순위·주기 수집은 보류했고 새 인증 API 호출은 하지 않았다. 후속 승인에 따른 제한된5분 수집은 ADR0041로 확장했다. 조회별 결과와 재개 조건은 [조사 기록](research/arkham-volume-and-budget-review.md)을 따른다. 현재 PC의 doctor는 통과했으며 물리적으로 다른 PC 검증은 미실행이다.

수집 실패 시 마지막 정상값·원본 관측 시각·실패 상태를 보존한다. 누락·명시적0·메서드 오류·미지원은 다르다. XRPL과 Arkham의 다른 지표를 단순 fallback으로 서로 대체하지 않는다. 새 체인/토큰은 먼저 registry와 공급자 식별자 출처를 연결하고 미확보 범위를 표시한다.

후속 국가별 추정 잔액 수집 요청으로 [ADR0081](adr/0081-geographic-balance-collection-diagnosis.md)의 기존 실행 상세 GET1건을 수행해 `You used invalid tables: allium_identity.aggregates.geo_balances_daily`를 확보했다(실제 누적2run/7HTTP). 테이블 거절은 확인했으나 권한/공개 경로 원인은 미확인이다. 같은 SQL을 재송신하지 않았고 현재 계정의 지원 경로 확인이 필요하다. 실제 국가별 금액은 계속 미확보다.

국가-거래소 흐름 후보도 사용자 확인 요청으로 [ADR0082](adr/0082-bounded-country-exchange-flow-query.md)의 기존11배포/고정일 단발 조회를 수행했다. 생성·실행·상태·상세 모두 HTTP200이었지만 run failed이며 동일 query/run/SQL 오류는 `You used invalid tables: allium_identity.aggregates.cex_attributed_flows`다. 이번1run/4HTTP, 지리 조회/진단 누적3run/11HTTP, 실제 흐름 자료 미확보다. 기존 receipt/원문·잔액 화면은 유지했고 새 DB/UI·재시도·usage·공급자 전환은 없다. 상세 및 소비 경계는 ADR0082를 따른다.

[ADR0083](adr/0083-bounded-provider-capability-probe.md)의 사용자 승인 API 접근 표본45개를 검사했다. Arkham20: HTTP200 JSON14·인자오류3·응답크기초과2·HTTP500 1. Allium REST9: HTTP200 JSON7·인자오류1·HTTP500 1. Allium SQL16: 실행성공 표본6(5개 echo 개별검토)·Identity 테이블 거절7·완료미확인3이다. 실제105HTTP/16run·기존 archive 보존, 추가 페이지/재시도/usage0이며 DB/UI는 유지했다. 전체 기능이 사용 불가인 상태가 아니며 자료군별 접근·오류·미검증을 [정본 결과표](research/provider-api-capabilities-2026-10-24.md)로 구분한다. 기존 두 지리 거절은 재호출하지 않았다.

## 검증 기준

직전 Git 체크포인트는 `c3e9557`이며 연구형 시장 화면과 기존 엔진 검사225개가 통과했다. 이동 기능과 새 checkout 보정 후231개가 통과했고, 단발 수집 검사 추가 후 전체236개가 통과했다(실패·취소·skip0). 키/보고서/의존성 없는 격리 소스에서 npm ci, 환경 진단,14원본 복원,15보고서/202항목·14시장 관측의 바이트/hash·시각/판정 일치, 두 화면의 Chrome 확인을 수행했다. 고정 TRON compiler는 공식 로더로 준비하고 무변경 재사용·손상 시 무실행/무재다운로드 거부를 확인했다. 초기 검사에서 실제 Solana 보고서와 TRON cache에 대한 숨은 의존성을 발견해 보정했다. 현 실행 환경은 macOS/ARM64, Node25.2.1이다. 같은 머신의 격리 checkout 검증과 물리적으로 다른 PC/OS에서의 검증을 구분한다.

큰 기술 결정은 [ADR0035](adr/0035-stored-market-observations.md), [ADR0036](adr/0036-portable-local-workspace.md), [ADR0037](adr/0037-manual-market-collector.md)를 따른다. 실제 키·환경변수 값·RPC URL·보고서 원문·개인 SSH 설정은 이 문서에 기록하지 않는다.

수집 실사용 검증은 Arkham 자료7회 모두 성공·관측14→26개·기존 XRPL 시각 유지였다. 브라우저에서는3코인·같은 코인 체인2/3/1순위, RLUSD의 실제2점 이력, 저장 재독/읽기 실패 유지, 다크/라이트·390px 화면·202개 근거 항목·프로필/비교를 확인했다. 기존 QA의 RLUSD1점 고정 가정은 새 실제 관측으로2점이 되어 실패했으며, 공급량을 바꾸지 않고 기대 관측 수를 갱신했다. 브라우저의 외부 요청은0건이었다.

Overview 보강은 기존 입력을 오프라인 재정규화하여 총공급량3개와 기간·단위 미확인 거래량1개 관측을 추가했다(26→30). 새 외부 조회나 새 과거 시각을 만들지 않았다. 현재 판정 규칙/순위 범위는 ADR0038을 따른다.

Overview 변경 후 전체 검사는241개 통과(실패·취소·skip0). Chrome에서 기본 Overview·#validation·#live, 범위 분리와 원시FAIL 이동, 다크/라이트·390px·읽기 실패 유지·외부 요청0건을 확인했다.

Overview 공급량 차트는 토큰 선택 시 확보한 네트워크를 공통 시간·0 기준 공급량 축에 서로 다른 색으로 표시한다. 개별 네트워크 선택도 유지한다. 하단은 실제 관측 업데이트 시각만 표시하고 원본 수량은 hover/키보드 툴팁에 둔다.

과거 일별 유통량은 [ADR0046](adr/0046-daily-network-circulation-history.md)으로 확장했다. 실제 Supabase의 private atlas_history에3자산·8네트워크·2928개 일별 값(2025-10-22~2026-10-22)을 별도 저장했다. 기존462시장/78네트워크 관측과8개 기본정보 및 두 schema fingerprint는 유지했다. Overview에서 DeFiLlama 일별 유통량1년/3개월과 Arkham 최근 총공급량을 구분해 선택한다. XRPL의 오늘 일별 값은 실시간 값이 아니다. 과거 자료는 이번 단발 import이며 이 단계에서는 자동 갱신을 추가하지 않았으며 후속 ADR0048로 일별 일정을 연결했다.

후속 [ADR0047](adr/0047-daily-minted-and-relative-comparison.md)으로 일별 발행량을 별도 저장했다. history v2 명시 upgrade 후6snapshot/16개 지표·네트워크 시계열/5856개 일별 값이다. 기존 circulating payload3개와 core 데이터는 유지했다. Overview는 일별 유통량/발행량만 선택하고 기본 증감률(%)·공급량 규모 전환을 제공한다. 화면에 ‘과거’ 수식어와 최근 Arkham 공급량 선택은 두지 않는다.

[ADR0048](adr/0048-durable-periodic-collection.md)은 history v3 정규화·DB 예약 기반 worker·최소 권한 writer·영속 원문/receipt 복구를 추가한다. 기존 불변 snapshot은 유지하고 같은 날짜/수량의 재저장을 방지한다. 후속 ADR0049에 따라 기본 Arkham5분/UTC일288회, DeFiLlama UTC일1회이며 Linux 배포 파일과 운영 방법은 [수집 서비스](COLLECTOR_SERVICE.md)를 따른다. 원격 서버 배포와 로컬 가동은 구분하며 최신 실제 상태/검사 수는 인계문을 따른다.

[ADR0049](adr/0049-continuous-five-minute-collection.md)은 사용자 요청대로 worker/서버 기본값을288회/UTC일로 변경한다. 명시 owner history v4 전환은 오늘의 기존12회 상한을 올리며 사용 횟수·슬롯·원문과 시장/일별 값은 유지한다.

[ADR0050](adr/0050-yen-and-top-ten-network-design.md)의 JPYC·JPYSC/기존3코인별 최대10개 네트워크 수집은 검토·설계 단계다. 공식 식별자·공급자 coverage와 USD 환산액/수량 차이를 확인했으며 [설계 정본](design/YEN_AND_TOP10_NETWORK_COLLECTION.md)에 구현 순서·DB/조회/예약 확장 조건을 정리했다. 실제 registry·수집기·DB 등록은 아직 하지 않았다.

후속 [ADR0051](adr/0051-registration-metadata-and-unit-preview.md)의 첫 구현으로 version2 등록 후보 metadata, 통화/지표 구분과 최대10네트워크 선정·일별 수량 preview CLI를 추가했다. [등록 계획 안내](MARKET_REGISTRATION.md). 기존 runtime registry·DB/수집기와 분리해 검증하며, 실제 DB 등록/새 코인 대시보드 연결은 다음 단계다.
