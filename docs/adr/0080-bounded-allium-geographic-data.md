# ADR0080 — 지원된 Allium 지리 자료의 단발 수집·로컬 표시

## 사용자 요청과 범위

2026-10-23 사용자는 Allium의 지원 범위 내 데이터를 수집해 UI에 넣으라고 요청했다. 후속으로 브라우저에서 공식 HTML을 확보해 확인하라고 지시했다. 이번 요청은 새 지리 자료 작업의 근거이며 소비된 [ADR0076](0076-user-authorized-local-live-collection.md)의 승인을 재사용하지 않는다. Arkham의 주소/엔티티 흐름을 국가 통계로 바꾸거나 공급자를 자동 전환하지 않는다.

공식 Identity 페이지의 Geographic Intelligence 링크는 문서 로그인으로 이동한다. 로그인 우회·계정 문의·주소 수집/열거는 하지 않는다. 공개 Aggregate 문서의 국가별 잔액은 결제량·사용량·국가간 송금량과 다르다. 지리 귀속은 공급자 추정이며 거주국 인증이 아니다.

## 유한 계정 스키마 확인

현재 단계는 `ALLIUM_IDENTITY.INFORMATION_SCHEMA.COLUMNS`에서 이름에 geo가 포함된 비-demo 테이블/스키마의 열 정의만 한 번 읽는다. 실제 지리 원문/주소/금액 조회나 사용량 API 호출은 아니다. 이 유료 가능 메타데이터 조회도 사용자 요청의 지원 확인 범위에 포함해 별도 영속 소비한다. 접근권한 미확인은 응답으로 관측하며 실패 후 다른 endpoint·공급자로 전환하지 않는다. 오류/빈 결과를 기능 부재로 확정하지 않는다.

고정 SQL/hash·승인 원문 hash·키 지문·기존 archive hash·15분 lease·1run/13HTTP(생성1/실행1/상태최대10/결과1)·재시도0·2MiB/256행+sentinel/1페이지를 결합한다. LIMIT는 스캔 비용 상한이 아니다. 비용 통제/초과 과금 UNCONFIRMED·조직/타PC 배타성 UNKNOWN·글로벌 예산 미보장·실제 비용 귀속 UNKNOWN을 유지한다. 키 지문은 조직 identity가 아니다.

`tools/allium-geography-cli.mjs plan|prepare|collect|review|status`를 사용한다. 같은 `.state/allium-executor`의 기존 `reservation-lock` 안에서 `geography-once/discovery`를 송신 전 영속 생성한다. 디렉터리는 성공·실패·crash 후 삭제하거나 재소비하지 않는다. 기존 live-once와 legacy 송신 차단은 보존한다. 매 요청 전 lease·HTTP 상한을 검사하고 기존 공통 sender로 intent/원문/receipt를 보존한다.

상태가 불명이거나 SQL echo가 달라지면 추가 송신을 중단한다. 명시 source/SQL hash의 오프라인 개별 검토는 원래 UNKNOWN receipt를 바꾸거나 재송신하지 않는다. 계정 식별자·키·원문은 `.state`의 비공개 파일에만 둔다.

## 후속 데이터와 UI

최초 계획은 계정 메타데이터를 선행 확인하는 것이었다. 아래 후속 사용자 지시로 공식 공개 스키마가 있는 잔액 테이블의 직접 조회만 그 선행 조건에서 예외로 한다. 문서 로그인/메타데이터 성공을 직접 조회의 새 필수조건으로 요구하지 않는다. 스키마를 추측하지 않고 확인되지 않은 교차 상세는 UNKNOWN으로 유지한다. 검토된 집계 DTO만 로컬 읽기 UI로 제공하며 웹 요청/서버 시작은 수집하지 않는다. 자동 반복·스케줄·새 usage·기본 공급자 전환은 없다.

실제 메타데이터1run/3HTTP는 모두 HTTP200이었지만 run 상태가 `failed`로 종료됐다. 상세 오류 본문은 제공되지 않았다. receipt는 UNKNOWN·PROVIDER_RUN_FAILED이며 기존 archive 바이트 보존을 확인했다. 해당 메타데이터의 재시도는0이며 생성·실행 식별자는 비공개 원문에만 보존했다.

`publish`는 원래 authorization·intent·응답 바이트 hash를 오프라인 확인해 고정 필드의 확보 상태 또는 개별 검토된 잔액 집계만 `.state/allium-geography-preview/index.json`으로 발행한다. `/geography-data.json`은 그 저장본만 읽으며 계정·SQL·원문을 제공하지 않는다. 메타데이터 실패를 미지원/권한 부재로 단정하지 않는다.

## 사용자 후속 지시에 따른 공식 잔액 테이블 직접 확인

사용자는 문서 로그인이 안 된다고 답하고, 미확보라도 호출해서 확인하라고 명시했다. 문서 로그인과 API 권한을 분리하고 [공식 Aggregate 스키마](https://docs.allium.so/historical-data/identity/aggregates)의 `allium_identity.aggregates.geo_balances_daily`를 직접 한 번 확인한다. 추측 테이블·동일 메타데이터 재시도가 아니다. 구체적인 대상·기간·SQL은 `allium:geography plan --kind balances`의 고정 계획이다.

기존 주소형11배포·UTC2026-10-22 하루·고정 컨트랙트/mint를 사용하며 원래 대소문자 규칙을 유지한다. country/region·chain/token·date·balance/usd_balance만 읽는다. 양은 TO_VARCHAR로 반환받고 decimal 문자열로 검토하며 null·없는 배포/국가를0으로 채우지 않는다. 3300행+sentinel/2MiB/1페이지·1run/13HTTP·15분·재시도0이다. `geography-once/balances`를 별도로 영속 소비하며 두 고정 슬롯 합계 최대2run/26HTTP다. 이전 discovery·legacy 원문 hash를 실행 전후 대조하고 새 승인 파일과 SQL hash를 결합한다. 동일 키/날짜 변경으로 슬롯을 재사용할 수 없다.

성공 응답도 원래 SQL/echo·source hash·고정 asset/chain/date·중복·금액 타입·행 한도 검토 후에만 발행한다. 국가/지역이 null이면 미확보로 유지한다. UI는 공급자가 지리 귀속한 지갑의 잔액만 관측하며 국가 전체 보유량·시장점유율·거주국·결제/사용량·국가간 전송량을 인증하지 않는다. 토큰/네트워크/국가 필터와 정확 문자열 잔액 표를 제공한다. 실패하면 UNKNOWN과 별도 미확보 상태를 발행하고 추가 추측 호출을 하지 않는다. 국가별 사용량/국가간 흐름은 실제 스키마 미확인 상태로 보존한다.

## 직접 조회의 공식 출처와 고정 의미

직접 잔액 조회도1run/3HTTP 모두 HTTP200 뒤 상태 `failed`로 종료됐으며 상세 오류는 제공되지 않았다. 원래 UNKNOWN·PROVIDER_RUN_FAILED·소비 기록과 이전 discovery/legacy 바이트를 보존했다. 실제 합계는2run/6HTTP, 국가별 금액 관측0이다. UI에는 잔액 INCONCLUSIVE/미확보·사용량/국가간 흐름 NOT_TESTED를 표시한다. 직접 조회로 계정 접근을 시도했지만 권한 부재/테이블 부재/기능 미지원 중 어느 것으로도 단정하지 않는다. 두 고정 슬롯은 소비됐으며 추가 추측·재시도는 하지 않는다.

공식 Aggregate 문서를 브라우저에서 확인한 시각은 UTC2026-10-23T14:42:27.601224Z다. 렌더링된 HTML683629바이트는 로컬 `.state/allium-doc-browser/aggregates.html`에만 보존했다(SHA-256 `2e03eb4c1a83f7b9a5da67f020edb33de6f4b9051cfe2a5bce31c2cf3b9c1033`). 원 HTTP 바이트와 렌더링된 DOM을 구분한다.

공식 Geo Balances Daily 절은 `(date, primary_country, chain, token_address)` 단위를 설명한다. date는 UTC일, primary_country는 거래소 입출금 패턴/시간대 신호에서 추정한 국가, primary_region은 해당 지역이다. balance는 정규화된 tokens, usd_balance는 snapshot 시점 USD 환산이다. Identity에 귀속되지 않은 활동은 포함되지 않는다. 문서 설명이 현재 API 계정의 접근권한이나 전체 국가/체인 커버리지를 보장하지 않는다.

직접 계획의 SQL SHA-256은 `e9a84fc070ad72f05329bce40452dae938f64c4103e304f0b2c43324f46d117b`이며 정본 SQL은 `tools/allium-geography.mjs`의 `geographyPlan('balances')`로 생성한다. alias/함수 표기 등 echo가 달라지면 바이트 hash 확인과 별도로 의미를 개별 검토해 비공개 review 기록으로 결합한다. 원래 UNKNOWN receipt를 덮어쓰지 않는다.

## 검증

가상 transport로 기존 소비 기록 보존·공통 잠금 경합·중복/실패 후 재전송 거부·만료·archive 변경·10회 폴링·ACK 유실·provider 실패·sentinel·echo 검토의 오프라인 경계를 검증한다. 실제 실행 전 `npm run check`를 통과한다. Lead `cbc0f9e1bf1a400d9e78679bf289a3f4`의 proceed 조건을 따른다. Lead 판단은 사용자 승인·SQL 동등성·비용 인증을 대신하지 않는다.
