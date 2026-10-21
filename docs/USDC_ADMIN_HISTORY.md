# USDC masterMinter 과거 관리 이력 조회

이 작업은 **과거에 수행된 거래·이벤트를 읽는 조사**다. 새로운 관리 거래·서명·전파를 수행하지 않는다. 역사적 성공 거래와 이벤트를 연결할 수 있어도 현재 권한·실제 운영자·키 통제까지 확인한 것으로 보지 않는다.

## 범위와 판정

[조사 기준](research/usdc-master-minter-history-reference.json)은 제3자 배포 자료의 block `7439432`, 생성 거래 `0x9a20409c717d56fa630f64f9a2fc6d07e26308cf37de5f1833c24e348fa6d4ed`를 출발점으로 삼는다. 그 자료를 사실로 가정하지 않고 먼저 생성 거래·성공 receipt·contractAddress·to=null·블록 번호/hash·거래 index를 대조한다. 확인에 실패하면 의존하는 로그 검색을 중단한다.

배포 근거를 확인한 경우에만 고정 target `0xE982615d461DD5cD06575BbeA87624fda4e3de17`에 대해 inclusive `7439432..7440431`의 1,000개 블록을 검색한다. 대상 topic은 ControllerConfigured·ControllerRemoved·MinterManagerSet·OwnershipTransferred 네 가지뿐이다. 응답은 2 MiB, 로그 100개, 요청 32개, 요청당 10초로 제한한다. 범위 확대·다른 endpoint 재시도는 없다.

반환 로그를 block/transaction/log index 순으로 정렬해 첫 3개만 표본으로 확인한다. 중복·removed·범위/주소/topic 불일치·비정상 address padding은 거부한다. 성공 receipt의 정확한 로그와 transaction/header 연결, 전체 direct calldata와 이벤트의 해당 인자가 일치하는지 구분한다. 생성자·다른 계약 경유·미확인 입력은 direct call UNKNOWN이다. 입력에 없는 oldOwner/oldManager까지 calldata로 입증하지 않는다.

ABI는 앞서 확보한 제3자 0.4.24 자료에 연결한다. OwnershipTransferred의 두 주소는 indexed topic이 아니라 data word다. 당시 target code는 표본 블록에서 별도로 조회하며, 실패는 UNKNOWN으로 남긴다. 현재 코드/소스를 과거에 소급하지 않는다. 후행 header 실패·변화는 CONSISTENCY_ERROR다. 단일 RPC 제공자의 응답 연결이며 서명 복구·trie 포함 증명·독립 consensus 검증은 수행하지 않는다.

## 현재 RPC에서의 실제 결과

[실제 조회 보고서](../reports/usdc-master-minter-history-readonly.json)의 결과는 **ERROR / INCONCLUSIVE**다.

| 요청 | 응답 |
|---|---|
| eth_chainId | `0x1` |
| 배포 eth_getTransactionReceipt | `null` |
| 배포 eth_getTransactionByHash | `null` |
| 배포 eth_getBlockByNumber | `RPC error (code 4444)` |
| 의존 eth_getLogs 검색 | **NOT_TESTED**: 배포 근거 미확인으로 실행하지 않음 |

이 기록만으로 보존 범위·계정 권한·서비스 제한 등 원인을 특정하지 않는다. JSON-RPC 오류 4444는 조직 proxy의 CONNECT 차단 증거로 분류하지 않는다. 다른 도구·gateway·endpoint로 우회하지 않았다. 역사 데이터가 없다는 결론도 아니다.

**관리 거래/권한 행사가 없었다는 결과가 아니다.** 배포 근거를 확인하지 못해 이력 검색을 시작하지 못한 상태다. 따라서 현재 controller/minter 목록·관리 권한·취급 지원은 UNKNOWN이며 실제 과거 권한 행사의 증거도 이번에는 추가되지 않았다. 정상 빈 로그 응답의 NO_MATCH_IN_WINDOW와 RPC 조회 실패를 구분한다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx tools/research/master-minter-history.ts --out reports/usdc-master-minter-history-readonly.json
```

향후 데이터 가용성이나 구성 상태에 변화가 확인되기 전에는 같은 실패 조회를 기계적으로 반복하지 않는다. 도구는 허용된 HTTP JSON-RPC 읽기 POST만 사용하며 외부 검증 서비스에 제출하거나 거래를 전파하지 않는다. 비밀/upstream 오류 메시지·비정상 문자열은 보존하지 않고, 허용 필드의 원시 증거와 안전한 오류 코드만 0600 원자 파일로 저장한다. 기존 보고서를 보존하려면 새로운 출력 경로를 사용한다.
