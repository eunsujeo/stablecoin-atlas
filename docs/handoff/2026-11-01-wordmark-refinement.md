# 워드마크 중심 브랜드 정정
- 목표: 심벌 대신 Stablecoin Atlas 이름의 타이포그래피로 브랜드를 만들고 사이드바/KPI의 완성도를 높인다.
- 끝난 것: 소문자 a·자산 선택 이니셜 제거. 작은 산세리프 Stablecoin/큰 세리프 Atlas, 접힘 Atlas/모바일 한 줄 워드마크. 사이드바 구획·선택 표면·KPI 수치/단위/기준일·얕은 표면 색조 조정. 모바일 KPI 하단 정보 정렬 확인. 실제 reader 자료 렌더링/화면 갱신. 기존 동작/API/배포 유지·운영 변경0/새 다운로드0/추가Agent0.
- 변경 파일: web/index.html, web/source-review.js, web/styles.css, tools/ui-design-browser-check.mjs, docs/design/2026-11-01-interface-renewal.md, docs/design/atlas-interface/, docs/research/2026-11-01-wordmark-refinement.md
- 검증: npm run check rc0/879pass/0fail/기존8skip. Chrome 디자인 브라우저 개발·운영 HTML PASS/JS오류0/외부HTTP0/360~1600px/다크·라이트/접힘 저장/단어·심벌 부재/KPI 정렬. git diff --check 통과.
- 기다리는 것: 없음
- 다음 행동: 현재 design/atlas-interface-renewal 브랜치에서 사용자 화면 피드백을 반영한다. 로컬 웹은 127.0.0.1:54871에서 기존 reader로 실행 중이다. main 병합·운영 배포는 별도 지시 후 진행한다.
- 사용자 확인 필요: 예 — 워드마크와 화면 디자인 검토.
- 읽을 파일: docs/design/2026-11-01-interface-renewal.md, docs/research/2026-11-01-wordmark-refinement.md
