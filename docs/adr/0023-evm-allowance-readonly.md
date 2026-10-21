# ADR 0023: EVM allowance getter의 명시적 읽기 확장

상태: 채택, 2026-10-20.

현재 서비스 runner의 EVM allowance는 미구현이다. 승인 설정/사용/철회와 현재 pair의 승인량 응답을 구분해, 읽기 전용 getter 경로를 명시적으로 추가한다.

EVM 전용 optional spenderAddress와 ERC20-011 v1.0.0 getter 시나리오를 추가한다. pair는 첫 RPC 전에 검증하고 fixture actors와 혼합하지 않는다. 기존 holder-only·Fixture·공통 도메인·기본 제품 CLI는 유지한다. 정확한32byte uint256과 bigint/십진 문자열만 수용하고 실패는0으로 바꾸지 않는다. 성공도 support UNKNOWN이며 행위 시나리오의 NOT_TESTED를 덮지 않는다.

연구 runner는 --evm-allowance/EVM ALLOWANCE 문맥에서만 연결하고 optional evmAllowanceRead:true를 raw/evidence/scenario/value/tag와 검증한다. 옵션이 없는 기존 NOT_IMPLEMENTED/0RPC와 필드 없는 과거 보고서 계약은 유지한다. 원본 입력·snapshot/namespace·bounded transport·원자 저장·root INCONCLUSIVE/UNKNOWN 경계도 그대로다.

새 사설 Anvil Fixture와 합성 HTTP로 검증하고 실제 외부 RPC/스테이블코인 거래는 수행하지 않는다. [상세 계약](../EVM_ALLOWANCE_READONLY.md)을 따른다.
