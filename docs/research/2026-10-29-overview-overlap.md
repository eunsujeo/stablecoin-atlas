# 전송 카드와 공급량 카드 겹침 수정

전송 행을 위로 이동한 후 사용자가 아래 공급량 카드와 겹치는 화면을 제보했다. 기존 브라우저 검사는 DOM 순서/지표/스크롤을 확인했지만 카드의 실제 rect 간격은 검사하지 않아 놓쳤다.

수정 전 1440px light fixture에서 전송 rowBottom555.64, 다음 공급량 nextTop571.64인데 전송 카드 cardBottom707.39로 실제 겹침을 재현했다. CSS의 전송 행 height320px보다 카드 콘텐츠가 높았다. `.overview-transfer-row`를 height:auto/min-height320px로 바꾸고 도넛 카드 max-height380px로 범례 스크롤 영역을 유지했다. overflow:hidden으로 내용/포커스를 숨기지 않는다. 제품 JS/데이터/DB/수집기/FX/운영 배포는 바꾸지 않았다.

`node tools/network-usage-browser-check.mjs`: 1440/801/800/390 × light/dark 8화면에서 두 지표 전환과 LAST_GOOD 경고 후 rect를 측정했다. 전송 카드 아래부터 다음 공급량 카드까지10px 이상, 갱신 문구 카드 내부, 도넛 높이 상한, 범례 실제 scroll과 마지막 항목 focus/가시성, 공급량 목록 실제 scroll PASS. 공급량10곳/Arkham18쌍의 가상 자료만 사용, 외부 HTTP/JS 오류0. Safari API 미지원 Chrome 에뮬레이션이며 실기기 검사는 아니다.

`node tools/overview-scroll-browser-check.mjs`: 8조건64전환과 inline min-height 복원 PASS. `/tmp/atlas-overlap-scroll.log`. `npm run check`: build와755건(681+네트워크 차단74) PASS/0fail, `/tmp/atlas-overlap-check.log`. `git diff --check` PASS. Lead9061eb500c914b8d8a54ab76f8bfac6a proceed 및 제시 검증 조건 확인.

로컬 preview는 기존 PID5350/port4173의 Supabase reader를 유지한다. CSS/JS는 새로고침으로 읽으며 서버 재시작0. 원래 관측 시각/공급량10월23일 이후 갱신 미확인 문제는 이 레이아웃 수정으로 변경하지 않는다.
