# Arkham 활용 지표 단발 검사 인계

- 사용자 고정 승인2GET을 완료·소비했다. 재실행/재시도/추가페이지/다른 endpoint로 이어가지 않는다.
- 정본: [검사 범위·수행 경로·실제 결과](../research/2026-10-27-arkham-usage-probe.md).
- 결과: 전송 histogram1개와 Uniswap 관련 swaps1건 모두 HTTP200, 실제2HTTP/0run/1986bytes. 이전 전체 근거 manifest 동일, 비용 UNCONFIRMED, DB/UI/Collector/FX/운영 Mac mini 변경0.
- 전송 집계: Ethereum USDC 지정 시각 범위의 count534441. 트랜잭션 수나 결제 건수가 아니다. swaps는 체인/USDC/기간/Uniswap entity/valid 조건이 맞는1건만 확인했다. count10000을 정확한 전체 건수로 사용하지 않는다.
- 파일: tools/arkham-usage-probe.mjs, data/arkham-usage-probe-plan.json, tests/arkham-usage-probe.test.mjs. 웹/서버/Collector와 연결하지 않은 수동 전용 경로다.
- 비공개 원본: .state/allium-executor/arkham-usage-once-20261027-v1 및 .state/arkham-usage-verification-20261027. 키/전체 URL/원문을 Git/웹에 게시하지 않는다.
- 실패/수정: macOS 임시경로 realpath 정규화로 기존 보안규칙을 유지했다. Lead c1beb6f2ddbc4fd2a4d4f1a852a8e7b4의 부분 수신 원문 보존 조건을 구현·오류/timeout 시험으로 검증했다. private 소스 경로 검토 요청의 preparation_failed와 첫 시험 로그도 보존했다.
- 검증: 대상10개 통과, npm run check 701개 통과/실패0. 위 비공개 경로의 test-final.log와 check.log를 따른다. 가상 시험은 실제 반환값의 정확성을 인증하지 않는다.
- 재현: 기존 receipt/원문/검토와 고정 plan을 오프라인으로 비교한다. node --test tests/arkham-usage-probe.test.mjs는 새 소유 가상 Fixture만 쓴다. CLI를 다시 실행하여 실제 조회를 재현하지 않는다.
- 다음 범위는 미승인: 자동수집/DB/UI 연결, 전체 DEX 집계, 다른 날짜/체인, 결제/활성주소 조사. 사용자 요청이 있으면 이번 단발 결과와 구분해 계획을 정한다.
- 기존 무관한 docs/handoff/2026-10-22-router-lead-review.md는 건드리지 않았다.
