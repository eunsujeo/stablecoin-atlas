# Fedora Bootstrap PATH_UNTRUSTED 및 부분 설치 복구 (2026-10-31)

## 확인 경로

사용자는 Fedora Asahi Remix44에서 atlas-release root0755, /usr/local/sbin→bin root symlink, CI ZIP/cache 검증 성공·새 SHA release ATLAS_RELEASE.json 존재·control-plane.json 미생성을 보고했다. 운영 접속 없이 files.trusted()의 전 조상 symlink 거부와 bootstrap.install의 INSTALL 교체→후반 helper 검증→마지막 receipt 순서를 코드에서 확인했다. 해당 조건의 metadata fixture는 기존 거부 원인과 수정 후 성공/거부 경계를 재현한다. 실제 Fedora를 직접 관측한 것으로 표현하지 않는다.

정확한 root sbin→bin만 재귀 없이 허용하고 실제 bin/leaf/조상과 logical parent를 모두 검사했다. 임의 링크/target/owner·writable directory/leaf·추가 alias는 계속 차단한다. 시스템의 symlink/mode/owner를 바꾸지 않는다. plan/install의 경로 사전 검사는 scripts, config/receipt, ROOT/releases, deployment state/log/probes, unit/drop-in과 effective FragmentPath/DropInPaths를 포함한다. 계정/DBus lookup 오류는 누락으로 삼키지 않는다. Collector state는 기존 소유/private 조건의 존재를 요구하고 자동 생성/chown을 제거했다.

## 설치·재실행

ADR0124의 private journal과 보호된 backup을 도입했다. 기존 file UID/GID/mode를 유지하는 atomic replacement, 정확한 원래/새 tree hash, next/previous nonce, 마지막 receipt commit marker로 작업한다. 실패 전 전개한 CI release/cache와 기존 INSTALL/설정/receipt/원문은 삭제하지 않는다. 실제 file 내용/mode/owner/추가 항목도 재검증해 이미 존재하는 CI release를 안전하게 재사용한다. 최초 run marker를 새로운 attempt/component로 덮어쓰지 않는다.

일반 실패는 본 작업의 변경만 rollback하고 hard crash는 다음 install이 같은 저널로 복구한다. commit receipt 뒤의 보고 유실은 전체 상태를 대조해 COMMITTED로 닫는다. 외부 편집/권한 drift/손상 backup/알 수 없는 tree는 덮어쓰지 않고 RECOVERY_BLOCKED로 보존한다. 기존 receipt가 존재할 때 그 검증 실패를 ENOENT로 삼켜 미완료 설치처럼 채택하지 않도록 구분했다. 저널 없는 기존 부분 실패는 원래 tree/부재 상태를 보존한 새 명시 install로 보완한다. pending 저널은 verify/apply/enable을 차단한다.

install 자체는 서비스 포인터와 lifecycle을 변경하지 않는다. 기존 사용 승인된 usage-current 최초 생성은 명시 enable으로 옮겼으며 이미 있는 포인터를 덮어쓰지 않는다. manager daemon-reload 외 start/stop/restart/enable은 install/rollback 코드에 없다. install 전용 kernel flock은 Node가 open FD를 유지해 helper 조기 종료와 owner 강제 종료를 구분한다. 시간/PID 기반 stale lock 삭제는 없다. 관리자 wrapper의 기존 공통 lock도 유지했다.

## 로컬 검증과 한계

새 metadata 및 실제 소유 임시 filesystem fixture로 Fedora alias 정상·다른 target/UID/그룹/other 쓰기·symlink chain·private/size·정규 경로·다른 설치 목적지/실제 unit 경로 사전 실패를 검증한다. 설치의 PREPARED/FILES_WRITTEN/SWAPPING/OLD_MOVED/PUBLISHED 실패 복구, 실제 child process exit42, receipt 전 rollback/후 commit 판별, receipt 없는 기존 부분 설치, 최초 INSTALL 부재 복구, 동일 tree의 원래 inode 복원,300KB 기존 receipt backup, unknown edit/mode/backup/tree 및 malformed journal 차단, 기존 metadata·서비스 포인터·CI marker 보존을 확인했다.

실제 kernel FD 잠금 테스트는 macOS에서 Python fcntl adapter로 util-linux 호출 계약과 Node FD 소유를 재현한다. Linux CI에서는 실제 /usr/bin/bash·/usr/bin/flock을 사용한다. Node owner를 SIGKILL한 뒤 재획득하고 helper 종료만으로는 lock이 풀리지 않음을 확인한다. 실제 Fedora root 소유권/서비스 및 전원 장애는 NOT_TESTED다.

초기 targeted93pass 후 동일 tree·큰 backup·불명확 journal과 root FD 보유 검증을 추가해97pass/0fail을 확인했다. 검토 중 발견한 큰 receipt backup의 기본256KiB 제한 혼용은 기존16MiB file 상한으로 맞췄고, 초기 helper lifetime lock은 Node FD 보유 방식으로 강화했다. fixture glob 탐색의 zsh no-match는 rg의 명시 경로 검색으로 수정했다. 제품 검증을 느슨하게 만들어 시험을 우회하지 않았다. 최종 targeted는98pass/0fail/0skip이다. npm run check는종료코드0으로통과했다. 본시험785개중777pass/0fail/8skip, 보관시험74pass/0fail로총851pass/0fail/8skip이다. 기존compiler캐시0.4.18/0.8.29/0.8.34미보유관련8skip을유지했고외부다운로드하지않았다. git diff --check도통과했다.

재현: source .state/dev-env.sh 후 node --use-env-proxy --test --test-concurrency=2 tests/deploy-bootstrap-paths.test.mjs tests/deploy-bootstrap-recovery.test.mjs tests/deploy-automation.test.mjs tests/deploy-config.test.mjs tests/deploy-runtime.test.mjs tests/deploy-artifact-cache.test.mjs, npm run check. 비공개 로그는 .state/agent-logs/bootstrap-install-targeted.log 및 bootstrap-install-check.log다. 실제 서비스 명령은 injected fixture이고 /etc·운영 계정·파일 권한/owner·서비스·DB·Collector/FX/Supabase/Cloudflare·proxy/TLS 변경0, 외부 공급자/GitHub API0, 하위 에이전트0이다. 공개 flock 문서만 읽었으며 새 tool/compiler 다운로드0이다.

## 운영 인계

현재 운영의 release/ATLAS_RELEASE.json·cache·기존/previous control plane을 삭제하지 않는다. control-plane.json을 손으로 만들어 완료를 가장하거나 timer를 켜지 않는다. 검토된 새 checkout의 plan은 기존 checks와 installPaths를 모두 확인한다. 명시 install 재실행이 pending journal을 복구한 뒤 현재 GitHub 후보/기존 설정·파일을 다시 검증한다. main SHA가 바뀌면 기존 BOOTSTRAP_SHA 고정을 우회하지 않고 새 inspect 계획 검토가 필요하다. RECOVERY_BLOCKED이면 private 저널/backup과 외부 편집을 검토하기 전 자동 삭제/강제 덮어쓰기를 하지 않는다. 이 작업에서는 실제 설치·복구·자동 활성화·운영 접근은 하지 않았고 commit/push만 수행한다.

설계: docs/adr/0124-fedora-bootstrap-install-recovery.md. 커널 명령 근거: https://man7.org/linux/man-pages/man1/flock.1.html.
