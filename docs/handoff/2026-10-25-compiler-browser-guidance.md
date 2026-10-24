# 공식 compiler 거절 시 브라우저 가이드 반영
- 목표: 사용자 요청에 따라 직접 취득이 거절되면 브라우저 창으로 이어가는 가이드를 정리하고 후속 Agent 지침에 연결한다.
- 끝난 것: AGENTS·정본 가이드·ADR0096에 보이는 새 임시 Chrome 창, 같은 공식 host/버전/파일, 방식 변경만으로 중복 승인을 요구하지 않는 흐름을 반영했다. 직접/브라우저 각각 최대2GET/34MiB/120초(합계4GET/68MiB/240초), 별도 새 소비 root·wx/fsync·hash/전체 버전·사설 검증, 브라우저도 거절되면 종료를 명시했다. 현재 USDT 직접 실패의 소비/원문을 보존했다. 보이는 창과 headless를 구분하고 gate/JS 차단만으로 Chrome 전체 통신을 검증했다고 주장하지 않으며 승인 한도 계측/강제가 불가하면 송신 전에 중단한다. 이번 작업은 문서만이며 브라우저 실행/추가 다운로드/새 RPC/profile 추가0이다. Lead 90cfcb4f035546e18f5148d23fcca6d5 answered/proceed 조건 반영, Agent/pane 추가0.
- 변경 파일: AGENTS.md, docs/COMPILER_BROWSER_ACQUISITION.md, docs/adr/0096-browser-compiler-acquisition-guidance.md, docs/adr/0095-bounded-usdt-solc0418-acquisition.md, docs/TOKEN_TECHNICAL_REVIEW.md, docs/research/2026-10-25-usdt-compiler-acquisition.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-25-compiler-browser-guidance.md
- 검증: npm run check > .state/agent-logs/compiler-browser-guide-check.log 2>&1 — rc=0 tests541/pass541/fail0/cancelled0/skipped0. Python 로컬 링크25개·기존 취득 기록5파일 hash·원본 입력7파일 hash 검사 — rc=0 PASS. git diff --check — rc=0. 실제 보이는 브라우저/0.4.18 compiler 검증은 이번 작업에서 미실행이다.
- 기다리는 것: 없음
- 다음 행동: 사용자가 후속 취득 진행을 요청하면 정본 가이드의 USDT0.4.18 고정 두 URL·별도 새 브라우저 소비 단계와 임시 창/gate/크기/시간 제한을 준비해 실행한다. 방식 변경 자체의 승인을 다시 묻지 않는다. 현재 직접 실패 root를 재사용하거나 다른 host/파일·추가 단계로 확대하지 않는다. 이 가이드 작성 자체는 실제 취득 진행 요청이 아니므로 지금 송신하지 않는다.
- 사용자 확인 필요: 예 — 후속 브라우저 취득 진행 요청. 동일 공식 파일의 방식 변경에 대한 중복 승인을 뜻하지 않는다.
- 읽을 파일: docs/COMPILER_BROWSER_ACQUISITION.md, docs/adr/0096-browser-compiler-acquisition-guidance.md, docs/research/2026-10-25-usdt-compiler-acquisition.md

원문/소비/오류는 .state/usdt-solc-0418-acquisition-once/에 그대로 보존한다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 같은 주제의 작은 후속 가이드 수정이므로 자동 새 대화는 예약하지 않는다.
