# 결정 기록

- [ADR 0001: 스택 비교와 선정](adr/0001-stack.md)
- [ADR 0002: Proxy 관측과 권한 검증 분리](adr/0002-proxy-observation.md)
- [ADR 0003: ZeppelinOS 저장 슬롯 관측](adr/0003-legacy-proxy-slots.md)
- [ADR 0004: 보고서와 읽기 전용 Adapter 계약](adr/0004-report-adapter-contract.md)
- [ADR 0005: RPC 오류 진단의 비밀정보 기록 방지](adr/0005-rpc-error-diagnostics.md)
- [ADR 0006: 보고서 파일의 완성 후 교체](adr/0006-atomic-report-output.md)
- [ADR 0007: 관측 블록 참조 검증](adr/0007-block-reference-validation.md)
- [ADR 0008: 0 전송의 개별 시나리오](adr/0008-zero-transfer-scenario.md)
- [ADR 0009: 승인 후 0 transferFrom](adr/0009-zero-transfer-from-scenario.md)
- [ADR 0010: 승인 철회와 후속 spender 거부](adr/0010-allowance-revocation.md)
- [ADR 0011: TRON TRC-20 읽기 전용 Adapter](adr/0011-tron-readonly-adapter.md)
- 상태 변경은 자동 생성한 로컬 Anvil 또는 사용자 승인 후 소유·격리가 검증된 신규 사설 TVM Fixture에 한정. 외부 RPC는 읽기 전용.
- 단일 프로세스 CLI, 파일 JSON, 별도 서버·DB·AI 없음.
- 비표준 반환값의 원본을 유지하고 잔액·이벤트와 교차 확인.
- baseline은 fee와 zero-reset을 특성으로 처리. exact-receipt만 정확한 수취량을 요구.
- 미확인 관리자 통제와 proxy는 UNKNOWN/INCONCLUSIVE. 관측 실패를 기능 부재나 취약점으로 단정하지 않음.
- 시나리오 단위 snapshot/revert. asset 수준의 종합 안전 점수/취급 승인 없음.
- 생성 보고서는 reports/에 저장하고 Git에는 기본 포함하지 않음. 실행 요약은 docs/POC_RESULTS.md에 기록.

- [ADR 0012: TRON 승인량 읽기 전용 조회](adr/0012-tron-allowance-readonly.md)

- [ADR 0013: 사설 TVM Fixture 준비안 — 후속 제한적 실행 승인](adr/0013-private-tvm-fixture-preparation.md)

- [ADR 0014: ARM64 사설 TVM 기동·격리·정리 실행기](adr/0014-private-tvm-runtime-smoke.md)

- [ADR 0015: 사설 TVM 정상 Fixture 배포·영수증·초기 상태](adr/0015-private-tvm-fixture-deployment.md)

- [ADR 0016: 사설 TVM 정상 토큰 전송·승인·이벤트·미승인 REVERT](adr/0016-private-tvm-token-scenarios.md)

- [ADR 0017: 사설 TVM 정상 Fixture의 0 금액·잔액/승인량 경계](adr/0017-private-tvm-boundary-scenarios.md)

- [ADR 0018: 사설 TVM 결함 transfer Fixture와 검증기 대조](adr/0018-private-tvm-negative-fixtures.md)

- [ADR 0019: 사설 TVM 보고서 v1 형식·증거 일관성](adr/0019-private-tvm-report-contract.md)
