# Intelligent LLM Router 조사 및 설계

2026-10-19 조사. Phase 1/2 완료. 후속 사용자 요청으로 프로젝트 요청 hook과 Herdr 임시 Agent 수명 관리 Adapter를 추가했다. hook의 자동 추천 호출은 native 신뢰 승인 후 동작한다. 모델 자동 전환과 Phase 3~5의 전체 실행 자동화는 미구현이다.

## 환경에서 확인한 사실

| 항목 | 로컬 확인 결과 |
|---|---|
| OS/CPU/RAM | macOS 15.7.9, arm64, Apple M4 Max, 14 CPU 코어, 36 GiB |
| Herdr | client/server 0.9.0, protocol 22, 호환 상태 |
| 현재 프로젝트 | workspace w9, tab w9:t1, Codex pane w9:p1 및 w9:p2; 조사는 p2 작업 |
| caller context | 상속된 ID가 실제 세션과 불일치. `--current`는 pane_not_found, 상속 workspace는 workspace_not_found. 목록에서 명시 ID를 확인해야 함 |
| Codex | CLI 0.163.0, `login status`: Logged in using ChatGPT |
| 인증 확인 | 기본 App Server `account/read`: type=chatgpt. 이메일·계정 ID·토큰은 수집/저장하지 않음 |
| Herdr integration | codex hook current(v8). 설치/설정 변경하지 않음 |
| Python | 시스템 3.9.6; 기존 uv 관리 Python 3.13.13으로 /tmp 격리 venv 생성 |
| 제품 | TypeScript/Node CLI, viem/solc/Anvil; Router 제품 의존성 추가 없음 |
| Git | main에 HEAD 커밋 없음, 기존 파일 모두 untracked. 다른 Codex pane도 같은 checkout 사용 중 |

조사 명령: `herdr --help`, `status`, `agent`, `pane`, `workspace`, `worktree`, `tab`, `integration`, `workspace list`, `agent list`, `pane get w9:p2`, `pane layout --pane w9:p2`, `worktree list --cwd ...`, `integration status`; `codex --help`, `exec --help`, `app-server --help`, `login status`. 문법 조사 시 인자 없는 생성 명령은 실행하지 않았다.

루트 AGENTS.md는 제품 내부 LLM과 하위 위임을 제한한다. 이번 요청으로 허용된 개발용 도구만 별도 범위로 추가했으며 비즈니스 코드와 전역 설정은 수정하지 않았다. 병렬 코딩을 시작하기 전 현재 미커밋 작업을 보존한 초기 커밋이 필요하다. 이번 작업은 커밋을 생성하지 않는다.

## Codex 모델 및 인증

설치된 App Server의 initialize → initialized → account/read → model/list를 실제 호출했다. 모든 반환 모델은 low/medium/high/xhigh/max를 지원한다. 아래 ultra 지원도 카탈로그에서 확인했다.

| 모델 | 표시 | ultra | 잠정 용도 |
|---|---|---|---|
| gpt-6-luna | visible | 없음 | Economy / low |
| gpt-6.1-sol | visible, 기본 | 있음 | Standard / medium |
| gpt-6-astra | visible | 있음 | Advanced / high 및 불확실성 fallback |
| gpt-6-sol | visible | 있음 | 수동 대안 |
| gpt-5.6-sol | visible | 있음 | 수동 대안 |
| gpt-5.6-terra | visible | 있음 | 수동 대안 |
| gpt-5.6-luna | visible | 없음 | 수동 대안 |
| gpt-reserve, codex-auto-review | hidden | 없음 | 자동 선택 제외 |

**카탈로그는 모델별 추론 성공 증거가 아니다.** 이번 단계에서 추가 Codex 추론을 실행하지 않았다. 따라서 각 모델의 현재 계정 실행 권한, quota 배수, 실제 성공률은 NOT_TESTED다. 잠정 매핑은 설정 데이터이며 모델 간 토큰/구독 효율 우열을 입증한 결과가 아니다. Phase 3에서 각 선택 조합의 최소 읽기 전용 turn을 확인한 후 허용 목록에 넣는다. 설치 모델이 바뀌면 `adapters/catalog.py`로 재조회하고 숨김 모델, 미지원 effort, 검증되지 않은 조합의 실행을 막는다. 모델명을 라우팅 코드에 고정하지 않는다.

| 방식 | 모델·effort | 세션 | 결과/사용량 | 판단 |
|---|---|---|---|---|
| Codex CLI exec | `-m`, `-c model_reasoning_effort=...` | exec resume/fork 지원 | `--json`, `--output-last-message`; 실제 제공된 usage만 기록 | 기계 평가 대안, 실행 미검증 |
| App Server | model/list, thread/start, turn/start | thread ID와 resume | 구조화된 완료/오류/usage 이벤트 | 카탈로그 조회 검증; 작업 실행은 초기 MVP에서 제외 |
| Herdr Codex agent | agent start의 `--` 뒤 native CLI 인자 | TUI 세션, agent identity/state | agent read의 화면 텍스트; 구조화 usage 보장 없음 | 주요 실행 경로로 선정, start/prompt 종단 시험은 Phase 3 |

기존 Codex 관리형 ChatGPT 인증만 사용한다. API 키·커스텀 provider·세션 토큰 추출·외부 인증 재구현은 하지 않는다. 실행 직전 인증 type이 chatgpt가 아니면 중단한다. 구독 한도 초과는 사용자에게 표시하고 유료 API로 전환하지 않는다. 토큰 수 감소와 구독 사용량 감소는 같은 지표가 아니다.

공식 근거: [App Server 프로토콜 및 모델 조회](https://learn.chatgpt.com/docs/app-server), [Codex 인증](https://developers.openai.com/codex/auth). 최신 문서보다 설치 CLI의 반환 스키마/명령 지원을 우선한다.

## Decision Model 비교 및 선택

| 후보 | macOS 실행/가속 | 메모리 기준 | 분류/지연 | 설치·유지보수/라이선스 |
|---|---|---|---|---|
| d3-lite 0.8B | 이번 M4 Max MPS 실행 성공. CPU 옵션도 있으나 미측정 | 원본 저장소 약 1.73GB; PoC RSS는 평가 문서 참조 | 임의 질문 choice/noul/score와 확률; 프로젝트 정확도 미확정 | custom runtime 검토·revision 고정 필요. Apache-2.0 |
| d3-lite Core ML | 공개 Mac GPU 실행 사례, 이 장비에서는 미검증 | 배포 다운로드 약 3.7GB, 상주 메모리 아님 | 공개 M5 Pro median 53ms, 이 프로젝트 수치 아님 | 별도 변환물/host 의존. 배포물·upstream 고지 확인 필요 |
| Vela 2.0 0.3B | Torch/ONNX CPU/GPU 경로 공개. 이 Mac 실행 미검증 | fp32 0.3B 가중치 산술 하한 약 1.2GB, RSS 아님 | 사용자 정의 choice/score/set/span, 8192 입력; 프로젝트 정확도/지연 미측정 | 대안 후보. Apache/MIT 및 상속 tokenizer Gemma 조건 확인 필요 |
| Vela 1.0 Domain 307M | CPU 우선 전문 encoder, Mac 미검증 | fp32 가중치 하한 약 1.23GB | 14개 주제 분류; complexity/risk를 직접 해결하지 못함 | 표준 Transformers 경로, 모델 카드 Apache-2.0 및 upstream 고지 확인 |
| multilingual MiniLMv2 L12 NLI | 표준 Transformers CPU/MPS 후보, 미검증 | 117M fp32 가중치 하한 약 468MB | zero-shot 의미 분류 가능, 512토큰 제한; 한국어 코드 요청 검증 필요 | MIT, 오래된 범용 NLI 모델; 금융 위험 판단 근거 부족 |

가중치 용량/산술 하한은 프로세스 RSS나 GPU 메모리가 아니다. 미측정 성능을 추정 실측처럼 사용하지 않는다.

**최종 PoC 추천은 d3-lite 원본 + PyTorch MPS**다. 실제 로컬 실행을 검증했으며 원시 확률을 보존할 수 있다. production 자동 라우팅 승인은 아니다. Vela 2.0은 fallback 후보로만 남기고 여러 모델을 상시 적재하지 않는다. Core ML 최적화는 정확도 검증 이후 필요할 때 비교한다.

근거: [d3-lite 모델 카드](https://huggingface.co/vllm-sr/d3-lite), [Apple Silicon 공개 실험](https://vllm-semantic-router.netlify.app/blog/decision-3-0-on-apple-silicon/), [Vela 2.0 모델 카드](https://huggingface.co/vllm-sr/Vela-2.0-0.3B), [Vela 라이선스 범위](https://huggingface.co/vllm-sr/Vela-2.0-0.3B/blob/main/LICENSING_STATUS.md), [Vela Domain](https://huggingface.co/vllm-sr/Vela-1.0-Encoder-307M-Domain), [MiniLM NLI](https://huggingface.co/MoritzLaurer/multilingual-MiniLMv2-L12-mnli-xnli).

## 최소 구조와 정책

```text
Herdr의 Lead 요청 → 명시적 관련 컨텍스트 → 로컬 d3-lite
 → 원시 answers/확률 → 정책 Adapter → 추천 JSON → 구현 Agent에 hook context로 반환
 → [Phase 3] 검증된 모델/effort → Herdr Codex agent → 결과/평가 기록
```

`decision/questions.json`은 task_type, complexity, risk를 묻는다. 모델은 필요한 JSON을 직접 생성하지 않으며 `routing/policy.py`가 choice 답을 변환한다. confidence는 세 질문의 **native confidence 최솟값**이고, 이 revision의 native confidence는 `1 - normalized Shannon entropy`다. 성공 확률이 아니다. 값 누락/NaN/에러/잘못된 확률 분포는 confidence=null과 안전 fallback이다. 원시 답도 보존한다.

문서/탐색 low·low는 Economy/low, 일반 구현·국소 버그는 Standard/medium, high 난이도·아키텍처·복잡 디버깅·위험 작업은 Advanced/high. 이전 실패, 컨텍스트 누락/잘림, 5개 초과 변경 파일, 다중 모듈 변경, 명시된 금융/보안/동시성 변경도 상향한다. 이 숫자는 초기 보수 정책이며 평가로 조정해야 한다. 반복 테스트는 Lead가 이미 정한 명령을 직접 실행하는 것이 원칙이다. 분류기만 test_execution이라고 판단해도 임의 shell 실행을 허용하지 않는다.

누락 메타데이터를 안전하다고 간주하면 안 된다. 현재 PoC는 발췌문과 `sensitive_change`, `changed_files`, `module_count`, `previous_failure`, `context_incomplete`를 입력받는다. 실제 diff/의존성 그래프 추출과 과거 모델 성공 이력 저장·선택 반영은 Phase 3에서 추가한다. 키워드 점수만으로 분류하지 않는다. 신뢰할 수 없는 코드 주석과 요청의 분류 지시문도 공격/오분류 평가 대상이다.

## Herdr 실행 설계와 한계

아래는 설치 CLI에서 확인한 문법이며, 이번 PoC가 자동 실행하는 명령이 아니다. pane ID는 생성 JSON의 result.pane.pane_id에서 읽는다.

```sh
herdr pane split --pane <검증된-caller-pane> --direction down --cwd <repo> --no-focus
herdr agent start <unique-name> --kind codex --pane <new-pane> -- -m <configured-model> -c 'model_reasoning_effort="low"' -s read-only
herdr agent prompt <unique-name> '<최소 작업 요약>' --wait --timeout 60000
herdr agent get <unique-name>
herdr agent read <unique-name> --source recent-unwrapped --lines 120
```

가로가 좁은 현재 pane은 down 분할이 적합하다. read-only는 Explorer/Reviewer용이며 Implementer는 별도 worktree에서 workspace-write를 사용한다. `--wait`는 lifecycle 완료 관측이며 작업 성공/테스트 통과를 의미하지 않는다. blocked/timeout/agent_prompt_stalled는 get/read로 상태를 확인하고 맹목적으로 재제출하지 않는다. 결과가 화면에서 복구되지 않을 때만 파일 출력을 추가 요청한다. 세부 동작은 [Herdr 공식 문서](https://herdr.dev/docs/quick-start/)와 [Codex integration](https://herdr.dev/docs/integrations/)를 따른다.

단순 작업은 Lead 자체 또는 Implementer 한 명으로 끝낸다. 기존 대화를 복제하지 않는다. Lead는 결정적 스크립트로 구현하여 요청마다 GPT Lead 호출을 추가하지 않는 방향이다. Explorer는 좁은 컨텍스트를 도구로 찾을 수 없을 때만, Reviewer는 고위험/복잡 변경에서만 순차 투입한다. 독립 작업이 입증될 때만 병렬 분리한다. worktree 지원 문법은 확인했지만 HEAD가 없어 생성은 미실행이다. 공유 worktree 동시 수정은 금지한다.

Herdr 자체의 자동 모델 선택과 실행 중 모델의 공식 per-turn 변경 명령은 확인하지 못했다. Codex의 공식 `UserPromptSubmit` hook으로 기존 구현 Agent의 새 요청을 로컬 분류기에 전달하는 경로를 추가했다. 프로젝트 `.codex/hooks.json`만 추가하고 전역 hook/인증 설정은 변경하지 않는다. Codex `/hooks`에서 새 정의를 검토·신뢰해야 실행되며 신뢰를 우회하지 않는다. 추천은 개발자 context에 짧게 추가하고 실제 모델은 유지한다. 단순 요청은 별도 Lead GPT turn을 사용하지 않는다. 확인된 복잡성/위험/실패는 [Lead bridge](LEAD_BRIDGE.md)의 큐와 Herdr 비동기 알림으로 실제 router-lead에 전달하며 이 경우 추가 GPT turn을 사용한다.

관련 파일과 사용법은 [운영 작업 흐름](ROUTER_WORKFLOW.md)을 참조한다. `adapters/agents.py`는 필요 시 명시적으로 호출하는 pane 생성/시작/결과 회수 후 제거 도구다. hook이 자율적으로 Agent를 만들지는 않는다. 추가 Agent 최대 수는 현재 1명이며 기본 구현 pane과 router-lead는 예산/정리 대상이 아니다.

## 토큰 정책 및 단계

요청/발췌문은 각각 4000/8000자로 제한하며 초과 시 불확실 처리한다. 실제 모델 토큰 상한 초과도 fallback한다. 전체 저장소 재읽기/대화 복제 금지, rg → 관련 함수 → git diff 순서로 필요한 증거만 제공한다. 발췌문 요약은 파일·함수·관측 사실·실행 명령·남은 문제로 한정한다. 검증은 컴파일러/린터/테스트가 우선이며 모델 재시도는 최대 한 번 상향 후 사용자 판단으로 중단하는 정책을 MVP에서 구현한다.

1. Phase 1: 본 조사·설계, 제품/개발 도구 경계 확정. 완료.
2. Phase 2: pinned d3-lite 로컬 실행·구조화·측정. 완료. 독립 정확도 검증은 남음.
3. Phase 3: 요청 Adapter와 프로젝트 hook, 명시적 임시 Agent 시작/정리 및 카탈로그/인증 확인 구현. 모델별 최소 turn·Herdr 종단 검증·성공 이력·diff/의존성 추출·수동 모델 override는 남음. runtime.local.json enabled=false와 `/hooks` 비활성화 지원.
4. Phase 4: 기존 실행 유지하며 실제 요청 추천과 실제 모델/결과를 비교한다. hook 코드의 로컬 호출은 검증했으나 native 신뢰 승인 및 실제 turn 관측은 남음. 독립 라벨 평가 및 fallback/고위험 누락 검사가 필요하다. 모델 자동 전환 없음.
5. Phase 5: 기준 통과한 문서/탐색부터 opt-in 자동화. 검증된 모델·effort만 실행, 실패/불확실성은 안전 fallback, quota/인증 오류는 중단. 병렬 writer는 독립 worktree와 통합 테스트 필수.

이점은 불필요한 GPT 판단 호출과 대화 재전달, 중복 탐색을 줄일 가능성이다. 위험은 라우팅 오분류, 과도한 fallback/agent 생성, cold start 및 모델 유지보수, 전환으로 인한 컨텍스트/캐시 손실이다. 현재 실험은 절감 효과를 입증하지 못했다.
