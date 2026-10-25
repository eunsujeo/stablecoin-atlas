# 기존 UI 단일 제공과 메뉴 정리

## 수행 경로·자료

이전 대화에서 `/atlas.html#compare`를 열어 기존 UI와 다른 디자인이 표시됐다. 사용자가 혼동을 피하도록 기존 UI만 남기고 Atlas를 제거하라고 요청했다. 이어 검증 근거의 UNKNOWN을 지적한 뒤 검증 근거 페이지와 자산 비교 페이지도 제거하도록 지시했다.

Atlas HTML·CSS·JS·근거 연결·전용 대시보드와 전용 시험을 제거하고 고정 제공 목록·query 허용 경로·Atlas 링크를 정리했다. 후속 지시에 따라 검증 근거/자산 비교 메뉴·페이지·비교 전용 모듈/스타일/시험과 브라우저 검사 도구도 제거했다. 근거 JS는 보고서 목록·공통 화면 이동·저장 목록 읽기로 정리했다. 전체 현황의 삭제 페이지 링크와 판정/랭킹 클릭 이동은 제거했으며 저장 보고서 링크는 보고서 페이지를 사용한다.

## 수행 중 조정·실패 구분

초기에는 과거 읽기 지원 값 UNKNOWN과 소스 확인 상태를 구분하여 소스 결과를 기본 표시하고 과거 실행을 접는 방안을 구현·브라우저 검증했다. 이후 사용자의 페이지 제거 지시로 이 중간 구현을 최종 코드에서 제거했다. UNKNOWN을 확인 완료로 바꾸거나 원본을 삭제하지 않았다. 삭제된 기능의 시험·브라우저 검사도 제거/갱신했다. 이전 단계 검사 결과는 최종 범위의 검사와 구분한다.

변경 전4399 프로세스가 예전 제공 목록을 유지하므로 해당 로컬 JSON 서버만 정상 종료 후 같은 포트·모드로 재시작했다. 최초 Atlas 제거 단계의 전체 검사는 rc0 tests585/pass585/fail0/cancelled0/skipped0이었고 비교/프로필 브라우저 검사도 rc0이었다. 최종 범위 검증은 아래에 별도 기록한다.

## 최종 검증·재현

`node --test web/preview.test.mjs` rc0: 기본/legacy 동일 응답·삭제 자산 GET/HEAD404·메뉴/페이지 부재·로컬 경계를 확인했다. `node tools/source-review-browser-check.mjs http://127.0.0.1:4399`는 기본/legacy26프로필·검색·탭·필터·기존 상태·전체 현황을 회귀 검사하고 삭제 hash의 전체 현황 진입과 오래된 클릭 경로 부재를 확인한다. `npm run check` rc0 tests584/pass584/fail0/cancelled0/skipped0. `git diff --check` rc0.

JSON 재현은 `npm run ui -- --port 4399`, 기존 DB 읽기 재현은 `npm run ui -- --port 4399 --database --database-env .state/market-db-secrets/reader.env` 후 `/legacy.html#assets`에 접근한다. reader 파일은 비공개 로컬 전제이며 Git에 포함하지 않는다. `/atlas.html`은404이며 `#validation`·`#compare`는 전체 현황으로 연결된다. `npm run check`와 위 브라우저 명령으로 재현한다. 최종 로그는 `.state/agent-logs/legacy-only-check-complete.log`, `.state/agent-logs/legacy-only-source-final.log`, `.state/agent-logs/legacy-preview.log`다.

## DB·미확인과 경계

사용자 DB 상태 질문에 현재4399의 `--database` 부재와 저장 시장 JSON 응답을 확인했다. 당시 local JSON 모드였으며 DB 장애로 판정하지 않았다. 이후 사용자가 DB 연결을 요청하여 기존 비공개 reader 환경파일을 명시한 PostgreSQL 읽기 전용 모드로4399를 재시작했다. `/market-data.json` 정상 응답에서 `readState.source=POSTGRESQL`과 관측2162건·DB 오류 없음으로 실제 읽기를 확인했다. 데이터 수집·DB 변경·공급자/API/RPC 호출은 하지 않았다. 기존 reader 설정은 실행에만 사용하고 값을 로그/문서에 출력하지 않았다. 자산 프로필과 전체 현황의 소스 결과, 저장 보고서·원본·UNKNOWN/NOT_TESTED·판정은 보존했다. 과거 기록은 삭제하지 않고 현재 범위를 ADR0104와 개발 상태에 표시했다. 원문·키·endpoint는 게시하지 않는다.

## 검사 도구 경합과 수정

DB 모드 브라우저 검사에서 CDP `Invalid InterceptionId`가 한 번 기록됐다. 제품 JS 예외가 아니라 페이지 전환과 비동기 Fetch 처리의 경합 가능성을 확인했다. Lead f17056d65153432fb7826590f54ab5f0의 proceed 조건에 따라 Fetch promise를 추적하고 모든 페이지 이동·종료·최종 오류 확인 전에 최대15초 안에 처리 완료를 기다리도록 공통화했다. 오류를 무시하지 않으며 처리 실패·timeout·Runtime 예외·외부 요청·근거503 검사를 유지한다. 실제 원인 여부는 같은 DB 모드 재검사 결과로 확인한다.

후속 페이지 삭제 요청 중 이미 시작했던 이전 범위 검사는 삭제된 comparison 시험 경로를 참조해 rc1(tests585/pass584/fail1)로 끝났다. 이는 당시 실행 목록과 파일 삭제 시점이 겹친 결과이며 `.state/agent-logs/legacy-only-check-final.log`에 보존했다. 최종 범위의 새 전체 실행은 별도 `legacy-only-check-complete.log`에서 rc0/584통과했다. 검사 도구 실패를 사이트 자료 부재나 DB 실패로 해석하지 않았다.

수정 후 같은 PostgreSQL 읽기 전용4399에서 브라우저 재검사 rc0: 기본/legacy26프로필·검색/탭/필터·기존 판정·삭제 hash fallback·근거503·다크/라이트·390px·JS오류0/외부 요청0을 확인했다. 최종 브라우저 로그는 `.state/agent-logs/legacy-only-source-db.log`다.
