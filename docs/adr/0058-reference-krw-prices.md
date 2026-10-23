# ADR0058: 원화 참고 환산과 촘촘한 시장표

## 결정

Overview 시장표에 USD/KRW 선택을 추가한다. 원 USD 가격·공급량·판정·DB 지표는 바꾸지 않고, 원화는 같은 ECB 기준일의 `가격 USD × krwPerEUR ÷ usdPerEUR`로 참고 환산한다. BigInt 유리수 계산 뒤 원화 소수2자리에서 반올림하며 USD 표시는 최대 소수8자리로 정리한다. 아주 작은 양수는 표시 반올림 때문에0이 되지 않도록 `<₩0.01`/`<$0.00000001`로 표시한다. 정확한 원 USD 값·원 가격시각은 tooltip에 남긴다. 통화 선택은 URL `currency=USD|KRW`가 우선하며, 없으면 별도 localStorage 선택을 사용한다. 기존 차트 query/hash/history state는 유지한다.

토큰명·이름·연동 통화를 한 줄로 배치하고 행/열 여백과 시각 표시 길이를 줄인다. 미확인24h 거래량 열은 숨긴다. 엔화 총공급량 미확보는 그대로 남긴다. 모바일 표 내부 스크롤과 기본정보 hover·차트 이동은 유지한다.

## 환율 자료

정본은 [ECB 일별 기준환율 안내](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)와 [고정 XML](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)이다. 모든 quote는 EUR 기준이다. ECB는 영업일에 보통16:00 CET 부근에 갱신하는 정보 제공용 기준환율이다. 원화 화면은 이 기준환율을 적용한 표시이며 별도의 실시간 체결가를 수집하지 않는다.

같은 XML의 날짜·양수 USD/KRW quote만 허용하고 중복/음수/0/잘못된 날짜/미래 기준일/DTD·entity/잘못된 고정 XML 구조/64KiB 초과 응답을 거부한다. 수량은 십진 문자열이다. fetchedAt과 import-only의 importedAt 중 하나만 기록해 원문 import 시각을 수집시각으로 바꾸지 않는다. 원문 SHA-256·mapper 결과를 다시 검증한 projection만 웹에 제공한다. 기준일은 원화 표에 표시하며7일보다 오래된 환율은 사용하지 않는다. 누락/조회 실패/만료는 원화 미확보이고 USD 가격이나0으로 조용히 대체하지 않는다. 이전 검증 자료를 재사용하는 경우에도 원래 기준일을 유지한다.

## 저장·갱신 경계

표시용 소량 FX snapshot은 현재 단일 수집 호스트의 private 영속 폴더에 저장한다. DB 자산 지표/금융 판정을 추가하는 schema migration은 하지 않는다. `claims/YYYY-MM-DD.json`은 GET 전에 O_EXCL·fsync 및 디렉터리 fsync로 확보하고 하루 한 번만 요청한다. raw XML→receipt→snapshot을 불변 파일/hard-link 발행으로 저장한다. 일별 claim은 서로 다른 호스트/별도 영속 폴더 사이의 DB 전역 quota가 아니다. 운영은 한 호스트·같은 영속 root를 전제로 한다.

당일 receipt가 있으면 원문 hash/날짜/내용을 확인해 import만 재개한다. claim만 있고 receipt가 없으면 FX_UNCONFIRMED이며 당일 API 재요청은 하지 않는다. 실패는 이전 snapshot을 보존한다. import-only seed도 같은 claim을 사용해 당일 collect를 건너뛴다. source date가 이전 저장본보다 퇴행하는 것도 거부한다. 원문/claim/receipt/snapshot 자동 삭제는 없다.

웹 시작·새로고침은 외부 조회를 실행하지 않는다. `/fx-data.json`은 private 저장본의 검증 projection만 읽고 XML·환경값·파일 경로는 제공하지 않는다. 누락은503, query가 붙은 경로는404다. 기본 경로는 Git 제외 `.state/fx-store`, 원격은 `/var/lib/atlas-collector/fx-store`와 preview의 `--fx-dir`를 사용한다.

## 실행

```sh
npm run fx:collect -- --directory /var/lib/atlas-collector/fx-store
npm run fx:import -- --directory /var/lib/atlas-collector/fx-store --source <private-ecb-daily.xml>
npm run ui -- --database --database-env <reader.env> --fx-dir /var/lib/atlas-collector/fx-store
```

[atlas-fx.timer](../../deploy/atlas-fx.timer)는 UTC00:10 일별 oneshot을 실행하고 Persistent=true로 놓친 실행을 현재일 기준 한 번 처리한다. 여러 날의 API 조회를 몰아서 실행하지 않는다. Arkham/DeFiLlama 수집 횟수·주기는 바뀌지 않는다. 첫 적용은 조사 중 확보한 공식 XML의 import-only이며 원격 timer 설치는 수행하지 않았다. 서버에 설치할 때 서비스 사용자와 영속 보관은 [수집 운영](../COLLECTOR_SERVICE.md)을 따른다.

## 검증

동시 실행·GET 전 claim·import 후 재호출0·receipt 발행 복구·잘못된 원문/oversize/오래된 환율·실패 후 이전값 유지, bigint 반올림·원 USD 보존·URL/저장소 거부, 저장본만 읽는 HTTP 경계를 검사한다. 브라우저에서 원화 전환/F5/환율 실패→미확보/재독 복구·공유URL·다크/라이트/390px 모바일과 행 높이/표 높이를 확인한다. 실제 검증 수량과 원격 미실행 범위는 최신 인계문을 따른다.
