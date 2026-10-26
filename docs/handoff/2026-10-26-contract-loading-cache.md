# 컨트랙트 로딩바·1시간 캐시와 Git 인계

- 사용자 요청: DB에서 읽는 동안 로딩바를 표시하고 캐시를 길게 유지. 완료 후 push를 명시 승인했다.
- 완료: 기존 beginLoading/skeleton + indeterminate progress/aria-busy. 성공/오류 모두 로딩 정리. 컨트랙트 서버 성공 캐시10초→1시간, 동시요청 합치기 유지. 만료 후 다음 요청에서 재조회·오류 시 만료/정적 fallback 없음. HTTP/브라우저 no-store 유지. 즉시 새 요약을 읽으려면 로컬 UI 재시작. 다른 캐시/DB/Collector/운영배포 변경0.
- 검증: 표적3/pass3. 가상3599999ms hit/3600000ms 만료·실패/회복·연결 정리 확인. 실제 Chrome 로컬/DB모드 모두 rc0, 첫 응답 보류 중 로딩바/스켈레톤·가짜 완료율 없음·성공/503 정리 및 기존 최신1건/이력제외/범위표시/검색/테마/모바일/코드문구제외 유지. 전체 npm run check rc0 tests657/pass657/fail0/cancelled0/skipped0. git diff --check rc0. 실패/수정0. 시험의 보류 이벤트는 수신 루프를 계속 처리한다.
- 근거: [연구 기록](../research/2026-10-26-contract-loading-cache.md). 로그 .state/agent-logs/contract-loading-cache-{targeted,check,browser-local,browser-db,preview}.log. 새 체인RPC/공급자API/키/DB변경 없음. 브라우저 외부요청0은 서버의 기존 Supabase SQL 읽기와 구분한다.
- 실행 중: http://127.0.0.1:4173/#contracts. 기존 소유 PID25681 정상 종료 후 같은 reader 인자로 새 Node listener PID33076, exec session43976 유지. 명령 npm run ui -- --database --database-env .state/market-db-secrets/reader.env. 종료 시 현재 소유/명령을 확인하고 이 미리보기만 정상 종료한다. 미회수 Agent/검토/임시 pane 없음.
- Git: 사용자 승인으로 이번 대화의 Supabase 저장/권한/로컬 API·최신 한 건/로컬 범위 표시·코드 문구 제거·로딩/캐시·검증·문서/인계를 함께 커밋/push한다. main과 origin/main이 같은 상태에서 시작했고 workflow_dispatch 전용이라 push가 운영 배포를 실행하지 않는다. 강제 push 없음. 실제 commit/push/원격 HEAD 일치 결과는 .state/agent-logs/contract-loading-cache-git.json 및 최종 응답을 확인한다. 기록이 없으면 push 완료로 추정하지 않는다.
- 제외: .state/환경/키/URL/원문. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 수정/commit 제외. 앞선 runtime/DB receipt·판정·소비는 유지.
- 다음: 현재 요청의 구현/검증은 완료. push 결과 확인 후 새 요청을 기다린다. 이전 이력을 화면에 되살리거나 실제 권한/소스 진위/안전성 인증을 로컬 완료 필수조건으로 요구하지 않는다. 새 외부 조회/운영배포 자동 진행 없음.
