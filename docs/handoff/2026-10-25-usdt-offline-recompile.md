# USDT 저장 소스 오프라인 재컴파일 완료
- 목표: 사용자가 권장안으로 승인한 저장 USDT 소스·고정0.4.18 오프라인 재컴파일만 수행한다. 새RPC/다운로드/배포대조는 제외한다.
- 끝난 것: 기존 후보를 solc0.4.18+commit.9cf6e910.Emscripten.clang으로1회 컴파일했다. diagnostics0·runtime11075바이트·함수31개·정적entry29개다. 원본7파일·후보1·compiler cache3개 총11파일 불변, outputSelection 외 소스/설정 동일을 확인했다. 별도1.2 OFFLINE JSON/Markdown·실효입력/결과를 새 비공개root에 보존했다. 구버전 출력 immutableReferences 누락을 비교기가 INVALID_RELOCATION_DATA로 남겨 전체PARTIAL·binding UNKNOWN이다. 누락보정/metadata제거/실제배포대조/숫자tag archive변환0이다. 정적선택/의미론/외부효과 미증명과 기존MISMATCH·판정을 유지했다. 최초 사후검증의 null객체 기대오류rc1 로그를 보존했고 기존결과만 재검증해rc0, compiler재실행0이다. Lead632f3a9d419c450c9251ddc75f06536e answered/proceed 조건 반영. Agent/pane추가0.
- 변경 파일: AGENTS.md, docs/TOKEN_TECHNICAL_REVIEW.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-usdt-offline-recompile.md, docs/handoff/2026-10-25-usdt-offline-recompile.md
- 검증: node --use-env-proxy --import tsx .state/validate-usdt-offline-recompile-20261025.mjs — rc0 PASS(원본11파일/보고서/설정/무관측/권한). artifact3개 hash/bytes/0600 PASS. npm run check > .state/agent-logs/usdt-offline-recompile-check.log 2>&1 — rc0 tests548/pass548/fail0/cancelled0/skipped0. git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 후속 요청 시 구버전 출력 비교기의 사설 Fixture 호환성 보완과 실제 배포 대조를 구분해 범위를 확인한다. 현재 승인 단위는 완료이며 compiler재실행·새RPC·다운로드·배포대조를 자동 시작하지 않는다. 새RPC는 정확한 입력/허용목록/호출·시간 한도/새고정hash 관측 계획의 추가 승인이 필요하다.
- 사용자 확인 필요: 예 — 다음 구현 또는 실제 배포 대조의 구체적 범위
- 읽을 파일: docs/research/2026-10-25-usdt-offline-recompile.md, docs/TOKEN_TECHNICAL_REVIEW.md, docs/adr/0097-pinned-solc0418-visible-browser-profile.md

비공개root는 .state/usdt-offline-recompile-20261025/이며 원문/compiler bytes/키는 게시하지 않는다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다.
