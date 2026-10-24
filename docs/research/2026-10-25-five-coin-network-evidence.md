# 5코인·등록 후보 네트워크별 저장 근거 현황

2026-10-25 기존 저장 기록만 정리했다. 새 외부 조회·다운로드·compiler 실행·키·DB/UI 변경은 없다. 아래는 과거 관측의 근거 목록이며 현재 공식 지원/주소 인증이나 전체 네트워크 기술 검증 결과가 아니다. 원래 판정·시각·원문을 변경하지 않았다.

기준은 [등록 metadata](../../data/market-registration.json)의 `coverage` 33조합과 [기존 실행 registry](../../data/asset-registry.json)의 8배포다. 공급량 선정은 2026-10-22 저장 snapshot의 27조합이며, USDC XRPL과 RLUSD 추가 5네트워크는 선정 밖 후보로 남는다. 공급자 목록의 전체 130/157체인 등을 전부 검토한 표가 아니다. 등록/선정은 Adapter 구현·배포 식별자 확보·공식 네이티브 발행 인증과 별개다.

| 코인 | 등록 후보 조합 | 당시 공급량 선정 | 기존 기술 프로필 | 선택 토큰 소스 검토 |
| --- | ---: | ---: | ---: | ---: |
| USDC | 11 | 10 | 3 | 1 |
| USDT | 10 | 10 | 3 | 2 |
| RLUSD | 7 | 2 | 2 | 1 |
| JPYC | 4 | 4 | 0 | 0 |
| JPYSC | 1 | 1 | 0 | 0 |
| 합계 | 33 | 27 | 8 | 4 |

기술 검토 CLI의 실제 단발 실행은 **Ethereum USDC 1배포**다. 기존 8프로필의 읽기·소스 연구와 동일한 실행 집합이 아니다. 선정 27조합 중 기존 기술 프로필은 7개이며, 나머지 1개 기술 프로필은 선정 밖 USDC XRPL이다.

## 표의 의미와 출처

- 등록 관계 `I`는 metadata의 `ISSUER_LISTED`, `P`는 `PROVIDER_AGGREGATE`다. 과거 조사 분류이며 이번 공식 재확인이 아니다. 특히 P를 native/브리지 계약 매핑 완료로 해석하지 않는다.
- 공급량 `D`는 [DeFiLlama 저장 백필](../TOP10_NETWORK_BACKFILL.md)의 네트워크별 유통 수량/발행 잔액 두 계열 확보다. JPY 자료는 [등록 저장 결과](../MARKET_REGISTRATION.md#별도-db-등록과-저장-자료-조회)와 [당시 조사](yen-stablecoins-network-coverage-2026-10-22.md)를 따른다. `A7`은 별도 [Allium 저장 조사](allium-samples/survey-2026-10-23.md)와 [후속 live 저장본](allium-samples/live-2026-10-23.md)의 7일 관측이다. D/A는 공급자별 정의가 달라 서로 대체·합산하지 않는다.
- 전송량 `A7`/`A4`는 Allium의 2026-10-16~22 중 7일/4일 관측이다. 지갑 간 이동량이며 매매량·결제량·국가간 송금량이 아니다. 최신 일자 완결·집계 시간대·최소 단위 정밀도는 인증하지 않는다.
- 소스 `S`는 선택 snapshot의 `SOURCE_REVIEWED`다. 개별 근거는 [기술 비교표](../STABLECOIN_COMPATIBILITY_MATRIX.md)와 [통합 JSON](stablecoin-compatibility-summary.json)에 연결된다. 소스 칸의 `미확보`는 이 근거 집합에서 토큰별 소스 검토를 확보하지 않았다는 뜻이다. Solana program 형식이나 XRPL flags 정의를 개별 토큰 계약의 SOURCE_REVIEWED로 승격하지 않는다.
- 체인 관측 칸은 공급자 응답이 아닌 기존 직접 읽기 근거다. `미관측/NOT_TESTED`를 지원 불가로 해석하지 않는다. 배포 연결은 후보 소스와 실제 배포의 전체 대응이다. `UNKNOWN`은 대응 미인증이며, program/issuer형에는 EVM runtime 비교가 `NOT_APPLICABLE`이다. 이때도 실제 전송·키 통제는 미검증이다.

## USDC — 후보 11조합

| 네트워크 | 등록 관계 / 선정 | 공급량 | 전송량 | 토큰 소스 | 직접 체인 관측 | 소스·배포 연결 |
| --- | --- | --- | --- | --- | --- | --- |
| Ethereum | I / 선정 | D + A7 | A7 | S, V2_2 후보 상세표 | 고정 블록 getter7·proxy/code | UNKNOWN, 후보 runtime 불일치 |
| Solana | I / 선정 | D + A7 | A7 | 미확보 | mint + 명시 Token Account | UNKNOWN; EVM 비교 NOT_APPLICABLE |
| Hyperliquid L1 | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Base | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Arbitrum | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Polygon | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| BNB Smart Chain | P / 선정 | D, 발행 잔액 1점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Arc | P / 선정 | D, 두 계열 각 36점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Avalanche | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Stellar | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| XRPL | I / 선정 밖 | D 미확보; Allium NOT_TESTED | 미확보/NOT_TESTED | 미확보 | issuer + 선택 AMM line 직접 연구 | UNKNOWN; EVM 비교 NOT_APPLICABLE |

Ethereum의 최근 직접 읽기는 [2026-10-24 단발 관측](2026-10-24-usdc-token-review-live.md)의 블록 26261502다. [2026-10-25 오프라인 검토](2026-10-25-usdc-offline-source-review.md)는 같은 저장 관측에 고정 solc0.6.12를 적용했으며 새 블록 관측이 아니다. linked 후보의 전체 runtime 불일치와 PARTIAL·UNKNOWN을 유지한다. 소스 표의 15행 중 proxy 업그레이드·감사/수수료/rebase 배포 결론은 UNKNOWN이다.

Hyperliquid L1을 HyperEVM으로 바꾸지 않는다. USDC XRPL의 D 미확보는 해당 선정 백필 밖이라는 의미다. [별도 XRPL obligations 저장 관측](../DEVELOPMENT_STATUS.md)은 존재하지만 네트워크 유통량·발행 잔액 계열에 섞지 않는다.

## USDT — 후보 10조합

| 네트워크 | 등록 관계 / 선정 | 공급량 | 전송량 | 토큰 소스 | 직접 체인 관측 | 소스·배포 연결 |
| --- | --- | --- | --- | --- | --- | --- |
| TRON | I / 선정 | D + A7 | A7 | S, 제공 10파일 선택 경로 | 기존 TRON 읽기 | UNKNOWN, 정확한 getter 블록/forward 내부 미확인 |
| Ethereum | I / 선정 | D + A7 | A7 | S, 고정 제3자 local/forward 소스 | 기존 EVM 읽기 | UNKNOWN, 발행사 revision/forward 내부 미확인 |
| BNB Smart Chain | P / 선정 | D, 발행 잔액 1점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Solana | I / 선정 | D + A7 | A7 | 미확보 | mint + 명시 Token Account | UNKNOWN; EVM 비교 NOT_APPLICABLE |
| Arbitrum | P / 선정 | D, 발행 잔액 1점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Polygon | P / 선정 | D, 발행 잔액 1점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Plasma | P / 선정 | D, 발행 잔액 1점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| TON | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Aptos | P / 선정 | D | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Mantle | P / 선정 | D, 발행 잔액 1점 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |

TRON 제공 소스의 bool 선언과 중간 상속의 return 생략을 구분한다. 실제 반환값은 NOT_TESTED이며 실패/취약점으로 확정하지 않는다. Ethereum USDT의 local 경로 조건을 deprecated 전달 대상에 일반화하지 않는다. [선택 소스 조건](../STABLECOIN_COMPATIBILITY_MATRIX.md#evmtvm-선택-소스의-전송승인-차이)과 [TRON 검토](../TRON_EXPORTED_SOURCE_REVIEW.md)가 정본이다.

## RLUSD — 후보 7조합

| 네트워크 | 등록 관계 / 선정 | 공급량 | 전송량 | 토큰 소스 | 직접 체인 관측 | 소스·배포 연결 |
| --- | --- | --- | --- | --- | --- | --- |
| Ethereum | I / 선정 | D + A7 | A7 | S, explorer 선택 상속 | 기존 metadata/proxy 읽기 | UNKNOWN, 새 V2/이전 ZIP snapshot 구분 |
| XRPL | I / 선정 | D; Allium NOT_TESTED | 미확보/NOT_TESTED | 미확보 | issuer + 선택 AMM line 직접 연구 | UNKNOWN; EVM 비교 NOT_APPLICABLE |
| Base | I / 선정 밖 | 미확보 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Ink | I / 선정 밖 | 미확보 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| OP Mainnet | I / 선정 밖 | 미확보 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| Unichain | I / 선정 밖 | 미확보 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| XRPL EVM Sidechain | I / 선정 밖 | 미확보 | 미확보/NOT_TESTED | 미확보 | 미관측/NOT_TESTED | UNKNOWN |

추가 5곳은 2026-10-22 공식 목록 조사와 metadata에만 연결된다. 동일 주소 표기나 Ethereum 소스 검토를 다른 네트워크의 코드·설정·Adapter 근거로 복사하지 않는다. XRPL과 XRPL EVM Sidechain도 별개다. Ethereum의 [explorer 소스 검토](../RLUSD_EXPLORER_SOURCE_INTAKE.md)는 배포 bytecode 전체 동일성 인증이 아니다.

## JPYC·JPYSC — 후보 5조합

| 코인 / 네트워크 | 등록 관계 / 선정 | 공급량 | 전송량 | 토큰 소스 | 직접 체인 관측 | 소스·배포 연결 |
| --- | --- | --- | --- | --- | --- | --- |
| JPYC / Ethereum | I / 선정 | D 각 237점 + A7 | A7 | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| JPYC / Polygon | I / 선정 | D 각 237점 + A7 | A7 | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| JPYC / Avalanche | I / 선정 | D 각 237점 + A7 | A7 | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| JPYC / Kaia | I / 선정 | D 각 93점; A 불일치/INCONCLUSIVE | A 불일치/INCONCLUSIVE | 미확보 | 미관측/NOT_TESTED | UNKNOWN |
| JPYSC / Ethereum | I / 선정 | D 각 93점 + A7 | A4, 10/16~18 미확보 | 미확보 | 미관측/NOT_TESTED | UNKNOWN |

JPYC는 현행 상품을 대상으로 하며 JPYC Prepaid를 포함하지 않는다. 5계약의 저장된 식별자는 [metadata의 newDeployments](../../data/market-registration.json)에 있지만 RPC/소스 검증 완료를 뜻하지 않는다. Allium 등록 11행의 OBSERVED도 공급자 응답이며 직접 체인 관측이 아니다.

JPY의 D는 token 수량이며 목록의 USD 환산 가치와 별개다. JPYC 공급자 정의는 발행·상환 대기분을 제외하고 JPYSC는 totalSupply를 circulating으로 취급한다. 자유 유통·외부 입출고·상환 성공을 인증하지 않는다. Kaia의 Allium 불일치를 D 관측으로 덮어쓰지 않으며 JPYSC 누락 3일을 0이나 다른 snapshot으로 채우지 않는다.

## 시각·완료 경계와 후속 입력

표의 D는 2026-10-22 저장 원문에 근거한 백필 당시 범위다. 최장 창은 2025-10-22~2026-10-22지만 짧은 계열도 있다. JPYC 3네트워크는 2026-02-28~10-22, Kaia/JPYSC는 07-22~10-22다. USDC Arc는 09-17~10-22, Hyperliquid L1 발행 잔액은 2025-12-09부터 318점이다. 현재 DB·collector의 최신 건수/가동을 이번에 확인하지 않았다.

Allium 최초/live의 4snapshot은 [저장 자료 오프라인 대조](../ALLIUM_SURVEY_DATA.md#실제-저장-검증)에서 274관측·차이 0으로 기록돼 있다. 같은 7일 창의 두 묶음을 기간 확대로 해석하지 않는다. 이번에 원문/DB 재검사나 재수집은 하지 않았다.

Solana는 [mint 관측](../STABLECOIN_COMPATIBILITY_MATRIX.md)과 [Token Account 표본](../STABLECOIN_MILESTONE_COMPLETION.md)의 별도 slot을 유지한다. XRPL은 [issuer 관측](../STABLECOIN_COMPATIBILITY_MATRIX.md), 당초 표본의 line 부재, [AMM 양수 line 직접 연구](../XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 구분한다. AMM의 공통 Adapter는 3페이지 미완료/INCONCLUSIVE 그대로이며 직접 연구만 같은 ledger의 RippleState를 관측했다. 일반 지갑의 동작이나 공통 Adapter 성공으로 승격하지 않는다.

모든 행에서 실제 토큰의 전송/서명/권한 행사는 NOT_TESTED다. 권한은 선택 소스의 함수·modifier·조건 확인으로 현재 범위의 검토를 수행하며 역할 계정 수집·서비스 장부·준비자산·실제 권한 행사를 필수조건으로 되돌리지 않는다. [ADR0026](../adr/0026-source-based-compatibility-scope.md)과 기존 UNKNOWN/NOT_TESTED를 유지한다. 사설 Fixture 성공을 실제 자산의 동작 근거로 옮기지 않는다.

| 후속 대상 | 먼저 필요한 고정 입력 | 추가 실행의 경계 |
| --- | --- | --- |
| Ethereum USDC의 배포 대응 | 정확한 원본 build 입력/metadata, library 대응, 감사 대상 version/commit/범위와 snapshot | 기존 후보 불일치 보존. 새 실제 배포 검증은 정확한 입력·허용 RPC 범위 확인 후 |
| JPYC/JPYSC 기술 소스 | 5계약 각각의 제공 소스·의존 closure·compiler 전체 version/settings·출처/시각/hash | 제공물의 오프라인 검토를 구체화. 미제공 소스 다운로드/RPC는 이번에 시작하지 않음 |
| 기술 프로필 밖 25조합 | coin/network/contract·mint·issuer+currency의 정확한 식별자, native/bridge 관계, 고정 source/관측 근거 | 동명/동일 주소를 다른 체인에 복사하지 않으며 새 SDK/Adapter/공개망 거래 추가 없음 |
| 시장 누락 | Kaia chain/address 일치 근거, JPYSC 누락 3일 원문, RLUSD 추가 5네트워크의 정의가 명시된 공급 자료 | 기존 실패/누락과 원래 시각 보존. 새 공급자 호출·자동 전환을 시작하지 않음 |

이 현황표 작성은 완료했다. 후속 입력 목록에서 다음 대상을 선택할 수 있다. 기존 기술 프로필을 전체 33조합의 PASS/지원/감사 완료로 바꾸지 않는다.
