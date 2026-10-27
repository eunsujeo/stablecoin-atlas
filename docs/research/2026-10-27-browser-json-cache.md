# 브라우저 정상 JSON 캐시와429 요청 통제

## 요청과 범위

사용자가 반복 새로고침 시 여러 JSON API의429를 줄이도록 IndexedDB·TTL·캐시 우선 표시·중복/병렬 통제·Retry-After·last-good/오래됨 표시를 요청했다. [ADR0115](../adr/0115-browser-json-cache-and-request-policy.md)·[사용 안내](../BROWSER_REQUEST_CACHE.md)에 정책과 한계를 기록했다. 서버 캐시/API·Supabase 스키마/운영 데이터·Collector/FX 서비스·Cloudflare Rate Limiting 규칙/배포는 변경하지 않는다. 실제 운영 Mac mini에 직접 배포하지 않고 별도 commit/push한다.

## 구현 경로

기존 Safari JSON helper와 각 모델/로더/회귀 시험을 읽었다. 전체 현황의 Promise.allSettled와 evidence 등 별도 로더가 같은 URL을 반복 요청하고, asset의 영구 Promise는 실패/TTL 갱신을 표현하지 못했다. 저수준 getReader/바이트/UTF8/timeout은 유지하고429의 안전한 metadata만 전달하도록 확장했다. 별도 브라우저 정책/요청/IndexedDB/상태 모듈과 기존 로더의 호출부만 연결했다. 새 JS 정적 자산만 로컬/production 허용목록에 등록했다.

정상 JSON은 모델/민감값·위험키/byte 검증 후 schema/version·URL/credentials·history source/date context별로 저장한다. payload와 저장 시각 등을 묶은 SHA256으로 복원 시 손상을 확인한다. 금액을 Number로 바꾸거나 원래 관측 시각/출처·판정을 갱신하지 않는다. 브라우저 저장 시각은 별도다. hit/실패로 TTL을 연장하지 않는다. 시장/등록/활동5분, 기술/컨트랙트/FX/저장 자료1시간이며 기존 endpoint별 작은 한도와 전역2MiB를 유지한다.

같은 요청을 공유하고 구독자 abort를 분리했다. 탭당 동시2/시작250ms/대기32, 이미 취소된 작업·영구 실패 Promise 재사용 방지, epoch/순서 guard, 슬롯 회수를 구현했다. IndexedDB open/operation 각1초와 최대32건/payload8MiB/오래된 항목 제거를 적용했다. getter/blocked/quota/transaction 실패는 메모리로 저하하고 명시 표시한다.

429는 origin 공통으로 즉시 멈추며 queued dispatch 직전 기한을 재확인한다. 초/HTTP date·서버 Date를 처리하고 잘못된 헤더는60초 보수 대기한다. IndexedDB/sessionStorage scalar·BroadcastChannel로 기한을 공유한다. 자동 재시도0이며 다음 사용자/기존 주기 조회만 기한 후 새 요청을 만들 수 있다. JSON cache 제거는 cooldown을 지우지 않는다. 동시2/병합은 탭 단위이고 모든 저장소가 금지되면 reload 간 보존은 불가능하다.

유효 cache는 HTTP 없이 표시하고, 만료 cache는 즉시 표시한 뒤 한 번 갱신한다. 갱신 실패/429는 마지막 정상 JSON/시각을 유지하며 상태 배너에 오래된 캐시·갱신 실패·요청 제한·다음 가능 시각과 브라우저 저장 시각을 구분해 표시한다. history는 현재 index의 selection/coin/metric/source/date pin과 맞는 값만 채택한다. 기존 판정/자산 안전성·실행/원문 공개 경계는 유지한다.

Local Router shadow 추천은 제공돼 재호출하지 않았다. 동시성 검토 Lead `79dba779b4e04f0689b1dd0da76a0799`의 proceed/조건을 회수해 모델/byte/TTL·지연된 DB읽기·구독 취소·429/reload·탭 범위·오류 회귀를 반영했다. 하위 Agent/임시 pane은 만들지 않았다.

## 실패·원인·수정

- 첫 단위 시험에서 stale 반환 직후 background 요청이 이미 시작했을 것으로 가정한 시험을 실제 비동기 시작에 맞췄다. 제품은 cached 값을 네트워크보다 먼저 반환한다.
- Retry-After `1.5`가 Date.parse에서 과거 날짜로 해석돼 보수 대기가 사라지는 문제를 발견했다. HTTP date 형식 검사 후에만 날짜로 해석한다. 첫 실패 로그 `.state/agent-logs/browser-cache-targeted-attempt1.log`.
- 실제 Chrome quota 주입에서 IDB getAll 성공 callback 안의 put 예외가 초기 try/catch 밖으로 나가 Uncaught가 발생했다. 비동기 callback도 guard하고 transaction abort/error를 정리하도록 수정했다. 실패 로그 `.state/agent-logs/browser-cache-idb-browser-attempt1.log` 보존, 이후 실제 브라우저 오류0.
- Node25의 전역 sessionStorage가 가상 시계를 쓰는 서로 다른 단위 시험 사이에 cooldown을 공유했다. 기본 sessionStorage는 브라우저 window에서만 읽고 시험은 명시 주입하도록 격리했다.
- 기존 브라우저 회귀의 반복 navigation은 새 정책에서 정상적으로 요청0이므로 warm 조회를 검증하도록 맞췄다. 강제 API 실패 시험은 JSON cache를 명시 제거해 cold 실패를 재현하고, warm last-good/429는 별도 실제 IndexedDB 시험으로 검증했다. FX fixture의 실패/회복 값과 실제 FX 서비스는 바꾸지 않았다.

## 검증

- `node --test web/browser-cache.test.mjs web/browser-json.test.mjs tests/production.test.mjs web/supply-overview.test.mjs`: rc0 tests47/pass47/fail0. 검증/정밀도·reload/TTL 비연장·stale 즉시/실패 보존·병합/독립취소/취소큐 재선택·동시2/시작간격/대기상한·429 origin/reload/date/잘못된 헤더/재시도0·손상/metadata/epoch·quota/blocked/getter·session fallback·한도/UTF8/15초·공개 import/기존 history pin을 확인했다. `.state/agent-logs/browser-cache-targeted.log`.
- `node tools/browser-cache-browser-check.mjs`: rc0. 실제 Chrome IndexedDB에서 reload API요청0, stale 즉시표시,429의 reload/다른 URL 차단, last-good 배너, 기한 후 갱신, 손상 폐기, quota 메모리 전환, 건수/크기 eviction, 원래 source/time/amount 일치를 확인했다. ReadableStream asyncIterator/AbortSignal.any를 제거해 Safari 조건을 재현했고 JS 오류0/브라우저 외부요청0이었다. `.state/agent-logs/browser-cache-idb-browser.log`, `.state/browser-cache-429-last-good.png`.
- `node .state/agent-logs/safari-json-browser-local.mjs`: rc0.26프로필/179기능·warm 재진입 추가API0·공통 snapshot·기존 집계/판정/검색/필터/탭/테마/모바일/시장/Safari 조건 확인. `.state/agent-logs/browser-cache-profile-browser.log`.
- `node .state/agent-logs/contract-review-browser-local.mjs`: rc0. 최신1건/범위·로딩/오류·탭/검색/테마/모바일·근거 장애 독립성 유지. `.state/agent-logs/browser-cache-contract-browser.log`.
- `node tools/production-browser-check.mjs --fx-isolation --safari-streams`: rc0. 오프라인 production fixture로 시장/FX 실패·회복·last-good/renderer오류 분리·프로필/모바일/정적/비공개 경계를 검증했다. `.state/agent-logs/browser-cache-fx-browser.log`.

실제 iPhone/Safari 실행으로 주장하지 않는다. 모든 브라우저 시험은 소유 fixture/loopback/가상 자료·시계를 사용했고 실제 공급자/DB/API 데이터 수집·운영 변경은 없다. 기존 상시 로컬 UI는 정적 자산 갱신만 필요하며 새 운영 배포로 이어가지 않는다. 전체 검사/Git 결과/미리보기 인계는 완료 후 기록한다.

## 최종 전체 검사·인계

`npm run check > .state/agent-logs/browser-cache-check.log 2>&1` rc0 tests691/pass691/fail0/cancelled0/skipped0. `node tools/production-browser-check.mjs --fx-isolation`의 일반 Chrome 회귀도 rc0이었다(`.state/agent-logs/browser-cache-chrome-regression.log`). 실제 iPhone 실기기는 미실행이며 Chrome의 Safari API 부재 조건 재현과 구분한다. `git diff --check` rc0.

기존 소유 작업 PC의 loopback 미리보기 PID33867 명령/포트를 확인해 정상 종료하고 같은 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`로 재시작했다. 새 Node listener PID89818/exec session93378을 사용자 검토용으로 유지한다. 새 공통 정적 JS4개의 HEAD200만 확인했고 실제 데이터 API/DB 조회는 검증에서 실행하지 않았다. `.state/agent-logs/browser-cache-preview.log`. 운영 Mac mini/SSH/서비스/Cloudflare 배포는 수행하지 않았다.

사용자 지시에 따라 이번 정책 변경/검증/문서를 별도 main commit 후 origin/main으로 push한다. fetch 당시 원격과 HEAD가 같았고 workflow_dispatch 전용이라 push만으로 운영 배포가 실행되지 않는다. 실제 commit/push/원격 HEAD 일치 결과는 `.state/agent-logs/browser-cache-git.json`과 최종 응답을 확인한다. 기존 untracked `docs/handoff/2026-10-22-router-lead-review.md`·.state/키/환경/원문은 commit하지 않는다. [인계문](../handoff/2026-10-27-browser-json-cache.md).
