# ADR 0008 — 0 금액 전송의 개별 시나리오

날짜: 2026-10-19. 상태: 채택.

## 문제와 근거

기존 전송 검사는 10000 base unit을 사용한다. 이 성공만으로 0 금액의 처리나 이벤트를 확인할 수 없다. [ERC-20 명세](https://eips.ethereum.org/EIPS/eip-20)의 transfer 및 Transfer 이벤트 규정은 0 전송도 일반 전송으로 취급하고 이벤트를 발생시키도록 한다.

## 결정

ERC20-008 v1.0.0 / TRANSFER를 새 시나리오로 추가한다. 기존 검사의 금액이나 판정 의미는 바꾸지 않는다. 사설 Anvil의 새 Fixture에서 owner가 recipient에게 0n을 전송한다. 별도 snapshot에서 샘플 계정 잔액과 총공급량을 전후 조회하고, 사전 호출 반환 분류·채굴 영수증·해당 계약의 Transfer(from,to,0) 이벤트를 기록한다.

PASS 조건은 receipt 성공, 사전 TRUE/EMPTY, 일치하는 이벤트, 두 잔액 및 관측 총공급량 무변경이다. FALSE/MALFORMED, 관측된 revert/receipt 실패, 이벤트 누락/불일치, 샘플 상태 불일치는 해당 시나리오 FAIL이다. RPC/조회/디코딩 장애로 조건을 확인하지 못하면 기존 orchestration에 따라 INCONCLUSIVE/ERROR다. 실패만으로 NOT_SUPPORTED를 선언하지 않는다.

EMPTY는 기존 호환성 정책에 따라 다른 관측 조건으로 보완할 때만 허용한다. 이는 bool ABI 준수나 채굴 거래의 실제 반환 데이터를 직접 확인한 결과가 아니다. 0 상태 무변경만으로 성공을 만들지 않는다. 전체 자산 승인, 모든 계정/입력의 무변경, 수수료 부재, transferFrom의 0 처리나 재조직/최종성은 이 검사로 확인하지 않는다.

## Fixture와 경계

기본 7종 Fixture 집합은 유지한다. 추가 부정 Fixture는 0 거부, 0 이벤트 누락, 0 이벤트를 내면서 1 unit을 이동하는 동작을 독립적으로 재현한다. 운영 자산·외부 RPC에서 transfer/approve를 실행하지 않는다. 읽기 전용 결과의 ERC20-008은 NOT_TESTED/NOT_EXECUTED/UNKNOWN이다. 실패 Fixture의 보고서 FAIL과 자동 테스트 실패를 구분한다.

## 호환성

Report/Lab schemaVersion 1.0을 유지한다. 새 scenarioId와 그 증거가 추가되므로 결과 수/순서에 의존하지 않는다. 기본 로컬 결과는 77건이 되며 기존 70건의 의미는 유지한다. baseline 예상 PASS 52 / FAIL 5 / INCONCLUSIVE 20, exact-receipt 예상 49 / 8 / 20이다. 읽기 전용에서는 실행하지 않은 결과가 한 건 추가된다. 과거 Mainnet 보고서를 다시 실행한 것처럼 고치지 않는다.

## 검증 조건

Lead 요청 `1f4ab94a37df41ff91305475e86800a0`의 proceed 응답을 회수했다. 새 시나리오는 ERC20-000 뒤, 일반 양수 전송 앞에서 실행해 snapshot 복구 후 다음 검사에 영향이 없는지도 확인한다. 이 검토는 표적 소스·명세 검토이며 실제 테스트나 자산 승인 결과를 대신하지 않는다.

실제 private Anvil의 receipt status, raw/preflight 반환 분류, 0 이벤트 주소/금액, 샘플 잔액·supply, 잘못된 상태 변경 및 snapshot 복구를 확인한다. 일반 금액 성공과 0 거부를 분리하고 malformed/false/empty 반환도 확인한다. JSON의 requested는 Number 0이 아닌 문자열 "0"이다. 전체 회귀·CLI 종료 코드와 기본 보고서를 갱신한다.
