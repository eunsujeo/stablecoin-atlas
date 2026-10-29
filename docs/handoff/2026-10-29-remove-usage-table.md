# 인계: 네트워크 전송 비교표 제거

사용자 이미지의 비교표/하단 설명 전체를 제거. supply-overview renderUsage/section/call 및 전용 CSS 삭제. 전송금액·건수 추이/비중/요약/기존 DB와 수집 유지. 별도 미추적 docs/handoff/2026-10-22-router-lead-review.md는 수정/커밋하지 않는다.

브라우저 4화면·스크롤 64전환+inline복원 PASS, 외부 요청/JS 오류0. 테스트 기대 숫자 쉼표와 짧아진 페이지 scroll clamp에 맞춘 fixture 수정 경위는 연구 기록 참조. Safari 실기기 검사는 미실행.

현재 웹은 127.0.0.1:4173의 기존 PID5350, `.state/market-db-secrets/reader.env`를 통한 기존 원격 Supabase 읽기 전용 연결이다. 새 세션에는 소유/명령/listener 재확인. 실제 수집/운영 배포/DB 쓰기0. 운영 자동수집 활성화는 미실행이며 기존 30일 승인 재요청 불필요. Canton/Allium 추가 수집은 사용자 지시로 진행하지 않는다. 완료 후 commit/push 승인 유지.

`npm run check`: TypeScript build 및 전체 755건(일반681 + 네트워크 차단 Allium 보존 회귀74) PASS/0fail. `git diff --check` PASS.
