# ADR0062 — 검토 표본의 별도 Allium 공급량 저장·조회

후속 [ADR0063](0063-supply-install-and-api-boundary.md)에서 재개 검토와 실제 기존 DB의14행 설치/입력/대조를 완료했다. 아래의 설치 보류는 이 ADR 작성 당시 상태이며, Dashboard 설정 UNKNOWN과 소스·권한 검토의 구분은 후속 기록을 따른다.

## 범위와 보류

[ADR0061](0061-bounded-allium-survey-executor.md)의 실제 지원 조사에는 강제 과금 한도 증거가 여전히 필요하다. 그 조건과 독립적으로, 이미 검토한 [Ethereum USDC/USDT 표본](../research/allium-samples/followup.md)의 오프라인 저장·조회 CLI를 구현한다. 기존 Arkham/DeFiLlama 공급량과 별도인 `atlas_supply`에 보존하며 UI 기본 공급자 변경·동등 보조 연결·일별 수집·11배포 지원 확정은 포함하지 않는다.

이번 설계의 Lead 요청은 모델 capacity 오류로 판단 없이 종료됐다. 실제 pane의 idle·오류를 확인하고 요청 `da1dbe46efdc47c495df5c09437199db`를 취소했으며 원래 delivered 상태·취소 사유·response=null을 보존했다. 자동 재전송하거나 승인 응답을 만들지 않았다. **기존 비공개 DB의 실제 설치·grant/import는 검토 결과 확보 전까지 보류**한다. 구현·검증은 소스와 새로 생성한 소유·격리된 사설 PG17 Fixture에서 수행했다.

## 원문과 정의

mapper `allium-ethereum-supply-reviewed-v1`은 2026-10-16~22의 USDC/USDT Ethereum14행만 수용한다. 검토한 원문 SHA256과 저장된 SQL 두 표현(연구 SQL과 공급자가 재표현한 SQL)의 고정 SHA를 검사한다. 임의 정규화로 새 SQL을 승인하지 않는다. 행별 chain·주소(EVM만 case-fold)·자산·자정 날짜·원래 queried_at·중복·완전한2×7 grid·meta.row_count·2MiB·UTF-8/깊이 한도를 검사한다. LIMIT14를 채웠다는 사실만으로 일반적인 완전성을 인정하지 않고, 두 고정 배포의 일곱 날짜가 모두 있어야 한다. 다른 날짜·배포·조사 응답에는 후속 mapper가 필요하다.

총공급량·일반 유통량·조정 유통량을 각각 문자열/null로 보존하고 native 여부도 남긴다. 수량에 JSON Number를 허용하지 않는다. 서로를 대체하거나 차감 관계를 강제하지 않는다. USD는 이 SQL에서 조회하지 않았으므로 `NOT_REQUESTED`다. DeFiLlama 경제적 유통량·전체 코인 유통량·실시간 공급량과 합치지 않는다. source 숫자형·최소 단위 정밀도는 미확보이며 `PROVIDER_DECIMAL_STRING_NOT_BASE_UNIT_VERIFIED`, 집계 timezone은 UNKNOWN이다. 날짜 이동·누락0·과거값 새 날짜 복제를 하지 않는다. 공식 프로필 재인증·전체 배포 지원·제품 PASS를 뜻하지 않는다.

## 저장·권한·조회

기존 전송량 저장 패턴을 사용하되 migration과 source/daily_value를 별도 schema로 둔다. 원문은 비공개 archive에 바이트/hash 그대로 보존한 다음 source와 일별 값을 한 transaction으로 입력한다. DB에는 SQL·metadata·계정 query/run 식별자를 저장하지 않는다. 원문 SHA+mapper 재입력은0행이며 수정 응답은 새 source로 append-only 보존한다. 같은 자산/날짜/queried_at의 충돌값은 전체 rollback한다. 같은 시각의 동일 값은 원문이 달라도 허용한다. 최신 선택은 queried_at이며 imported_at은 선택에 쓰지 않는다. source 삽입 후 fact 실패도 rollback하고 이미 보존한 원문으로 import-only 재개한다.

FORCE RLS, owner 설치 정책, 등록된 최소 reader/writer 역할, 변경/삭제 차단 trigger와 구조·정책·ACL 검사를 적용한다. writer는 source/daily_value INSERT만, reader는 SELECT만 가능하며 웹/Data API 역할에 공개하지 않는다. 원래 market 역할 모드와 다른 grant는 거부한다. import advisory lock은 이 importer끼리 직렬화하며 직접 SQL writer를 같은 프로토콜로 강제한다고 주장하지 않는다. 공통 구조 검사기는 새 schema 이름만 허용목록에 추가한다.

read는 명시한 최대31일과 선택적 USDC/USDT coin 필터만 받는다. 자산/날짜별 최신 저장 관측과 원문 hash·원래 조회시각을 반환한다. 조회에 없는 날짜는 추가하지 않고, 저장 관측이 없는 범위는 MISSING이다. AVAILABLE도 각 수량의 null을 보존하며 현재성·안정성 인증이 아니다. 조회는 READ ONLY repeatable-read transaction이고 공급자를 호출하지 않는다. 웹 route나 자동 실행 연결은 추가하지 않는다.

실제 원문은 신규 PG17 Fixture에서14행 입력·재입력0·14행의 수량/시각/hash 일치를 확인했고 기존 market/activity 구조도 같았다. Fixture는 정리했다. 기존 비공개 DB 쓰기·새 공급자 자료 조회는0이다.
