# 코인별 추가 네트워크 일별 자료 백필

2026-10-23 · [ADR0053](adr/0053-registration-database-and-filtered-history.md)의 기존 원문 수입 경로를 사용했다. 새 schema·수집 예약·UI 전환을 추가하지 않았다. 이 문서는 실제 실행 결과이며 원문과 접속 설정은 Git에 포함하지 않는다.

## 범위와 결과

2026-10-22 선정 snapshot의 USDT10/USDC10/RLUSD2 네트워크에 공급자 원문이 제공하는 일별 token 수량을 저장했다. 조회 구간은 2025-10-22부터2026-10-22까지이며, 모든 네트워크에 모든 날짜가 있다는 뜻은 아니다. 선정은 해당 코인의 공급자 네트워크별 USD 가치 기준이고, 아래 값은 USD가 아닌 token 수량이다.

| 코인 | 선정 네트워크 | 일별 유통량 점 | 일별 발행 잔액 점 | 새 값 합계 |
| --- | ---: | ---: | ---: | ---: |
| USDT | 10 | 3,660 | 1,835 | 5,495 |
| USDC | 10 | 3,330 | 2,917 | 6,247 |
| RLUSD | 2 | 732 | 732 | 1,464 |
| 합계 | 22조합 | 7,722 | 5,484 | 13,206 |

- USDT: TRON, Ethereum, BSC, Solana, Arbitrum, Polygon, Plasma, TON, Aptos, Mantle.
- USDC: Ethereum, Solana, Hyperliquid L1, Base, Arbitrum, Polygon, BSC, Arc, Avalanche, Stellar. Hyperliquid L1을 HyperEVM과 바꾸지 않는다.
- RLUSD: Ethereum, XRPL. 이 선정본에서 다른 검토 후보는 수량 미확보로 제외됐으며0으로 추가하지 않는다.

기존 JPYC/JPYSC의1,794개 값을 포함하면 atlas_registration은 metadata1/selection1/source10/coverage10/value15,000이다. 재수입으로 source/value/coverage에 추가된 행은 모두0이었다. 기존 JPY source와 market/catalog/history/registration schema hash도 보존됐다.

측정 시 새 등록 영역의 table/index/TOAST 합계는4,296KiB(그중 index1,328KiB)였다. 값 재사용과 source coverage 저장의 증가량을 함께 보며, 이 한 번의 크기로 장기 무료 용량을 보장하지 않는다.

## 짧은 이력의 의미

USDT의 BSC·Arbitrum·Polygon·Plasma·Mantle 발행 잔액은2026-10-22 한 점씩만 확보됐다. USDC의 BSC 발행 잔액도 같은 날 한 점뿐이다. USDC Arc는 두 지표 모두2026-09-17부터36점이고, Hyperliquid L1 발행 잔액은2025-12-09부터318점이다. 나머지 확인된 시리즈의 범위/날짜 수도 로컬 검증 결과에 보존했다.

`NETWORK_MINTED`는 공급자의 발행 잔액이며 당일 발행량·소각량이 아니다. 누락 날짜를 보간하거나0으로 채우지 않았다. reader의 AVAILABLE은 해당 선정 네트워크에 점이 있다는 뜻이며 구간 전체의 일별 완전성을 인증하지 않는다. 향후 화면은 실제 점 개수와 기간을 기준으로 그려야 한다.

## 재실행과 근거 보존

이번 원문은 기존 DEFILLAMA 수집 receipt와 비공개 압축 archive에서 읽었다. receipt의 코인·원문 SHA-256·원래 REQUEST 시각을 검사하고 압축 해제 후 hash를 다시 대조했다. 원래 요청 시각은 USDT06:00:48.789Z, USDC06:00:51.936Z, RLUSD06:00:54.850Z(모두2026-10-22)이며 백필 실행 시각으로 바꾸지 않았다. 백필 자체의 외부 API 요청은0회다.

원문은 기존 압축 archive와 내용 주소 기반 `.state/registration-artifacts`에 비공개 보존했다. 다른 PC에서는 이 archive와 receipt를 별도로 안전하게 복원해야 한다. 없으면 백필을 중단하며 임의 원문/시각을 만들거나 다른 공급자로 전환하지 않는다.

기존 수입 명령을 코인별로 사용한다. `<...>`는 검토된 선정 ID, 실제 원문 hash 경로와 receipt 시각으로 대체한다.

```sh
npm run market:registration:db -- import --selection <selectionId> --coin usdt --source <비공개_hash원문.json> --fetched-at <receipt_REQUEST_시각> --env-file <admin.env>
npm run market:registration:db -- read --selection <selectionId> --coin usdt --metric NETWORK_CIRCULATING --from 2025-10-22 --to 2026-10-22 --env-file <reader.env>
```

USDC·RLUSD도 같은 방식이다. 코인 하나의 두 지표는 같은 transaction으로 게시되며 세 코인의 전체 batch가 하나의 transaction인 것은 아니다. 중간 실패 시 성공한 코인을 지우지 않고 원래 입력으로 다시 실행해 멱등성을 확인한다. 원문/기본정보/선정을 재검증하는 importer를 사용하며 SQL로 값이나 최신 시각을 직접 바꾸지 않는다.

실제 DB reader의 금액·날짜·네트워크·누락 목록·원문 hash·조회 시각을 원문 preview와 모두 대조했다. 코인별 재수입의 추가 행0, JPY source와 기존 이력 불변, 실제 저장 크기를 로컬 `.state/agent-logs/top10-backfill-live.json`에 기록했다. 원문·receipt·해당 실행 보고서를 웹이나 Git에 게시하지 않는다.

백필 이후 [ADR0054](adr/0054-registered-supply-overview.md)에서 별도 UI 조회를 연결했다. 새 서버를 실행하면 Overview에서 추가 네트워크를 확인할 수 있다. 새 등록 영역의 최소 권한 일별 자동수집은 [ADR0055](adr/0055-registered-daily-collection.md)를 따른다. 매일 선정 구성을 바꾸는 기능은 후속이다.
