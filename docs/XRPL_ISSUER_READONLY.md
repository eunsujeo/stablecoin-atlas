# XRPL USDC·RLUSD 발행자 설정 읽기 연구

2026-10-21T01:11:56.199Z에 두 공식 발행자 계정의 AccountRoot를 읽었다. 서버 보고 network_id0 확인 후 validated ledger를 한 번 선택하고, 두 계정을 **동일 ledger hash/index**로 요청·응답 대조했다. RPC4회 성공이며 실제 권한 행사·서명·거래·trust-line 조회는 하지 않았다.

- ledger index: `107795106`
- ledger hash: `06CDF41C72C0CE1C2634450ADA368892F6CAA9D48C7685FE411DFDA9232A4EA2`
- 검증 상태: 서버가 해당 ledger와 두 account_info 응답에 validated=true를 보고함

| 설정 | USDC | RLUSD |
|---|---|---|
| 발행자 | `rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE` | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` |
| currency | `5553444300000000000000000000000000000000` | `524C555344000000000000000000000000000000` |
| 원시 Flags | `26804224` | `2174353408` |
| RequireAuth | false | false |
| NoFreeze | false | false |
| GlobalFreeze | false | false |
| AllowTrustLineClawback | false | true |
| DefaultRipple | true | true |
| DisableMaster | true | true |
| TransferRate 원시 필드 | NOT_PRESENT | NOT_PRESENT |
| 미해석 비트 합계 | `17367040` | `17432576` |

해석 대상은 AccountRoot의6개 lsf 비트다. 나머지 비트는 원시 Flags와 별도 합계로 보존하며 기능 부재로 판정하지 않는다. NoFreeze=false나 GlobalFreeze=false는 개별 trust-line/Deep Freeze 상태를 뜻하지 않는다. AllowTrustLineClawback은 그 계정 설정의 관측이며 실제 회수·현재 amendment·키 통제 인증으로 바꾸지 않는다. DisableMaster=true도 다른 서명 수단이나 계정 서명 불가능을 판정하는 근거가 아니다.

TransferRate 누락을0으로 합성하지 않았다. 문서의 기본 no-fee 의미와 별도로 실제 전송 수수료·실수령량은 NOT_TESTED다. 명시된0과1000000000도 reader에서 원시 문자열로 구분한다. 발행자 계정 조회 성공은 지정 currency의 발행량·유통·native 여부나 발행사 법적 실체 인증이 아니다.

[원본 연구 보고서](../reports/xrpl-stablecoin-issuers-readonly.json)와 [정적 관측·hash·공식 출처 기록](research/xrpl-issuer-observation.json)에 결과를 보존했다. network_id와 validated 상태는 제공자의 보고를 검증한 것으로, 독립적 암호학적 네트워크/합의 인증은 아니다. 기존 catalog와 제품 판정은 변경하지 않았다.

## 실행과 경계

```sh
npm run research:xrpl-issuers -- --public --out reports/xrpl-stablecoin-issuers-readonly.json
```

`--public`은 [공식 공개 서버 목록](https://xrpl.org/docs/tutorials/public-servers)의 mainnet JSON-RPC를 요청 전에 선택한다. 별도 제공자를 쓰려면 `XRPL_RPC_URL`을 설정하고 이 옵션을 생략한다. RPC URL·자격정보는 로그/보고서에 저장하지 않으며 자동 재시도나 endpoint 전환은 없다.

고정 순서는 server_info → ledger(validated) → account_info 두 번이다. API v2를 명시하고 account_info에 동일 ledger_hash만 지정한다. network_id 누락/불일치면 뒤 요청은0회다. ledger validated/hash/index/중첩 header가 유효해야 진행하며, 계정 응답의 validated/hash/index/Account/LedgerEntryType/uint32 Flags를 확인한다. 알 수 없는 필드·XRP Balance·RegularKey 등은 출력하지 않는다.

기존 연구 HTTP 경로를 공유하며 요청10초·본문64KiB·redirect 거부·오류문/비밀 비노출을 유지한다. HTTP/transport 실패 시 남은 호출도 중단한다. 한 계정의 RPC 오류/불일치와 다른 계정의 독립 성공은 구분한다. 보고서는 원자적으로0600 저장한다. 종료0은 두 설정 관측 성공,2는 INCONCLUSIVE 보고서,1은 옵션/환경변수/저장 오류이며 자산 PASS/FAIL 코드가 아니다.

[ADR0028](adr/0028-xrpl-issuer-research-reader.md)의 별도 연구 도구다. 제품 Adapter는 NOT_IMPLEMENTED, trust-line/Payment·실제 권한 행사는 NOT_TESTED, amendment 활성·발행사 인증은 UNKNOWN이다. 서비스 지갑 자료는 필요하지 않다.

## 공식 근거와 검증

확인일2026-10-21. [Circle의 currency+issuer](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Ripple의 RLUSD mainnet issuer·currency](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl), [AccountRoot](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/accountroot), [server_info](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/server-info-methods/server_info), [ledger](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/ledger-methods/ledger), [account_info](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_info)를 따른다.

마스크는 XRPLF/rippled commit `ef5064eeb9e0ce467fae4694d58609de84109131`의 [LedgerFormats.h](https://github.com/XRPLF/rippled/blob/ef5064eeb9e0ce467fae4694d58609de84109131/include/xrpl/protocol/LedgerFormats.h)에서 고정했다. snapshot/hash는 JSON에 연결했으며 실제 서버 바이너리 동일성은 미검증이다. AccountSet의 asf 번호를 비트 마스크로 사용하지 않는다.

일부 공식 RPC 문서는 web 도구에서 markdown content-type 오류가 있었고, 로컬 문서 GET 진단은 HTTP403 Forbidden / X-Squid-Error 없음 / Via 없음이었다. 정책 차단으로 확정하지 않았으며 원인은 미확정이다. 검색에 노출된 공식 문서와 별도 공개 protocol source를 구분했다. 이는 실제 XRPL RPC4회 성공 결과와 별개다.

로컬 모의 검증은 uint32 최상위 비트/MAX/오류, 원시 TransferRate 누락·0·1000000000, network 누락/다른 값 중단, unvalidated/열린/모순 ledger, 잘못된 issuer/type/hash/index·Flags, 부분 성공, HTTP/RPC/과대 본문/redirect 오류, 허용 읽기 메서드와 URL/오류문 비노출, CLI0600·기존 출력 보존을 확인한다. Solana 연구의 기존 경계 검증도 함께 통과했다.

전체 `npm run check`는193개 통과, 실패·skip0이었다. 새 XRPL 테스트5개와 기존 Solana 테스트4개를 포함한다. 실제 보고서/hash·동일 ledger·발행자 식별자·고정 source 마스크를 별도 로컬 대조했고, 기존15개 보고서/catalog와 Solana/TRON 소스·관측 증거도 보존 확인했다.
