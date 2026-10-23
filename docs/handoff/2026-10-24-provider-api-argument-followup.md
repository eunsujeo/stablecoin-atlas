# API 인자 오류 후속 조사
- 목표: 인자 오류 4건의 공식 요청 형식과 후속 검사 대상·예산을 구체화한다.
- 끝난 것: Allium 잔액의 공식 Body 명세(배열1~100)와 공식 CLI balances_latest(list body)를 확인했다. 예제는 단일 객체여서 불일치를 보존하며 기존400 원인/수정 후 성공은 미확정이다. Arkham 상세3건의 공개 GET은 각403/cloudflare/X-Squid-Error없음이며 인자 값·단위UNKNOWN을 유지한다. 인증 API 재호출 없이 Allium 동일 Ethereum USDC 컨트랙트 주소의 배열1개·1HTTP/0run·2MiB·요청20초/유효시간5분·재시도/추가페이지0의 제안만 기록했다. 기존 슬롯/실제 누적/판정/DB/UI는 유지한다. Lead f19d539fe74249a494672c017063d471 응답 proceed는 문서 범위에 한정되며 회수했다.
- 변경 파일: docs/research/provider-api-argument-followup-2026-10-24.md, docs/research/provider-api-capabilities-2026-10-24.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-24-provider-api-argument-followup.md
- 검증: npm run check rc0 tests474/pass474/fail0/cancelled0/skipped0(.state/agent-logs/provider-argument-followup-check.log). git diff --check rc0. 공개 근거와 제안 문서 read-back 확인. 코드 변경 없음.
- 기다리는 것: 없음 — 시험과 Lead 응답 회수. 기존 UI는 상시 서비스다. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md는 유지한다.
- 다음 행동: 사용자가 고정1HTTP/0run·비용미확인 후보를 명시 승인하면 공식 CLI 근거를 고정하고 별도 실행계획/영속소비 보호와 가상 transport 검사를 구현·검증한 뒤 단발 호출한다. 기존 root/공통lock·이전원문/판정/시각·소비 보호를 유지한다. Arkham 미확인 인자를 추정하거나 기존 슬롯을 재사용하지 않는다.
- 사용자 확인 필요: 예 — 새 인증 표본 대상·추가1HTTP/0run·비용미확인을 확인해야 한다. 이번에는 조사와 제안만 완료했다. 자동 새 대화 예약은 질문으로 끝나는 턴이어서 하지 않는다.
- 읽을 파일: docs/research/provider-api-argument-followup-2026-10-24.md, docs/research/provider-api-capabilities-2026-10-24.md, docs/adr/0083-bounded-provider-capability-probe.md, tools/provider-capability-plan.mjs, tools/provider-capability-probe.mjs
