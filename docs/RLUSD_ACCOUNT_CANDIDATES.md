# RLUSD 공개 계정 후보의 배포 영수증 조사

목표는 역할 보유·계정 동결 조회에 사용할 **근거 있는 공개 계정 후보**다. 주소를 임의로 정하거나 role ID·event.sender·배포자를 역할 보유자로 대입하지 않는다. 이번에는 후보 출처만 조사하며 hasRole/accountPaused·실제 권한 행사·제품 ABI 변경은 하지 않았다.

## 제3자 배포 참조

Sourcify의 [공식 조회 API 문서](https://docs.sourcify.dev/docs/api/)에 따라 chain1의 고정 RLUSD proxy 한 건만 GET했다. API가 제공한 자료의 [배포 참조](research/rlusd-deployment-reference.json)에 URL·조회 UTC·원본 SHA-256·ABI 이벤트 형식과 다음 서비스 주장을 기록했다.

| 항목 | 서비스의 주장 |
|---|---|
| proxy | 0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD |
| 배포 transactionHash | 0x811c963004b19c2e3724850cda6bffd7cab7ff8f34d5670f86b51a9e1390327d |
| blockNumber | 20492031 |
| transactionIndex | 276 |
| deployer | 0x3BAf6263aD9C9D0854405B4Cfe4310c556a3e6ab |

원본은 `.state/rlusd-controls/proxy-sourcify.json`, SHA-256은 `7953034adc5b9ee4f0ac32e8de5d58b4a9d4c27c8bff51aa7fd47f0907b41245`다. 서비스의 creation/runtime match 표시는 제3자 주장으로 남기며 여기서 배포 소스·코드 동일성을 판정하지 않는다. 위 deployer도 계정 표본으로 선택하지 않았다.

## 한정 RPC 대조

[연구 도구](../tools/research/rlusd-account-candidates.ts)는 chain ID와 고정 transactionHash의 영수증·거래, 고정 높이의 헤더만 읽는다. 정상 경로는 5요청, 상한8요청·요청당10초/1MiB다. 영수증/거래가 없으면 즉시 중단한다. getLogs 구간 검색·주소별 호출·다른 endpoint/ABI·새 표본 대입은 하지 않는다.

성공 status, tx/receipt hash·block·index·from, 헤더의 transaction slot, top-level 생성의 to=null·contractAddress=proxy를 대조한다. factory 생성은 이 한정 검사에서 배포 연결을 확정하지 않는다. receipt의 log tx/block/index·removed·중복·topic·data를 검사하고, emitter=proxy인 정확한 RoleGranted(bytes32,address,address)만 사용한다. 사용자 제공 ABI에서 role/account/sender는 모두 indexed이며 data는 비어 있다. 잘못된 형식은 빈 결과가 아니라 ERROR다.

RoleGranted의 account만 후보이며 sender·transaction.from·서비스 deployer는 별도 관측이다. 생성자/초기화/delegatecall 문맥의 로그를 일반 직접 권한 호출로 표시하지 않는다. 32바이트 zero role ID는 유효하지만 zero account 주소는 표본에서 제외한다. logIndex 순서의 최초3개 고유 nonzero account와 그 계정의 role ID·로그 위치를 보존하고 누락 수를 기록한다. 전체 역할 보유자 목록이나 현재 membership/freeze/운영자·고객/서비스 지갑의 증거가 아니다.

마지막에 같은 높이 헤더 hash를 재확인하며 실패/변화는 CONSISTENCY_ERROR다. 이 경우 남긴 후보는 후속 조회에 적합한 일관된 근거로 사용하지 않는다. 숫자 블록·provider 응답은 독립적인 최종성/원자 snapshot 인증이 아니다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/rlusd-account-candidates.ts --out reports/rlusd-account-candidates-readonly.json
```

RPC_URL은 환경변수로만 받으며 관리형 proxy 설정을 유지한다. 기존 보호된 bounded transport를 재사용하고 이 도구의 별도 request validator/projector만 추가했다. 기본 RLUSD 모드의 allowlist·보고서는 유지한다. 허용 필드만 정제하고 유효하지 않은 주소는 INVALID로 구분해 실제 null과 혼동하지 않는다. [별도 v1 schema](../schemas/rlusd-account-candidates.v1.schema.json)와 의미 검증 후 0600 원자 저장한다. 초기 설정/소스 실패는 기존 출력을 보존한다.

## 2026-10-20 실제 결과: 후보 미확보

[시도 보고서](../reports/rlusd-account-candidates-readonly.json)의 완료 시각은 `2026-10-20T03:58:04.559Z`다.

| 요청 | 관측 |
|---|---|
| eth_chainId | 0x1 |
| 고정 배포 transactionHash의 eth_getTransactionReceipt | null |
| 거래·헤더·이벤트 대조 | NOT_TESTED — 영수증 전제 미확립으로 중단 |
| 계정별 hasRole/accountPaused | NOT_TESTED |

실제2요청에서 중단했고 stage ERROR, 후보0개, 전체 INCONCLUSIVE다. **후보0개는 해당 계정/이벤트/권한이 없다는 뜻이 아니다.** 정상 영수증을 읽고 적합한 이벤트가 없을 때의 NO_MATCH_IN_RECEIPT와 다르다. 원인·자료 보존 범위·요금제·인증 제한을 단정하지 않는다. 헤더를 확인하지 못했으므로 observedBlockOrSlot은 UNKNOWN이고, 참조의20492031은 여전히 제3자 배포 주장이다.

첫 저장본의 블록 문맥 표기를 미확인 상태 UNKNOWN으로 정정했다. 정정 전 파일은 `.state/rlusd-controls/account-attempt-before-context-fix.json`에 남겼으며, RPC data·시각·요청 수는 바꾸지 않았고 재조회하지 않았다.

현재 계정 표본 근거는 미확보다. 의미 있는 새 자료가 생기기 전 같은 실패 요청을 반복하지 않는다. 기존 USDC 과거 이력의 null/RPC4444와 이번 RLUSD receipt null은 각각의 관측이며 동일 원인으로 단정하지 않는다. 다음 독립 작업은 USDT 관리 ABI 출처 등 다른 스테이블코인 공백 보강이다.

후속 작업에서는 새 RLUSD 계정 선정 근거가 없는 상태를 유지하고, 실패 요청을 반복하지 않았다. 독립적인 [USDC owner 표본](USDC_OWNER_SAMPLE_PROBE.md)의 한정 blacklist 응답을 보강했으며 이를 RLUSD 역할 보유·동결 증거로 전용하지 않는다.
