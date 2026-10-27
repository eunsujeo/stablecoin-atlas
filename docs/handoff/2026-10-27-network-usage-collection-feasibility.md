# 네트워크 활용 지표 수집 가능성 인계

- 사용자 요청: 전송량 외 트랜잭션/활성 주소/DEX/결제 지표가 수집 가능한지 먼저 확인. 현재는 공개 문서/저장 근거 조사이며 인증 호출은 미실행이다.
- 정본: [조사 결과와 후속 고정 후보](../research/2026-10-27-network-usage-collection-feasibility.md).
- 확보: 기존 전송/트랜잭션 건수 재사용 가능. 공식 sender_count/recipient_count와 주소 합집합 집계 경로, DEX 스키마 확인. 과거 Ethereum DEX 확인값 조회 성공 기록을 실제 금액 수집 성공으로 승격하지 않았다.
- 한계/실패: Payments Pipeline 공식 링크는 로그인으로 이동해 본문 미확보. 접근 우회/로그인/추측 테이블 호출 없음. 조정 전송량은 결제 외 분류를 포함한다. DEX USD는 FLOAT 기반 추정이며 NULL이 있으면 부분합이다.
- 검토: Lead 1ffed6bf62454c39870e666c42ad4917의 revise_plan 조건인 부분합/정상 집계0과 미확보 구분을 문서에 반영했다.
- 재현: web/survey-model.js, tools/allium-plan.mjs, docs/research/provider-api-capabilities-2026-10-24.md를 읽고 정본의 공식 링크를 확인한다. 비공개 원문/키/URL을 출력하지 않는다.
- 실제 후속 후보: Ethereum USDC/UTC2026-10-22, 세 SQL 각1회, 최대3run/18HTTP/15분/응답2MiB·총6MiB/재시도0. 비용 UNKNOWN과 해당 고정 범위의 승인을 받은 뒤 새 슬롯/SQL hash/authorization/기존 root·공통 lock을 준비·검증한다. 기존 소비 재사용 금지. 결제·다른 체인·UI/DB·자동수집·Mac mini는 제외.
- 사용자 별도 이전 인계문 docs/handoff/2026-10-22-router-lead-review.md는 건드리지 않는다.
- 필수 검사: npm run check 성공(rc0), 691 tests/691 pass/0 fail. 로그 .state/agent-logs/network-usage-feasibility-check.log. 코드/실제 수집 변경은 없으며 이 검사는 새 공급자 접근 성공을 뜻하지 않는다.
