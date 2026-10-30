# GitHub App token 권한 키 정정

사용자가 지정한 tools/deploy/github-token.mjs의 installation access token 요청에서 permissions.variables를 permissions.actions_variables로 변경했다. actions/contents/statuses 권한과 요청 경로·나머지 로직은 유지한다. 기존 tests/deploy-automation.test.mjs의 요청 payload 기대값도 같은 키로 정정했다. 실제 GitHub API/키 사용·배포는 실행하지 않았다. 기존 새 PC 준비 문서와 비공개 설정/상시 로컬 웹을 보존하고 하위 에이전트는 사용하지 않았다.

초기 검사 전 탐색의 zsh glob이 존재하지 않는 tests/*github* 때문에 오류를 내어 rg 경로를 tests로 바로잡았다. 구현 실패나 외부 요청 실패는 아니다. 기존 mock fetcher 시험에서 JWT 서명·repository 범위·token 반환 및 새 permissions payload 검사가 통과했다. npm run check는 빌드 후 주734개 중726pass/0fail/8skip, 보존74개74pass/0fail/0skip으로 종료했다(총800pass/0fail/8skip/cancelled0). skip은 기존 미제공 compiler 캐시 관련8건이다. 도중 도구 서버가 재시작돼 원래 세션12559의 shell 종료 코드는 회수하지 못했지만, 실제 npm 프로세스 종료와 두 시험군 최종 요약·실패0을 로그에서 확인했다. 재실행하지 않았다. git diff --check rc0. 비공개 검사 로그는 .state/agent-logs/github-token-permission-check.log다.
