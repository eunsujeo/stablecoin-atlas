# ADR0071 — 오프라인 영속 checkpoint publisher Fixture

## 승인과 범위

2026-10-23 사용자가 ADR0070 인계 이후 다음 진행을 승인했다. [ADR0070](0070-legacy-allium-transition-and-checkpoint-review.md)의 다음 구현 단위인 가상 자료·새 소유 PostgreSQL17 Fixture의 영속 publisher와 복원 장애 검증을 구현한다. 기존 생성·소유 확인 harness와 [ADR0069](0069-offline-daily-allium-ledger-lab.md)의 가상 원장을 사용한다. 실제 legacy 전환은 계속 **TRANSITION_BLOCKED**, legacy P는 UNKNOWN·b_i는 null·c_i는0이다. 실제 공급자/usage/SQL 호출·비용 차감·운영 DB·스케줄·웹 연결은 추가하지 않는다.

## 불변 게시와 직렬화

`tools/allium-checkpoint.mjs`는 명시적으로 전달한 새 private Fixture 디렉터리에만 저장소를 생성한다. 각 record는 canonical JSON이며 schema·fixture/조직 identity·DB epoch·publisher epoch·publication ID·단조 순번·이전 publication hash·ledger count/hash를 결합한다. DB epoch는 새 난수 Fixture DB마다 고유한 fixtureHash다. 기존 DB의 epoch 교체/복구 기능은 없다.

이 Fixture는 ledger head hash가 결합하는 원래 이벤트의 시각·plan/authorization·가상 응답을 replay한다. 별도 운영 증거 manifest나 게시 wall-clock 시각은 추가하지 않으며 순서는 publication 순번으로만 판단한다. 실제 원문 보존/수입 계약은 별도 후속이다.

단일 publisher가 `O_EXCL|O_NOFOLLOW`로 session lock을 선점하고 file/부모 디렉터리 fsync를 확인한다. 게시마다 잠금 inode/token·경로 identity·전체 불변 chain·기대 이전 head/순번을 잠금 안에서 확인한다. 이어 새 순번 파일을 exclusive 생성하고 file fsync·디렉터리 fsync를 마친 뒤 성공 ACK를 반환한다. mutable head 파일이나 rename에 CAS를 맡기지 않는다. 잠금의 독점 선점과 기대 head 비교가 이 로컬 프로토콜의 직렬화된 CAS다. 여러 컴퓨터/운영 저장소의 분산 CAS를 구현한 것이 아니다.

동일 head의 중복 확인은 새 record/송신권을 만들지 않는다. 다른 head의 역행·같은 순번 분기·조직/epoch 불일치·부분 파일·신뢰 기준 누락은 차단한다. 게시 후 ACK 유실을 포함한 오류는 publisher session을 폐기 상태로 두고 lock을 남긴다. `close`는 정상 session에서만 lock을 제거하며 오류 session의 FD 정리는 lock을 보존한다. crash lock 자동 회수·삭제·재시도 API는 없다. 시험 중 lock 제거는 생성 주체가 확인된 폐기 Fixture에 한해 harness가 명시적으로 수행한다.

모든 경로 요소의 symlink·소유자와 쓰기 권한을 검사하고 최종 디렉터리700·일반 파일600·단일 hard link·크기 제한을 검사한다. 시스템 ancestor는 root 소유와 sticky 임시 경로를 허용한다. 저장소 inode와 lock inode/token을 재검증하고 파일은 NOFOLLOW로 연다. 경로 검사와 open 사이를 악의적인 동일 UID/root가 교체하는 공격을 완전히 막는 dirfd/openat 기반 저장소는 아니다. 이 Fixture로 운영 파일시스템의 내구성/권한 경계나 관리자 변조 방지를 인증하지 않는다.

## 신뢰 기준과 복원

저장소 생성 시 genesis 참조를 반환한다. 재시작 API에는 **저장소 밖에서 명시적으로 보유한 trusted sequence/hash**를 전달해야 한다. 저장소 내용에서 trusted head를 다시 만들지 않는다. chain이 그 기준을 포함해야 하며, 기준보다 짧거나 다른 게시물은 차단한다. genesis 이후의 prefix extension은 검증하지만 최신성 자체를 인증하지는 않는다.

DB만 과거로 복원하면 게시된 ledger prefix보다 짧거나 다른 DB를 replay에서 거부한다. checkpoint만 과거로 복원하면 별도 최신 trusted reference가 이를 거부한다. DB와 checkpoint의 공동 복원도 별도로 보존한 최신 reference가 있으면 차단한다. 그 기준이 없으면 누락 검출은 **UNKNOWN**이며 API가 gate를 열지 않는다. 기준까지 함께 과거로 복원되면 일관된 과거 상태를 최신 상태와 구분할 수 없다. 시험은 명시적으로 오래된 기준을 전달했을 때 이 한계도 확인한다. 외부 신뢰 저장 서비스·키·실제 freshness 증거를 추가하지 않았다.

## DB와 일회 handle 경계

`checkpointDailyLab`은 publisher의 identity와 게시 head를 읽어 기존 replay anchor를 구성한다. `publishCheckpoint`는 DB replay를 먼저 확인하고 그 head를 명시적으로 게시한다. 읽기 확인/중복 게시로 reservation·intent의 메모리 ACK를 복구하지 않는다. 기존 `dailyLab`은 ADR0069의 기준 Lab으로 남으며 영속 gate 경로는 별도 factory로 생성한다.

가상 송신은 현재 publisher session을 전체 DB transaction 동안 pin한다. 그동안 close·다른 게시·다른 gate는 거부한다. 조직 transaction lock 아래 DB 검증·worker session lock/identity·전체 replay·게시 head exact match·DB 시각/lease/권한/예산을 확인하고 현재 handle의 intent ACK를 동기적으로 소비한 뒤 FAKE_SEND를 INSERT/commit한다. 동일 DB client의 transaction도 중첩을 거부한다. 게시가 worker lease를 연장하지 않는다. 다른 정상 writer가 게시와 송신 사이에 원장을 늘리면 exact match 실패로 차단한다.

worker claim/release도 같은 transaction 직렬화에 참여한다. replay 중 `releaseWorker`를 끼워 넣는 회귀 시험으로 송신 transaction 중 해제 거부를 확인하며, 게시 head 검사 후 worker lock을 다시 확인한다.

송신/commit 응답이 불명확하면 handle을 소비하고 publisher를 차단한다. commit이 실제 성공했다면 FAKE_SEND1개가 남고 재시도는0개다. intent commit ACK가 유실됐으면 게시/읽기 성공 후에도 송신0개다. 가상 FAKE_SEND는 DB 이벤트이며 외부 callback/HTTP가 없다. 응답은 기존 가상 이벤트로 보존하고 다음 송신 전 새로운 DB head를 게시한다. 실제 원문 저장·대사 import·POST 전송의 exactly-once는 구현하거나 인증하지 않는다.

## 장애 검증

`npm run check:allium-daily`는 새 소유 PG Fixture와 일시 private 저장소에서 다음을 검증한다.

- 별도 Node 프로세스 publisher 경합, pin 중 close/게시 거부, 잠금 교체 뒤 옛 fence 차단.
- record 쓰기 뒤·file fsync 뒤·directory fsync 뒤·게시 ACK 직전의 주입 실패와 lock/record 보존. 이는 실제 전원 장애 내구성 시험이 아니다.
- CAS 불일치·중복 확인·부분 record·symlink/권한·identity 변경·순번 rollback·같은 순번 분기.
- DB-only/checkpoint-only/joint rollback, 별도 최신 기준의 차단과 기준 동반 rollback의 검출 한계.
- 미게시 intent·게시 ACK 유실·재시작/새 handle의 옛 intent 재사용0·게시 후 DB lease/worker lock 상실·intent/send commit ACK 유실.
- 장애 후 UNKNOWN과 예약0.5EU 보존, 송신 commit ACK 유실만 원래 가상 이벤트1개·추가 이벤트0개, 외부 요청0개.

기존 ADR0069의 reservation commit/INSERT rollback·연결 상실·독립 작업자·예산/기간 장애 시험도 함께 유지한다. 실행 결과와 commit 상태는 이번 인계문에 기록한다. Lead `d7dd7438e7b64956b8addd74ef860ecd`의 proceed 조건을 반영했다. 실제 전환·실행 승인을 의미하지 않는다.
