# ADR0108: Arkham 운영 주기와 UTC 적용일 정책

상태: 구현. 사용자 요청2026-10-25. 실제 DB/API/서버 변경은 제외한다.

## 결정

기존 collector·예약·405 session lock·404 예약 lock·Receipt/Archive를 재사용한다. 기본은1h/24예약이며 주기와 예약 상한을 별도 입력으로 받는다. 지원 목록·우선순위·전환 명령은 [운영 정본](../ARKHAM_SCHEDULER.md)을 따른다. 기존 market-watch는 별도 legacy 수동 도구로 유지하며 함께 실행하지 않는다. Web/FX/등록 일별 수집 정책은 변경하지 않는다.

`atlas_history` v4와1~4 migration bytes·기존 테이블/권한을 유지한다. 별도 비공개 `atlas_scheduler` v1에 migration/구조 hash와 불변 적용일별 정책을 둔다. history의 INSERT guard2개 추가로 바뀐 v4 구조 fingerprint만 owner transaction에서 갱신한다. 원래 fingerprint는 새 메타데이터에 불변 보존한다. 예약·일별 예산·관측값·migration hash는 수정하지 않는다. 기존 Web의 v4 Reader 검사 소스로 읽기를 검증한다. v5로 올리는 초안은 기존 Web을 깨뜨려 채택하지 않았다.

정책은 legacy5m/288 baseline으로 시작한다. 실제 변경은 별도 owner `schedule-policy`로 다음 UTC 날짜 이후에만 추기한다. 당일 예산 축소/확대·기존 정책 수정/삭제는 하지 않는다. 403→405 try→404 lock을 유지하고 미완료 Arkham CLAIMED·적용일 이후 기존 day·기존 미래 정책과 충돌하면 거절한다. 같은 미래 날짜·같은 값의 재입력은 불변 UNCHANGED다. 미래 정책의 취소/덮어쓰기는 제공하지 않으며 잘못된 정책은 더 뒤 날짜의 보상 정책으로만 수정한다.

runtime은 시작·매 tick·Arkham recovery 전·새 claim 시 DB clock의 활성 interval+limit와 당일 budget을 대조한다. 불일치는 공급자 호출 전에 종료한다. guard는 저장 정책의 주기·상한과 슬롯/일별 예산을 직접 검사한다. transaction-local GUC 표식은 구 writer의 예약 INSERT를 차단한다. writer도 GUC를 설정할 수 있으므로 인증/새 코드 진위 증명으로 취급하지 않는다. 유효 표식을 위조해도 DB 정책·기존 예산·유일키·예약 한도는 우회할 수 없다. DB owner의 임의 DDL까지 방어하는 구조는 아니다.

모든 주기는 UTC 하루를 나누는5분 배수다. 기존 DB300초 정렬과 Receipt 식별자를 그대로 사용하고, finish는 기존5분 슬롯도 허용한다. 현재 슬롯 하나만 예약하며 중단 중 누락 슬롯을 생성하지 않는다. CLAIMED 복구는 원 슬롯의 Receipt/Archive로 import만 재개한다. connection 오류 후 자동 reconnect/retry는 추가하지 않는다.

## 검증과 한계

[수행 기록](../research/2026-10-25-configurable-arkham-scheduler.md)에 실패·수정·검증 결과를 남긴다. 새 소유 PG17에서 이력54개와 과거 UNCONFIRMED·288예산 보존, owner/worker 잠금, migration rollback, 정책 충돌, 직접 SQL/GUC, 자정·재시작·중복·작은 예산 소진·기존 Reader/Archive 호환을 시험한다. 실제 Fedora aarch64·systemd·운영 Supabase·공급자 수집은 NOT_TESTED다.
