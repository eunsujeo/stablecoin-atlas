# Stablecoin Atlas UI 리뉴얼
- 목표: 별도 브랜치에서 데이터 플랫폼 전체 UI의 시각적 완성도를 높이고 기존 기능/API/배포를 유지한다.
- 끝난 것: frontend-design/fixing-accessibility 지침 적용. 차콜/보라색 토큰, 단정한 탐색과 접기/모바일 메뉴, 숫자 구획, 차트·비교 목록, 기술 요약 행, 자산 프로필, 시장 상세, 표/입력/상태/focus 개선. 시장 모바일 차트의 실제 폭·읽기 가능한 눈금 보완. 기존 reader 저장 자료로 렌더링·스크린샷 확인. 공급자0/DB쓰기0/운영배포0/추가Agent0.
- 변경 파일: web/index.html, web/styles.css, web/source-review.css, web/source-review.js, web/overview.js, web/supply-overview.js, web/market-chart.js, tools/ui-design-browser-check.mjs, docs/design/2026-11-01-interface-renewal.md, docs/design/atlas-interface/, docs/research/2026-11-01-ui-renewal.md
- 검증: npm run check rc0/879pass/0fail/기존8skip; npm run check:ui rc0/119pass/0fail. Chrome 브라우저 도구 개발·운영 HTML PASS/JS오류0/외부HTTP0. 360~1600px/다크·라이트/접힘저장/검색/메뉴Escape와focus/로딩·오류·빈상태. 기본·보조·강조 텍스트 대비 다크7.43 이상/라이트5.98 이상. git diff --check 통과.
- 기다리는 것: 없음
- 다음 행동: 사용자의 스크린샷 검토와 수정 요청을 반영한다. 현재 브랜치 design/atlas-interface-renewal을 유지한다. main 병합이나 운영 반영은 별도 지시 후 진행한다.
- 사용자 확인 필요: 예 — 디자인 결과 검토. 배포 승인으로 간주하지 않는다.
- 읽을 파일: docs/design/2026-11-01-interface-renewal.md, docs/research/2026-11-01-ui-renewal.md
