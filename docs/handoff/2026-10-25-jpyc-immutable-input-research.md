# JPYC immutable·배포 빌드 입력 조사 완료
- 목표: 사용자 후속 승인에 따라 새 RPC 없이 공식 공개 소스/배포/빌드 자료 조사와 저장 관측의 후속 오프라인 대조 계획을 작성한다.
- 끝난 것: 공식 조직의 chainId1/프록시 주소 표기를 재확인했다. 공식 profile·과거 JPYCv2 UUPS/README/Hardhat 설정4GET은 각각 HTTP200이며 비공개 원문/UTC/hash/길이 receipt를 보존했다. 개발 문서는 렌더링 오류, 공식 사이트/구현체 explorer는 웹 도구403으로 새 배포 자료 미확보다. 저장 AST ID173이 address형 __self=address(this)임을 확인했다. 과거 UUPS 원문은 CRLF→LF 진단만 같고 원본 바이트 DIFFERENT다. 과거 optimizer enabled/runs3000 유사성은 정확 배포 build 증명이 아니다. 실제 배포 입력/immutable 제출 근거 미확보, 새 RPC/compiler/대조 실행0·기존 구현체 UNKNOWN/전체 PARTIAL·소비 유지다. Lead 1f690816ecc141e0b750758c3f8e4a66 answered/proceed 조건 반영, Agent/pane 추가0.
- 변경 파일: docs/research/2026-10-25-jpyc-immutable-input-research.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-25-jpyc-immutable-input-research.md
- 검증: npm run check > .state/agent-logs/jpyc-immutable-research-check.log 2>&1 — rc=0 tests541/pass541/fail0/cancelled0/skipped0. 공개 원문4개 receipt/hash/권한·입력 hash·CRLF 진단 Python 검사 — rc=0 PASS(.state/jpyc-immutable-research-20261025/validation.json). node --import tsx .state/validate-jpyc-immutable-existing.mjs — rc=0 PASS(bundle8/원본15파일/권한/비밀/schema/기존판정/hash pin). 첫 기존 validator 호출은 출력 wx/EEXIST rc1로 기존 결과를 보존하고 출력 경로만 분리해 해결했다. git diff --check — rc=0.
- 기다리는 것: 없음
- 다음 행동: 사용자가 정확한 배포 build 입력과 근거 동반 immutable 제출물을 제공하거나 취득 경로/범위를 지정하면 연구 문서의 진입 조건과 맞춰 별도 오프라인 실행 계획을 고정한다. 이번에는 제출값/실행config를 만들지 않았다. 구현 주소/관측 bytes 자동채움·같은 입력 반복분석·새 RPC/추가 취득·기존 승인 재사용을 시작하지 않는다.
- 사용자 확인 필요: 예 — 정확한 입력/제출값 근거 또는 추가 취득의 구체적 출처·범위. 이미 끝난 조사 범위를 다시 승인받지 않는다.
- 읽을 파일: docs/research/2026-10-25-jpyc-immutable-input-research.md, docs/research/2026-10-25-jpyc-token-review-live.md, docs/TOKEN_TECHNICAL_REVIEW.md

원문/receipt/검증은 Git 제외 .state/jpyc-immutable-research-20261025/다. 공식/과거 저장소 main은 가변이며 commit UNKNOWN이다. 기존 원문/URL/인증정보와 compiler bytes는 Git/웹에 게시하지 않는다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다. 같은 주제의 작은 후속 조사이므로 자동 새 대화는 예약하지 않는다.
