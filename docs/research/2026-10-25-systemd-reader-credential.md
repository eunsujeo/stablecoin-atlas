# Fedora systemd Reader Credential 호환성 수정

## 요청과 수행 경로

사용자가 운영 커밋99c372fab8e3e8ad09388085964e3a1044fb7fea의 `READER_FILE_PRIVATE_REQUIRED` 실패를 보고했다. 제공 관측은 서비스 UID981, 원본 root0600, 전달 Credential root0440, 서비스 사용자 읽기 성공 및 Supabase Reader 검사 통과다. 이번 작업에서 해당 서버/DB에 접속하거나 이를 재관측하지 않았다.

`productionSettings()`의 일반 파일 소유 UID 일치 검사가 원인이었다. systemd unit의 `LoadCredential`/실행 인자와 [공식 systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#Credentials)를 대조했다. [ADR0106](../adr/0106-systemd-reader-credential.md)에 따라 별도 production Reader 파일 모듈을 연결했다. 정책 정본과 원본/전달 파일 구분은 [운영 안내](../PRODUCTION_DEPLOYMENT.md#환경-파일과-reader-분리)를 따른다.

환경변수가 설정되면 정확한 system Credential 경로만 검사하고 일반 파일로 전환하지 않는다. 중간 symlink와 열려 있는 상위 디렉터리도 거절한다. 같은 descriptor에서 정책·동일성·64KiB 제한·읽기 후 안정성을 확인하고 모든 파일 오류는 내용 없는 고정 오류로 정규화한다. Preview와 DB 연결 코드는 수정하지 않았다.

## 실패와 검토

최초 Lead 제출에서 stdin 요약 누락으로 `ValueError`가 발생했다. 요청/전달 전 실패이며 요약을 포함한 정상 요청 e2f6cdf86c4540a193b1a84bbe0adee2를 새로 제출했다. 응답 action=proceed: 정확한 시스템 경로·상위 디렉터리 신뢰·별도 권한 정책·descriptor 동일성과 한도·실패/회귀 검증 조건을 반영했다. 검토를 실제 운영 실행 승인으로 해석하지 않았다.

최종 구현 검토901bab8251f64a0c9029b85302170e5f도 action=proceed였다. 차단할 보안 회귀 미발견·독립 Credential 시험5개 통과 및 전체/사설PG 결과 기록·실제 Fedora NOT_TESTED 유지 조건을 확인했다. 미회수 요청은 없다.

## 확보 자료와 검증

`tests/production-credential.test.mjs`는 Linux UID981/root 메타데이터와 I/O 실패를 주입한 모델 시험, 실제 로컬 파일 chmod/symlink와 productionSettings 시험을 구분한다. 모델 시험의 성공은 Fedora mount/ACL에서 직접 open한 증거가 아니다. root0400/0440·서비스0400/0600 성공, 소유자/권한/비정규 파일/경로 위조/중간 symlink/descriptor 교체/크기/읽기 실패의 거부와 descriptor 정리를 확인한다. 실제 파일 시험은 일반 파일 정책·Credential 경로 fallback 거부·환경 혼합·TLS 비활성 거부를 확인한다. 오류에 canary 접속 문자열이 포함되지 않는지도 검사한다.

| 검증 명령 | 결과 | 범위 |
| --- | --- | --- |
| `npm run check:production` | rc0, tests14/pass14/fail0/cancelled0/skipped0 | 기존 운영 HTTP·연결/TLS·release·새 Credential 5개 시험 |
| `npm run check` | rc0, tests598/pass598/fail0/cancelled0/skipped0 | build·기존 전체 시험·새 회귀 |
| `node --use-env-proxy --test --test-concurrency=1 tests/postgres/production.test.mjs tests/postgres/preview.test.mjs` | rc0, tests2/pass2/fail0/cancelled0/skipped0 | 새 소유 PG17의 Reader/Writer·상속/PUBLIC/함수/소유권 거부·세션RO·Preview |

로그는 Git 제외 `.state/agent-logs/credential-production.log`·`credential-check.log`·`credential-postgres.log`에 보존한다. 사설 PG 시험은 기존 로컬 이미지의 `--pull never`로 실행하고 생성 자원만 정리했다. 원문/키/접속 정보는 Git/웹에 추가하지 않았다.

## 재현과 실제 Fedora 후속 확인

로컬에서 `npm run check:production`, `npm run check`를 실행한다. DB 권한 회귀는 `node --use-env-proxy --test --test-concurrency=1 tests/postgres/production.test.mjs tests/postgres/preview.test.mjs`로 새 소유 사설 PG Fixture에서만 실행한다. 새 외부 API/RPC·키·운영 DB·운영 릴리스 변경은 없다.

운영자는 새 커밋의 정확 SHA로 정본 배포 절차를 수행해야 한다. 이 작업에서는 배포하지 않는다. 실제 Fedora에서 전달 경로의 symlink 부재·각 디렉터리 소유/모드·필요 시 ACL과 SELinux·서비스 UID의 실제 읽기, 정상 설정 로드와 Reader/TLS 검사·health SHA·서비스 재시작을 확인해야 한다. Credential 내용이나 DATABASE_URL/비밀번호를 cat/journal/명령행으로 공개하지 않는다. root 원본0600과 systemd 전달0440을 변경할 필요가 없다. 실제 Fedora 검증은 NOT_TESTED다.
