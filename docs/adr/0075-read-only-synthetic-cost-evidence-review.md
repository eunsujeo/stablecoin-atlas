# ADR0075 — 읽기 전용 가상 비용 증거 검토 Fixture

## 승인과 범위

2026-10-23 사용자가 ADR0074 뒤 제시한 다음 구현을 승인했다. [ADR0074](0074-cost-attribution-evidence-contract.md)의 필수 근거 누락/충돌·중복 후보·정정/기간 연결을 가상 입력으로 검토한다. `tools/allium-cost-evidence-review.mjs`의 순수 계산과 `costEvidenceReviewDailyLab`의 새 소유 PG 읽기 전용 factory만 추가한다. 기존 검토 API는 기존 보고서 계약을 유지한다.

실제 legacy는 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0을 유지한다. 공급자/usage/SQL HTTP 호출·운영 DB·수집·스케줄·웹 연결·배분/차감·claim은 추가하지 않는다. 운영 금융 지표를 검토하는 기능이 아니다.

## 입력과 결과 계약

입력 `ALLIUM_SIMULATED_COST_EVIDENCE_V1`은 조직·Fixture·정확 checkpoint hash와 최대256개 snapshot을 연결한다. snapshot은 root/epoch, 불변 버전/이전 버전, 원문 hash/길이·취득/출처/출처 버전, 원래 관측/검토시각, 정확 EU 총량, 조직 전체 소비자/이력 범위 및 operation 비용 범위의 가상 참조를 가진다. billing/allocation/cap의 서로 다른 identity·기간·시간대, 키/조직 유효기간, finality 정책/포함 범위/usage 버전 참조를 요구한다. fixture 예시는 `tests/allium-cost-evidence-fixture.mjs`다. 각 참조는 합성 hash이며 공급자 출처 인증이 아니다. 실제 원문 저장·읽기·import나 증거 검토 결과의 게시 기능은 없다.

항목은 root/epoch/원문 hash와 독립된 조직+과금 항목 identity, 예약/intent/송신 ordinal/job/operation, 실제 가상 송신 event와 Fixture를 결합한 hash, 정확 수량·단위·비용시각·명시 기간 연결 참조를 갖는다. 예약의 키와 송신시각, 세 기간, 상한, 전송 여부를 원장 replay와 대조한다. usage의 항목 포함 누락·기존 usage/이전 버전 대비 감소·상한/총량 초과·최종성 참조 누락은 차단한다. 같은 과금 항목이 중첩 snapshot·다른 root/epoch/bytes에 다시 나오면 중복 후보로 차단하며 다른 예약/수량 연결은 충돌로 구분한다. 후보 탐지는 조직 전체 중복 배분 방지를 보장하지 않는다.

반환값 `evidenceReview.consistency`는 `BLOCKED` 또는 `CONSISTENT_SYNTHETIC_CONTRACT`다. 후자는 내부 가상 계약 일관성만 뜻한다. malformed schema·예상 밖 필드·Number 금액·음수·18자리 초과 소수·잘못된 시각은 보정 없이 예외로 거부한다. 적합한 schema의 누락 근거는 고정 blocker 코드로 보고한다. 금액은 기존 bigint/십진 문자열 경로를 쓴다. 원문·자유 텍스트·입력 필드는 결과에 복사하지 않고 입력/snapshot hash·버전 hash·항목 수만 추가한다. 기존 보고서의 검토된 원문 hash 요약은 유지한다.

이번 시간대 지원은 UTC·DST NONE이다. 지역 시간대·offset·DST metadata는 `TIMEZONE_OR_DST_UNSUPPORTED`로 차단하며 해석했다고 주장하지 않는다. timestamp 자체는 UTC만 허용하고 offset timestamp는 예외로 거부한다. 시작 포함/끝 제외를 적용한다. 기간 불일치/경계를 넘는 비용은 명시적인 가상 기간 연결 참조가 없으면 차단한다. 키 교체는 해당 키의 조직/유효기간 근거가 있어야 한다. 이전 버전 누락·관측시각 역전·포함 항목 상실·정정/취소는 차단한다. 새 일자·키·기간으로 예산을 초기화하지 않는다.

## 읽기와 신뢰 경계

별도 factory는 `review(org, evidence)`만 제공한다. 호출 직후 입력을 복사하고 기존 [ADR0073](0073-offline-reconciliation-review-fixture.md)의 publisher pin과 repeatable-read read-only transaction 내부에서 원장/원문·exact published head와 가상 입력을 함께 검토한다. commit ACK를 확인한 뒤 반환하며 미게시 head·원문 누락·commit 불명은 보고서를 반환하지 않는다. 반복/차단/잘못된 입력 모두 원장·예약·L·UNKNOWN·c_i=0·publication을 변경하지 않는다.

어떤 가상 참조나 finality 선언도 실제 진위·최종성·배분 승인이 아니다. 실제 `costAttribution`/`usageFinality`는 UNKNOWN이며 providerAuthenticity는 UNCONFIRMED다. allocationEnabled는 false이고 ADR0074의 실제 claim 동시성·배분 ACK/복원 시험은 NOT_TESTED다. trusted reference까지 공동 과거 복원될 때의 최신성 한계도 유지한다. 새 증거 묶음은 메모리 입력일 뿐 게시된 원장에 포함되지 않으며 publication 표시는 원장/보존 원문의 검증에만 해당한다.

## 검증과 후속 경계

단위 검사에서 완전/누락/충돌·금액·키/기간·최종성·중복 후보·버전 계보·정정/취소·무변경을 확인한다. 소유 PG17에서 reader 권한·반복/오류 검토 불변·commit까지 publisher pin·ACK 유실·원문 누락·미게시 head 거부를 검증한다. 명령/결과는 이번 인계문에 기록한다. Lead `740aeb3f079746bcb16e37b919edb833`의 proceed 조건을 반영했다.

다음 범위는 사용자 확인 후 결정한다. 공급자의 실제 증거 제공 여부는 여전히 UNCONFIRMED다. 실제 증거 확보 방식 조사나 claim/배분 Fixture 구현을 이번 승인으로 시작하지 않는다.
