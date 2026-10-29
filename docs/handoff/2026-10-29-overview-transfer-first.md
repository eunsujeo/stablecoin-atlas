# 인계: 전송 위·공급량 아래, 기본 전송 건수

전체 현황 전송 추이/비중을 공급량 위로, 요약 카드도 전송→공급량 순서로 표시. 최초 지표/탭 순서는 전송 건수→전송금액. 기존 관측/DB/API/수집기/FX 변경0. 완료 후 commit/push 사용자 승인 유지.

PC/모바일 × light/dark 브라우저 4화면 PASS. 전송 행이 위로 이동해 스크롤 시험의 충분한 scrollY 전제를 맞추도록 fixture header 높이만 조정했다. 제품 스크롤 코드는 유지. 상세 경위/재현 명령은 docs/research/2026-10-29-overview-transfer-first.md.

기존 로컬 preview PID5350/4173의 Supabase 읽기 전용 연결 유지. 정적 모듈 새로고침으로 반영. 다음 세션에는 소유/명령/listener 재확인. 별도 미추적 docs/handoff/2026-10-22-router-lead-review.md 미수정/미커밋. 운영 활성화 미실행/직접 Mac mini 배포 금지 유지, 기존 30일 수집 예산 재승인 불필요.

공급량은 등록 일별 수집기 구현되어 있으나 현재 API 최신 수집일10월23일. 운영 수집기 중단/실패 원인 미조사. Canton/Allium 추가 수집은 진행하지 않는다.

검증 완료: `npm run check` build 및 755건(일반681+네트워크 차단74) PASS/0fail. `node tools/network-usage-browser-check.mjs` 4화면 PASS. `node tools/overview-scroll-browser-check.mjs` 8조건/64전환 및 inline min-height 복원 PASS. `git diff --check` PASS.
