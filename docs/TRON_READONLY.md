# TRON 읽기 전용 지원

[구현·테스트·보존 증거 완료 점검과 남은 작업](TRON_READONLY_COMPLETION.md)을 함께 확인한다.

2026-10-19. 사용자 승인으로 TRON 단계의 첫 읽기 경로를 추가했다. TRC-20 주소 정규화, provider chainId 비교, contract code, metadata와 선택 계정 balanceOf, 선택 owner/spender의 allowance를 조회한다. [설계와 판정 한계](adr/0011-tron-readonly-adapter.md).

## 실행

TRON_RPC_URL에 허용된 노드의 **전체 JSON-RPC endpoint**를 환경변수로 제공한다. HTTP Wallet API URL과 다르며 프로그램이 /jsonrpc 등을 덧붙이지 않는다. 실제 endpoint/인증정보를 보고서나 공유 문서에 붙여 넣지 않는다. EVM용 RPC_URL은 그대로 별도로 유지한다.

TRON 읽기 전용 실행에는 Node.js와 프로젝트 의존성이 필요하며 Anvil이나 TRON 서명 키는 필요하지 않다. 전체 EVM 통합 테스트와 lab에는 기존 Anvil이 필요하다.

```sh
npm run assess -- --chain tron --network 728126428 \
  --token TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t \
  --out reports/tron-usdt-readonly.json
```

--holder에 Base58Check 또는 41-prefix hex 주소를 주면 TRC-20 balanceOf를 추가한다. 생략하면 잔액은 NOT_TESTED다. 20-byte Ethereum 주소는 입력으로 받지 않는다. Mainnet chain ID는 공식 문서의 0x2b6653dc를 십진수로 표현한 728126428이다. Shasta/Nile은 해당 노드와 예상 ID를 함께 지정해야 하며 이번 실제 조회 대상은 Mainnet뿐이다.

## 결과 해석

[블록 연결 조사](research/TRON_RESPONSE_BLOCK_BINDING.md)에서도 현재 정책을 바꿀 근거를 확인하지 못했다. TRON JSON-RPC 상태 조회는 latest다. 조회 전후 head의 높이·hash를 증거로 남기지만 각 응답의 정확한 블록은 UNKNOWN이다. 두 head가 같아도 이를 상태 고정 증거로 사용하지 않는다. 현재 Report 1.0 계약을 유지하므로 metadata와 조회한 BALANCE/ALLOWANCE 결과는 **INCONCLUSIVE**이며 성공/실패 상태는 observations에서 확인한다.

metadata.decodeComplete=true와 각 필드 status=OK가 조회/디코딩 성공을 뜻한다. balance의 readStatus=OK 및 balance 십진 문자열은 조회 결과다. 잘못된 uint8/ABI 응답은 INVALID_RESPONSE, RPC/transport 오류는 READ_FAILED로 구분한다. 이 경우에도 미고정 블록의 전체 판정을 FAIL로 만들지 않는다. 종료 코드 0은 명령 완료와 FAIL 없음만 뜻하며 검증 PASS나 취급 승인이 아니다.

거래·승인 실행·Proxy 권한·Energy/Bandwidth/feeLimit·수수료 동작은 NOT_TESTED다. 실제 TVM 전송·승인·이벤트 Fixture 실행, FullNode HTTP API 및 계정 활성화도 이번 구현에 포함하지 않는다.

## 실제 Mainnet 관측

[Tether 공식 지원 프로토콜](https://tether.to/en/supported-protocols/)은 TRON USD₮ 주소를 TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t로 연결한다. 이 출처는 DOCUMENTED 식별 근거이며 실행 보고서의 issuerVerificationStatus를 VERIFIED로 바꾸지 않는다.

실제 CLI로 위 주소의 Tether USD / USDT / decimals 6과 totalSupply를 조회했다. holder는 지정하지 않았다. 보고서는 reports/tron-usdt-readonly.json이며 Report 1.0 계약을 검증했다. metadata 1 INCONCLUSIVE / 나머지 6 NOT_TESTED, 종료 코드 0이다. 전송·승인·서명·네트워크 상태 변경은 없다. 관측 시각과 전후 head는 보고서 원본에 기록하며 이후 문서의 수치를 최신 상태로 소급 해석하지 않는다.

최종 CLI 관측 시각은 2026-10-19T04:27:58.164Z, 전후 head는 87237018→87237019였다. 정확한 상태 응답 블록은 여전히 UNKNOWN이다. 생성 JSON의 계약과 0600 권한을 확인했다. [공식 주소 출처 JSON](research/tron-reference-assets.json)은 DOCUMENTED 근거로 별도 보존한다.

## 로컬 테스트 증거

tests/tron-readonly.test.ts는 공식 주소 벡터, checksum·prefix 오류, latest-only 요청, 최대 uint256/0 잔액, decimals 0/255/범위 위반, metadata 오류, 후행 head 실패, concurrent evidence isolation, CLI 저장·오류·기존 파일 보존을 검증한다. reports/tron-readonly-mock.json은 합성 HTTP 응답의 보조 증거이며 live asset 또는 TVM 실행 증거로 사용하지 않는다.

정상·변화·동일 높이의 다른 ID·잘못된 head를 구분하고 전후 head가 같아도 응답 블록 UNKNOWN/INCONCLUSIVE를 유지한다. 전체 npm run check는 기존 EVM 회귀를 포함해 49개 테스트가 통과했다. 새 의존성이나 core enum 변경은 없으며 Report 1.0에 선택적 allowance 십진 문자열 검증을 추가했다.

공식 규약: [JSON-RPC](https://developers.tron.network/reference/json-rpc-api-overview), [eth_call](https://developers.tron.network/reference/eth_call), [주소](https://developers.tron.network/docs/account), [chainId](https://developers.tron.network/reference/eth_chainid).

## 승인량 조회 확장

`--chain tron --holder <owner> --spender <spender>`를 함께 지정하면 `allowance(owner,spender)`를 읽는다. `--spender`는 TRON assess 전용이며 owner가 없거나 주소가 비었거나 잘못되면 RPC 전에 거부한다. Base58Check/41-prefix hex를 각각 검증하고 보고서는 정규 Base58로 기록한다. 두 주소가 같아도 유효한 조회다.

새 `TRC20-007 / ALLOWANCE`는 조회 전용이다. pair 미지정이면 NOT_TESTED이며 allowance RPC를 보내지 않는다. 성공은 readStatus=OK와 정확한 십진 문자열 allowance(0 포함)로 기록한다. ABI 오류는 INVALID_RESPONSE, RPC/transport 오류는 READ_FAILED이며 allowance 값을 생성하지 않는다. 성공해도 latest 블록 한계로 INCONCLUSIVE/support UNKNOWN을 유지한다. `TRC20-003`의 실제 approve/transferFrom 실행은 계속 NOT_TESTED다. 현재 생성 보고서는 8개 시나리오이며 앞의 첫 Mainnet 보고서 7개 결과는 당시 관측으로 보존한다.

추가 검증은 owner/spender 인자 순서, 0/최대 uint256, 혼합 주소 형식, 같은 owner의 서로 다른 spender 동시 조회 증거 격리, 잘못된 입력의 RPC 0건, 실패 후 복구, CLI 제한과 금액 schema를 포함한다. [ADR 0012](adr/0012-tron-allowance-readonly.md).

추가 Mainnet self-pair 관측은 `reports/tron-usdt-allowance-readonly.json`으로 별도 보존했다. 2026-10-19T04:38:48.194Z에 USDT 계약 자체를 owner와 spender로 지정했으며 allowance는 문자열 `"0"`, readStatus는 OK였다. metadata·잔액·승인량 3 INCONCLUSIVE / 나머지 5 NOT_TESTED, 종료 코드 0, Report 1.0 계약 및 파일 0600을 확인했다. 전후 head는 모두 87237235였으나 정확한 상태 블록은 UNKNOWN이다. 이 단일 pair의 0은 다른 계정들의 승인량이나 실제 approve/transferFrom 동작에 관한 증거가 아니다.

## 사용자 제공 holder의 후속 관측

[일반 holder 잔액 관측](TRON_HOLDER_BALANCE_OBSERVATION.md)은2026-10-20의 별도 읽기 결과다. 잔액0/decimals6을 읽었고 마지막 head 확인은HTTP429였다. 성공한 잔액 응답과 정확한 상태 블록UNKNOWN·전체INCONCLUSIVE를 함께 보존한다. 과거 self-pair 보고서와 서비스 운영 목적/소유권 인증을 구분한다.
