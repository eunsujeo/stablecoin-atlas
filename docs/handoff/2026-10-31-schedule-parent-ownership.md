# Bootstrap schedule 부모 소유권 예외
- 목표: 정확한 승인 schedule 경로의 기존 root파일/collector부모 조합만 허용하고 전체검사후commit/push.
- 끝난 것: [0,파일uid]가 root/root이 되어 collector부모를 거부하는 원인경로확인. root0644 고정schedule + 직상위collector0700만예외. nofollow핸들/inode·metadata·크기·SHA/사후경로검증, 다른경로·조상·쓰기권한·symlink거부유지. 운영변경/조회·하위에이전트0, 기존비대상자료보존.
- 변경 파일: tools/deploy/config.mjs, tests/deploy-config.test.mjs, docs/AUTOMATED_DEPLOYMENT.md, docs/adr/0120-pull-based-production-automation.md, docs/research/2026-10-31-schedule-parent-ownership.md, docs/handoff/2026-10-31-schedule-parent-ownership.md
- 검증: 최종targeted rc0/61pass/0fail/0skip. npm run check rc0/814pass/0fail/8skip/cancelled0(740+74pass). 기존compiler누락8skip. git diff --check rc0.
- 기다리는 것: 없음
- 다음 행동: 검사완료후해당6파일commit/main push. 운영Macmini의직접변경/소유권수정/plan실행하지않는다.
- 사용자 확인 필요: 아니오 — 전체검사/commit/push까지명시승인.
- 읽을 파일: docs/research/2026-10-31-schedule-parent-ownership.md, docs/AUTOMATED_DEPLOYMENT.md
- 자동 새 대화 예약: 안 함 — 요청작업완료후보고.
