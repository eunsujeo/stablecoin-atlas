# ADR0082 — 추정 국가와 거래소 사이 흐름 단발 조회

## 사용자 요청과 의미

2026-10-24 사용자는 `allium_identity.aggregates.cex_attributed_flows`의 `from_grain = 'geo'` 또는 `to_grain = 'geo'` 행과 국가명이 entity에 들어간다는 설명을 제시하고 “확인해줘”라고 요청했다. 기존 잔액 조회의 반복이 아닌 이 테이블의 계정 접근·자료 확보 여부 확인으로 진행한다. 사용자 제공 설명과 저장된 공식 [Aggregate 문서](https://docs.allium.so/historical-data/identity/aggregates)의 테이블/열 정의를 대조했다. 이번 공개 문서 재열기는 도구 Internal Error였으며 새 문서를 확보한 것으로 기록하지 않는다.

공식 설명은 2026-01-01 이후 스테이블코인/네이티브 자산, 한쪽이 항상 거래소, 일자·체인·from_key·to_key·토큰별 집계다. 이번에는 기존 스테이블코인11배포만 지정한다. geo 출발은 추정 국가 지갑에서 거래소로, geo 도착은 거래소에서 추정 국가 지갑으로 분리한다. 반대편 `category = 'cex'`도 명시해 방향을 검증한다. 국가간 송금·소비/결제·거주국 인증이나 국가 전체 총량으로 해석하지 않는다.

## 고정 실행 경계

사용 열은 `date`, `chain`, `token_address`(UTC일·체인·토큰 식별), `from_key`/`to_key`(entity/category 결합 키), `from_entity`/`to_entity`(명칭; geo 쪽은 추정 국가), `from_category`/`to_category`(cex 등 분류), `from_grain`/`to_grain`(entity/category/geo/unattributed), `amount`(decimals 정규화 토큰 수량), `usd_amount`(전송 시점의 시간별 USD 환산), `transfer_count`(집계 전송 건수)다. 지갑 주소나 개인정보 열은 선택하지 않는다. 정본 SQL SHA-256은 `1e26d7a17867cf275dfd2bcb9ba28e643ed88b1ba76c1eda54a885dc48345366`이다.

기존 `allium:geography` CLI의 새 kind `cex-flows`와 `geographyPlan('cex-flows')`를 정본으로 삼는다. 기존11배포·UTC2026-10-22 하루·3300행+sentinel/2MiB·1페이지·1run/13HTTP·상태최대10회·15분·재시도0으로 고정한다. SQL과 결과의 금액/전송 건수는 십진 문자열이며 누락은0으로 바꾸지 않는다. LIMIT는 스캔 비용 상한이 아니며 비용 통제·귀속·조직/타PC 배타성은 미확인이다.

계획은 `npm run allium:geography -- plan --kind cex-flows`로 확인하고 `prepare --kind cex-flows --approval <비공개 파일> --output <.state authorization>` 후 hash를 검토해 `collect --kind cex-flows --approval <파일> --authorization <파일> --reviewed-sha256 <hash>`로 한 번 실행한다. 성공 원문은 `review --kind cex-flows --source-sha256 <hash> --sql-sha256 <개별 검토 hash>`로만 검토한다. `publish --kind cex-flows`는 기존 잔액 화면을 덮어쓰지 않도록 거부한다.

같은 legacy root/공통 송신 잠금 안에서 새 `geography-once/cex-flows`를 송신 전에 영속 소비한다. 새 사용자 승인 원문 hash·plan/SQL hash·키 hash·기존 geography 세 슬롯/legacy manifest·lease를 결합한다. 앞선 두 실행과 상세 진단을 포함한 누적 최대3run/40HTTP이며 이번 실행 전 실제2run/7HTTP다. 기존 receipt/UNKNOWN·원문과 UI를 보존하고 기존 슬롯이나 승인으로 새 SQL을 실행하지 않는다.

정확히 `failed` 상태가 관측됐을 때만 같은 lease/13HTTP 내에서 해당 query의 latest-run 상세 GET1건을 읽는다. 이는 SQL 재실행이 아니다. query/run/SQL을 원래 요청과 대조한 오류만 별도 hash/attempt로 기록하고 원래 UNKNOWN을 성공으로 바꾸지 않는다. 상세 읽기 실패·경합·ACK 유실·만료 후 재시도/재개는 없다. canceled/불명 상태에는 상세 읽기를 추가하지 않는다.

## 결과 검토와 제외

성공 원문은 고정 식별자·일자·geo/거래소 방향·키 중복·금액/건수 문자열·행 수·queried_at·SQL echo/hash를 오프라인 검토한다. SQL echo 차이는 기존처럼 UNKNOWN과 개별 의미 검토를 유지한다. 빈 결과는 해당 조건의 MISSING이며 접근 불가/기능 미지원과 구분한다. sentinel/반환 상한 초과는 불완전으로 보존한다.

이번 요청은 자료 확보 여부 확인이며 새 DB·UI 연결, 자동 수집·usage·공급자 전환·주소 열거·계정/키/계약 변경을 하지 않는다. 실패 시 거절된 정확한 테이블만 보고하며 다른 Identity 테이블 전체로 일반화하지 않는다.

## 검증

기존 두 계획/SQL hash 유지, 기존 슬롯/legacy 보존·공통 잠금·중복 소비·ACK 유실·만료·승인/키/원문 변경 차단, 실패 상세의 같은 query/run/SQL/HTTP 상한, 성공의 방향/금액/누락/중복/sentinel과 오프라인 검토를 가상 자료로 검증한다. 실제 호출 전 `npm run check`를 통과한다.

## 실제 결과

2026-10-23 UTC / 2026-10-24 KST에 새 쿼리를 단발 실행했다. 생성·실행·상태·상세4건 모두 HTTP200이었지만 run 상태는 `failed`, 원래 receipt는 UNKNOWN·PROVIDER_RUN_FAILED다. 동일 query/run/SQL의 상세 오류는 `You used invalid tables: allium_identity.aggregates.cex_attributed_flows`이며 datastore는 snowflake다. diagnosisState OBSERVED는 이 오류를 확보했다는 뜻이다. 실제 흐름 자료0건 관측·결과 페이지 요청0·재시도0·usage0이다. 기존 세 슬롯과 legacy 바이트 보존을 확인했다.

이번 실제1run/4HTTP, 이전 지리 조회/진단과 합산3run/11HTTP다. 새 cex-flows 슬롯은 소비됐으며 재사용하지 않는다. 이 호출 문맥의 대상 테이블 거절만 관측했으며 권한 부재/전역 테이블 부재/프록시 차단/전체 Identity 미지원으로 단정하지 않는다. 현재 계정의 지원 테이블/전달 경로에 대한 새 근거 없이는 같은 SQL을 재송신하지 않는다. 사용자에게 실패를 알리고 이번 단발 확인을 종료하며 별도 계정 변경·공급자 문의·미확인 endpoint 호출을 수행하지 않는다.

실제 호출 전 `npm run check` rc0 tests467/pass467/fail0/cancelled0/skipped0, 관련3파일 단위시험 rc0 tests28/pass28/fail0/cancelled0/skipped0. Lead `023af7a7783e46c99f300ce43cb175cd` proceed 조건인 기존 계획 불변·같은 한도 내 진단·오프라인 review 및 범위 제외를 반영했다.
