# Wallet Flow 종료 및 학습 화면 복귀 경로

사용자 요청으로 Wallet Flow 메뉴, 페이지/JS/CSS/JSON의 preview·production 경로를
제거했다. 단순 메뉴 숨김이 아니라 직접 URL도 GET/HEAD404이며 기존 수집 snapshot,
사설 원본, 연구 기록 및 오프라인 분석 도구는 보존한다. 자동 수집을 추가하지 않는다.

추가 요청: 블록체인 학습에서 돌아가는 경로가 잘 보이지 않았다. 기존 Atlas 로고의
홈 링크만 있었고 명시적 복귀 링크가 없었다. 상단에 네이티브 `← 전체 현황` 링크를
추가했다. 브라우저 history.back에 의존하지 않아 직접 접속이나 내부 네트워크 전환
이력과 무관하게 대시보드로 나온다. 네트워크별 재생 모델/기존 hash 이력은 유지한다.
모바일 헤더에 맞춰 Knowledge 보조 글자를 숨기며 48px 헤더 높이는 유지한다.

## 검증
- Wallet Flow 회귀19pass: preview와 production에서10개 옛경로 GET/HEAD404,
  루트200/메뉴제거, 보존한 오프라인 분석 테스트 유지.
- 첫 테스트 설정의 PUBLIC_READERS_REQUIRED는 production fixture의 reader 누락이
  원인이다. 원래 필요했던 읽기 함수 stubs를 복원하고 재실행해19pass.
- tools/atlas-navigation-browser-check.mjs: 실제 Chrome에서5체인×3해상도
  1440×900/1280×800/390×844, 복귀 링크 표시/키보드 Enter/루트 복귀,
  네트워크 연속 전환 후 복귀, 메뉴 부재/옛3경로404, JS오류0 PASS.
- .state/atlas-navigation-check/verification.json 및15스크린샷.
- 전체 검사 로그 .state/remove-wallet-flow-check.log. 배포 결과는 인계문 참조.

Collector/FX/DB/배포설정/관측 자료 변경0, 신규 공급자 호출0.

npm run check rc0 / 990pass / 0fail / 8skip。
