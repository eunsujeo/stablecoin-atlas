# 메타데이터 경계 검증과 decimals 수정

2026-10-19. Phase 1의 기존 ERC20-001 v1.0.0에서 uint8 범위 밖 decimals를 정상으로 기록하던 문제를 수정했다. 시나리오·스키마 버전과 기본 7종 Fixture 구성은 유지한다.

## 재현과 수정

설치된 viem의 decodeFunctionResult는 decimals의 uint8 ABI에 32-byte word 256 또는 65535를 넣어도 해당 숫자를 반환했다. 기존 resolveIdentity는 디코딩 성공만으로 metadata OK와 Identity KNOWN을 기록했다. 실제 사설 Anvil 계약의 decimals=256 응답을 사용한 회귀 테스트에서도 수정 전 ERC20-001이 기대 FAIL 대신 PASS로 판정됐다.

이제 decimals 디코딩 후 number·정수·0~255를 확인한다. 범위 밖 값은 INVALID_RESPONSE로 기록하고 decoded value를 남기지 않는다. Identity decimals는 UNKNOWN, 해당 metadata 시나리오는 기존 규칙에 따라 FAIL/support UNKNOWN이다. 값을 자르거나 0으로 바꾸지 않는다. 원시 성공 RPC 응답은 증거에 유지한다. 이는 기존 보고서 계약 위반을 바로잡는 수정이며 모든 ABI의 canonical encoding 검증을 구현한 것은 아니다.

## 로컬 사례

`tests/fixtures/MetadataBoundaries.sol`을 별도로 컴파일하고 프로그램이 시작한 사설 Anvil에 배포했다. 해당 계약에는 transfer/approve/mint/관리자 실행 메서드가 없다. 이후 읽기 전용 gateway를 통해 아래 12개 평가를 수행했다.

| 입력/상황 | ERC20-001 | 확인한 동작 |
|---|---|---|
| decimals 0, 빈 name/symbol, supply/balance 0 | PASS | KNOWN 0과 KNOWN 빈 문자열 유지 |
| decimals 255, Unicode label, 최대 uint256 supply/balance | PASS | decimals 255 유지, 금액은 정확한 bigint/십진 문자열 |
| decimals 18, 안전 정수 범위 초과 supply/balance | PASS | 9007199254740993123456 정확히 보존 |
| decimals 256 / 65535 / 최대 uint256 | 각각 FAIL | INVALID_RESPONSE, decoded value 없음, Identity UNKNOWN |
| name/symbol 메서드 없음 | INCONCLUSIVE | READ_FAILED/REVERT, 이름 UNKNOWN, decimals 정상 관측 유지 |
| decimals revert | INCONCLUSIVE | READ_FAILED/REVERT, supply 정상 관측 유지 |
| decimals/totalSupply의 짧은 ABI 응답 | FAIL | INVALID_RESPONSE이며 0으로 대체하지 않음 |
| bytes32 name/symbol | FAIL | 현재 string ABI와 불일치, INVALID_RESPONSE; legacy 변환은 미지원 |
| decimals RPC 오류 / transport 단절 | 각각 INCONCLUSIVE | READ_FAILED의 RPC_ERROR/TRANSPORT_ERROR 구분 |

집중 결과는 PASS 3 / FAIL 5 / INCONCLUSIVE 4다. 메서드 실패로 기능 부재를 선언하지 않으며, 다른 필드의 독립적인 INVALID_RESPONSE가 있으면 전체 metadata 시나리오는 FAIL일 수 있다. 장애 해제 후 정상 재조회도 PASS했다. 최대 금액은 2^256−1이며 JSON에 Number나 지수 표기로 기록하지 않았다.

CLI도 실제 로컬 out-of-range 계약을 assess해 유효한 Report 1.0 JSON, Identity decimals UNKNOWN, metadata INVALID_RESPONSE와 종료 코드 2를 확인했다. 이 코드 2는 관측 FAIL이며 테스트 실행 실패가 아니다. uint8 범위 안의 악의적인 값, labels의 진위, 발행사나 전체 자산 안전성을 검증한 결과는 아니다.

모든 평가에서 블록 높이·holder 잔액 불변, 허용된 읽기 RPC만 사용, 전송/승인 시나리오 NOT_TESTED/NOT_EXECUTED/UNKNOWN을 확인했다. 외부 RPC와 과거 Mainnet 보고서는 사용·변경하지 않았다.

Lead `eda94d366ae94cec9aed0274fd359370`의 proceed 응답을 회수했다. 검토자는 디코더 최소 재현을 독립 확인했으며 범위 검사·원시 증거 유지·오류 구분·0/255 보존 조건을 반영했다. Router는 shadow 상태를 유지했고 추가 Agent를 생성하지 않았다.

## 최종 검증

`npm run check`의 타입 검사와 테스트 43개가 모두 통과했다(실패/skip 0). 실제 CLI의 범위 밖 decimals 보고서도 Report 1.0 계약을 통과하고 관측 FAIL에 맞는 종료 코드 2를 반환했다. 정상 기본 Fixture·baseline/exact-receipt 정책·읽기 전용 계약의 기존 회귀도 통과했다.

`reports/metadata-boundaries-local.json`은 별도 테스트 증거 envelope로, 컴파일 정보·소스 경로/해시·배포 receipt/bytecode 및 12개 전체 평가 156건을 담는다. RPC/transport 주입 두 평가는 같은 정상 Fixture를 재사용하며 토큰의 고유 특성으로 해석하지 않는다. 각 평가의 Report 1.0 계약·증거 참조·EVM 블록 참조와 별도 Solidity 소스 해시·0600 권한을 확인했다. 기본 CLI LabReport와 다른 형식이며 Git에서 제외한다. 기본 Fixture 소스·스키마 범위·scenarioVersion은 변경하지 않았다.
