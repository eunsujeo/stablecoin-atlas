# 독립 배포 근거 취득 계획
- 목표: 저장 immutable 참조표의 다음 행동인 JPYC·RLUSD·JPYSC 독립 build/배포 자료 취득 경로와 외부 한도를 오프라인 구체화.
- 끝난 것: JPYC 우선 고정 공개 GET8건(A)을 제안했다. 공식 주소 gate·JPYC 사이트→조직 연결·2MiB/전체12MiB·120초·실패 전체 종료·재시도0·새 wx 소비를 명시했다. RLUSD/JPYSC 각8RPC/전체16RPC(B)는 별도 미승인 후속으로 분리했다. JPYC는 저장 블록 관측 활용 대상으로 유지했다. 새 외부 취득/RPC/컴파일/immutable 제출/대조0·기존 UNKNOWN5/5·8/8 보존. Lead 29a9fe1500e54a87a2a6160f4bf29ccb action proceed, 조건을 문서에 반영했다.
- 변경 파일: docs/research/2026-10-25-independent-deployment-evidence-plan.md, docs/research/2026-10-25-token-review-remaining-work.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-25-independent-deployment-evidence-plan.md
- 검증: 로컬 링크·고정GET8·Lead 참조 Python 검사 rc0 PASS. npm run check — rc0 tests564/pass564/fail0/cancelled0/skipped0 (.state/agent-logs/independent-deployment-evidence-plan-check.log). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 사용자에게 계획 A의 고정 GET 최대8건/120초/전체12MiB만 승인받는다. 승인 전 외부 요청/소비를 시작하지 않는다. 승인 시 URL/주소 gate·budget·새 소비·오류 종료를 먼저 로컬 가상 transport로 검증하고 한 번만 취득한다. B·추가 링크·compiler/immutable 대조는 A에 포함하지 않는다.
- 사용자 확인 필요: 예 — 신규 공개 자료 취득 A의 정확한 한도/실패 조건. 단순 후속 진행은 외부 실행 승인으로 해석하지 않는다.
- 읽을 파일: docs/research/2026-10-25-independent-deployment-evidence-plan.md, docs/research/2026-10-25-token-review-remaining-work.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 질문으로 끝나는 턴이므로 자동 새 대화는 예약하지 않는다.
