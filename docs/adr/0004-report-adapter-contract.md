# ADR 0004 — 보고서 스키마와 읽기 전용 Adapter 계약

날짜: 2026-10-19. 상태: 채택.

## 문제

TypeScript 인터페이스만으로는 JSON 소비자의 호환성이나 EVM 코드 이동 후 실행 경계가 유지되는지 확인할 수 없다. Proxy 시나리오의 검사 범위가 늘어도 report 형식 버전과 시나리오 의미 버전을 구분해야 한다.

## 결정

Report 1.0과 Lab 1.0에 JSON Schema draft-07을 제공한다. 새 필드와 체인별 observations/evidence 확장을 허용하되 기존 필수 필드·core enum·금액 문자열 규칙을 고정한다. 스키마와 별도로 증거 참조·identity·집계의 일관성을 테스트한다. Ajv는 개발 의존성으로만 사용하며 런타임 네트워크나 CLI 옵션은 추가하지 않는다.

공통 ReadOnlyAdapter에는 networkId/assetAddress/accountAddress 요청과 AssessmentReport 응답만 둔다. EVM 실행을 src/evm/assessment.ts로 이동하고 기존 src/assessment.ts 함수 입력을 보존한다. 요청마다 RPC 증거 공간을 분리한다. 상태 변경 함수는 공통 인터페이스에 추가하지 않는다.

## 검증 조건

기존 Fixture 시나리오와 JSON 결과가 호환되어야 한다. read-only harness에서 동시 요청의 보고서/증거 분리, 잘못된 네트워크·주소 거부, 오류 후 복구, 쓰기 RPC 부재 및 상태 무변경을 확인한다. 새 체인이나 운영 거래는 포함하지 않는다. 상세 규칙과 한계는 [보고서 계약](../REPORT_CONTRACT.md)에 기록한다.

## 근거

- [JSON Schema draft-07](https://json-schema.org/draft-07): 독립적인 데이터 형식 정의.
- [Ajv JSON Schema 지원](https://ajv.js.org/json-schema.html): 이 계약에 필요한 기본 draft-07 검증 지원.

## 검토

Lead bridge 요청 `666109d3a6c94748988db15f9d7f8c93`의 `proceed` 응답을 회수했다. 기존 함수/Adapter JSON 동등성(UUID·시각만 정규화), 선택 계정·잘못된 입력·RPC 오류, 동시 요청 증거 분리, 읽기 전용 RPC 관측 및 전체 검증을 완료 조건으로 적용한다. 이는 표적 소스 검토이며 배포나 자산 취급 승인이 아니다. Fixture 실행은 공유 Rpc의 증거 초기화와 snapshot/revert 때문에 순차 실행을 유지한다.
