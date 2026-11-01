# 정상 갱신 안내 축소

- 목표: 사용자 승인에 따라 정상 갱신을 작은 ‘업데이트 중’ 표시로 바꾸고 실패·요청 제한 안내를 유지한다.
- 끝난 것: browser-cache-ui의 표시만 변경. 여러 API의 실패/429를 정상 갱신보다 우선한다. stale 자료는 업데이트 필요로 구분하고 취소/저장소 문제도 보존한다. 정상 갱신은 헤더 버튼 아래 절대 위치로 표시해 레이아웃을 밀지 않는다. 같은 헤더를 사용하는 중첩 화면의 표시를 묶고 중복 진행 문구를 숨긴다. TTL·캐시 원문/관측시각·재시도·API 정책 변경0.
- 변경 파일: web/browser-cache-ui.js, web/styles.css, web/browser-cache.test.mjs, tools/ui-cache-status-browser-check.mjs, docs/design/compact-refresh/.
- 검증: npm run check rc0/882pass/0fail/8skip(기존 compiler). 느린 cached refresh/위치 불변/모바일/완료 시 제거/429 경고 브라우저 검사 PASS, JS오류0. 실패·취소·만료·저장소 문제·여러 API 우선순위 회귀 포함. 최초 브라우저 검사에서 top-level await 표현식과 중첩 화면의 첫 indicator 선택을 수정했다. 실제 실패 응답은 브라우저 내부 주입이며 운영 API/DB/수집기에 요청을 만들지 않았다. git diff --check rc0.
- 기다리는 것: main Push 후 기존 LOCAL_GIT 자동 배포와 공개 health/자산 검증.
- 다음 행동: 배포 SHA와 공개 health commit을 대조한다. Collector/FX/DB/제어면은 변경하지 않는다.
- 사용자 확인 필요: 아니오 — 기존 배포 작업의 UI 후속 수정 진행 승인.
- 자동 새 대화 예약: 안 함 — 같은 UI 후속 작업.
