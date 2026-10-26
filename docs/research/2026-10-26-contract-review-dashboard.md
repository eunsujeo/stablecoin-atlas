# 기존 로컬 대시보드의 컨트랙트 분석 연결

## 결과와 범위

사용자의 “대시보드 안으로 연결” 지시에 따라 기존 화면의 `/#contracts`에 **컨트랙트 분석** 메뉴를 추가했다. 별도 보고서 HTML을 iframe으로 넣지 않고 기존 다크/라이트 테마·사이드바·모바일 탐색을 공유한다. [ADR0112](../adr/0112-contract-review-dashboard.md)의 경계를 따른다.

초기 목록은 Ethereum Multicall3 1건이다. [검토된 연구 기록](2026-10-26-contract-review-multicall3.md)의 수동 요약만 고정 모듈에 넣었다. 11개 검토 항목을 개요·검증 / 함수·흐름 / 위험·사용 조건 / 근거·한계 탭에서 읽는다. 원래 보고서의 내용을 읽기 쉬운 표·조건·설명으로 정리했으며 전체 상태 UNKNOWN, 정적 분석 REVIEW_REQUIRED, 사설 10항목 개별 PASS, 원본 compiler/Slither NOT_RUN 및 wrapped-total 공격 NOT_TESTED를 유지했다. 함수 16개·원본 줄 번호·연구 출처·hash·원래 실패 시각·분석 기준일을 표시한다. 분석 기준일은 일 단위이며 원래 정확한 분석 timestamp를 새로 추정하지 않는다.

기존 CLI/원본 결과와 자산 호환성 판정은 바꾸지 않았다. 웹은 snapshot·report 원문을 읽지 않고, 외부 RPC/GET·분석·거래를 실행하지 않는다. 새 CLI 출력의 자동 게시도 없다. 전용 메뉴/화면/script/style은 production HTML에서 표식 검사 후 제거하고 새 자산을 공개 허용목록에 넣지 않았다. 운영 서비스/DB/Collector/FX·배포 변경은 없다.

## 수행·실패·수정

기존 `npm run ui`와 별도 `review:contract:ui`의 분리, 기존 해시 탐색·테마 변수·production 허용목록을 확인했다. Local Router는 shadow이며 실행 모델 변경 없음. Lead `b05fbf1902b84d7aa2de95f8da69441c`의 proceed 조건(수동 발췌·출처/시각·UNKNOWN·원문 미포함·production 제거·GET/HEAD 경계)을 반영했다. 추가 agent 생성/구현 위임 없음.

첫 Chrome 검증에서 근거 탭에 `NOT_TESTED` 표기가 없어 assertion이 실패했다. 위험 탭에는 있었으나 미확인 요약에도 wrapped-total 공격 미실행을 명시하도록 보완했다. 원래 실패 로그 `contract-dashboard-browser.log`를 보존했다. 후속 검증은 통과했다. 스크린샷은 탭 전환에 따른 스크롤을 상단으로 돌린 후 다시 확보했다.

정적 HTML 응답 시험과 별개로 설치 Chrome에서 실제 렌더링·검색·탭/키보드·기존 메뉴 복귀·양 테마·1440/390px의 수평 overflow 없음을 검증했다. 기존 근거 API를 503으로 주입해도 컨트랙트 요약이 열렸다. JS 오류/외부 페이지 요청/비공개 보고서 요청은 모두 0이었다. 실제 실패 RPC를 재시도하지 않았다.

## 검증과 재현

- `node --use-env-proxy --import tsx --test tests/contract-review-dashboard.test.mjs`: rc0, tests2/pass2/fail0. 로컬 GET/HEAD·POST/Host 거절·원문 경로 404, production의 `/`·`/index.html`·query 변형에 표식/자료 없음, 새 JS/CSS/요약 GET/HEAD 404 및 reader 호출0.
- `node tools/contract-review-browser-check.mjs http://127.0.0.1:<port>`: rc0, 위 실제 Chrome 검증 통과. 최종 로그 `.state/agent-logs/contract-dashboard-browser-release.log`; 첫 성공 로그 `contract-dashboard-browser-final.log`도 보존.
- `npm run check`: rc0, tests638/pass638/fail0/cancelled0/skipped0. `.state/agent-logs/contract-dashboard-check.log`.
- `git diff --check`: rc0.

`npm run ui -- --port 0` 후 출력된 loopback 주소에 `/#contracts`를 붙여 연다. 기본 포트는4173이다. Chrome 검증은 기존 macOS Google Chrome을 사용하며 자동 설치하지 않는다. 캡처는 `.state/contract-dashboard-{dark,light}-{1440,390}.png`에 로컬로만 보존한다. 사용자용 실행법은 [사용 문서](../CONTRACT_REVIEW.md#multicall3-재현)에 있다.

새 보고서를 목록에 반영하려면 연구 결과를 검토해 `web/contract-review-data.js`에 공개 가능한 요약만 명시적으로 추가한다. 실제 runtime UNKNOWN 해소·새 compiler/Slither 취득·운영 배포는 이 작업의 완료조건이나 자동 다음 단계가 아니다.
