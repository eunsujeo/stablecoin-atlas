# 엔화 자산과 코인별 최대10개 네트워크 수집 설계

2026-10-22 · **전체 확장 설계안**. 대상은 기존 USDT·USDC·RLUSD와 신규 JPYC·JPYSC다. 사용자 요청의 ‘네트워크 상위10개’는 해당 코인의 네트워크별 유통 분포 순위로 해석한다. 체인 전체 TVL/시가총액 순위가 아니다. 최신 조사·주소·단위 근거는 [조사 기록](../research/yen-stablecoins-network-coverage-2026-10-22.md)에 모은다. 후속 첫 구현(metadata/단위/선정 preview)은 [ADR0051](../adr/0051-registration-metadata-and-unit-preview.md), 실제 DB/수집·조회 확장은 아래 후속 단계다.

## 1. 등록 목표와 확보 범위

| 코인 | 등록/수집 목표 | 조사 시 공급자 수량 확보 후보 | 남는 작업 |
| --- | --- | --- | --- |
| USDT | 상위10곳 | 공급자 집계 상위10곳 | native/USDT0/기타 bridge 및 네트워크 식별 근거 정리 |
| USDC | 상위10곳 | 공급자 집계 상위10곳 | native/USDC.e/수탁 bridge 구분, Hyperliquid L1과 HyperEVM 분리 |
| RLUSD | 공식 목록7곳 모두 | DeFiLlama Ethereum/XRPL2곳 | Base/Ink/OP Mainnet/Unichain/XRPL EVM Sidechain5곳의 수량 공급원 확인 |
| JPYC | 공식4곳 모두 | Ethereum/Polygon/Avalanche/Kaia4곳 | 현행 계약 매핑·JPY 단위 정규화 |
| JPYSC | 공식1곳 | Ethereum1곳 | 외부 입출고 제한과 공급자 유통량 정의 표시 |

현재 조사로 가능한27개 코인×네트워크 조합과, RLUSD 나머지5곳까지 포함한32개 목표를 구분한다. 공급원 미확보는0이 아니다. 공통 구현 상한은 향후 자산당10곳·5자산 최대50개 활성 조합으로 잡되 실제 등록 수를50으로 맞추지 않는다. 공식 네트워크가 바뀌면 근거를 다시 확인한다.

첫 버전은 **공급자가 해당 코인으로 집계한 네트워크 분포(브리지 포함)**를 기본 범위로 한다. 공식 발행/발행사 인정 브리지/기타 브리지/공급자 집계만 확인을 분리한다. 공식 native 전용 보기는 별도 필터다. 공급자 집계에 있다는 이유로 공식 발행·상환 지원·호환성 PASS를 표시하지 않는다.

## 2. 상위10 선정 규칙

1. 코인 ID·provider asset ID·네트워크 별칭을 검토된 목록에 고정한다. 심볼 검색 결과나 응답의 임의 URL/주소를 자동으로 수집 대상에 넣지 않는다.
2. 기본 선정 지표는 동일 코인·동일 공급자·동일 응답의 **공급자 환산 유통가치(USD)**다. DeFiLlama 목록이 제공하는 지표를 그대로 이름 붙인다. 같은 코인의 네트워크에 공통 양수 가격을 곱하는 공개 코드 특성상 수량 분포와 같은 방향의 순위지만, 값 자체를 token 수량으로 저장하지 않는다.
3. mainnet이며 원자산 연결 근거가 있는 후보에서 내림차순10곳을 선정한다. 동일 값은 canonical network ID로 정렬한다. 실제 관측0은 유효값으로 마지막에 둘 수 있다. 누락/오류/상태 미확인은0으로 바꿔 순위를 채우지 않는다. 폐기 프로토콜·테스트넷·선불형 JPYC는 현행 후보에서 제외하고 이전 기록을 보존한다.
4. sourceHash, 수신 시각, 공급자 기준시각(없으면 null), metric/unit, 전체 후보 수·제외 사유·선정 버전을 보관한다. ‘조회 성공’과 ‘모든 체인 동시/최신 관측’은 구분한다. 글로벌 자산 랭킹과 네트워크 선정은 같은 함수로 섞지 않는다.
5. 선정은 UTC일1회 검토된 후보 목록 안에서 갱신한다. 실패하면 마지막 정상 선정 버전과 기준시각을 유지한다. 새 체인이나 미등록 식별자가 등장하면 후보로 기록하고 검토 전 자동 endpoint/RPC 연결을 하지 않는다.
6. 탈락한 네트워크의 이력을 지우지 않는다. 기본 차트는 현재 선정 버전 최대10곳, 보존 이력은 별도 선택으로 조회한다. 일일 수집/5분 슬롯 도중 멤버십을 바꾸지 않고 실행이 참조한 버전을 고정한다.

처음에는 조사 기록의20곳(USDT/USDC 각10)과 엔화5곳·기존 RLUSD2곳으로 시작한다. 이를 ‘공식 발행 총27곳’이라고 표기하지 않는다. RLUSD의 공식 나머지5곳은 기본정보에 ‘수량 미확보’로 관리하고 확보 전 유통량 차트 선택에서 제외한다. 총공급량이 확보되더라도 유통량 순위의 빈칸을 대체하지 않는다.

## 3. 수량·통화·지표 계약

| 종류 | 저장할 의미 | 표시/비교 규칙 |
| --- | --- | --- |
| TOKEN_QUANTITY | 해당 코인 단위의 수량 문자열 | JPYC/JPYSC는 tokens이며 pegCurrency=JPY. USD 가치와 별도 |
| FIAT_VALUE | 공급자 보고 또는 명시 계산한 가치 | quoteCurrency=USD/JPY, 가격/FX 출처·기준시각·계산 버전 필수 |
| NETWORK_CIRCULATING | 공급자 정의의 체인별 유통 수량 | 원문 selector·정의 버전 유지. 계약 totalSupply/obligations로 대체 금지 |
| NETWORK_MINTED 기존 지표 | 공급자 정의의 발행 잔액 계열 | 새 화면 의미는 ‘발행 잔액/총공급 추이’. 당일 발행량·누적 gross mint로 사용 금지 |
| CONTRACT_TOTAL_SUPPLY 후보 | 특정 계약의 블록 고정 totalSupply | 동일 코인의 체인 합계와 공급자 유통량을 구분 |
| REPORTED_VOLUME | 기간/단위 확인된 경우만 거래량 | 거래소 거래량·DEX 거래량·온체인 전송액을 구분, 미확인이면 랭킹 보류 |

DeFiLlama 상세 `chainBalances[chain].tokens[].circulating[pegType]`/`minted[pegType]`를 수량에 사용한다. 목록 `circulating[pegType]`/`chainCirculating.current[pegType]`는 USD 가치다. `peggedJPY` 키만 보고 JPY/token으로 해석하지 않는다. 목록 USD 값을 현재 가격으로 나눠 일별 수량을 복원하지 않는다. historical PrevDay 가치가 현재 가격으로 환산됐을 수 있으므로 수량 변화/당일 USD 가치 변화로 혼용하지 않는다.

금액은 bigint와 제한된 십진 문자열로 처리한다. numeric lexeme를 먼저 보존하고 exponent는 허용 범위 안에서 정확하게 평문 십진수로 정규화하거나 명시 오류로 거부한다. Number 반올림·암묵적0 대체는 금지한다. 원 공급자의 부동소수/반올림 한계도 남긴다. 수량 소수 자릿수·가격·FX는 서로 별도 계약이다.

글로벌 전체 현황에서 USD 코인과 JPY 코인의 token 수량을 더하지 않는다. 공통 USD 가치가 확보된 경우에만 같은 quoteCurrency로 가치 합계를 만든다. 미확보 자산을 조용히 빼고 ‘전체’로 표시하지 않고 확보 수를 같이 둔다. peg 통화별 수량 비교/토큰별 추이는 환산 없이 유지한다. 가격과 FX 기준시각이 다르거나 누락이면 환산 상태를 미확보로 남긴다.

JPYC는 현행 상품과 JPYC Prepaid를 별도 coin ID로 식별하고 이번 기본 대상은 현행만이다. JPYSC는 공급자가 circulating=totalSupply로 보고하더라도 외부 입출고 제한이 있는 상품 설명을 함께 보존한다. 시장 유동성/자유 유통 가능성 판정은 생성하지 않는다. 두 지표의 차이나 전일 잔액 변화만으로 당일 발행량·소각량을 역산하지 않는다.

## 4. 공급원과 수집 주기

| 작업 | 권장 주기 | 실제 확보 의미 |
| --- | --- | --- |
| 기존 Arkham3코인 market/holders | 현재5분·288슬롯/UTC일 유지 | 기존 범위의 최신 가격/코인 전체 유통량/공급자 총공급 분포. 네트워크 유통량과 별도 |
| DeFiLlama 전체 목록 | UTC일1회 | 후보 발견·상위10 선정과 USD 환산 가치. 최신 원문 재사용 |
| DeFiLlama 상세5코인 | UTC일1회 | 확보한 일별 유통량/발행 잔액. 두 지표를 같은 원문에서 생성 |
| 공식 자산/네트워크 기본정보 | 명시 검토·등록/변경 시 | 계약/issuer/chain identity·상품 구분. 매5분 문서 재조회하지 않음 |
| 새 JPY코인의5분 자료 | 별도 capability 확인 후 | Arkham 제공 여부 또는 명시 read-only EVM 공급량 경로. 일별 이력을5분 관측으로 위조하지 않음 |

현재 Arkham의 새 두 코인 endpoint는 미확인이다. gecko_id를 Arkham pricingId로 자동 복사하지 않는다. 새 자산은 단발 capability 점검 후 provider+coin+metric+network별 상태를 고정하고 정기 작업에 넣는다. JPY 총공급량을5분마다 확보해야 할 때는 별도 시장 읽기 경로로 고정 계약/chain identity/블록/decimals를 확인하는 EVM read-only 수집을 후속 범위로 검토한다. 이번 설계에서 RPC를 호출하거나 Adapter를 구현하지 않는다. issuer/redeem 계정 수집·holder 열거·서비스 장부 검증을 선행 필수조건으로 만들지 않는다.

네트워크 수가 늘었다고 API 요청을10배 늘리지 않는다. coin 전체 network 분포를 주는 응답을 한 번 받아 선정 대상만 정규화한다. 상세 원문은 새로 필요한 두 자산을 포함해5 GET/일, 목록1 GET/일로 기본6 GET/일이다. 기존3 GET/일에서 증가분은3 GET/일이다. 초기 백필도 같은 상세 원문을 재사용한다.

향후 목록을5분 주기로 바꾸는 경우는 별도 설정/예산으로288+상세5=293 GET/일이다. 하루6 GET 설정을5분 주기 최신 수량 서비스처럼 표시하지 않는다. Arkham 두 코인 모두 market+holders를 제공한다면 기존7→11 GET/슬롯, 최대2016→3168 GET/일이므로 계정 한도와 작업 timeout을 새로 점검해야 한다. 이번 설계에서는 기존 승인 예산·수집기·키를 변경하지 않는다.

## 5. registry와 기본정보 구조

현재 registry v1은 모든 코인에 Arkham pricingId를 요구하고 coin+network에 deployment 하나를 강제한다. 새 구조는 다음 책임을 분리한다.

- coin metadata revision: canonical ID, symbol, issuer/product identity, pegCurrency, productType(CURRENT/PREPAID 등), source/reviewedAt. 공급자 미지원이어도 코인 기본정보는 등록 가능.
- provider binding revision: provider+namespace+external ID와 coin/network 연결, expected pegType·필드 단위·정의 버전·endpoint allowlist. DeFiLlama355/427과 Arkham 미확인 상태를 공존시킨다.
- network metadata revision: canonical chain identity·family·공식 출처. Ethereum/Polygon/Avalanche/Kaia 같은 표시명 및 `avax`/`klaytn`/`OP Mainnet` 등의 별칭은 provider별로 관리한다. Hyperliquid L1≠HyperEVM, XRPL≠XRPL EVM Sidechain이다.
- asset_network coverage: coin+network의 공급자 집계 범위, 지표별 수집 가능 상태와 origin 분류. 특정 계약을 아직 확인하지 못해도 provider-only 시장 집계로 표시할 수 있다. 가짜 deployment/가상 보고서 이름을 만들지 않는다.
- deployment revision: 계약/민트/currency+issuer 등 실제 식별자와 공식 근거. 같은 coin+network의 native/bridge 여러 개를 허용한다. 시장 집계와 계약 단위 값의 중복 합산을 막는다.

APTOS/TON/STELLAR/Hyperliquid L1 등은 시장 metadata를 표현할 수 있도록 family/identity schema를 확장하되 실행 Adapter 지원과 독립시킨다. token profile의 공식 URL host 허용목록/표준 분류도 함께 검토한다. 새 시장 네트워크가 보인다고 기술 검증 완료율의 PASS나 지원 체인 수로 자동 계산하지 않는다.

## 6. DB 확장과 멱등성

최초 설계는 core의 다음 migration과 history005 이상을 계획했다. 후속 [ADR0053](../adr/0053-registration-database-and-filtered-history.md)은 실행 중인 기존 worker의 strict schema/registry를 보존하기 위해 별도 atlas_registration v1을 먼저 설치하는 것으로 순서를 변경한다. 이미 적용된 core/history001~004/catalog migration·hash·불변 snapshot은 수정하지 않는다.

| 논리 테이블/확장 | 필요한 핵심 키·값 |
| --- | --- |
| asset/provider/network revisions | revision ID, canonical subject, verified source, valid/effective time; 기존 공급자 연결의 불변 이력 유지 |
| network_selection | coin, UTC 선정일, policyVersion, provider snapshot hash, metric/unit, ordered entries≤10, 제외 사유, 선정 상태 |
| measurement contract | metric definition/version, TOKEN_QUANTITY/FIAT_VALUE, quote/peg currency, original selector/pegType, definition status |
| current observation/receipt | provider/task/coin/slot·targetRevision, sourceAsOf와fetchedAt, explicit state, 원문 hash |
| history daily source/value/latest | 기존 내용 기반 값 재사용. source coverage를 선정/정의/단위 버전과 연결하고 최신 포인터의 원자성 유지 |

raw quantity fact key는 coin+network+metric+definitionVersion+unit+source UTCday(또는 실제 source timestamp)+정규 수량이다. 같은 날·같은 의미·같은 값은 재사용하고 정정 A→B→A는 불변 source와 포인터 이력으로 보존한다. 서로 다른 날짜/블록의 같은 수량은 정상적인 별도 관측이다. 원문 fetch receipt와 측정값을 분리해 일별 원문을 자주 읽었다고 수량 이력을 새5분점으로 만들지 않는다. 소스 시각이 없을 때는 명시 REQUEST clock/슬롯이라는 사실을 남긴다.

현재 source projection hash/원본 coverage 검증을 새 계약 버전에서도 유지한다. old daily_value에 새 단위 의미를 소급해 덮어쓰지 않는다. sourceHash/mapperVersion/registryRevision/selectionVersion으로 같은 원문 재처리 결과를 대조한다. provider 간 다른 정의의 수량을 한 latest pointer로 덮어쓰거나 실패 후 자동 공급자 전환을 하지 않는다.

권한은 owner의 schema/메타데이터 변경과 runtime의 제한 INSERT/SELECT·latest/예약 종료 열 UPDATE, reader SELECT를 유지한다. 새 필드/테이블/정책도 정확한 fingerprint 검증 대상이다. registry 변경을 JSON 파일만 먼저 바꾸면 현재 DB의 registryMatches가 거부하므로 versioned metadata 설치·새 reader 준비·writer 전환 순서를 설계한다.

## 7. 예약·실패 격리

새 자산 하나의404/정의 불일치가 기존3코인 정상값을 막지 않게 provider+task+coin별 결과를 기록한다. 기존 일괄3원문 전체 성공 가정과 receipt의 정확히3코인 검증을 versioned manifest로 바꾼다. metric 미확보도 자산 전체 실패와 분리한다. source 미확보 상태를 정상 source의0으로 저장하지 않는다.

새 ledger는 scope가 고정된 작업 키(provider/task/coin/slot)와 별도의 실제 HTTP 요청 예산을 둔다. reservation은 API 이전에 확정하고, 동일 source의 여러 지표/네트워크 정규화는 HTTP 수를 다시 소비하지 않는다. retry 없음·session lock·same-slot 미재조회·원문/receipt fsync·COMMIT 응답 유실의 import-only 복구는 유지한다. 과거 슬롯/예산을 지우거나 설정 변경을 이유로 사용량을 리셋하지 않는다.

기존7 GET×15초+간격을 전제로 한120초 한도는11 GET 확장에 충분하지 않을 수 있다. 각 task deadline, provider rate 제한, 최대2개 정도의 제한 병렬성, DB commit 여유를5분 슬롯 안에서 검증한다. 일별 대용량 작업은 별도 작업으로 격리하고 오래 걸린 실패를 몰아서 catch-up하지 않는다. 미확인 요청 전달/불완전 receipt는 UNCONFIRMED로 남긴다.

## 8. 조회·용량·화면

현재3코인/4체인/16개 history 시계열/5856점/512KiB와 core24시리즈·2MiB 제한을 단순히 크게 바꾸지 않는다. 최대50조합×2지표×366일은36,600점이며 공급자의 아주 긴 decimal 문자열까지 고려해야 한다. 실제 초기 후보27조합은 최대54시계열이며 기존24시리즈 일괄 응답은 실패할 수 있다.

Overview는 최신 요약과 선택 가능한 토큰/네트워크만 받고, history는 coin+metric+selectionVersion+기간별로 최대10시리즈/366점씩 별도 DB 조회한다. 응답 byte/row 한도·취소/중복 요청 병합·필터 인덱스를 유지한다. 웹 요청이 외부 수집을 실행하지 않는다. 10개 선과 색상/범례를 지원하고 실제0/자료 미확보·업데이트 시각·%/규모 전환·툴팁·스켈레톤을 유지한다. 수량 미확보 네트워크를 차트 select에 넣지 않는다. 기본정보/미확보 목록과 공급량 차트의 역할을 구분한다.

멤버십이 고정된 상태에서 일별 중복 제거 후 새 하루의 기본 증가 상한은50×2=100개 값/일이며, 정정·새로 선정된 네트워크의 백필은 별도 증가분이다. 활성50조합의 첫1년 백필은최대36,600개다. 모든100개 네트워크 지표를5분마다 저장하면28,800행/일이므로 일별 자료와 구분한다. 기존3코인 상세 원문은 약수십MiB여서 이를5분마다 내려받지 않는다. gzip hash archive를 영속 보관하고 일별 원문·source coverage·정정/receipt·index 비용을 함께 측정한다. 무료 DB 용량이 충분하다고 단정하지 않고 실제 Supabase table/index 크기와 증가량으로 보관/롤업 시점을 정한다.

## 9. 구현 순서와 완료 조건

1. **metadata/단위 계약**:5코인 식별자·peg 통화·provider capability·네트워크 별칭·JPYC 상품 구분·bridge 분류·공식 주소를 등록 가능한 별도 초안으로 고정한다. 이 단계는 기술 검증 점수를 변경하지 않는다.
2. **읽기/DB 확장**: 새 schema 계약·권한·versioned registry/selection과 필터 조회를 구현한다. 기존 Supabase 자료/원문 hash/reader/writer 동작 보존을 격리 PG로 먼저 확인한다.
3. **새2코인 일별 자료**: 이번 private 원문으로 offline dry-run/backfill·수량/가치 검증을 한 뒤 명시 import와 정기 수집 연결을 진행한다. JPYSC 정의·상품 제약을 유지한다.
4. **상위10 분포**: USDT/USDC 후보10곳씩과 RLUSD 확보 범위를 연결한다. RLUSD 나머지5곳은 지표별 공급원을 확보할 때 확장한다. 불완전 순위와 미확보를 명시하고10개를 채우기 위해 값/주소를 만들지 않는다.
5. **5분 capability·운영**: 새자산의 검증된 current source만 별도 연결하고 호출 상한/timeout·오류 격리·복구·행 증가량을 측정한다. 이후 원격 서버 배포를 진행한다.

필수 검사는 JPY USD가치≠token 수량, 가격 null/FX fallback, exponent/큰수 정밀 문자열, JPYC Prepaid 격리, 동일 coin의 native/bridge 중복, Hyperliquid L1≠HyperEVM, top10 경계 동률/탈락/재진입·0/누락/폐기체인·source 시각 미확인, 404 자산 격리, partial metric/COMMIT 유실·동시 예약·동일 원문 재처리, 과거 source 최신값 보존, 권한/정책/hash drift, 10선·모바일·조회 byte 한도다. 실행 가능한 구현/DB 적용은 별도 후속 단계이며 이번 산출물은 조사·설계다.
