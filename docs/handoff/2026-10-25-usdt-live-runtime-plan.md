# USDT 신규 고정 해시 대조 계획
- 목표: 후속 진행 승인에 따라 실제 USDT 코드 대조의 정확한 입력과 읽기 한도를 구체화한다.
- 끝난 것: 저장 출력 재사용·단일 주소·최대6RPC/120초·재시도/endpoint 전환0의 계획을 작성했다. 저장 입력25파일 SHA256 및 compiler artifact hash/길이를 확인했다. Lead 92e85a293638425495029c14ea842f01의 proceed 조건을 반영했다. 신규 RPC/컴파일/다운로드/실제 배포 대조0이며 wrapper 구현/가상 검증은 NOT_TESTED다. 기존 UNKNOWN/MISMATCH/보고서/소비를 보존한다.
- 변경 파일: docs/research/2026-10-25-usdt-live-runtime-plan.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-25-usdt-live-runtime-plan.md
- 검증: 저장 입력 재독 Python — rc0 PASS(25파일 SHA256·artifact2381870바이트). npm run check — rc0 tests551/pass551/fail0/cancelled0/skipped0 (.state/agent-logs/usdt-live-runtime-plan-check.log). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 사용자에게 계획의 단일 주소·기존 RPC_URL·6RPC/120초·고정hash 코드1회/종료 재확인·저장 runtime 대조 범위를 확인받는다. 확인되면 신규 wrapper와 로컬 가상 transport 검증을 먼저 완료하고 새 wx 소비로 단발 실행한다. 그 전 외부 송신은 시작하지 않는다.
- 사용자 확인 필요: 예 — 구체화한 외부 실행 범위 승인
- 읽을 파일: docs/research/2026-10-25-usdt-live-runtime-plan.md, docs/research/2026-10-25-usdt-stored-runtime-analysis.md, docs/adr/0098-legacy-runtime-omitted-immutable-ranges.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 질문으로 끝나는 턴이므로 자동 새 대화는 예약하지 않는다. 원문/compiler bytes/키/RPC URL은 Git·웹에 게시하지 않는다.
