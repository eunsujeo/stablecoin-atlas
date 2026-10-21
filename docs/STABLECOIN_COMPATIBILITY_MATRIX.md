# 스테이블코인 호환성 검토표

2026-10-21 현재 확보한 소스와 관측을 통합했다. 범위는 체인·구현별 전송/승인 조건과 제어 설정이다. 권한은 선택 소스 확인으로 검토하며 서비스 운영·수탁 장부·실제 권한 행사를 완료 조건으로 요구하지 않는다. [ADR0026](adr/0026-source-based-compatibility-scope.md), [Solana 연구 경계](adr/0027-solana-mint-research-reader.md), [XRPL 연구 경계](adr/0028-xrpl-issuer-research-reader.md)를 따른다.

[통합 요약 JSON](research/stablecoin-compatibility-summary.json)은8개 프로필의 식별자·조건·근거 파일/hash·미검증 범위를 연결한다. 기존 [소스 기록](research/stablecoin-source-compatibility.json), [카탈로그](research/stablecoin-profiles.json), [과거 증거 인덱스](research/stablecoin-account-evidence.json)는 보존한다. 이번 통합에는 새 RPC·컴파일·거래가 없다.

## 8개 프로필의 현재 근거

| 프로필 | 확보한 근거 | 제품/연구 구현 | 남는 범위 |
|---|---|---|---|
| Ethereum USDC | 고정 Circle 선택 소스 SOURCE_REVIEWED + 기존 읽기 | EVM 읽기 엔진·사설 Fixture | 배포 전체 동일성·실제 역할/권한 미검증 |
| Ethereum USDT | 고정 제3자 local/forward 소스 SOURCE_REVIEWED + 기존 읽기 | EVM 읽기 엔진·사설 Fixture | 발행사 revision·전달 대상 내부·배포 동일성 미확인 |
| Ethereum RLUSD | 직접 소스 + [explorer35개 Solidity/55개 import의 선택 상속 검토](RLUSD_EXPLORER_SOURCE_INTAKE.md) SOURCE_REVIEWED | EVM 읽기 엔진·사설 Fixture | 새 V2와 이전 ZIP은 다른 snapshot. 배포 동일성·실제 권한 미검증 |
| TRON USDT | [제공 소스10개/9개 import](TRON_EXPORTED_SOURCE_REVIEW.md)의 선택 경로 SOURCE_REVIEWED + 기존 읽기 | TRON 읽기 엔진·사설 TVM Fixture | 추론 파일명·배포 동일성·전달 대상 내부·getter 정확한 블록 미확인 |
| Solana USDC | [실제 mint program/초기화/decimals/supply/authority 필드 OBSERVED](SOLANA_MINT_READONLY.md) | [공통 mint/Token Account 읽기](ACCOUNT_STATE_READONLY.md) + 별도 연구 reader | 실제 Token Account 관측·전송/철회·키 통제 미검증 |
| Solana USDT | 같은 응답의 독립 mint 관측 OBSERVED | [공통 mint/Token Account 읽기](ACCOUNT_STATE_READONLY.md) + 별도 연구 reader | USDC 관측과 별개. 실제 Token Account 관측·행위 미검증 |
| XRPL USDC | [동일 validated ledger의 issuer 설정 OBSERVED](XRPL_ISSUER_READONLY.md) | [공통 issuer/trust-line 읽기](ACCOUNT_STATE_READONLY.md) + 별도 연구 reader | currency 발행량·실제 trust-line 관측·Payment·amendment·실제 권한 미검증 |
| XRPL RLUSD | 같은 ledger의 독립 issuer 관측 OBSERVED | [공통 issuer/trust-line 읽기](ACCOUNT_STATE_READONLY.md) + 별도 연구 reader | Ethereum RLUSD 코드/role과 별개. 실제 trust-line 관측·행위 미검증 |

SOURCE_REVIEWED는 선택 snapshot의 조건 검토, OBSERVED는 명시된 응답/필드 관측이다. 둘 다 제품 PASS/SUPPORTED·발행사 인증·취급 승인이 아니다. 사설 Fixture 성공은 실제 토큰의 전송 성공 증거가 아니다.

## EVM·TVM: 선택 소스의 전송·승인 차이

아래는 고정 소스의 조건이며 현재 배포의 동일 실행을 인증한 표가 아니다. USDT local 경로는 deprecated=false에 한정한다.

| 프로필/소스 | transfer 반환 | local approve | transferFrom allowance | 선택 수수료 경로 |
|---|---|---|---|---|
| USDC V1 계열, 승인 V2.2 별도 | transfer/transferFrom 명시적 true | nonzero owner/spender, 값 대입·Approval. zero-reset 강제 없음 | V1 선택 본문은 MAX 포함 차감, 이 차감 경로에 추가 Approval 없음 | 선택 본문은 금액 이동·Transfer |
| Ethereum USDT | bool 출력 선언 없음 | nonzero→nonzero 거부, 0 초기화 필요. Approval·출력 없음 | 유한 allowance 차감, MAX 유지 | capped fee와 owner fee 전송 가능 |
| RLUSD 새 explorer snapshot | transfer/transferFrom 명시적 true | nonzero owner/spender, 덮어쓰기·Approval·true, zero-reset 강제 없음 | 유한 allowance 차감 시 emitEvent=false, MAX 유지 | 선택 `_update` 경로에 fee 차감 없음 |
| TRON USDT 제공 snapshot | transfer는 중간 fee 상속에서 명시적 return 누락. transferFrom은 true | pause 후 덮어쓰기·Approval·true, zero-reset 강제 없음 | 유한 allowance 차감, MAX 유지, 이 경로에 추가 Approval 없음 | capped fee, net/owner 순차 잔액 변경 |

TRON은 최상위 TetherToken의 `return super.transfer`와 중간 StandardTokenWithFees의 결과 버림/return 생략을 함께 확인했다. ABI의 bool 선언만으로 true 성공을 보장하지 않는다. 실제 반환값은 NOT_TESTED이며 false/empty·FAIL·취약점으로 확정하지 않는다. sender/recipient/owner가 겹치는 fee 분기의 순차 상태 변경도 단순한 최종 차감으로 일반화하지 않는다.

제한 조건도 소스/버전을 구분한다.

- **USDC:** V1 transfer는 pause와 sender/to blacklist, transferFrom은 pause와 caller/from/to blacklist를 검사한다. approve의 V1 blacklist 조건과 V2.2 override의 pause만 명시한 경로를 구분한다. 선택 소스와 실제 배포 binding은 별도다.
- **Ethereum USDT:** transfer/transferFrom은 pause와 sender/from blacklist를 검사한다. local approve에는 해당 pause/blacklist modifier가 없다. deprecated 경로에 전달 대상의 구현 조건을 일반화하지 않는다.
- **RLUSD:** base `_update`의 from/to/caller 제한과 V2의 to/caller 검사·조건부 from 예외를 구분한다. V2의 `to==0 && from!=caller` 예외도 global pause·to/caller 제한은 유지한다. approve는 spender/caller 계정 pause와 global pause를 검사한다. permit은 owner/spender/caller/global pause 뒤 상속 deadline·nonce·복구 signer/owner 검사를 수행한다.
- **TRON USDT:** transfer/transferFrom은 pause와 sender/from blacklist를 검사한다. recipient·spender·caller 전체의 blacklist 검사로 확대하지 않는다. approve/increase/decreaseApproval도 pause 검사하며 decrease는 부족하면0으로 제한한다. deprecated 전달 대상 본문은 미확보다.

근거는 기존 JSON의 `usdc-*`, `usdt-*`, `rlusd-*`와 [RLUSD 상속8개 findings](research/rlusd-explorer-source-review.json), [TRON10개 findings](research/tron-export-source-review.json)의 파일/hash/줄 구간이다. RLUSD의 이전 ZIP 상속 공백은 원래 기록으로 보존하며 현재 결론에는 새 explorer 검토를 적용했다.

## 소스상 권한 구조

| 소스 | 확인한 권한·조건 | 해석 경계 |
|---|---|---|
| USDC | minter/masterMinter/pauser/blacklister/rescuer/owner 역할, 민팅 한도·pause·blacklist 등 선택 조건 | rescuer는 계약 보유 외부 토큰 회수. 일반 사용자 지갑 임의 인출로 확대하지 않음. token owner와 proxy admin 구분 |
| Ethereum USDT | onlyOwner의 pause·blacklist·blacklisted funds 파기·issue/redeem·fee·deprecate | owner 잔액/supply·local/전달 분기 구분. EIP-1967 업그레이드와 동일시하지 않음 |
| RLUSD | MINTER/BURNER/CLAWBACKER/PAUSER/UPGRADER, role admin의 grant/revoke와 caller 확인 renounce, onlyProxy UUPS 문맥 + token 권한 hook | 초기 BURNER grant 누락이 역할 부재 증거는 아님. 새 V2 initializeV2/reinitializeV2와 이전 ZIP 함수명 차이 보존 |
| TRON USDT | onlyOwner의 pause·blacklist·issue/redeem·destroyBlackFunds·fee·deprecate | destroy의 balanceOf는 전달될 수 있어도 변경은 local 상태. Migrations/MultiSigWallet은 token 경로 밖이며 실제 owner multisig 증거가 아님 |

관리자·수수료·zero-reset의 존재 자체는 실패나 취약점이 아니다. 현재 역할 계정·키 통제·실제 행사와 소스/배포 동일성의 UNKNOWN/NOT_TESTED는 유지한다.

## Solana: 같은 context에서 독립 관측한 두 mint

관측2026-10-21T00:53:41.893Z, 요청 commitment finalized, 공통 응답 context slot459436079다. mainnet genesis 응답 일치 후 RPC2회로 확보했다.

| 관측 | USDC | USDT |
|---|---|---|
| program / 형식 | Original Token Program / 초기화된82-byte mint | 동일 형식의 별도 mint |
| decimals | 6 | 6 |
| supplyRaw | `7501509767291454` | `3839903226371819` |
| mint/freeze authority 필드 | 둘 다 PRESENT, 서로 다른 주소 | 둘 다 PRESENT, 같은 주소 |

주소·본문/hash는 [관측 JSON](research/solana-mint-observation.json)을 따른다. context slot은 마지막 변경 slot/블록 hash가 아니다. authority 필드는 키 통제나 행사 증명이 아니며 supply는 응답 시점의 raw 수치다. wallet·Token Account·ATA·mint는 다른 문맥이고 delegate는 개별 Token Account 상태다. mint 관측으로 holder 잔액·delegate·Token-2022 확장이나 전송 결과를 추정하지 않는다.

## XRPL: 같은 validated ledger의 두 issuer 설정

관측2026-10-21T01:11:56.199Z, ledger index107795106, hash `06CDF41C72C0CE1C2634450ADA368892F6CAA9D48C7685FE411DFDA9232A4EA2`다. 서버 보고 network_id0 확인과 ledger 고정 후 RPC4회로 확보했다.

| AccountRoot 설정 | USDC | RLUSD |
|---|---|---|
| RequireAuth / NoFreeze / GlobalFreeze | 각각 false | 각각 false |
| AllowTrustLineClawback | false | true |
| DisableMaster / DefaultRipple | 각각 true | 각각 true |
| TransferRate 원시 필드 | NOT_PRESENT | NOT_PRESENT |

원시 Flags와 미해석 비트는 [관측 JSON](research/xrpl-issuer-observation.json)에 보존한다. issuer 설정은 개별 trust-line의 freeze/auth/잔액 상태가 아니다. Clawback 비트로 실제 회수나 amendment 활성을 인증하지 않고 DisableMaster로 서명 불가능을 단정하지 않는다. TransferRate 누락을0으로 합성하거나 실제 수수료 검증으로 표시하지 않는다. 자산 식별은 currency+issuer이며 issuer 조회만으로 해당 currency의 유통량·실수령량을 검증한 것은 아니다.

## 완료와 남는 경계

현재 약정한 엔진·사설 Fixture·선택 소스 검토와 후속 승인된 mint/issuer 연구 읽기를 완료했다. 제품 Assessment와 과거 보고서 판정, 기존15개 보고서/catalog hash를 보존한다. 최신 전체 검사는212개 통과, 실패·skip0이다. 소스 참조와 추가 연구 보고서의 hash·조건·시점도 대조한다.

배포 bytecode 전체 재현, TRON 정확한 getter 블록/전달 대상 구현, Solana 지갑 전체 계정 탐색·위임/거래 실행, XRPL trust-line 변경/Payment·거래 실행은 별도 공백이다. 실제 권한 행사·운영 지갑·서비스 장부·발행사 준비자산/상환 검증은 현재 완료 조건이 아니다. 새 요구가 없는 동일 RPC·Fixture·문서 확장을 반복해 종료를 미루지 않는다. 상세 이력과 선택 범위는 [작업 목록](STABLECOIN_EVIDENCE_BACKLOG.md) 및 각 보강 문서/원본 JSON을 따른다.

후속 체인 연결 승인으로 [Solana mint-only 공통 Adapter](SOLANA_ADAPTER.md)를 구현했다. 새 공통 CLI 두 보고서의 slot은 각각459449963/459449966이며 위 과거 동시 연구 snapshot과 합치지 않는다. XRPL도 후속 승인으로 아래 공통 issuer 경로를 연결했다.

[XRPL issuer 공통 Adapter](XRPL_ADAPTER.md)도 연결했다. 통화 식별자·NA 필드를 추가한 새 validator에서 기존 보고서와 XRPL 보고서를 검사한다. 새 USDC/RLUSD 보고서의 ledger107795780/107795781은 각각 별도 관측이며 위 과거 동시 연구 ledger와 합치지 않는다. 고정된 구버전 소비자는 XRPL schema 갱신이 필요하다.

후속 사용자 승인으로 [Solana 명시 Token Account·XRPL holder trust-line 읽기](ACCOUNT_STATE_READONLY.md)를 구현했다. 기존 mint/issuer-only 제외 조건에서 이 설정 읽기만 확장한 것으로, 실제 거래·권한 행사·서비스 운영은 제외한다. 실제 계정 단위 공개망 관측은 NOT_TESTED이며 기존 mint/issuer 보고서와 분리한다.

**현재 마일스톤 마감:** [완료 보고](STABLECOIN_MILESTONE_COMPLETION.md). 새 공개 표본4개를14회 읽기로 확인해 Solana Token Account2개 관측과 XRPL 선택 line2개 부재를 기록했다. HTTP/RPC 오류0, 원본 증거 보존·새 보고서 정합성 검증 통과. 현재 필수 미완료 작업은 없으며 양수 XRPL 보유 line·실제 전송/권한 행사 등 남는 한계를 후속 자동 작업으로 계속 늘리지 않는다.

후속 사용자 승인된 [XRPL 양수 보유 trust-line 연구](XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 완료했다. USDC/RLUSD AMM 표본의 잔액·설정을 동일 ledger의 직접 RippleState로 관측했다. 공통 account_lines Adapter는 해당 표본에서3페이지 미완료였으며 기존 INCONCLUSIVE 보고서와 분리한다. 추가 연구18회 읽기·거래0회, 제품 코드/기존212개 검사 이력은 유지한다.
