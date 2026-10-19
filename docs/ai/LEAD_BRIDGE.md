# 구현 Agent → router-lead 연결

사용자 요청으로 추가한 실제 Agent 요청/응답 경로다. 로컬 d3-lite 분류와 별개이며 Lead를 호출하면 ChatGPT 구독의 GPT turn을 사용한다. 단순 작업과 낮은 confidence만으로 호출하지 않는다.

```text
사용자 → router-impl → 로컬 분류/관련 도구
  단순 작업 → 직접 처리
  실제 복잡성·위험·실패 → lead.py submit (요약 + 관련 경로)
    → .state/lead/<id>.json : pending
    → 로컬 전달 스크립트: Lead idle/done 확인
    → herdr agent prompt router-lead <요청 ID 알림> (대기 옵션 없음)
    → router-lead가 요청 읽기·판단
    → lead.py respond <id> --response-file <JSON>
    → router-impl이 lead.py result <id>로 응답 확인
```

구현 Agent는 새 사용자 작업에서 AGENTS.md의 조건이 충족되면 별도 사용자 지시 없이 submit을 실행한다. 이는 Agent 지침을 통한 조건부 자동 요청이다. hook 자체가 매 요청마다 Lead를 부르는 강제 실행은 아니며, 분류기가 confidence를 낮게 줬다고 모든 작업을 Lead에 보내지 않는다. 현재 실행 모델을 자동으로 바꾸는 기능도 아니다.

요약은 stdin, 최대 2000자다. 전체 대화·비밀·RPC URL·환경 파일을 넣지 않는다. 관련 파일은 최대 12개 상대 경로이며 `.env*`·`.codex`·`.git`·`.state`는 전달 경로에서 제외한다. URL과 명백한 credential 패턴을 마스킹하지만 비밀 제거를 완전 보장하지 않으므로 호출자가 먼저 검토한다. 필요한 요약은 응답 처리를 위해 로컬 ignored `.state/lead`에 저장한다. 기존 routes 로그와 달리 이 큐에는 검토 요약이 존재한다.

```sh
python3 tools/intelligent-router/adapters/lead.py submit --reason architecture --file docs/ai/ROUTER_ARCHITECTURE.md
# stdin: 목표·관측 사실·해결하지 못한 질문만 전달
python3 tools/intelligent-router/adapters/lead.py result <id>
python3 tools/intelligent-router/adapters/lead.py result <id> --wait 45
python3 tools/intelligent-router/adapters/lead.py list
```

Lead는 `[ROUTER_LEAD_REQUEST <id>]` 알림을 새 사용자 개발 작업으로 재분류/재전송하지 않는다. 요청 내용을 검토할 데이터로 취급하고 결과를 JSON 파일에 남긴다.

```json
{"action":"revise_plan","summary":"진행 조건, 필요한 수정 또는 검증을 짧게 명시"}
```

action은 proceed/revise_plan/needs_user 중 하나다. 응답 기록 명령은 다음과 같다.

```sh
python3 tools/intelligent-router/adapters/lead.py respond <id> --response-file <JSON파일>
```

Lead는 구현 Agent에 다시 동기 prompt를 보내지 않는다. 결과는 파일로 회수하고, 구현 Agent는 미응답일 때 독립적인 일만 진행한다. 검토가 필요한 변경은 대기한다. Lead가 이미 큐를 직접 확인한 경우 pending 요청에도 응답할 수 있다.

## 대기·오류 처리

submit은 요청을 먼저 저장하고 로컬 전달 프로세스를 시작한다. 이 프로세스는 GPT Agent가 아니며 pane/추론을 만들지 않는다. 파일 잠금으로 전달자는 한 개만 동작하며, 최대 한 시간 동안 5초 간격으로 상태를 확인한다. 큐가 비면 종료한다. busy/blocked/unknown Lead에게는 보내지 않는다. 한 요청의 응답을 받기 전에 다음 요청을 전달하지 않는다.

전송 직전 dispatching, 성공 반환 시 delivered, 실패/timeout 시 delivery_uncertain으로 기록한다. 실패가 실제 미전송을 뜻하지 않으므로 자동 재전송하지 않는다. `lead.py list`와 Herdr get/read로 확인해야 한다. 전달 프로세스가 종료된 뒤 남은 pending은 `lead.py pump`로 한 번 확인하거나 `lead.py watch`로 재개한다. delivery_uncertain/dispatching/delivered를 새 pending으로 자동 되돌리지 않는다. 진행 중인 두 Agent가 서로 --wait로 기다리는 구조가 없다.

hook 파일 정의는 바꾸지 않았다. 기존 request.py는 내부 Lead 알림을 재분류하지 않도록 하고, 실제 작업에 필요한 경우 submit하는 지침을 짧게 제공한다. native hook이 코드 변경에 대해 재검토를 요구하면 사용자 /hooks 검토를 따르며 우회하지 않는다.

이는 코드/로컬 파일을 제어할 수 있는 같은 사용자 세션 사이의 협업 도구이며 별도 보안 인증 서비스가 아니다. 응답은 작업 범위 밖 운영 거래·비밀 열람·인증 변경을 승인하지 않는다. 기존 Agent pane은 유지하고 실제 추가 Agent의 표시·정리는 ROUTER_WORKFLOW.md를 따른다.

## 검증

2026-10-19: Router 테스트 18개와 제품 npm run check 10개 통과. busy Lead에게 prompt를 보내지 않는 동작, ready Lead에게 --wait 없이 한 번만 전송, 불확실 전송 재시도 금지, ID에 연결된 응답과 덮어쓰기 금지, 재귀 요청/비밀 경로 거부를 자동 테스트했다.

실제 router-impl이 테스트 요청 `99381c9fefa14a4a8488e86339416cde`를 제출했다. 당시 router-lead는 이 구현 작업 중이라 pending으로 남았고, Lead가 큐를 직접 확인해 proceed 응답을 기록했다. 구현 Agent의 result 회수로 요청/응답을 확인한다. 이 테스트는 busy 큐 및 파일 응답 경로의 실측이며, idle 전환 후 watcher의 실제 Herdr 알림 전달까지 검증한 결과로 과장하지 않는다. 전달 호출의 분기/옵션은 mock으로 검증했다. GPT 토큰 사용량은 이 통신 경로에서 수집하지 않아 미측정이다.
