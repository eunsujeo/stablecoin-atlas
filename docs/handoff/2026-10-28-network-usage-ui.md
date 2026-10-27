# 네트워크 활동 지표 UI 인계

- 사용자 UI 추가 요청에 따라 [ADR0116](../adr/0116-network-usage-metrics.md)을 구현했다. [수행·의미·실패/수정·검증 기록](../research/2026-10-28-network-usage-ui.md)을 따른다.
- 전체 현황에서 기존 토큰 전송량과 USD 전송금액·전송 건수·전송 포함 트랜잭션 수를 선택한다. 같은 자산/집계일의 네트워크 비교표에 금액·두 건수·이벤트당 평균 USD를 제공한다.
- 평균은 bigint와2자리 절사이며0/누락/분모0·양의0.01미만을 구분한다. 평균을 합산/비중화하지 않고 도넛의 관측/숨김 범위를 표시한다. 시간대 UNKNOWN·source 시각/숫자와 누락을 보존한다.
- 활성 주소/중앙값/전체DEX/결제는 미확보. 사람·고래·안전성을 새로 판정하지 않는다. 실제 Arkham 조회를 재실행하지 않는다.
- 새 API/키·DB 연결/쓰기/스키마·Collector/FX·운영 Mac mini 변경0. 기존 브라우저 캐시/요청/보안 경로는 유지했다.
- 대상18시험 통과. Chrome 1440/390 두테마·Safari API부재 조건 모사와 오프라인 production/FX 회귀 모두 통과, 추가 JSON/외부 요청/JS오류0. 실제 iPhone/WebKit 검증은 아니다.
- 전체 검사: npm run check 703개 통과/실패0(rc0). 로그 .state/agent-logs/network-usage-check.log.
- 재현: node --test web/supply-overview.test.mjs web/market-chart.test.mjs, node tools/network-usage-browser-check.mjs, node tools/production-browser-check.mjs --fx-isolation --safari-streams, npm run check. 가상 자료/새 소유 loopback만 사용한다.
- 기존 무관한 docs/handoff/2026-10-22-router-lead-review.md는 변경/커밋하지 않는다. 완료 후 별도commit/push하며 운영 배포는 하지 않는다.
