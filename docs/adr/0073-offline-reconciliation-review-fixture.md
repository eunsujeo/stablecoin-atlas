# ADR0073 — 오프라인 대사 준비 검토 보고서 Fixture

## 승인과 범위

2026-10-23 사용자가 ADR0072 인계 뒤 다음 진행을 요청했다. 이번 단위는 [ADR0072](0072-offline-response-evidence-import-fixture.md)의 가상 원문과 새 소유 PG Fixture를 이용한 **읽기 전용 대사 준비 검토**다. 비용 차감·job 완료·일별 실행 활성화는 포함하지 않는다. 실제 legacy의 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0과 운영 전환 경계는 [ADR0070](0070-legacy-allium-transition-and-checkpoint-review.md)을 유지한다.

## 보고서 계약

보고서는 원장을 semantic replay하여 예약과 intent별 송신·원문 import·내용 검토를 구분한다. 원문이 없는 일반 response, 미송신 intent, 송신 후 원문 미import를 각각 표시한다. create/run/status의 제어 응답과 result의 내용 검증을 구분한다. result에서 검증한 비용은 응답이 보고한 수량일 뿐, usage에 반영된 금액이나 최종 청구액으로 해석하지 않는다. 합산 추정·누락의0 대체·aggregate usage 증분의 예약 귀속은 수행하지 않는다.

조직·기간 연결, usage 포함/최종성, 중복 배분 방지는 이번 보고서로 증명되지 않는다. 이를 차단 사유로 명시하고 모든 예약의 c_i는 문자열 `0`, usage 반영 확인액은 null로 둔다. 원래 UNKNOWN·예약 상한·pending·job 상태는 변경하지 않는다. import 관측시각과 검토시각을 분리하고 hash만 요약하며 원문/base64/응답 reference는 보고서에 싣지 않는다.

## 읽기와 신뢰 경계

별도 review-only factory는 검토 조회만 제공한다. 기존 import-only 복구 API는 유지한다. 보고서 조회는 publisher session을 pin한 동안 DB repeatable-read read-only transaction에서 Fixture/권한/원장·저장된 원문을 재검증하고 게시된 head와 정확히 일치해야 한다. 미게시 원장, 별도 신뢰 기준보다 짧은 DB/저장소 복원, 원문 누락/교체, 게시·commit 불명은 보고서를 반환하지 않는다. 조회는 원장 append·checkpoint 게시·원문 생성·가상 송신을 하지 않는다.

순수 보고서 계산은 로컬 자료 요약일 뿐 publication이나 최신성을 인증하지 않는다. 저장소와 별도 trusted reference가 함께 과거로 복원된 경우의 최신성 한계, 동일 UID/root 경로 교체와 실제 전원 장애 내구성 한계는 [ADR0071](0071-offline-durable-checkpoint-fixture.md)·ADR0072와 같다. 공급자 진위·실제 비용·운영 exactly-once의 증거가 아니다.

## 검증

단위 검사는 미송신·미import·제어 응답·유효/오류 result와 정확 수량·시각·hash·무변경을 다룬다. 새 소유 PG에서는 reader 권한·반복 조회 무변경·exact publication·원문 누락/교체·DB 복원·commit 불명을 검증한다. `npm run check`와 `npm run check:allium-daily` 결과와 Lead 검토는 이번 인계문에 기록한다. 공급자/usage/SQL HTTP·운영 DB·스케줄·웹 경로는 추가하지 않는다.

Lead `ddba1818d5414b7a9676376b2c1262de`의 proceed 조건을 반영했다. 실제 비용 확정이나 운영 전환의 승인이 아니다.
