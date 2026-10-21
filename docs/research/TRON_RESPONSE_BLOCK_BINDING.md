# TRON 읽기 응답의 블록 연결 조사

조사일: 2026-10-19. 기존 metadata/balanceOf/allowance 응답을 특정 상태 블록에 연결할 수 있는지 공식 규약과 고정 소스를 검토했다. **조사한 경로에서는 정확한 응답 블록 연결을 확인하지 못했다.** 기존 UNKNOWN/INCONCLUSIVE 정책을 유지한다. 모든 TRON 노드·확장 API에서 불가능하다는 결론은 아니다.

이번 작업은 문서·소스 조사다. 노드 실행, 실시간 체인 API 실험, FullNode HTTP/gRPC 제품 구현, 거래·시뮬레이션 호출이나 보고서 계약 변경은 하지 않았다. 아래 결과는 DOCUMENTED 근거와 소스 해석이며 새 온체인 관측이 아니다.

## API 규약에서 확인한 사실

| 경로 | 규약 | 블록 연결에 대한 해석 |
|---|---|---|
| JSON-RPC eth_call 문자열 | latest만 지원 | 임의 과거 블록을 선택하는 경로가 아님 |
| eth_call 블록 객체 | blockNumber/blockHash의 존재를 검사하지만 최신 상태에서 실행 | 객체를 받아 준다는 사실은 historical-state 실행 증거가 아님 |
| /wallet/triggerconstantcontract | 요청 처리 시 노드에 보이는 상태에서 시뮬레이션 | 응답의 읽기 snapshot과 정확한 블록의 연결이 별도로 필요 |
| /walletsolidity/triggerconstantcontract | 노드의 최신 solidified 상태, 동일 요청/응답 형식 | solidified라는 상태 종류와 개별 응답의 정확한 블록은 별개 |

근거: [eth_call](https://developers.tron.network/reference/eth_call), [FullNode constant call](https://developers.tron.network/reference/triggerconstantcontract), [Solidity constant call](https://developers.tron.network/reference/triggerconstantcontract-1). FullNode 문서는 블록·pending 처리와 동시 constant call에 따라 실행 context가 달라질 수 있음을 설명한다. Solidity 경로의 존재만으로 이 제품의 조회 블록을 확정하거나 PASS로 바꾸지 않는다.

## 고정한 소스와 추적 경로

java-tron develop 조회 결과는 `b33eed89a6a424c498d4fb1b03ca2c86eddf4840`(commit 시각 2026-09-11T06:15:03Z), 별도 protocol master는 `8432beca98c52ba04c82aea0b48ae9f9f882c82a`(2026-07-17T03:35:23Z)였다. 아래는 이 SHA의 파일을 읽은 기록이다. 공개 provider가 이 버전이나 설정을 배포했다는 뜻이 아니며 두 저장소의 배포 조합도 검증하지 않았다.

1. [TronJsonRpcImpl.getCall, L1001–1050](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/services/jsonrpc/TronJsonRpcImpl.java#L1001-L1050): 객체의 블록 존재를 검사한 다음 latest로 치환하고, 블록 인자 없이 내부 call로 전달한다. 공식 규약의 제한과 일치한다.
2. [Wallet.callConstantContract, L3139–3198](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/Wallet.java#L3139-L3198): block store의 최신 블록을 읽어 TransactionContext를 만들고 VM을 실행한다. constant_result·자원량·logs는 실행 결과에서 생성된다. 이 내부 context의 블록이 클라이언트 응답의 상태 증명으로 반환되는 것은 확인하지 못했다.
3. [Solidity servlet 등록, L265–268](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/services/http/solidity/SolidityNodeHttpApiService.java#L265-L268), [WalletOnSolidity, L28–32](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/services/interfaceOnSolidity/WalletOnSolidity.java#L28-L32), [WalletOnCursor.futureGet, L16–31](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/services/WalletOnCursor.java#L16-L31): Solidity cursor를 설정하고 호출 후 reset하는 구성 요소를 확인했다.
4. [Chainbase, L50–105](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/chainbase/src/main/java/org/tron/core/db2/core/Chainbase.java#L50-L105): thread-local cursor로 HEAD/SOLIDITY 등을 구분하고 SOLIDITY에서 head.getSolidity()를 선택한다. 이것만으로 전체 호출 동안 여러 store를 하나의 불변 snapshot에 원자적으로 묶는다고 증명할 수 없다. servlet filter 전체 wiring·모든 store·쓰기 스레드의 잠금 경계에 대한 완전한 감사는 이번 조사에 포함하지 않았다.
5. [TriggerConstantContractServlet, L35–82](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/services/http/TriggerConstantContractServlet.java#L35-L82): 요청을 TriggerSmartContract로 만들고 Wallet 호출 뒤 TransactionExtention을 출력한다. [TriggerSmartContract, L74–81](https://github.com/tronprotocol/protocol/blob/8432beca98c52ba04c82aea0b48ae9f9f882c82a/core/contract/smart_contract.proto#L74-L81)에는 주소·값·data 등이 있고, [TransactionExtention, L831–840](https://github.com/tronprotocol/protocol/blob/8432beca98c52ba04c82aea0b48ae9f9f882c82a/api/api.proto#L831-L840)에는 transaction·txid·constant_result·실행 상태·자원량·logs 등이 있다. 확인한 정의에는 실행 상태 snapshot의 full block ID를 명시하는 전용 필드가 없다. 필드 부재만으로 내부 연결 자체가 없다고 단정하지 않는다.
6. [Wallet.setTransaction, L421–431](https://github.com/tronprotocol/java-tron/blob/b33eed89a6a424c498d4fb1b03ca2c86eddf4840/framework/src/main/java/org/tron/core/Wallet.java#L421-L431): 거래 참조는 getTrxReferenceBlock 설정에 따라 head 또는 solid에서 정한다. 이 참조 선택과 constant VM context 생성은 별도 경로다. 따라서 반환 transaction의 ref_block_* 또는 txid를 실행이 읽은 상태 블록으로 승격하지 않는다. 실제 노드의 설정값은 조사하지 않았다.

위 3–4는 solidified view의 구성 요소를 추적한 결과다. 모든 HTTP/gRPC 요청이 동일한 잠금·snapshot 수명을 갖는다는 검증 결과는 아니다. 앞뒤 head 일치, batch 응답, 동일 getter 반환값, simulation logs도 그 누락을 메우지 않는다.

## 현재 적용과 재검토 조건

[ADR 0011](../adr/0011-tron-readonly-adapter.md)의 latest/UNKNOWN 정책과 [ADR 0012](../adr/0012-tron-allowance-readonly.md)의 조회/승인 실행 구분을 그대로 유지한다. 코드·schema·기존 실제 보고서를 변경하지 않는다. 이번 조사는 새 상태 API를 추가할 근거가 되지 않았다.

향후 연결을 주장하려면 실제 실행이 읽은 불변 snapshot과 검증한 높이·full block ID의 원자적 연결, 또는 명시적 과거 상태 선택 계약과 구현을 확인해야 한다. 이어서 서로 다른 블록에서 값이 달라지는 getter, head 이동·동시 호출·없는 블록·재조직 조건으로 선택 의미와 실패 처리를 검증해야 한다. 이는 후속 검증 기준이며 이번에 실행한 테스트가 아니다. provider의 블록 귀속 주장과 독립적인 상태·합의 검증도 구분한다. mock 응답에 block 라벨을 추가하는 것으로 이 기준을 충족하지 않는다.

Lead bridge `09e754f2b63849ce9b4dd7008f0dc953`의 proceed를 회수했다. 검토 조건에 따라 조사한 버전·경로의 제한된 결론과 미조사 경계를 분리했다. Lead가 고정 소스 전체를 독립 검증했다는 의미는 아니다.

문서 반영 후 `npm run check`의 타입 검사와 전체 49개 테스트가 통과했다(실패·skip 0). 이 검사는 기존 제품 회귀이며 위 노드 snapshot/블록 연결 가설을 실험한 것은 아니다. 로컬 문서 링크와 `git diff --check`도 확인했다.
