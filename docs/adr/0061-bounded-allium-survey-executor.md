# ADR0061 — Allium 단발 조사 실행기와 영속 예산 예약

## 범위와 실행 조건

[ADR0060](0060-allium-survey-and-collection-plan.md)의 주소형11배포·registry/supply/volume SQL3개에 서버 CLI 수동 단발 실행 경로를 추가한다. XRPL2개는 계속 NOT_TESTED다. 오프라인 plan의 executionEnabled=false·billingLimit=null은 그대로이며, 별도 검토된 authorization이 있어야 실행한다. 웹/서버 시작·기존 Arkham/registered 수집기는 실행기를 호출하지 않는다. 일별 자동 수집·Allium 공급량 DB/화면 연결은 후속이다.

승인은 재생성한 planHash·각 SQL 바이트 해시·API result limit·키 지문·**동일 조직의 안정된 accountScopeHash**·할당기간·사용량 원문/통제 증거 해시에 묶는다. 키 교체를 새 조직 예산으로 보지 않는다. 사용량 원문은 이 도구가 같은 UTC 날짜에 조회해 성공 영수증을 저장한 것이어야 한다. 원래 관측시각부터1시간 이내, 명시한 예약일 당일, 할당기간과 공급자 한도기간 안에서만 매 요청을 허용한다.

사용자 기입 숫자나 과거 실행 비용만으로 과금 한도를 인증하지 않는다. 비공개 통제 증거와 authorization을 사람이 검토하고 SHA256을 명시한다. **공급자 강제 한도가 진행 중 실행 비용까지 포함하는지, 다른 소비자를 통제하는지, 초과 과금이 꺼졌는지** 확인하지 못하면 실행하지 않는다. SQL LIMIT/HTTP 횟수는 스캔 비용 상한이 아니다. 단위는 EXPLORER_UNIT이며 USD 금액으로 바꾸지 않는다. 일반 계정 usage 응답은 이 통제 증거를 제공하지 않는다. 실행기는 검토된 진술과 해시의 결합을 검사하며 공급자 설정을 독립 인증하거나 변경하지 않는다.

## 예약과 원문 영수증

고정 비공개 `.state/allium-executor`의 조직+할당기간 슬롯과 UTC 날짜 슬롯을 exclusive mkdir로 확보한다. **할당기간당 조사 한 묶음**만 허용하고 최대3run/39HTTP와 검토한 조사 예산 전체를 예약한다. 다른 날짜·다른 plan·재시작에도 같은 할당기간 예산을 재사용하지 못한다. 미사용/실패분을 환급하거나 슬롯을 자동 삭제하지 않는다. 날짜 슬롯 충돌이나 초기 저장 실패도 기간 예약을 돌려주지 않는다. 이는 일별 실행 예약기의 완성이 아니라 소량 조사에 한정한 보수적인 예약이다.

각 요청 전 변경 불가 intent와 receipt snapshot을 저장하고 파일·부모 디렉터리 fsync를 마친다. 실제 횟수는 응답 수가 아니라 **전송 시도 예약 수**다. 네트워크 호출 직전 중단은 실제 전송 여부를 알 수 없으므로 보수적으로1회 소비한다. JSON snapshot은 임시 파일 fsync→rename→디렉터리 fsync다. 원문 응답은 exclusive 비공개 파일에 먼저 보존하며 hash·HTTP 상태를 receipt에 연결한다. 키/인증 헤더/URL/공급자 오류 본문은 공개 요약에 넣지 않는다. query/run 식별자는 비공개 receipt에만 남긴다.

상태는 RESERVED→DISPATCHING→RUNNING→SUCCEEDED/FAILED/TRUNCATED/UNKNOWN이다. 중단된 비종료 snapshot은 읽기 전용 status에서 UNKNOWN으로 표시한다. 명시적인 공급자 실패만 FAILED다. run 전달 불명·응답 오류·예산/유효시간 초과·원문 저장 실패·불완전 결과는 UNKNOWN이며 남은 job도 중단한다. 현재 LEFT JOIN SQL의0행은 완전한 EMPTY가 될 수 없어 UNKNOWN으로 둔다. SUCCEEDED는 실행/응답 검증 성공이며 개별 배포 지원을 뜻하지 않는다. 명시적 미일치 행은 기존 검토기의 INCONCLUSIVE다.

create3/run3/status최대30/result3, 응답2MiB/요청20초, polling2초/최대10회, 페이지1/재시도0을 유지한다. 사용량 확인은 별도 UTC 날짜당 **최대1HTTP**, 조사와 합쳐 최대40HTTP다. run/create 재전송·기존 run 추가 polling·pagination·공급자/compute profile 전환·자동 취소는 제공하지 않는다. 비용 관측값은 원문의 숫자 lexeme을 문자열로 보존하고, 검토한 run당 비용 한도를 넘는 관측은 후속 실행을 차단한다. 미확보 비용은 null이다.

`review`는 plan과 변경 불가 intent, 검토한 원문 SHA를 확인하여 기존 검토기를 호출한다. archive 이후 snapshot 직전 중단도 원문으로 복구할 수 있다. 네트워크·예약 해제·receipt 수정·DB import는 수행하지 않는다. 해시 불일치/누락 파일은 거부한다. 실제 DB import-only 복구·append-only 공급량 이력은 아직 구현하지 않았다. 상태 디렉터리를 삭제/복사해 재실행하지 않으며, 실제 run 불명을 확인하지 못한 슬롯은 계속 보존한다. 이 디렉터리는 같은 PC의 로컬 파일시스템용이며 여러 PC/복제된 디렉터리 사이의 전역 예산을 보장하지 않는다.

## 공식 문서와 실제 관측

2026-10-23 공식 [create](https://docs.allium.so/api/explorer/create-query.md)·[run](https://docs.allium.so/api/explorer/run-query.md)·[results](https://docs.allium.so/api/explorer/fetch-query-run-results.md)를 재확인했다. 결과 원문 sql/data/meta/queried_at과 저장/실행 limit을 사용한다. [usage](https://docs.allium.so/api/account/get-organization-usage.md)는 청구기간과 할당기간을 구분하며, legacy credits나 trial은 동일한 EU 할당으로 추측하지 않는다. [usage limits](https://docs.allium.so/app/organization-management/usage-limits.md)의 한도는 설정 후 사용분을 세고 US Eastern 기준으로 재설정된다. 이는 stablecoin 집계 timezone 확인 근거가 아니다. [overage](https://docs.allium.so/app/organization-management/usage-and-billing.md) 설정과 함께 검토해야 한다. 문서의 한도 도달 후 차단 설명만으로 개별 계정의 진행 중 비용까지 강제 상한이 확보됐다고 단정하지 않는다.

이번 실제 실행은 usage GET1회/HTTP200뿐이다. 원문과 비공개 영수증을 저장했고 providerCapStatus는 UNCONFIRMED다. 승인 배포 SQL create/run/result는0회, 새로운 지원 관측·DB 변경·공급량 전환도0이다. 기존 Ethereum 표본을 이번13배포 조사 결과로 재사용하지 않는다. 검증된 공급자 통제 증거와 새 사용량 확인이 확보될 때만 후속 실제 조사를 진행한다.
