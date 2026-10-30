# ADR0120: CI 불변 릴리스와 최소 권한 pull 배포

- 상태: 구현·로컬 검증 완료. 실제 bootstrap/운영 활성화 미실행.
- 요청: 2026-10-30 main Push에서 검사·빌드·웹 배포·검증·롤백 자동화. 운영 서버에 Actions runner를 두지 않는다.

## 기존 구조와 결정

기존 stageRelease/activateRelease의 SHA 디렉터리·원자 symlink·실패 롤백을 재사용한다. 기존 root stage의 운영 npm 재빌드는 자동 경로에 쓰지 않는다. GitHub-hosted ARM64 CI에서 전체 검사 후 production 의존성까지 포함한 regular-file 전용 bundle을 만들고 SHA/lock/hash/실행 component를 manifest에 결합한다. 운영은 빌드하지 않는다. symlink/hardlink/special/traversal/중복 entry를 거절하는 유한 archive parser를 쓴다.

운영 atlaspull timer는 root 소유 고정 broker unit 한 개의 시작만 요청한다. polkit은 고정 broker unit의 start 동작만 허용하고 shell/sudo/npm/git의 포괄 권한을 주지 않는다. broker의 entry와 전이 import/의존성은 최초 bootstrap에서 root 소유 불변 경로에 설치한다. 일반 릴리스/agent 쓰기 경로의 JavaScript를 root로 실행하지 않는다. root broker는 agent 입력을 받지 않고 운영 보안 저장소의 고정 repo/workflow ID 설정으로 GitHub를 직접 재검증한다. 최신 main SHA·run event/conclusion/attempt·artifact run/digest·manifest SHA/platform을 결합하고 구버전 run/재실행/지연을 영속 원장으로 통제한다.

## 배포 경계

- web: push/main의 성공 CI만 자동 적용. current만 전환, collector/usage/FX/timer 변경0.
- collector: 명시 workflow_dispatch와 별도 운영 정책 pin/승인 gate. collector-current만 전환. 기존 Arkham/등록/FX 서비스와 timer 정상 정지→실제 종료/모든 호스트 DB lock/예약/예산 재확인→전환→기존 활성 상태만 복원. 모르는 상태·미종료 예약은 차단. 소비·claim·원문을 되돌리지 않는다.
- usage: 별도 usage-current. 기존 승인 기간/18대상/policy/auth hash를 pin한다. timer 재진입을 막고 서비스 종료/당일claim·원문상태를 검사한다. 새 활성화는 bootstrap의 별도 명시 선택이며 일반 Push로 시작하지 않는다.
- 공통: 서버 전체 잠금, 단계별 영속 journal, crash 시 보수적 이전 pointer 복구 후 상태 재검증. 성공 SHA/현재 SHA/마지막 성공 SHA·service state·고정 실패 코드를 남긴다. DB DDL/grant·수집 실행·새 budget/key/provider는 배포 중 호출하지 않는다.

## 최초 bootstrap과 보안 자료

bootstrap은 root 고정 도구·계정·제한 polkit·unit/timer를 설치/verify하되 시작하지 않는다. 운영 vault의 sealed credential bundle을 해시 검증해 고정 목적지로 복원하는 provisioning을 별도로 제공한다. manifest는 root 전용이며 개인키/DB URL/검토 원문은 Git/CI artifact에 없다. 운영이 보유한 host credential key와 암호화 backup의 복구 의존성을 명시한다.

명시 enable 전 일괄 preflight는 파일/부모 권한·hash·runtime/ARM64·unit·기존pointer·TLS/DB reader/writer·등록선정·예약/lock·schedule/usage승인·FX projection·private review file을 점검한다. 하나라도 실패하면 활성화하지 않는다. bootstrap receipt는 config·고정 도구·unit·vault hash를 pin하고 일반 배포에서 변조를 거절한다.

## 검증과 관측

웹 health는 정확 SHA, 필수 public asset, market/registration/asset-review/usage/FX 검증을 포함한다. 실패 시 이전 릴리스에서 같은 검증으로 복원 성공 여부까지 확인한다. 외부 공급자0·schema 변경0. GitHub commit status와 별도 Actions 결과 workflow가 현재/마지막 성공 SHA·상태·실패/롤백 코드를 표시하며 서버에는 제한된 JSON journal과 로그를 보관한다.

가상 GitHub/실제 temp FS/HTTP/systemd adapter로 성공·실패·동시성·tamper·단계별 crash·rollback failure·중복송신0을 검증하고 npm run check를 실행한다. 실제 Fedora/systemd/GitHub App 권한/새 workflow·운영 종단 검증은 최초 bootstrap 단계이며 이번 작업에서 SSH/설치/서비스 변경을 실행하지 않는다.
