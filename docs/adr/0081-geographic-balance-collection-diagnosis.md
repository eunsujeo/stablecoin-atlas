# ADR0081 — 국가별 추정 잔액 수집의 기존 실패 진단

## 요청과 결정

2026-10-24 사용자는 국가별 추정 보유 잔액도 유용한 자료라며 “그정도도 우리에겐 좋은 자료야 수집해줘”라고 요청했다. 이 요청에 필요한 기존 실행 실패의 상세 확인을 새 단발 읽기로 수행한다. [ADR0080](0080-bounded-allium-geographic-data.md)의 소비된 두 슬롯을 재사용하지 않는다. 원인 근거 없이 동일 SQL의 슬롯 이름만 바꿔 재전송하지 않는다.

공식 [Fetch latest query run](https://docs.allium.so/api/explorer/fetch-latest-query-run)은 `GET /api/v1/explorer/query-runs?query_id=...`와 응답의 `run_id`, `query_id`, `query_config.sql`, `status`, `error`를 명시한다. 기존 status 응답은 상태 문자열만 반환하므로 상세 오류 부재를 API 전체의 오류 정보 부재로 해석하지 않는다. 실패한 기존 balances query 하나만 지정하며 주소/실행 목록을 열거하지 않는다.

## 고정 경계

`tools/allium-geography-diagnosis.mjs prepare|collect <비공개 승인 파일> <고정 비공개 authorization 경로> [검토 hash]`를 사용한다. 기존 legacy root/공통 송신 잠금 안에서 `geography-once/balances-diagnosis-20261024`를 송신 전에 영속 소비한다. 새 승인 원문 hash·키 hash·기존 balances receipt와 원문 hash·기존 두 슬롯/legacy manifest·15분 lease를 결합한다. 고정 한 요청, 0run, 재시도0, 결과 2MiB 상한이며 usage·SQL 실행·키 변경·공급자 전환·자동 반복은 없다. 기존 두 실행 포함 누적 최대2run/27HTTP이며 실제 진단 전까지2run/6HTTP다. 비용 통제·귀속·조직/타PC 배타성은 미확인으로 유지한다.

반환 query/run/SQL이 원본과 같고 `failed` 및 비어 있지 않은 `error`가 확인될 때만 진단 OBSERVED다. 이는 오류 문자열 확보 상태이며 잔액 관측이나 접근권한 인증이 아니다. 원문과 계정 식별자는 비공개 `.state`에만 보존한다. 요약 출력에 오류 원문·식별자·키를 넣지 않는다. 이전 UNKNOWN receipt와 웹의 금액 미확보 상태는 바꾸지 않는다.

## 후속 수집

오류를 확보하면 그 근거로 수정 가능 여부와 새 고정 수집 계획을 정한다. 실제 데이터 수집은 기존11배포·UTC2026-10-22·3300행+sentinel/2MiB·1페이지·1run/13HTTP·15분·재시도0을 넘기지 않으며 실행 전에 별도 고정 계획과 누적 상한을 기록한다. 계정 권한이나 공급자 설정 변경이 필요하면 사용자에게 확인한다. 오류 정보가 여전히 없으면 추측 SQL을 반복하지 않는다.

## 실제 결과와 재개 조건

2026-10-23 UTC / 2026-10-24 KST에 상세 GET1건이 HTTP200으로 완료됐다. 원래 query/run/SQL을 대조했고 오류는 `You used invalid tables: allium_identity.aggregates.geo_balances_daily`였다. datastore는 snowflake이며 이전 원문/소비 기록의 바이트 보존을 확인했다. 진단 상태 OBSERVED는 오류 확보만 뜻하며 실제 잔액은 여전히0건 관측이다. 실제 누적은2run/7HTTP, 새 SQL 실행0·재시도0·usage0이다.

이는 해당 호출 문맥에서 테이블을 거절한 공급자 응답이다. 테이블의 전역 부재·계정 권한 부재·만료 키·프록시 차단 중 하나로 확정하지 않는다. 공식 스키마 문서가 있다는 사실만으로 계정의 Explorer 접근을 인증할 수 없다. 현 계정에 제공되는 지리 잔액 테이블/전달 경로와 접근 조건을 Allium 콘솔 또는 공급자 확인으로 확보한 뒤 새 고정 수집 계획을 만든다. 계정 변경·새 계약/키·미확인 endpoint 탐색 호출이나 동일 SQL 재송신을 진행하지 않았다.

## 검증

고정 GET·송신 전 intent·구원문 보존·성공/ACK 유실 후 중복 차단·잘못된 run/SQL/오류·HTTP 실패·잠금/만료·키/승인 변경·legacy/다른 슬롯 변경 차단을 가상 transport로 검증한다. 실제 읽기 전에 `npm run check`를 통과한다. Lead `9c99ef1b769f403a84ce4951c0627930`의 원인 없는 동일 SQL 재송신 금지와 기존 증거 보존 조건을 반영한다.
