# Collector 심볼릭 링크 CLI 진입점 수정
- 목표: collector-current 경유 무출력 rc0 수정. 로컬 검증·commit/push까지만 수행하며 서버 배포·실제 API/DB·기존 수집 상태 변경 제외.
- 끝난 것: 모듈과 argv 경로 문자열 불일치를 subprocess로 재현(수정 전7시험 실패). 양쪽 realpath 공통 함수와 systemd Node CLI6종 적용. 실제/디렉터리 링크/파일 링크/상대 경로/preserve-symlinks-main/import-only 및 공백/# 경로 검증. 무통신 doctor·합성 FX check/publish 성공과 원본 보존 확인. 시험 구성의 Node env-file rc9·불완전 XML·preload URL fragment 오류 수정. Lead e20d4b63d91b44238e3df8672a90f05a proceed. 수집 주기/상한/Receipt/Archive/unit 유지. 외부 데이터API·Supabase·기존 상태·실제 서버 변경0.
- 변경 파일: tools/cli-entrypoint.mjs, tools/collector-worker.mjs, tools/registered-collector.mjs, tools/fx-store.mjs, tools/collector-deploy.mjs, tools/publish-production-fx.mjs, tools/production-web.mjs, tests/cli-entrypoint.test.mjs, docs/COLLECTOR_PRODUCTION_RECOVERY.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-collector-symlink-entrypoint.md, 이 인계문
- 검증: node --test --test-reporter=tap tests/cli-entrypoint.test.mjs rc0 tests8/pass8/fail0; npm run check rc0 tests608/pass608/fail0/cancelled0/skipped0; npm run check:production rc0 tests15/pass15/fail0/cancelled0/skipped0; git diff --check rc0. 로그 .state/agent-logs/collector-symlink-*.log 및 cli-entrypoint-{before,after}.log. Mac Node25.2.1 시험이며 실제 Fedora/ARM64/systemd·Supabase status NOT_TESTED.
- 기다리는 것: 없음
- 다음 행동: 사용자가 제공한 새 SHA의 Fedora 적용 결과에서 collector-current와 실제 경로의 출력/종료 코드를 대조하고 연구 기록에 반영한다. 서버 명령/DB조회·배포·수집/timer 활성화는 별도 승인 없이는 시작하지 않는다. 현재 범위 추가 구현 없음.
- 사용자 확인 필요: 예 — 새 SHA 운영 적용 결과 또는 구체적 후속 작업 요청 필요.
- 읽을 파일: docs/research/2026-10-25-collector-symlink-entrypoint.md, docs/COLLECTOR_PRODUCTION_RECOVERY.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존하며 이번 커밋에서 제외한다. GitHub push는 서버 적용이 아니다.
