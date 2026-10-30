# 2026-10-30 자동 CI/CD 구현 기록

## 요청과 실행 경계

main Push만으로 검사·ARM64 불변 릴리스·웹 배포·health 검증·실패 롤백을 완료하는 구조를 구현했다. 최초 운영 bootstrap/보안 검증까지 실제 서비스 변경을 금지한 요청을 따랐다. 운영 SSH·systemd 실행·실제 Supabase·공급자 API·키 발급·Cloudflare 변경은 하지 않았다. GitHub 코드 Push/CI는 요청 범위이며 개발 PC의 키/원문을 운영 의존성으로 만들지 않는다.

## 분석과 구현 경로

기존 production workflow, atlas-release, stageRelease/activateRelease, production reader/공개 경계, scheduler/등록 수집/FX/Usage 원장과 lock을 검토했다. [ADR0120](../adr/0120-pull-based-production-automation.md)에 기존 도구 재사용과 hosted ARM64 빌드·고정 제어면 pull 구조를 먼저 기록했다. 실행 절차의 정본은 [AUTOMATED_DEPLOYMENT.md](../AUTOMATED_DEPLOYMENT.md)다.

Hosted CI는 검사와 production 의존성 준비를 맡고 서버에서는 npm/git 빌드를 하지 않는다. 서버 atlaspull 계정에는 polkit의 고정 broker start만 허용한다. root broker는 최초 검토한 고정 설치본만 실행하며 릴리스 코드를 root로 실행하지 않는다. repo/workflow/blob/main/run attempt/artifact digest/manifest/payload를 독립 결합한다. 웹·Collector·Usage pointer와 정책은 독립이며 일반 웹 Push는 writer/timer/호출 예산을 바꾸지 않는다.

운영 preflight는 고정 파일 hash/owner/부모 경로, 설치 제어면/unit/dropin, DB 역할/선정·예약·예산·lock, 실제 실행 경로, rollback baseline과 필수 API를 일괄 검증한다. 프로비저닝은 운영 보안 저장소의 sealed 자료만 전체 검증한 뒤 누락 파일을 복원한다. 비밀값과 private 원문은 Git/CI에 저장하지 않았다. 기존 승인 Usage 기간/원문/claim을 재생성하거나 새 공급자 호출로 보충하지 않는다.

## 발견한 실패와 수정

- systemctl timer에는 service User/cwd/PID가 없으므로 실제 timer 출력과 달력 정책을 별도로 검증했다.
- root-only probe 부모 디렉터리의 탐색 불가와 macOS Fixture의 uid/gid 차이는 부모0711/자식0700 및 fchown(uid,-1)로 수정했다.
- writer crash 복구는 DB gate를 먼저 잡고 실제 pointer를 보존한다. gate 실패와 재실패는 nonterminal RECOVERY_BLOCKED이며 원문/claim을 지우지 않는다.
- 성공 배포 후 versions/report 저장 실패로 성공 코드를 롤백하지 않도록 COMMITTED를 먼저 fsync했다. 실제 child exit와 저장 실패를 주입해 재시작 없는 cache/report 복구를 확인했다.
- 수동 경로가 기존 복구 저널을 덮어쓰거나 collector 후보를 web로 취급하는 문제를 차단했다. 기존 COMMITTED 결과를 보고까지 복구한 뒤 다음 수동 저널을 만든다.
- 자동/수동 rollback은 이전 포인터와 이전 웹 health 모두 확인해야 종료한다. 최초 배포에서 pointer가 이미 제거돼도 stop 성공/PID0을 확인해야 완료한다. unlink 뒤 실제 child exit, stop 실패, 다음 poll 재실패/성공을 시험했다.
- artifact hidden 경로 누락, CI prune의 lockfile 변경 가능성은 정확한 두 파일 업로드/include-hidden-files와 prune --no-save로 예방했다.

## 검증

최종 검증 결과는 아래에 갱신한다. 로그는 Git 미추적 .state/agent-logs/deploy-*에만 보관한다. 사설 PG17은 프로그램 소유 Docker Fixture만 사용했고 종료 시 정리했다. 가상 GitHub/systemd, 실제 temp FS/child process/loopback HTTP와 운영 검증을 구분한다.

- 배포 회귀: node --test tests/deploy-automation.test.mjs — rc0,44pass/0fail.
- 보안 검토: 마지막 Lead 응답 proceed. 실제 운영 승인이 아니라 최종 전체 검사 후 commit/push 조건이다.
- 사설 PG17: node --test --test-concurrency=1 tests/postgres/deployment-gate.test.mjs tests/postgres/production.test.mjs tests/postgres/network-usage-v2.test.mjs — rc0,4pass/0fail.
- Router: python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py' — rc0,56pass/0fail.
- bash -n deploy/atlas-bootstrap deploy/atlas-deploy-admin deploy/atlas-release — rc0.
- Ruby YAML safe_load 두 workflow 및 git diff --check — rc0.
- 최종 npm run check: rc0, 기본725+보존74=799pass/0fail.
- 최초 ARM64 CI run40981513924는 환경 진단 성공 후 npm run check에서 rc1로 종료했다. 로그를 파일로만 보내고 summary에만 요약한 탓에 원격 진단 로그에 실패 본문이 남지 않았다. 실패 문맥과 tail을 유한 길이로 Actions 로그에도 출력하도록 보완하고 후속 CI로 원인을 확인한다. 릴리스 업로드/운영 배포는 실행되지 않았다. 운영 ACK 비활성 상태는 NOT_ENABLED로 구분한다.

## 미확인과 재현

현재 개발 CLI의 GitHub variable 목록 조회는 HTTP403(Variables read 권한 부족)으로 끝났으며 재시도/권한 변경을 하지 않았다. 이는 운영용 App 검증과 별개다.

실제 Fedora systemd/SELinux/polkit, GitHub App 권한·운영 보안 저장소·private 자료 복구, 운영 웹 배포/롤백의 종단 성공은 최초 bootstrap에서 검증해야 한다. 로컬 준비를 실제 활성화 완료라고 표시하지 않는다. 운영자는 정본의 inspect→plan→install→verify→enable을 최초 한 번 수행한다. verify 전 enable/서비스 전환을 수행하지 않는다. 그 뒤 평상시에는 main Push와 Actions 결과 확인만 필요하다.

후속 CI run40982016222에서 Node24.22.1의 보존 Allium 네트워크 권한 시험이 ERR_ACCESS_DENIED 대신 ECONNREFUSED를 반환한 것을 확인했다. 개발 Node25.2.1과의 차이다. 또한 ARM64 runner에 rg가 없으므로 진단을 기본 grep으로 수정했다. 전체 시험 runtime을 검증된25.2.1로 고정하고 운영24의 웹/배포 회귀를 별도 실행하며 production npm ci를24에서 새로 수행하도록 분리했다. 은퇴 로직·원문·운영 Node·Collector는 변경하지 않았다.
