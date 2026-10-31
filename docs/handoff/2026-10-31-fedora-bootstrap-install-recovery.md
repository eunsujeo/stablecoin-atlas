# Fedora Bootstrap 경로·부분 설치 복구
- 목표: 정확한 sbin→bin root시스템링크 검증과 설치사전검사/복구를 구현하고전체검사후commit/push.
- 끝난 것: trusted exact root sbin/bin양쪽chain검증·타링크/owner/write거부. plan/install 목적지·effectiveunit경로사전검사, inactive/missing guard. private journal/backup·metadata보존·마지막receipt·known변경rollback/hardcrash재실행·pendingapply차단. NodeFD kernel lease. CIrelease실파일재검증/원문/포인터보존. 기존서비스/권한/owner·운영접근/DB/공급자/하위에이전트0.
- 변경 파일: tools/deploy/files.mjs, tools/deploy/bootstrap.mjs, tools/deploy/bootstrap-install.mjs, tools/deploy/bootstrap-lease.mjs, tools/deploy/stage.mjs, tools/deploy/system.mjs, tests/deploy-bootstrap-fixture.mjs, tests/deploy-bootstrap-paths.test.mjs, tests/deploy-bootstrap-recovery.test.mjs, docs/AUTOMATED_DEPLOYMENT.md, docs/adr/0124-fedora-bootstrap-install-recovery.md, docs/research/2026-10-31-fedora-bootstrap-install-recovery.md, docs/handoff/2026-10-31-fedora-bootstrap-install-recovery.md
- 검증: 최종targeted98pass/0fail/0skip. npm run check종료0: 본시험777pass/0fail/8skip+보관시험74pass/0fail=851pass/0fail/8skip. 기존compiler캐시미보유skip유지. git diff --check통과.
- 기다리는 것: 없음. 구현·검증완료.
- 다음 행동: 검증된이번13파일만commit/main push. 비대상새PC문서2개·비공개자료보존. Macmini직접install/서비스조작하지않는다.
- 사용자 확인 필요: 아니오 — 검사/commit/push명시승인.
- 읽을 파일: docs/research/2026-10-31-fedora-bootstrap-install-recovery.md, docs/adr/0124-fedora-bootstrap-install-recovery.md, docs/AUTOMATED_DEPLOYMENT.md
- 자동 새 대화 예약: 안 함 — 요청된구현/검사/push완료후보고.
