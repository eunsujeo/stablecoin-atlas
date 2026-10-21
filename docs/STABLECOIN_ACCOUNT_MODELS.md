# Solana·XRPL 스테이블코인 계정 모델과 필요한 증거

공식 문서 확인: **2026-10-20T07:31:45Z(UTC)**. 대상은 기존 조사 프로필의 Solana USDC/USDT와 XRP Ledger USDC/RLUSD다. 아래는 일반 프로토콜의 문서상 모델과 프로젝트의 후속 증거 요구다. 각 자산의 현재 mint/issuer 설정·서비스 계정·잔액·거래를 관측한 결과가 아니다.

이번 작업은 문서 조사다. 기존 [식별자 카탈로그](research/stablecoin-profiles.json)·mainnet 보고서와 그 해시를 보존한다. 발행사 식별자 참조는 기존 카탈로그의 출처·조회 시점에 속하며 이번 프로토콜 조사로 재인증하지 않는다. Adapter는 NOT_IMPLEMENTED, 새 읽기·행위 실행은 NOT_TESTED, 실제 권한·지원·native/bridged·발행사 검증은 UNKNOWN이다.

## 같은 잔액·승인 표를 그대로 쓸 수 없는 이유

| 축 | EVM/ERC-20·TRON/TRC-20의 기존 경로 | Solana 조사 대상 | XRPL 조사 대상 |
|---|---|---|---|
| 자산 식별 문맥 | network + token contract | cluster + mint, 실제 program 확인 필요 | network + currency + issuer |
| 보유 상태 | 계약의 account 잔액 조회 | mint별 Token Account와 그 owner | holder 관점의 issuer와의 trust-line |
| 위임/인가 문맥 | owner/spender pair allowance | 개별 Token Account의 delegate와 delegated amount | trust-line 인가·한도는 별도 의미; ERC-20 allowance로 변환하지 않음 |
| 제어 문맥 | 배포별 getter·코드 근거 | mint/계정 authority·상태·활성 확장 | issuer AccountRoot와 양측 trust-line flags |
| 시점 증거 요구 | 기존 EVM pin 또는 TRON UNKNOWN | 응답 context slot·commitment | validated ledger hash·index |

이 표의 Solana/XRPL 열은 후속 조사·검증의 구분 기준이며 공통 domain/schema 변경안이 아니다. ERC-20 메서드 자체는 이 두 모델에 NOT_APPLICABLE로 구분할 수 있지만, 그 사실로 체인의 위임 기능 부재나 자산 권한 UNKNOWN을 대체하지 않는다.

## Solana: mint·wallet·Token Account·ATA

Mint는 supply·decimals·mint/freeze authority 등을 담고 Token Account는 특정 mint의 잔액·owner·상태 등을 담는다. 기본 account의 program-owner와 Token Account 데이터의 owner(전송 권한)는 다른 필드다. 한 wallet이 같은 mint의 Token Account를 여러 개 보유할 수 있다. ATA는 대표 파생 주소의 Token Account이며 모든 Token Account가 ATA인 것은 아니다. 따라서 ATA 한 개의 잔액만으로 wallet 전체 잔액을 확정하면 안 된다. [Solana Tokens: Mint/Token Account/ATA](https://solana.com/docs/tokens).

일반 Token Account에는 현재 delegate와 delegated amount가 하나씩 저장되고 새 delegate 승인은 기존 승인 상태를 교체한다. delegate는 허용된 양의 전송·소각에 사용된다. 이 계정별 상태를 wallet owner×spender의 다중 allowance 표로 복제하지 않는다. revoke 후 잔여량, owner/close authority 변경, mint/freeze authority는 서로 다른 검증 축이다. 이번에는 승인·철회를 실행하지 않는다. [Approve Delegate: What Does Approving a Delegate Do?](https://solana.com/docs/tokens/basics/approve-delegate).

Original Token Program과 Token-2022를 구분하고, 확장은 mint용과 계정용을 나눠 실제 활성 상태를 확인해야 한다. transfer fee·hook·permanent delegate·default account state는 조사 후보이며, USDC/USDT가 사용한다는 뜻이 아니다. 심볼·SPL이라는 명칭·주소 모양만으로 프로그램이나 확장을 추정하지 않는다. [Token Extensions](https://solana.com/docs/tokens/extensions).

프로젝트의 후속 읽기 증거 요구:

| 대상 | 필요한 입력·관측 | 해석 경계 |
|---|---|---|
| mint | cluster 근거, mint 주소, account program-owner·형식·초기화, raw supply·decimals, 각 authority/확장 | 공개 주소의 형태·문서상 프로그램 기능만으로 실제 설정 확정 금지 |
| holder | wallet 또는 명시 Token Account, 목적·출처, account별 mint/program/owner/state/raw amount | wallet·token-account 주소 역할 구분; ATA만 조사했으면 범위를 명시 |
| delegate | 구체적인 source Token Account와 delegate·raw delegated amount | owner/spender pair만으로 충분하다고 처리하지 않음 |
| 시점·완전성 | 요청 commitment, 응답 context slot, 필터·반환 계정 목록·오류 | 서로 다른 응답 slot을 동일 snapshot으로 합치지 않음 |

`getTokenAccountsByOwner`는 owner와 mint 또는 program 필터를 사용하고 context와 계정 배열을 반환한다. 후속 검증에서는 raw integer 문자열을 사용하고 `uiAmount`의 부동소수점 값을 계산 원본으로 사용하지 않는다. 이 문서에서는 RPC를 호출하지 않았다. [RPC: getTokenAccountsByOwner](https://solana.com/docs/rpc/http/gettokenaccountsbyowner).

## XRPL: currency+issuer·trust-line·issuer 계정

Trust-line token의 상태는 두 계정 사이의 currency별 RippleState 관계에 기록된다. 잔액은 양측 관점에서 부호가 반대이고 각 측의 설정·한도가 따로 있다. 한도는 ERC-20 spender 승인량이 아니다. XRP 자체, MPT, XRPL EVM Sidechain과도 구분한다. 이 문서의 범위는 기존 카탈로그가 기록한 trust-line token 모델이다. [Trust Line Tokens: Structure](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens).

`account_lines`의 조회 account는 perspective account, 각 line의 account는 counterparty다. balance 부호, limit/limit_peer, authorized/peer_authorized, freeze/freeze_peer는 그 방향을 보존해야 한다. holder 관점에서 counterparty가 지정 issuer인지도 함께 확인한다. 응답 ledger hash/index와 validated 여부, marker로 이어지는 페이지 범위를 기록해야 한다. 일부 페이지만 읽고 line 부재를 확정하지 않는다. 계정/line 부재·한도0·조회 실패도 자산 미지원이나 권한 부재와 같지 않다. 이는 본 프로젝트의 보수적 해석 요구다. [account_lines: Response Format](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_lines).

인가·동결·회수 기능은 아래처럼 별도 근거가 필요하다. 문서의 기능 존재는 해당 USDC/RLUSD issuer의 현재 flag나 실제 권한 행사를 입증하지 않는다.

| 조사 축 | 문서상 의미와 필요한 증거 |
|---|---|
| RequireAuth | issuer 설정과 해당 line의 issuer 측 인가를 함께 조사. trust-line 인가를 spender allowance로 해석하지 않음. [Authorized Trust Lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/authorized-trust-lines) |
| 동결 | Individual Freeze는 issuer로의 직접 지급 등 예외가 있으며, Deep Freeze·Global Freeze·No Freeze를 단일 blacklist bool로 합치지 않음. 특히 No Freeze도 모든 동결 가능성의 소멸을 뜻하지 않음. [Freezing Tokens](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes) |
| Clawback | issuer의 Allow Trust Line Clawback 설정과 관련 amendment 문맥을 별도 확인. NoFreeze와의 상호 제약·문서상 가능성과 실제 설정/행위를 구분. [Clawing Back Tokens](https://xrpl.org/docs/concepts/tokens/fungible-tokens/clawing-back-tokens) |

issuer AccountRoot와 holder trust-line을 **같은 validated ledger 문맥**에서 연결해야 한다는 것이 후속 증거 요구다. 이번 조사에는 계정 응답·현재 flag·활성 amendment snapshot이 없다. 설정 존재나 false 응답을 키 통제·전송 가능성·취급 승인으로 승격하지 않는다.

## XRPL 입금 대사: 요청량과 실수령량

Payment의 `Amount`(API v2에서는 `DeliverMax`)를 실제 입금량으로 대입하지 않는다. partial payment는 그 값보다 적게 수취해도 성공할 수 있다. 성공한 Payment metadata의 `delivered_amount`가 실수령 증거다. `SendMax`·`DeliverMin`과 XRP 거래 비용 `Fee`도 구분한다. [Partial Payments: Semantics / delivered_amount](https://xrpl.org/docs/concepts/payment-types/partial-payments).

프로젝트의 후속 대사 요구는 성공 결과뿐 아니라 **validated 상태·ledger hash/index·tx 식별자·목적지·currency/issuer·실수령량**의 연결이다. `tesSUCCESS`만으로 validated 입금 확정이라고 하지 않는다. [tx: Response Format](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/transaction-methods/tx).

`delivered_amount`가 누락되거나 `unavailable`이면 Amount로 대체하거나0으로 채우지 않는다. 실수령 UNKNOWN·대사 보류로 남기며, 필요하면 별도 검증을 거친 AffectedNodes 분석이 후속 작업이다. 이번에 대사 엔진·거래 자료를 구현/수집한 것은 아니다. [Partial Payments: delivered_amount](https://xrpl.org/docs/concepts/payment-types/partial-payments).

native XRP의 drops 단위와 issued token의 currency/issuer/value 십진 표현을 분리한다. XRPL issued token을 공통 uint256·고정 decimals 모델에 강제로 맞추지 않고, 금액·부호·필요한 지수 정밀도를 문자열과 정수 기반으로 보존해야 한다는 후속 구현 요구다. Number 변환은 사용하지 않는다. [Currency Formats](https://xrpl.org/docs/references/protocol/data-types/currency-formats).

## 프로필별 남은 자료와 다음 경계

| 기존 조사 프로필 | 문서 조사를 넘어 필요한 자료 |
|---|---|
| Solana USDC | mint·실제 program/authority/extension 관측, 목적·출처 있는 holder/Token Account/delegate 표본, slot/commitment |
| Solana USDT | 위와 동일한 증거를 독립 확보; USDC의 설정·잔액을 재사용하지 않음 |
| XRPL USDC | currency+issuer 재확인, 해당 issuer AccountRoot와 holder trust-line의 validated ledger 관측, 관련 Payment metadata |
| XRPL RLUSD | 해당 issuer/holder/거래의 독립 근거; Ethereum RLUSD 코드·역할 getter를 적용하지 않음 |

이번 문서는 두 account-model 공백의 **프로토콜 조사 부분**을 보강했다. 온체인 설정·지원·서비스 표본 공백을 해소한 것은 아니다. 제품 Adapter·SDK·입력 schema·읽기/거래 실행은 별도 범위 결정과 구현 검토가 필요하다. 기존 Ethereum/TRON [서비스 입력 도구](SERVICE_ACCOUNT_INTAKE.md)는 선택적 이력으로 보존하며 자료 확보를 기다리는 필수 작업이 아니다. 현재 완료 기준은 [소스 기반 호환성 검토](STABLECOIN_COMPATIBILITY_MATRIX.md)다.

## 후속 실제 관측: Solana mint

2026-10-21 [별도 연구 CLI](SOLANA_MINT_READONLY.md)로 두 mint를 실제 읽었다. mainnet genesis 응답 일치와 공통 finalized context slot459436079, Original Token Program·82-byte 초기화 mint·decimals6·supply·mint/freeze authority를 확보했다. 위 내용은 당시 문서 조사 이력이며 현재 관측은 별도 JSON을 따른다. 제품 Adapter·holder/delegate·행위 실행은 추가하지 않았고 실제 키 통제·issuer/native 인증도 하지 않았다.

## 후속 실제 관측: XRPL 발행자

2026-10-21 [별도 연구 CLI](XRPL_ISSUER_READONLY.md)로 두 issuer AccountRoot의 설정을 동일 validated ledger107795106/hash에서 읽었다. 위 문서 조사 당시 미관측 이력과 구분한다. RequireAuth/NoFreeze/GlobalFreeze/AllowTrustLineClawback/DefaultRipple/DisableMaster 필드를 관측했으며 개별 trust-line·Payment·실제 권한 행사·amendment는 검증하지 않았다.
