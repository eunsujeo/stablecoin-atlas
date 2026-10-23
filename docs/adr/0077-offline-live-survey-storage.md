# ADR0077 — 실제 수집 저장본의 오프라인 DB·화면 연결

## 승인과 범위

2026-10-23 사용자는 [ADR0076](0076-user-authorized-local-live-collection.md)의 최초 실제 수집 완료 뒤 다음 진행을 요청했다. 이번 단위는 그 저장본 두 개를 기존 개발용 비공개 DB의 `atlas_survey`와 로컬 Overview에 연결하는 [ADR0067](0067-offline-multichain-survey-storage.md)의 오프라인 입력 확장이다. 새 공급자/usage/SQL 호출·승인 재소비·스케줄·기본 공급자 전환은 없다. 원래 실행의 비용 인증이나 조직 예산 전환도 아니다.

조회창과 11배포·SQL은 기존 고정 조사와 동일하다. DB schema·mapper·권한·읽기/HTTP/UI 계약을 바꾸지 않고, 두 원래 queried_at의 whole snapshot을 append한다. 이전 snapshot은 수정하지 않는다. 종류별 최신 전체 snapshot을 읽는 기존 경로가 새 저장본을 표시한다. 더 오래된 자료의 날짜/행을 새 snapshot의 빈칸에 채우지 않는다.

## 근거 결합

기존 legacy 입력 검증은 유지한다. live 분기는 원문·개별 SOURCE_REVIEWED manifest·그 manifest가 가리킨 원래 UNKNOWN receipt·원래 authorization bytes·사용자 승인 bytes를 받는다. manifest→receipt hash→authorization hash→승인 hash를 검증하며, review/receipt hash가 기존 source ID에 포함돼 이 결합을 추적할 수 있다. 키 지문을 조직 identity로 해석하지 않는다.

고정 dailyPlan과 surveyPlan의 전체 SQL·대상·기간을 대조하고 당시 15분 lease·2run/26HTTP·재시도0·실제 미확인 상태의 authorization 계약을 검사한다. receipt의 순서·시각·성공 HTTP·종류별 create/run/status/result 구간·해당 결과 hash·run ID와 결과 meta의 연결을 검사한다. 원래 queried_at이 그 실행 구간과 lease 안에 있고 개별 검토가 그 이후인지 확인한다. 전체 intent/응답 archive 재생을 새로 수행했다는 뜻은 아니며, 고정된 receipt·manifest와 해당 원문 사이의 연결 검증이다. supplier 진위나 비용 최종성은 인증하지 않는다.

**현재 import 시각에 실행 lease가 유효할 필요는 없다.** 실행 시각과 나중의 검토/import 시각을 구분한다. 과거 실행 승인을 새 송신이나 한도 인증으로 재사용하지 않는다. 계정 키를 읽거나 실행 함수를 호출하지 않는다. legacy/live 근거 혼합·원문/승인/receipt/시각/plan 변조는 DB 연결 전에 거부한다.

원문·검토·원래 UNKNOWN receipt에 더해 원래 authorization·사용자 승인을 별도700/600 archive에 보존한다. 같은 입력의 replay도 archive bytes를 검사한다. SQL·run/query ID·계정 지문·승인 원문은 DB payload와 웹 DTO에 넣지 않는다. DB에는 기존의 검토 projection과 해시·원래 시각만 들어간다.

## 보존과 검증

기존 advisory lock·append-only source·동일 종류/plan/시각 충돌 거부·재입력0·transaction rollback·최소 권한·Data API 차단 검사를 유지한다. source/HTTP 검사와 새 소유 PG17 Fixture에서 두 입력 형식의 공존, 만료 후 오프라인 import, 근거 혼합/변조 거부, 정확 문자열·null·0, 경합·rollback·archive 변조·최신 snapshot 누락 보존을 검증한다. `npm run check` 통과 후 기존 writer로 두 snapshot만 append한다. grant·migration·기존 definer의 새 승인은 하지 않는다.

실제 저장 전후 기존6schema 구조/보안·시장 표본/기존 공급량/전송량·기존 survey 행과 schema를 대조한다. reader의 전체137관측과 null/미일치/누락·시각/hash를 원래 projection과 비교하고, 로컬 HTTP/브라우저의 최신 근거·필터·마지막 정상본/복구·테마/모바일을 확인한다. 웹 읽기와 갱신은 공급자 호출이나 파일 생성을 실행하지 않는다. 실제 결과와 명령·검사 수는 이번 인계문에 기록한다.

Lead `ec915d5d5b7e42b4a8fd658a2f0947f0`의 proceed 조건을 반영했다. 원래 UNKNOWN·비용 통제 UNCONFIRMED·P UNKNOWN·b_i null·c_i=0·TRANSITION_BLOCKED를 유지한다. 이 입력 확장으로 실제 비용 대사·차감·일별 수집을 활성화하지 않는다.
