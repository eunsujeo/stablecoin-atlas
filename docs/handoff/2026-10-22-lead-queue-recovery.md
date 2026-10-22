# Lead 전달 장애 복구
- 목표: router-lead 미호출 버그를 먼저 수정하고 검증·push한다.
- 끝난 것: 오래된 delivery_uncertain 한 건이 pending 네 건을 차단한 상태를 확인했다. 실제 idle pane을 읽고 완료된 작업의 pending부터 취소한 뒤 차단 요청을 마지막으로 취소했다. 원본 요청·이전 상태·취소 사유는 로컬 큐에 남고 응답을 만들지 않았다. 준비 실패/전달 불명·dispatch 단계·안전한 오류 진단을 분리했다. 취소 후 watcher 재시작으로 다음 pending을 자동 전달하고 중복 전송을 막는다. 실제 Lead가 첫 검토 revise_plan 후 보완본에 proceed로 응답했다. 최초 장애의 원인은 예전 기록 부재로 미확정이다.
- 변경 파일: tools/intelligent-router/adapters/lead.py, tools/intelligent-router/adapters/renew.py, tools/intelligent-router/evaluation/test_lead.py, AGENTS.md, docs/adr/0052-lead-queue-recovery.md
- 검증: python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py' rc=0, 45 tests OK. npm run check rc=0, 289 pass/0 fail. git diff --cached --check 통과. 실제 보완 요청은 dispatch_phase=prompt에서 answered/proceed까지 확인했다.
- 기다리는 것: 미회수 Lead 없음. bc634d6af3d7474684bdbbf12e3f3b5f=answered/revise_plan, 66cf5e605a1f405d8eccefe2ca39f73a=answered/proceed; 로컬 tools/intelligent-router/.state/lead에 기록. 기존 UI/5분 수집 프로세스는 그대로 유지했다. 별도 미추적 docs/handoff/2026-10-22-router-lead-review.md는 이번 작업 파일이 아니므로 건드리지 않았다.
- 다음 행동: 사용자 요청을 우선한다. 원래 이어갈 개발은 JPYC/JPYSC와 코인별 최대10 네트워크 수집의 DB metadata·단위·최소 권한 reader 확장이다. 기존 registration metadata preview 인계문을 읽고 이어간다. 이 작업에서 실제 신규 코인 DB/UI 등록은 하지 않았다.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/adr/0052-lead-queue-recovery.md, docs/handoff/2026-10-22-registration-metadata-preview.md, docs/adr/0051-registration-metadata-and-unit-preview.md
