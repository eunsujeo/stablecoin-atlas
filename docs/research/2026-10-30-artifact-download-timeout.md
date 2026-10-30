# Actions 아티팩트 본문 timeout 및 안전 진단

사용자는 운영 Mac mini의 bootstrap inspect에서 API/ZIP HTTP200 뒤 TimeoutError(code23)가 발생했다고 보고했다. 이 보고와 로컬 재현을 구분한다. 운영 서버 접속/변경이나 실제 GitHub/공급자 요청은 수행하지 않았다. 기존 새 PC 준비 문서와 비공개 설정을 보존하고 하위 에이전트는 사용하지 않았다.

기존 ZIP fetch의60000ms 제한을180000ms로 바꿨다. 같은 signal이 요청 시작부터 헤더 수신과 본문 EOF까지 적용되며 GitHub JSON/redirect 요청의20000ms는 유지한다. boundedResponse는 진행 중 reader.read와 abort를 경합시켜 멈춘 본문도 즉시 취소한다. 청크/EOF 직후 signal을 다시 검사하고 reader lock/listener를 정리한다. underlying cancel이 해결되지 않아도 원래 timeout/abort로 종료하며 오류를 삼키거나 재시도하지 않는다.

기본 진단은 stderr의 JSON만 사용한다. ARTIFACT_DOWNLOAD 이벤트의 started/headers/body_complete/failed와 monotonic elapsedMs·수신bytes·HTTP status·시간/크기 상한, 실패 시 고정 TIMEOUT/ABORTED/HTTP_LIMIT/DOWNLOAD_FAILED만 남긴다. URL/서명·토큰/헤더·본문·원래 오류 문자열은 전송하지 않는다. headers200과 EOF완료, EOF완료와 이후 SHA256/ZIP/manifest 검증을 분리한다. 로그 callback 실패는 검증/실패 결과를 바꾸지 않는다.

SHA256,96MiB 압축 본문 상한·허용 HTTPS 호스트·credential 미전달/redirect:error·무재시도·run/SHA/platform/policy/불변 릴리스 검증은 보존했다. tests/deploy-automation.test.mjs에 지연EOF/180초 설정·API20초보존·stalled200 timeout/미해결cancel·중간/사전/EOF취소·정확96MiB/1byte초과(허위Content-Length)·수신량/원래오류보존·진단redaction/실패·기존hash검증 회귀를 추가했다. 단발 mock GET 외 외부조회0이다.

초기 targeted 검사 rc0/52pass/0fail/cancelled0/skipped0 후 EOF/API설정 검증을 추가했다. 최종 targeted rc0/52pass/0fail/0cancelled/0skip. 전체 npm run check rc0: 주739개731pass/0fail/8skip + 보존74개74pass/0fail/0skip, 합계805pass/0fail/8skip/cancelled0. skip8은 기존 누락 compiler cache 조건이며 새 skip/실패는 없다. git diff --check rc0. 비공개 로그는 .state/agent-logs/deploy-download-targeted.log와 deploy-download-check.log다. 재현은 source .state/dev-env.sh 후 node --use-env-proxy --test tests/deploy-automation.test.mjs 및 npm run check다. 운영에서 실제180초 다운로드 성공 여부는 NOT_TESTED다. commit/push 후에도 운영 bootstrap 갱신/inspect 실행을 대신 수행하지 않는다.
