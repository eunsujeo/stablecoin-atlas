# ADR0076 — 사용자 승인 로컬 Allium 실제 수집 1회

## 승인과 비용 상태

2026-10-23 사용자는 기존 계정 자료가 없다고 답한 뒤, 가상 비용 구현과 실제 Allium 호출·수집 활성화 중 **실제 호출·수집**을 명시적으로 선택했다. 이번 실행 예외는 이 사용자 선택에 근거한다. [ADR0074](0074-cost-attribution-evidence-contract.md)의 실제 비용 증거를 확보하거나 [ADR0070](0070-legacy-allium-transition-and-checkpoint-review.md)의 조직 공통 예산 전환을 통과한 것으로 해석하지 않는다.

이번 단위는 기존 주소형 11배포의 공급량·전송량을 각각 한 SQL로 수집하는 **로컬 수동 최초 1묶음**이다. 자동 일별 예약·무인 반복 실행·웹 요청 수집·DB/UI 전환·새 usage 호출은 포함하지 않는다. 기존 일별 Lab과 strict 실행 검사는 유지한다. 최초 실행 후 새 승인이나 날짜별 예외를 자동으로 생성하지 않는다.

조직 identity와 다른 PC의 배타성은 UNKNOWN, 공급자 한도·초과 과금 설정은 UNCONFIRMED다. 글로벌 한도 보장은 없다. 실제 전환은 TRANSITION_BLOCKED, P UNKNOWN, b_i null, c_i=0을 유지한다. c_i=0은 실제 비용이 0이라는 뜻이 아니다. 요청 수와 과거 meta 비용을 EU 비용 상한으로 바꾸지 않는다. 사용자에게 위 미확인을 설명한 뒤 받은 이번 선택을 별도 수동 무상한 실행 예외로 기록한다.

## 승인·저장·잠금

`npm run allium:live -- prepare`는 외부 호출 없이 승인 JSON을 만든다. 고유 승인ID·승인 원문 hash·키 지문·plan/SQL/11대상 hash·UTC 조회기간·기존 로컬 archive manifest hash·15분 lease·2run/26HTTP/재시도0과 위 미확인을 결합한다. 준비 파일과 승인 기록은 `.state`의 비공개 경로에만 둔다. 키·원문·계정 식별값은 Git/웹/stdout에 게시하지 않는다. 키 지문을 조직 identity로 사용하지 않는다.

`collect`는 고정 `.state/allium-executor`만 사용한다. 기존 execute/manual/resume/usage와 신규 실행은 동일 `reservation-lock`을 전체 송신 동안 보유한다. lock 소유가 확인되지 않거나 crash로 남으면 자동 정리하지 않는다. 신규 송신 전에 키·날짜·새 승인ID와 관계없는 영속 `live-once` 디렉터리와 소비 기록을 fsync한다. 이후 구경로와 신규 최초 실행 모두 추가 송신을 거부한다. 기존 manual-once·기간/날짜·resume 표식은 삭제하거나 미사용으로 바꾸지 않는다.

기존 archive의 파일별 bytes hash·길이·권한을 승인에 묶고 전송 전·실행 후 대조한다. 기존 UNKNOWN과 검토 이력·원래 시각은 보존한다. 신규 intent·원문·receipt·projection만 live-once 아래에 추가한다. 예외는 이 PC의 고정 root에 한정되며 복제본·다른 PC·이전 버전 프로그램까지 통제한다고 주장하지 않는다.

## 실행과 실패

고정 일별 계획의 supply/volume만 실행한다. registry·XRPL 매핑 탐색은 제외한다. 명시한 UTC 날짜 D의 `[D-7, D)`를 조회한다. SQL 생성2·실행2·상태 최대20·결과2의 최대26HTTP, 요청20초, 상태 간격2초, 응답2MiB·페이지1·sentinel78행을 유지한다. POST와 GET 재시도는 모두0이며 각 dispatch 전에 lease와 HTTP 잔여를 검사한다. HTTP 상한은 비용 상한이 아니다.

각 intent를 내구 저장한 뒤 전송한다. 응답 유실·timeout·승인 만료·부분 성공에도 소비 표식과 원문을 보존하고 승인 재발급·환급·SQL 재실행을 자동으로 하지 않는다. 공급자 오류·실패·절단·SQL echo 불일치는 다음 job을 중단한다. echo가 다르면 UNKNOWN과 `SQL_ECHO_REVIEW_REQUIRED`로 보존하며 기존 SOURCE_REVIEWED를 새 원문에 승계하지 않는다. 관측 meta 비용은 십진 문자열로만 보고하며 실제 최종 비용으로 인증하거나 차감하지 않는다.

## 검증과 검토

`resume`은 [ADR0066](0066-reviewed-sql-echo-and-survey-checkpoints.md)의 개별 원문 검토 방식을 같은 최초 묶음에 한정해 적용한다. 공급자가 성공 결과를 반환했지만 echo 차이로 UNKNOWN인 경우에만 원래 receipt 전체 hash·승인 hash·요청/echo/source hash·검토시각을 결합한 manifest를 받는다. 모든 intent/response hash·시각·순서·query/run 연결·마지막 status success·result·미전송 job과 기존 legacy manifest를 다시 검사한다. 공통 lock 안에서 영속 resume-kind 표식을 선점하고 원래 UNKNOWN receipt·manifest를 보존한 뒤 검토 projection을 저장한다. 이미 접수한 SQL은 반복하지 않고 RESERVED인 나머지 job만 전송한다. 마지막 job 검토는 HTTP0회다. 최초 15분 lease·소비된 승인·누적2run/26HTTP를 그대로 승계하며 연장/재발급하지 않는다. 만료·원문 변조·수신불명·checkpoint crash는 재개를 차단한다. 일반 SQL 정규화나 새 원문의 자동 승인은 없다.

fake transport에서 영속 intent/소비·중복/키/날짜 재사용·구경로 양방향 경합·승인/legacy 변조·만료·POST/GET 응답 유실·프로세스 crash·26HTTP 상한·echo/절단/실패 후 다음 job 중단·기존 UNKNOWN 보존을 확인한다. `npm run check` 통과 후 이번 승인으로 최초 1묶음만 시도한다. 실제 결과는 이번 인계문에 기록한다. 가상 테스트의 성공을 실제 공급자 실행 성공으로 표시하지 않는다.

Lead `871a9c9333d24d128b52051193404225`의 최초 검토 뒤 조직 증거가 없는 명시 실행 예외의 범위를 정정했고, `a19d7fb32d144ec7ac9c03d5e704d147`의 proceed 조건을 반영했다. 조직 identity·다른 PC 배타성을 새 완료조건으로 요구하지 않으며 미확인과 로컬 한계를 보존한다. 이 검토는 사용자 승인이나 비용 인증의 대체가 아니다.

최초 실제 공급량 응답의 echo 차이를 관측한 후 Lead `054db3f2e7f1494195a7d93a53bdffe3`의 proceed 조건으로 위 checkpoint를 추가했다. 개별 요청/echo 전체 비교와 행 검증은 구현 Agent가 수행하며 Lead 응답 자체를 SQL 동등성 근거로 사용하지 않는다. 실제 실행·재개·오프라인 검토의 수치는 이번 인계문을 따른다.
