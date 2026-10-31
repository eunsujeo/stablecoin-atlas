# ADR0124: Fedora sbin 시스템 링크와 재실행 가능한 Bootstrap install

- 상태: 구현·로컬 시험. 실제 Fedora Asahi Remix44 운영 설치는 실행하지 않았다.
- 근거: 사용자 보고의 root0755 atlas-release, root 소유 /usr/local/sbin→bin, 정상 CI release/cache와 미생성 control-plane.json. 기존 trusted의 모든 symlink 거부와 receipt 이전의 제어면 교체 순서를 확인했다.

## 정확한 경로 예외

trusted()는 uid0 검증에서 정확한 `/usr/local/sbin`의 root 소유 symlink와 literal readlink 값 `bin`만 허용한다. 요청 경로의 실제 `/usr/local/bin` 쪽 leaf/전체 조상과 원래 `/usr/local` 쪽 조상을 모두 root 소유·group/other non-writable로 확인한다. 실제 경로에서는 두 번째 symlink를 허용하지 않는다. 일반 symlink leaf, 다른 target/owner, `/usr/local/bin`의 symlink, 비정규 입력경로는 계속 거부한다. symlink의 통상0777을 정상 파일의 쓰기 권한으로 오해하지 않고 보호된 양쪽 directory chain/실제 파일 권한을 검사한다. 다른 Fedora alias로 일반화하거나 시스템 링크/소유권/권한을 고치지 않는다.

## 사전 점검

plan은 기존 configured files 검사 외 installPaths와 unit plan·실제 FragmentPath/DropInPaths·Collector/Usage state directory를 읽기 전용으로 점검한다. install은 같은 경로 점검을 변경 전/검증된 아티팩트 전개 후에 수행한다. ROOT와 releases, /usr/local/lib, sbin/bin 구조는 이미 있어야 한다. 새 deployment 전용 state/log/probe/backup 디렉터리만 보호된 부모 아래 생성할 수 있다. 기존 collector state directory는 기존 owner/private 기준으로 확인하며 새로 만들거나 chown하지 않는다. 기존 unit/스크립트/config/receipt의 unsafe owner/write/symlink/private/실행 권한 오류를 미리 차단한다.

agent timer와 apply service는 명확한 not-found 또는 inactive/PID0만 허용한다. lookup/D-Bus 오류를 없는 unit으로 간주하지 않는다. 기존 관리자 공통 flock 외 install 전용 state의 private nofollow FD에도 kernel flock을 획득한다. helper가 종료해도 Node가 공유 open-file description을 보유하며 Node 종료 시 커널이 해제한다. PID 재사용/시간 추정으로 잠금을 삭제하지 않는다. [flock FD 방식](https://man7.org/linux/man-pages/man1/flock.1.html)을 사용한다.

## 설치 트랜잭션과 복구

현재 CI 후보의 SHA/ZIP/digest/manifest와 검증된 캐시는 기존대로 유지한다. 먼저 CI release를 staging하며 기존 SHA가 있으면 실제 파일 전체/권한/owner/예상 디렉터리·추가 항목·marker를 다시 검사한다. 주장된 payloadHash만 믿지 않는다. 동일 코드의 다른 run/attempt/component는 source/policy/platform/ABI가 같은 경우 재사용하고 최초 ATLAS_RELEASE.json을 덮어쓰지 않는다. 불일치한 nonempty release는 삭제/재전개하지 않는다.

STATE/bootstrap-install.json은 root private 저널이다. 변경 전 wrapper·unit/drop-in·config·receipt의 원문과 UID/GID/mode/hash를 private bootstrap-backups/UUID에 보존하고 원래/새 제어면의 내용·metadata tree hash와 정확한 next/previous 경로를 기록한다. 원문은 Git/로그로 보내지 않는다. write intent를 fsync한 뒤 임시 파일·rename으로 내용만 갱신하며 기존 UID/GID/mode는 유지한다. chmod/chown은 새 임시 파일에만 적용한다. 동일 내용의 기존 파일은 재작성하지 않는다. 기존 base unit은 unitPlan의 충돌 거부/보존 정책을 유지한다.

제어면 디렉터리 교체 전후 의도를 기록하고 기존 INSTALL은 정확한 previous-UUID로 보존한다. systemd-analyze와 경로 검사 후 변경하며 manager daemon-reload 외 서비스 시작/중지/재시작/enable은 하지 않는다. 실제 unit 경로를 재검증한 뒤 control-plane.json을 마지막 commit marker로 게시한다. config/receipt/header 기록과 parent 디렉터리를 fsync한다. install에서는 web/collector/usage 포인터를 만들거나 바꾸지 않는다. 빠진 usage-current의 최초 생성은 명시 enable에서만 inactive/기존 릴리스 검증 후 atomic exclusive symlink로 수행한다.

일반 실패는 전체 rollback 가능성을 먼저 검사한 뒤 본 트랜잭션이 바꾼 것으로 확인되는 hash/metadata만 복원한다. 최초 설치면 원래 INSTALL/receipt의 부재로 되돌린다. 프로세스 강제 종료 후 다음 install도 같은 복구를 먼저 수행한다. 마지막 receipt와 전체 새 파일/tree가 일치하면 이미 commit된 결과로 닫고, 이전 상태/새 상태 어느 쪽도 아닌 운영자 편집·손상 백업·알 수 없는 tree는 RECOVERY_BLOCKED로 보존한다. 예상 밖 파일을 덮어쓰거나 임의 previous 디렉터리를 추측해 채택하지 않는다. 저널이 pending이면 verifyInstallation/apply/enable을 차단한다.

기존 버전의 부분 실패처럼 저널/receipt가 없는 INSTALL은 자동으로 신뢰 완료로 승격하지 않는다. root 보호된 현재 tree를 원래 상태로 보존하고 fresh CI 재검증 후 새 트랜잭션으로 설치할 수 있다. 유효한 기존 receipt가 있으면 먼저 기존 설치 무결성을 확인한다. CI release/cache, 이전 제어면, backup, 실패 next 디렉터리는 보존하며 오래된 orphan을 자동 삭제하지 않는다. rollback으로 비워진 새 디렉터리와 crash 시 생긴 비실행 private 임시 파일도 일괄 정리하지 않는다. 디스크 quota/실제 전원 장애 재현은 별도다.

운영 Mac mini·서비스·Collector/FX·Supabase·Cloudflare·proxy/TLS는 현재 작업에서 접근/변경하지 않는다. 실제 재실행은 검토된 새 도구와 기존 inspect→plan→install→verify 절차로 별도 수행하며 자동 활성화하지 않는다. 검증 범위는 [연구 기록](../research/2026-10-31-fedora-bootstrap-install-recovery.md)을 따른다.
