# TRON 승인 결함 프로브의 사설 TVM 실행

[실행 전 준비](TRON_ALLOWANCE_PROBE_PREPARATION.md)의 고정9종 계약을 별도 실행 경로에 연결했다. 정상 approve·transferFrom 2건과 각 함수의 단일 결함8건을 서로 다른 신규 소유·격리 runtime에서 순차 실행한다. 실제 스테이블코인 또는 서비스 계정의 거래 검증은 아니다.

```sh
npm run tvm:allowance-negative -- --out reports/tron-tvm-allowance-suite.json
```

추가 키·외부 RPC·임의 Solidity 입력은 받지 않는다. 기존 `tvm:negative`는 transfer용4종 경로를 유지한다. 새 경로는 [별도 schema](../schemas/private-tvm-allowance.v1.schema.json)와 [의미 검증기](../src/tron/lab/allowance-report.ts)를 사용한다.

금액은 `18446744073709551739`이며 transferFrom은 같은 Fixture의 정상 approve로 `18446744073709551746`을 먼저 승인한다. 이 setup의 canonical true·Approval·상태 불변/승인량을 검증한 후 새 baseline에서 spender의 위임 전송을 실행한다. 정상 위임 전송 후 잔여 allowance는7이다. wrong-allowance 결함은 다른 축이 정상인 상태에서 승인량만 호출 전 값으로 유지된다.

정상 대조2건을 먼저 수용해야 결함 대조를 진행한다. 각 결함은 false·malformed bool2·이벤트 누락·승인량 불변 중 한 축만 달라야 한다. 순수 검증기의 정상 반환만 관측 성공으로 사용하며 throw·복합 결함·setup 실패는 ERROR다. 실행·보고서 검증·정리 실패 또는 abort가 발생하면 후속 항목을 NOT_TESTED로 남긴다. 120초 세션 제한과 거래당 broadcast1회를 유지한다.

보고서는 실제 runtime code와 build hash, caller/recipient/spender·정확한 calldata·금액, receipt·선택된 포함 거래·raw protobuf hash, 호출 전후5개 상태 필드와 setup→target 연결을 보존한다. 저장된 원시 proof에서 반환·로그·상태 판정을 재검증한다. runtime 소유·격리 근거와 순수 검증기의 `NOT_ESTABLISHED_BY_THIS_VERIFIER`는 서로 다른 범위다. getter 블록은 UNKNOWN이다. 블록의 선택된 거래 투영을 보존하며 전체 블록의 암호학적 검증이나 공개망 최종성은 주장하지 않는다.

## 검증

`npm run check`: **182개 통과**, 실패·skip0. 새 테스트는10종 시나리오의 상태·반환·로그와 setup 순서, setup/복합 결함·중단·정리 실패의 후속 중지, proof/금액/호출자/hash/소유권/코드/횟수 변조 거부를 확인한다. 지연된 검사/응답 뒤 timeout·abort 재확인 및 반환 보고서 복제도 검증한다.

실제 실행은 **2026-10-20T07:23:39.112Z→07:27:01.552Z(UTC), 202440ms**에 완료했다. [실제 보고서](../reports/tron-tvm-allowance-suite.json)는 전체 OBSERVED, 정상 대조2건 PASS·결함8건 FAIL/기대 거부 관측이다. 자동 검증 오류0이며 Fixture FAIL과 구분한다.

| 대상 함수 | 정상 | false / malformed | 이벤트 누락 | 승인량 불변 |
|---|---|---|---|---|
| approve | PASS | RETURN_MISMATCH 각각 | LOG_MISMATCH | STATE_MISMATCH |
| transferFrom | PASS | RETURN_MISMATCH 각각 | LOG_MISMATCH | STATE_MISMATCH |

새 runtime10개와 run/container/network ID의 비중복을 확인했고, 각각 container/network REMOVED다. 실제 거래는 배포10·대상 호출10·setup 승인5의 총25건이다. Fixture 요청은435건(account40/deploy10/block50/broadcast25/receipt25/contract10/constant260/trigger15)이며 approve 항목당36건·transferFrom 항목당51건이다. 이 횟수는 session.request의 실제 dispatch를 세며 Docker 검사·기동 head/peer probe 등의 전체 I/O 횟수는 아니다. elapsedMs의 개별 runtime 표본은14828~26995ms이고 suite 전체 시간은 컴파일·정리도 포함한다.

저장한 artifact의 schema·의미·원시 proof 재검증, 파일0600, 기존 transfer4종의 source/ABI/init/runtime hash16개와 mainnet 보고서14개·catalog snapshot의 불변을 확인했다. 실제 서비스 계정 조회와 USDT 거래는 NOT_TESTED이며, 그 입력 공백은 별도로 유지한다. [ADR0025](adr/0025-private-tvm-allowance-execution.md)에 경계와 결정 근거를 남겼다.
