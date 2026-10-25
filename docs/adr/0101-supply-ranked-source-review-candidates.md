# ADR0101: 공급량 기준 상위 네트워크 소스 검토 대상

일자: 2026-10-25. 상태: 대상 선정 및 사용자 승인 추가18곳 자료/소스 검토 완료. 확인 수준은 개별 결과를 따른다.

## 결정

사용자 요청에 따라 USDC/USDT/RLUSD 자산별 최대10곳을 token 유통공급량으로 선정한다. 기존 저장 상세 시계열/receipt의 고정 UTC일자·hash·원래 REQUEST 시각을 사용하고 현재 순위라고 부르지 않는다. catalogue USD가치·minted·누락/0·다른 날짜를 섞지 않는다. 네트워크 집계와 개별 native/bridge 토큰 소스 검토를 분리한다. 미기재나 취득 실패를 기능 부재로 확정하지 않는다.

원문 숫자를 문자열로 파싱하고 bigint로 비교한다. 동률은 공급자 network key 순서다. 양수만 최대10곳으로 선정하고0개 네트워크를 임의로 채우지 않는다. 누락/중복/비정상 수량은 사유와 PARTIAL로 보존한다. 결과는 검토 후보이며 활성 등록·Adapter·검토 완료·SOURCE_REVIEWED/PASS가 아니다.

Solana/SPL·XRPL issuer·Stellar asset·TON Jetton·Aptos FA/Move·HyperCore·Arc 시스템 자산은 EVM 함수로 강제하지 않는다. 기존 소스 기록/설정 관측/새 입력 필요를 구분하며 새 SDK·Adapter·RPC·실제 권한 행사를 추가하지 않는다. 현재 DB·수집/예약·제품 UI는 변경하지 않는다.

## 외부 취득 경계

최초 승인 전 단계에서는 고정8대상/메서드/필드/예산/소비 슬롯·실패 종료 조건을 [계획 JSON](../../data/source-review-top10-intake-plan.json)에 고정했다. 이 원래 계획의 제안 당시 상태는 덮어쓰지 않는다. 이후 사용자가 추가18곳 모두 진행을 승인했다. 아래 후속 결정과 실행 기록이 실제 승인/소비 상태다. compiler 취득/실행·verify 제출·proxy-resolution/새 RPC·자동 fallback은 포함하지 않는다. 자료가 proxy만이면 토큰 기능 확인으로 승격하지 않는다.

[선정·확인·실패·검증 기록](../research/2026-10-25-top10-source-review-candidates.md)이 정본이며 원래 승인/소비/UNKNOWN/NOT_TESTED와 source scope를 보존한다.

## 추가18곳 승인 후 결정

사용자의 “모두 승인…총18곳 모두 진행”에 따라 해당18곳에 필요한 공개 소스/공식 문서와 고정된 생성자 초기 구현 후보를 passive GET으로 취득한다. 매 단계 대상을 새 계획 pin으로 고정하고 새 소유 슬롯의 송신 전 intent/원문/receipt와 소비를 남긴다. 요청별4MiB/20초·재시도/redirect/자동 fallback0, managed proxy를 유지한다. 원래 실패/미송신 슬롯을 재개하지 않고, 경로/필드 오류의 수정은 별도 고정 계획/소비로 구분한다. 현재 구현을 알아내기 위한 storage RPC나 proxy-resolution으로 확대하지 않는다.

토큰 구현 후보/프록시/공통 프로토콜/참조 구현/브리지 component/문서만을 구분한다. 생성자 연결은 초기 구현 후보이지 현재 구현 인증이 아니다. non-EVM은 체인 고유 의미를 유지하고 미확보를 기능 부재로 바꾸지 않는다. 공개 sourceUnit 이름을 파일 경로로 사용하지 않고 원문은 고정 `.bin`에만 저장한다. 연구 결과는 별도 JSON/문서이며 제품UI/DB/판정을 변경하지 않는다.

[추가18곳 결과·실패/수정·재현](../research/2026-10-25-top10-source-review-results.md)과 [구조화 결과](../../data/source-review-top10-results.json)가 후속 정본이다.53GET 소비 완료·새 RPC/compiler/키/DB/UI0이며 자동 재실행하지 않는다.
