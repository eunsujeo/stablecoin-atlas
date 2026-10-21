# Solana mint 읽기 체인 연결 모듈

Solana USDC·USDT mint 설정 조회를 공통 ReadOnlyAdapter·`assess` CLI·AssessmentReport1.0에 연결했다. 기존 [별도 연구 reader](SOLANA_MINT_READONLY.md)의 검증된 관측 core를 재사용하며, 제품 경로는 선택 mint 한 개만 읽는다. [ADR0029](adr/0029-solana-mint-readonly-adapter.md)를 따른다.

## 실행

환경변수 SOLANA_RPC_URL을 설정한 뒤 실행한다. RPC URL·토큰·키를 출력하지 않는다.

```sh
npm run assess -- --chain solana --network mainnet-beta --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --out reports/solana-usdc-assessment-readonly.json
npm run assess -- --chain solana --network mainnet-beta --token Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB --out reports/solana-usdt-assessment-readonly.json
```

`--token`은 여기서 mint 주소다. `--network`에는 mainnet-beta 또는 전체 mainnet genesis hash를 받으며 보고서에는 전체 hash를 쓴다. 현재는 위 두 mint만 허용하고 holder/spender/profile 옵션과 다른 network/mint는 RPC 전에 거부한다. 후속 승인으로 [명시 Token Account 읽기](ACCOUNT_STATE_READONLY.md)를 추가했다. --token-account로 잔액·동결·delegate 설정을 관측하며 지갑 자동 검색·SDK·거래는 추가하지 않았다. EVM/TRON은 기존 입력·RPC 경로를 유지한다.

## 공통 보고서

| 항목 | 결과 의미 |
|---|---|
| mint/program/decimals | 유효한 초기화 legacy mint를 읽은 경우에만 KNOWN |
| symbol/name/issuer/native·표준 적합성 | UNKNOWN 유지 |
| contract/implementation | 이 mint에 EVM/TVM 계약 의미는 NOT_APPLICABLE |
| identity/decimals/supply/초기화 설정 읽기 | 관측/조건·본문/hash/context 증거, INCONCLUSIVE·support UNKNOWN |
| 전송·잔액·위임·발행/소각·동결·권한 변경 등 | NOT_TESTED·NOT_EXECUTED |
| ERC-20 allowance | NOT_APPLICABLE. Solana Token Account delegation은 별도 NOT_TESTED |

유효 응답의 context slot만 기록한다. genesis 실패로 실행되지 않은 mint 단계는 NOT_TESTED이고 실행된 transport/protocol 실패는 ERROR/INCONCLUSIVE다. null/다른 owner/미초기화·미지원 layout에서 기본 decimals나 mint/program을 만들지 않는다. 부정확한 결과를 PASS/SUPPORTED나 기능 부재로 판정하지 않는다.

`--out`을 생략하면 JSON은 stdout, 요약은 stderr다. 저장 파일은 기존 원자적0600 출력이다. 종료0은 보고서 생성 완료이며 INCONCLUSIVE/NOT_TESTED가 있어도0일 수 있다.1은 옵션/설정/저장 오류,2는 시나리오 FAIL이다. 서명·운영 키·공개망 상태 변경은 없다.

## 실제 공통 CLI 관측

새 경로로 USDC·USDT를 각각 조회했고 각 요청은 genesis→단일 mint 읽기의2회였다.

| 대상 | 응답 context slot | decimals | 보고서 |
|---|---|---|---|
| USDC | 459449963 | 6 | [USDC](../reports/solana-usdc-assessment-readonly.json) |
| USDT | 459449966 | 6 | [USDT](../reports/solana-usdt-assessment-readonly.json) |

두 slot을 같은 snapshot으로 합치지 않는다. 각 보고서는 INCONCLUSIVE4개, NOT_TESTED12개, NOT_APPLICABLE1개다. 이 분류는 mint 설정 읽기 성공과 실제 토큰 행위 검증을 구분한 결과다. [실행·hash 기록](research/solana-adapter-integration.json)에 보고서와 기존 연구 보고서를 분리해 연결했다. 이전 두 mint 동시 연구 관측의 slot459436079와 파일/hash는 보존했다.

로컬 모의 검증은 단일 mint·2회 상한·동시 요청 격리·실패 후 복구, 큰 supply 문자열, genesis 중단·null/owner/encoding/초기화/태그/slot/envelope 오류와 비밀 비노출을 확인한다. CLI의 alias 정규화·schema·stdout/파일0600·오류 시 기존 출력 보존과 미구현 옵션의 사전 거부도 확인한다. 실제 두 보고서도 공통 schema와 evidence 참조·identity·summary 계약을 대조한다.

검증 완료: 새 Adapter 테스트3개와 기존 연구 테스트4개 통과, 전체 `npm run check`196개 통과·실패/skip0. 실제 두 공통 CLI 보고서도 공통 계약과 별도 바이너리/hash 검증을 통과했다. 기존15개 보고서/catalog 및 과거 연구 snapshot hash는 보존했다.

후속 계정 읽기는 [ADR0032](adr/0032-account-state-readonly.md)를 따른다. 아래 mint-only 실제 보고서/호출 수는 당시 실행 이력이며 Token Account 실제 조회 증거가 아니다.

후속 [공개 계정 마감 관측](STABLECOIN_MILESTONE_COMPLETION.md)에서 USDC/USDT Token Account2개의 실제 잔액·동결/delegate 설정을 읽었다. 각 slot은 별도이며 기존 mint-only 보고서와 구분한다.
