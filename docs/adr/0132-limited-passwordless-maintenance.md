# ADR0132 — 제한된 비밀번호 없는 배포 관리

2026-11-07 사용자가 운영 적용의 sudo 반복 입력도 자동화하도록 요청했다. 비밀번호 보관이나 전체 sudo 권한을 주지 않는다.

## 허용 경계

mob에게 root 소유 `/usr/local/bin/atlas-maintenance`의 정확한5명령만 NOPASSWD/NOSETENV로 허용한다: status, verify, enable, deploy, finish-yahoo-fx. 추가 인자/SHA/경로/셸/환경/다른unit/일반node·systemctl·bash 실행 권한은 없다. 기존 main Push 기반 웹 배포는 원래의 LOCAL_GIT 테스트/빌드/불변bundle/health/롤백을 계속 사용한다.

finish-yahoo-fx는6451918157ee53a7181fa439de875d09dc594afd로 고정된 기존 승인 작업만 수행하는 일회성 root 소유 스크립트다. mob 홈의 스크립트를 root로 실행하는 권한은 부여하지 않는다. 초기자료는 원문hash를 대조하고 복사한 신규tree에만 chown -hR을 적용한다. 완료marker 후 재호출은 no-op. 향후 임의 Bootstrap 코드/보안정책 자동수정 권한으로 일반화하지 않는다.

## 이번 중단 원인과 복구

기존 activate가 timer disable 후 apply 서비스의 failed 상태/MainPID0 때문에 BOOTSTRAP_APPLY_ACTIVE로 중단했다. 웹/Collector는 정상 실행 중이다. idle helper는 agent/apply가 끝나길 최대240초 기다리고, MainPID0인 failed 상태만 systemctl reset-failed한다. 프로세스 stop/kill·lock삭제·검사우회0. 실패상태 정리 뒤 기존 bootstrap의 inactive/PID0 검사를 그대로 통과해야 한다.

## 최초 설치

관리자가 한 번 등록해야 한다. root 소유/non-writable 실제 경로만 사용하고 사용자 쓰기 가능 파일은 root staging에 복사한 뒤 고정SHA-256을 검사한다. sudoers는 visudo 구문 검사 후 원자적으로 게시한다. 기존 sudoers파일·다른권한을 덮어쓰지 않는다. 테스트된 wrapper/dispatcher/idle helper/고정job만 설치한다. sudo 비밀번호는 채팅/파일/환경변수에 저장하지 않는다.

반복 입력이 사라지는 범위는 위5명령 및 기존 자동 웹배포다. DB스키마·데이터삭제·임의서비스·새보안설정까지 무제한 위임하지 않는다.
