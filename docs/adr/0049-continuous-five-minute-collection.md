# ADR0049: 24시간5분 간격 수집

2026-10-22 · 사용자는 기존 하루12회 상한이 지속적인5분 자동수집과 다름을 확인하고 후속 진행을 승인했다.

worker와 systemd 기본값을288회/UTC일로 변경한다. Arkham 고정7 GET/회이므로 최대2016 GET/일이며 실제 계정 크레딧 계약은 미확인이다. DeFiLlama의 UTC일1회/3 GET와 고정 endpoint·중복 방지·누락 슬롯 미추격은 유지한다. 명시적으로 더 낮은 운영 상한/Arkham 비활성화도 가능하다.

## 기존 날짜 전환

기존 [ADR0048](0048-durable-periodic-collection.md)의 날짜 예산 불변 규칙 때문에 설정값만 변경하면 오늘의12회 예약과 충돌한다. 기존001~003 SQL을 수정하거나 run/receipt를 지우지 않는다. owner 전용 `market:history:continuous`가 새004 migration과 history v4 hash를 기록한다. 신규 프로젝트도 normalize 후 이 전환을 실행한다.

전환은 기존 owner·schema·RLS·migration hash를 확인하고 같은 transaction에서403/404 advisory lock과405 worker 배타 잠금을 확보한다. 실행 중 worker가 있으면 거부하므로 먼저 종료해야 한다. scheduler_day ACCESS EXCLUSIVE lock 안에서 오늘 UTC Arkham 예산이12 또는288인지 확인한다. 오늘의12만288로 올리고 과거 날짜·DeFiLlama·사용 횟수·slot/state·관측 값은 유지한다. 오늘 행이 없으면 새 worker가288로 생성한다. 다른 상한이면 전체 rollback한다.

예산 테이블의 변경 거부 trigger는 위 배타 잠금과 owner transaction 안에서만 제거하고 동일 정의로 복원한다. 다른 세션에 변경 허용 상태가 노출되지 않으며 실패 시 예산·trigger·schema version을 함께 rollback한다. 원래 runtime INSERT/SELECT 및 제한 열 UPDATE 정책을 늘리지 않는다. 전환 후에도 runtime의 예산 UPDATE/DELETE는 거부한다. 이미 v4면 재적용은 변경하지 않는다.

reader/importer는 v3와 v4의 정확한 원 migration hash/현재 구조를 검증한다. v3의 일별 정규화·반복 import·원문 복구 의미는 유지한다. 운영 안내는 [수집 서비스](../COLLECTOR_SERVICE.md)를 따른다.

## 검증

실제 격리 PostgreSQL에서 사용 슬롯 유지·과거 예산 보존·DeFiLlama 유지·writer/admin 변경 거부·실행 중 worker 충돌·동시 owner 멱등성·중간 오류 rollback·예상 밖 예산 거부·v4 reader 연결을 시험한다. 실제 Supabase 적용 뒤 동일 receipt/archive로288 설정을 재시작하고 예약 상태/다음5분 시각을 확인한다. 검사 결과와 실제 가동 상태는 최신 인계문에 기록한다.
