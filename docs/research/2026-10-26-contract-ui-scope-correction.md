# 컨트랙트 최신 결과·로컬 검토 범위 표시 정정

사용자가 이전 이력 제거와 로컬에서 검토하는 범위를 재확인했고, 전체 현황에 함수 코드가 그대로 노출된 안내 문구도 제거하도록 요청했다. 같은 Multicall3를 두 카드로 표시하고 전체 UNKNOWN을 작업 완료 상태처럼 보이게 한 표시를 수정했다.

## 변경과 경계

`web/contract-review-view.js`의 표시 projection은 chainId+정규화 주소별 최신 한 건만 선택한다. 관측 시각 동률은 완료 시각과 ID로 결정하므로 입력 순서를 바꿔도 결과가 같다. 화면에는 이전 보고서 카드/이력 선택/과거 실패 문구를 표시하지 않는다. Supabase 불변 행·비공개 원본·실제 판정은 변경하지 않는다.

저장 소스 hash·함수 표·사설 시험 근거가 있는 현재 Multicall3에만 “저장 소스 검토 완료”를 표시한다. 함수/검토 항목/사설 시험 수는 해당 보고서의 근거에서 계산한다. 전체 UNKNOWN과 개별 equality PASS를 재판정하거나 모든 로컬 공격 검증이 완료됐다고 확장하지 않는다. 원본 compiler NOT_RUN·소스 진위 UNKNOWN·실제 Proxy/권한 NOT_TESTED는 근거·검토 범위에 보존하며, 범위 밖 항목을 추가 완료조건으로 요구하지 않는다. runtime이 없는 보고서는 코드 대조 미확인을 유지하고 사설 근거가 없는 보고서에는 시험 완료를 표시하지 않는다.

전체 현황의 `overview-source-note` 문구/요소를 제거했다. 원인은 template interpolation의 콤마 연산자가 마지막 값인 함수 객체를 반환해 소스 코드가 문자열로 노출된 오류였다. 같은 오류가 있던 정적 근거 문서 생성기도 날짜를 명시 출력하도록 고쳤고 재생성했다. 토큰/배포 수 역시 등록 자료에서 계산해 현재 5토큰/26배포와 맞췄다. sourceScopeSummary 함수 자체는 정상적인 범위 집계에 계속 사용한다.

Local Router 추천은 제공돼 재호출하지 않았다. 이전 표시 실패에 대한 Lead 검토 `9c5bab411b1848ed9ebfc9c10005d272`는 action proceed로 회수했다. 최신 선택의 결정성·현재 한계 보존·범위별 수치/판정·반전/동률/누락 근거·전체 검사를 반영했다. 하위 Agent/임시 pane은 만들지 않았다.

## 검증과 재현

- `node --test tests/contract-review-view.test.mjs tests/contract-review-dashboard.test.mjs web/source-review.test.mjs`: rc0, tests10/pass10/fail0. 최신 선택/입력 반전/동률/다른 체인/빈 목록/runtime·사설 근거 누락/원본 UNKNOWN 불변/실패 이력 문구 제외/API 및 production 제외/정적 문서 코드 노출 방지를 확인했다. 로그 `.state/agent-logs/contract-ui-scope-targeted.log`.
- `node .state/agent-logs/contract-review-browser-local.mjs`: rc0. 실제 Chrome에서 최신 카드1개·이력 카드/코드 문구 없음·로컬 소스 검토 배지·11항목/16함수·검색·탭/키보드·다크/라이트·1440/390px·API503 오류 화면을 확인했다. runtime error0/external request0/private report request0. 로그 `.state/agent-logs/contract-ui-scope-browser-local.log`.

새 compiler/공급자 API/체인 RPC·키·DB migration/import/delete·운영 웹 배포는 수행하지 않는다. 사용자 검토용 기존 로컬 UI는 같은 reader 인자로 갱신하며 현재 검토 범위만 표시한다. 최종 전체 검사와 서버 확인은 완료 후 인계문에 기록한다.

## 최종 결과

`npm run check > .state/agent-logs/contract-ui-scope-check.log 2>&1`는 rc0 tests657/pass657/fail0/cancelled0/skipped0이었다. `git diff --check`도 rc0이었다.

기존 소유 미리보기 PID5494의 정확한 명령/4173 listener를 확인한 뒤 SIGTERM으로 정상 종료하고, 같은 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env` 인자로 재시작했다. 새 Node listener PID25681/exec session43649를 사용자 검토용으로 유지한다. `.state/agent-logs/contract-ui-scope-preview.log`에 보존했다.

실제 DB reader를 사용하는 `http://127.0.0.1:4173/#contracts`에서도 `node tools/contract-review-browser-check.mjs http://127.0.0.1:4173` rc0으로 최신 카드1개·이력 없음·표시/상태/한계·코드 문구 없음·기존 메뉴/테마/모바일/오류 경로를 확인했다. 로그 `.state/agent-logs/contract-ui-scope-browser-db.log`. 브라우저 외부 요청0은 승인된 서버의 Supabase SQL 읽기와 구분한다. 기존 Supabase의 두 불변 행/저장 판정은 수정/삭제하지 않았으며 화면에서만 이전 이력을 제외했다.

[후속 인계문](../handoff/2026-10-26-contract-ui-scope-correction.md).
