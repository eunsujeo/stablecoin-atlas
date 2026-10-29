# 다른 PC의 Herdr 개발 환경 재현 준비

사용자가 다른 PC에도 같은 개발 설정을 요청하고 핵심은 Herdr라고 정정했다. `.codex/hooks.json`, Router policy/adapters/Lead bridge가 이미 Git에 있고, 실제 runtime 경로·로컬 모델·venv·인증·Herdr session/pane ID는 PC별 상태임을 확인했다. Herdr skill을 읽고 HERDR_ENV=1을 확인한 뒤 설치 CLI의 help/status/agent/integration 문법을 기준으로 조사했다. 현재 client/server0.9.0/protocol22 호환, Codex integration v8/Claude v9. 현재 역할 router-impl/router-lead와 선택 router-coord를 확인했으며 다른 프로젝트 Agent는 변경/게시하지 않았다. 전역 Herdr config는 onboarding 키만 있어 사용자 키바인딩 복제는 필요하지 않았다.

`docs/ai/HERDR_NEW_PC_SETUP.md`에 설치/현재 CLI 확인→프로젝트 checkout→로컬 모델/venv→실제 pane/역할 이름→integration→사용자 hook 신뢰→회귀/요청 응답 확인 순서를 기록했다. 전체대화·세션DB·socket·PC별ID·인증·모델·runtime 원문은 Git에 넣지 않는다. 기존 NEW_PC_SETUP/ROUTER_WORKFLOW와 DEVELOPMENT_STATUS에서 연결했다. 같은 Supabase reader 개발 모드도 별도 파일/CA의 비공개 준비와 명시 UI 실행으로 안내했다. 운영 수집기/배포 활성화는 포함하지 않는다.

`tools/intelligent-router/adapters/setup.py check`는 PATH 도구 존재/로컬 runtime Python/manifest/hook 존재만 확인한다. 설치·추론·Herdr 조회/제어0이며 비밀·경로를 출력하지 않는다. runtime 명령은 지정 Python과 pin manifest를 검사하고 ignored config/runtime.local.json을0600 exclusive create한다. 기존 다른 설정/잘못된 manifest/누락 Python/symlink를 거절한다. CONFIGURED는 전체 가중치/추론/hook 신뢰 완료가 아니다. 실제 가중치/실행 소스 검증은 기존 poc/D3 loader에 유지했다.

초기 전역 config 키 조사에서 시스템Python3.9의 tomllib 부재를 만났다. config 값을 출력하지 않고 Python 표준 regex로 section/key 이름만 확인했으며 새 도구는 tomllib 의존이 없다. 공식 Herdr agent-guide 웹 열기는 HTTP400 Unsupported content-type:text/markdown으로 도구가 읽지 못했다. 설치 CLI와 제공 skill을 기준으로 문법을 확인했고 이를 사이트/자료 부재나 proxy 차단으로 해석하지 않았다.

검증: Router 전체 unittest56개 PASS(새 setup3개 포함), 현재 PC check=CONFIGURED/insideHerdr=true/tools3개 존재/hookDefinition=true/inference NOT_RUN/agentsStarted0. 별도 공백 경로의 깨끗한 임시 checkout 복사본에서 runtime MISSING/hookDefinition true와 경로 비노출/다운로드·Agent0 확인. `git check-ignore`로 runtime.local.json 제외 확인. 실제 새 PC 접속·패키지/모델 다운로드·새 Herdr pane/Agent 시작·전역 설정/인증 변경은 하지 않았다. 해당 PC OS/CPU와 실제 hook/Lead 종단 검증은 새 PC 단계다. 사용자가 직접 /hooks 신뢰·로그인을 수행한다.

Lead cc35278f34d549748bbba71f7fc8c560 proceed와 setup3개 독립검증 회수. 결과는 기존 범위의 검토이며 새 실행을 승인하지 않는다. 사용자 작업/운영 데이터 수집은0이다. 과정 로그 `/tmp/atlas-herdr-portable-router.log`, `/tmp/atlas-herdr-portable-check.log`. 화면 겹침 수정은 별도 연구 기록/커밋이다.

최종 검증: `npm run check` build 및 전체755건(681+네트워크 차단74) PASS/0fail. `python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py'` 56개 PASS. `git diff --check` PASS. 새 PC 실제 설치·인증·Herdr 종단 검증은 해당 PC 단계로 남는다.
