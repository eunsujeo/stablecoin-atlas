# 기능별 소스 검증 항목
- 목표: 검증 항목을 기능별로 나눠 자산별 기능 유무를 확인한다.
- 끝난 것: 공통14기능(전송/위임전송/승인/철회/승인0초기화강제/서명승인/발행/소각/정지/주소차단/차단자금제어/외부토큰회수/구현변경/전송수수료)으로 번호식 행을 교체. 있음/없음(검토한 소스 경로 한정)/추가 검토와 조건·근거·상태필터·빈 결과 제공. 기존 원문 sourceReviewProfiles와 SOURCE_REVIEWED/배포/제품 판정 보존. 생성 공개 발췌에 기능표만 추가. 제거했던 과거진단 UI 복원 없음. 새 외부 API/RPC/compiler/키/DB 변경0.
- 변경 파일: web/source-review-data.js, web/source-review.js, web/source-review.css, web/source-review.test.mjs, web/source-review-notes.html, tools/source-review-notes.mjs, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-source-feature-categories.md, docs/handoff/2026-10-25-source-feature-categories.md
- 검증: node tools/source-review-notes.mjs rc0; node --test web/source-review.test.mjs rc0 tests3/pass3/fail0; node --check web/source-review.js·web/source-review-data.js·tools/source-review-notes.mjs·tools/source-review-browser-check.mjs 각rc0; node tools/source-review-browser-check.mjs http://127.0.0.1:4173 rc0/PASS(양쪽8프로필×14기능의 상태/조건/근거와4필터·빈 결과, 체인선택/검색/키보드, 과거진단 DOM없음, 근거503·비교/전체현황 회귀, 다크/라이트1440/390px, JS오류0/외부요청0). npm run check rc0 tests567/pass567/fail0/cancelled0/skipped0; git diff --check rc0. 로그 .state/agent-logs/feature-categories-{unit,browser,check}.log. 실제 캡처 .state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png 확인.
- 기다리는 것: 없음
- 다음 행동: 사용자의 다음 구체 화면/기능 요청을 처리한다. 추가 검토 표시를 새 외부 실행이나 자동 조사 지시로 간주하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 요청.
- 읽을 파일: docs/research/2026-10-25-source-feature-categories.md, docs/adr/0100-reviewed-source-asset-profiles.md

단위/브라우저/전체 검사는 첫 실행부터 통과. Lead 9eadbf0ef92341dc945975ac952c0910 revise_plan의 조건 반영: 부재는 표 가까이 선택 경로 한정 표시, USDT 승인/철회/zero-reset은 deprecated=false local 경로, RLUSD 계정pause≠blacklist함수명, deprecate≠UUPS, JPYC 등록chain만 재사용. 문서 부족을 기능 부재로 추정하지 않음. 있음/없음/추가검토는 USDC10/2/2·USDT12/0/2·RLUSD11/2/1·JPYC각11/1/2·JPYSC11/1/2. Chrome 종료·사용자4173 유지. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 같은 주제의 후속 수정으로 자동 새 대화 예약 안 함.
