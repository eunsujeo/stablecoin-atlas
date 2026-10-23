# ADR0068 — Allium 일별 수집 설계와 비용 통제 검토

## 상태와 결론

2026-10-23 사용자 요청은 **설계·비용 통제 검토**다. 이 문서는 후속 구현의 제안이며 일별 실행·usage 조회·SQL 실행·DB migration·스케줄 설치·기본 공급자 전환을 승인하거나 수행하지 않는다. 일별 실행 상태는 **DISABLED**, 공급자 강제 한도·초과 과금 설정은 **UNCONFIRMED**다.

권고는 기존 조사 실행기를 반복 호출하는 대신 비활성 `daily-v1` 계획·조직 공통 예산 원장을 먼저 구현하고, 장애 검증과 전환 검토 후 제한된 수동 검증을 거쳐 스케줄을 별도로 여는 것이다. 실제 공급자 통제를 확인하지 못하면 자동 실행은 계속 차단한다. [ADR0065](0065-manual-allium-survey-with-backoff.md)의 최초 수동 예외는 일별 자동 실행으로 확대하지 않는다.

## 확인한 현재 제약

| 근거 | 확인한 제약 | 설계에 미치는 영향 |
| --- | --- | --- |
| `tools/allium-executor.mjs`의 `reserveSurvey` | strict는 조직 할당기간당 한 묶음, 기존 global `manual-once`는 양 실행 경로를 차단 | cron에서 기존 CLI를 반복할 수 없다. 표식 삭제·다른 root·키 교체로 재실행하지 않는다. |
| 같은 파일의 `request`·`executeSurvey` | 영속 intent 후 전송, strict 3run/39HTTP·usage 별도1회, POST 재전송 없음 | 일별 2run용 별도 정책과 공통 회계가 필요하다. 기존 검사 완화로 구현하지 않는다. |
| [ADR0066](0066-reviewed-sql-echo-and-survey-checkpoints.md) | 실제 echo는 요청과 달랐으며 특정 원문/요청/receipt 해시의 개별 검토만 허용 | 기존 SOURCE_REVIEWED나 표기 변환을 미래 응답의 자동 승인에 재사용할 수 없다. |
| `tools/allium-survey-source.mjs`·`tools/market-db/survey.mjs`·`web/survey-model.js` | 2026-10-16~22 plan/기간과 원래 UNKNOWN receipt 검토에 결합 | ADR0067 저장 조사에 새 날짜를 밀어 넣을 수 없다. 동적 기간 저장·조회·화면은 별도 후속이다. |

이 검토에서는 비공개 키·계정 원문을 읽거나 새로운 공급자 호출로 증거를 보충하지 않았다. 기존 [실제 조사 결과](../research/allium-samples/survey-2026-10-23.md)의 관측과 코드만 사용했다.

## 일별 조회 정책 제안

- 대상은 기존 주소형 11배포다. 공급량과 전송량을 각각 하나의 고정 SELECT로 묶어 **하루 최대 2run**을 예약한다. Kaia JPYC의 미일치도 그대로 관측하며 자동 제외·대체 조회하지 않는다. XRPL2개는 NOT_TESTED로 남긴다.
- 명시적 UTC 예약일 D에 `[D-7, D)`를 조회한다. 공급자의 집계 시간대·마감 시각은 UNKNOWN이다. 실행 시각은 운영 설정으로 명시하되 최신 날짜의 완결을 보증하지 않는다. 최근7일 수정은 새 관측으로 보존하고 그 이전 backfill은 별도 계획·예산으로 다룬다.
- 정상 일별 경로에서 registry를 재조회하지 않는다. 등록/매핑 변경이 필요한 경우에만 별도 승인된 조사로 실행하며 **동일 조직 총예산**에 합산한다. 저장된 등록 관측은 현재 제공이나 공식 주소 인증을 보장하지 않는다.
- 초기 정책은 SQL create2/run2/status최대20/result2 = **최대26HTTP**다. usage는 별도 하루 최대1HTTP이므로 합계 **27HTTP**, registry는 제외다. 각 SQL의 정상 최대77행·sentinel/API limit78·페이지1·응답2MiB·요청20초·상태 간격2초/각10회를 유지한다. HTTP 상한은 스캔 비용 상한이 아니다.
- 초기 daily 정책의 자동 재시도는 **POST0·GET0**을 권고한다. ADR0065의 GET 백오프는 수동 단발 정책으로 유지한다. 일별 GET 재시도 추가는 별도 정책 hash·최대 HTTP·예약 검토가 필요하며 26HTTP 안에 있다고 표시하지 않는다.
- 폴링 상한·요청 timeout은 공급자 실행 종료나 취소의 증거가 아니다. 기존 run의 추가 조회·pagination·실패 run 재실행·compute profile/endpoint/공급자 변경·자동 취소를 붙이지 않는다. 미접수 증명이 없는 POST는 오류·429·응답 유실에도 다시 보내지 않는다.
- 첫 job의 실패/UNKNOWN/미검토 echo/절단은 다음 job 전송을 중단한다. 재시작이나 다음 날이라는 이유로 같은 job을 보충 실행하지 않는다. 스케줄 지연·서비스 재시작 때 지난 날짜 작업을 자동으로 몰아서 실행하지 않는다.

## 비용 관측과 예산 산식

[실제 조사](../research/allium-samples/survey-2026-10-23.md)의 공급량 비용은 `0.05360000000000001`, 전송량은 `0.03758333333333334` Explorer Units(EU)였다. 두 값의 십진 합은 `0.09118333333333335` EU다. registry의 `0.04255` EU는 매일 합산하지 않는다.

| 가정 | EU 산술값 | 의미 |
| --- | --- | --- |
| 관측된 supply+volume 1쌍 | `0.09118333333333335` | 한 번의 과거 관측 |
| 동일 비용으로 30쌍 | `2.73550000000000050` | 비용이 같다는 가정의 산술 시나리오 |
| 동일 비용으로 31쌍 | `2.82668333333333385` | 같은 가정의 산술 시나리오 |

이 값은 견적·앞으로의 상한·USD 청구액이 아니다. 날짜 범위가 같아도 스캔량·실행 조건은 달라질 수 있다. SQL LIMIT·반환 행수·성공 HTTP 수·usage의 포함 할당량만으로 비용 상한을 만들지 않는다. credits·EU·USD를 임의 환산하지 않는다. 30/31일의 최대 HTTP는 각각810/837이며 일별27회를 모두 사용하는 경우의 호출량일 뿐 비용 예측이 아니다.

실제 예산 숫자는 이번에 정하지 않는다. 후속 검토 authorization에는 조직 식별자, 키 지문, 계획/SQL/대상/compute 정책 hash, 통제 증거 hash, EU 단위, 유효 구간과 다음 값을 결합한다. 금액은 십진 문자열·BigInt 고정소수 연산으로 다루며 반올림으로 실행 여유를 만들지 않는다.

| 기호 | 정의 |
| --- | --- |
| `M_s`, `M_v` | 검토된 supply/volume run당 비용 상한. 과거 실측값을 그대로 대입하지 않는다. |
| `R = M_s + M_v` | 전송 전 원자적으로 확보하는 하루 묶음 예약액 |
| `B_day`, `B_period` | 사용자 검토 일별·할당기간 예산. registry/기타 승인 조사도 조직 총원장에 합산 |
| `L_day`, `L_period` | 해당 구간에 이미 예약한 상한 누계. 실패·미사용분도 자동 환급하지 않음 |
| `U`·`A` | 같은 조직·할당기간의 신선한 usage 소비량·포함 할당량 |
| `P` | usage에 포함됐다고 증명하지 못한 예약 비용의 보수적 잔액 |
| `H` | 현재 유효한 공급자 강제 한도의 검토된 잔여액. usage 할당량과 별개 |

최초 정책의 입장 조건은 `L_day + R ≤ B_day`, `L_period + R ≤ B_period`, `U + P + R ≤ A`, `P + R ≤ H`를 **한 transaction 안에서 모두** 확인하는 것이다. registry 작업은 자신의 예약액으로 같은 조건을 적용한다. 공급자 한도와 할당량에 예약액이 이미 반영됐는지 불명확하면 더 보수적인 잔여액을 사용하며 실행 여유를 추정하지 않는다.

대사 산식은 예약 i의 상한을 `b_i`, 그 예약의 비용이 해당 usage에 반영됐다고 별도 증명한 금액을 `c_i`라 할 때 `P = Σ(b_i - c_i)`다(`0 ≤ c_i ≤ b_i`). 대사 전 `c_i = 0`이며, 조회 시각 경과·SUCCEEDED·result meta 비용만으로 반영을 증명하지 않는다. 확인된 비용은 U에 있으므로 c_i만큼만 P에서 제외하고 **L 누계는 줄이지 않는다**. 포함 증거가 없으면 U와 P에 일부 비용이 중복 잡힐 수 있음을 진단에 표시하고 전액 유지한다. 예산을 통과시키기 위해 중복 추정분을 빼지 않는다. 실제 비용이 상한을 넘거나 신선한 usage가 없으면 후속 전송을 차단한다.

공급자 통제 증거는 진행 중 비용을 포함한 강제 한도, 초과 과금 비활성화, 모든 조직 소비자의 통제를 확인해야 한다. 일별 usage는 실행 직전에 하루 최대1회, 원래 시각부터1시간 이내로 제한하고 매 전송 직전에 유효 구간·남은 예산을 다시 확인한다. 한 번 실패하거나 만료되면 그날 usage를 재호출해 자동 복구하지 않는다. usage만으로 진행 중 실행 비용을 알 수 없으므로 P를 별도로 유지한다.

usage의 조직·단위·할당기간이 다르거나 같은 기간의 소비량이 이전 검토값보다 감소하면 reset으로 추측하지 않고 차단한다. 포함 할당량·소비량·상한·예산의 누락/null·음수·허용 정밀도 초과도 실행 여유0으로 조용히 바꾸지 않고 검증 오류로 처리한다.

청구기간·할당기간·공급자 한도기간·UTC 날짜는 서로 다른 식별자다. 시각 경계마다 새 잔액을 추정하거나 기존 UNKNOWN/in-flight를 지우지 않는다. 기간을 넘는 비용 귀속·공급자 reset 기준이 불명확하거나 이전 UNKNOWN이 미해결이면 조직 신규 dispatch를 차단한다. 실제 reset 시간대·DST 조건은 재확인해야 하며 UTC 날짜 경계로 대신하지 않는다.

## 원장·장애·전환 설계

단일 PostgreSQL의 비공개 조직 공통 원장을 제안한다. 키·프로세스·PC·root가 달라도 같은 조직에 연결하고 단일 writer/조직 잠금·unique 예약 키·transaction으로 경합을 막는다. 다중 PC가 독립 파일 원장으로 동작하는 설계는 채택하지 않는다. DB 불가·잠금 장애·구조/권한 변조·백업 복원 후 원장 누락 의심은 모두 전송 차단이다.

원문과 계정/query/run 식별자는 비공개 archive에, 웹에는 검토된 projection만 둔다. 새 원장도 private schema·FORCE RLS·최소 권한·append-only 감사 이력과 Data API 경계 검증을 요구한다. 예산 변경은 검토된 authorization 버전을 추가하며 과거 예약을 수정해 여유를 만들지 않는다. 키·인증 헤더·RPC URL·공급자 오류 원문을 공개 로그나 Git에 기록하지 않는다.

예산과 UTC 날짜/작업의 선점, plan/authorization hash, run·HTTP 상한을 commit한 뒤 각 전송 intent를 영속화한다. 네트워크 호출은 이 commit 이후에만 수행한다. commit 직후 crash도 시도 예약을 소비하며 자동 환급하지 않는다. 상태는 RESERVED → DISPATCHING → RUNNING → SUCCEEDED/FAILED/TRUNCATED/UNKNOWN으로 구분한다. 공급자 성공 후 검토·import 실패는 이미 소비한 실행이며 SQL을 다시 보내지 않는다. 원문이 있으면 검토/import-only 복구만 별도로 진행한다.

전환 전 기존 manual/strict/usage 예약·원문 hash·원래 UNKNOWN·관측 소비와 새 원장을 대사해야 한다. 새 원장은 **별도 경로로 재실행하기 위한 우회가 아니다**. 기존 `manual-once`와 기간/날짜 예약을 삭제하거나 완료 상태로 덮어쓰지 않는다. 기존과 신규 실행 경로가 동시에 송신할 수 없도록 공통 조직 gate에 연결하고, 미확정 소비·기간 귀속·다른 PC의 송신 가능성이 남으면 전환하지 않는다. 검토된 전환 계획과 별도 사용자 실행 승인이 있어야 다음 단계로 갈 수 있다.

## 저장·조회와 승인 경계

동적 기간을 지원하는 별도 일별 저장 계약과 mapper가 필요하다. 원문/intent/receipt/요청·echo SQL hash/대상/날짜/원래 queried_at을 연결하고 append-only로 보존한다. exact echo는 검증하고, 다른 echo는 원문별 검토 대상으로 격리한다. 일반 SQL 정규화나 기존 SOURCE_REVIEWED manifest 승계는 허용하지 않는다. 이 조건에서는 실제 echo 차이가 반복될 때 사람 검토가 필요하며 완전 무인 수집을 약속할 수 없다.

읽기는 종류별 전체 snapshot과 해당 조회 창을 명시하고 서로 다른 수집일의 행으로 누락을 채우지 않는다. 수정 이력·늦은 응답·같은 시각 충돌·원래 관측 시각을 검증한다. 한 job만 검증돼도 묶음 전체 완료로 표시하지 않는다. null·실제0·MISSING·INCONCLUSIVE·NOT_TESTED를 유지한다. 실패 시 마지막 검토 정상본의 원래 시각과 별도 수집 실패 상태를 보여준다.

ADR0067의 고정 연구 자료는 그대로 보존한다. 동적 DB/HTTP/UI 연결과 기본 공급량 전환은 이번 검토에 포함하지 않으며 후속 별도 승인이 필요하다. 보조 공급자 정책은 [ADR0059](0059-allium-primary-and-daily-transfers.md)를 따른다. 공급량 정의를 섞거나 전송량을 매매 거래량으로 바꾸지 않는다. 웹 요청·서버 시작·화면 갱신은 수집을 실행하지 않는다.

## 후속 구현·검증 순서

1. 외부 호출 없이 daily plan/authorization·예산 계산기·조직 원장의 fake transport 검증을 구현한다. 기본 disabled와 새 실행 CLI 없음부터 확인한다.
2. 동시 예약·같은 날 중복·키 교체/다중 PC·registry 예산 합산·commit/intent/응답 저장 사이 crash·DB/잠금 장애·POST 재전송0을 검증한다.
3. usage 지연·숫자 정밀도·할당량보다 작은 사용자 예산·비용 초과·UNKNOWN 유지·기간 경계/DST·기존 예약 전환·대사 증거 없는 c_i=0을 검증한다.
4. 원문별 echo 검토·절단/sentinel·null/0·늦은 수정/누락·import-only 복구·기존 고정 조사 불변을 검증한다. 원래 UNKNOWN을 제품 PASS로 바꾸지 않는다.
5. 통제 증거/실제 예산·기존 예약 전환·수동 제한 검증·스케줄 활성화는 각각 검토 가능한 결과를 만든 뒤 별도 사용자 승인으로 진행한다. 원격 설치·자동 backfill·기본 공급자 전환은 묶지 않는다.

현재는 설계 검토만 끝난 상태이며 위 구현·장애 시험·새 공급자 실행을 완료로 표시하지 않는다. 이번 문서 변경에도 저장소 규칙에 따라 `npm run check`를 실행한다.

## 출처 재확인과 Lead 검토

기존 공식 출처는 [usage](https://docs.allium.so/api/account/get-organization-usage.md), [한도](https://docs.allium.so/app/organization-management/usage-limits.md), [청구](https://docs.allium.so/app/organization-management/usage-and-billing.md), [run](https://docs.allium.so/api/explorer/run-query.md)이다. 2026-10-23 이번 재확인은 네 페이지 모두 `HTTP Error 403: Forbidden`이었다. 한도 페이지의 상세 진단은 `403 Forbidden`, `Server: cloudflare`, 본문 `error code: 1010`이며 공급자 원본 서버의 제한으로 관측했다. 프록시 정책 차단으로 판정하지 않았고 설정/인증/전송 경로를 변경하지 않았다. 따라서 기존 ADR0061의 문서 검토와 이번 실패를 구분하며 현재 계정 조건을 재확인했다고 주장하지 않는다.

공식 검색 결과의 [run 상태 목록](https://docs.allium.so/explorer/api/get-query-run-status)은 created/queued/running/success/failed/canceled를 설명하지만 현재 계정의 비용 통제 증거는 제공하지 않는다. 문서 접근 실패를 계정 한도 확보나 실행 예외의 근거로 사용하지 않는다.

Lead `9feae398b6e042af8ce79b4554f88ecc`의 `revise_plan` 조건을 반영했다: 조직 공통 원장과 기존 예약 대사, usage/예약 산식, 기간 경계 미확정 비용 유지, registry 합산, 26HTTP의 범위, echo 개별 검토, DB/UI 후속 승인 분리. 이는 실제 실행 승인이나 공급자 통제 인증이 아니다.
