# Supabase 저장 연결과 Overview 자산·네트워크 검증 랭킹

이 문서는 보류 당시 기록이다. 후속 사용자가 UI push를 지시했다. 현재 상태는 2026-10-22-overview-ranking-push.md를 따른다.
- 목표: 새 Supabase 프로젝트 연결 준비와 사용자 정정에 따른 자산/네트워크별 통과 점수·판정 완료 비율 랭킹.
- 끝난 것: DB 사전 점검·정확한 UUID/hash 단발 projection import·실패 보존·COMMIT 결과 불명 재import 복구·설정 안내를 d7fea8b로 commit/push했다. 실제 Supabase는 DATABASE_URL 미설정으로 NOT_TESTED다. Overview는 로컬에3자산/4네트워크 검증 랭킹·score/coverage 정렬·공동 순위·미산정·항목 가중 집계·그룹 근거 이동을 반영했다. 실제 읽기/Fixture 분리 유지. UI 변경은 개발 검토 전달 미확인 때문에 아직 commit/push하지 않았다.
- 변경 파일: web/overview-model.js, web/overview.js, web/overview.test.mjs, web/evidence.js, web/index.html, web/styles.css, docs/DEVELOPMENT_STATUS.md, docs/adr/0043-overview-asset-network-rankings.md
- 검증: npm run check rc=0 tests258/pass258/fail0/cancelled0/skipped0(.state/agent-logs/overview-rank-check.log). node --test web/overview.test.mjs rc=0 tests7/pass7/fail0. npm run check:db rc=0 tests10/pass10/fail0(.state/agent-logs/supabase-db-test.log). node .state/overview-rank-browser-qa.mjs 로컬 미리보기 rc=0 PASS1/fail0: 3자산/4네트워크, 정렬/그룹31항목 이동, Fixture7/1 분리, dark/light/390px, 읽기 실패 유지, 외부 페이지 요청0. git diff --check rc=0. 실 Supabase 점검은 설정 누락 DATABASE_CONFIG_INVALID, 원격 접속0회.
- 기다리는 것: 사용자 DATABASE_URL/필요 CA 로컬 설정. DB Lead96c619d9dbf84fe5ae4a6e02338f7e47 answered/proceed. UI Lead39f4aa8b2236433b9b301fa56100c609는 delivery_uncertain/응답없음. AGENTS.md에 따라 자동 재전송하지 않았고 같은 요청의 수동1회 재전달 여부를 사용자에게 질문했다. UI PID64398(세션65448), JSON collector PID48600(세션89393, 기본12회)을 로컬 확인용으로 유지한다. DB 모드 수집은 실행하지 않았다.
- 다음 행동: 사용자 답변을 확인한다. 허용 전에는 검토 요청을 재전송하거나 UI 변경을 push하지 않는다. 허용 시 같은 요청 id를 보존하여 한 번만 전달하고 결과를 회수한다. 실 DB 설정 후 관리자 init/partition/전용역할 준비→writer 점검→기존 JSON collector 정상 종료 후 명시 --database 실행. router-lead-review 인계문은 다른 작업 파일이므로 수정/포함하지 않는다.
- 사용자 확인 필요: 예 — Supabase 로컬 접속 설정, 개발 검토 요청 수동1회 재전달 여부
- 읽을 파일: docs/SUPABASE_SETUP.md, docs/adr/0042-supabase-collector-persistence.md, docs/adr/0043-overview-asset-network-rankings.md, AGENTS.md
