# XRPL 실제 보유 trust-line 관측 완료

2026-10-21 사용자 승인에 따라 USDC·RLUSD를 실제 보유한 공개 표본을 확인했다. **두 AMM 특수 계정의 양수 잔액과 양측 설정을 같은 validated ledger에서 관측**했다. 일반 개인 지갑이나 서비스·수탁 계정의 운영 인증은 아니다. 기존 제품 코드는 변경하지 않았다.

## 최종 관측

직접 조회 ledger는107797509, hash는 `A3D6696A4EBC62BADF174BF4D0762A56AC43E8F4FB3E781CD40230885C5E99EB`다. 금액은 부동소수점으로 바꾸지 않은 원문 기반 문자열이다.

| 항목 | USDC | RLUSD |
|---|---|---|
| 공개 AMM holder | `rM7cHVPfhe9yxQNk2kDNBEQqoQmMcQGPWE` | `rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3` |
| holder 관점 잔액 | **137002.6309953493** | **2436280.212624066** |
| holder의 RippleState 쪽 | HIGH | LOW |
| 원시 Balance.value | `-137002.6309953493` | `2436280.212624066` |
| holder / issuer 한도 | 각각 문자열`0` | 각각 문자열`0` |
| holder / issuer Auth 비트 | 각각 false | 각각 false |
| holder / issuer Freeze 비트 | 각각 false | 각각 false |
| holder / issuer DeepFreeze 비트 | 각각 false | 각각 false |
| holder / issuer NoRipple 비트 | 각각 false | 각각 false |
| lsfAMMNode | true | true |

RippleState 잔액은 low 계정 관점으로 저장된다. USDC 표본 holder는 high 쪽이므로 원시 음수의 부호만 바꾸어 양수 보유량을 얻었다. RLUSD holder는 low 쪽이므로 원문 부호를 유지했다. 한도0이나 Auth 비트false를 보유 불가·동결·실제 전송 실패로 판정하지 않는다. AMM 계정의 설정을 일반 지갑의 동작으로 일반화하지 않는다. [공식 RippleState 정의](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/ripplestate).

## 선정과 조회 경로

1. 기존 공식 공개 RPC를 최초 목적지로 선택하고 server_info의 network_id0과 validated ledger/hash를 확인했다.
2. [amm_info](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/path-and-order-book-methods/amm_info)로 **XRP/허용 USDC, XRP/허용 RLUSD 두 pair만** 읽어 amm.account를 선정했다. LP token 수량과 스테이블코인 수량을 구분했으며 auction/vote 참여자 목록은 저장하지 않았다. 보유자 전체 목록이나 개인 지갑을 탐색하지 않았다.
3. 기존 공통 Adapter로 각 표본을 한 번 읽었지만, 두 account_lines 경로 모두 limit20·최대3페이지 상한에서 `PAGINATION_LIMIT`, complete=false가 되었다. 총16회 RPC이며 common 보고서2개는 INCONCLUSIVE 그대로 보존했다.
4. 이 제한에 대응해 별도 연구 단계에서 [ledger_entry](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/ledger-methods/ledger_entry)의 ripple_state accounts+currency를 지정하여 **이미 고정된 두 line만 각1회** 직접 읽었다. 최초 선정 ledger_hash를 재사용했다. 페이지 수·제품 허용목록을 변경하지 않았다.

추가2회를 합친 총18회 읽기이며 HTTP/RPC 오류·재시도·endpoint 전환·거래 전송은0회다. 연결/프록시 오류가 난 뒤 다른 경로로 우회한 것이 아니라 성공 응답의 페이지 한계에 대응한 정확한 단일 entry 조회다. 관리형 proxy·NO_PROXY·TLS 설정을 그대로 상속했다.

직접 응답의 validated/hash/index, RippleState 타입, LowLimit/HighLimit의 정확한 계정 쌍과 통화, decoded AccountID 정렬, 원시 Balance와 두 limit 문자열을 검사했다. 요청 계정·통화로 계산한 SHA-512Half entry ID도 반환 index와 일치했다. Balance.issuer의 특수 표기는 실제 발행사 주소로 해석하지 않는다.

Flags는 고정된 공식 rippled commit `ef5064eeb9e0ce467fae4694d58609de84109131`의 LedgerFormats.h 마스크로 해석했다. low/high Auth·Freeze·DeepFreeze·NoRipple와 AMMNode를 구분하고 raw/미해석 비트를 보존했다. AccountRoot/asf/TrustSet tf 마스크와 혼용하지 않는다.

## 증거와 검증 범위

[관측 인덱스](research/xrpl-held-trustline-observation.json)에 다음 파일과 hash를 연결했다.

- `reports/xrpl-usdc-amm-holder-readonly.json`, `reports/xrpl-rlusd-amm-holder-readonly.json`: 기존 Adapter의 페이지 미완료 보고서. 공통 정합성 검증 통과는 관측 성공을 뜻하지 않는다.
- `reports/xrpl-amm-sample-selection-research.json`: 고정 pair 선정·16회 호출·미완료 근거.
- `reports/xrpl-held-trustline-direct-research.json`: 추가2회 직접 조회·선택 원시필드·양측 설정·잔액 방향 해석. 공통 AssessmentReport가 아닌 연구 기록이다.

모두0600 새 파일이며 이전 보고서를 덮어쓰지 않았다. 직접 관측 전에 low/high·양/음수·0/-0·지수 표기 로컬12개 해석 사례를 확인했고, 관측 후 별도 Decimal·정수 연산으로 원시 잔액 방향과 flags를 다시 대조했다. 구현 source/schema/test/package hash는 기존 전체212개 통과 시점과 동일하다. 이번에 제품 코드 수정이나 전체 검사 재실행은 하지 않았으며,212개 이력을 새 연구 reader의 검증으로 바꾸지 않는다.

**이번 양수 보유 표본 조사 단계는 완료했다.** 제품 Adapter의3페이지 제한은 그대로 남는다. 직접 연구 관측을 공통 Adapter 성공·PASS/SUPPORTED로 승격하지 않는다. 실제 전송·서명·키 통제·권한 행사·amendment 활성 인증·자산 안전성은 NOT_TESTED/UNKNOWN 경계를 유지한다. 앞선 [마일스톤의 예제 계정 line 부재](STABLECOIN_MILESTONE_COMPLETION.md)는 당시 표본의 역사로 보존한다.
