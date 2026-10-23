# ADR0066 — 검토된 SQL echo와 같은 조사 묶음의 재개

## 실제 관측과 검토

ADR0065의 최초 registry 실행은 HTTP6회 모두200, 11행과 비용0.04255 Explorer Units를 반환했다. 그러나 공급자가 SQL 주석·공백·마지막 semicolon, VALUES 괄호, alias의 AS, TO_VARCHAR→TO_CHAR를 바꿔 반환하여 기존 byte-exact 검사에서 UNKNOWN으로 중단했다. 원문·원래 UNKNOWN receipt·실행 비용을 보존하며 재실행으로 지우지 않는다.

[Snowflake 공식 문서](https://docs.snowflake.com/en/sql-reference/functions/to_char)는 TO_CHAR와 TO_VARCHAR를 동의어로 명시한다. 이것만으로 임의 SQL의 동등성을 인증하지 않는다. 전체 요청/echo를 오프라인 비교하여 대상·주소·문자열·조건·날짜·형변환 인자·정렬·LIMIT가 같고 허용한 표기 차이만 있음을 개별 원문마다 검토한다. 일반 정규화나 새로운 응답의 자동 승인은 없다.

## 정확한 바인딩

비공개 `ALLIUM_REVIEWED_SQL_ECHO` manifest는 planHash, 원래 receiptHash와 kind별 요청 SQL hash·echo SQL hash·raw response hash·검토시각·SOURCE_REVIEWED를 결합한다. `alliumSurveyResult`의 명시적 sqlReview 옵션만 이 특정 echo를 허용하며 나머지 행·자료형·시각·기간·완전성 검사를 모두 유지한다. 기본값과 strict 실행의 byte-exact 검사는 유지한다. SOURCE_REVIEWED는 제품 PASS나 공식 지원 인증이 아니다.

## 같은 묶음의 checkpoint

`resume-manual`은 같은 root·plan·키·원래 사용자 승인·저장 usage와 새 15분 lease를 검사한다. 원래 reservation/authorization, 모든 전송 intent·응답 hash·순서, query/run ID 연결, 성공 status와 result 연결을 다시 확인한다. 검토 대상은 성공 응답까지 확보했으나 echo 검사로 UNKNOWN인 작업뿐이다. 수신·접수 불명 작업이나 기존 POST를 반복하지 않는다. 나머지 작업은 RESERVED이며 전송 intent가 없어야 한다.

각 registry/supply/volume 검토 checkpoint를 실행 전에 exclusive mkdir로 영속 선점한다. 원래 receipt·검토 manifest·새 authorization을 별도 보존하고 원래 UNKNOWN과 hash를 reviewHistory에 남긴다. 선점 뒤 crash/경합은 같은 checkpoint의 재사용을 거부한다. 최초6HTTP를 포함한 누적 HTTP156/접수 run3과 job별 status 상한을 승계하며 기존 global manual-once 예약은 유지한다. 새 root·예약 삭제·비용 환급·예산 초기화는 없다. 다음 응답의 echo도 미검토라면 다시 UNKNOWN으로 멈추며 새 checkpoint는 해당 저장 응답을 별도로 검토한 후에만 허용한다.

## 검증

Router Lead `0189b6a0b7de465c971942285e72e17c`의 token-exact 조건은 실제 함수명/괄호 변환을 수용하지 못해 적용하지 않았다. 후속 `65601d0260a9447fa2bd0dcad9522e10`의 exact-hash manifest·기존 증거 연결·누적 예산·무중복·checkpoint 조건을 반영했다. 검토는 실제 SQL 동등성·실행 성공 인증이 아니다. 실제 수치와 검사 결과는 이번 작업 인계문을 따른다.
