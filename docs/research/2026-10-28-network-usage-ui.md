# 저장 네트워크 활동 비교 UI — 2026-10-28

사용자는 전송금액만으로 Ethereum의 큰 금액 이동과 TRON/Solana의 빈번한 전송을 구분하기 어렵다는 설명 뒤 활동 지표 추가를 승인했다. [ADR0116](../adr/0116-network-usage-metrics.md)의 기존 저장 자료 표시 범위로 구현했다. 새 외부 API/키·DB 연결/쓰기·Collector/FX·운영 Mac mini 변경은 없다. Arkham 소비 슬롯도 재사용하지 않았다.

## 변경 내용

전체 현황의 기존 토큰 전송량 추이를 유지하고, USD 전송금액·전송 이벤트 건수·전송 포함 트랜잭션 수 선택을 추가했다. 선택에 따라 차트 축/툴팁·요약 카드·범례·도넛·접근성 단위를 함께 바꾼다. 선택 지표가 모두 누락돼도 다른 지표로 돌아갈 수 있도록 선택기를 유지한다.

그래프에서 선택한 집계일의 네트워크 비교표는 같은 토큰의 USD 금액·두 건수·전송 이벤트당 평균을 나란히 보여준다. 평균은 동일 행의 USD/전송 건수만 bigint로 나눈다. 소수2자리 절사, 양의0.01미만은 `<0.01`, 분모0/누락은 미산정이다. 표의 원문 값/분자/분모는 툴팁에서 확인할 수 있고 원래 조회 시각·출처/hash를 유지한다. 평균을 합산하거나 도넛에 넣지 않는다.

네트워크 비중은 선택 자산·집계일·동일 snapshot의 표시 관측 네트워크 부분합이다. 관측 대상/표시 관측/숨김 범위를 표시한다. 전송 건수와 고유 트랜잭션 수를 구분하고, 토큰별 트랜잭션 수를 합산한 전체 네트워크 건수나 이용자 수를 만들지 않는다. 실제 사람·결제·고래·안전성 판정은 하지 않는다. 활성 주소/중앙값/금액대별 건수/전체 DEX/결제 분류는 미확보다.

## 경로와 보존

- web/supply-overview-model.js: 선택 필드 projection, 같은 날 비교 행, 정밀 평균 계산과 혼합 metric 거절.
- web/supply-overview.js: 선택/비교표와 네트워크·날짜 연동. 기존 공급량과 분리된 전송 선택 상태를 유지한다.
- web/market-chart.js: 명시 unit 옵션. 기존 호출의 기본 tokens는 유지한다.
- web/styles.css: 선택기 줄바꿈·모바일 가로 스크롤 표·단위 표시.
- 기존 /survey-data.json 검증·IndexedDB/요청 정책·2MiB/UTF-8/AbortSignal/timeout·서버 API/스키마/수집기는 변경하지 않았다.

기존 비공개 volume projection을 validateSurveySnapshot/validateStoredSurvey로 읽어 오프라인 대조했다. 기존2026-10-22 USDC Ethereum/Solana의 평균이 각각80259.10/827.97로 계산되고 네 지표를 분리해 읽을 수 있음을 확인했다. 원본 파일의 전후 바이트는 같으며 이 확인도 API/DB 접속0이다. 원래 집계일/조회 시각을 오늘 관측으로 바꾸지 않았다. 비공개 결과는 .state/network-usage-ui-20261028/stored-check.json에 있다.

## 검증과 실패 원인

대상 명령 `node --test web/supply-overview.test.mjs web/market-chart.test.mjs`는18개 통과했다. 큰 정수·36자리 소수·절사 경계·진짜0·분모0·누락일/필드/네트워크·출처/단위 혼합·원본 보존을 포함한다. 전체 `npm run check`는703개 통과/실패0(rc0)이다.

`node tools/network-usage-browser-check.mjs`는 소유한 loopback 미리보기와 명시 가상 survey만 사용한다. 1440px/390px·light/dark, tokens/USD/건 축/요약·평균/누락·날짜 키보드 선택·숨김/전체숨김·JPYSC 자산 전환·2^53 초과 건수 표시·누락 지표에서 복구를 확인했다. JSON 요청0·공급자 요청0·JS 오류0이다. source read callback도0회였다. 모바일 표의 열은 가로 스크롤하며 문서 전체 가로 넘침은 없었다.

초기 브라우저 harness의 CSS 문서 이동 후 Page.stopLoading은 활성 문서 상태를 잃어 실패했다. JS 없는 기존 정적 HTML에서 origin을 확립한 뒤 별도 fixture DOM으로 바꾸도록 수정했다. 다음 시도는 CDP의 최상위 await 실행 모드가 없어 import에서 실패했고 replMode를 명시했다. 두 실패는 제품/자료 실패가 아닌 검증 도구 오류다. 별도 attempt 로그를 보존했고 수정 후 위 검증을 통과했다.

`node tools/production-browser-check.mjs --fx-isolation --safari-streams`도 오프라인 production fixture에서 통과했다. 기존5개API/FX실패·복구·last-good·USD/KRW 분리와 private/mock 요청0·JS 오류0을 유지했다. 두 브라우저 검사는 Chrome에서 ReadableStream asyncIterator/AbortSignal.any 부재를 모사했으며 실제 iPhone/WebKit 시험은 아니다.

Lead 18be1b1a130b4af58bfbade0fea21681은 proceed였다. 같은 행의 값만 나누기, partial 범위 표시, 평균 미합산, PROVIDER_DAY/시간대 UNKNOWN·누락/정밀도와 단위/브라우저 시험 조건을 적용했다.

재현은 위 가상 시험과 비공개 저장 결과의 오프라인 재독으로 한다. 실제 공급자 호출·운영 DB/배포를 재현 경로로 사용하지 않는다. 로그/화면은 .state/agent-logs/network-usage-{unit,browser,production-browser,check} 계열에 보존한다.
