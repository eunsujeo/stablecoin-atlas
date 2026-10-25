# 검토 네트워크 명칭과 프로필 헤더 축소
- 목표: USDC/USDT/RLUSD의 Ethereum만 표시된 이유를 설명하고 첨부 이미지의 중복 제목 영역을 줄인다.
- 끝난 것: 공식 Circle/Tether/Ripple 페이지 텍스트로 타 네트워크 제공 확인(연구 기록 링크). 선택기가 전체 네트워크 목록이 아닌 기존 소스 검토5자산8프로필임을 명확히 표시. 배포 네트워크→검토 네트워크, 배포 수→검토 프로필/검토 곳수. TOKEN PROFILE·큰 자산명·반복 네트워크·별도 완료영역 삭제. toolbar에 자산명/14기능/네트워크 선택 통합, 탭 바로 연결. 소스/기능/체인 identity·기존 판정 유지. 새 체인 프로필/RPC/provider API/compiler/키/DB 변경 없음.
- 변경 파일: web/source-review.js, web/source-review.css, tools/source-review-browser-check.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-compact-profile-header.md, docs/handoff/2026-10-25-compact-profile-header.md
- 검증: node --check web/source-review.js rc0; node --check tools/source-review-browser-check.mjs rc0; node tools/source-review-browser-check.mjs http://127.0.0.1:4173 rc0/PASS(hero/completion DOM·TOKEN PROFILE없음, 검토 네트워크/프로필 문구, desktop/mobile 탭과toolbar 간격, 양쪽8프로필14기능·4필터·검색/네트워크/키보드·근거503·과거진단 DOM없음·비교/전체현황 회귀, 다크/라이트1440/390px·JS오류0/외부요청0); npm run check rc0 tests567/pass567/fail0/cancelled0/skipped0; git diff --check rc0. 로그 .state/agent-logs/compact-profile-header-{browser,check}.log. 실제 캡처 .state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png 및 .state/profile-header-{legacy,atlas}-{dark,light}-mobile.png 확인.
- 기다리는 것: 없음
- 다음 행동: 사용자의 다음 구체 화면/기능 요청을 처리한다. 실제 타 체인 존재를 소스 검토 완료나 공통14기능 지원으로 자동 승격하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 요청.
- 읽을 파일: docs/research/2026-10-25-compact-profile-header.md, docs/adr/0100-reviewed-source-asset-profiles.md

첫 구문/브라우저/전체 검사 통과. 공식 페이지는 웹 텍스트 확인이며 렌더링/코드관측/주소인증과 구분한다. 로컬 UI의 외부요청0과 공식페이지 확인용 웹 도구 요청은 별도 범위다. Chrome 종료·사용자용4173 유지. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 같은 화면의 후속 수정으로 자동 새 대화 예약하지 않음.
