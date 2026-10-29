# 전체 현황 전송 우선 표시

사용자 요청대로 전송 추이/네트워크 비중 행을 공급량 행 위로 옮겼다. 요약 카드도 전송→공급량 순서이며 전송 지표의 기본값과 첫 탭을 전송 건수로 바꿨다. 전송금액 탭으로 전환할 수 있다. 기존 관측값/정밀도/시각/출처, DB/API/수집기/FX/운영 배포는 바꾸지 않았다.

변경은 `web/supply-overview.js`. 브라우저 검사에서 DOM 순서/초기 건수 선택/첫 탭/요약 순서와 기존 지표 전환·큰 수·last-good 경로를 확인한다. PC/모바일 폭 × 다크/라이트 4화면 PASS, 외부 요청/JS 오류0. Safari 스트림 미지원은 Chrome 에뮬레이션이며 실기기 검증이 아니다.

첫 스크롤 회귀는 전송 행이 위로 이동하여 시험의 scrollY>200 전제가 성립하지 않아 중단됐다. 제품 코드를 바꾸지 않고 시험 header 여유를 300→700px로 늘려 스크롤 상태를 명시적으로 만들었다. 로그는 `/tmp/atlas-overview-order-scroll.log`, 전체 검사는 `/tmp/atlas-overview-order-check.log`.

사용자 후속 질문에는 공급량 전용 일별 수집기 `collector:registered`가 구현되어 있음을 확인했다. 운영 실행 여부/10월23일 이후 수집 중단의 원인은 원격 조사하지 않았으며 이번 UI 변경과 분리한다. 현재 로컬 웹은 기존 원격 Supabase reader 연결이며 서버 재시작/수집 실행/DB 쓰기0이다.

검증 완료: `npm run check` build 및 755건(일반681+네트워크 차단74) PASS/0fail. `node tools/network-usage-browser-check.mjs` 4화면 PASS. `node tools/overview-scroll-browser-check.mjs` 8조건/64전환 및 inline min-height 복원 PASS. `git diff --check` PASS.
