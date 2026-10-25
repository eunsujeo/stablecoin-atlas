# 공급량 상위 추가18곳 소스 검토
- 목표: USDC10/USDT10/RLUSD2 중 기존4곳 외 추가18곳 모두의 소스·기능 조건을 검토한다.
- 끝난 것: 사용자 전체 승인으로53GET/2034185bytes 취득 종료(20045·4047·4001). 추가18곳: 토큰 로직6·프록시만4·프로토콜/참조/브리지7·공식 문서1. 초기 구현 후보/현재 구현, 공통 capability/자산 설정을 구분했다. B의 정상 Tether 문서 challenge 오검출은 원본 실패를 보존하고 저장본문 재검토/검출기 수정. C의 Sourcify nested selector400은 새C2에서 수정. XRPL 이동 경로는 새R에서 확보. 새 RPC/compiler/키/DB/UI0, 기존 판정 보존. 각 기능 조건/범위/미확보·hash는 결과 JSON/연구 문서에 기록했다.
- 변경 파일: AGENTS.md, data/source-review-top10-{remaining,constructor,constructor-corrected,initial-logic,xrpl-path}-plan.json, data/source-review-top10-results.json, tools/research/{top10-source-intake,source-constructor-link,verify-top10-source-archive}.mjs, tests/{top10-source-intake,source-constructor-link}.test.mjs, docs/adr/0101-supply-ranked-source-review-candidates.md, docs/DEVELOPMENT_STATUS.md, docs/research/2026-10-25-top10-source-review-{candidates,results}.md, 이 인계문
- 검증: node tools/research/verify-top10-source-archive.mjs rc0/PASS(18case/53raw hash/추가요청0). node --test tests/source-constructor-link.test.mjs tests/top10-source-intake.test.mjs rc0 tests18/pass18/fail0/cancelled0/skipped0. npm run check rc0 tests590/pass590/fail0/cancelled0/skipped0. 세mjs node --check rc0. git diff --check rc0. 로그 .state/agent-logs/top10-source-final-{check,boundaries}.log.
- 기다리는 것: 없음
- 다음 행동: 연구 결과의 추가18곳을 기존 자산 프로필에 반영할 화면 범위를 사용자 요청과 대조한다. 이번 수집/연구는 완료됐으므로 소비된A/B/C/C2/R/D를 재실행하지 않는다. 새 외부 조회/실행을 자동 생성하지 않는다.
- 사용자 확인 필요: 예 — 현재 단계는 연구 JSON/문서만 추가했다. 웹에 반영할 범위 선택은 다음 구체 요청으로 확인한다.
- 읽을 파일: docs/research/2026-10-25-top10-source-review-results.md, data/source-review-top10-results.json, docs/adr/0101-supply-ranked-source-review-candidates.md

원문은 .state/top10-source-intake-20261025-{a,b}, .state/top10-source-links-20261025-{c,c2}, .state/top10-source-xrpl-20261025-r, .state/top10-source-initial-logic-20261025-d에만 보존. 계획 pin/소비/원래 시각은 결과 runs 참조. 다른 PC의 원문 미확보를 새 요청으로 보충하지 않는다. Lead3건 응답 회수/반영 완료. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md 보존. 커밋/push 뒤 자동 새 대화 예약을 시도한다.
