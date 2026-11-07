# 제한된 비밀번호 없는 운영 관리

사용자가 Yahoo 설치 명령 실행 후 운영 적용의 sudo 입력까지 자동화를 요청했다. 최초 출력은 DISABLED/LOCAL_PLAN_CREATED 뒤 BOOTSTRAP_APPLY_ACTIVE였다. SSH 읽기로 apply=failed/MainPID0, agent=inactive/MainPID0, deploy timer=disabled를 확인했다. 웹/Collector는 실행 중이며 기존 웹c4a2d8a가200이다. 설치 완료/배포 성공으로 보고하지 않았다.

ADR0132의 exact-command sudoers, root wrapper/dispatcher, 제한된 idle wait, 원래Yahoo승인SHA6451918 고정job을 작성했다. 대기 helper는 실패·PID0일 때만 reset-failed하고 프로세스를 stop/kill하지 않는다. 임의 경로·SHA·셸·unit 인자를 받지 않는다. 일회성job 완료marker 후 재실행은 no-op다.

- unit4개 PASS: 명령경계/실행중대기/failedPID0/timeout/오류상태/인자주입거절/정확sudoers.
- 로컬 및 실제 Fedora `visudo -cf` PASS(전역정책변경0).
- 두shell bash -n, installer Python compile, Node syntax 검사.
- 전체 `npm run check`: .state/maintenance-check.log, 최종결과 handoff 참조.
- 설치예정 root경로 실제소유권/755, sudoers.d750 확인. /usr/local/sbin시스템symlink를 grant 경로로 사용하지 않고 실제 /usr/local/bin을 사용한다.
- 최초등록만root작업이다. /home/mob/atlas-maintenance-prepared-20261107/install.py와정확5개payload는비공개준비폴더. root staging복사 후내장SHA256/문법검사, root-ownedexact파일게시, sudoers마지막게시. 사용자홈스크립트에NOPASSWD를주지않으며기존sudoers를덮어쓰지않는다.
- 최초등록명령: `python3 /home/mob/atlas-maintenance-prepared-20261107/install.py` (기존root터미널). 이후 Codex는 `ssh atlas-mini sudo -n /usr/local/bin/atlas-maintenance finish-yahoo-fx`로진행가능하다. 아직등록/특권명령실행은하지않았다.
- 사용자화면꺼짐질문: 화면잠금/디스플레이꺼짐은SSH유지, 시스템잠자기는끊길수있고복귀시기존launchd재접속. Macmini웹/수집은SSH와독립. 실제sleep/wake시험은추가하지않았다.
- Lead1회submit은identity/repositorymismatch ID전실패, 재시도/하위에이전트0. 기존미완료FX작업유지. 새정책범위밖임의관리자권한은열지않는다.
