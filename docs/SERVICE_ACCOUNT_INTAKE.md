# 실제 서비스 계정 조회의 입력 준비

현재 범위(2026-10-20): 이 도구와 문서는 선택적 기능/과거 구현 이력이다. 서비스 운영 검증·서비스 계정 자료 수집은 현재 완료 조건에서 제외했다. 권한은 [소스 기반 호환성 검토](STABLECOIN_COMPATIBILITY_MATRIX.md)로 정리하며 아래 입력 조건을 사용자에게 필수 자료로 재요청하지 않는다.

현재 읽기 실행 경로는 구현·로컬 검증을 완료했다. 실제 표본 조회에 필요한 것은 공개 계정 주소와 그 조회 목적·출처다. 아직 실제 서비스 표본 입력은 확보하지 않았다. [템플릿8개](examples/service-account-context/README.md)는 현재 구현된4개 프로필의 잔액/승인량 문맥을 준비하며, 실제 계정 주소·출처·시각은 비워 두었다.

## 필요한 자료

다음 내용을 하나의 표본으로 지정한다. 공개 주소라도 운영자·고객 신원을 함께 전달할 필요는 없다.

| 항목 | 잔액 조회 | 승인량 조회 |
|---|---|---|
| 체인·자산 | Ethereum USDC/USDT/RLUSD 또는 TRON USDT | 동일 |
| 공개 주소 | holder | owner와 spender 모두 |
| 목적 | DEPOSIT_REVIEW / WITHDRAWAL_REVIEW / SWEEP_REVIEW 중 선택 | ALLOWANCE_REVIEW |
| 주소 출처 | 공개 참조 또는 사용자 제공 목적 진술 | owner와 spender 각각의 출처/목적 관계 |
| 기록 시각 | 유효한 UTC YYYY-MM-DDTHH:mm:ss.sssZ | 각 계정의 출처 기록 시각 |

개인키·시드·서명·RPC URL·인증 토큰은 입력 자료가 아니다. 기존 RPC 설정은 실행 환경에서 선택한다. source kind가 USER_STATEMENT이면 사용자의 목적 진술이며 소유권이나 실제 역할 증명이 아니다. PUBLIC_REFERENCE도 자료 진위가 자동 검증되는 것은 아니다.

referenceId는 출처 기록의 로컬 식별자이며1..64자의 소문자 시작 `[a-z0-9._-]`만 허용한다. 예를 들어 실제로 보존한 별도 참조 기록에 식별자를 붙이고, 입력에는 그 식별자만 넣는다. URL·파일 경로·고객 이름·자유 설명은 입력 JSON에 넣지 않는다. source 자료나 식별자를 임의로 만들어 인증된 출처처럼 표시하지 않는다. 실행기는 referenceId를 열거나 외부에서 조회하지 않으며 출력에는 digest만 기록한다.

## 템플릿 선택

| 프로필 | 잔액 | 승인량 |
|---|---|---|
| Ethereum USDC | [BALANCE](examples/service-account-context/ethereum-usdc-balance.template.json) | [ALLOWANCE](examples/service-account-context/ethereum-usdc-allowance.template.json) |
| Ethereum USDT | [BALANCE](examples/service-account-context/ethereum-usdt-balance.template.json) | [ALLOWANCE](examples/service-account-context/ethereum-usdt-allowance.template.json) |
| Ethereum RLUSD | [BALANCE](examples/service-account-context/ethereum-rlusd-balance.template.json) | [ALLOWANCE](examples/service-account-context/ethereum-rlusd-allowance.template.json) |
| TRON USDT | [BALANCE](examples/service-account-context/tron-usdt-balance.template.json) | [ALLOWANCE](examples/service-account-context/tron-usdt-allowance.template.json) |

chain/network/asset 값은 현재 코드·저장된 연구 프로필과 맞춘 참조이며 새 공식 지원/주소 인증이 아니다. 파일은 미완성 템플릿이다. REPLACE_WITH 항목을 실제 공개 주소·목적·출처·기록 시각으로 채우기 전에는 검증 오류가 나고 RPC를 호출하지 않는다. 계정 주소를 임의 생성하거나 합성 테스트 주소·과거 제어 owner 주소를 서비스 지갑으로 복사하지 않는다.

## 로컬 검증 후 명시적 조회

아래는 Ethereum USDC 잔액 템플릿의 준비 예다. 이 문서 작성 작업에서 실제 계정 입력이나 외부 RPC 조회는 수행하지 않았다.

```sh
install -m 600 docs/examples/service-account-context/ethereum-usdc-balance.template.json \
  .state/service-account-input.json
```

복사한 파일을 실제 자료로 채운 후 로컬 검증을 먼저 실행한다.

```sh
node --use-env-proxy --import tsx tools/research/service-account-context.ts \
  --input .state/service-account-input.json --out reports/service-account-context.json
```

형식·목적/출처 필드 검증이 통과해도 계정 소유권·서비스 신원이나 자동 RPC 실행을 인증한 것은 아니다. 실제 조회는 원본 입력을 다시 검증하는 [별도 read-only runner](SERVICE_ACCOUNT_READONLY.md)를 명시적으로 실행한다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/service-account-readonly.ts \
  --input .state/service-account-input.json --out reports/service-account-readonly.json
```

Ethereum 승인량 조회에는 위 runner에 `--evm-allowance`를 추가한다. 생략하면 기존 NOT_IMPLEMENTED/0RPC다. TRON/BALANCE에는 이 옵션을 붙이지 않는다. TRON 승인량은 owner의 부수 잔액도 읽는다. Ethereum은 RPC_URL, TRON은 TRON_RPC_URL만 사용한다. 출력은0600 원자 저장이며 실패 시 기존 입력/출력을 보존한다.

읽기 응답은 해당 표본과 시점의 관측이다. EVM은 query pin/header와 identity 시점이 다를 수 있고, TRON 정확한 getter 블록은 UNKNOWN이다. 조회 성공이나0값을 전송 허용·키 통제·실제 권한·취급 승인으로 해석하지 않는다.
