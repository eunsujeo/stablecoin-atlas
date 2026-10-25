# systemd Reader Credential 호환성 수정
- 목표: 사용자 보고 Fedora UID981/root0440 LoadCredential 거절을 새 커밋으로 수정. 이 환경에서 배포하지 않는다.
- 끝난 것: production 전용 Reader 파일 모듈을 추가했다. CREDENTIALS_DIRECTORY의 정확한 /run/credentials/<단일 unit>/reader.env만 별도 정책으로 root0400/0440·서비스0400/0600 허용. root 관리 상위/비공개 unit 디렉터리·symlink 부재를 검사하고 O_NOFOLLOW fd에 소유/권한/동일성/64KiB/읽기 후 안정성을 검증한다. 일반 파일 정책·Preview·Reader/Writer·TLS 유지. 고정 오류만 노출. 운영 원본/기존 릴리스 변경0. Lead e2f6cdf86c4540a193b1a84bbe0adee2와 901bab8251f64a0c9029b85302170e5f 모두 proceed. 실제 Fedora/운영DB 접속0.
- 변경 파일: tools/production-reader-file.mjs, tools/production-web.mjs, tests/production-credential.test.mjs, docs/PRODUCTION_DEPLOYMENT.md, docs/DEVELOPMENT_STATUS.md, docs/adr/0106-systemd-reader-credential.md, docs/research/2026-10-25-systemd-reader-credential.md, 이 인계문
- 검증: npm run check rc0 tests598/pass598/fail0/cancelled0/skipped0; npm run check:production rc0 tests14/pass14/fail0/cancelled0/skipped0; node --use-env-proxy --test --test-concurrency=1 tests/postgres/production.test.mjs tests/postgres/preview.test.mjs rc0 tests2/pass2/fail0/cancelled0/skipped0. .state/agent-logs/credential-{check,production,postgres}.log. Linux UID/모드 주입 모델과 실제 로컬 파일 시험은 구분했다. PG17은 새 소유 Fixture만 실행/정리. 실제 Fedora mount/ACL·SELinux·서비스 재시작·health는 NOT_TESTED.
- 기다리는 것: 없음
- 다음 행동: 새 사용자 요청이나 운영자가 제공하는 새 SHA 적용 결과를 확인한다. 사용자 지시대로 여기서는 배포하지 않는다. 실제 Fedora 결과가 제공되면 연구 기록의 미검증 항목과 대조한다.
- 사용자 확인 필요: 예 — 추가 구현 또는 운영 결과 확인 요청 필요. 기존 준비/이번 수정 완료를 실제 배포 성공으로 간주하지 않는다.
- 읽을 파일: docs/research/2026-10-25-systemd-reader-credential.md, docs/adr/0106-systemd-reader-credential.md, docs/PRODUCTION_DEPLOYMENT.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 실패 경로: 최초 Lead stdin 누락으로 요청 생성 전 ValueError 후 정상 제출. 비밀/원문/접속 URI는 Git/웹에 추가하지 않는다. 새 커밋은 `Fix production reader validation for systemd credentials` 메시지로 식별한다.
