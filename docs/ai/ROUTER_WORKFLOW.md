# 실제 작업 흐름과 Agent 수명

현재는 자동 **추천 요청**을 연결한 shadow 방식이다. 사용자는 기존 프로젝트 구현 Agent에 작업을 요청한다. router-lead는 Router 관리·예외 조율을 담당하며 매번 별도 GPT 판단 turn을 소비하지 않는다. 실제 복잡성/위험/이전 실패가 확인되면 [Lead bridge](LEAD_BRIDGE.md)를 통해 구현 Agent가 router-lead에 조건부로 요청하고 응답을 회수한다. 이 Agent 호출에는 GPT turn이 사용된다.

1. 구현 Agent가 새 작업을 받는다.
2. 신뢰된 프로젝트 UserPromptSubmit hook → `adapters/request.py` → 로컬 d3-lite → 정책 Adapter 순서로 추천을 계산한다. 결과는 짧은 hook context와 로컬 `.state/routes` 기록으로 반환한다. 사용자 요청·코드·전체 대화는 기록하지 않는다. hook 결과가 있으면 다시 요청하지 않는다.
3. 기존 구현 Agent가 추천을 확인하고 작업한다. 현재 실행 모델은 변경하지 않는다. 코드 컨텍스트 없이 받은 자동 요청은 불확실한 것으로 처리하므로 Advanced 추천이 많다. 해당 추천이 실제 모델 전환이나 검토 Agent 추가 실행을 자동으로 일으키지는 않는다.
4. rg/관련 함수/diff/컴파일러/테스트가 우선이다. 필요한 독립 작업만 Herdr Agent로 분리한다. 모델 장애·25초 timeout·다른 로컬 분류 진행 중에는 재시도 폭증 없이 conservative fallback을 반환한다.
5. 결과와 검증을 통합한다. 추가 Agent의 결과를 먼저 회수하고, 완료를 확인한 뒤 그 작업에서 만든 임시 pane만 제거한다. 기존 구현 pane과 router-lead는 유지한다.
6. 작업 완료·검증·인계 저장 후 새 작업 경계에서 `/new`를 사용한다. 연관된 디버깅을 이어갈 때는 필요한 맥락을 보존한다.

## 다른 PC에서 재현

[Herdr 새 PC 설정](HERDR_NEW_PC_SETUP.md)의 역할/pane/integration/hook/runtime 순서를 따른다. `adapters/setup.py check`는 비밀 없이 로컬 준비 상태만 확인하고, `runtime`은 pin된 manifest 확인 후 해당 PC 경로를 ignored0600 설정으로 새로 기록한다. Agent 생성/인증/설치/추론은 자동 실행하지 않는다.

## 최초 활성화

프로젝트 `.codex/hooks.json`을 추가했다. 설치 Codex 0.163.0은 hooks=true다. **구현 Agent의 Codex에서 `/hooks`를 열어 프로젝트의 `UserPromptSubmit` 정의를 검토·신뢰해야 한다.** 이미 실행 중인 세션에서 파일이 보이지 않으면 인계를 저장한 뒤 재시작하고 `/hooks`로 확인한다. 현재 세션의 hot reload를 보장하지 않는다. 승인 UI를 Herdr로 대신 승인하거나 trust bypass 옵션을 사용하지 않는다.

이는 [공식 hook 신뢰 정책](https://learn.chatgpt.com/docs/hooks)의 요구다. 승인 전에는 AGENTS.md의 지침으로 요청 요약을 다음 명령의 stdin에 한 번 전달한다.

```sh
python3 tools/intelligent-router/adapters/request.py
# 요청 요약을 stdin으로 전달. 문맥이 필요하면 --context-file <명시적-짧은-발췌문> 사용.
```

hook을 끄려면 `config/runtime.local.json`의 enabled를 false로 바꾸거나 Codex `/hooks`에서 비활성화한다. model/effort/ChatGPT 인증은 변경하지 않는다. 상주 프로세스/추가 API는 없다. 매 요청 모델 적재 비용은 adapter_wall_seconds에 포함되고 request.py는 분류 stdout/stderr를 GPT에 전달하지 않는다. 네트워크/프록시 환경은 수정하지 않는다.

## 추가 Agent의 화면 표시와 정리

필요한 Agent를 생성할 때만 다음 도구를 명시적으로 사용한다. 내부 숨은 subagent를 만들지 않는다. pane 생성은 --no-focus이며 caller ID는 실시간 Herdr 목록에서 확인한다. task 요약에는 비밀을 넣지 않는다.

```sh
python3 tools/intelligent-router/adapters/agents.py open --role explorer --caller-pane <실제-pane-ID> --direction down --task '<필요한 탐색 요약>'
```

반환한 name/pane_id/id를 보존한다. Agent 이름은 `router-explorer`, `router-impl`, `router-reviewer`이며 이름이 겹치면 번호가 붙는다. 이는 Herdr agent start로 실제 생성된 Agent 이름이다. 기본 임시 Agent 예산은 1명이다. Explorer/Reviewer는 read-only, 추가 Implementer는 `--worktree <별도-등록된-worktree>`가 필수이며 공유 checkout 동시 수정은 거부한다.

그다음 설치 Herdr의 `agent prompt <name> '<짧은 작업>' --wait --timeout 60000`로 작업하고 결과를 회수한다. timeout/blocked/startup_error는 작업이 제출되지 않았다는 뜻이 아니므로 get/read로 확인하고 맹목적으로 재제출하지 않는다. hook으로 전달된 작업에서도 추가 Agent를 자동으로 더 만들지 않는다.

Lead가 작업 완료·검증을 확인하고 결과 요약을 파일로 보존한 후 정리한다.

```sh
python3 tools/intelligent-router/adapters/agents.py finish <반환된-id> --result-file <회수한-결과요약-파일>
python3 tools/intelligent-router/adapters/agents.py list
```

finish는 기록된 pane의 terminal ID·Agent 이름·repo cwd를 다시 대조하고 idle/done일 때만 pane close를 실행한다. 결과 파일이 없거나 working/blocked/unknown/다른 Agent로 교체된 경우 거부한다. 사용 완료는 Lead가 검증하며 단순 idle만으로 성공으로 간주하지 않는다. 결과 파일·worktree·브랜치는 제거하지 않는다. 오류 pane은 조사용으로 보존한다. 생성 실패가 남긴 registry는 자동 삭제하지 않으므로 목록에서 회수 대상을 확인한다.

## `/new`와 인계

`/new`는 같은 CLI에서 새 채팅을 시작하고 이전 채팅 문맥은 이어받지 않는다. `/compact`는 현재 대화를 요약해 유지한다. 횟수/시간 기준의 무조건 reset은 중복 탐색과 품질 저하를 일으킬 수 있다. [공식 slash command 문서](https://learn.chatgpt.com/docs/cli/slash-commands)를 따른다.

인계는 `.state/handoffs/<작업명>.md`에 1~2KB 이내로 저장한다: 완료 목표, 변경 파일·함수, 검증 명령·결과, 남은 문제, 다음 행동. 비밀·전체 로그·전체 대화는 제외한다. 미회수 Agent·진행 중 테스트·승인 대기가 없을 때만 새 작업으로 넘어간다. 새 채팅의 첫 요청에서 해당 인계 파일 경로를 전달한다. `/new` 자체가 토큰 사용량이나 구독 한도를 초기화하지 않는다. 현재 도구가 자동으로 `/new`를 주입하지는 않으며 작업 담당자가 안전한 경계에서 수행한다.
