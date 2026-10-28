# 인계: 전체 자산·네트워크 활동 수집 준비 / Allium 수집 종료

후속: 준비한4GET은 추가 승인 후 완료·소비했다. [실제 결과와 다음13후보](2026-10-28-arkham-usage-discovery-result.md)를 따른다. 아래 내용은 당시 준비 기록이다.

사용자 요청: “모든 자산 네트워크는 수집해줘. allium 수집은 제거하자.” 완료 후 commit/push 승인 유지. 하위 에이전트 사용 금지. 운영 Mac mini 직접 배포 금지.

## 현재 완료

Allium 실행 npm 별명/CLI 실행 경로/공통 환경의 ALLIUM_API_KEY 전달을 제거했다. 실제 비밀 파일은 수정하지 않았다. 기본·bind·wrapper 포함 일반 프로세스의 수집 모듈 호출은 ALLIUM_COLLECTION_RETIRED로 실패하며, 이전 송신 회귀7파일만 Node permission의 net 권한 없는 자식에서 실행한다. NODE_OPTIONS를 같은 제한으로 상속한다. 전체 파일/자식 권한을 허용한 신뢰한 회귀이며 악성 코드 sandbox를 주장하지 않는다. 과거 DB/원문/소비/파서·저장본 읽기와 Arkham 공통 IO/lock은 보존했다.

등록 범위는 5자산/33 coverage쌍(USDT10·USDC11·RLUSD7·JPYC4·JPYSC1)이다. 기존5쌍/35관측은 변경/재수집하지 않았고 나머지28은 미수집이다. data/network-usage-expansion-scope.json과 tools/network-usage-inventory.mjs가 재현 경로다. 등록33을 실제33배포나 공급자지원으로 표현하지 않는다. 이번 UI/DB 형식/Collector/FX 변경0, 신규 공급자 호출0, 운영 배포0이다.

## 다음 실행 — 아직 승인 대기

data/arkham-network-usage-discovery-20261028-plan.json: 기존 ARKM_API_KEY로 api.arkm.com의 GET /chains, /token/addresses/usd-coin, /token/addresses/tether, /token/addresses/ripple-usd 각1회. 최대4GET/0run/응답별2MiB/총8MiB/120초/요청20초/간격1초·재시도/redirect/추가페이지/전환0·비용UNKNOWN. 새슬롯 arkham-network-usage-discovery-20261028-v1, 기존root/공통lock. 첫 실패/한도/해석실패 종료와 원문/소비 보존. 사용자 승인 전 실행하지 않는다. 현재 문서/JSON 계획만 준비했으며 새 collector 실행은 아직 없다.

결과 검토 후 chain alias+정확한 token별 histogram 목록을 고정해 별도 승인을 받는다. arbitrum_one과 등록 arbitrum을 구분하며 hyperevm을 hyperliquid-l1로 추측하지 않는다. issuer/currency를 scalar주소로 만들지 않는다. JPYC/JPYSC 가격ID를 추측하지 않는다. 고정 기존 기간2026-10-21~27과 이전5쌍은 재사용하되 미수집을0으로 만들지 않는다. DB v2는 기존v1/35행/pin을 보존하는 별도 사설PG 검증 후 실제 변경 승인을 받는다. 새 승인 없는 자동 histogram/DB/Collector 확대를 하지 않는다.

## 기록과 검증

상세 경로/실패/수정은 docs/research/2026-10-28-all-asset-usage-expansion.md와 ADR0118에 기록했다. 최초 check 718pass/0fail(일반644 + net차단74), CLI 정리 후 차단4테스트 통과. 최종 check는 일반645+net차단74 = 총719pass/0fail로 성공했다. 로그 .state/coverage-expansion-20261028 비공개. 부분 명령의 tsx 누락과 port1 bad-port 실패를 수정했고 외부 송신은 없었다. Lead a15c453e797241ed9b15391f043c383c는 수정 요구, e81e96eaec0948ae9bb51ba413401cc8는 보완 후 proceed이며 새 API/DB 승인이 아니다.

기존 docs/handoff/2026-10-22-router-lead-review.md는 사용자/별도 작업의 untracked 파일로 건드리지 않는다. 기존 Arkham2GET/최초실제5GET 소비는 완료 상태이고 재사용하지 않는다. 기존 로컬 reader UI 서버/PID와 실제 과거 DB/화면 검증은 2026-10-28-network-usage-live 인계문을 따른다. 이번 작업에서 서버 재시작/외부 DB 조회를 하지 않았다.
