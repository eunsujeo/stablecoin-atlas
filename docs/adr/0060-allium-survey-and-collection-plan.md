# ADR0060 — Allium 지원 조사와 일별 수집 계획

후속: [ADR0061](0061-bounded-allium-survey-executor.md)이 단발 실행기·영속 예약·비공개 영수증을 구현한다. 아래의 “아직 없다”는 이 ADR의 오프라인 계획 구현 당시 범위이며, 실제 조사 실행/공급량 전환/일별 자동 수집은 후속에서도 미완료다.

## 결정과 구현 범위

[ADR0059](0059-allium-primary-and-daily-transfers.md)의 후속 전제인 지원 조사와 일별 수집 설계를 구체화한다. `allium:plan`은 네트워크·DB·스케줄을 실행하지 않는 오프라인 도구다. 등록된 13개 배포의 network identity와 배포 식별자를 고정하고, 주소형 11개에 대해 registry/supply/volume SELECT 세 개를 만든다. 기존 등록 자료는 조사 대상을 정하는 근거이며 현재 공식 주소 인증이나 Allium 지원 증거로 바꾸지 않는다. 목록의 주소를 새로 인증하거나 확장하지 않는다.

XRPL USDC/RLUSD는 issuer+currency를 그대로 보존하고 `ISSUER_CURRENCY_MAPPING_UNCONFIRMED`·`NOT_TESTED`로 보류한다. issuer를 임의로 token_address로 바꾸지 않는다. 체인 문자열도 조사 후보이며 실제 응답의 chain+address 일치 전 지원으로 표시하지 않는다. EVM만 주소 소문자를 비교하고 TRON/Solana는 대소문자를 보존한다. 배포 없는 coverage 항목·다른 pair·보유자 열거는 조회하지 않는다. 이번 대상은 전체 네트워크 상위10 선정이 아니다.

## 기간·양·예산

`--day D`는 명시한 UTC 예약일이며 `[D-7, D)`의 일곱 날짜를 조사한다. 당일을 포함하지 않고 일별 후보 수집도 이 창을 겹쳐 재조회하는 설계다. 공급자의 집계 타임존·마감 시각은 UNKNOWN이며 UTC 예약일과 공급자 일자를 같다고 단정하지 않는다. 최근 7일 수정은 재관측하고 그보다 오래된 수정은 명시적 별도 계획 대상으로 남긴다. 이 창이 모든 수정이나 지연을 포착한다고 주장하지 않는다.

조사 최대 실행은 registry/supply/volume 각1회, 총3회다. create3+run3+status 최대30+result3으로 HTTP 최대39회다. 각 요청20초/응답2MiB, 상태 확인 간격2초/실행당10회, 페이지1개, 자동 재시도0이다. 상태 조회는 같은 실행의 관측이며 run 재전송은 하지 않는다. 정상 행 최대는 registry11, supply77, volume77이며 각 SQL/API 결과 상한은 최대+1 sentinel로 둔다. 절단·중복·배포 누락은 완전한 결과로 수용하지 않는다. LIMIT는 반환량만 제한하며 스캔 비용의 상한이 아니다.

계획에는 예상 호출 상한과 실제 호출0을 분리한다. 과금 한도는 null·UNCONFIRMED, executionEnabled는 false다. 사용자 키의 기존 권한과 소량 실측은 무제한 운영 예산의 근거가 아니다. **실행기는 아직 없다.** 후속 실행기는 검토된 SQL 해시·API result limit 일치·별도 확인한 계정 사용량/기간/예산·원자적 예약이 모두 있을 때만 실행한다. 일별 정상 수집은 지원을 확인한 공급량/전송량 두 실행(최대26 HTTP)을 후보로 삼고 registry는 등록 변경 시 별도 예산으로 조사한다. status 추가 조회·pagination·실패 run 재실행·다른 프로필/endpoint 전환은 자동으로 추가하지 않는다.

## 저장 응답 검토

`review`는 동일한 날짜·현재 등록 자료로 계획을 재생성하고 검토한 원본 SHA256, SQL 바이트, 원래 queried_at, 응답 행수, 식별자·기간·수량 문자열/null을 검사한다. 금액·건수에 JSON Number를 허용하지 않는다. TO_VARCHAR는 원래 자료형의 정밀도를 복구하지 않으며 최소 단위 정밀도는 미검증이다. registry decimals는 문자열/null로 보존하고 미확보를 추측하지 않는다.

LEFT JOIN의 명시적 미일치 행은 INCONCLUSIVE다. 0행 전체 응답이나 배포 누락은 결과 불완전 오류이며 미지원 인증으로 바꾸지 않는다. 매칭된 행의 null 수량도 null로 보존한다. `OBSERVED`는 해당 배포·날짜의 응답 관측일 뿐 제품 PASS/공식 지원/실제 권한 인증이 아니다. registry의 providerVerified=false도 실패로 바꾸지 않는다. registry 일치만으로 일별 자료 존재를 추론하지 않으며 각 query의 증거를 따로 둔다. 반환 projection에는 SQL·계정 query/run 식별자를 넣지 않는다. 이 도구는 실행 영수증을 만들거나 DB에 import하지 않는다.

## 후속 실행기의 영수증·원자성

아래는 구현 전 요구사항이다. 기존 수집기의 예약을 Allium으로 간주하지 않는다.

- 비공개 receipt는 planHash·sqlHash·mapper·배포 목록 해시·기간·예약일·원래 조회시각·원문 해시·실제 HTTP 종류별 횟수·관측 사용량(미확보 null)을 기록한다. SQL·키·인증 헤더·계정 query/run 식별자는 공개 projection에 넣지 않는다. 공급자 오류 본문도 그대로 출력하지 않는다.
- 상태는 RESERVED → DISPATCHING → RUNNING → SUCCEEDED/EMPTY/FAILED/TRUNCATED/UNKNOWN으로 구분한다. EMPTY는 완전한 조회 결과에서만 정한다. run 시도 뒤 응답 불명·프로세스 종료는 UNKNOWN으로 남기고 자동 재전송하지 않는다. run ID가 있으면 동일 실행의 상태 확인만 예약 예산 내에서 허용한다.
- 외부 호출 전에 영속 예약·잠금과 최대 호출 예산을 소비한다. 재시작·동시 프로세스는 같은 예약의 새 run을 만들지 못한다. 원문을 비공개 archive에 먼저 보존하고 해시 검증 뒤 검토 결과만 원자적으로 import한다. 원문 저장/DB import 사이의 중단은 import-only 복구한다.
- source/일별 값은 append-only, 동일 원문 replay0, 원래 조회시각의 충돌 거부, 구시각 역전 방지를 따른다. 누락·실패는 마지막 정상값/원래 기준일을 지우지 않는다. 지연된 값은 새 관측 이력이며 과거 행을 덮어쓰지 않는다.

## 공급량 정의와 화면 연결 조건

공급량 기본 전환과 실제 보조 연결은 아직 구현하지 않았다. 일반/조정/총공급량의 공급자 정의·단위·배포 범위를 별도 키로 유지한다. 공급량 USD null과 토큰 수량 null은 서로 대체하지 않으며 브리지·준비금 차이를 보존한다. DeFiLlama 경제적 체인 유통량은 다른 지표로 유지한다. 표시 이름만 바꿔 동일 지표라고 하거나, 자동 대체·합산·그래프 연결하지 않는다. 보조 전환의 필수 조건은 ADR0059를 따른다. 전송량은 검증된 동등 보조 경로가 없다.

다음은 계획된 순서다: 이 계획의 소량 실행/원문 확보 → 체인별 식별자·날짜·decimals·정의 확인 → 기존 공급량과 별도인 Allium 저장/조회 → 화면의 기본 공급자 연결 → 동등성이 확인된 보조 지표만 연결 → 예산/영수증 실행기와 일별 수집. 기존 Arkham/registered 수집기는 이 단계에서 변경하지 않는다.

공식 문서 재확인(2026-10-23): [registry](https://docs.allium.so/historical-data/stablecoins/registry)는 chain+address 단위 및 Solana mint 표현을 설명한다. [공급량](https://docs.allium.so/historical-data/stablecoins/supply-daily)은 배포별 총량/발행사 제외 유통량/추가 제외 조정량과 USD null 가능성을 구분한다. [전송량](https://docs.allium.so/historical-data/stablecoins/volume-daily)은 완료된 날짜만 제공하고 has_adjusted_volume에 따른 null을 명시한다. 이 문서들은 등록된 개별 배포의 현재 제공을 보증하지 않는다.
