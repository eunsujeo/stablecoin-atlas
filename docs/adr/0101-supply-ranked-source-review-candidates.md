# ADR0101: 공급량 기준 상위 네트워크 소스 검토 대상

일자: 2026-10-25. 상태: 오프라인 대상 선정 구현, 새 소스API 실행은 사용자 승인 필요.

## 결정

사용자 요청에 따라 USDC/USDT/RLUSD 자산별 최대10곳을 token 유통공급량으로 선정한다. 기존 저장 상세 시계열/receipt의 고정 UTC일자·hash·원래 REQUEST 시각을 사용하고 현재 순위라고 부르지 않는다. catalogue USD가치·minted·누락/0·다른 날짜를 섞지 않는다. 네트워크 집계와 개별 native/bridge 토큰 소스 검토를 분리한다. 미기재나 취득 실패를 기능 부재로 확정하지 않는다.

원문 숫자를 문자열로 파싱하고 bigint로 비교한다. 동률은 공급자 network key 순서다. 양수만 최대10곳으로 선정하고0개 네트워크를 임의로 채우지 않는다. 누락/중복/비정상 수량은 사유와 PARTIAL로 보존한다. 결과는 검토 후보이며 활성 등록·Adapter·검토 완료·SOURCE_REVIEWED/PASS가 아니다.

Solana/SPL·XRPL issuer·Stellar asset·TON Jetton·Aptos FA/Move·HyperCore·Arc 시스템 자산은 EVM 함수로 강제하지 않는다. 기존 소스 기록/설정 관측/새 입력 필요를 구분하며 새 SDK·Adapter·RPC·실제 권한 행사를 추가하지 않는다. 현재 DB·수집/예약·제품 UI는 변경하지 않는다.

## 외부 취득 경계

신규 소스API는 아직 미실행이다. 고정8대상/메서드/필드/예산/소비 슬롯·실패 종료 조건을 [계획 JSON](../../data/source-review-top10-intake-plan.json)에 고정했다. 사용자 최초 지침에 따라 명시 승인 후에만 시작한다. compiler 취득/실행·verify 제출·proxy-resolution/새 RPC·추가 주소 탐색·자동 fallback은 포함하지 않는다. 자료가 proxy만이면 토큰 기능 확인으로 승격하지 않는다.

[선정·확인·실패·검증 기록](../research/2026-10-25-top10-source-review-candidates.md)이 정본이며 원래 승인/소비/UNKNOWN/NOT_TESTED와 source scope를 보존한다.
