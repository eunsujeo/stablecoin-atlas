# 네트워크 전송 비교표 제거

사용자 첨부 이미지의 전체 비교표와 하단 설명을 제거했다. `web/supply-overview.js`의 renderUsage 및 호출/section 생성과 전용 CSS를 삭제했다. 전송금액·건수 추이, 네트워크 비중, 요약과 원래 수치/시각/출처를 유지한다. DB/API/수집기/FX/승인 예산/운영 배포 변경은 없다.

브라우저 회귀는 표 부재와 남은 지표 전환·큰 정수 표시·last-good/실패 처리를 검사한다. 첫 새 검사는 숫자에 쉼표가 없다고 가정해 실패했고 실제 exactDecimal 표시 형식으로 기대값을 수정했다. 스크롤 검사는 표 삭제로 페이지 아래끝이 짧아져 브라우저의 정상 scroll clamp(416→371)를 검출했다. 시험 fixture에 하단 여유를 두어 같은 스크롤 위치가 전환 전후 모두 유효하도록 수정했다. 제품 스크롤 코드는 바꾸지 않았다.

`node tools/network-usage-browser-check.mjs`: 1440/390 × light/dark 4개 화면 PASS, 외부 HTTP/JS 오류 0. Safari 스트림 API 미지원은 Chrome 에뮬레이션이며 실기기 검사가 아니다. `node tools/overview-scroll-browser-check.mjs`: anchoring on/off × 2폭 × 2테마의 지표/키보드 전환 64건과 inline min-height 복원 PASS. 로그 `/tmp/atlas-remove-usage-scroll.log`.

로컬 preview PID5350은 기존 reader.env의 원격 Supabase 읽기 전용 연결을 사용한다. 서버 재시작·새 수집·운영 서버 접속은 하지 않았다. 정적 파일 새로고침으로 수정 표시. 원문·인증 정보는 게시하지 않는다.

`npm run check`: TypeScript build 및 전체 755건(일반681 + 네트워크 차단 Allium 보존 회귀74) PASS/0fail. `git diff --check` PASS.
