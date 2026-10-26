# 컨트랙트 DB 조회 로딩바와 1시간 캐시

사용자가 DB 조회 중 로딩바와 긴 캐시를 요청했고, 완료 후 push를 지시했다. 컨트랙트 요약의 서버 성공 캐시를 기존10초에서 1시간으로 늘리고, 기존 beginLoading/skeleton에 indeterminate progress를 더했다. 성공과 오류 모두 aria-busy/로딩바를 정리하며 진행률 숫자를 추정하지 않는다. 마지막 표본의 관측 시각/판정·최신 한 건 표시를 유지한다.

캐시는 process 내 검증된 성공 응답만 보존하고 동시 요청은 한 DB 읽기로 합친다. 만료 시 다음 요청에서 재조회한다. 실패하면 만료 자료/정적 자료를 대신 제공하지 않는다. 브라우저/HTTP no-store를 유지하고 다른 시장 데이터 캐시·DB 스키마·수집기·운영 배포는 변경하지 않는다. 새 요약은 최대1시간 늦게 표시될 수 있으며, 즉시 갱신하려면 로컬 UI를 재시작한다.

표적 `node --test tests/contract-review-db.test.mjs` rc0 tests3/pass3/fail0. 가상 시계로 첫 읽기/동시 합치기·3599999ms cache hit·3600000ms 만료·재조회 실패/회복과 연결 정리를 확인했다. 로그 `.state/agent-logs/contract-loading-cache-targeted.log`. 새 시계는 시험 주입에만 사용하며 실제 DB 시각을 바꾸지 않는다.

`node .state/agent-logs/contract-review-browser-local.mjs` rc0. Chrome의 첫 응답을 보류해 로딩바/스켈레톤과 aria-busy=true·가짜 완료율/보고서 없음 상태를 확인한 뒤 실제 응답을 통과시켜 정리를 검증했다. API503 오류에서도 로딩바/aria-busy를 정리했다. 기존 검색/탭/키보드/테마/모바일·최신 한 건·이력/코드 문구 없음·외부/비공개 요청0을 유지했다. 로그 `.state/agent-logs/contract-loading-cache-browser-local.log`, 화면 `.state/contract-dashboard-loading.png`. 구현/표적 시험 실패0. 브라우저 시험 도구의 보류 이벤트는 수신 루프를 계속 처리하도록 했다.

Local Router shadow 추천은 제공돼 재호출하지 않았다. 변경은 기존 읽기 캐시 TTL과 로딩 UI에 한정돼 별도 구조/권한/동시성 체계 변경이나 Lead 추가 요청은 없다. 하위 Agent/임시 pane은 만들지 않았다. Git fetch 후 원격과 HEAD가 같은 것을 확인했고, GitHub workflow는 workflow_dispatch 전용이므로 push 자체로 운영 배포를 실행하지 않는다. 비공개 .state/환경/키/원문은 Git 제외를 확인했다. 기존 untracked `docs/handoff/2026-10-22-router-lead-review.md`는 이번 작업 파일이 아니므로 commit에서 제외한다.

최종 전체 검사·실제 reader 화면·로컬 서버 갱신·commit/push 결과는 후속 인계에 기록한다.

최종 `npm run check` rc0 tests657/pass657/fail0/cancelled0/skipped0. 로그 `.state/agent-logs/contract-loading-cache-check.log`. 실제 Supabase reader 모드의 Chrome 검증도 rc0으로 로딩바/정리·최신 한 건·기존 동작을 확인했다. 로그 `.state/agent-logs/contract-loading-cache-browser-db.log`. 로컬 미리보기는 소유 PID25681의 명령/포트를 확인하고 정상 종료한 뒤 동일 reader 인자로 재시작했으며 Node listener PID33076/exec session43976으로 유지한다. 서버 시작 후 새 TTL이 적용됐다. `git diff --check` rc0.

사용자 승인에 따라 이번 대화의 Supabase 저장·표시 정정·로딩/캐시 변경과 연구/인계를 함께 main에 커밋하고 origin/main으로 push한다. 기존 다른 작업의 untracked 인계문은 제외한다. 최종 commit/push와 원격 HEAD 일치 결과는 `.state/agent-logs/contract-loading-cache-git.json`과 최종 응답에 남긴다. [인계문](../handoff/2026-10-26-contract-loading-cache.md).
