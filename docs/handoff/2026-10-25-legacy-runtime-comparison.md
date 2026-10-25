# 고정 solc0.4.18 runtime 비교기 호환성 완료
- 목표: 승인된 immutableReferences 생략 호환성과 사설 Fixture 검증만 수행한다.
- 끝난 것: ADR0098에 따라 정확한 고정0.4.18 전체 버전·Object.hasOwn 필드 부재만 내부 빈 범위로 해석한다. SHA/worker/profile 검증 후 compiled.compiler를 전달한다. 원본 compiler 출력은 보존하며 다른/미지정 버전, 명시 undefined/null/배열/잘못된 맵, linkReferences 부재는 거절한다. 초과 제출값·미해결 library·metadata 포함 전체 hash 대조·기존 binding 의미를 유지한다. 실제 사설 소스 출력의 일치/마지막바이트 불일치/미관측과 무HTTP 오프라인 JSON/Markdown·저장 artifact 생략 보존을 검증했다. 새 외부 호출/다운로드/실제 USDT 재컴파일/배포대조/기존 보고서 변경0. Lead738f3cced96b4d2d9e5a70f931b37ace answered/proceed 조건 반영, 추가 Agent/pane0.
- 변경 파일: AGENTS.md, src/token-review/compiler.ts, src/token-review/runtime-comparison.ts, src/token-review/review.ts, tests/token-review-solc0418.test.mjs, docs/TOKEN_TECHNICAL_REVIEW.md, docs/DEVELOPMENT_STATUS.md, docs/adr/0098-legacy-runtime-omitted-immutable-ranges.md, docs/handoff/2026-10-25-legacy-runtime-comparison.md
- 검증: node --use-env-proxy --import tsx --test tests/token-review-solc0418.test.mjs — rc0 tests8/pass8/fail0/cancelled0/skipped0 (.state/agent-logs/legacy-runtime-targeted.log). npm run check — rc0 tests551/pass551/fail0/cancelled0/skipped0 (.state/agent-logs/legacy-runtime-check.log). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 현재 승인 단위는 완료다. 후속 USDT 작업을 원하면 저장 compiler 출력만 새 비교기로 분석해 별도 보고서를 만드는 오프라인 범위와 실제 배포 대조 범위를 구분해 사용자에게 확인한다. 재컴파일·기존 보고서 변경·새RPC·다운로드·배포대조를 자동 시작하지 않는다. 새RPC에는 정확한 입력/허용목록/호출·시간 한도/새고정hash 계획의 추가 승인이 필요하다.
- 사용자 확인 필요: 예 — 실제 USDT에 보완 비교기를 적용할 별도 오프라인 분석 또는 실제 배포 대조의 구체적 범위
- 읽을 파일: docs/adr/0098-legacy-runtime-omitted-immutable-ranges.md, docs/TOKEN_TECHNICAL_REVIEW.md, docs/research/2026-10-25-usdt-offline-recompile.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 비공개 원문/compiler bytes/키는 Git·웹에 게시하지 않는다.
