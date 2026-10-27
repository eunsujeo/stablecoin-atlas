# Arkham 활용 지표 단발 검사 — 2026-10-27

사용자가 제공한 GetSwaps/GetTransfersHistogram/GetNetworkHistory 명세와 고정 2GET 제안에 대한 사용자 승인을 사용한다. 기존 ADR0083의 소비를 재사용하지 않는다. 새 키/공급자·DB/UI·Collector/FX·운영 Mac mini 변경은 없다.

## 고정 범위

- 기존 Ethereum USDC 주소, 2026-10-22T00:00:00Z ~ 23:59:59Z의 명시 범위. timeLte는 포함 경계이며 하루 마지막 초의 하위 초 정밀도 포함 여부는 별도 보장하지 않는다.
- GET /transfers/histogram: base=all, chains=ethereum, 해당 USDC 주소 tokens, granularity=1d.
- GET /swaps: base=uniswap, chains=ethereum, 같은 USDC/시각 조건, limit=1/offset=0. Uniswap 기관 관련 표본이며 네트워크 전체 DEX 집계가 아니다.
- 최대2GET/0run, 응답당2MiB/합계4MiB, 각20초/전체120초, 송신 간격 최소1초. 재시도/추가페이지/redirect/endpoint 전환0. 비용 UNKNOWN.
- 기존 .state/allium-executor root와 공통 송신 lock, 새 arkham-usage-once-20261027-v1 슬롯. intent는 송신 전에 영속 기록하며 소비한 슬롯은 재실행할 수 없다.
- 고정 후보 바이트 SHA256: b4417a672f690d5deb9d1cd7a05d05fea325049332ecbeb5f965021ce8156202. 명세 제공은 실행 승인과 구분하며 실제 사용자 승인은 비공개 approved-scope.txt에 기록했다.

## 의미와 한계

histogram은 전송 이벤트 수와 historical USD 금액의 집계이며 고유 트랜잭션 수/활성 주소/결제량이 아니다. 응답의 누락 버킷은 자동으로0을 만들지 않는다. 실제 필드 구조/빈 결과/시간 조건 일치는 응답을 따로 검토한다.

swaps는 제한 표본만 읽는다. count를 전체 시장 건수로 승격하거나 한 행의 USD 금액을 기간 총량으로 사용하지 않는다. API의 sender/receiver는 실제 사용자와 같다고 가정하지 않으며 가격 보완 USD와 온체인 최소 단위 정밀도를 구분한다. 원문 숫자를 문자열 lexeme로 읽고 원문을 비공개 보존한다.

networks/history는 체인 네이티브 코인의 가격/volume/시가총액 이력이므로 활용 지표 검사에서 제외했다. 결제·전체 활성 주소·토큰 volume 별도 endpoint는 이번 범위에 없다.

## 수행 경로·실패와 수정

앞선 공개 문서4GET은 모두403이었다. 사용자 제공 본문으로 인자를 확보했고 문서 접근 실패를 인증 API 지원 부재로 확대하지 않았다. 저장 Postman 파일은 HTML이어서 요청 계약으로 사용하지 않았다.

수동 실행기 tools/arkham-usage-probe.mjs는 자동 수집기/웹/서버 시작과 연결하지 않았다. 가상 첫 시험은 macOS 임시 경로의 /var 심볼릭 링크가 기존 privateDirectory 규칙에 거절되어 실패했고, 시험용 새 소유 디렉터리를 realpath로 정규화했다. 실제 root 경로/권한 규칙을 완화하지 않았다.

Lead 검토 c1beb6f2ddbc4fd2a4d4f1a852a8e7b4의 revise_plan에 따라 본문 수신 중 오류/timeout도 이미 받은 bounded 원문과 hash/바이트/partial 상태를 영속 기록하도록 수정했다. 후속 작업은 NOT_TESTED로 남기고 재시도하지 않는다. 초기 private 소스 경로의 검토 요청은 준비 단계에서 거절되었으며 전송된 검토 요청으로 취급하지 않았다.

## 검증·실제 결과

대상 시험: node --test tests/arkham-usage-probe.test.mjs — 10개 통과. 2GET 고정 인자/최소1초 간격·숫자 원문 보존·이전 근거 보존·재소비 거절·403/429·전송 불명·2MiB 제한·잘못된 UTF-8·lease·계획 변조·본문 부분 수신 오류/timeout을 검사한다.

전체 검사 npm run check는 701개 통과/실패0(rc0)이다. 로그는 비공개 .state/arkham-usage-verification-20261027/check.log에 보존했다. 원문/키/실제 전체 URL은 Git/웹에 게시하지 않는다. 이번 검사는 단발 연구이며 자동수집·화면 표시의 완료를 뜻하지 않는다.

## 실제 결과 — 소비 완료

2026-10-27T10:26:30.552Z와 10:26:31.568Z에 각1회 송신하고 10:26:31.974Z에 종료했다. 두 응답 모두 HTTP200, 총1986bytes(74+1912), 재시도/추가페이지/전환0, 이전 전체 근거 manifest 동일. DB쓰기0, 비용 UNCONFIRMED다. 이 슬롯을 재사용하거나 같은 호출을 자동 반복하지 않는다.

| 검사 | 관측 | 검토 결과와 한계 |
| --- | --- | --- |
| histogram | time/count/usd 필드, 요청일 시작 시각의 집계1개 | 전송 이벤트534441건, 공급자 historical USD 합계43898237857.672424. 전송금액이며 DEX 매매량/결제량이 아님. 정밀도는 응답 lexeme를 유지하며 외부 가격/집계 정확성 인증은 하지 않음 |
| swaps | 표본1개, valid=true | Ethereum·양쪽 중 USDC 주소·기간·Uniswap entity의 일치를 확인. historicalUSD와 두 token unitValue의 원문 숫자를 문자열로 보존. 전체 매매량/활성 이용자/기간 총건수 인증이 아님 |

swaps의 count는10000으로 반환됐지만 문서의 결과 접근 상한과 관련된 값일 수 있으므로 정확한 전체 시장 건수로 사용하지 않는다. 표본은1개만 취득했으며 다음 페이지를 읽지 않았다. histogram의 count와 swaps의 count는 서로 다른 의미다.

비공개 실행 receipt/plan/authorization/승인/intent/응답은 기존 root의 새 슬롯에, 오프라인 검토는 .state/arkham-usage-verification-20261027/review.json에 보존했다. 공개 문서4GET의403·기존45표본의 실패/미확인/소비는 별개로 유지한다. 추가 API 호출 없이 원문을 다시 읽어 검토했다.

결론: 승인된 조건에서 전송 집계와 Uniswap 관련 DEX 표본을 실제 취득할 수 있었다. 전 체인·모든 프로토콜·전체 DEX 금액·결제 분류·자동수집·DB/UI 반영은 미검증/미실행이며 별도 범위다.

재현은 고정 plan과 비공개 receipt/원문을 오프라인으로 읽는 방식이다. 실제 CLI를 다시 실행해 재현하지 않는다. 가상 시험은 새 소유 임시 디렉터리만 사용한다.
