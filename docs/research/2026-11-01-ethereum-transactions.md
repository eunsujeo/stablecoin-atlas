# 블록 생성 장면의 거래 학습

2026-11-01. 별도 로컬 프로토타입만 변경. 운영/DB/수집/API/배포 설정 변경 없음. 외부 공식 문서 읽기 외 실제 RPC·거래·서명 없음. 기존 미커밋 변경은 보존했다.

## 설계와 구현

기존 24초=프로토콜72초, 슬롯3200~3205/다음3206, 초기#700와 새#701~705, 누락3202, 부모 연결을 유지했다. `transactions.mjs`는 기존 slotState를 입력으로 고정 거래 이벤트를 파생한다. KPI를 늘리지 않고 기존 하단 주석 영역에 대기/구성 중/포함 집계와 시나리오 선택·풀 접기를 배치했다. 기존 SVG 아래쪽에 작은 거래 객체와 순차 이동 마커를 추가했다. 선택 상세는 기존 native dialog를 재사용한다.

- 0~2초: 사용자가 서명한 TX01~04의 전파와 A/B 노드의 서로 다른 도착 시점.
- 2초: #701 제안, 사용자 거래 없음. 거래가 대기해도 모두 반드시 포함하지 않는 예시.
- 4.3/4.6/4.9초: TX01 ETH, TX02 ERC-20, TX03 호출을 선택.
- 4.8/5.2/5.6초: 순서대로 후보 실행. Receipt 1/1/0. TX03 revert는 호출 상태 변경을 되돌리며 gas/nonce는 반영되는 후보 결과. Receipt는 거래 목록과 별도.
- 6초: #702에 TX01~03 포함. 전파6.5초, 다른 노드 재실행 확인7초. head 선택/최종 확정을 뜻하지 않음.
- TX04는 fee 조건 미충족으로 제외되지만 관찰 노드 A가 보관. 3202 누락 때도 소멸하지 않음.
- 다음 유효 슬롯은 부모#702의 gas 사용량이 목표보다 낮아 base fee가 내려간 가정. 같은 서명 TX04를12.5초 선택,13초 실행,14초 #703 포함. 누락 슬롯 자체가 base fee를 내린다는 설명이 아님.
- #704/#705도 사용자 거래 0개. 별도의 `empty` 시나리오는 전체 사용자 거래 목록이 빈 상태여도 동일 슬롯/블록/누락/부모 관계를 유지.

Pending/Not Included/Selected/Executed/Included를 구분하며 서명 전파 단계도 별도로 표시한다. Included는 누적 제안 블록 포함 기록이며 풀 안의 거래라는 뜻이 아니다. 풀 제목에 포함 후에도 결과를 추적한다고 명시한다. 상태는 시간·시나리오만으로 결정하고 모든 receipt/목록을 매번 새로 파생한다. 재생 속도와 무관하게 같은 시점은 동일 상태다.

## 기술 근거와 단순화

- [Ethereum Transactions](https://ethereum.org/developers/docs/transactions/): 서명, 전파와 거래 수명 주기.
- [Blocks](https://ethereum.org/developers/docs/blocks/): transactions 목록, parent_hash, state_root, receipts_root를 구분.
- [Block proposal](https://ethereum.org/developers/docs/consensus-mechanisms/pos/block-proposal/): 제안자 로컬 구성과 외부 builder 참여는 기술 상세에서 구분.
- [Receipt API 설명](https://ethereum.org/developers/docs/apis/json-rpc/#eth_gettransactionreceipt): status1/0의 실행 결과. 문서만 읽었으며 API 실행 없음.
- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559): 부모 gas 사용량에 따른 base fee와 max_fee_per_gas 조건. 선택은 nonce·서명·잔액·gas 한도 등을 충족한다는 전제이며 단순 수수료 정렬이 아니다.

실제 EVM, 잔액/서명 검증, 전체 txpool 정책, builder/MEV, 포크 선택을 실행하지 않는다. 실패한 Receipt도 유효 블록에 포함될 수 있으며 블록 유효성 실패와 다르다. 후보 실행의 상태/비용은 확정된 지갑 잔액으로 표시하지 않는다. txpool 관측과 보관은 노드별이다. 이 장면의 검증 확인은 교육용 가정이며 실제 안전성 판정이 아니다.

## 시각 개선 과정

기준 파일은 `.state/knowledge-tx-before/`, 스크린샷은 `transactions/*before*.png`, 이전 비교 페이지는 `storyboard-slots.html`에 보존했다. 첫 렌더링에서 거래 글자가 작아 글자와 작은 객체 높이를 키웠다. 기존 SVG 높이350과 desktop 전체 높이를 유지하면서 블록 결과 영역을 소폭 위로 배치했다. 거래 마커는 한 번에 하나만 이동하고 현재 거래만 강조한다. 모바일은 거래 객체를 세로로 배치한다. 불필요한 라이브러리/아이콘을 추가하지 않았다.

## 재현과 검증

```sh
source .state/dev-env.sh
node experiments/blockchain-knowledge/server.mjs
node --test tests/ethereum-learning*.test.mjs
node experiments/blockchain-knowledge/transaction-browser-check.mjs
node experiments/blockchain-knowledge/beginner-browser-check.mjs
node experiments/blockchain-knowledge/browser-check.mjs
npm run check
```

미리보기 http://127.0.0.1:54874/ · 비교 `docs/design/ethereum-learning/storyboard.html`.

모델33 PASS(기존27+거래6). 서로 다른 노드 도착, 선택/실행/실패 Receipt/포함 시점, 누락 보관/재선택, 빈 목록, 전파/재검증/미확정, 역방향과 객체 격리를 검사했다. 거래 전용 실제 Chrome 브라우저 PASS: 1440×900/1280×800 화면 높이·SVG 잘림,390×844/360×800 모바일, 두 시나리오 각24초 재생, 중간 이동 상태까지 정확한 SVG rewind, KPI/거래 수/목록/선택 창, 키보드, 접기와 tab 대상 제거, 배속/정지/이전다음/reduced-motion. JS 오류0, 외부 요청0. 프레임 간격 정상1441프레임/중앙16.7ms/p9516.7ms, 빈목록1431/16.7/16.7ms,25ms초과0. 이 장비의 headless 측정이며 사용자 이해도 실측이나 모든 장비 성능 보장이 아니다.

기존 Slot 핵심 상태(거래 파생 필드 제외)와 Fork 상태를0~24초0.1초 간격241개로 작업 전과 대조하여 동일. protocol/engine/playback 파일 바이트 동일. 1280 실행/포함 순간,360 누락 시점의 실제 캡처를 직접 검토했다.

추가 출처: [Geth txpool](https://geth.ethereum.org/docs/interacting-with-geth/rpc/ns-txpool)의 해당 노드 pool 내용, pending/queued 및 같은 nonce의 후보들을 확인했다. 이 교육 UI의 Pending은 일반적인 대기 의미이며 Geth pending/queued 분류를 구현한 API가 아니다.

최종 검증: `npm run check` exit0, 본 검사841 PASS/기존8 SKIP + 보존 검사74 PASS = **915 PASS, 0 FAIL, 8 SKIP**. 마지막 상태 변경/호출 되돌림 문구와 모형 소유 이동 시각을 반영한 거래 브라우저 재검사 PASS (`knowledge-tx-browser-final.log`). 거래 객체 내부 글자 폭까지 검사했고 최종 실행/빈목록 캡처를 직접 검토했다. `git diff --check` 및 비교 페이지 링크 PASS. 기존 제품/배포 추적 파일 변경0. 로컬 미리보기와 비교 페이지를 브라우저에 열었다.
