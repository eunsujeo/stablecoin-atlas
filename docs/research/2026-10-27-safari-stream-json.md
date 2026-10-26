# Safari ReadableStream JSON 로딩 호환성 수정

## 요청과 원인

사용자가 iPhone Safari에서 `ReadableStream.prototype[Symbol.asyncIterator]`가 undefined이고 HTTP200/유효 JSON인데도 화면 로딩이 실패함을 확인했다. 브라우저 전체 검색 결과 `overview.js`, `market-view.js`, `asset-review-store.js`의 세 로더가 `response.body` 비동기 반복을 사용했다. 기본 ReadableStream reader가 있어도 비동기 반복 프로토콜이 없는 Safari에서는 본문 처리 단계에서 실패한다.

## 변경

브라우저 전용 `browser-json.js`가 `getReader()/read()`로 본문을 읽고 바이트 제한·fatal UTF-8·JSON parsing을 수행한다. 성공/실패/초과/중간 취소/타임아웃에 reader lock을 해제하고, 조기 종료 시 unread body를 취소한다. cancel 오류나 오래 걸리는 cancel Promise가 원래 결과를 가리지 않도록 한다. HTTP 오류/optional404의 unread body도 정리한다.

fetch는 AbortController·timer로 요청부터 본문 완료까지 제한하며 외부 AbortSignal을 연결/정리한다. AbortSignal.any/timeout 정적 메서드에 새 helper가 의존하지 않으므로 이 API가 없는 경우에도 취소/타임아웃을 유지한다. 캐시·credentials·optional404·공통 pending Promise·기존 last-good/오류 화면은 보존한다. 서버/Node 전용 스트림 코드는 변경하지 않는다.

| 브라우저 로더/데이터 | 처리와 유지 조건 |
| --- | --- |
| 전체 현황: 시장/FX/등록 공급량·이력/활동/저장 공급량·survey/지리/실행 근거 | 새 reader, 2MiB·fatal UTF-8·15초·외부 취소·optional404·no-store/no-cache 유지 |
| 자산 프로필·기술 검증 현황 공통 snapshot | 새 reader, 262144바이트·fatal UTF-8·15초·공통 요청 유지 |
| 기존 시장 화면 | 새 reader, 2MiB·기존30초 유지, UTF-8 대체 디코딩을 fatal 검증으로 강화 |
| evidence.js 근거 문서 | response.text 방식으로 asyncIterator 의존 없음. 기존 문자 제한·10초·credentials omit 유지 |
| app.js 가상 데이터 | response.text 방식, 기존64000문자·10초·credentials omit 유지 |
| contract-review.js | response.text 방식, 기존131072바이트 검사·조회/로딩 동작 유지 |

새 공통 JS 파일은 기존 로컬 정적 자산 Map과 production publicAssets에 경로 한 줄씩만 등록한다. 서버 API 로직·응답 JSON/캐시·DB/Supabase·Collector·FX 수집/서비스·운영 Mac mini/SSH/Tunnel/DNS/배포는 변경하지 않는다. 브라우저 본문 판독만 변경한다.

## 검토와 시험

Local Router shadow 추천은 제공돼 재호출하지 않았다. 실제 Safari 실패에 대한 Lead `3a5b7927b68245eead13cc6b5a614f32`의 proceed/검증 조건을 회수했다. reader/timer/listener 정리·원래 한도/시간·취소·UTF-8·optional404·정적 허용목록·실기기와 조건 재현의 구분을 반영했다. 하위 Agent/임시 pane은 만들지 않았다.

`node --test web/browser-json.test.mjs tests/production.test.mjs` rc0 tests20/pass20/fail0. asyncIterator가 없는 스트림, 한글을 바이트마다 분할한 JSON, 큰 금액 문자열, 정확히2MiB/초과/다중바이트 바이트 제한, 작은 asset 한도, 잘못된 UTF-8/JSON·null body·stream error, 이미 취소된 요청/본문 중 취소, HTTP200 후 본문 지연 및 headers 지연의15초 timeout, cancel 거부/무기한 대기, timer/listener/reader 정리, cache/credentials·optional404/HTTP 오류·브라우저 잔여 비동기 반복 방지를 확인했다. 가상 시계로15초 경계를 확인했으며 실제 DB 시각/서비스를 바꾸지 않았다. 로그 `.state/agent-logs/safari-json-targeted.log`.

`node tools/production-browser-check.mjs --fx-isolation --safari-streams` rc0. 새 document의 ReadableStream asyncIterator/AbortSignal.any를 undefined로 주입한 실제 Chrome에서 다섯 API200/FX503, USD 유지, FX 복구 후 KRW 표시와 last-good·renderer 오류 분리·자산 프로필·테마/390px·JS 오류0/비공개 요청0을 확인했다. fixture의 assetReviewReader 누락은 현재 공개 검토 snapshot을 명시 제공하도록 보완했고, FX 실패/회복 fixture 자체는 유지했다. 로그 `.state/agent-logs/safari-json-fx-browser.log`.

이 시험은 Safari에서 확인된 API 부재를 Chrome과 단위 시험에서 재현한 것이다. 실제 iPhone/Safari/WebKit 실행으로 주장하지 않는다. 자동 도구 설치/전역 Safari 설정 변경은 하지 않는다. 새 외부 API/DB/공급자 호출은 없다. 최종 전체 검사와 로컬 화면 회귀/commit·push 결과는 인계문에 기록한다.

## 최종 회귀·실행 결과

- `node .state/agent-logs/safari-json-browser-local.mjs`: rc0. 로컬 오프라인 시장 fixture와 저장 발췌를 사용해 Safari API 조건에서26프로필/179항목·두 화면 공통 snapshot/요청1회·로딩/오류·집계/검색/체인/탭/필터·모바일/테마·기존 시장 화면의 가격표시까지 확인했다. JS 오류0/외부 요청0. 로그 `.state/agent-logs/safari-json-profile-browser.log`.
- 해당 브라우저 시험의 첫 실행은 새로 추가한 기존 시장 화면 확인 selector를 `.metric-card`로 잘못 지정해 timeout됐다. 실제 기존 class는 `.market-stat`이므로 시험 selector를 수정하고 재실행해 통과했다. 제품 UI는 바꾸지 않았다. 실패 로그는 `.state/agent-logs/safari-json-profile-browser-attempt1.log`로 별도 보존했다.
- `node tools/production-browser-check.mjs --fx-isolation`: rc0. API 제거를 주입하지 않은 일반 Chrome에서도 기존 FX 실패/회복/last-good·화면 검증이 통과했다. 로그 `.state/agent-logs/safari-json-chrome-regression.log`.
- `npm run check > .state/agent-logs/safari-json-check.log 2>&1`: rc0 tests670/pass670/fail0/cancelled0/skipped0.
- `git diff --check`: rc0.

기존 소유 로컬 미리보기 PID58493의 명령/4173 listener를 확인해 정상 종료하고 같은 reader 인자로 재시작했다. 새 Node listener PID33867/exec session12678을 사용자 검토용으로 유지한다. 새 정적 `/browser-json.js` GET200만 확인했으며 실제 DB/API 데이터 조회는 실행하지 않았다. 로그 `.state/agent-logs/safari-json-preview.log`. 이것은 작업 PC의 소유 loopback 미리보기 갱신이며 운영 Mac mini 배포/SSH/서비스/Collector/FX 변경은 없다.

사용자 지시대로 이번 수정만 별도 commit하고 origin/main으로 push한다. 기존 다른 작업의 untracked `docs/handoff/2026-10-22-router-lead-review.md`와 .state/환경/키/원문은 제외한다. 실제 commit/push/원격 HEAD 일치는 `.state/agent-logs/safari-json-git.json` 및 최종 응답을 확인한다. [인계문](../handoff/2026-10-27-safari-stream-json.md).
