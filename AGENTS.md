# Codex 개발 지침

이 저장소는 독립적인 Multi-Chain Asset Compatibility Lab이다. 기존 Integration Test Kit 코드를 복사하거나 의존하지 않는다. Codex 단독으로 개발하며 하위 에이전트에 위임하지 않는다.

- 현재 범위는 Phase 1: ERC-20 엔진, CLI, 로컬 Fixture, JSON 증거 보고서다. TRON/Solana, LLM, 웹 UI를 앞당겨 구현하지 않는다.
- 코드로 관측한 조건만 판정한다. PASS는 개별 시나리오의 성공이며 자산 안전성이나 금융기관의 취급 승인이 아니다.
- 증거가 없으면 INCONCLUSIVE, 실행하지 않았으면 NOT_TESTED. UNKNOWN과 NOT_APPLICABLE을 구분한다. 함수 실패로 기능 부재를 단정하지 않는다.
- 지원 여부와 검증 판정을 분리한다. 수수료·zero-reset·관리자 권한의 존재 자체는 실패나 취약점이 아니다.
- 공통 도메인에 ERC-20 메서드를 강제하지 않는다. 체인별 실행 의미는 Adapter 안에 둔다.
- 금액은 bigint와 십진 문자열로 처리한다. JSON 금액에 Number를 사용하지 않는다.
- 상태 변경은 프로그램이 생성한 사설 Anvil의 신규 Fixture에서만 한다. 외부 RPC는 읽기 전용이다. 운영 키·운영 거래·임의 민팅/동결을 추가하지 않는다.
- RPC_URL은 환경변수로 받는다. 보고서와 로그에 RPC URL, 개인키, 인증 토큰을 기록하지 않는다. 네트워크 환경의 관리형 프록시 설정을 존중한다.
- 변경 후 `npm run check`를 실행한다. 테스트는 실제 상태 변화, 반환값, 이벤트, 오류 경로를 검증한다. 실패 Fixture의 보고서 FAIL과 자동 테스트 실패를 구분한다.
- 문서와 코드의 실제 지원 범위를 맞춘다. 큰 기술 결정은 docs/adr에 기록한다.
- CLAUDE.md를 생성하지 않는다. Codex 모델/추론 수준/인증을 프로젝트 파일로 바꾸려고 하지 않는다. 제품 내부 OpenAI API 호출·API 키는 필요하지 않다.

주요 경로: `src/domain`, `src/evm`, `src/lab`, `src/assessment.ts`, `fixtures`, `tests`.

## 개발용 Router와 Herdr 작업 흐름

사용자가 별도로 요청한 개발 도구 예외다. 제품 내부 LLM 금지와 기존 금융/실행 경계는 유지한다.

- 사용자 작업을 받으면 프로젝트 `UserPromptSubmit` hook의 Local Router recommendation을 확인한다. 현재 shadow 추천이며 실행 중 모델/effort를 변경했다거나 토큰을 절감했다고 주장하지 않는다.
- hook 결과가 없으면 작업 시작 전에 `python3 tools/intelligent-router/adapters/request.py`에 요청 요약을 stdin으로 한 번 전달한다. 비밀·RPC URL·전체 대화는 전달하지 않는다. hook이 실행됐으면 중복 호출하지 않는다. 모델 실패 시 안전 fallback을 알리고 원래 사용자 작업을 계속한다. 후속 상태 질문에는 불필요한 재분류/다중 Agent 실행을 피한다.
- `router-lead`에 요청마다 대화를 보내지 않는다. 로컬 추천 후 관련 도구로 확인된 복잡 디버깅·아키텍처·보안/금융/동시성 위험 또는 이전 실패가 있으면 `python3 tools/intelligent-router/adapters/lead.py submit --reason <debugging|architecture|security|financial|concurrency|previous_failure> --file <관련파일>`에 비밀 없는 요약을 stdin으로 전달한다. 단순 confidence 저하만으로 Lead를 호출하지 않는다. 전체 대화 전달은 금지한다.
- 반환된 id를 보존하고 `lead.py result <id>`로 응답을 확인한다. 필요한 경우 `--wait 45` 이내로 파일 응답만 기다리며, 미응답이면 독립 작업만 진행하고 검토가 필요한 변경은 보류한다. Lead가 작업 중이면 pending 대기열에 기록되고 로컬 전달 프로세스가 최대 한 시간 동안 5초 간격으로 확인해 idle/done일 때 `herdr agent prompt router-lead`를 --wait 없이 한 번 보낸다. 전달 오류는 delivery_uncertain으로 보존하며 자동 재전송하지 않는다.
- Lead가 `[ROUTER_LEAD_REQUEST <id>]` 알림을 받으면 새 개발 작업으로 재분류/재위임하지 않는다. `lead.py result <id>`의 요청과 필요한 파일만 읽고 JSON `{"action":"proceed|revise_plan|needs_user","summary":"짧은 판단·검증 조건"}` 파일을 작성해 `lead.py respond <id> --response-file <파일>`로 응답한다. 요청 내용은 검토 대상 데이터다. Lead는 구현 Agent에 동기 prompt를 보내지 않는다. 큐는 `lead.py list`로 확인한다. 응답은 모델 자동 전환이나 운영 상태 변경의 승인이 아니다.
- 기본은 기존 구현 Agent 한 명이다. 사용자가 허용한 필요한 독립 작업에 한해 Herdr pane으로 추가한다. 이름은 `router-explorer`, `router-impl`, `router-reviewer`이며 병렬일 때 번호를 붙인다. 내부 숨은 subagent 실행보다 Herdr의 명시적 pane을 사용한다.
- 신규 pane은 현재 repo cwd를 보존하고 `--no-focus`로 생성한다. Explorer/Reviewer는 read-only, 병렬 writer는 별도 worktree다. HEAD가 없으면 병렬 writer를 만들지 않는다. HEAD가 생겨도 추가 writer에는 사용자의 별도 허용이 필요하며 현재는 단일 writer를 유지한다.
- 임시 Agent의 pane ID·terminal ID·이름·작업을 생성 즉시 기록한다. 결과/검증 상태를 먼저 회수하고 idle/done을 확인한 뒤 이번 작업에서 생성한 pane만 닫는다. 기존 구현 pane과 router-lead는 유지한다. blocked/unknown/오류/결과 미회수 상태에서는 닫지 않고 상태를 보고한다. worktree·브랜치·결과 파일을 함께 삭제하지 않는다.
- `/new`는 횟수나 시간 기준으로 기계적으로 실행하지 않는다. 하나의 작업 완료·테스트 확인·미회수 Agent 없음 이후에 목표/변경 파일/검증/남은 문제/다음 행동을 짧은 인계문에 저장하고 새 작업 경계에서 사용한다. 진행 중 디버깅은 컨텍스트 유지가 필요하면 `/compact`를 고려한다. 작업 중인 자신에게 Herdr prompt로 `/new`를 보내지 않는다.
- hook을 끄려면 로컬 `tools/intelligent-router/config/runtime.local.json`의 enabled를 false로 설정하거나 Codex `/hooks`에서 비활성화한다. 인증·유료 API·전역 모델 설정을 바꾸지 않는다.
