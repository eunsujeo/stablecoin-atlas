# 자산 프로필 재구성
- 목표: 사용자 요청 자산 프로필 새 구성.
- 끝난 것: 기본/Atlas 공통 자산 목록·토큰/체인/주소 검색·빈 결과 안내·배포 네트워크 선택·자산별 마지막 체인 기억·개요/기능·권한/근거·한계 탭·키보드 이동·모바일2열 목록 구현. 기존5토큰·8배포 데이터/공개 발췌 문서/관측 보고서·판정/UNKNOWN 유지. 신규 외부 취득/RPC/compiler/DB 변경0. 초기 패치 도구의 동일파일 삭제/추가 형식 거절은 파일 쓰기로 해결. 기본 테마 accent fallback·모바일 높이를 정적/화면 확인 후 보완. 검증 실패 없음.
- 변경 파일: web/source-review.js, web/source-review.css, web/index.html, web/atlas.html, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-asset-profile-redesign.md, docs/handoff/2026-10-25-asset-profile-redesign.md
- 검증: node --check web/source-review.js — rc0. node --test web/source-review.test.mjs — rc0 tests2/pass2/fail0. node tools/source-review-browser-check.mjs http://127.0.0.1:4174 — rc0/PASS(양쪽8배포·모든탭내용·검색/빈결과·체인기억·방향키/Home/End·포커스·기존보고서수유지·근거503격리·다크/라이트/390px·JS오류0·외부요청0). npm run check — rc0 tests566/pass566/fail0/cancelled0/skipped0 (.state/agent-logs/profile-redesign-check.log). git diff --check — rc0. 기존 공개 데이터/발췌 HTML git diff rc0(불변).4173 페이지/JS HTTP200. 브라우저 검증은 실제 렌더링이며 정적 응답 검사와 구분.
- 기다리는 것: 없음
- 다음 행동: 재구성된 자산 프로필에 대한 사용자 의견과 다음 구체 요청을 확인한다. 추가 구현/외부 조회/컴파일/DB 변경을 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 작업 선택.
- 읽을 파일: docs/research/2026-10-25-asset-profile-redesign.md, docs/adr/0100-reviewed-source-asset-profiles.md

사용자용 http://127.0.0.1:4173/#assets 유지. 검증용4174·임시 Chrome/profile 종료/정리 완료. 캡처 .state/profile-redesign-{legacy,atlas}-{dark,light}[-mobile].png. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 현재 미확인과 SOURCE_REVIEWED/제품 판정의 의미는 이전과 동일.
