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
- 상태 변경은 자동 생성한 로컬 Anvil의 신규 Fixture에 한정. 외부 RPC는 읽기 전용.
- 단일 프로세스 CLI, 파일 JSON, 별도 서버·DB·AI 없음.
- 비표준 반환값의 원본을 유지하고 잔액·이벤트와 교차 확인.
- baseline은 fee와 zero-reset을 특성으로 처리. exact-receipt만 정확한 수취량을 요구.
- 미확인 관리자 통제와 proxy는 UNKNOWN/INCONCLUSIVE. 관측 실패를 기능 부재나 취약점으로 단정하지 않음.
- 시나리오 단위 snapshot/revert. asset 수준의 종합 안전 점수/취급 승인 없음.
- 생성 보고서는 reports/에 저장하고 Git에는 기본 포함하지 않음. 실행 요약은 docs/POC_RESULTS.md에 기록.
