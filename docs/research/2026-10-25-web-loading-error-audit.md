# 웹 로딩·오류 표시 점검

사용자가 승인한 나머지 웹 화면의 로딩·오류 점검이다. 공급자 수집·RPC·DB 쓰기 없이 로컬 JSON 서버와 Chrome의 응답 지연/실패 주입으로 확인했다. 전송량 정상 응답은 문자열 금액과 고정 날짜를 가진 가상 DTO이며 실제 수집 증거가 아니다.

## 확인한 문제와 수정

- Atlas 공급량 차트·관측 표·전송량·가격 표·자산 프로필·비교에 기존 `beginLoading`을 연결했다. 첫 조회에는 도형을 표시하고 완료/실패 시 `finally`에서 busy 상태를 해제한다. 정상 자료가 있는 재조회에서는 기존 표와 원래 날짜를 유지한다. 전송량 경로 비활성 응답을 이미 확인한 경우도 재조회 중 기존 안내를 유지한다.
- 로딩 CSS를 공통 파일로 옮겨 두 화면에서 사용한다. 실행 중인 4173 서버는 이전 정적 경로 목록을 갖고 있어 사용자가 로딩 문구만 있는 화면을 제보했다. 서버를 재시작하고 `/loading.css` HTTP200, 같은 포트 Chrome의 실제 도형·240px 차트 높이와 라이트 화면을 확인했다. HTML에 도형 노드가 있다는 검사와 화면에 보인다는 검사를 분리했다.
- 기존 검증 근거 첫 조회 실패를 자료 부재로 단정하던 문구를 조회 실패로 바꿨다. Atlas 가격·전송량도 실패/404 비활성·자료 없음/이전 정상본 유지를 구분한다. 원래 저장 자료·판정·관측 시각은 변경하지 않았다.

## 검증 과정

브라우저 harness 첫 실패는 hash만 바꾼 탐색을 새 문서 첫 조회로 간주한 문제였다. 각 경로를 about:blank 뒤 새 문서로 열도록 수정했다. 다음에는 로컬 전송량 경로의 실제404와 가상 정상 응답을 혼동하여 정상본 유지 검사가 실패했다. 정상 시나리오에는 명시 가상 DTO를 제공하고404는 별도로 검사했다. 실패 주입 직전 아직 pause되지 않은 요청이 정상 통과하던 경쟁도 확인하여 해당 단계의 응답 정책을 뒤늦은 요청에도 적용했다. 최종 결과만 성공으로 보고하며 앞선 harness 오류를 제품/자료 부재로 판정하지 않는다.

Lead `e3b94a6925f64f77a428d61a1454fdcc`는 revise_plan으로404/첫 실패/이전 정상본 구분과 전송량 본문 문구 수정을 요구했다. 해당 분기·문구를 보완하고 별도404·실패·복구 시나리오로 확인했다. 모델 변경이나 외부 실행 승인이 아니다.

## 재현과 결과

- `npm run ui -- --port 4174`: 비DB 로컬 JSON 임시 검증 서버.
- `node .state/ui-loading-audit-browser.mjs http://127.0.0.1:4174`: rc0/PASS. 기존6경로(live/validation/assets/compare/reports/market), Atlas5경로(supply/activity/prices/assets/compare)의 최초 지연·실패·복구·재조회 중 유지·재조회 실패 후 유지·390px·라이트·동작 감소 설정, 추가404/비활성·정상 전송량 값/날짜 보존을 확인했다. JS 오류0·외부 요청0. 로그 `.state/agent-logs/ui-loading-audit-browser.log`.
- `node .state/overview-initial-skeleton-browser.mjs http://127.0.0.1:4173`: rc0/PASS. 공통 CSS 적용 후 기본 전체 현황의 초기·상세 이력 대기·성공/실패/재조회 검증. `.state/agent-logs/overview-initial-skeleton-shared-css-browser.log`.
- `node .state/overview-shared-skeleton-light.mjs http://127.0.0.1:4173`: rc0/PASS, 라이트에서 도형 실제 높이240px. `.state/overview-shared-skeleton-light.png`는 로컬 화면 캡처다.
- `npm run check`: rc0, tests564/pass564/fail0/cancelled0/skipped0. `.state/agent-logs/ui-loading-audit-check.log`.
- `git diff --check`: rc0.

독립 임시 Chrome/profile은 종료·정리했다. 사용자용4173은 기존 reader 설정의 PostgreSQL 읽기 전용이며 설정 값·응답 원문은 기록하지 않는다. 브라우저 검증은 응답 지연·실패를 주입한 클라이언트 동작 증거이고 DB 가용성·공급자 정상 수집의 인증은 아니다.
