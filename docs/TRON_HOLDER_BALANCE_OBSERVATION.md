# TRON USDT 사용자 제공 주소의 잔액 관측

2026-10-20에 사용자가 TRON·USDT와 공개 holder 주소를 지정하고 잔액 읽기를 요청했다. 기존 TRON 읽기 전용 CLI로 한 번 실행했으며, [원본 Assessment](../reports/tron-usdt-user-holder-readonly.json)에 주소·계약·요청·응답을 보존했다. 이번 문서 정리에서는 추가 RPC를 호출하지 않았다.

| 항목 | 관측 결과 |
|---|---|
| 네트워크 | provider chain ID `728126428` 비교 |
| 자산 | 기존 TRON USDT 참조 계약, metadata Tether USD / USDT |
| 관측 시각 | `2026-10-20T07:59:49.804Z` UTC |
| 잔액 응답 | raw uint256 십진 문자열 `"0"`, metadata decimals 6 → **0 USDT** |
| 읽기 상태 | `TRC20-000`, COMPLETED, readStatus OK |
| 판정·지원 | INCONCLUSIVE / UNKNOWN |
| 정확한 getter 상태 블록 | UNKNOWN (`latest`) |
| 요청 수 | 9회 중 성공 응답8회, 마지막 head 확인1회 HTTP 429 |
| 원본 파일 | JSON Schema 확인, POSIX0600 |

이 주소는 사용자가 조회 대상으로 제공한 holder다. 입금·출금·sweep 목적이나 서비스 운영 계정이라는 주장은 받지 않았으므로 기존 서비스 입력 schema에 그 목적을 임의로 넣지 않았다. 주소 제공은 소유권·키 통제·운영 역할 인증이 아니다. 일반 Assessment와 [서비스 계정 원본 입력 runner](SERVICE_ACCOUNT_READONLY.md)의 envelope를 구분한다.

## 무엇을 확인했는가

저장된 JSON의 체인·계약·holder와 scenario evidence를 대조했다. balanceOf calldata의 전체 주소 인자·token target·latest tag가 지정한 요청과 일치하고, 원시 결과가 정확한32byte uint256이며 디코딩 값이 관측 문자열 `"0"`과 같은지 확인했다. decimals는 이번 metadata 응답의6을 사용했다. `TRC20-000`의 참조 `e10/e11/e13`은 이 보고서의 namespace에 속한다.

부수 읽기는 chain ID·head·contract code·metadata다. 총9개 요청의 메서드는 eth_chainId, eth_getBlockByNumber, eth_getCode, eth_call뿐이며 transfer/approve·서명·broadcast는 없다. spender를 지정하지 않아 allowance getter도 호출하지 않았다. 기존 제품 CLI transport를 사용했으며 별도 연구 runner의32요청/redirect 금지 한도를 이 실행에 적용했다고 주장하지 않는다.

원본 SHA-256:

```text
0c880d3437d6f6923e53905ee43c73736c53328585abb0c2337e13290c604628
```

[정적 계정 증거 인덱스](research/stablecoin-account-evidence.json)의 `userRequestedHolderObservations`에 별도 연결했다. 기존 catalog의14개 보고서 참조와 snapshot hash는 그대로이며, 이번 관측을 서비스 계정 인증이나 사설 Fixture 결과로 합치지 않는다. 보고서·증거의 hash는 저장 내용의 대조 수단이며 독립적인 provider 인증은 아니다.

## 마지막 블록 확인 오류와 미확인 범위

초기 head 참조는87270044였고 마지막 `eth_getBlockByNumber` 요청은 **HTTP 429**를 반환했다. `closingHeadAvailable=false`, `headChanged=UNKNOWN`이 원본에 남아 있다. 잔액의 성공 응답을 실패로 덮지 않으며, 반대로 초기 head를 잔액 응답의 정확한 상태 블록으로 사용하지 않는다. HTTP 상태만 저장돼 있어 발신 주체·세부 제한 원인을 확정하지 않는다. 재시도·다른 endpoint·프록시 변경은 하지 않았다.

잔액0은 조회 당시 해당 토큰 getter의 응답이다. 계정 활성화·지갑 소유권·다른 자산 잔액·전송 가능성·동결 여부·미래 잔액을 뜻하지 않는다. 정확한 상태 블록과 최종성은 미확인이다. 전체 결과는 metadata/잔액2 INCONCLUSIVE, 나머지6 NOT_TESTED이며 실제 전송·승인·관리 권한은 실행하지 않았다.

## 출처와 다음 시작 조건

주소와 잔액 조회 목적의 출처는 사용자 대화다. 실행 전 자산 식별 참조와 공개 JSON-RPC 안내를 [Tether Supported Protocols의 TRC20 항목](https://tether.to/en/supported-protocols/) 및 [TRON JSON-RPC overview](https://developers.tron.network/reference/json-rpc-api-overview)에서 확인했다. 이 문서는 해당 실행의 이력이며 새 공식 출처 확인이나 현재 provider 가용성 인증은 아니다. RPC endpoint·인증정보는 원본 보고서/인덱스에 기록하지 않는다.

일반 holder 잔액 조회와 증거 보존은 완료했다. 다음을 자동으로 연쇄 실행하지 않는다. 승인량 확인에는 사용자가 지정한 owner와 spender·조회 목적이 필요하고, 서비스 계정 검증에는 별도의 운영 목적·출처가 필요하다. 정확한 응답 블록 검토는 [기존 조사](research/TRON_RESPONSE_BLOCK_BINDING.md)의 재검토 근거가 있을 때 진행한다. 잔액0이라는 이유로 조회 대상 주소를 바꾸거나 새 표본을 만들지 않는다.
