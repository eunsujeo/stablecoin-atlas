# 저장된 Allium 가격 필드 계약
- 목표: 인계문의 다음 행동인 가격3종 오프라인 파서·비공개 검토보고서를 구현한다.
- 끝난 것: 고정 ADR0083 receipt pin·plan/요청/body/source hash·바이트 수를 결합했다. 숫자 lexeme·원래 시각을 보존하고 자산/decimals·UTC/기간·전체 OHLC/통계 필드·누락/null/오류/변조를 검사한다. 실제 저장본3종 FIELD_CONTRACT_OBSERVED를 비공개 .state/provider-price-review/20261024-field-contract.json에 생성하고 재독 대조했다. 통화/완전성/변화율 단위/창 정의 UNKNOWN·비용UNCONFIRMED·기존 원문/판정/시각 유지. API·키·DB/UI·새 소비 없음. 이력의 반개구간은 로컬 검토 정책이며 공급자 끝점 규칙 인증이 아니다. SOURCE_REVIEWED/제품PASS로 승격하지 않는다.
- 변경 파일: tools/provider-price-review.mjs, tests/provider-price-review.test.mjs, docs/research/provider-data-use-priorities-2026-10-24.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-24-offline-price-field-contract.md
- 검증: npm run check rc0 tests486/pass486/fail0/cancelled0/skipped0(.state/agent-logs/price-review-check.log). node --test tests/provider-price-review.test.mjs rc0 tests6/pass6/fail0/cancelled0/skipped0(.state/agent-logs/price-review-targeted.log). 실제 오프라인 CLI rc0·3/3관측·receipt/source hash 재확인·보고서0600 대조 rc0. git diff --check rc0.
- 기다리는 것: 없음 — 검사/실제 저장본 검토 모두 회수. Lead/추가 Agent 없음. 기존 UI는 상시 서비스. 기존 미추적 docs/handoff/2026-10-22-router-lead-review.md 유지.
- 다음 행동: 저장된 Arkham 시장/가격 이력의 hash결합 필드 관측을 오프라인에서 진행한다. 기존 receipt의 해당 두 응답만 읽고 숫자 lexeme·자산 식별·원래 시각·기간·누락을 확인하여 비공개 관측 보고서로 보존한다. 전체 코인 circulatingSupply/totalSupply와 체인별 공급량을 구분하고 가격 통화/이력 완전성/공급자 정의의 미확인은 유지한다. 새 API/키/재시도/DB/UI/기본 공급자 전환은 하지 않는다.
- 사용자 확인 필요: 아니오 — 승인된 성공 자료의 오프라인 활용만 진행한다. 새 실제수집/비용/DB/UI 전환은 별도 확인한다.
- 읽을 파일: docs/research/provider-data-use-priorities-2026-10-24.md, tools/provider-price-review.mjs, tools/provider-capability-plan.mjs, docs/DEVELOPMENT_STATUS.md
