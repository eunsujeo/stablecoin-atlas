# Router 개발 도구의 범위

사용자가 허용한 로컬 Decision Model·자동 추천 요청·Herdr 수명 관리 개발 도구다. 루트 AGENTS.md의 제품 내부 LLM 금지와 인증/모델 전역 설정 변경 금지는 유지한다. 모델 매핑은 실행 중인 Codex나 제품을 변경하지 않는 shadow 추천용 데이터다.

- 기본은 shadow 추천이다. 프로젝트 UserPromptSubmit hook은 로컬 모델만 호출한다. 필요한 예외는 Lead bridge의 요청/응답 큐와 Herdr prompt로 전달한다. native hook trust를 우회하지 않는다. 모델 자동 전환/자율 Agent 생성은 하지 않는다.
- 모델 가중치·가상환경·인증정보를 저장소에 넣지 않는다. 관리형 프록시 환경은 그대로 상속한다.
- 요청별 전체 저장소/대화 전달 금지. 필요한 파일/함수 발췌문만 명시적으로 받는다.
- 모델 오류·불확실성·잘린 컨텍스트는 보수적으로 fallback하고 confidence를 만들지 않는다.
- 하위 에이전트 추가 실행은 기본 금지다. 향후 사용자 요청으로 허용된 독립 작업만 Herdr로 분리하며, 동시 writer는 서로 다른 worktree를 사용한다.
- 변경 후 `python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py'`와 루트 `npm run check`를 실행한다.
