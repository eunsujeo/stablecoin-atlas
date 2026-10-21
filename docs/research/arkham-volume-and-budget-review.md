# Arkham 거래량·수집 예산 재확인

조사일: 2026-10-22 KST. 공개 공식 문서만 조회했다. 인증 API·usage·시장 수집은 실행하지 않았다.

## 확인 결과

[공식 문서 목록](https://arkm.com/llms.txt)은 열람 가능하며 market, rate limits, credit pricing, subscription usage 상세 문서를 안내한다. 목록의 엔드포인트 존재·제목만으로 필드 의미나 계정 계약을 확인할 수는 없다.

아래 네 문서는 웹 도구로 본문을 읽지 못했다. 환경의 기본 프록시 설정을 따르는 Python urllib로 오류를 진단한 결과 모두 `HTTP 403 Forbidden`, `Server: cloudflare`, `Content-Type: text/html; charset=UTF-8`와 Cloudflare의 `Attention Required!` 페이지를 반환했다. `X-Squid-Error`는 없었다. 관측된 응답은 원본 측 Cloudflare 거부이며 관리형 프록시 정책 차단으로 판정하지 않았다. 우회나 반복 재시도는 하지 않았다.

| 공식 문서 | 확인하려던 조건 | 결과 |
| --- | --- | --- |
| [Token market](https://arkm.com/llms/get-token-market-id.md) | `totalVolume` 기간·단위·집계 범위 | 미확인 |
| [Rate limits](https://arkm.com/llms/guides/rate-limits.md) | 계정별 요청률·제한 적용 방식 | 미확인 |
| [Credit pricing](https://arkm.com/llms/guides/credit-pricing.md) | 요청별 크레딧·과금 기준 | 미확인 |
| [Subscription usage](https://arkm.com/llms/get-subscription-intel-usage.md) | 잔여량·기간·리셋 의미 | 미확인 |

[OpenAPI](https://arkm.com/openapi.json)와 [통합 문서](https://arkm.com/llms-full.txt)도 웹 도구에서 접근 불가였다. 이 두 경로의 HTTP 상태는 별도 확인하지 않았으며403으로 확대 기록하지 않는다.

## 후속 조건

거래량 처리 기준은 [ADR0038](../adr/0038-overview-scenario-results.md), 수동 수집 경계와 과거 usage 관측은 [ADR0037](../adr/0037-manual-market-collector.md)을 유지한다. 이번 문서 조회는 새 시장 관측이나 계정 잔여량 확인이 아니다.

거래량 연결에는 해당 응답 필드의 기간·단위·대상 거래 범위를 명시한 공식 본문이 필요하다. 수집 주기 설계에는 해당 계정의 적용 한도·기간·잔여량·요청별 비용·rate 조건을 별도로 확인해야 한다. 공식 자료 확보 후 정의와 저장값의 대응을 검토하며, 문서 제목이나 `totalLimit`만으로 값을 추정하지 않는다.

## 환경 확인

현재 PC의 `npm run doctor`는 종료 코드0, Node25.2.1, UI 준비 완료와 저장 근거·시장 자료 존재를 보고했다. 외부 RPC/API 호출은 없었다. 물리적으로 다른 PC에는 접근하지 않았으며 다른 PC/OS 재현 검증은 미실행이다. 절차는 [새 PC 안내](../NEW_PC_SETUP.md)를 따른다.
