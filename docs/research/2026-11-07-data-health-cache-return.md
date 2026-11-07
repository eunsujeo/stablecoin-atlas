# 2026-11-07 데이터 점검과 재접속 표시 개선

## 데이터 확인

운영 health/market/registration-index/network-usage/asset-review/fx 6개 응답이 HTTP200이며 각 실제 모델 검증을 통과했다. 10:26 KST 부근 점검에서 가격·공급량의 최근 Arkham 관측은 10:00 KST, 등록5자산×유통량/발행잔액10개 이력 API는 모두 AVAILABLE이며 최신 일자는11월6일이고 missingNetworks는 비어 있다.

전송 활동은10월31일~11월6일18대상×7일126칸 중122관측·4누락이다. 누락은 JPYSC Ethereum의10월31일·11월1일·3일·5일이다. 별도15미수집 조합은 NOT_TESTED로 유지한다. PROVIDER_DAY/시간대 UNKNOWN을 변경하지 않았다. 오래된 XRPL 연구 관측을 최신 등록 이력과 혼동하지 않는다.

Collector active 및 최근 STORED, 활동 일별 작업 SUCCESS를 확인했다. 일별 oneshot의 완료 후 inactive는 실패가 아니다. Yahoo 환율은11월6일 기준1363.65 KRW/USD, API200이고 사용 가능하다. 새 Yahoo timer의 최초 예약 실행은11월8일09:15 KST로 아직 관찰하지 않았다. 추가 공급자 조회·DB 쓰기·강제 수집은 수행하지 않았다.

## 브라우저 문제와 수정

만료 캐시를 즉시 표시한 뒤 비동기 갱신하는 동작과, 수동 다시 읽기도 custom cache TTL을 적용하는 동작을 확인했다. ADR0133에 따라 최신 응답 우선, 실패 시 안내가 있는 last-good, 복귀 시 서버 확인으로 수정했다. 기존 디자인과 수집 주기를 유지했다.

검증 중 브라우저 harness의 문자열 newline escaping 및 동일 URL navigate가 실제 reload가 아닌 문제를 수정했다. 실제 Page.reload로 만료 캐시 첫 화면을 검사한다. 로컬 fixture 가격은 운영 자료가 아니다.

## 재현

기존 reader preview를127.0.0.1:54879에서 실행한 뒤 `node tools/cache-return-browser-check.mjs`. 결과와 스크린샷은 `.state/cache-return-browser/`. 단위 검증은 `node --test web/browser-cache.test.mjs`, 전체 검증은 `npm run check`. 원본 운영 API 응답은 `.state/data-health-check/`에 비공개 보존한다. 비밀 설정·URL·키를 문서나 Git에 기록하지 않는다.
