# 다른 PC의 Herdr·Router 개발 환경

현재 역할 구성과 프로젝트 hook을 새 PC에서 재현하는 절차다. Git clone만으로 Herdr 세션·Agent·인증·로컬 모델이 복원되지는 않는다. 현재 PC의 전역 Herdr config에는 onboarding 항목만 있었고, 복제할 사용자 키바인딩 설정은 없다. 세션 ID나 pane ID를 복사하지 않고 새 PC의 실제 목록으로 연결한다.

## 공유 범위와 준비

| Git으로 공유 | PC마다 별도 준비 |
|---|---|
| `.codex/hooks.json`, 루트/Router AGENTS.md | Herdr, Codex CLI와 해당 PC의 로그인 |
| `tools/intelligent-router/config/policy.json` | 검토된 로컬 d3-lite 패키지와 Python venv |
| adapters와 평가/회귀 검사 | ignored `config/runtime.local.json`의 실제 경로 |
| 이 문서와 Lead bridge 절차 | Herdr의 살아 있는 세션·pane·고유 이름 |

현재 확인한 Herdr client/server는 0.9.0/protocol22, Codex integration v8이다. 다른 버전은 `herdr --help`, `herdr status`, `herdr agent`, `herdr integration`의 실제 문법/호환 상태를 먼저 확인한다. Herdr는 [공식 설치 안내](https://herdr.dev/docs/quick-start/)에 따라 해당 PC에서 설치한다. 이 저장소의 setup은 설치·업데이트·서버 재시작을 실행하지 않는다. Codex/선택적 Claude 인증은 각 PC에서 직접 준비하며 전역 인증/모델 설정을 복사하지 않는다.

```sh
git pull --ff-only
npm ci
python3 tools/intelligent-router/adapters/setup.py check
```

이 check는 PATH·로컬 runtime의 Python/manifest·hook 파일 유무만 검사한다. Herdr 세션 조회, 추론, 다운로드, Agent 생성은 하지 않는다. `CONFIGURED`는 전체 가중치 검증/추론 성공이나 hook 신뢰 완료를 뜻하지 않는다. 키/환경파일/모델 경로는 출력하지 않는다. 로컬 모델이 없어도 제품 개발과 웹은 실행할 수 있고 Router는 보수적 fallback을 사용한다.

## 로컬 Decision Model 연결

기존 검토된 d3-lite 패키지는 코드와 가중치 전체를 비공개 경로로 별도 전달하거나 [고정 revision 재현 절차](ROUTER_EVALUATION.md#재현)로 준비한다. Python venv 자체는 다른 PC로 복사하지 않고 해당 PC에서 재생성한다. Python3.13과 `decision/requirements-poc.lock`은 현재 macOS/Apple Silicon 검증 기준이다. 다른 OS/CPU에서 동일한 설치/지연을 보장하지 않는다. 이 절차는 새 API 키나 공급자 조회를 요구하지 않는다.

예를 들어 `uv`와 검토된 모델을 이미 준비한 PC에서 다음처럼 해당 checkout 안의 로컬 venv를 사용한다. 패키지 캐시가 없으면 pip 단계는 네트워크 다운로드를 하므로 해당 PC의 승인/프록시 정책에 따른다. 자동 실행하지 않는다.

```sh
uv venv --python 3.13 .state/router-runtime/venv
uv pip install --python .state/router-runtime/venv/bin/python -r tools/intelligent-router/decision/requirements-poc.lock
python3 tools/intelligent-router/adapters/setup.py runtime --python "$PWD/.state/router-runtime/venv/bin/python" --model-dir /absolute/path/to/reviewed-d3-lite --device mps
python3 tools/intelligent-router/adapters/setup.py check
```

Apple Silicon MPS 이외에는 `--device cpu`를 명시한다. CPU의 hook 25초 제한 내 완료 여부는 새 PC에서 확인해야 하며 timeout은 conservative fallback으로 처리된다. setup은 policy에 pin된 manifest SHA-256을 검사한 뒤 Git 제외 `tools/intelligent-router/config/runtime.local.json`을0600으로 새로 만든다. 같은 값 재실행은 보존하고 다른 설정이 이미 있으면 거절한다. 기존 runtime을 바꾸려면 내용을 로컬에서 검토·백업한 뒤 명시적으로 옮기고 다시 실행한다. symlink runtime은 거절한다. 추론 전에 기존 poc.py와 모델 loader가 실행 소스/전체 가중치 해시를 추가 검증한다.

## Herdr pane과 Agent 역할

새 PC 터미널에서 Herdr를 열고 프로젝트 checkout으로 이동한다. 설치 CLI가 지원하는 세션 실행 명령은 `herdr --session stablecoin-atlas`다. 이미 작업하는 세션이 있으면 그 세션을 유지한다. **아래 pane/agent 명령은 Herdr 내부에서만** 실행한다.

```sh
test "${HERDR_ENV:-}" = 1
herdr status
herdr integration status
```

첫 check가 실패하면 제어 명령을 중단하고 Herdr 내부 터미널에서 다시 시작한다. Codex integration이 없을 때만 `herdr integration install codex`를 직접 실행한다. 이는 해당 PC의 사용자 integration hook을 설치하는 별도 단계다. 현재 working Agent를 종료/재설치하거나 서버를 중지하지 않는다.

| 고유 이름 | 실행 도구 | 역할 |
|---|---|---|
| `router-impl` | Codex | 사용자의 구현 작업·테스트·commit/push |
| `router-lead` | Codex | 확인된 복잡성/위험/이전 실패에 대한 요청 파일 검토·응답 |
| `router-coord` | Claude, 선택 | 현재 PC의 별도 조율 pane. hook/Lead bridge 필수 요소는 아님 |

기존 `router-impl`/`router-lead`가 있는지 먼저 확인한다. 이름이 다른 프로젝트에 이미 쓰이면 그 Agent를 재명명하거나 종료하지 말고 다른 로컬 세션을 사용한다. Lead bridge는 정확히 `router-lead`라는 이름을 찾는다.

```sh
herdr agent list
herdr pane current --current
herdr pane list
```

`--current`가 오래된 context로 실패하면 목록에서 현재 checkout/caller pane을 직접 확인한다. 예전 PC의 `w9:p1` 등 ID를 재사용하지 않는다. 빈 shell pane에서 `codex`를 시작한 뒤 그 Agent의 실제 pane ID를 확인하고 아래처럼 이름만 지정한다.

```sh
herdr agent rename <확인한-구현-pane-ID> router-impl
herdr pane layout --pane <확인한-구현-pane-ID>
herdr pane split --pane <확인한-구현-pane-ID> --direction right --cwd "$PWD" --no-focus
```

폭이 좁으면 right 대신 down을 사용한다. 반환 JSON의 `.result.pane.pane_id`가 새 Lead pane이다. 그 빈 shell pane에서만 다음을 실행한다.

```sh
herdr agent start router-lead --kind codex --pane <반환된-새-pane-ID>
herdr agent get router-lead
```

전역 model/effort/인증을 프로젝트에서 변경하지 않는다. 두 Agent는 사용자가 해당 PC에서 설정한 값을 따른다. `router-coord`까지 재현하려면 별도 빈 pane과 Claude 설치/개인 인증·integration을 준비한 뒤 `herdr agent start router-coord --kind claude --pane <새-pane-ID>`로 명시 실행한다. 자동 분류나 이 setup 도구가 추가 Agent를 생성하지는 않는다. 기존 pane을 재사용·종료하거나 공유 checkout에서 동시에 코딩하지 않는다. Lead는 검토와 `.state/lead` 응답만 담당한다.

새 Lead 대화의 첫 요청:

> 루트 AGENTS.md와 tools/intelligent-router/AGENTS.md, docs/ai/LEAD_BRIDGE.md를 읽고 router-lead로 대기하세요. [ROUTER_LEAD_REQUEST id]는 새 개발 작업이 아니라 검토 알림입니다. lead.py result id로 요청과 관련 파일만 읽고 proceed/revise_plan/needs_user JSON을 로컬 파일로 작성한 뒤 lead.py respond id --response-file 경로로 반환하세요. 구현 Agent에 동기 prompt를 보내거나 요청을 재분류하지 마세요.

구현 pane에는 최신 [개발 상태](../DEVELOPMENT_STATUS.md)와 관련 인계문 경로를 전달한다. 진행 중 작업을 `/new`로 초기화하거나 대화를 통째로 복사하지 않는다.

## Hook과 연결 확인

구현 Codex에서 `/hooks`를 열어 저장소의 `UserPromptSubmit` 정의를 검토하고 신뢰한다. **이 승인과 로그인은 새 PC의 사용자가 직접 한다.** setup은 승인 UI를 대신 조작하지 않는다. 이미 실행 중인 세션에 정의가 없으면 완료/검증/인계를 저장한 안전한 경계에서 Codex를 다시 시작한다.

```sh
python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py'
python3 tools/intelligent-router/adapters/setup.py check
python3 tools/intelligent-router/adapters/lead.py list
```

일반 개발 요청 한 번에서 Local Router recommendation이 들어오는지 확인한다. hook이 실행됐다면 request.py를 또 호출하지 않는다. 새 PC의 `adapters/request.py` 수동 fallback은 hook 미실행일 때만 짧은 비밀 없는 요약을 stdin으로 전달한다. Lead 종단 확인이 필요하면 양쪽 Agent가 준비됐을 때 [검토 요청/응답 절차](LEAD_BRIDGE.md)를 한 번 사용하고 ID와 응답을 확인한다. 응답이 없다고 같은 요청을 반복 제출하지 않는다. 검토 호출은 GPT turn을 소비하며 setup/check 자체는 소비하지 않는다.

`.state/lead`·Agent registry·Herdr session DB·socket·pane ID·대화 기록은 복제하지 않는다. 이전 PC의 대기 요청은 그 PC에서 회수/정리한다. 다른 PC가 같은 공유 DB를 읽는 개발 모드는 [새 PC 웹 안내](../NEW_PC_SETUP.md#같은-supabase를-읽는-로컬-웹)를 따른다. 개발 PC에서 수집기나 운영 timer를 자동으로 켜지 않는다.
