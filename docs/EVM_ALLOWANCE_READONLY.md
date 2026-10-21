# EVM allowance의 명시적 읽기 전용 조회

서비스 계정 연구 runner의 `--evm-allowance` 옵션으로 Ethereum USDC/USDT/RLUSD의 ALLOWANCE 문맥을 연결했다. 이번 검증은 합성 HTTP와 프로그램이 생성한 신규 사설 Anvil Fixture에서만 수행했다. 외부 RPC·실제 스테이블코인 승인/거래는 실행하지 않았다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/service-account-readonly.ts --evm-allowance \
  --input .state/service-account-input.json --out reports/service-account-allowance.json
```

실제 조회에는 목적·출처를 갖춘 공개 owner/spender 원본 입력이 필요하다. 이 문서의 명령은 실행 예시이며 합성 Fixture를 mainnet 표본으로 사용하지 않는다. 옵션은 EVM ALLOWANCE 문맥에서만 허용한다. BALANCE/TRON 문맥에 붙이면 RPC 전에 오류다. 생략하면 기존 EVM ALLOWANCE NOT_IMPLEMENTED/0RPC 동작을 유지한다. 기본 제품 `assess` CLI의 `--spender`는 계속 TRON 전용이다.

## Adapter와 시나리오

EVM 전용 request의 optional spenderAddress를 추가했다. 공통 도메인의 ReadOnlyAssessmentRequest에 ERC-20 필드를 강제하지 않는다. spender가 있으면 accountAddress를 owner로 해석하고, owner 누락·빈 owner/spender·잘못된 주소와 직접 assessEvm의 fixture actors+spender 조합은 첫 RPC 전에 거부한다. 생략한 기존 holder 요청은 잔액 조회를 유지한다.

pair 요청은 잔액 조회로 대체하거나 부수 balance를 읽지 않는다. metadata/기존 Proxy 관측 후 새 번호 블록을 pin해 정확한 `allowance(owner,spender)` (`0xdd62ed3e`) 전체 calldata를 읽는다. `ERC20-011` v1.0.0 / ALLOWANCE는 getter 전용 시나리오이며 기존 approve/transferFrom/철회 시나리오와 구분한다. 옵션 없는 기존 모드·Fixture 시나리오 목록·과거 보고서는 그대로다.

| 응답 | 시나리오 결과 |
|---|---|
| 정확한32byte uint256 | readStatus OK, bigint 값, 개별 PASS/support UNKNOWN |
| short/long/비hex word | INVALID_RESPONSE, INCONCLUSIVE/support UNKNOWN, 값 없음 |
| RPC/revert/transport 또는 pin 실패 | READ_FAILED, INCONCLUSIVE/support UNKNOWN, 값 없음 |

0과2^256−1을 모두 허용하고2^53 이상의 정밀도를 유지한다. JSON은 unsigned 십진 문자열이다. 실패를0·미지원으로 채우지 않는다. owner=spender도 명시 표본 문맥으로 허용하며 위임·권한 증거로 해석하지 않는다. getter PASS는 그 pair/tag의 응답 관측 조건에 한정하며 approve/transferFrom/철회·실제 권한·전송 가능 여부는 NOT_TESTED/UNKNOWN으로 남긴다.

## 보고서·실행 경계

새 [runner 계약](SERVICE_ACCOUNT_READONLY.md)은 명시 옵션에서만 optional `evmAllowanceRead:true`를 기록하고 ERC20-011/ALLOWANCE·정확한 요청·raw word·금액·query block/header를 의미 검증한다. 필드가 없는 과거 보고서는 계속 기본 동작으로 검증하며 과거 NOT_IMPLEMENTED를 자동 승격하지 않는다. flag·calldata·값·scenario·namespace·snapshot hash 변조를 거부한다.

기존32요청/요청당10초·1MiB·단일 endpoint/redirect 거부·caller/selector/tag 경계를 유지한다. 선택 환경변수는 RPC_URL뿐이고 proxy 설정을 변경하지 않는다. 전체 원본 입력 bytehash, context/Assessment namespace와 snapshot hash, root INCONCLUSIVE/권한·소유·서비스 신원·지원 UNKNOWN,0600 원자 저장/실패 시 기존 파일 보존 정책도 유지한다.

metadata identity와 allowance의 pin은 다를 수 있다. binding은 실제 allowance call의 tag와 해당 header를 보존하고 identity 블록을 복사하지 않는다. 번호 tag/provider 확인은 atomic hash pinning·최종성·독립 상태 검증이 아니다.

## 검증

추가 테스트4개는3개 Ethereum 프로필의 pair 순서·동일 pair·0/2^53+1/max, 누락/empty/잘못된 pair·actors 혼입0RPC, short/long/nonhex·revert/transport, flag오용·변조·동시 namespace·CLI/저장 회귀를 확인한다. 신규 소유 사설 Anvil StandardToken에서는 초기0→approve17→approve max→approve0 뒤 getter 응답을 확인하고, 읽기 전후 상태가 같으며 read Adapter가 쓰기 RPC를 보내지 않음을 검사한다. 이 사설 approval/revocation은 실제 스테이블코인 거래 증거가 아니다.

[합성 artifact](../reports/service-account-evm-allowance-synthetic.json)는 SYNTHETIC_LOCAL_HTTP_ARTIFACT_NOT_MAINNET_EVIDENCE wrapper이며 실제 관측 카탈로그에 추가하지 않는다. 실제 서비스 표본·USDC controller/minter·RLUSD 역할 계정 근거는 여전히 별도 공백이다.
