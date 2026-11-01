# Pop Outline 및 Atlas 워드마크 배포

- 목표: 사용자 선택 Pop Outline, 다크 KPI 색상, 첫 화면의 두 그래프, Atlas 워드마크/At 파비콘을 운영 웹에 반영한다. 사용자가 2026-11-01 배포를 명시 승인했다.
- 끝난 것: 별도 디자인 브랜치에서 구현 및 실제 라이트/다크·데스크톱/모바일 렌더링 검증. 로고 원본과 시트는 docs/design/atlas-wordmark/에 있다. 기존 데이터/API/수집/DB/제어면은 변경하지 않았다.
- 검증: npm run check rc0/880pass/0fail/8skip(기존 compiler 미보유). 최종 browser check 개발 라이트·production 변환 다크 PASS, 1440×900 두 그래프 가시성, 390/360 모바일, 필터·키보드·모드 저장·오류 상태 확인. git diff --check rc0.
- 배포 경로: 기존 LOCAL_GIT 자동화에 main Push. 운영 Mac mini에서 비특권 빌드와 health/rollback 경계를 유지한다. 수동 서비스 재시작·bootstrap 재설치·Collector/FX/설정 변경 없음.
- 사전 관측: current=9f5fef2e5083af02f89984be77f924f2e3821621, web active PID76126, collector active PID69372, deploy-agent.timer active. 기존 SSH mux 연결 정상. sudo -n은 비밀번호 필요로 거부되어 비공개 저널/manifest를 읽지 않았다. 공개 health/정적 파일과 읽기 가능한 릴리스 포인터로 배포 결과를 검증한다.
- 기다리는 것: 이번 commit main Push 및 자동화 완료 확인.
- 다음 행동: 배포 SHA와 /healthz commit/current 포인터를 대조하고 CSS·SVG 응답 및 Collector PID 보존을 확인한다.
- 사용자 확인 필요: 아니오 — 배포 명시 승인. sudo가 실제 복구에 필요한 경우 해당 단계에서 요청한다.
- 자동 새 대화 예약: 안 함 — 배포 검증 진행 중.
