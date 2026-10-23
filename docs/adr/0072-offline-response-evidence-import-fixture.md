# ADR0072 — 가상 응답 원문 내구 보존과 import-only 복구 Fixture

## 승인과 범위

2026-10-23 사용자가 ADR0071 인계문의 다음 진행을 승인했다. [ADR0071](0071-offline-durable-checkpoint-fixture.md)의 새 소유 PostgreSQL17·private 저장소 Fixture에만 가상 응답 원문 보존과 import-only 복구·대사 검증을 추가한다. 실제 공급자/usage/SQL/HTTP 호출·운영 DB·legacy 이관·비용 차감·스케줄·웹 연결은 없다. 실제 legacy의 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0은 [ADR0070](0070-legacy-allium-transition-and-checkpoint-review.md)을 따른다.

## 원문과 신뢰 기준

`tools/allium-response-evidence.mjs`는 명시적으로 지정한 새700 디렉터리에만 저장소를 만든다. 무작위 nonce·fixture/dbEpoch/조직을 결합한 manifest hash를 호출자에게 반환하며 재개 시 그 별도 참조를 요구한다. 저장소 자체에서 참조를 재구성하거나 파일을 열거하여 자동 복구하지 않는다.

원문은 최대2MiB의 Buffer다. 원문 바이트를 JSON으로 재직렬화하지 않고 canonical record 안에 base64·길이·SHA256과 함께 보존한다. record는 저장소/fixture/dbEpoch/조직·예약·intent·job/operation·원래 관측시각·해당 FAKE_SEND의 정확한 ordinal/hash를 결합한다. 이 hash는 로컬 결합 검사이며 공급자 진위·실제 응답·과금 증거 인증이 아니다.

record hash 이름의600 파일을 O_EXCL/O_NOFOLLOW로 생성하고 파일 fsync·부모 디렉터리 fsync·경로 identity 재검증 뒤에만 ACK/reference를 반환한다. 동일 파일 재작성·덮어쓰기·자동 재시도는 없다. 저장/ACK 장애는 writer를 폐기 상태로 두고 원문을 보존한다. 명시적으로 별도 검토한 참조가 있을 때만 새 reader가 원문과 디렉터리를 다시 fsync하고 읽을 수 있다. import가 저장 성공 ACK를 소급해서 만들지는 않는다.

공통 파일 검사는 소유 UID·모든 경로 요소의 symlink/쓰기 권한·일반 파일600·단일 hard link·크기와 루트 inode를 확인한다. 같은 UID/root의 경로 교체를 완전히 방어하는 openat/dirfd 저장소는 아니며 운영 파일시스템·실제 전원 장애 내구성을 인증하지 않는다. 원문·manifest·참조 파일은 폐기 Fixture 안에만 생성되고 Git/웹에 게시하지 않는다.

## import와 대사의 의미

`responseImportDailyLab`은 read/importResponse/publishCheckpoint만 노출한다. worker·예약·intent·가상 송신·일반 response 메서드가 없고 옛 메모리 ACK도 복구하지 않는다. 원문 저장소가 연결된 정상 Lab의 일반 response도 차단한다. 기존 ADR0069/0071의 별도 기준 Lab은 유지한다.

import는 새 상태 전진이나 비용 대사가 아니라 **가상 응답의 원문 검토 기록 추가**다. 조직 transaction lock 아래 기존 ledger의 실제 FAKE_SEND와 record의 exact ordinal/hash·예약/intent/job/operation 일치를 확인한다. 원래 관측시각은 송신 이후·검토시각 이전이며 기존 authorization의 billing/allocation/cap 기간 안이어야 한다. 내용 검증에는 원래 관측시각을 쓰고 DB 검토시각을 별도로 남긴다.

RESPONSE_IMPORTED 이벤트에 원문 결합 전체와 evidence hash를 append하고 replay도 같은 ancestry·길이/hash·기간 검증을 반복한다. 내용 검증은 예약 사본에서 수행한다. 올바른 내용은 검토 결과만 기록하며 원래 intent의 response나 job 완료를 바꾸지 않는다. malformed JSON/UTF-8·잘못된 SQL/초과 비용 등은 검토 결과 UNKNOWN을 남긴다. 잘못된 identity·ancestry·시각은 이벤트 자체를 거부한다. 원래 UNKNOWN·예약0.5EU·c_i=0을 보존하며 다음 intent·같은 송신·일반 response로 이어갈 수 없다.

같은 evidence의 중복 import는 기존 결과 조회만 수행한다. 독립 DB 연결의 경합도 하나의 이벤트만 append하며 다른 증거를 같은 intent에 재배정하지 않는다. DB INSERT 실패는 원문을 남기고, commit ACK 유실 뒤 동일 참조의 import는 기존 결과 조회 또는 누락 이벤트1개 추가만 허용한다. 예산 환급·POST 재전송·운영 exactly-once를 제공하지 않는다.

## 복원과 검증

저장소 연결 replay는 각 imported record를 다시 읽고 내장 바이트와 일치시킨다. 원문 누락/교체·저장소 복원 불일치는 차단한다. 별도 최신 trusted publication보다 짧은 DB 복원도 차단한다. import 이후 publication 실패/ACK 유실은 publisher를 차단하고 원문과 DB 기록을 유지한다. DB·원문·checkpoint·외부 기준까지 함께 복원된 최신성 한계는 ADR0071과 같으며 자체 hash로 해결하지 않는다.

단위 검사는 원문 바이트/참조·저장/fsync/ACK 장애·잘린 파일·권한/symlink/hard link·루트 교체·길이/hash/base64·읽기 fsync 실패를 검증한다. PG Fixture는 재시작 import·중복 경합·INSERT/commit ACK 유실·ancestry/시각·내용 오류·원문/DB 복원·publication ACK 유실을 검증한다. 준비한 FAKE_SEND1개(결과 단계 표본은4개) 이외 추가 송신은0, 외부 호출0, 예산/UNKNOWN 보존을 확인한다. 전체 명령은 `npm run check`와 `npm run check:allium-daily`이며 결과는 이번 인계문에 기록한다.

Lead `6ffa8e1f33ac4d35ab38d56685b18313`의 proceed 조건을 반영했다. 실제 전환·운영 실행의 승인이 아니다.
