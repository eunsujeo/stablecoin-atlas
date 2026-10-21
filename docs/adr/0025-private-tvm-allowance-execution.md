# ADR 0025: 승인 결함 프로브의 별도 사설 TVM 실행 경로

상태: 채택, 2026-10-20.

ADR0024의 합성 증거 검증만으로 실제 배포 코드·거래·격리 환경을 관측했다고 할 수 없다. 별도 고정 compiler allowlist를 신규 소유 사설 runtime에 연결하고, 기존 transfer용 enum·CLI·v1 보고서 계약은 유지한다.

`tvm:allowance-negative`는 정상 approve와 transferFrom 대조를 먼저 실행하고 두 함수의 단일 결함8종을 순서대로 실행한다. 각 항목은 별도 신규 runtime이며 run/container/network ID 중복을 거부한다. transferFrom은 같은 Fixture에서 정상 approve(amount+7)의 반환·Approval·상태를 먼저 검증한 후 새 baseline에서 실행한다. 오류·중단·정리 실패가 있으면 이후 항목은 NOT_TESTED다. 호출별 broadcast는 한 번이며 공개망 쓰기·추가 키 입력을 허용하지 않는다.

순수 검증기의 역할과 runtime 소유권 근거를 분리한다. 새 보고서는 컴파일·실제 runtime code hash, 역할과 금액, 원시 receipt·포함 거래·protobuf binding·호출 전후 상태, 관측 판정, 격리·정리 결과를 보존한다. 별도 allowance v1 JSON Schema와 의미 검증기가 proof를 재검증하고 setup→target baseline을 대조한다. 기존 TVM v1 schema를 확장하지 않는다. getter 응답의 정확한 블록은 UNKNOWN이며, 저장한 단일 포함 거래 투영은 전체 블록의 암호학적 검증을 뜻하지 않는다.

await 이후에도 전송 직전·응답 직후 active/abort/deadline을 재확인해 지연된 검사 뒤 거래를 보내지 않는다. 반환 보고서는 복제해 늦은 worker가 수정하지 못하게 한다. 기존120초 실행 한도와 finally 소유 자원 정리는 유지한다. 새 allowance 모드에서만 실제 fixture 요청 횟수와 operation별 횟수를 기록한다.

[실행 및 결과](../TRON_ALLOWANCE_PROBE_EXECUTION.md). Fixture FAIL은 의도한 기능 기대 위반이며, 이를 정확히 식별한 검증기의 성공과 구분한다. 실제 USDT·서비스 계정·발행사 권한·금융 취급 검증으로 변환하지 않는다.
