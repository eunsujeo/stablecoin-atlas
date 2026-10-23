# Allium 인증 확인
- 목표: 사용자가 설정한 ALLIUM_API_KEY 확인, 기존 CLI 환경설정 호환 유지, 완료 후 commit/push.
- 끝난 것: 비공개 .env.local의 키를 값 출력 없이 확인했다. Realtime prices/stats에 Ethereum USDC 한 건을 한 번 요청해 HTTP 200과 한 건 응답을 확인했다. 가격·1시간/24시간 고저가·변동률이 있으며 거래량 필드는 없었다. 기존 workspaceEnvironment 허용 목록과 빈 .env.example에 변수명을 추가했다. 상속 값 우선·리터럴 처리·관리형 proxy 변수 재정의 거부는 유지한다. 원문 응답·키는 저장/게시하지 않았다.
- 변경 파일: tools/workspace-env.mjs, .env.example, web/workspace.test.mjs, docs/DEVELOPMENT_STATUS.md, docs/research/allium-data-plan-2026-10-23.md
- 검증: node --import tsx --test web/workspace.test.mjs rc0 tests5/pass5/fail0. 실제 workspaceEnvironment 로드 OK·키 존재 true 확인. npm run check는 .state/agent-logs/allium-env-check.log에서 최종 rc와 tests/pass/fail을 확인한 뒤 commit/push한다. 앞선 node --test만 사용한 시도는 TypeScript 로더 미지정으로 실패했고 올바른 명령으로 통과했다.
- 기다리는 것: Allium API 추가 요청 없음. 기존 수집기와 UI 유지. 전체 검사 종료 대기 후 commit/push.
- 다음 행동: 공급량·전송량을 받을 상품 권한/조회 경로·비용·잔여 한도부터 확인한다. 현재 확인은 Ethereum USDC Realtime 한 endpoint에 한정하며 다른 자산/체인, Explorer SQL, 공급량 지원을 주장하지 않는다. 자동 수집이나 화면 연결은 아직 하지 않았다. 공개 문서 조사 내용은 research 파일 참조.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/DEVELOPMENT_STATUS.md, docs/research/allium-data-plan-2026-10-23.md, tools/workspace-env.mjs
