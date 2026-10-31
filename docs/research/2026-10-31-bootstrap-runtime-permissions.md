# Bootstrap 런타임 모듈 접근 권한

## 범위와 접속

사용자가 기존 Tailscale SSH 접근·코드 수정/시험/push/CI 성공 확인·Bootstrap 업데이트/verify 반복을 승인했다. 자동 배포 enable 직전에는 명시 승인을 받고, 운영 웹·Collector·FX 무단 재시작과 DB schema/비밀 설정 변경은 제외한다. 하위 에이전트는 사용하지 않는다.

Herdr의 별도 SSH pane에서 기존 SSH multiplex 연결을 사용한다. 새 SSH 채널은 최초 공개키 인증 불가였고, 사용자가 만든 공유 연결 후 접속했다. sudo는 채널별 인증 문제로 사용자 직접 인증·관리자 셸 준비 후 동일 pane에서 실행한다. 암호/개인키 주입·저장·NOPASSWD 정책 변경0. 사용자 요청대로 왼쪽 Codex·오른쪽 SSH로 배치했다. 로컬 Router는 runtime 미설정 shadow fallback이며 Agent 생성/모델 변경0이다.

## 원인과 수정

Fedora Asahi Remix44 Linux aarch64 실측: 설치 SHA2135e41185efb64c55e56ee4304e1ccec528557f, 제어면 root0755/tools0710/tools/deploy0710/node_modules0700/pg0700, atlasweb의 node_modules traverse 실패. Bootstrap verify는 control-plane·파일 해시/권한·서비스/pointer·rollback-baseline READY, database:web만 DATABASE_PROBE_FAILED다. 웹 PID45865/Collector PID33973과 FX timer active, agent timer inactive를 변경 전 확인했다.

root wrapper의 umask077은 유지한다. extractRelease의 recursive mkdir0755가 umask로0700이 되는데 기존 코드는 root만0755로 맞췄다. 새 staging tree 안에서 root부터 각 디렉터리를 소유 UID·non-symlink·group/other non-writable 검증 후 정확0755로 만든다. 파일은 기존 wx/정규 mode/hash/크기·tar/ZIP 검증과 fsync를 유지한다. 실제 설치본이나 기존 릴리스/백업에 chmod하지 않는다. symlink/foreign owner/writable 경로는 허용하지 않는다. 기존 journal/receipt-last/backup 복구·불변 CI release/cache 검증을 유지한다.

추가 운영 관측: /run/atlas-deploy-probes도 root0700이며 atlasweb traverse 실패를 확인했다. ensureProbeDirectory는 이 고정 부모만 root/no-follow FD로 검증하고 기존의 정확0700/0711 외 권한을 거부한다. 0700을0711로 FD chmod하고 자식probe0700·reader0600은 유지한다. 임의 경로 migration이나 기존 secret 권한 변경은 없다.

## 검증

신규 tests/deploy-extraction-permissions.test.mjs는 별도 Node 프로세스 umask077의 실제 중첩tools/pg 전개 mode와 import 반환값을 확인한다. root/중간 symlink와 writable 경로를 거부하며 외부 target 권한/내용을 보존한다. 초기 targeted82pass/0fail/0skip, probe 부모 수정 포함 최종 targeted84pass/0fail/0skip. 최종 npm run check 종료0: 본시험789개중781pass/0fail/8skip+보관74pass/0fail=855pass/0fail/8skip. 기존 compiler 캐시 미보유 관련8skip은 유지하고 새 다운로드하지 않았다. GitHub CI·운영 Bootstrap/verify 결과는 아래에 완료 후 추가한다.

로컬 재현: source .state/dev-env.sh 후 node --use-env-proxy --test --test-concurrency=2 tests/deploy-extraction-permissions.test.mjs tests/deploy-automation.test.mjs tests/deploy-bootstrap-recovery.test.mjs tests/deploy-runtime.test.mjs, npm run check. 비공개 로그는 .state/agent-logs/runtime-permission-targeted.log 및 runtime-permission-check-final.log. 기존 unrelated 새PC 문서2개는 보존하고 커밋에서 제외한다.

## 운영 후속

자동 배포 enable과 실제 push 종단 검증은 승인 전 미실행이다. DB schema/비밀값·Collector/FX·proxy/TLS 변경이나 기존 릴리스/backup 삭제를 하지 않는다. 새 CI 성공 SHA를 명시 bootstrap 계획에 pin하고 기존 비밀 파일/설정은 유지한다. 이후 verify 결과와 운영 변경 경계를 별도로 기록한다.
