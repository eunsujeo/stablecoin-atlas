# 자산 프로필 검색 직접 선택
- 목표: 기존 저장 근거를 활용한 자산 프로필 화면 사용성을 개선한다.
- 끝난 것: 사용자 작업 시작 지시에 따라 네트워크·주소 검색에 일치한 프로필별 직접 선택 버튼·자산/네트워크/검토 범위·일치 수·선택 상태를 추가했다. Enter로 정확한 프로필과 네트워크를 열고 포커스를 유지한다. 검색 편집/지우기는 선택을 바꾸지 않는다. 기본/Atlas 공통26프로필·원래 상태/근거/판정·자산별 네트워크 기억·탭/필터를 유지했다. 새 외부/API/RPC/compiler/키/DB 변경0.4397포트 사용 중으로4398에 별도 미리보기를 열었다. 첫 브라우저 Enter 합성 누락은 검사 도구에 carriage return을 전달해 수정했다.
- 변경 파일: web/source-review.js, web/source-review.css, tools/source-review-browser-check.mjs, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-profile-search-navigation.md, 이 인계문
- 검증: node tools/source-review-browser-check.mjs http://127.0.0.1:4398 rc0(기본/Atlas26곳 Enter선택·빈결과/초기화·포커스·기존동작·dark/light/390px·JS오류0/외부요청0). npm run check rc0 tests591/pass591/fail0/cancelled0/skipped0. git diff --check rc0. 로그 .state/agent-logs/profile-search-{browser,check}.log. 이미지 .state/profile-search-{atlas,legacy}-{dark,light}-mobile.png 중 Atlas light를 실제 열어 확인했다.
- 기다리는 것: 없음
- 다음 행동: 이 인계문과 작업 기록을 읽고 새 사용자 요청이 있을 때 구체 화면 조정 범위를 확인한다. 새 조사/배포 검증/지원 판정 확장은 고정 계획과 명시 승인 전 시작하지 않는다. 기존 소비53GET는 재사용하지 않는다.
- 사용자 확인 필요: 예 — 이번 화면 개선은 완료. 추가 기능·조사는 새 구체 요청 필요.
- 읽을 파일: docs/research/2026-10-25-profile-search-navigation.md, docs/adr/0102-scoped-top10-profile-excerpts.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 이번 서버127.0.0.1:4398은 로컬 미리보기 상시 서비스이며 결과 대기 작업이 아니다. 원문·키·endpoint는 게시하지 않는다.
