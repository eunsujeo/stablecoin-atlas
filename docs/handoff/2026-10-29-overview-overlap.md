# 인계: 전체 현황 카드 겹침 수정

사용자 이미지의 전송→공급량 카드 겹침 재현. 전송 행 고정320px보다 콘텐츠가 컸고 실제 rect에서 다음 행이 앞 카드 아래끝보다135px 위에 시작했다. CSS 전송 행 height:auto/min-height320px, 도넛max-height380px로 수정. 전송 건수 기본/전송 위 순서와 데이터 유지.

브라우저 1440/801/800/390×2테마/두지표/LAST_GOOD rect간격·갱신시각내부·범례끝 focus/scroll·공급량 목록scroll PASS. 스크롤64전환/inline복원 PASS. npm run check 755pass/0fail, diffcheck PASS. Safari 실제기기/운영배포 아님. 상세 원인/경로 docs/research/2026-10-29-overview-overlap.md.

기존 preview5350/4173 Supabase reader 유지. 새로고침으로 표시. 다른 PC Herdr 설정 후속 작업은 별도 기록한다. 별도untracked docs/handoff/2026-10-22-router-lead-review.md 미수정/미커밋, 완료후commit/push승인유지. Mac mini 직접 배포/추가 수집0.
