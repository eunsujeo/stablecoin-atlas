# 추가18곳 연구의 로컬 웹 반영
- 목표: 사용자 승인 추가18곳의 연구 범위·조건·미확인을 기존 자산 프로필에 반영한다.
- 끝난 것: 기존8+추가18=26프로필/5자산/16네트워크. 기본/Atlas 공통 선택·검색·3탭·상태 필터·정적 발췌/근거hash를 연결했다. 기존8곳/14기능/SOURCE_REVIEWED와 읽기 판정·등급은 보존. 새18곳은 profile별 가변 기능/원래7상태와 초기 구현·프록시·프로토콜/참조/브리지·문서 범위를 구분하며 Ethereum 기능을 상속하지 않는다. non-EVM은 별도 networkKey·식별자 종류를 표시한다. 전체 현황8/26의 분모와 자산별 범위별 수를 명시. 외부/API/RPC/compiler/키/DB 변경0. Lead 4b0e34bf486d418d84b385cefc1339ba proceed 회수/반영. 기존 브라우저 정규식의 새 필터명 오검출을 검사 범위 수정으로 해결했고 원래 기능은 보존. notes의 날짜 comma expression/고정8문구도 수정.
- 변경 파일: AGENTS.md, docs/DEVELOPMENT_STATUS.md, docs/adr/0102-scoped-top10-profile-excerpts.md, docs/research/2026-10-25-top10-profile-excerpts.md, tools/{top10-profile-excerpts,source-review-notes,source-review-browser-check,ui-preview}.mjs, web/{source-review-top10-data,source-review-data,source-review,overview}.js, web/source-review{.css,-notes.html,.test.mjs}, 이 인계문
- 검증: node --test web/source-review.test.mjs rc0 tests4/pass4/fail0/cancelled0/skipped0. node tools/source-review-browser-check.mjs http://127.0.0.1:4397 rc0(기본/Atlas26곳·새18곳 모바일3탭·dark/light/390px·JS오류0/외부요청0). npm run check rc0 tests591/pass591/fail0/cancelled0/skipped0. git diff --check rc0. 로그 .state/agent-logs/top10-profiles-{unit,browser,check}.log. 이미지 .state/top10-{atlas,legacy}-{dark,light}-mobile.png 중 Atlas light를 실제 열어 확인.
- 기다리는 것: 없음
- 다음 행동: 인계문과 ADR0102의 완료 범위를 읽고 새 사용자 요청이 기존 저장 자료의 화면 조정인지 확인한다. 새 조사/배포 검증/지원 판정 확장은 고정 계획과 명시 승인 전 시작하지 않는다. 소비된53GET 실행을 재사용하지 않는다.
- 사용자 확인 필요: 예 — 이번 승인 범위는 완료. 추가 기능·조사 범위는 새 구체 요청 필요.
- 읽을 파일: docs/research/2026-10-25-top10-profile-excerpts.md, docs/adr/0102-scoped-top10-profile-excerpts.md, docs/research/2026-10-25-top10-source-review-results.md

원문 archive와 키/endpoint는 Git/웹에 게시하지 않았다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 완료 후 commit/push와 자동 새 대화 예약을 수행한다.
