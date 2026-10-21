# ADR 0019: 사설 TVM 보고서 v1 구조와 증거 일관성

상태: 채택 (2026-10-20). 체인/네트워크, 실행 환경(EVM·TVM), 토큰 표준(ERC-20·TRC-20), 개별 컨트랙트와 시나리오는 다른 층위다. 이번 계약은 TRON TVM 사설 Fixture 실행 보고서를 위한 것으로 기존 EVM/AssessmentReport 계약을 변경하지 않는다.

새 출력은 `schemaVersion: "1.0"`과 kind로 runtime, deployment, 정상/경계 시나리오, transfer probe, negative suite를 구분한다. [JSON Schema](../../schemas/private-tvm-report.v1.schema.json)는 필수 구조·타입·enum·허용 필드를 닫힌 계약으로 정의한다. 이 v1에서 미정의 필드나 다른 버전을 자동 수용하지 않는다. 새 필드/시나리오 프로필을 도입할 때 계약 변경과 호환성을 명시적으로 검토한다. Ajv 8.20.0을 기존 개발 의존성에서 실행 의존성으로 이동했으며 새 라이브러리 버전을 추가하지 않았다.

`report-contract.ts`는 Schema 형상과 순수한 의미 검증을 분리한다. 금액/수수료/자원/높이는 canonical 비음수 십진 문자열이며 용도별 uint256/uint64 범위를 검사한다. decimals는 0..255 정수다. 동적 amount UNKNOWN은 NOT_TESTED에서만 허용하고, 실행 전 오류로 금액을 확인하지 못했으면 필드를 생략한다. getter 블록 UNKNOWN을 receipt 블록으로 대체하지 않는다.

READY/OBSERVED는 완료 시각, 고정 image/genesis, 증가한 head, peer/격리·무게시, 소유 자원 이름/ID, 정리 완료와 해당 kind의 증거를 요구한다. 배포 txID·receipt, 코드 일치, 초기 상태, actor/variant/build 선택, 시나리오 ID·순서·성공 단계, block 높이/full ID prefix, txID/rawDataSha256 요약, calldata/주소/금액, 이벤트/반환값, 전후 delta·사전조건·연속 baseline을 대조한다. 중복 evidence/runtime.fixture도 일치해야 한다. Negative suite는 정상 대조와 세 결함의 정확한 조합, 서로 다른 run/resource ID, Fixture PASS/FAIL과 validatorRegression/오류/반환 bytes/로그의 대응을 요구한다.

ERROR에는 성공 증거를 강제하지 않는다. 미생성 자원·부분 관측·FAILED/UNVERIFIED/RETAINED 정리를 보존하며, 미실행은 NOT_TESTED로 구분한다. 실제 관측된 잘못된 상태가 ERROR의 근거일 때 이를 정상 delta로 강제하지 않는다. 단, 이미 검증 완료로 주장한 증거의 타입/참조/의미 모순과 오류 이후 OBSERVED는 허용하지 않는다. 정리 실패가 있는 보고서는 성공으로 발행하지 않는다. 결함 Fixture의 기대 FAIL은 검증 실행 실패와 구분한다.

세 CLI는 finally 정리 후 확정된 JSON snapshot을 검증·직렬화한 뒤 stdout 또는 기존 원자적 파일 저장기로 공개한다. 불법 보고서는 고정 오류만 출력하고 기존 출력 파일을 보존한다. 계약상 유효한 ERROR는 계속 저장한 뒤 비0으로 종료한다. 의도한 결함이 검출되고 정리까지 완료된 negative suite는 종료 코드 0이다. 이 검사는 credential 탐지/삭제기의 대체가 아니며 생산 단계의 비밀/상위 원시 오류 배제 규칙을 유지한다.

버전 없는 기존 파일은 `tvm:validate --legacy`로 읽기 전용 검사한다. v1 버전이나 빠진 증거를 자동 삽입하지 않고, 별도 LEGACY 모드와 누락 필드를 반환한다. 일부 과거 보고서는 기록된 사전조건 등이 없어 완전한 요약 일관성 검사를 통과하지 못한다. 기존 파일과 해시는 유지한다. v1 파일을 legacy로 우회 검증하지 않는다.

저장된 자료가 요약인 부분은 요약 간 일관성만 검사한다. 전체 raw transaction/block/receipt를 새로 얻거나 재실행하지 않으므로 체인 재검증·서명/소스 진위 증명·Mainnet 검증·자산 안전성 승인이 아니다. 기존 보고서의 읽기 전용 검사와 명시적 합성 표본 mutation 테스트로 검증하며 이 단계에서는 새 TVM 거래를 실행하지 않았다.
