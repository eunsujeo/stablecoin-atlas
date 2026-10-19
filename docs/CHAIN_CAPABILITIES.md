# 체인별 의미와 향후 서비스 프로필

| 항목 | EVM ERC-20 (현재) | TRON (계획) | Solana (계획) |
|---|---|---|---|
| 식별 | chain ID + contract | network + TRON address | cluster + mint + token program |
| 승인 | approve/allowance/transferFrom | TRC-20, TVM 의미 별도 검증 | delegate와 authority, allowance와 억지로 동일화 금지 |
| 계정 준비 | 테스트 주소 잔액 | 계정 활성화 등 조사 필요 | Token Account/ATA 생성 |
| 자원 | receipt gasUsed 증거 | Energy/Bandwidth/feeLimit | fee/compute/account 제약 |
| 통제 | 알려진 Fixture pause/blacklist만 | 독립 조사 | mint/freeze authority/확장별 권한 |
| 확장 | proxy/허가형 토큰은 후속 | TRON 고유 이벤트 모델 | Original과 Token-2022 분리, 활성 Extension만 |

TRON/Solana 코드는 아직 존재하지 않는다. 위 내용은 구현 계약이 아닌 후속 조사 항목이다.

| 서비스 | 필요한 후속 검증 |
|---|---|
| Custody | 신원, 잔액, 입출금, freeze/clawback, sweep, 이벤트, 정합성 |
| Exchange | 입금 탐지, 출금, 이벤트 중복, 최종성, 대사 |
| Payment | 정확한 수취량, 수수료, 결제 완료, 동결 통제 |
| Stablecoin Issuer | mint/burn, supply, authority, freeze/blacklist, 발행·상환 정합성 |

현재 baseline과 exact-receipt는 최소 기술 정책이다. 전체 서비스 프로필의 구현이나 자산 취급 승인이 아니다.
