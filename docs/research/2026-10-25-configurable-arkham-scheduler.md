# Arkham 설정형 UTC 수집 스케줄러 수행 기록

## 범위와 근거

사용자2026-10-25 요청으로 코드·격리 시험·문서·commit/push를 수행한다. 운영 Supabase·실제 Arkham·Mac mini/SSH·Web/FX/등록 서비스 변경은0이다. 서버 상태·과거54회 사용/UNCONFIRMED1/CLAIMED0·이전1051파일 무결성은 사용자 관측이며 이 작업에서 재조회하지 않았다. 합성54예약은 사설 시험 자료다.

정본: [설정/전환·롤백 명령](../ARKHAM_SCHEDULER.md), [ADR0108](../adr/0108-configurable-arkham-scheduler.md). 기존 인계문의 심볼릭 링크 CLI 진입점 수정을 유지했다. 기존 untracked `docs/handoff/2026-10-22-router-lead-review.md`는 보존하고 이번 변경에 포함하지 않는다.

## 분석과 변경

시작 HEAD는533281237c83c8517757b38d569d260d80faa491이다. collector-worker의 기본288·대기300000ms, scheduler의300000ms 슬롯 계산, service의288 인자를 확인했다. DB day는불변이며 run PK(job,slot)·UTC300초 정렬·404 lock·405 worker lock·상한 trigger가 이미 있었다. Receipt 파일명은 원 job/slot에서 생성되므로 변경할 필요가 없었다. history-cli/continuous는 과거12→288 전환용이므로 재사용해24로 축소하지 않았다. periodic-jobs/market-collect의 수집 본체도 변경하지 않았다.

`tools/arkham-schedule.mjs`에서8개 허용 주기·기본1h/24·독립 limit·우선순위를 검증한다. worker는 UTC DB clock으로 현재 슬롯만 claim하고 대기 간격을 설정값에서 읽는다. 시작·tick·recovery·claim에서 정책 불일치면 API 전에 중단한다. status/doctor는 비밀 없는 runtime을 보여주며 status는 DB 정책·예산·STORED·pending·다음 경계·공급자 미관측을 분리한다. 기존 periodic-state JSON 계약은 유지했다.

별도 `db/scheduler/001-configurable-schedule.sql`와 scheduler-policy 검증을 추가했다. history v4의 새 INSERT guard2개에 맞춰 최신 구조 hash만 owner transaction으로 갱신하며 원 hash를 새 불변 메타데이터에 보존한다.1~4 migration hash·과거 예산/run·관측값은 유지한다. baseline5m/288 이후 미래 UTC일 policy를 추기하며 동일 날짜 재입력은 값이 같을 때만 UNCHANGED다. owner 잠금 순서는403→405 try→404다. 구 writer는 transaction-local 표식 부재로 INSERT가 거절된다. 표식은 writer가 지정할 수 있으므로 인증이 아니며, 실제 정책·정렬·예산·유일키 검사가 통제다.

systemd는 별도 schedule.env를 읽으며 MemoryHigh/Max·CPUQuota·Restart·TimeoutStopSec·영속 경로는 유지했다. 기존 writer.env가 프로세스 자격증명을 격리하는 경로에서도 스케줄 환경은 별도로 읽는다. FX/등록/Web 코드·unit/timer·대시보드 응답은 변경하지 않았다. legacy market-watch의 고정5분은 별도 수동 도구 계약이므로 유지했다.

## 실패·원인과 수정

- 첫 단위 시험은 기존 기본288 기대값 때문에 실패했다. 새 기본24와 명시5m/288 호환 조합으로 시험을 바꿨다.
- 초기 history v5 설계는 변경 전 Web Reader의 버전 allowlist와 충돌함을 소스에서 확인했다. 운영 적용 전에 별도 스키마와 v4 fingerprint 전환으로 수정했고, 고정된 변경 전 Reader 검사/읽기 함수(`tests/fixtures/history-v4-reader.mjs`, 원HEAD에서 import 경로만 조정)로 호환 읽기를 확인했다. v5를 운영/개발 DB에 적용하지 않았다.
- 합성 DB에서 core registry를 넣지 않고 전체 market Reader를 호출해 DATABASE_REGISTRY_MISMATCH가 발생했다. 해당 시험의 목적에 맞게 기존 history Reader의 실제 검증/읽기를 호출했다. 제품 registry 검사를 완화하지 않았다.
- 미래day 충돌 시험에서 너무 뒤 날짜의 day를 먼저 만들어 이후 정책 추기도 올바르게 거절됐다. 합성 날짜 배치를 조정해 충돌 거절과 정상 전환을 각각 검증했다.
- 새 스키마 권한 검사에서 pg_class의 index까지 SELECT 대상으로 간주해 SCHEDULER_PRIVILEGES_UNSAFE가 발생했다. 기존 history와 같은 일반 테이블 범위로 수정했다. 실제 table/column/function 권한 검사는 유지했다.

Lead f934c0a5396048078e372fe98d63c4f9는 proceed, 변경된 Reader 호환 설계의9784cceac9bc4fb190cc6082b05b7458는 GUC를 인증으로 설명하지 말라는 revise_plan이었다. 저장 정책 직접 검증·불변 hash·권한/노출 검사·GUC 위조/누락/종료 후 시험을 반영했다. 모델/effort 변경이나 운영 승인을 뜻하지 않는다.

## 검증과 재현

- `npm run check`: rc0, tests610/pass610/fail0/cancelled0/skipped0. TypeScript 포함.
- `npm run check:db`: rc0, tests58/pass58/fail0/cancelled0/skipped0. 기존 Docker 기반 소유 PG17 Fixture만 재사용하며 새 인프라/의존성을 추가하지 않았다.
- `npm run check:production`: rc0, tests15/pass15/fail0/cancelled0/skipped0.
- `node --test --test-reporter=tap tests/postgres/configurable-scheduler.test.mjs`: rc0, tests2/pass2/fail0/cancelled0/skipped0. 최종 권한/구조 drift·동시 policy/claim 시험 포함.
- `node --test --test-reporter=tap tests/arkham-schedule.test.mjs tests/collector-worker.test.mjs tests/collector-deploy.test.mjs tests/cli-entrypoint.test.mjs`: rc0, tests17/pass17/fail0. 심볼릭 링크8개 포함. 최종 변경은 전체 check에서도 재검증한다.
- `git diff --check`: rc0.

주요 로그는 `.state/agent-logs/configurable-scheduler-{check,db-full,production}.log`, `scheduler-postgres-final.log`다. 초기 실패는 `scheduler-initial.log`, `scheduler-postgres.log`에 남으며 공개 보고서에 원문/자격증명을 싣지 않는다.

통합 시험은 기존54개5분 예약의 전체 행·UNCONFIRMED·288예산·migration hash 보존, migration 실패 원자적 rollback, owner 동시 실행·Worker405 차단·pending 거절·미래day 충돌·표식 없는 구 writer/위조 GUC·같은 슬롯 동시 예약·COMMIT 응답 유실·원 Receipt import-only 복구를 검증한다. 별도 harness가 정확한 DB clock 조회만 가상 UTC로 대체하고 실제 PG 제약/잠금을 실행한다.13:20 재시작·자정 정책 mismatch·낮은2예약 상한·다음날 재개·API 추가 호출 부재·읽기 전용 status도 확인했다. 기존 persistent collector 시험은 archive hash와 원 source 재사용을 검증한다.

## 미확인과 다음 운영 단계

Mac Node25.2.1와 로컬 소유 PG17 결과다. Fedora aarch64/Node24.18/systemd 실제 EnvironmentFile/SELinux·운영 Supabase migration·1051개 실제 자료·실제 공급자 수집/부팅/롤백은 NOT_TESTED다. GitHub push는 서버 적용이 아니다. 사용자는 정본의 단계별 명령으로 stage·schedule 설정·별도 승인된 owner 전환·적용일 이후 MATCH 확인·별도 승인된 활성화를 진행할 수 있다. Web/FX/등록 서비스 재시작은 필요하지 않다. 적용 결과를 받은 뒤 관측과 미확인을 구분해 후속 기록한다.
