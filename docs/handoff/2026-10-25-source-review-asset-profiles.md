# 자산 프로필 최신 소스 검토 반영
- 목표: 사용자 요청 자산 프로필 업데이트.
- 끝난 것: ADR0100에 따라 기본/Atlas 자산 프로필에 공통 정적 발췌 추가. USDC/USDT/RLUSD/JPYC/JPYSC5토큰·JPYC4체인 포함8배포 선택, chainId/주소·전송/승인/발행·권한·원본 관측/검토 기준일·한계 표시. 기존 관측 보고서/판정/집계 유지. USDC 불일치·USDT 실패·JPYC Ethereum 프록시만 일치/구현 UNKNOWN·다른 체인 미관측·Kaia 부분 일치·JPYSC 자동 절단 보존, 배포 전체 연결 모두 UNKNOWN. 공개 발췌 HTML은 명시 오프라인 생성, 웹은 정적 읽기만. 신규 RPC/취득/compiler/DB 변경0. Lead 8b47fa71d1ce4d7d9c78836035f9b3bb proceed 조건 반영. 구현/검증 실패 없음.
- 변경 파일: web/source-review-data.js, web/source-review.js, web/source-review.css, web/source-review-notes.html, web/source-review.test.mjs, web/index.html, web/atlas.html, tools/source-review-notes.mjs, tools/ui-preview.mjs, docs/adr/0100-reviewed-source-asset-profiles.md, docs/DEVELOPMENT_STATUS.md, docs/TOKEN_TECHNICAL_REVIEW.md, docs/research/2026-10-25-source-review-asset-profiles.md, docs/handoff/2026-10-25-source-review-asset-profiles.md
- 검증: node tools/source-review-notes.mjs — rc0/8배포 생성. node --test web/source-review.test.mjs — rc0 tests2/pass2/fail0. node .state/source-review-profile-browser.mjs http://127.0.0.1:4174 — rc0/PASS(양쪽8배포·정확한주소/체인·동일내용·기존보고서수유지·근거목록503격리·다크/라이트/390px·JS오류0·외부요청0). npm run check — rc0 tests566/pass566/fail0/cancelled0/skipped0 (.state/agent-logs/source-review-asset-profiles-check.log). git diff --check — rc0.4173 공개 데이터/발췌 HTML HTTP200.
- 기다리는 것: 없음
- 다음 행동: 자산 프로필 반영 완료를 기준으로 사용자의 다음 구체 개발 범위를 확인한다. 추가 기능·외부 조회·컴파일·DB 변경을 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 다음 구체 작업 선택.
- 읽을 파일: docs/research/2026-10-25-source-review-asset-profiles.md, docs/adr/0100-reviewed-source-asset-profiles.md

사용자용 http://127.0.0.1:4173/#assets 는 기존 PostgreSQL reader로 실행 중. 검증용4174 및 독립 Chrome/profile은 종료·정리. 공개 캡처 .state/source-profile-{legacy,atlas}-{dark,light}.png. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존.
