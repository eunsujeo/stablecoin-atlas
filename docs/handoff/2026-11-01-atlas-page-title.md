# 브라우저 제목 정리

- 목표: 사용자 요청 ‘호환성 대시보드’ 문구 제거.
- 끝난 것: web/index.html의 title을 Stablecoin Atlas로 변경했다. 해당 문구는 이 한 곳에 있었고 document.title 재설정은 없다. 화면·데이터·API 변경 없음. fixing-metadata 스킬의 최소 범위 원칙을 적용했다.
- 검증: git diff --check rc0. npm run check rc0/882pass/0fail/8skip(기존 compiler). 로그 .state/agent-logs/atlas-title-check.log.
- 기다리는 것: 전체 검사와 main Push 후 자동 배포 확인.
- 다음 행동: 공개 HTML title과 health SHA를 확인한다.
- 사용자 확인 필요: 아니오 — 기존 운영 UI 후속 수정.
- 자동 새 대화 예약: 안 함 — 같은 UI 작업 맥락 유지.
