# ADR 0011 — TRON TRC-20 읽기 전용 Adapter

날짜: 2026-10-19. 상태: 채택. 사용자가 Phase 1 완료 후 TRON 단계 진행을 승인했다. 이번 확장은 주소·metadata·선택 계정 잔액과 CLI/JSON 증거에 한정한다. 서명·거래·승인·TVM 배포/쓰기·자원/수수료 실행 검증은 추가하지 않는다.

## 인터페이스와 주소

기존 ReadOnlyAdapter 및 Report 1.0을 사용한다. src/tron은 TRON JSON-RPC의 eth_chainId, eth_getBlockByNumber, eth_getCode, eth_call만 사용한다. read-only ABI는 name/symbol/decimals/totalSupply/balanceOf다. 메서드 이름의 Ethereum 호환성으로 체인 실행 의미까지 같다고 가정하지 않는다. FullNode HTTP API 및 TronWeb SDK를 추가하지 않는다.

[공식 주소 문서](https://developers.tron.network/docs/account)에 따라 21-byte/41-prefix hex와 Base58Check를 정규화한다. Base58 문자·길이·41 버전·double SHA256 checksum·round trip을 검증한다. JSON-RPC 및 ABI 경계에서는 prefix를 제거한 20-byte 주소만 보낸다. 20-byte Ethereum 입력 자체는 TRON 주소로 받지 않는다. 41 prefix는 네트워크 인증이 아니며 [eth_chainId](https://developers.tron.network/reference/eth_chainid)의 provider 응답을 예상한 양의 32-bit ID와 비교한다. 독립적인 네트워크 인증이나 genesis 전체 해시 검증은 아니다.

## latest와 Report 1.0

[공식 JSON-RPC 규약](https://developers.tron.network/reference/json-rpc-api-overview)과 [eth_call](https://developers.tron.network/reference/eth_call)은 상태 조회의 latest 의미를 명시한다. block 객체를 사용해도 과거 상태 실행이 보장되지 않는다. EVM의 숫자 블록 조회를 재사용하지 않는다.

조회 전후 latest head의 번호·32-byte block ID(JSON-RPC hash 필드)·높이 prefix를 검증하고 TRON_HEAD_REFERENCE/TRON_STATE_CONTEXT에 기록한다. [공식 block ID 구조](https://developers.tron.network/docs/block)의 첫 8 bytes는 높이지만 나머지 hash suffix를 다시 계산하거나 합의를 검증하지 않는다. head 전후가 같아도 개별 metadata/code/balance 응답의 블록을 증명하지 못한다. 후행 head 조회가 실패하면 기존 관측을 보존하고 closingHeadAvailable=false로 기록한다.

Identity와 모든 시나리오의 observedBlockOrSlot은 UNKNOWN이다. Report 1.0의 PASS/FAIL은 알려진 관측 블록을 요구하므로 이번 조회 결과는 성공 디코딩도 INCONCLUSIVE/support UNKNOWN으로 둔다. 성공 여부와 INVALID_RESPONSE/READ_FAILED는 observations에 보존한다. 범위 밖 decimals를 정상 값이나 0으로 바꾸지 않는다. 이 정책을 위해 기존 EVM 계약이나 스키마를 완화하지 않는다. head 증거 자체의 관측 높이와 응답 상태의 정확한 블록을 구분한다.

TRC20-001은 metadata, TRC20-000은 선택 holder의 TRC-20 balanceOf다. holder가 없으면 BALANCE는 NOT_TESTED다. TRX eth_getBalance로 대체하지 않는다. TRC20-002/003/004/005/006은 각각 TRANSFER/ALLOWANCE/UPGRADEABILITY/RESOURCE_CONSUMPTION/TRANSFER_FEE의 NOT_TESTED 표식이다. 미구현 capability는 공통 summary에서도 NOT_TESTED다.

## 전송 계층과 CLI

JSON-RPC envelope/전송/안전 오류/evidence 수집만 src/rpc/json-rpc.ts로 분리한다. EVM Rpc와 RpcError 및 isRevert의 기존 import 경계를 유지하고, EVM pin과 revert 분류를 EVM 클래스에 둔다. TRON은 코드 3을 포함한 상위 오류 원문에서 EVM 의미를 추측하지 않고 안전한 RPC_ERROR로 기록한다. 오류 message/data/임의 필드는 보존하지 않는다. 성공 응답은 기존 raw evidence 정책을 따른다.

CLI는 --chain tron을 추가하고 정확한 JSON-RPC endpoint를 TRON_RPC_URL에서 받는다. endpoint 경로를 자동 변경하지 않는다. 기본 assess는 기존 evm/RPC_URL이고 lab은 계속 프로그램이 만든 사설 Anvil의 신규 Fixture만 실행한다. API 키·서명 키 입력이나 별도 인증 설정 변경은 없다. 네트워크 프록시는 기존 환경대로 존중한다.

## 검증과 한계

Lead 31b6a11a994740dea5e36eefda0b4768의 revise_plan을 회수해 UNKNOWN 블록/INCONCLUSIVE 정책과 체인별 오류/블록 의미 분리를 적용했다. 새 Agent는 생성하지 않았다.

공식 주소 벡터, 잘못된 checksum/prefix, uint8/uint256, 잘못된 ABI와 RPC/transport/envelope 오류, 요청별 증거 격리, latest-only, 변화하는 head, 후행 head 실패, CLI/schema 및 기존 EVM 회귀를 검증한다. HTTP mock 증거는 합성 응답이며 실제 TVM Fixture 실행이 아니다. 공개 mainnet USDT 관측은 별도로 저장하고 단위 테스트/CI에서 외부 노드를 호출하지 않는다.

metadata는 자산/발행사 인증이 아니고 Proxy·권한·전송·Energy/Bandwidth·feeLimit·finality는 미검증이다. 향후 미고정 상태에서 PASS/FAIL을 부여하려면 명시적인 보고서 계약 결정이 먼저 필요하다.
