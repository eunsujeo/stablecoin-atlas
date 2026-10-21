# ADR 0016: 신규 사설 TVM 정상 토큰 실행

상태: 채택 (2026-10-20). [ADR 0015](0015-private-tvm-fixture-deployment.md)의 배포·코드·초기 상태 검증을 유지하고 선택적 `npm run tvm:exercise`를 추가한다. 외부 RPC/운영 키 입력은 없으며 정상 Fixture 하나를 새 소유·격리 환경에서 실행한 뒤 폐기한다.

동일 실행에서 생성한 owner/recipient/spender 3계정을 서로 다르게 고정한다. transfer, 유한 approve, 같은 spender의 transferFrom으로 승인량 전부 소진, 재승인, approve(0) 철회, 철회 후 같은 spender의 양수 transferFrom 순서로 실행한다. 전송량은 2^64+123, 승인량은 2^63+111로 Number 안전 범위를 넘는다. 금액·잔액·승인량은 bigint/십진 문자열이다. 각 단계의 직전 표본을 baseline으로 사용하고 owner/recipient/spender 잔액·totalSupply·owner→spender allowance를 비교한다. 승인 시 잔액/supply 불변, transferFrom 시 승인량 차감과 spender 자체 잔액 불변, REVERT 시 모든 표본 토큰 상태 불변을 요구한다. 실패 거래의 native 자원/잔액은 불변 대상으로 삼지 않는다.

배포 validator를 완화하지 않고 TriggerSmartContract 전용 validator를 추가한다. 정확히 하나의 contract/type_url, 알려진 키, 허용된 signer, 이미 배포·코드 확인한 주소, 로컬 ABI calldata, 무TRX/무TRC-10 자금, 기본 permission, 고정 fee, TAPOS, protobuf/raw hex/txID를 검사한다. 서명 전과 전파 직전 현재 시각으로 만료를 재검증한다. 기존 runtime의 abort·소유권·격리 검사와 단일 broadcasthex·timeout 후 자동 재전파/재서명 금지를 유지한다.

거래 생성은 고정 `/wallet/triggersmartcontract` operation으로 수행한다. 이 TRE에서 `call_value`를 문자열 `"0"`으로 보내면 OTHER_ERROR로 거부됐다. 기본값 0을 사용하도록 필드를 생략하며 반환 거래에서도 값이 없거나 정확히 0인지 검증한다. 금액을 JSON Number로 바꾸지 않는다. [공식 호출 API](https://developers.tron.network/reference/triggersmartcontract)와 [java-tron 4.8.2 servlet](https://github.com/tronprotocol/java-tron/blob/GreatVoyage-v4.8.2/framework/src/main/java/org/tron/core/services/http/TriggerSmartContractServlet.java)을 참고했다. 배포/기존 읽기 경로는 유지한다.

성공은 receipt SUCCESS, 블록 내 실제 Trigger owner/contract/calldata·raw protobuf 해시, full block ID/높이와 포함 거래, canonical ABI bool true, 정확한 상태 변화와 로그가 모두 일치할 때 기록한다. [TRON 이벤트 형식](https://developers.tron.network/docs/event)에 따라 emitter는 41 prefix 없는 20byte, topics는 정확한 서명/패딩/주소/개수, data는 uint256 전체를 검사한다. transfer/transferFrom은 Transfer 하나, approve는 Approval 하나를 기대하며 중복/예상 밖 로그를 거부한다. 보고서에는 검증한 calldata·블록 연결·실제 로그와 전후 표본을 보존한다.

미승인 검증은 같은 spender의 성공 transferFrom을 양성 대조로 확보하고 allowance=0, 충분한 토큰/사설 자금을 확인한 후 수행한다. 채굴 receipt와 block ret가 모두 REVERT이고 committed 로그가 없으며 표본 토큰 상태가 유지돼야 한다. broadcast 거부/timeout/OUT_OF_ENERGY를 미승인 거부 성공으로 기록하지 않는다.

별도 `TRON_PRIVATE_TVM_TOKEN_SCENARIOS` envelope의 각 항목은 관측 완료 OBSERVED, 시도 중 오류 ERROR, 미실행 NOT_TESTED로 구분한다. getter 응답 블록은 UNKNOWN이다. AssessmentReport 스키마·읽기 전용 지원/판정은 승격하지 않는다. 이 정상 Fixture 결과는 Mainnet, 최종성, 자산 안전성이나 일반 토큰 호환성을 보증하지 않는다. 비표준/실패 Fixture, 0 전송 등 경계 시나리오와 자원 한도 평가는 별도 후속 작업이다.
