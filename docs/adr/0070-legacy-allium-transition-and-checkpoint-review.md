# ADR0070 — 기존 Allium 예약 전환과 영속 checkpoint·대사 검토

## 범위와 결론

2026-10-23 사용자는 ADR0069 완료 후 제안한 **기존 예약·소비의 전환 계획과 영속 checkpoint·대사 검토**의 다음 진행을 요청했다. 이번 작업은 기존 로컬 증거의 읽기 전용 점검과 설계 검토다. 실제 예약 변경/전환·checkpoint 설치·대사 차감·공급자/usage/SQL 호출·운영 DB·스케줄·기본 공급자 전환은 수행하지 않는다.

검토 결론은 **TRANSITION_BLOCKED**다. 기존 파일의 연결 확인은 완료했지만 새 원장의 숫자 예산으로 이관할 증거는 부족하다. [ADR0069](0069-offline-daily-allium-ledger-lab.md)의 가상 권한·가상 PG 원장을 실제 승인이나 비용 증거로 사용하지 않는다. 실행은 계속 DISABLED이며 공급자 강제 한도·초과 과금 설정은 UNCONFIRMED다. 전체 설계 기준은 [ADR0068](0068-daily-allium-design-and-cost-controls.md)을 따른다.

## 실제 저장본 읽기 점검

고정 `.state/allium-executor`만 읽었다. symlink·소유 UID·비공개 파일/디렉터리 권한·크기와 총량을 검사하고 파일별 bytes/hash/mtime/mode의 전후 동일성을 확인했다. 원본 파일이나 예약 잠금은 생성·수정·삭제하지 않았다. 별도 비공개 검토 JSON만 새700 디렉터리에600 파일로 fsync 보존했다. 그 원문/계정 지문/입력별 해시는 Git·웹에 게시하지 않는다.

| 항목 | 읽기 확인 결과 | 해석 |
| --- | --- | --- |
| 영속 예약 | manual-once1개 보존, reservation-lock 부재 | 잠금 부재만으로 모든 PC/프로세스의 송신 정지를 인증하지 않는다. |
| 검토 재개 선점 | registry/supply/volume의 영속 resume 표식3개 보존 | 원래 예약과 함께 유지하며 삭제해서 같은 checkpoint를 다시 실행하지 않는다. |
| HTTP 증거 | usage1+조사17 = intent/response18쌍 | index/kind/원래 시각/응답 hash가 각각 receipt와 연결됐다. 새 호출은0이다. |
| 조사 job | registry/supply/volume 각1, 최종 SUCCEEDED | 서로 다른 query/run 연결과 status success·result hash를 확인했다. 청구 정산을 뜻하지 않는다. |
| 원래 상태 | UNKNOWN receipt3개와 reviewHistory3개 보존 | manifest의 원래 receipt/request/echo/source hash를 연결했다. 후속 성공으로 원래 상태를 지우지 않는다. |
| 관측 비용 | 합계 `0.13373333333333335` EU | 기존 세 result meta의 십진 합이다. 잔여 예산·비용 상한·정산액이 아니다. |
| 저장 usage | 모든 run 전의 맥락 자료, 할당기간 미확인 | 해당 조사 비용이 usage에 포함됐다는 증거로 사용할 수 없다. |
| 조직/상한 | 수동 authorization에 안정된 조직 연결과 run별 비용 상한 없음 | 키 지문을 조직 식별자로 대체하거나 관측 비용을 상한으로 만들지 않는다. |

이 점검은 로컬 파일 연결의 확인이다. 전후 동일 manifest는 전 세계 소비자의 정지나 동시 작성이 없는 원자적 snapshot을 보장하지 않는다. 별도 과금 계약/계정 설정을 재조회하지 않았으며 현재 공식 제공·요금 조건을 재확인한 것도 아니다. 비공개 검토 결과 위치와 시험 결과는 이번 인계문을 따른다.

## 기존 예약을 보존하는 전환 계약

기존 manual-once/기간/날짜 예약과 원래 receipt는 읽기 증거로 남기고, **별도 전환 원장에 검토 사실을 추가하는 방식**을 제안한다. 기존 표식을 삭제·복사해 다른 root에서 새 한도를 얻거나 SUCCEEDED를 미사용 예약으로 환급하지 않는다. 기존 프로그램을 우회하는 새 실행 경로도 열지 않는다.

1. 같은 조직의 기존 CLI·서비스·다른 PC·키를 포함한 모든 송신 주체를 식별하고 정지/공통 gate를 확인한다. 저장소 잠금 부재·현재 프로세스 하나의 종료로 대체하지 않는다.
2. 기존 intent/response/예약/UNKNOWN/검토 이력을 고정하고 조직 연결·청구/할당/한도기간·각 과금 항목·미완료 요청의 포함 범위를 별도로 검토한다. 키 교체는 같은 조직 총량으로 연결한다.
3. 전환 manifest에 원래 bytes hash·상태·시각·관측 비용·상한 상태를 분리한다. 현재 legacy의 상한은 **null / UNCONFIRMED**이며0이나 관측 meta 합을 넣지 않는다. 유계 상한이 필요한 기존 dailyBudget에 이 legacy를 억지로 입력하지 않는다.
4. 조직 연결·비용 귀속·상한을 정하지 못한 legacy가 있으면 `LEGACY_BOUND_UNKNOWN`으로 새 dispatch를 차단한다. 새 기간·새 키·새 DB/epoch로 바뀌어도 이 제약을 지우지 않는다.
5. 실제 전환은 별도 검토 manifest, 원본 보존 확인, 송신 정지 증거, 승인된 DB 변경과 사용자 실행 승인 이후에만 진행한다. 이번 검토에서는 해당 전환 manifest를 승인하거나 원장에 입력하지 않는다.

실제 비용 범위에는 run뿐 아니라 create/status/result/usage/registry와 다른 조직 소비자의 비용 포함 여부도 확인해야 한다. 이들이 무료이거나 동일 EU 상한 안에 있다고 추측하지 않는다. 범위가 다르거나 단위가 불명확하면 새 예산을 계산하지 않는다.

## 대사와 c_i 처리

현재 c_i는0이며 차감 기능은 닫혀 있다. legacy 비용 상한 b_i도 불명확하므로 실제 legacy P는 **UNKNOWN**이다. Lab의 가상 예약 숫자와 합산하거나 UNKNOWN을0으로 바꾸지 않는다. 관측 비용 합·조회 성공·SOURCE_REVIEWED·시간 경과만으로 사용량 반영을 인증하지 않는다.

향후 대사 증거는 조직과 키의 연결, 동일 단위의 정확한 기간·사용량 원문 hash/원래 관측 시각, 어떤 예약의 어떤 비용이 이미 포함됐는지, 지연/진행 중 비용과 최종성·중복 배분 여부를 묶어야 한다. aggregate usage 총량의 증가분을 임의 run에 배분하지 않는다. 다른 과금 항목·다른 소비자·기간 경계가 섞였으면 미확정으로 유지한다. 비용 상한 초과·usage 감소·기간 귀속 불명은 다음 실행을 막는다.

동일 반영 금액을 둘 이상의 예약 c_i로 중복 사용하지 못하도록 증거별 배분 누계와 원자적 선점을 검증해야 한다. 입증한 c_i만 보수적 pending에서 제외하고 일별/기간 예약 누계 L은 줄이지 않는다. 종료된 run의 미사용 상한이나 기간 경계 carryover 해제는 별도 정산/전환 증거가 필요한 후속 정책이다. 자동 환급·이전 자료 fallback·새 usage 재호출로 대사를 성립시키지 않는다.

## 영속 checkpoint 계약 제안

현재 Lab의 메모리 head/호출자 입력 checkpoint는 영속 publisher가 아니다. 재시작 뒤 같은 파일을 다시 읽었다는 사실만으로 신뢰를 새로 만들 수 없다. 제안하는 manifest는 다음을 결합한다.

- schema/프로토콜 버전, fixture 또는 DB instance identity, 조직 identity, DB epoch와 publisher fencing epoch.
- publication ID·단조 증가 publication 순번, DB ledger ordinal/head hash, 이전 신뢰 publication/head hash, 입력/증거 manifest hash.
- 원래 기록 시각과 검토/게시 시각, publisher identity·내구성 확인·신뢰된 외부 기준의 연결. 시각만으로 순서를 정하지 않는다.

초기 권고는 단일 publisher와 독립 영속 저장소다. 복수 publisher를 허용하려면 이전 head에 대한 **원자적 CAS**와 fencing token으로 한 분기만 게시해야 한다. 평범한 rename·파일 존재 확인·DB timestamp만으로 CAS를 구현했다고 표시하지 않는다. 오래된 작업자는 DB 연결이 복구돼도 publisher의 최신 fencing 기준을 통과해야 한다.

로컬 Fixture 구현 후보는700 디렉터리/600 파일·소유권/모든 경로의 symlink 검사·exclusive 생성·파일 및 부모 디렉터리 fsync·불변 record·exclusive publisher 선점이다. crash 뒤 선점을 자동 삭제하지 않는다. 운영 저장소의 내구성/원자성/접근 권한은 이 로컬 시험으로 인증하지 않는다.

DB와 checkpoint가 **함께 과거로 복원되는 경우**에는 독립 저장소라는 설명만으로 역행을 알 수 없다. 별도 신뢰 주체가 보관한 더 최신 head/단조 순번 또는 검토된 독립 복원 증거가 필요하다. 같은 백업의 epoch·hash·서명·이전 파일도 같이 복원될 수 있으므로 자체 서명이나 난수 epoch만으로 freshness를 인증하지 않는다. 외부 기준을 확보하지 못하면 검출 상태 UNKNOWN과 dispatch 차단을 유지한다. 이번에는 외부 저장소·서비스·키를 추가하지 않는다.

## publication과 요청 경계

제안 순서는 영속 REQUEST_INTENT의 DB commit 확인 → 해당 head의 checkpoint record 내구성 확인 → 이전 신뢰 head에 대한 publication/CAS 확인 → DB head/조직/epoch/worker/lease/예산 재검증 → 현재 handle의 단 한 번 가상 송신 검증이다. commit 또는 publication 응답이 불명확하면 송신하지 않는다. HTTP 요청은 이 검토에서 구현하지 않는다.

publication ACK를 보호 대상 ledger에 다시 append하면 head가 달라지는 순환을 피해야 한다. ACK는 게시된 manifest를 가리키는 별도 근거로 다루며, ledger에 다른 이벤트가 추가됐으면 새 head를 다시 게시·검증한다. 같은 publication의 중복 확인으로 이전 intent를 재무장하지 않는다. 재시작 뒤 기존 REQUEST_INTENT는 자동 resume하지 않는다.

응답은 원문을 먼저 내구성 있게 보존하고 DB의 응답 이벤트/새 head를 기록한다. 다음 요청 전에 새 head의 publication을 확인한다. 응답 보존/DB 기록/publication 실패는 기존 시도와 비용을 유지한 채 대사 대상으로 남긴다. 원문 검토/import-only 복구와 POST 재전송을 구별한다. 이 순서로 실제 네트워크의 exactly-once를 보장한다고 주장하지 않는다.

## 구현 전에 고정할 장애 검증표

아래는 **후속 Fixture 시험 요구사항**이며 이번에 구현·시험을 완료한 항목이 아니다.

| 중단/불일치 지점 | 유지할 증거와 판정 | 후속 요청 |
| --- | --- | --- |
| DB intent commit 응답 유실 | intent/예약은 보수적으로 소비, UNKNOWN | 차단·POST 반복0 |
| DB commit 성공, checkpoint 미게시 | DB 선행 head와 기존 신뢰 head 모두 보존 | 차단·이전 checkpoint fallback 금지 |
| record 쓰기/rename/파일·부모 fsync 실패 | 내구성 확인 실패와 미완료 게시 기록 | 차단·성공으로 덮어쓰지 않음 |
| CAS 게시 성공 여부/ACK 유실 | publication ID와 기대 이전 head 보존, UNKNOWN | 자동 resume 금지·읽기 대사 |
| 동일 publication 중복 | 바이트/문맥이 모두 같을 때만 기존 게시 확인 | 새 송신권/예산 생성0 |
| 두 publisher 경합·옛 worker | 한 CAS/fence만 진행, 패자는 증거 보존 | 패자 차단 |
| 순번 역행·같은 순번의 다른 head·조직/epoch 변경 | 분기 또는 identity 불일치 | 차단·최신 시각으로 임의 선택 금지 |
| DB만 복원/checkpoint 선행 | 신뢰 checkpoint보다 짧거나 다른 DB | 차단·재실행으로 보충 금지 |
| checkpoint만 복원/DB 선행 | 별도 신뢰 기준과 DB prefix 검증 필요 | 차단·부족한 기록 대사 |
| DB·checkpoint 공동 복원 | 별도 신뢰 기준 없이는 누락 검출 UNKNOWN | 차단·검출 보장 금지 |
| 게시 뒤 lease 만료·잠금/연결 상실 | 게시가 실행 권한의 연장이 아님 | 차단·옛 intent 재사용0 |
| 응답/비용 귀속 불명·기간 경계 | 원래 시각/UNKNOWN과 비용 미확정 유지 | 차단·환급/기간 초기화0 |

## 다음 구현 단위와 검증 기록

다음 권고는 **가상 자료·새 소유 PG Fixture에서 영속 checkpoint publisher와 복원 대사 검증**을 구현하는 것이다. 단일 publisher/CAS·신뢰 head 입력·독립 및 공동 복원·ACK 유실·분기·원래 intent 재사용 차단을 다루되, 실제 legacy 이관이나 과금 차감 경로는 열지 않는다. 실제 legacy의 조직/과금 증거 확보와 운영 전환은 계속 별도다.

이번에는 로컬 원본18쌍/검토 연결과 전후 bytes/hash/mtime/mode 동일성, 별도 검토 파일600·디렉터리700·Git 제외를 확인했다. 문서 변경도 `npm run check`로 검증하며 결과는 이번 인계문에 기록한다. 새 checkpoint publisher/장애표를 시험 완료라고 표시하지 않는다.

Lead `40f6d2cc544e4ab992b1791520de6b18`의 proceed 조건을 반영했다: 설계/읽기 검토만 수행, TRANSITION_BLOCKED와 c_i=0, 조직/기간/상한 불명 보존, 단일 publisher/CAS·fencing, 공동 rollback 한계, commit/publication/ACK 및 양측 복원 장애표, 자동 resume/fallback 금지. 이는 실제 전환이나 호출의 승인이 아니다.
