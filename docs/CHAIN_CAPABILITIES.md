# 체인·실행 환경·토큰 표준과 서비스 프로필

체인/네트워크(Ethereum·TRON 등), 실행 환경(EVM·TVM), 토큰 표준(ERC-20·TRC-20), 개별 컨트랙트, 검증 시나리오는 서로 다른 층위다. 아래 표는 이 조합별 실행 의미를 비교한다. 사설 Fixture 결과와 외부 자산의 읽기 전용 관측도 구분한다.

| 항목 | EVM 체인 / ERC-20 | TRON TVM / TRC-20 | Solana (계획) |
|---|---|---|---|
| 식별 | chain ID + contract | provider chainId + Base58Check/41-prefix contract, metadata/선택 잔액 | cluster + mint + token program |
| 승인 | approve/allowance/transferFrom | 외부: allowance 조회. 사설 Fixture: 승인·위임·철회 검증 | delegate와 authority, allowance와 억지로 동일화 금지 |
| 계정 준비 | 테스트 주소 잔액 | 계정 활성화 등 조사 필요 | Token Account/ATA 생성 |
| 자원 | receipt gasUsed 증거 | Energy/Bandwidth/feeLimit | fee/compute/account 제약 |
| 통제 | 알려진 Fixture pause/blacklist만 | 독립 조사 | mint/freeze authority/확장별 권한 |
| 확장 | 인식 Proxy 구조만 관측; 실제 권한은 후속 | 사설 Fixture Transfer/Approval 검증; 일반화·권한은 후속 | Original과 Token-2022 분리, 활성 Extension만 |

TRON의 주소·metadata·선택 balanceOf 및 allowance 조회 경로를 구현했다. 상태는 latest로 조회하며 정확한 블록은 UNKNOWN, 판정은 INCONCLUSIVE다. TRON 공개망의 승인 실행·자원·통제·최종성과 Solana는 후속 조사/구현 항목이다. 사설 TVM Fixture의 승인·이벤트 검증을 공개 자산의 지원/판정으로 확대하지 않는다. [현재 TRON 지원](TRON_READONLY.md).

| 서비스 | 필요한 후속 검증 |
|---|---|
| Custody | 신원, 잔액, 입출금, freeze/clawback, sweep, 이벤트, 정합성 |
| Exchange | 입금 탐지, 출금, 이벤트 중복, 최종성, 대사 |
| Payment | 정확한 수취량, 수수료, 결제 완료, 동결 통제 |
| Stablecoin Issuer | mint/burn, supply, authority, freeze/blacklist, 발행·상환 정합성 |

현재 baseline과 exact-receipt는 최소 기술 정책이다. 전체 서비스 프로필의 구현이나 자산 취급 승인이 아니다.

별도 [사설 TVM 실행기](TRON_TVM_RUNTIME.md)는 정상 Fixture 하나의 실제 배포·receipt·runtime code·초기 상태를 확인한다. 읽기 전용 Adapter의 UNKNOWN/INCONCLUSIVE 판정과 support를 승격하지 않는다. [정상 Fixture의 전송·승인·이벤트와 철회/미승인 REVERT](adr/0016-private-tvm-token-scenarios.md)도 별도 검증했다. [정상 Fixture의 0 금액·잔액/승인량 부족·rollback](adr/0017-private-tvm-boundary-scenarios.md)도 별도 검증한다. [false/malformed 반환·이벤트 누락 transfer Fixture](adr/0018-private-tvm-negative-fixtures.md) 대조도 추가했다. 이는 사설 검증기 증거이며 일반 비표준 토큰 지원을 의미하지 않는다. 추가 비표준 동작과 자원·최종성 평가는 후속 작업이다.

사용자 요청에 따른 [스테이블코인 프로필 조사](STABLECOIN_PROFILES.md)는 Solana USDC/USDT와 XRP Ledger USDC/RLUSD, Ethereum RLUSD도 포함한다. 이는 공식 식별자/공백 조사이며 Solana/XRPL 실행 Adapter 구현이나 실제 mint/ledger 검증 완료가 아니다. XRPL은 currency+issuer 및 trust-line/ledger 의미를 별도로 다룬다.

[Solana·XRPL 계정 모델 조사](STABLECOIN_ACCOUNT_MODELS.md)에서 mint/Token Account/delegate와 currency+issuer/trust-line/실수령량의 증거 요구를 정리했다. 공식 프로토콜 조사이며 실제 자산 설정·계정·거래 관측 및 Adapter 구현은 미완료다.
