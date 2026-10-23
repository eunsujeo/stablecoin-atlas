# Overview 새로고침 선택 유지
- 목표: F5하면 USDC로 돌아가는 문제를 수정하고 commit/push한다.
- 끝난 것: versioned browser preference에 coin/network/source/period/comparison UI 선택만 저장한다. 허용값/길이/JSON 검사, storage getter/setter 거부 안전 처리. selectedCoin/Source/Network를 DOM과 별도의 단일 state로 유지해 초기 빈 목록·실패·중단으로 저장 선택을 지우지 않는다. 정상 scope/source pin history 뒤에만 네트워크 fallback을 확정·저장한다. 사용자 선택이 지연 복원보다 우선하며 sourceInitialized는 저장 period를 보존한다. comparison aria 및 sidebar 직접 선택도 저장. 토큰/네트워크 기본정보 분리 추가 요청은 사용자가 현 상태 확인 후 철회해 변경하지 않았다.
- 변경 파일: web/overview.js, web/overview-preferences.js, web/overview-preferences.test.mjs, tools/ui-preview.mjs, docs/adr/0056-supply-scale-and-source-cache.md
- 검증: npm run check rc0 tests311/pass311/fail0(.state/agent-logs/overview-preferences-check.log). target3/pass3/fail0(overview-preferences-target.log). 실제 browser rc0: JPYC/Polygon/minted/90d/change F5 복원, 느린 history pending 보존, 수동/60초 재독, sidebar, 최초 fetch 실패 후 성공, 로딩 중 RLUSD 변경 우선, 제거 coin/network fallback, storage 거부, 외부요청0/JS오류0(overview-preferences-browser.log). 브라우저 harness .state/overview-preferences-browser.mjs.
- 기다리는 것: 미회수 Lead 없음. 0ef01607fcd44ab8aa01c0815804280f 설계 조건 반영,759d53d01c2c4f86bc56a13230e30d0e 구현 proceed. 결과는 tools/intelligent-router/.state/lead에 저장. UI 구16839 정상 종료, 새 exec27096/4173(read-only) 유지. 기존 worker에는 변경 없음. 미추적2026-10-22-router-lead-review.md는 건드리지 않는다.
- 다음 행동: 원격 supervisor/영속 archive·보관 정책, 매일 상위10 재선정/부분 발행 정책은 후속. 저장소를 사용할 수 없는 브라우저에서는 메모리 선택으로 동작한다.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/adr/0056-supply-scale-and-source-cache.md, docs/handoff/2026-10-23-supply-scale-cache-and-profiles.md
