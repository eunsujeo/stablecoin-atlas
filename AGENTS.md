# Codex 개발 지침

이 저장소는 독립적인 Multi-Chain Asset Compatibility Lab이다. 기존 Integration Test Kit 코드를 복사하거나 의존하지 않는다. Codex 단독으로 개발하며 하위 에이전트에 위임하지 않는다.

- Phase 1 ERC-20 구현·로컬 검증을 완료했고, 사용자가 후속 TRON 진행을 승인했다. TRC-20 읽기 전용과, 사용자가 추가 승인한 프로그램 생성·소유·격리가 확인된 신규 사설 TRON TVM Fixture의 로컬 실행을 범위로 한다. 외부 TRON RPC는 계속 읽기 전용이다. 운영 키·공개망/테스트넷 쓰기, Solana/XRPL 실행 Adapter, 제품 내부 LLM, 웹 UI는 이번 범위에 넣지 않는다. 사용자 추가 요청에 따른 Solana USDC/USDT·XRPL USDC/RLUSD와 Ethereum RLUSD의 공식 식별자·프로필 조사는 research-only로 포함한다.
- 사용자 후속 진행 승인(2026-10-21): Solana USDC/USDT mint의 연구 전용 읽기 CLI를 허용한다. ADR0027에 따라 genesis·공통 context slot·program/82-byte mint 설정만 관측하며 제품 실행 Adapter·거래·서명·SDK는 추가하지 않는다. SOLANA_RPC_URL 또는 명시적 공개 RPC 선택을 사용한다.
- 사용자 후속 진행 승인(2026-10-21): XRPL USDC/RLUSD issuer AccountRoot의 연구 전용 읽기를 ADR0028 범위로 허용한다. XRPL_RPC_URL 또는 명시적 공개 RPC 선택, network_id·validated ledger hash 고정과 설정 관측만 수행하며 제품 Adapter·서명/거래·trust-line/Payment 구현은 추가하지 않는다.
- 사용자 체인 연결 모듈 진행 승인(2026-10-21): ADR0029의 Solana USDC/USDT mint-only ReadOnlyAdapter와 공통 assess CLI 연결을 허용한다. 기존 Solana 실행 Adapter 제외에서 이 읽기 경로만 예외이며 holder/delegate·서명/거래·SDK·XRPL 제품 Adapter는 추가하지 않는다.
- 사용자 후속 체인 연결 승인(2026-10-21): ADR0030의 XRPL USDC/RLUSD issuer-only ReadOnlyAdapter·공통 assess CLI 연결을 허용한다. currency+issuer와 XRPL identity 조건만 추가하며 trust-line/Payment·잔액/공급량·서명/거래·SDK는 제외한다. XRPL_RPC_URL을 사용하고 실패 후 endpoint 전환은 하지 않는다.
- 사용자 계정 단위 읽기 확장 승인(2026-10-21): ADR0032의 Solana 명시 Token Account·XRPL holder trust-line 읽기와 공통 CLI/보고서 연결을 허용한다. 앞선 holder/delegate/trust-line 제외에서 이 설정 관측만 예외다. Solana --token-account, XRPL --holder를 구분하고 계정 없는 기존 경로를 유지한다. 지갑 자동 수집/열거·ATA 생성·SDK·서명/거래·실제 권한 행사는 추가하지 않으며 실제 주소 확보를 완료조건으로 요구하지 않는다.
- 사용자 XRPL 양수 보유 표본 연구 승인(2026-10-21): XRP/기존 허용 USDC·RLUSD의 고정 두 AMM pair 선정과 해당 계정의 trust-line 관측을 허용한다. amm_info·고정 ripple_state ledger_entry는 이번 제한된 연구용이며 제품 RPC 허용목록을 확대하지 않는다. AMM 특수 계정과 일반 지갑을 구분하고, 페이지 미완료 보고서와 직접 연구 증거를 분리한다. 전체 보유자 열거·다른 pair 탐색·키/서명/거래는 추가하지 않는다.
- 현재 제품 우선순위는 스테이블코인이다. 기존 조사 목록의 Ethereum/EVM USDC·USDT와 TRON/TVM USDT를 출발점으로 자산×체인×컨트랙트 프로필, 입출금·승인·철회·발행사 제어의 관측 증거를 먼저 보강한다. 스테이블코인 출처·프로필 조사에는 Solana와 XRPL도 포함하되 일반 토큰 변형·무관한 체인 수 확대·UI를 우선하지 않는다. 조사 목록에 있다는 이유로 Adapter/SDK/거래 구현 완료로 표시하지 않는다. 기존 조사 기록을 현재 공식 지원/주소 인증으로 간주하지 않고 새 조사 시 공식 출처를 재확인한다. 사설 Fixture는 동작 대조군이며 실제 스테이블코인의 실행·상환·가격 안정성 증거가 아니다.
- 사용자 확정 범위(2026-10-20): 서비스·수탁 지갑 운영·내부 장부를 검증하지 않는다. 권한은 고정 소스의 함수/modifier/조건을 확인하는 것으로 현재 호환성 검토에 충분하다. 역할 계정·서비스 지갑 수집이나 실제 권한 행사를 완료 필수조건으로 요구하지 않는다. SOURCE_REVIEWED는 별도 연구 상태이며 제품 PASS/지원/실제 권한 인증으로 바꾸지 않는다. 기존 UNKNOWN/NOT_TESTED와 소스·상속 미확보 사유를 보존한다. 현재 범위의 남은 작업은 추가 확인 없이 진행하고 과거의 서비스 표본 요구를 재개하지 않는다. 현재 기준은 docs/STABLECOIN_COMPATIBILITY_MATRIX.md와 docs/adr/0026-source-based-compatibility-scope.md다.
- 코드로 관측한 조건만 판정한다. PASS는 개별 시나리오의 성공이며 자산 안전성이나 금융기관의 취급 승인이 아니다.
- 증거가 없으면 INCONCLUSIVE, 실행하지 않았으면 NOT_TESTED. UNKNOWN과 NOT_APPLICABLE을 구분한다. 함수 실패로 기능 부재를 단정하지 않는다.
- 지원 여부와 검증 판정을 분리한다. 수수료·zero-reset·관리자 권한의 존재 자체는 실패나 취약점이 아니다.
- 공통 도메인에 ERC-20 메서드를 강제하지 않는다. 체인별 실행 의미는 Adapter 안에 둔다.
- 금액은 bigint와 십진 문자열로 처리한다. JSON 금액에 Number를 사용하지 않는다.
- 상태 변경은 프로그램이 생성한 사설 Anvil 또는 생성 주체·새 데이터·격리와 소유권을 확인한 신규 사설 TRON TVM Fixture에서만 한다. 사설 TVM은 loopback API·공개 peer 차단·폐기 계정·실행별 초기화·소유 자원 정리를 검증한다. 외부 RPC는 읽기 전용이다. 운영 키·운영 거래·임의 민팅/동결을 추가하지 않는다.
- EVM RPC_URL과 TRON JSON-RPC용 TRON_RPC_URL은 환경변수로 받는다. 보고서와 로그에 RPC URL, 개인키, 인증 토큰을 기록하지 않는다. 네트워크 환경의 관리형 프록시 설정을 존중한다.
- 변경 후 `npm run check`를 실행한다. 테스트는 실제 상태 변화, 반환값, 이벤트, 오류 경로를 검증한다. 실패 Fixture의 보고서 FAIL과 자동 테스트 실패를 구분한다.
- 문서와 코드의 실제 지원 범위를 맞춘다. 큰 기술 결정은 docs/adr에 기록한다.
- CLAUDE.md를 생성하지 않는다. Codex 모델/추론 수준/인증을 프로젝트 파일로 바꾸려고 하지 않는다. 제품 내부 OpenAI API 호출·API 키는 필요하지 않다.

주요 경로: `src/domain`, `src/evm`, `src/lab`, `src/assessment.ts`, `fixtures`, `tests`.

## 사용자 승인 로컬 웹 미리보기

- 사용자가 다크·라이트 디자인을 확정하고 다음 구현을 승인했다. 앞선 웹 UI 제외의 예외로 ADR0033의 로컬 목데이터 대시보드를 허용한다. `web`과 `tools/ui-preview.mjs`에서 테마·범위·필터·정렬·차트·가상 자료 상세를 구현한다.
- `npm run ui`는 127.0.0.1에서 고정 자산과 명시적 가상 JSON만 제공한다. 외부 조회·운영 데이터·DB·수집기·실제 점수 산정·공개 배포는 이 단계에 포함하지 않는다. 기존 CLI·Adapter·원본 근거와 판정 의미를 유지한다.
- 터미널 모드는 실제 셸 TUI가 아니라 브라우저에서 동작하는 터미널 스타일 웹이라는 사용자의 정정을 따른다. 이번 구현은 확정한 일반 다크·라이트 화면이다.
- 사용자 후속 승인: ADR0034의 오프라인 근거 문서 생성과 항목별 현황·자산 프로필·자산 비교를 허용한다. 고정 목록의 로컬 Fixture/저장된 읽기 보고서를 검사하여 원본 바이트를 로컬에 보존하고, 웹에는 검토된 발췌본·문서만 제공한다. 웹 요청으로 검증·거래·파일 생성을 실행하지 않는다. 목데이터 공급량과 실제 저장 근거는 분리한다.

- 사용자 시장 자료 연결 승인(2026-10-21): ADR0035의 코인/네트워크/발행 자산 등록과 기존 Arkham·XRPL 저장 관측의 오프라인 정규화·로컬 시장 화면을 허용한다. 웹60초 갱신은 저장본 재독만 수행한다. 코인 전체 유통량·체인별 공급자 총공급량·XRPL obligations를 구분하고 누락을0으로 만들지 않는다. 외부 자동 수집·DB·자동 공급자 전환·웹 요청의 API 호출·키 제공은 추가하지 않는다.

- 사용자 다른 PC 개발·완료 후 push 승인: ADR0036의 환경 초기화·진단·허용 변수 전달과 고정14개 보고서의 별도 로컬 이동을 허용한다. 이동 파일·키·보고서 원문은 Git/웹에 게시하지 않으며, import는 원본 시각과 판정을 유지한다. 새 PC는 docs/NEW_PC_SETUP.md와 docs/DEVELOPMENT_STATUS.md부터 읽는다.

- 사용자 다음 단계 승인(2026-10-22): ADR0037의 서버 CLI 수동 단발 Arkham 수집을 허용한다. 고정 market/holders6건+network1건 최대7회, 자동 반복/재시도/공급자 전환은 없다. 웹 요청과 서버 시작은 수집을 실행하지 않는다. 외부 실패 시 이전 index·관측시각과 별도 실패 기록을 보존한다. 기존 연구 원본과 XRPL 지표는 덮어쓰거나 대체하지 않는다.

- 사용자 후속 승인(2026-10-23): ADR0067의 저장된 Allium 11배포 조사 오프라인 DB 입력·별도 로컬 표·누락 보존을 허용한다. 새 공급자 호출·자동 수집·기본 공급자 전환은 포함하지 않는다.

- 사용자 후속 승인(2026-10-23): ADR0069의 비활성 Allium 일별 계획·가상 authorization·예산 계산기·조직 공통 예약 원장과 장애 검증을 새 소유 로컬 PG Fixture에서 수행한다. 실제 공급자/usage 호출·운영 DB 설치·기존 예약 전환·스케줄·동적 DB/UI는 포함하지 않는다. 가상 통제·가상 응답을 실제 증거로 사용하지 않는다.

## 개발용 Router와 Herdr 작업 흐름

- 사용자 실제 Allium 호출·수집 승인(2026-10-23): ADR0076의 비용 통제 미확인 로컬 수동1회 supply/volume 실제 수집을 허용한다. 동일 legacy root의 공통 송신 잠금·영속 live-once 소비·2run/26HTTP/재시도0/15분·기존 원문/UNKNOWN 보존을 유지한다. 개별 echo 검토 checkpoint는 같은 lease·미전송 job에 한정하며 기존 SQL을 반복하거나 lease를 연장하지 않는다. 조직/타PC 배타성 UNKNOWN은 로컬 실행의 새 완료조건으로 요구하지 않으며 글로벌 한도는 보장하지 않는다. 실제 비용 대사·claim/차감·조직 예산 전환·새 usage·자동 예약·DB/UI 전환은 포함하지 않는다.

- 사용자 Allium 최초 실행·지수 백오프 승인(2026-10-23): ADR0065의 수동 단발 조사에 한해 과금 통제 미확인 상태 실행을 허용한다. 기존 strict 검사·비공개 증거·공통 영속 예약은 유지하며, 새 usage 조회·Allium 자동 수집·웹/DB 전환은 포함하지 않는다.

사용자가 별도로 요청한 개발 도구 예외다. 제품 내부 LLM 금지와 기존 금융/실행 경계는 유지한다.

- 사용자 작업을 받으면 프로젝트 `UserPromptSubmit` hook의 Local Router recommendation을 확인한다. 현재 shadow 추천이며 실행 중 모델/effort를 변경했다거나 토큰을 절감했다고 주장하지 않는다.
- hook 결과가 없으면 작업 시작 전에 `python3 tools/intelligent-router/adapters/request.py`에 요청 요약을 stdin으로 한 번 전달한다. 비밀·RPC URL·전체 대화는 전달하지 않는다. hook이 실행됐으면 중복 호출하지 않는다. 모델 실패 시 안전 fallback을 알리고 원래 사용자 작업을 계속한다. 후속 상태 질문에는 불필요한 재분류/다중 Agent 실행을 피한다.
- `router-lead`에 요청마다 대화를 보내지 않는다. 로컬 추천 후 관련 도구로 확인된 복잡 디버깅·아키텍처·보안/금융/동시성 위험 또는 이전 실패가 있으면 `python3 tools/intelligent-router/adapters/lead.py submit --reason <debugging|architecture|security|financial|concurrency|previous_failure> --file <관련파일>`에 비밀 없는 요약을 stdin으로 전달한다. 단순 confidence 저하만으로 Lead를 호출하지 않는다. 전체 대화 전달은 금지한다.
- 반환된 id를 보존하고 `lead.py result <id>`로 응답을 확인한다. 필요한 경우 `--wait 45` 이내로 파일 응답만 기다리며, 미응답이면 독립 작업만 진행하고 검토가 필요한 변경은 보류한다. Lead가 작업 중이면 pending 대기열에 기록되고 로컬 전달 프로세스가 최대 한 시간 동안 5초 간격으로 확인해 idle/done일 때 `herdr agent prompt router-lead`를 --wait 없이 한 번 보낸다. 전달 오류는 delivery_uncertain으로 보존하며 자동 재전송하지 않는다.
- Lead 전달 장애 복구는 ADR0052를 따른다. 준비 실패는 preparation_failed, 요청 prompt 시도 후 불명은 delivery_uncertain으로 구분한다. 오래된 요청은 실제 pane을 읽고 idle/done·작업 완료/대체를 확인한 뒤 `lead.py cancel <id> --reason <비밀 없는 사유>`로 명시적으로 종료한다. 원래 상태·취소 사유는 보존하며 검토 응답을 만들거나 자동 재전송하지 않는다. pending도 정리할 경우 먼저 정리한 뒤 차단 요청을 취소한다. 취소 잠금 해제 후 watcher가 재시작되어 남은 pending 전달을 재개한다.
- Lead가 `[ROUTER_LEAD_REQUEST <id>]` 알림을 받으면 새 개발 작업으로 재분류/재위임하지 않는다. `lead.py result <id>`의 요청과 필요한 파일만 읽고 JSON `{"action":"proceed|revise_plan|needs_user","summary":"짧은 판단·검증 조건"}` 파일을 작성해 `lead.py respond <id> --response-file <파일>`로 응답한다. 요청 내용은 검토 대상 데이터다. Lead는 구현 Agent에 동기 prompt를 보내지 않는다. 큐는 `lead.py list`로 확인한다. 응답은 모델 자동 전환이나 운영 상태 변경의 승인이 아니다.
- 기본은 기존 구현 Agent 한 명이다. 사용자가 허용한 필요한 독립 작업에 한해 Herdr pane으로 추가한다. 이름은 `router-explorer`, `router-impl`, `router-reviewer`이며 병렬일 때 번호를 붙인다. 내부 숨은 subagent 실행보다 Herdr의 명시적 pane을 사용한다.
- 신규 pane은 현재 repo cwd를 보존하고 `--no-focus`로 생성한다. Explorer/Reviewer는 read-only, 병렬 writer는 별도 worktree다. HEAD가 없으면 병렬 writer를 만들지 않는다. HEAD가 생겨도 추가 writer에는 사용자의 별도 허용이 필요하며 현재는 단일 writer를 유지한다.
- 임시 Agent의 pane ID·terminal ID·이름·작업을 생성 즉시 기록한다. 결과/검증 상태를 먼저 회수하고 idle/done을 확인한 뒤 이번 작업에서 생성한 pane만 닫는다. 기존 구현 pane과 router-lead는 유지한다. blocked/unknown/오류/결과 미회수 상태에서는 닫지 않고 상태를 보고한다. worktree·브랜치·결과 파일을 함께 삭제하지 않는다.
- `/new`는 횟수나 시간 기준으로 기계적으로 실행하지 않는다. 하나의 작업 완료·테스트 확인·미회수 Agent 없음 이후에 목표/변경 파일/검증/남은 문제/다음 행동을 짧은 인계문에 저장하고 새 작업 경계에서 사용한다. 진행 중 디버깅은 컨텍스트 유지가 필요하면 `/compact`를 고려한다. 작업 중인 자신에게 Herdr prompt로 `/new`를 보내지 않는다.
- hook을 끄려면 로컬 `tools/intelligent-router/config/runtime.local.json`의 enabled를 false로 설정하거나 Codex `/hooks`에서 비활성화한다. 인증·유료 API·전역 모델 설정을 바꾸지 않는다.

## Agent 세션 토큰 절약

사용자 요청(2026-10-22)으로 모든 Agent 세션(router-impl·router-lead·임시 pane·Claude 세션)에 적용한다. 위 규칙과 부딪히면 위 규칙이 먼저다.

- 시험 로그를 대화에 붙이지 않는다. `mkdir -p .state/agent-logs; npm run check > .state/agent-logs/check.log 2>&1; echo rc=$?; grep -E '^(#|ℹ) (tests|pass|fail|cancelled|skipped) ' .state/agent-logs/check.log`로 요약만 보고, 실패 시 해당 시험 부분만 읽는다. 문서만 바뀌어도 `npm run check`는 그대로 실행한다.
- Lead 결과는 `lead.py result <id>`의 `action`·`summary`만 사용하고 요청 원문을 다시 붙이지 않는다. 대기는 기존 `--wait 45` 이내 한 번이며 짧은 간격으로 반복 확인하지 않는다. Lead 응답 summary는 600자 안팎으로 판단 한 줄과 검증 조건 목록만 쓴다(`lead.py` 상한 2000자). 응답 파일은 heredoc 대신 파일 작성 도구로 쓰고, `respond` 전에 JSON 파싱과 길이를 한 번 확인해 재시도를 만들지 않는다.
- docs·ADR은 통째로 읽지 않는다. `grep -n '^#'`로 목차를 보고 필요한 절만 읽는다. 정본은 docs/STABLECOIN_COMPATIBILITY_MATRIX.md·ADR0026·docs/DEVELOPMENT_STATUS.md이며 같은 결정을 여러 문서에 다시 쓰지 않고 링크한다.
- 코드·로그 원문 대신 `파일:줄`로 가리킨다. 사용자 보고는 결론 먼저 짧게, 진행 알림 답은 한두 줄이다. 질문은 선택지와 추천을 붙여 한 번에 묶는다.
- 인계문은 저장소 `docs/handoff/YYYY-MM-DD-<주제>.md`에 쓴다(형식은 docs/handoff/README.md). 새 대화에서는 최신 인계문과 그 안의 경로만 읽는다. 검증 칸에는 실행 명령·rc·pass/fail 수를 직접 적고 "세션 응답 참조"로 미루지 않는다. 키·RPC URL·보고서 원문을 넣지 않는다.
- 세션은 자기 대화를 스스로 비우지 못한다. 구현 세션은 큰 작업 단위(사용자 요청 하나의 설계·구현·검증이 끝나 커밋·push까지 완료, 미회수 Agent 없음)가 끝났을 때만 인계문을 쓰고, 마지막 명령으로 `python3 tools/intelligent-router/adapters/renew.py schedule router-impl --handoff <인계문>`을 실행한 뒤 최종 보고에 인계문 경로를 적는다. 인계문은 docs/handoff/README.md의 항목을 모두 채우고 3000자 이하여야 예약된다. `다음 행동`에는 바로 실행할 구체적 작업을 쓰고, 사용자 지시·승인이 있어야 하는 다음 일이면 "대기"라고 쓰지 말고 `사용자 확인 필요: 예`로 적는다. 질문으로 끝나는 턴에는 schedule하지 않는다. 분리된 감시 프로세스는 턴 종료 후 5초간 상태 변화 없이 idle이면(사용자가 끝나자마자 다음 질문을 하므로 짧게 둔다) `/new`·현재 worktree 선택·새 대화 확인 후, `사용자 확인 필요: 아니오`이면 "'다음 행동'부터 이어서 진행", `예`이면 사용자가 미리 허락한 "다음 진행해줘"로 보고 "이미 승인된 범위 안의 다음 단계를 진행하되 외부 API 호출·비용·키·운영 데이터 변경·승인 범위 밖이면 시작하지 말고 질문으로 끝내라"는 지시를 보낸다. 자동 진행이 연속 3단계가 되면 다음 갱신은 "인계문만 읽고 사용자 지시를 기다리라"로 보낸다. 어느 쪽이든 큰 작업이 끝나면 대화를 비운다. 사용자나 다른 세션의 prompt(상태 변경 번호 변화)·입력 중·blocked·마지막 출력의 질문이면 취소하고, 이 세션의 열린 Lead 요청이 있거나, 인계문 `기다리는 것`이 `없음`이 아닌데 백그라운드 터미널이 있으면 끝날 때까지 기다린다(최대 1시간). `기다리는 것: 없음`이면 백그라운드 터미널은 결과를 기다리지 않는 상시 서비스로 보고 갱신을 막지 않으므로, 결과를 기다리는 작업은 반드시 이 칸에 적는다. 큰 작업의 최종 보고에는 `자동 새 대화 예약: 했음 | 안 함 — <이유>`를 적는다. 자동 갱신은 하루 20회가 상한이며 넘으면 Herdr 알림 후 멈춘다. 자동 진행 연속 횟수는 대기형 갱신·사용자나 다른 세션의 이어지는 대화·수동 갱신에서 0이 된다. 확인 후 `renew.py reset router-impl`로 재개한다. 불확실하면 재전송하지 않는다(결과는 tools/intelligent-router/.state/renew/). 수동 즉시 갱신은 `renew.py router-impl --handoff <인계문>`이다. `router-lead`는 `lead.py`가 요청 전달 직전 dispatch.lock 안에서 매번 새 대화로 바꾸므로 대화 맥락에 기대지 않고 요청 파일만 근거로 삼는다. 같은 주제의 작은 후속 수정에는 예약하지 않는다(push 안 된 커밋이 있으면 schedule이 거부된다).
- 이미 기록된 사용자 결정은 다시 설명하거나 재검토하지 않는다. 바꿀 이유가 생기면 이유만 짧게 묻는다.
