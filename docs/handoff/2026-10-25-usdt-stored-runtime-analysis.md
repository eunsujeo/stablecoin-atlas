# USDT 저장 compiler 출력 보조 분석 완료
- 목표: 승인된 저장 출력 분석과 별도 보고서 작성, 확보 compiler 현황 답변.
- 끝난 것: ADR0098 비교기에 기존 출력만 전달해 ADDRESS_NOT_OBSERVED·matched null·binding UNKNOWN을 확인했다. 재컴파일/새 RPC/다운로드/실제 배포 대조0. 기존3artifact hash/길이와 고유25파일 불변·원본 누락 필드·기존 INVALID_RELOCATION_DATA/PARTIAL·MISMATCH를 보존했다. 비공개 별도 연구 JSON/Markdown·입력 hash·validation은 .state/usdt-stored-runtime-analysis-20261025/에0700/0600으로 저장했다. 고정 solc0.6.12(USDC)/0.8.11(JPYC 조사)/0.4.18(USDT) 캐시 hash 검증 통과, 기본 설치 패키지0.8.37 확인. compiler 확보와 자산 배포 검증은 별개다. 제품 코드 변경/추가 Agent/pane0.
- 변경 파일: AGENTS.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-usdt-stored-runtime-analysis.md, docs/handoff/2026-10-25-usdt-stored-runtime-analysis.md
- 검증: node --import tsx .state/analyze-usdt-stored-runtime-20261025.mjs — rc0 PASS(25파일 불변·3artifact hash/길이·무관측·새 결과·권한). 별도 Python 재독 검증 — rc0 PASS(25입력hash·보조보고서·0600). npm run check — rc0 tests551/pass551/fail0/cancelled0/skipped0 (.state/agent-logs/usdt-stored-runtime-check.log). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: 이번 승인 단위는 완료다. 다음 자산의 저장 입력 분석 또는 실제 USDT 배포 대조 중 사용자가 원하는 대상을 확인한다. 실제 배포 대조에는 정확한 입력·허용 RPC/메서드·호출/시간 한도·새 고정hash 계획의 추가 승인이 필요하다. 외부 호출·재컴파일·다운로드·기존 보고서 덮어쓰기를 자동 시작하지 않는다.
- 사용자 확인 필요: 예 — 다음 분석 대상/범위 또는 실제 배포 대조 계획 승인
- 읽을 파일: docs/research/2026-10-25-usdt-stored-runtime-analysis.md, docs/adr/0098-legacy-runtime-omitted-immutable-ranges.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 비공개 원문/compiler bytes/키는 Git·웹에 게시하지 않는다.
