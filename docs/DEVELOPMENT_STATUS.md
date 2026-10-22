# 현재 개발 상태

기준: 2026-10-22. 이 문서는 다른 PC/새 작업 세션이 읽는 Git 공유 인계다. 로컬 `.state`나 API 키가 없어도 코드의 범위와 다음 행동을 파악할 수 있도록 유지한다.

## 완료 범위

- 대시보드는 실제 자산의 저장 조회만 표시한다. 개발용 Fixture는 UI 집계/목록에서 제외하고 원본·CLI 검사는 보존한다. 이 PC의 UI는8보고서/111항목, 원본 저장소는15보고서/202항목이다.

- Overview 자산별/네트워크별 검증 랭킹: SCENARIO_SUCCESS_V1의 통과 점수·판정 완료 비율을 항목 수로 합산하고 정렬 기준을 선택한다. 미산정은 순위 없음, 정확한 동점은 공동 순위다. 시장 지표와 분리한다. [ADR0043](adr/0043-overview-asset-network-rankings.md), 최종 검토 상태는 최신 인계문을 따른다.
- 기본 Overview: 실제 자산의 시나리오 통과 점수·잠정 등급·판정 완료 범위·결과별 항목 이동, 유통량·현재 총공급량 참고 순위. 기존 집계 공식은 [ADR0038](adr/0038-overview-scenario-results.md), 현재 화면 범위는 ADR0043을 따른다.
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

원본 집합을 가진 PC에서는15보고서/202항목을 복원할 수 있다. ADR0038 이후 원본5개 시장 입력의 기초 관측은18개이며, 이 PC는 단발 수집 자료와 합쳐30개를 보존한다. 과거 입력의 시각과 기존 XRPL의2개 관측은 그대로다. 새 PC에서의 새 관측·새 실행으로 해석하지 않는다. 원본 집합은 Git에서 제외한다. 웹60초 갱신은 저장본만 읽는다.

## PostgreSQL 설계와 로컬 CLI

사용자가 Supabase/PostgreSQL과 다수 스테이블코인·네트워크 확장을 전제로 설계를 요청했다. [ADR0039](adr/0039-postgresql-market-storage-design.md)의 후보 DDL·범위/지표별 시계열·공통 요청 근거·legacy 이전·용량/조회 설계를 작성했다. 로컬 격리 PostgreSQL17.11에서 제약 시험과 합성30코인×3지표×1440분의129,600관측을 측정했다. 메타데이터/인덱스 포함 약42MB/일이며 원문·backup은 별도다. 정본은 [저장 설계](design/POSTGRESQL_MARKET_STORAGE.md), 실제 수행/미검증 구분은 [검증 기록](design/POSTGRESQL_MARKET_VALIDATION.md)이다. [ADR0040](adr/0040-postgresql-market-import-and-query.md)의 명시적 init/partition/grant/import·저장/제한 조회 CLI와 서버 환경 연결을 구현했다. 격리 로컬 DB에서 기존30관측/네트워크6행 이전·legacy/바이트/시각 보존과 재이전, 실제 비관리자 역할/RLS·동시성·rollback을 검증했다. [실행 안내](POSTGRESQL_MARKET_CLI.md). 실제 Supabase/운영 DB 연결·웹 DB 전환·배포는 아직 하지 않았다. ADR0042의 `market:watch --database`와 읽기 전용 `market:db:check`를 구현했으며, 소유 로컬 DB로 저장/접속 점검/복구를 검증했다. 실제 Supabase 설정과 원격 성공은 미확인이다. [새 프로젝트 설정](SUPABASE_SETUP.md).

## 아직 구현하지 않은 것

- 계정별 rate/credit 예산, 무제한 daemon/자동 재시작, 자동 재시도/backoff, 자동 공급자 전환. 수동·주기 수집 모두429를 기록하고 중단한다.
- 실제 Supabase/운영 DB 적용·DB 웹 조회 API/화면 전환·롤업/보관기간 정리·서비스 배포·공개 호스팅.
- 실제 안전성 점수/등급. Overview의 시나리오 통과 점수는 별도 집계다. 가상 `Market preview`의 점수는 제품 판정이 아니다.
- 네이티브/브리지별 중복 제거, 서로 다른 공급자의 공급량 정의 통일, registry v2/기존 화면의 동일 coin/network 복수 deployment 매핑(DB schema는 허용).
- 거래량 순위: totalVolume 기간·단위 확인 전 비교를 보류한다.
- Arkham WebSocket. 현재 목표에는 도입하지 않기로 했다.

## 다음 개발 단위

다음 연결 단계는 Supabase 프로젝트와 앱 전용 로그인·서버 TLS/secret/접속 경로를 준비하고, CLI 안내에 따라 명시적으로 적용하는 것이다. 웹의 DB API/화면 전환은 후속 구현이다. 수집기 DB 저장은 명시 `--database`로 선택하며 실제 Supabase 실행은 설정 이후에 한다. 현재 검증은 소유한 격리 로컬 DB이며 운영 Supabase 접속은 하지 않는다. 승인된5분 주기는 별도 CLI에서만 실행한다.

새 PC는 `npm ci` → `npm run setup` → `npm run doctor`로 준비한다. 과거 근거는 별도 이동 파일을 가져와 두 publisher로 복원한다. 시장 자료만 새로 받으려면 `.env.local`의 ARKM_API_KEY를 설정하고 `npm run market:collect`를 명시적으로1회 실행한다. 새 collected 이력은 기존14원본 이동 파일에 포함되지 않는다.

무제한 운영 전 계정 한도·기간·요청별 크레딧을 확인해야 한다. 승인된 로컬 확인은 프로세스당 실행 상한을 적용한다. usage1회는 HTTP200 및 totalLimit10000이었으나 잔여량/기간/단가 계약은 미확인이다. 이번 실행은 usage1건과 자료7건이었다. 사용자 화면 수는 외부 요청 수를 늘리지 않는다.

2026-10-22 공식 문서 재확인에서도 거래량 기간·단위와 계정 한도 정의를 확보하지 못했다. 상세4문서는 Cloudflare HTTP403이었다. 당시 거래량 순위·주기 수집은 보류했고 새 인증 API 호출은 하지 않았다. 후속 승인에 따른 제한된5분 수집은 ADR0041로 확장했다. 조회별 결과와 재개 조건은 [조사 기록](research/arkham-volume-and-budget-review.md)을 따른다. 현재 PC의 doctor는 통과했으며 물리적으로 다른 PC 검증은 미실행이다.

수집 실패 시 마지막 정상값·원본 관측 시각·실패 상태를 보존한다. 누락·명시적0·메서드 오류·미지원은 다르다. XRPL과 Arkham의 다른 지표를 단순 fallback으로 서로 대체하지 않는다. 새 체인/토큰은 먼저 registry와 공급자 식별자 출처를 연결하고 미확보 범위를 표시한다.

## 검증 기준

직전 Git 체크포인트는 `c3e9557`이며 연구형 시장 화면과 기존 엔진 검사225개가 통과했다. 이동 기능과 새 checkout 보정 후231개가 통과했고, 단발 수집 검사 추가 후 전체236개가 통과했다(실패·취소·skip0). 키/보고서/의존성 없는 격리 소스에서 npm ci, 환경 진단,14원본 복원,15보고서/202항목·14시장 관측의 바이트/hash·시각/판정 일치, 두 화면의 Chrome 확인을 수행했다. 고정 TRON compiler는 공식 로더로 준비하고 무변경 재사용·손상 시 무실행/무재다운로드 거부를 확인했다. 초기 검사에서 실제 Solana 보고서와 TRON cache에 대한 숨은 의존성을 발견해 보정했다. 현 실행 환경은 macOS/ARM64, Node25.2.1이다. 같은 머신의 격리 checkout 검증과 물리적으로 다른 PC/OS에서의 검증을 구분한다.

큰 기술 결정은 [ADR0035](adr/0035-stored-market-observations.md), [ADR0036](adr/0036-portable-local-workspace.md), [ADR0037](adr/0037-manual-market-collector.md)를 따른다. 실제 키·환경변수 값·RPC URL·보고서 원문·개인 SSH 설정은 이 문서에 기록하지 않는다.

수집 실사용 검증은 Arkham 자료7회 모두 성공·관측14→26개·기존 XRPL 시각 유지였다. 브라우저에서는3코인·같은 코인 체인2/3/1순위, RLUSD의 실제2점 이력, 저장 재독/읽기 실패 유지, 다크/라이트·390px 화면·202개 근거 항목·프로필/비교를 확인했다. 기존 QA의 RLUSD1점 고정 가정은 새 실제 관측으로2점이 되어 실패했으며, 공급량을 바꾸지 않고 기대 관측 수를 갱신했다. 브라우저의 외부 요청은0건이었다.

Overview 보강은 기존 입력을 오프라인 재정규화하여 총공급량3개와 기간·단위 미확인 거래량1개 관측을 추가했다(26→30). 새 외부 조회나 새 과거 시각을 만들지 않았다. 현재 판정 규칙/순위 범위는 ADR0038을 따른다.

Overview 변경 후 전체 검사는241개 통과(실패·취소·skip0). Chrome에서 기본 Overview·#validation·#live, 범위 분리와 원시FAIL 이동, 다크/라이트·390px·읽기 실패 유지·외부 요청0건을 확인했다.
