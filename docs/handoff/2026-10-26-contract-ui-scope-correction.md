# 최신 한 건·로컬 검토 범위·코드 문구 제거 완료

- 사용자 정정: 이전 이력 제거/로컬 검토 범위 합의를 재확인했고, 전체 현황에 노출된 profiles=> 함수 코드 안내 문구 제거를 추가 요청했다.
- 완료: 웹 표시 projection에서 chainId+주소별 최신 한 건만 노출. 관측/완료 시각과 ID로 동률 결정. 이전 카드/이력 선택/실패 문구 제외. 실제 소스 hash/함수 표/사설10항목 근거가 있는 보고서에 저장 소스 검토 완료 표시. 함수/항목/시험 수는 보고서에서 산출. 전체 UNKNOWN은 완료 배지로 사용하지 않으며 근거의 UNKNOWN/NOT_RUN/NOT_TESTED와 현재 한계는 보존. Supabase 불변2행/원본/판정 변경0.
- 추가 문구: 전체 현황 overview-source-note 요소/대입 제거. 콤마 연산자가 함수 자체를 문자열로 표시하던 정적 문서 생성기도 수정·재생성. 날짜2026-10-25/5토큰/26배포를 자료에서 출력한다. sourceScopeSummary의 정상 집계 사용은 유지.
- 검증: 표적10/pass10, 실제 Chrome 로컬/DB모드 두 번 rc0. 최신카드1·이력없음·소스검토배지·11항목/16함수·검색/탭/키보드·다크/라이트·1440/390px·API503·코드문구없음·외부/비공개요청0. npm run check rc0 tests657/pass657/fail0/cancelled0/skipped0. git diff --check rc0. 새 DB migration/import/delete/체인RPC/공급자API/키/운영배포0.
- 과정/근거: [연구 기록](../research/2026-10-26-contract-ui-scope-correction.md). Lead 9c5bab411b1848ed9ebfc9c10005d272 proceed 회수/조건 반영. 임시Agent/pane/미회수 검토 없음. 로그 .state/agent-logs/contract-ui-scope-{targeted,check,browser-local,browser-db,preview}.log.
- 실행 중: http://127.0.0.1:4173/#contracts DB reader 모드. 이전 소유 PID5494 정상 종료 후 동일 인자로 재시작한 Node listener PID25681, exec session43649. 사용자 검토용으로 유지. 명령 npm run ui -- --database --database-env .state/market-db-secrets/reader.env. 종료 시 현재 소유/명령을 확인하고 해당 미리보기만 정상 종료한다.
- 변경: web/contract-review-view.js/contract-review.js/index.html/overview.js/source-review-notes.html·source 문서 생성기·새 자산 local 허용목록·회귀/브라우저 시험·AGENTS/ADR0113/상태/안내/연구/인계. 앞선 미커밋 변경을 유지했고 기존 untracked 2026-10-22-router-lead-review.md는 수정하지 않았다.
- 다음: 이번 요청 완료. 이력을 다시 UI에 넣거나 범위 밖 실제 권한/소스진위/배포재현을 완료 필수조건으로 요구하지 않는다. 현재 Supabase의 과거 불변 행/원본은 보존되며 이번 수정은 화면 이력 제외다. 새 실행/운영배포를 자동 시작하지 않는다.
