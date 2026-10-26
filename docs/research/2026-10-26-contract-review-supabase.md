# 컨트랙트 검토 요약 Supabase 반영 기록

## 승인과 구현 경로

사용자가 로컬 웹 수동 반영에 동의한 뒤 DB 저장을 요청했고, 대상 확인에 “supabase 반영까지야.”라고 답했다. [ADR0113](../adr/0113-contract-review-supabase-summary.md)에 전용 private 스키마·기존 역할의 최소 권한·검토 요약 두 건·로컬 웹 연결·실제 Supabase 적용을 기록했다. 운영 웹 배포·Collector/FX·공급자 API/RPC·키·기존 토큰 판정은 이번 변경에서 제외했다.

현재 DB 연결과 기존 survey 저장/권한·production reader 구조를 읽고, `atlas_contract_review` v1·명시 init/grant/import/read/boundary CLI·검토 요약 검증기·DB reader·로컬 읽기 API를 구현했다. 최초 실패 요약과 v3 관측을 서로 다른 ID로 보존한다. 기본 로컬 모드도 동일한 수동 검토 자료를 제공하며 DB 모드의 실패를 정적 자료로 숨기지 않는다. 원문을 자동 탐색하거나 다시 분석하지 않는다.

Local Router shadow 추천은 제공돼 중복 호출하지 않았다. DB 권한/구조 변경이므로 Lead 검토 `e7a261eb9d544459b743579e581d8a5f`를 요청하고 action `revise_plan`을 회수했다. 검토 조건은 정본 PG17 pin·API 역할/SET ROLE/default ACL/view/definer 경계·SQL 필수키·권한/rollback/변조/웹 시험·전체 검사와 승인 기록이었다. 새 구조 pin과 commit 전후 경계 검증·필수키 제약을 반영했다. Lead는 운영 변경의 추가 승인으로 사용하지 않았다. 하위 Agent/임시 pane 생성은 없다.

## 실패·원인·수정

첫 표적 시험에서 숫자형 `blockNumber`가 정규식에 의해 문자열로 강제 변환돼 허용되는 오류를 발견했다. 명시 string 검사를 추가했고 거부 경로가 통과했다. 검토 중 SQL CHECK의 누락 필드가 NULL로 통과할 수 있는 점도 확인해 필수 최상위 키·핵심 문자열 타입·status UNKNOWN·식별자/관측 시각 일치 제약을 추가했다. SQL은 모든 보고서 문구의 진위를 보장하지 않으며 세부 검증은 importer/reader에서 수행한다.

## 사설 검증과 재현

- `node .state/agent-logs/contract-review-schema-pin.mjs`: 새 소유 loopback PG17에서 정본 DDL 구조 pin을 산출하고 소유 container/network를 정리했다. 최종 구조 `07d95577cc9be113f7826139a546175793d40886d71f8da25156c58a43f2f3d6`. `.state/agent-logs/contract-review-schema-pin.log`에 보존했다.
- `node --test tests/contract-review-db.test.mjs tests/postgres/contract-review.test.mjs tests/contract-review-dashboard.test.mjs`: rc0 tests7/pass7/fail0. `.state/agent-logs/contract-review-db-tests.log`에 보존했다. 입력 hash·민감/임의 필드·숫자 금지·중복/경합·충돌 rollback·reader 쓰기/DDL·writer UPDATE/DELETE/TRUNCATE·API 역할 직접/SET ROLE/default ACL·누락 payload·disabled trigger·내용 변조·기존 스키마 구조 보존을 확인했다.
- `node .state/agent-logs/contract-review-browser-local.mjs`: rc0. 실제 Chrome 렌더링에서 최신 보고서·원래 실패 보고서 선택·11항목/16함수·탭/키보드/검색·다크/라이트·1440/390px·evidence503 독립성·컨트랙트 API503 오류 화면을 확인했다. runtime error0/외부 요청0/비공개 원문 요청0. 정적 HTML 응답만으로 화면 성공을 주장하지 않았다. `.state/agent-logs/contract-review-browser-local.log`에 보존했다.

표적 시험은 새 소유 PG17 Fixture와 저장 요약만 사용했다. 공개 체인 RPC·compiler·공급자 HTTP는 없다. 실제 Supabase 적용 결과와 전체 검사 결과는 아래와 같다.


## 실제 Supabase 적용 결과

2026-10-26T09:08:50.469Z~09:08:56.621Z에 기존 관리자/writer/reader 설정과 인증서 검증 TLS를 사용해 명시 적용했다. 새 대상/endpoint/키/CA 경로 변경·자동 재시도는 없었다. read-only preflight에서 같은 DB 대상·기존 역할·새 스키마 부재·기존 SOURCE_REVIEWED definer2개의 정의/스키마 closure pin을 확인한 후 진행했다. 실제 적용 실패0이다.

| 단계 | 결과 |
| --- | --- |
| 전용 스키마 | atlas_contract_review v1 INITIALIZED |
| 기존 두 역할 | writer SELECT/report INSERT, reader SELECT GRANTED |
| 공개 경계 | 입력 전후 VERIFIED_EFFECTIVE_ACCESS_DENIED, API역할4/우회RLS역할1/검토definer2 |
| 검토 요약 입력 | 최초 실패·Infura v3 두 건 IMPORTED |
| 동일 입력 반복 | UNCHANGED / 추가0건 |
| reader 대조 | 원래 검토 요약2건과 canonical 전체 일치 |
| 전체/개별 판정 | 두 보고서 전체 UNKNOWN / v3 고정 블록26275729 equality PASS |
| 운영 reader 권한 검사 | READER_READY |
| 기존 스키마 | atlas_market/scheduler/catalog/history/registration/activity/supply/survey 8개 구조 hash 불변 |

공개 경계 검사는 PUBLIC/default ACL·API 역할의 직접/SET ROLE 경로·노출 view·SECURITY DEFINER 경로를 확인했다. Dashboard의 exposed schemas 설정을 별도 확인하지 않았으므로 해당 항목은 UNKNOWN이다. 원문 runtime/snapshot/report·키·RPC/DB URL을 DB에 입력하거나 웹에 제공하지 않았다. 기존 데이터에 대한 UPDATE/DELETE·Collector/FX 설정/서비스 변경·운영 웹 배포는 수행하지 않았다.

입력 SHA256은 `f936cdeea49288bb7b154003a9bdb71f42ecb940cc5088323c1b7d34ab5b47e6`, reader 전체 canonical SHA256은 `10337949db3809711eecbc1372e30389875cc805c94cfd3db3595a392a30654a`다. 실제 단계11개·시각·결과는 `.state/contract-review-supabase-20261026/receipt.private.json`에0600으로 보존했다. receipt SHA256은 `3a9eeae7c64a008468abdaf72fc9a6cdc7a97ef662456a89ae7f0fce85430769`다. 같은 디렉터리0700의 `reviewed-input.json`은 검토 요약만 포함하며 원문/환경은 포함하지 않는다. 실행 스크립트/로그는 `.state/agent-logs/contract-review-supabase-apply.{mjs,log}`다. 이 스크립트는 기존 디렉터리 재사용을 거절하므로 다시 실행하지 않는다.

## 최종 조회·화면·전체 검사

- `npm run check > .state/agent-logs/contract-review-supabase-check.log 2>&1`: rc0 tests654/pass654/fail0/cancelled0/skipped0.
- Supabase reader 설정으로 로컬 UI를 시작해 `/contract-review-data.json`의 GET200/HEAD200과 원래 검토 자료2건 전체 일치를 확인했다. `.state/agent-logs/contract-review-supabase-http.json`에 결과를 보존했다.
- `node tools/contract-review-browser-check.mjs http://127.0.0.1:4173`: rc0. 실제 Supabase reader를 사용하는 로컬 화면에서 앞선 Chrome 검증 항목·최초 실패 보고서 선택·최신 블록/equality 표시·API503 오류 화면을 확인했다. `.state/agent-logs/contract-review-supabase-browser.log`에 보존했다. 브라우저 외부 요청0은 브라우저에서의 결과이며 서버의 승인된 Supabase SQL 접속과 구분한다.
- `node .state/agent-logs/contract-runtime-infura-live-v3-offline-verify.mjs`: rc0 checks26/pass26/fail0/externalRPC0. 기존 v2/v3 자료·소비·입력 pin 불변을 재확인했다. `.state/agent-logs/contract-review-supabase-original-evidence-check.log`에 보존했다.
- `git diff --check`: rc0. 환경/원문/receipt는 Git에 추가하지 않았다.

현재 로컬 UI는 `http://127.0.0.1:4173/#contracts`에서 DB 읽기 모드로 유지한다. 실행 명령은 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`이며 Node listener PID5494/exec session2286이다. 이번 작업에서 시작한 미리보기이며 사용자 검토용으로 유지한다. 로그는 `.state/agent-logs/contract-review-supabase-preview.log`다.

## 재현과 남은 범위

기존 Supabase 재확인은 `npm run review:contract:db -- read --env-file .state/market-db-secrets/reader.env`로 수행한다. 출력은 검토 요약이며 비공개 접속값은 출력하지 않는다. 같은 CLI의 명시 boundary 검사는 기존 고정 definer 검토 파일/hash를 요구한다. 로컬 UI는 위 명령으로 재시작할 수 있다. 새 설치의 migration/grant/import는 ADR0113의 순서와 현재 pinned DDL/검토 입력을 사용하고 기존 행을 삭제하거나 덮어쓰지 않는다.

원본 compiler NOT_RUN·소스 진위 UNKNOWN·실제 Proxy/권한 NOT_TESTED·비용 UNKNOWN은 그대로다. 현재 요청의 Supabase 저장과 로컬 웹 연결은 완료했다. 새로운 체인 조회·compiler/Slither·권한 실행·공개 운영 웹 배포는 자동 후속 단계가 아니며 별도 범위 확인이 필요하다. [인계문](../handoff/2026-10-26-contract-review-supabase.md).
