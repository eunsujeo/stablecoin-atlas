# Bootstrap schedule 상위 디렉터리 소유권 예외

사용자 보고: /etc/atlas-collector는 atlascollector:atlascollector0700, schedule.env는 root:root0644이고 설정 SHA256과 일치하지만 plan에서 schedule만 MISSING_OR_UNSAFE다. verifyConfiguredFile에서 파일 owner root를 uid0으로 해석한 뒤 모든 부모를 [0,uid]로 검사하므로 이 경우 [0,0]이며 collector UID는 거부된다. bootstrap plan은 해당 예외를 MISSING_OR_UNSAFE로 매핑한다. 이 정적 경로와 기존 조건의 실패를 로컬 metadata fixture로 확인했으며 운영 서버에 접속해 직접 확인한 것으로 표현하지 않는다.

사용자가 지정한 정확한 schedule ID·고정 목적 경로·root소유0644 파일·직상위 고정 디렉터리·양수 atlascollector UID·정확0700 조합에만 예외를 추가했다. 더 높은 /etc와 /, 다른 설정 파일11종, 같은 디렉터리의 다른 파일, 다른 owner/mode에는 예외를 적용하지 않는다. 기존 root 부모와 collector 파일/부모의 기존 허용 조합은 유지한다. symlink/비디렉터리·group/other 쓰기·특수권한·잘못된 파일UID/mode/크기·해시 불일치를 계속 거부한다. UID는 기존 계정 resolver를 사용하며 새 계정/예외설정을 입력받지 않는다.

collector가 디렉터리를 소유하면 검사 사이 엔트리 교체가 가능하므로 예외 경로만 O_RDONLY|O_NOFOLLOW|O_NONBLOCK으로 열고 실제 핸들의 dev/inode/uid/mode/size를 초기 lstat과 대조한다. 읽기는 최초 size+1, 최대2MiB+1 buffer로 제한하고 실제 읽은 길이/핸들 사후 metadata/경로 엔트리/부모 dev-inode-uid-mode와 SHA256을 확인한다. 핸들은 성공/실패 모두 닫는다. 다른 경로의 원래 정책과 일반 읽기는 바꾸지 않았다. stat/read/open 의존성 주입은 로컬 시험용이며 CLI 구성으로 노출하지 않는다.

tests/deploy-config.test.mjs의 고정 UID metadata fixture로 정상·거부·교체/권한변화·해시·크기·계정미확보 경로를 검증한다. 실제 별도 임시 파일의 읽기/소유권·mode·바이트 보존과 실제 symlink nofollow ELOOP도 확인한다. metadata fixture는 운영 root/collector 소유권을 실제 생성한 증거가 아니다. 초기 fixture가 lstat 객체를 복사하지 않고 반환해 사후 parent 변경 시 원래 snapshot도 함께 바뀌는 시험 오류1건을 발견했다. 실제 lstat 동작처럼 snapshot을 반환하도록 수정했고 targeted61pass/0fail을 확인한 뒤 핸들 사후 변경/읽기 오류 검증을 보완했다. 제품 경계를 완화해 시험을 통과시키지 않았다.

운영 Mac mini·/etc·소유권/권한·DB·timer·서비스·API/RPC는 변경/접근0, 하위 에이전트0이다. 별도 vault 복원 정책은 변경하지 않았다. 최종 targeted rc0/61pass/0fail/cancelled0/skipped0. 전체 npm run check rc0: 주748개740pass/0fail/8skip + 보존74개74pass/0fail/0skip, 합계814pass/0fail/8skip/cancelled0. skip8은 기존 미제공 compiler cache 조건이며 새 skip은 없다. git diff --check rc0. 비공개 로그는 .state/agent-logs/deploy-schedule-targeted.log 및 deploy-schedule-check.log. 재현: source .state/dev-env.sh 후 node --use-env-proxy --test tests/deploy-config.test.mjs tests/deploy-automation.test.mjs, npm run check. 실제 운영 plan/Bootstrap 재실행은 NOT_TESTED이며 commit/push 완료와 구분한다.
