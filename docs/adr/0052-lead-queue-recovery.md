# ADR0052: Lead 전달 장애 진단과 명시적 대기열 복구

2026-10-22 · 사용자가 router-lead 미호출 버그 수정을 우선 요청했다.

실제 Lead pane은 idle이었지만 오래된 delivery_uncertain 요청 하나가 후속 pending 네 건을 막고 있었다. 기존 코드는 새 대화 준비 실패도 전달 불명으로 기록하고 오류 원인을 버렸다. 최초 장애의 원인은 남은 기록만으로 확정하지 않는다.

dispatch.lock 아래 준비·prompt 단계를 전송 전에 각각 기록한다. 준비 실패는 preparation_failed, prompt 호출 실패는 delivery_uncertain으로 보존한다. 실패 단계·시각·예외 종류와 제한된 Herdr 오류 코드/종료 코드만 저장한다. stderr·화면·환경값·전체 명령을 로그에 복사하지 않는다. watcher 예외도 로컬 watcher-status.json에 같은 방식으로 기록한다. 불명/준비 실패 차단에서는 watcher가 종료되며 자동 재전송하지 않는다. 실제 작업 진행 중의 응답 대기는 기존 한 시간 제한을 유지한다.

cancel은 운영자가 실제 pane을 먼저 확인한 뒤 완료되어 불필요하거나 다른 작업으로 대체한 요청을 종료하는 명령이다. 동일 dispatch.lock과 Lead identity/cwd·idle/done 확인을 사용하고 이전 상태·사유·시각·pane/상태 번호를 남긴다. 검토 응답은 생성하지 않으며 취소된 요청의 늦은 응답/재취소는 거절한다. idle만으로 미전달을 추론하지 않는다. 취소 잠금 해제 후 watcher를 재시작하여 기존 pending 전달을 자동 재개한다. 기존 watcher가 남아 있을 수 있으므로 여러 건 정리 시 pending을 먼저, 차단 요청을 마지막으로 취소한다.

프로세스 중단으로 dispatching이 남은 경우도 자동 재전송하지 않고 같은 명시적 복구를 사용한다. preparation_failed는 구현 세션 자동 갱신과 Lead 수동 갱신의 열린 요청 검사에도 포함한다. 모델·인증·제품 수집기는 변경하지 않는다.

검증은 준비/전달 실패 분리, 중복 전송 방지, dispatch lock 경합, 취소 후 다음 요청 전달, 늦은 응답 차단, working/blocked/unknown 취소 거절, 진단 비밀 비노출과 실제 기존 Lead의 요청/응답 확인이다.
