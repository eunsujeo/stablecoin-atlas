# ADR 0024: TRON 승인 결함 검증기의 실행 전 준비

상태: 채택, 2026-10-20.

기존 사설 TVM 결함 프로브는 transfer에 한정한다. 승인/위임 전송의 반환·이벤트·승인량 불일치를 검증하기 위해, 배포 경로를 확장하기 전에 별도 고정 Fixture와 순수 증거 검증기를 준비한다.

기존 transfer enum/소스/schema를 유지하고 별도9종 enum→TronAllowanceProbes.sol/contract allowlist 및 동일 compiler pin/settings를 사용한다. 정상1종과 두 함수별 false/malformed/missing-event/wrong-allowance의 단일 결함8종이다. 컴파일 선택 로직만 내부 공통 함수로 분리하고 임의 소스 입력은 허용하지 않는다.

순수 검증은 operation/역할/amount에서 계산한 calldata, 성공 receipt·block inclusion·raw protobuf hash와 독립 return/log/state 축을 확인한 뒤 정상 검증기의 정확한 거부를 대조한다. 승인량 불변 결함과 복합/실행 오류를 구분한다. 모든 throw는 ERROR이며 정상 결과의 기대 FAIL과 자동 테스트 성공은 별도다.

이번 단계는 합성 증거와 cache-pinned 컴파일 검증이다. 실제 TVM 실행·배포/서명/broadcast·v1 보고서·기존 CLI를 변경하지 않는다. runtime ownership과 자료 진위를 순수 함수가 인증한다고 주장하지 않으며 getter block UNKNOWN을 유지한다. 후속 실제 실행 연결은 별도 작업이다([상세](../TRON_ALLOWANCE_PROBE_PREPARATION.md)).
