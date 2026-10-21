# Solana USDC·USDT mint 읽기 연구

2026-10-21T00:53:41.893Z에 공식 문서의 두 mint를 읽었다. `getGenesisHash`는 기대 mainnet 전체 hash와 일치했고, 두 계정은 한 번의 `getMultipleAccounts` 응답에서 **context slot459436079 / 요청 commitment finalized**로 확보했다. 새 연구 도구의 실제 RPC2회이며 전송·승인·권한 행사는 하지 않았다.

| 관측 | USDC | USDT |
|---|---|---|
| mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| 프로그램 | Original Token Program | Original Token Program |
| 본문 | 82bytes, 초기화됨 | 82bytes, 초기화됨 |
| decimals | 6 | 6 |
| raw supply | `7501509767291454` | `3839903226371819` |
| mint authority | `BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG` | `Q6XprfkF8RQQKoQVG33xT88H7wi8Uk1B1CC7YAs69Gi` |
| freeze authority | `7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar` | `Q6XprfkF8RQQKoQVG33xT88H7wi8Uk1B1CC7YAs69Gi` |

owner는 모두 `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`, executable=false다. 위 수량은 그 응답 시점의 base-unit supply이며 유통량·준비자산·상환 증거가 아니다. authority는 mint 데이터에 주소가 있다는 관측이며 실제 통제 주체·키·행사 가능 여부를 인증하지 않는다. USDC의 두 권한 주소는 다르고 USDT는 같은 주소지만 운영 구조를 추론하지 않는다.

[원본 연구 보고서](../reports/solana-stablecoin-mints-readonly.json)와 [정적 관측·hash·공식 출처 기록](research/solana-mint-observation.json)을 연결했다. context slot은 두 계정의 마지막 변경 slot이나 블록 hash가 아니다. 프로그램의 source commit을 고정했지만 배포 바이너리 동일성을 검증하지 않았다. 현재 관측으로 Token-2022 확장이나 holder/delegate 상태를 추정하지 않는다.

## 실행

```sh
npm run research:solana-mints -- --public --out reports/solana-stablecoin-mints-readonly.json
```

`--public`은 [공식 공개 mainnet RPC](https://solana.com/docs/references/clusters)를 요청 전에 선택한다. 별도 제공자가 필요하면 환경변수 `SOLANA_RPC_URL`을 설정하고 `--public`을 생략한다. 기존 EVM `RPC_URL`과 TRON `TRON_RPC_URL`은 재사용하지 않는다. endpoint·자격정보를 보고서/로그에 저장하지 않는다. 실패 시 다른 endpoint로 자동 전환하지 않는다.

종료 코드0은 두 mint를 유효하게 읽었다는 뜻이며 자산 PASS/지원 판정이 아니다. 코드2는 네트워크 불일치·RPC 실패·null·미지원 layout 등 관측 불충분을 보고서에 기록한 경우다. 코드1은 옵션/환경변수/출력 등의 실행 오류다. 보고서는 기존 원자적0600 출력 도구로 저장한다.

## 검증과 남은 범위

모의 HTTP 검증은 u64 MAX와2^53 초과 정확도, COption None/Some/영 pubkey·잘못된 태그, leading-zero base58, 잘못된 길이/encoding/program/executable/초기화, null, 잘못된 slot·결과 수·envelope, redirect·크기 한도·HTTP/RPC 오류와 URL/오류문 비노출을 확인한다. mainnet genesis 불일치면 후속 계정 조회는0회다. 호출은 두 읽기 메서드뿐이다. CLI 출력 권한·기존 파일 보존도 확인한다.

제품 Adapter는 NOT_IMPLEMENTED, 전송/위임·실제 권한 행사는 NOT_TESTED, 발행사/native 인증은 UNKNOWN이다. [ADR0027](adr/0027-solana-mint-research-reader.md)의 별도 연구 도구이며 기존 catalog/제품 판정은 변경하지 않는다. holder/delegate 표본을 이번 완료 조건으로 요구하지 않는다.

공식 근거는 [Circle의 mint 목록](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Tether의 Solana 식별자](https://tether.to/en/supported-protocols/), [getMultipleAccounts](https://solana.com/docs/rpc/http/getmultipleaccounts), [전체 mainnet genesis 안내](https://solana.com/docs/payments/agentic-payments/x402), [고정 Token Mint layout 소스](https://github.com/solana-program/token/blob/31646dce3df0a03d468a14913f01b9fd3c3adad0/interface/src/state.rs)다. 확인일2026-10-21, layout source는 bytes/hash와 commit을 JSON에 별도 보존했다.

검증 결과: 새 연구 테스트4개와 전체 `npm run check`188개 통과, 실패·skip0. 실제 보고서의 본문/hash·권한 주소·공급량을 별도 로컬 디코딩으로 대조했고, 기존15개 보고서/catalog hash·고정 source hash·문서 링크를 보존 확인했다.
