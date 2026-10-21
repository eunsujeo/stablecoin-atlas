# XRPL 발행자 설정 체인 연결 모듈

USDC·RLUSD 발행자의 AccountRoot 설정 조회를 공통 ReadOnlyAdapter·`assess` CLI·AssessmentReport1.0에 연결했다. [기존 연구 core](XRPL_ISSUER_READONLY.md)를 재사용하며 선택 issuer 한 계정만 읽는다. [ADR0030](adr/0030-xrpl-issuer-readonly-adapter.md)에 따른 좁은 읽기 범위다.

## 실행

XRPL_RPC_URL 환경변수를 설정한 뒤 실행한다. URL이나 인증정보를 보고서/로그에 쓰지 않는다.

```sh
npm run assess -- --chain xrpl --network mainnet --issuer rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE --currency 5553444300000000000000000000000000000000 --out reports/xrpl-usdc-assessment-readonly.json
npm run assess -- --chain xrpl --network mainnet --issuer rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De --currency 524C555344000000000000000000000000000000 --out reports/xrpl-rlusd-assessment-readonly.json
```

mainnet은 CLI에서 문자열 networkId0으로 정규화한다. library 입력은 assetAddress=issuer, currencyCode=통화 코드다. 두 문서상 허용 쌍만 받으며 통화 이름/주소를 임의로 변환하지 않는다. token/spender/profile은 빈 값 포함 거부한다. 후속 확장의 --holder는 유효 classic address에 한해 허용하며 [계정 읽기 문서](ACCOUNT_STATE_READONLY.md)를 따른다. issuer/currency 옵션은 다른 체인의 assess와 lab에서 거부한다. 타 Adapter도 currencyCode를 조용히 무시하지 않는다.

--holder를 생략한 요청은 server_info→validated ledger→선택 issuer account_info의 최대3회다. 네트워크 확인 실패 후 ledger/account 호출은0회, ledger 검증 실패 후 account 호출도0회다. 서버의 network_id0과 validated 응답을 확인한 것이며 독립적인 네트워크/합의 인증은 아니다. HTTP/transport 실패 뒤 재시도나 endpoint 전환은 없다.

## 공통 보고서 의미와 호환성

| 필드/검사 | 의미 |
|---|---|
| issuedCurrency | XRPL에서 필수 Knowledge. KNOWN은 허용된 요청/문서 식별자. DOCUMENTED evidence로 구분하며 AccountRoot의 통화 발행 증거가 아님 |
| issuer | 검증된 account_info의 Account 일치에만 KNOWN. 발행사 법적 실체·키 통제 인증은 UNKNOWN |
| decimals/contract/mint/program/implementation | XRPL에서는 NOT_APPLICABLE. ERC-20 fixed decimals나 Solana mint로 해석하지 않음 |
| 이름·symbol·native/bridged·표준 적합성 | 별도 인증 없이 UNKNOWN |
| identity/issuer 설정 읽기 | COMPLETED/INCONCLUSIVE, support UNKNOWN. ledger hash/index와 검증된 설정·원시 Flags/미해석 비트·TransferRate 상태 기록 |
| 읽기 오류/중단 | 실행 오류는 ERROR/INCONCLUSIVE, 앞 단계에서 중단된 설정 읽기는 NOT_EXECUTED/NOT_TESTED |
| 동결·회수·권한 변경·전송 | 실제 행위는 NOT_TESTED. trust-line 설정 읽기는 선택 --holder 경로로 별도 관측 |
| ERC20 allowance | NOT_APPLICABLE. trust-line 인가 부재를 뜻하지 않음 |

schemaVersion1.0에 XRPL enum과 issuedCurrency/조건부 제약을 추가했다. 새 validator는 기존 EVM/TRON/Solana 보고서를 계속 검증한다. **이전의 고정 enum/schema를 가진 소비자는 새 XRPL 보고서를 거부할 수 있으므로 갱신된 schema가 필요하다.** 구버전 소비자 전체 호환을 보장하지 않는다. 기존 required/Knowledge 제약을 완화하지 않았고 루트/시나리오 identity에 같은 조건이 적용된다.

JSON은 stdout 또는 --out 파일, 요약은 stderr다. 파일은 기존 원자적0600 출력이다. 종료0은 보고서 완료이며 INCONCLUSIVE/NOT_TESTED가 있어도0이다.1은 입력/설정/저장 오류,2는 시나리오 FAIL이다. 설정 비트의 true/false를 PASS/SUPPORTED나 실제 행사 결과로 바꾸지 않는다.

## 실제 공통 CLI 조회

새 경로에서 각 자산을3회 읽기로 조회했다. 두 ledger는 다르므로 같은 snapshot으로 합치지 않는다.

| 대상 | 관측 시각 UTC | ledger index | 보고서 |
|---|---|---|---|
| USDC | 2026-10-21T01:55:39.478Z | 107795780 | [USDC](../reports/xrpl-usdc-assessment-readonly.json) |
| RLUSD | 2026-10-21T01:55:41.913Z | 107795781 | [RLUSD](../reports/xrpl-rlusd-assessment-readonly.json) |

각 보고서에 validated ledger hash도 보존했다. 관측한 AllowTrustLineClawback은 USDC=false/RLUSD=true, GlobalFreeze는 둘 다false다. 이는 각 시점의 issuer 설정이며 개별 trust-line freeze·amendment·회수 실행을 입증하지 않는다. 각 결과는 INCONCLUSIVE2개, NOT_TESTED14개, NOT_APPLICABLE1개다. [실행/hash 기록](research/xrpl-adapter-integration.json)으로 연결하며 이전 동시 연구 ledger107795106 보고서/hash는 보존한다.

공통 Adapter 테스트는 단일 issuer·3회 상한·currency+issuer 분리·동시 요청 격리·실패 후 회복·network/ledger 중단·응답 불일치·비밀 비노출을 검증한다. schema에서는 통화 누락/잘못된 Knowledge/비정규 코드·KNOWN fixed decimals 등을 거부하고 이전 보고서를 계속 검증한다. CLI 입력 거부·alias·stdout/파일0600·기존 출력 보존과 실제 두 보고서의 identity/evidence/summary 계약도 확인한다. trust-line/Payment/잔액/공급량/SDK/서명/거래는 추가하지 않았다.

최종 검증: 새 XRPL Adapter 테스트4개 및 기존 연구/체인 검증을 포함해 전체 `npm run check`200개 통과·실패/skip0. 실제 두 XRPL 공통 보고서와 기존 Solana 보고서도 새 schema/identity/evidence/summary 계약을 통과했다. 기존15개 보고서/catalog와 이전 연구 snapshot hash를 보존했다.

후속 승인으로 [holder trust-line 읽기](ACCOUNT_STATE_READONLY.md)를 추가했다. --holder를 생략하면 위 기존 issuer 경로를 유지하고, 지정하면 같은 ledger에서 account_lines를 추가한다. 위 실제 issuer-only 보고서는 당시 실행 이력이며 holder 잔액/인가/동결 관측 증거가 아니다. Payment·실제 권한 행사·공급량·SDK·서명/거래는 계속 제외한다.

후속 [공개 계정 마감 관측](STABLECOIN_MILESTONE_COMPLETION.md)에서 공식 예제 holder의 USDC/RLUSD 선택 line은 각각 완전 조회 결과 NOT_PRESENT였다. 양수 잔액·인가·동결을 관측한 것으로 표시하지 않는다.

후속 사용자 승인된 [XRPL 양수 보유 trust-line 연구](XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 완료했다. USDC/RLUSD AMM 표본의 잔액·설정을 동일 ledger의 직접 RippleState로 관측했다. 공통 account_lines Adapter는 해당 표본에서3페이지 미완료였으며 기존 INCONCLUSIVE 보고서와 분리한다. 추가 연구18회 읽기·거래0회, 제품 코드/기존212개 검사 이력은 유지한다.
