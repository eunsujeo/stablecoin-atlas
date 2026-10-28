# 전체 등록 자산·네트워크 활동 수집 준비와 Allium 수집 종료

후속: 준비한4GET은 추가 승인 후 완료·소비했다. [실제 결과와 다음13후보](2026-10-28-arkham-usage-discovery-result.md)를 따른다. 아래 내용은 당시 준비 기록이다.

상태: 오프라인 변경. 새 공급자 호출 0, DB 변경 0. 기존 Arkham 5GET/35관측은 소비 완료이며 재실행하지 않는다.

사용자는 모든 자산 네트워크 수집 및 Allium 수집 제거를 요청했다. 범위는 등록 coverage 33쌍(USDT10, USDC11, RLUSD7, JPYC4, JPYSC1)이며 5자산×전체 체인의 곱이나 33개 배포/Arkham 지원 인증이 아니다. `data/network-usage-expansion-scope.json`에 전체 목록과 기존 5쌍/추가 미수집 28쌍을 고정했다. 원래 선정 기간 2026-10-21~27을 유지한다. 미수집에 시각·금액·건수·출처를 만들어 넣지 않는다.

## Allium 종료 구현

실행 npm 별명 allium:execute/live/geography를 제거하고 과거 CLI 실행/prepare 경로를 자격증명 읽기 전에 차단했다. 일반 프로세스에서는 직접 모듈 호출과 fetch wrapper 주입도 차단한다. 공통 workspace 환경은 파일/상속 ALLIUM_API_KEY를 전달하지 않는다. 실제 비밀 파일이나 공급자 계정의 키를 삭제/폐기하지 않는다. 과거 원문·소비 원장·DB·검증 파서·저장 자료 읽기/오프라인 계획은 보존한다. Arkham의 기존 공통 저장/잠금 모듈은 이름에 allium이 있더라도 유지한다.

보존한 송신 회귀 7개 파일만 `tools/test-suite.mjs`가 Node permission sandbox(네트워크 권한 없음)에서 실행한다. 함수 동일성 검사만으로 감싼 fetch를 막을 수 없다는 검토를 반영해, 네트워크 권한이 있는 프로세스는 가상 transport도 받지 않는다. 테스트 자식 프로세스에도 NODE_OPTIONS로 같은 제한을 상속한다. 파일/자식 프로세스 권한은 과거 crash/원장 테스트에 필요하다. 해당 sandbox는 신뢰한 저장소 테스트의 실수 송신을 막는 경계이며 임의 악성 코드 실행 sandbox를 주장하지 않는다. 관리형 proxy 환경은 변경하지 않는다.

## 새 실행 승인 전 고정 계획

`data/arkham-network-usage-discovery-20261028-plan.json`의 메타데이터 4GET만 다음 승인 대상이다. 기존 ARKM_API_KEY로 https://api.arkm.com 의 GET /chains, /token/addresses/usd-coin, /token/addresses/tether, /token/addresses/ripple-usd를 각 한 번 요청한다. 인자는 없다. 최대 4GET/0run/각2MiB/전체8MiB/전체120초/요청20초/간격1초, 재시도·redirect·추가페이지·endpoint 전환 0이다. 비용 UNKNOWN을 수용해야 한다. 새 전용 슬롯과 기존 공통 lock을 사용하고 송신 전 소비를 영속 기록한다. 첫 실패/한도 초과/해석 실패 시 종료하며 원본과 실패를 사설 보존한다. 결과를 공개/Git에 싣지 않는다.

고정 JSON 파일 SHA256: `175d14a1bc2c6324808d3b66116bc247bec6109f7d83ac469258329136c9a011`.

이번 준비는 실행 승인이 아니다. 과거 2GET/5GET과 기존 주소 표본 슬롯을 재소비하지 않는다. 기존 오프라인 USDC 주소 표본에서 Arkham의 arbitrum_one과 등록 arbitrum이 다름을 확인했다. hyperevm을 hyperliquid-l1로 추정 매핑하지 않으며 issuer/currency를 일반 token 주소로 바꾸지 않는다. 가격 ID와 배포 주소, 등록/저장 소스 검토와 현행 공급자 지원을 분리한다. JPYC/JPYSC의 토큰 ID는 추측하지 않는다.

4GET 결과 검토 후 정확한 체인·주소별 histogram 목록을 별도로 고정해 추가 승인을 받는다. 지원 미확인/주소 미확보는 NOT_TESTED/미수집 사유로 남기고 0이나 지원 불가로 단정하지 않는다. 전체 DEX 거래량·활성 지갑·결제량으로 확대하지 않는다. 새 DB 형식은 기존 35행 v1과 구조 pin을 보존하는 비파괴 준비/사설 PG 검증 후 실제 적용을 별도 승인받는다. 운영 Mac mini 배포·자동수집·Collector·FX 변경은 포함하지 않는다.

## 검증과 재현

검증 환경 Node v25.2.1. `node tools/network-usage-inventory.mjs`는 외부 호출 없이 등록 목록을 재현한다. `node --use-env-proxy --import tsx --test tests/allium-retirement.test.mjs`는 일반 실행의 모든 기존 송신 진입점 차단, bind/wrapper 거절, 네트워크 권한 없는 프로세스의 실제 socket 접근 거절, 33쌍/5기존/28미수집을 검증한다. 전체 검증은 `npm run check`다.

초기 부분 테스트는 --import tsx 누락으로 web/workspace.test.mjs의 TS import를 해석하지 못했다. 구현 실패와 구분하고 정식 명령으로 확인한다. socket 차단 테스트의 최초 port1은 브라우저 fetch의 bad port 규칙에 먼저 걸려, 허용 포트65534로 바꾸고 ERR_ACCESS_DENIED를 검증했다. 실제 외부 HTTP 시도는 없다. 세부 로그는 .state/coverage-expansion-20261028에 사설 보존한다.

최종 검증: `npm run check` 성공, 일반645pass/0fail + 네트워크 차단 사설74pass/0fail = 총719pass/0fail. 별도 신규 차단 회귀4건도 통과했고 `git diff --check` 오류0이다. 실제 신규 공급자 HTTP0/DB 변경0이며 기존 Arkham 소비/원본/35관측은 그대로다. Lead의 최초 수정 요구(a15c453e797241ed9b15391f043c383c)를 반영했고 후속 e81e96eaec0948ae9bb51ba413401cc8는 오프라인 준비 proceed를 반환했다. 해당 검토는 신규 API/DB 실행 승인이 아니다.
