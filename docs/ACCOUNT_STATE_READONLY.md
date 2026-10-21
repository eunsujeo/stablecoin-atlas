# Solana・XRPL 계정 단위 읽기

사용자 승인에 따라 기존 mint/issuer 읽기에 특정 계정의 상태 관측을 추가했다. Solana USDC·USDT, XRPL USDC·RLUSD만 대상으로 한다. 설정 조회는 자산별 전송 시험이나 서비스·수탁 운영 검증과 별개다. 키·서명·거래 생성 없이 기존 `assess`와 공통 JSON 보고서를 사용한다.

## 무엇이 추가되었나

| 구분 | 기존 읽기 | 추가 읽기 |
|---|---|---|
| Solana | mint의 공급량·decimals·mint/freeze authority | 지정 Token Account의 잔액·owner authority·동결 상태·delegate·위임 한도·close authority |
| XRPL | issuer AccountRoot의 설정 | 지정 holder와 issuer/currency 사이 trust-line의 잔액·양측 한도·인가·동결·NoRipple 설정 |

Solana의 Token Account는 토큰 보유 데이터를 담은 계정이다. 그 데이터의 owner authority와 계정을 관리하는 Token Program 주소는 서로 다르다. 하나의 지갑에 같은 mint의 Token Account가 여러 개 있을 수 있으므로 이번 결과를 지갑 전체 잔액으로 합산하거나 ATA라고 단정하지 않는다. [공식 Token Account 설명](https://solana.com/docs/tokens/basics/create-token-account).

XRPL은 currency+issuer가 자산 식별자다. `--holder`가 관점 계정이고 issuer가 peer다. 양수 잔액은 holder가 보유한 값, 음수는 holder의 반대 방향 의무를 표현한다. 원문 `balance`, `limit`, `limit_peer`는 각각 `balanceValue`, `holderLimitValue`, `issuerLimitValue`로 보존하며 계산하거나 부호를 바꾸지 않는다. 한도는 ERC-20 allowance나 전송 위임 한도가 아니다. [공식 account_lines 설명](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_lines).

## Solana 사용법과 결과

`SOLANA_RPC_URL`을 환경변수로 설정한다. `--token-account`에는 **지갑 주소 대신 특정 Token Account 주소**를 넣는다. USDC 예시이며 USDT는 기존 프로필의 mint로 바꾼다.

```sh
npm run assess -- --chain solana --network mainnet-beta \
  --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --token-account '<TOKEN_ACCOUNT_ADDRESS>' --out reports/solana-account-readonly.json
```

주소를 생략하면 기존 mint 읽기만 수행한다. `--holder`나 `--spender`를 섞지 않는다. 지갑 자동 검색·ATA 파생·계정 생성은 구현하지 않았다.

SOLANA-006/BALANCE와 SOLANA-007/DELEGATION의 observations에 다음을 기록한다.

- `tokenAccountAddress`, `readStatus`, 오류·미관측 사유
- 정상 관측 시 `balance`와 `delegatedAmountRaw`: LE u64를 정확한 십진 정수 문자열로 변환
- `ownerAuthority`, `accountState` (`INITIALIZED` 또는 `FROZEN`)
- `delegate`, `closeAuthority`: `PRESENT`+주소 또는 `NONE_IN_ACCOUNT`
- `actualAuthorityExercise: NOT_TESTED`

delegate 위임 한도는 현재 잔액보다 클 수 있다. delegate가 없다는 설정과 close authority가 없다는 설정은 실제 서명·전송·계정 폐쇄 가능성을 인증하지 않는다.

genesis 확인 후 mint와 Token Account를 **한 번의 getMultipleAccounts**에 넣어 같은 finalized context slot에서 읽는다. 총2회 RPC다. 요청 순서·응답 수·program owner·nonexecutable·정규 base64·mint82바이트와 Token Account165바이트·선택 mint 일치·COption 태그·state를 검사한다. frozen은 유효한 초기화 상태이며 미초기화 상태와 구분한다. 해당 스테이블코인에서 native SOL 계정은 수용하지 않는다. 오류 시 mint의 독립 관측은 보존하고 계정 잔액을0으로 합성하지 않는다. context slot은 계정의 최종 수정 slot을 뜻하지 않는다. [공식 batch RPC](https://solana.com/docs/rpc/http/getmultipleaccounts).

## XRPL 사용법과 결과

`XRPL_RPC_URL`을 환경변수로 설정한다. USDC 예시이며 RLUSD는 기존 프로필의 currency+issuer를 함께 바꾼다.

```sh
npm run assess -- --chain xrpl --network mainnet \
  --issuer rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE \
  --currency 5553444300000000000000000000000000000000 \
  --holder '<CLASSIC_HOLDER_ADDRESS>' --out reports/xrpl-account-readonly.json
```

holder를 생략하면 기존 issuer 설정 읽기만 수행한다. Classic address의 Ripple alphabet·버전·20바이트 payload·checksum·정규 재인코딩을 검증한다. X-address, tag 표기, holder=issuer, 빈 값은 RPC 전에 거부한다. 계정의 실제 소유자나 서비스 운영자를 인증하는 검사는 아니다. [공식 주소 인코딩](https://xrpl.org/docs/references/protocol/data-types/base58-encodings).

XRPL-004/BALANCE와 XRPL-018/IDENTITY의 `observations.trustLine`에는 holder/issuer/currency, 관측 상태, `lineState`, `pagesRead`, `complete`를 기록한다. 정상 발견 시에만 `line`에 잔액·양측 한도·flags를 넣는다.

| 원문 flag | holder 관점의 의미 |
|---|---|
| `authorized` | holder 쪽에서 설정한 인가 |
| `peer_authorized` | issuer 쪽에서 설정한 인가 |
| `freeze` / `freeze_peer` | holder / issuer 쪽의 개별 trust-line 동결 설정 |
| `no_ripple` / `no_ripple_peer` | 양측의 NoRipple 설정 |
| `deep_freeze` / `deep_freeze_peer` | 응답에 있을 때 별도로 보존하는 양측 deep-freeze 설정 |

각 flag는 응답에 있으면 `PRESENT`+boolean, 없으면 `NOT_PRESENT`다. 문서에서 기본false라고 설명하는 필드도 원문 누락과 명시적false를 구분한다. NoRipple 누락의 기본 상태는 계정 DefaultRipple과 관련되므로 단순 false로 환산하지 않는다. issuer AccountRoot의 GlobalFreeze·NoFreeze·RequireAuth는 별도 증거다. 이들을 하나의 ‘전송 가능’ 값으로 합치지 않는다. 특히 `peer_authorized`는 보유 인가 설정이며 DELEGATION과 다르다.

먼저 기존 server_info/validated ledger/issuer account_info를 읽고 같은 ledger_hash에서 `account_lines(account=holder,peer=issuer,ignore_default=false,limit=20)`를 최대3페이지 읽는다. 총6회 RPC 이내다. 각 페이지의 account·validated·ledger hash/index와 각 line의 peer/currency/금액/선택 flags 형식을 확인한다. marker는 최대512자 문자열만 이번 경로에서 수용하고 그대로 전달하며 보고서에 출력하지 않는다. 그 밖의 marker 형식은 미지원 관측으로 남긴다.

빈 페이지라도 marker가 있으면 계속 읽는다. 반복 marker·중복 line·상한 후 marker 잔존·응답 불일치·오류는 `UNKNOWN`/INCONCLUSIVE이며 부분 잔액을 채택하지 않는다. **marker 없이 끝난 완전 조회에서만** 해당 line을 `NOT_PRESENT`로 기록한다. 이것도 잔액0과 다르다. actNotFound 등 RPC 실패는 line 부재로 해석하지 않는다. 실패 후 다른 endpoint로 전환하지 않는다.

금액은 부호·소수·지수 표기를 그대로 보존한 문자열이다. 최대100자, 지수부 최대2자리(절댓값99)라는 입력 형식 상한을 두며 Number로 변환하지 않는다. 전체 STAmount 범위/유효숫자 인증이나 산술·고정 decimals 처리는 하지 않는다. [XRPL 금액 형식](https://xrpl.org/docs/references/protocol/data-types/currency-formats).

## 판정과 검증 범위

읽기를 시도한 설정 관측은 INCONCLUSIVE, 실행하지 않은 전송·동결/해제·인가 변경·권한 행사는 NOT_TESTED로 유지한다. 지원은 UNKNOWN이다. 설정이 보였다는 이유로 기능 지원·키 통제·입출금 가능·안전성·취급 승인을 PASS로 만들지 않는다. XRPL DELEGATION은 NOT_TESTED, 양 체인의 ERC-20 ALLOWANCE는 NOT_APPLICABLE이다.

새 `delegatedAmountRaw`와 `trustLine` 필드의 금액·상태 계약을 공통 schema/오프라인 validator에 추가했다. schemaVersion1.0을 유지하며 기존 정상8개 보고서를 보존한다. 소비자는 갱신된 schema를 사용한다.

초기 구현 검증은 로컬 모의 RPC와 합성 계정 데이터로 수행했다. 구현 검증 당시 공개망 계정 단위 조회는 NOT_TESTED였으며, 이후 아래 마감 단계에서 공개 문서 표본으로 조회했다. 기존 공개망 mint/issuer 관측을 이 확장 기능의 실제 검증으로 바꾸지 않는다. 정상/0/큰 금액/동결/위임 한도, 잘못된 응답·페이지·오류·회복·동시 격리, CLI 옵션/0600/입력 보존과 오프라인 보고서 검증을 검사한다. 구현 근거와 한계는 [ADR0032](adr/0032-account-state-readonly.md)에 기록했다.

전체 검사는 npm test의 파일 병렬 수를2로 제한해 실행한다. 첫 무제한 병렬 전체 검사에서 기존 EVM/lab/proxy 세 테스트가60초 제한으로 취소되어 실행 부하를 줄였다. 기존 테스트 타임아웃·검증 조건은 유지한다.

검증 완료: 전체 `npm run check`212개 통과·실패/취소/skip0, 기존8개 보고서 오프라인 검증/해시 보존. [구현/검증 기록](research/account-state-read-integration.json)에 source/schema pins·호출 상한·검증 범위와 최초 시간 초과 이력을 기록했다.

후속 공개망 조회를 완료하고 [마일스톤을 마감](STABLECOIN_MILESTONE_COMPLETION.md)했다. Solana USDC/USDT의 실제 Token Account 잔액·설정은 OBSERVED, XRPL USDC/RLUSD는 공식 예제 holder의 완전 조회 결과 선택 line NOT_PRESENT다.14회 읽기·새 보고서4개 정합성 검증 통과이며, XRPL 양수 보유 line이나 실제 전송/권한 행사를 관측한 것은 아니다. [상세 근거](research/public-account-read-closeout.json).

후속 사용자 승인된 [XRPL 양수 보유 trust-line 연구](XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 완료했다. USDC/RLUSD AMM 표본의 잔액·설정을 동일 ledger의 직접 RippleState로 관측했다. 공통 account_lines Adapter는 해당 표본에서3페이지 미완료였으며 기존 INCONCLUSIVE 보고서와 분리한다. 추가 연구18회 읽기·거래0회, 제품 코드/기존212개 검사 이력은 유지한다.
