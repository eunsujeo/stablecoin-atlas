# 보고서와 읽기 전용 Adapter 계약

현재 지원은 EVM/ERC-20과 TRON/TRC-20 읽기 전용이다. SOLANA 타입 값은 해당 체인 구현을 뜻하지 않는다.

## JSON 형식

- [AssessmentReport 스키마](../schemas/assessment-report.v1.schema.json): 단일 `assess` 출력.
- [LabReport 스키마](../schemas/lab-report.v1.schema.json): `lab` 출력. `assessments[].report`는 AssessmentReport를 참조한다.

두 스키마는 JSON Schema draft-07이며 로컬 Ajv에서 외부 요청 없이 컴파일한다. Ajv는 개발 의존성으로, 테스트에서 직렬화된 JSON을 검증한다. CLI 실행 중에 스키마 검증을 추가하지 않는다. 스키마 검증 성공은 데이터 형식의 호환성만 의미한다.

`schemaVersion`은 `1.0`을 유지한다. 기본 필드와 core enum은 고정하며, 필드 추가는 허용한다. `observations`, `evidence.data`는 확장 지점이다. Proxy pattern/probes 같은 체인별 상세 필드를 추가할 수 있다. 시나리오 ID 목록이나 결과 배열 길이·순서에 의존하지 않는다. 결과 키는 `(scenarioId, capability)`이고, 같은 `ERC20-007` ID의 PAUSE/BLACKLIST 결과를 구분한다. 증거 ID는 각 Assessment 안에서만 유효하다.

`scenarioVersion`은 개별 검사 의미의 버전이다. EVM-PROXY-001 `1.0.0`과 `1.1.0`은 모두 report `1.0` 형식으로 읽을 수 있지만 검사 범위는 다르다. 필수 필드 제거, 타입 변경, 새로운 core enum이나 계약 의미 변경은 명시적인 버전·마이그레이션 결정이 필요하다. 알 수 없는 schemaVersion을 `1.0`으로 처리하지 않는다.

ERC20-008/009/010 v1.0.0은 0 transfer, 승인 후 0 transferFrom, 승인 철회와 후속 거부 시나리오다. 현재 기본 lab은 자산당 13개 결과(7종 합계 91개)를 내며, 예전 10/11/12개 결과 보고서도 읽을 수 있다. 외부 read-only의 새 결과는 NOT_TESTED다. requested 0n은 JSON 문자열 "0"으로 보존한다. ERC20-009의 승인 전제 미충족은 INCONCLUSIVE이며 zeroTransferAttempted=false로 0 호출 미실행을 명시한다. ERC20-010은 revokeAttempted/probeAttempted로 단계를 구분하고 requested "1"은 후속 probe 금액이다. supplyBeforeNegative/supplyAfterNegative는 십진 문자열이다. 새 시나리오 추가를 전체 표준 준수 판정으로 해석하지 않는다.

금액은 bigint를 십진 문자열로 직렬화한다. 기존 정규화 관측 키(balance, allowance, supply 등)는 숫자나 지수 표기를 거부한다. decimals는 금액이 아닌 uint8 정수다. 변화량은 음수를 허용한다. 원시 JSON-RPC 증거의 hex 수량은 변환하지 않는다. 열린 `evidence.data` 및 새 observations 필드의 모든 금액 경로까지 스키마가 추론하지는 않으므로, Adapter의 직렬화와 해당 시나리오 테스트도 필요하다.

KNOWN/UNKNOWN/NOT_APPLICABLE은 별개 태그다. KNOWN은 value, 나머지는 reason을 가진다. 관측된 빈 name/symbol 문자열과 KNOWN decimals 0은 UNKNOWN이 아니다. 필드 값의 디코딩 성공은 발행사 인증이나 ERC-20 전체 적합성 판정과 구별한다.

EVM decimals는 디코딩 후 정수 0~255를 확인한다. 범위 밖 응답은 metadata INVALID_RESPONSE와 Identity UNKNOWN으로 기록하며 raw RPC word는 보존한다. 디코더의 성공만으로 uint8 유효성을 가정하지 않는다. 이는 모든 ABI의 canonical 검증이나 metadata 진위 보증과는 별개다([경계 검증](METADATA_BOUNDARY_RESULTS.md)).

## 레코드 간 일관성

JSON Schema 외의 계약 검증은 `tests/helpers/report-contract.ts`가 담당한다.

- 증거 ID와 `(scenarioId, capability)` 키의 유일성, 모든 evidenceReferences의 존재.
- 자식 결과의 assessmentId·assetIdentity와 부모의 일치.
- PASS/FAIL에 연결된 OBSERVED 증거, 실행 상태와 NOT_TESTED의 일치.
- capabilitySummary와 개별 결과의 일치, 시작·완료 시각 순서.

스키마 자체는 증거 참조의 무결성이나 실제 관측의 진실성을 증명하지 않는다. PASS는 개별 조건 관측이며 전체 자산 안전성·취급 승인이 아니다. support와 verdict는 독립적으로 해석한다.

새 RPC 오류 증거의 error는 숫자 code, 로컬 category/message 및 `upstreamDetailsOmitted: true`를 제공한다. 상위 message/data/임의 필드는 비밀정보 기록 방지를 위해 생략한다. `RPC_ERROR` kind는 전송/프로토콜 실패, `RPC` kind의 error는 정상 형식으로 받은 RPC 오류다. 후자의 category는 RPC_ERROR 또는 REVERT다. 성공 응답과 receipt/log는 원시 증거를 유지한다. 오류 원문이나 custom-error payload를 복원할 수 없으며 모든 보고서 내용에 대한 일반적인 비밀정보 제거 기능은 아니다. 상세 범위와 RpcError 변경은 [ADR 0005](adr/0005-rpc-error-diagnostics.md)에 기록한다.

새 EVM 보고서의 BLOCK_REFERENCE는 검증한 십진 number와 RPC가 반환한 32바이트 hash를 담는다. 높이와 헤더 번호의 일치 및 해시 형식만 확인한 증거다. 확인 전 RPC 증거의 블록은 UNKNOWN일 수 있으며, 확인 실패의 BLOCK_REFERENCE_ERROR도 UNKNOWN이다. 원시 헤더와 참조의 대응은 EVM 전용 테스트에서 검증한다. 이전 형식 보고서에 이 kind가 없다고 소급 실패시키지 않는다. 숫자 블록 태그를 계속 사용하므로 이 해시가 모든 후속 상태 조회에 사용됐거나 최종 확정됐다는 뜻은 아니다([ADR 0007](adr/0007-block-reference-validation.md)).

## Adapter 경계

`src/tron/adapter.ts`도 같은 ReadOnlyAdapter와 Report 1.0을 사용한다. TRON latest 상태 응답의 정확한 블록은 UNKNOWN이므로 조회/디코딩 성공을 observations에 보존하고 전체 판정은 INCONCLUSIVE다. head 전후 관측으로 PASS/FAIL의 블록 조건을 대체하거나 EVM 계약을 완화하지 않는다. holder 미지정 잔액과 owner/spender 미지정 승인량 및 거래·승인 실행·권한·자원 검사는 NOT_TESTED다([ADR 0011](adr/0011-tron-readonly-adapter.md)).

`src/domain/adapter.ts`의 ReadOnlyAdapter는 chainFamily와 `assessReadOnly({ networkId, assetAddress, accountAddress? })`만 정의한다. 전송·승인·서명이나 ERC-20 메서드를 공통 인터페이스에 넣지 않는다. 네트워크와 주소의 해석은 체인 Adapter가 맡는다.

`src/evm/adapter.ts`는 요청마다 독립된 RPC/증거 공간을 만든다. 기존 `src/assessment.ts`의 `assessReadOnly({ rpcUrl, networkId, token, holder? })`와 `assessFixture` 입력은 유지한다. EVM 시나리오 실행은 `src/evm/assessment.ts`에 둔다. Fixture 실행은 계속 프로그램이 만든 사설 Anvil의 신규 계약에 한정한다.

공통 테스트 helper는 요청별 독립 보고서·체인 식별·미실행 상태·잘못된 요청 거부·오류 후 복구를 검증한다. EVM harness는 사설 Anvil에 새 Fixture를 배포하고 읽기 메서드만 전달하는 HTTP 서버를 통해 동시 요청을 실행한다. 실제 RPC 목록과 블록·잔액·allowance 무변경을 확인한다. 공통 테스트는 ERC-20 함수명이나 특정 체인의 RPC 메서드를 강제하지 않는다. 이 테스트 결과는 다른 체인 Adapter의 구현·검증을 대신하지 않는다.

기존 함수와 Adapter의 전체 JSON은 UUID와 관측/시작/완료 시각만 정규화해 비교한다. 선택 계정·잘못된 네트워크·잘못된 주소·EOA·RPC 실패의 동등성과 동시 요청의 잔액 호출 증거가 섞이지 않는지도 확인한다. 공유 Rpc로 Fixture를 동시에 실행하는 경로는 제공하지 않는다.

## 검증

CLI의 `--out`은 JSON 전체 직렬화 후 같은 상위 디렉터리의 비공개 임시 파일에 쓰고 sync/close를 마친 뒤 rename으로 교체한다. 신규·덮어쓰기 모두 새 파일 권한을 POSIX 0600으로 설정한다. 최종 경로에서 관측한 링크·디렉터리·FIFO는 거부하며 hardlink 별칭의 기존 내용은 바꾸지 않는다. 저장 전 오류나 rename 전 실패는 이전 목적 파일을 유지한다. rename 후 정리 실패는 완성 파일이 저장된 상태로 종료 코드 1을 반환할 수 있다.

동시 writer는 완성 파일 단위로 마지막 rename이 남으며 잠금·충돌 감지는 없다. 파일 sync만으로 전원 손실 후 디렉터리 항목의 영속성을 보장하지 않는다. 강제 종료·정리 실패 시 비공개 임시 경로가 남을 수 있으며, 적대적인 부모 교체를 방어하는 파일시스템 sandbox는 아니다. 상세 범위는 [ADR 0006](adr/0006-atomic-report-output.md)을 따른다. JSON schema와 시나리오 의미는 바꾸지 않는다.

`npm run check`는 타입 검사와 전체 테스트를 실행한다. 기존 로컬 baseline/exact-receipt 및 Proxy 정상·실패 경로 보고서를 직렬화한 후 계약을 검증한다. 별도 스키마 테스트는 필드 추가·순서 변경·시나리오 버전 호환성과 잘못된 금액·태그·증거 참조·집계의 거부를 확인한다. `tests/fixtures/report-v1.json`은 명시적인 합성 소비자 표본이며 실제 자산 평가 증거가 아니다.

## 별도 사설 TVM 실행 보고서

TRON TVM의 runtime/deploy/normal/boundary/transfer-probe/negative-suite는 이 AssessmentReport 계약을 재사용하지 않는다. [별도 v1 계약](adr/0019-private-tvm-report-contract.md)과 [스키마](../schemas/private-tvm-report.v1.schema.json)에서 구조·정리·관측 요약 일관성을 검사한다. 기존 판정·지원·UNKNOWN 블록 의미와 이 문서의 Assessment 스키마는 유지한다.

## 한정 제어 응답 연구 보고서

[control-read-probe.v1.schema.json](../schemas/control-read-probe.v1.schema.json)은 qualified 연구 probe의 별도 계약이다. AssessmentReport와 합치지 않으며 OK는 응답 디코딩이다. 전체 verdict INCONCLUSIVE·support/authority UNKNOWN 및 행위 NOT_TESTED를 유지한다. 참조·값·호출 문맥도 별도 검증한다([ADR 0020](adr/0020-qualified-control-read-probes.md)).

선택적 `roleCodeReadings`는 같은 실행 getter로 확인한 4개 주소의 코드 관측을 담는다. 필드가 없는 기존 보고서도 유효하다. 새 필드가 있으면 역할 순서·주소/getter 증거·코드 byte/hash·후행 참조·최종 header/stage의 의미 검증을 함께 적용한다. 코드 유무는 계정 제어 주체나 권한 판정이 아니다.

[minter-management-probe.v1.schema.json](../schemas/minter-management-probe.v1.schema.json)은 두 관리 getter의 별도 연구 계약이다. 내부 fresh baseProbe도 control-read 계약으로 검증하고, management의 읽기·gate·후행 증거를 별도로 검사한다. evidence ID는 각 배열에 국한한다. owner namespace와 pointer 관측을 실제 권한 행사·Assessment PASS로 승격하지 않는다.

[admin-history-probe.v1.schema.json](../schemas/admin-history-probe.v1.schema.json)은 고정 범위의 과거 관리 이벤트/거래 조사 계약이다. 배포 anchor·검색 범위·표본 선택·receipt/transaction/header/log 교차 검증을 적용한다. 정상 빈 window와 조회 ERROR를 구분하며 현재 권한·지원은 UNKNOWN, 전체 판정은 INCONCLUSIVE다([현재 조회 결과](USDC_ADMIN_HISTORY.md)).

RLUSD 제어 응답 연구는 [별도 v1 schema](../schemas/rlusd-control-probe.v1.schema.json)의 QUALIFIED_RLUSD_CONTROL_PROBE_NOT_ASSESSMENT다. bool/bytes32 word, 7개 고정 호출 문맥, 증거 namespace와 pre/post 참조, source-study hash, 생략 이유 및 전후 선언 코드/슬롯/마지막 헤더를 검증한다. OK/OBSERVED는 응답 관측이며 AssessmentReport의 PASS나 권한/지원 인증으로 변환하지 않는다. 역할 ID zero와 literal MATCH도 보유자/권한의 증명이 아니다.

RLUSD 역할 관리 관계 연구는 [별도 schema](../schemas/rlusd-role-admin-probe.v1.schema.json)의 QUALIFIED_RLUSD_ROLE_ADMIN_PROBE_NOT_ASSESSMENT다. baseProbe를 기본 계약으로 재검증하고 JSON.stringify(baseProbe) UTF-8 SHA-256을 확인한다. baseProbe/roleAdmin namespace 참조, 6개 raw role ID→calldata→adminRole ID·반환 ID 관계·후행 역할/프레임을 검증한다. ID zero/self 관계와 전체 INCONCLUSIVE·membership NOT_TESTED를 유지하며 root owner/실제 권한으로 변환하지 않는다.

RLUSD 공개 계정 후보 연구는 [별도 schema](../schemas/rlusd-account-candidates.v1.schema.json)의 QUALIFIED_RLUSD_ACCOUNT_CANDIDATES_NOT_ASSESSMENT다. 제3자 배포 참조·ABI hash, 성공한 직접 생성 receipt/tx/header 포함, RoleGranted indexed account·sender 분리와 최초3고유 nonzero 계정 선정 및 후행 헤더를 검증한다. ERROR/null을 NO_MATCH로 바꾸지 않으며 namespace deployment의 영수증 참조를 보존한다. source/현재 membership/freeze/실제 authority는 UNKNOWN, 계정 호출/행위는 NOT_TESTED다.

USDT 제어 응답은 [별도 v1 schema](../schemas/usdt-control-probe.v1.schema.json)의 QUALIFIED_USDT_CONTROL_PROBE_NOT_ASSESSMENT다. 고정 chain/address/fullcode·source/ABI hash,7개 raw/decoded 응답·owner 비교·증거 분할·마지막 header를 의미 검증한다. uint256 fee는 unsigned 십진 문자열만 허용하며 fee 설정0을 전송 수수료 실행 검증으로 바꾸지 않는다. 전체 INCONCLUSIVE/권한·지원 UNKNOWN을 유지한다.

USDT owner 표본은 [별도 schema](../schemas/usdt-owner-sample-probe.v1.schema.json)의 QUALIFIED_USDT_OWNER_SAMPLE_PROBE_NOT_ASSESSMENT다. fresh base의 계약·snapshot hash·동일 nonzero owner gate, baseProbe/ownerSample namespace, 고정 표본 calldata·code byte/hash·두 bool 비교·owner/code/마지막 header 후행 검사를 연결한다. base의 blacklist NOT_TESTED와 표본 readings를 구분한다. 코드 유무·false 응답은 실제 권한이나 전송 허용을 입증하지 않으며 전체 INCONCLUSIVE/행위 NOT_TESTED를 유지한다.

USDC owner 표본은 [별도 schema](../schemas/usdc-owner-sample-probe.v1.schema.json)의 QUALIFIED_USDC_OWNER_SAMPLE_PROBE_NOT_ASSESSMENT다. fresh 기본 base의 hash·canonical nonzero owner 선정과 baseProbe/ownerSample namespace를 연결한다. 고정 표본 호출·순서·bool raw/value·프록시 코드/5slot/owner/chain/마지막 header 프레임에서 단계를 재도출한다. base32+sample24=56요청 한도와 실제 요청 수를 구분하며 기본 blacklist NOT_TESTED는 보존한다. 응답 false는 전송 허용·운영자·실제 권한의 증거가 아니다.

서비스 계정 문맥은 [입력 schema](../schemas/service-account-context-input.v1.schema.json)와 [별도 출력 schema](../schemas/service-account-context-report.v1.schema.json)의 로컬 검증 계약이다. 원시 input bytes와 기록된 검증 시각으로 tuple·주소·역할/목적·각 출처 hash·전체 input hash·고정 상태를 재도출한다. LOCAL_INPUT_VALIDATED_NOT_ACCOUNT_VERIFIED는 출처 인증이 아니며 RPC admission NOT_GRANTED/query NOT_TESTED/authority·ownership UNKNOWN을 유지한다. [ADR0021](adr/0021-local-service-account-context.md)을 따른다.

서비스 계정 읽기 연결은 [별도 envelope schema](../schemas/service-account-readonly.v1.schema.json)를 사용한다. context/Assessment snapshot의 JSON.stringify UTF-8 hash, 원본 입력 bytehash, 독립 namespace·정확한 query 시나리오/call/값·query tag/header를 연결한다. EVM allowance 미구현/0요청과 query 실패를 구분하며 root INCONCLUSIVE/UNKNOWN과 nested 원래 판정을 보존한다([ADR0022](adr/0022-service-account-readonly-runner.md)).

EVM allowance opt-in은 optional evmAllowanceRead:true와 ERC20-011 v1.0.0의 exact32byte uint256/owner-spender/tag 증거를 연결한다. 기존 필드 없는 보고서와 기본 NOT_IMPLEMENTED는 유지하며 approve/transferFrom/철회 검증으로 승격하지 않는다([ADR0023](adr/0023-evm-allowance-readonly.md)).

승인 결함 사설 실행은 [별도 allowance v1 schema](../schemas/private-tvm-allowance.v1.schema.json)와 [의미 검증기](../src/tron/lab/allowance-report.ts)를 사용한다. 기존 TVM v1의 transfer enum을 늘리지 않는다. setup/target의 원시 proof·전후 상태와 runtime 소유/격리·정리·횟수를 보존하고, 저장 시 proof를 재검증한다. [실행 범위](TRON_ALLOWANCE_PROBE_EXECUTION.md)와 같이 실제 스테이블코인 실행·AssessmentReport와 구분한다.
