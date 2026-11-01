# Ethereum Slot & Block 학습 개선

2026-11-01 · 로컬 교육 프로토타입만 변경. 운영 배포·SSH·DB·공급자 API 접근 없음.

## 원인과 변경

기존 생성 장면은 시간 막대와 생성/빈 슬롯을 하나의 카드 열로 표현했다. 현재 슬롯에 블록이 없어도 KPI가 직전 head 번호를 함께 보여 주어 슬롯과 블록의 관계를 혼동할 수 있었다.

`lessons.mjs`의 생성 모형에 슬롯별 경과 시간과 `slotDetails`를 추가했다. 현재 KPI와 선택 창은 같은 파생 상태를 사용한다. `slot-renderer.mjs`는 위에 6개 시간 칸, 아래에 생성된 블록만 배치한다. 블록은 생성 시 슬롯 위치에서 체인으로 이동하고 부모 연결선이 그려진다. 모바일은 시간 칸을 세로로 배치하고 체인은 두 열로 연결한다. 기존 디자인 토큰을 재사용한다.

- 각 슬롯 12초. 기본 교육 재생 24초는 프로토콜 72초이며 0.5/1/2배속은 재생 시간에만 적용한다.
- 슬롯 3200~3205 / 이전 블록 #700(slot3199) / 새 블록 #701~705. 기존 교육 데이터 번호를 유지했다.
- 3202는 미응답 예시. 12초가 끝나기 전에는 Waiting, 종료 후 Missed. 빈 슬롯에 가짜 블록/번호를 만들지 않는다.
- 3203의 #703은 3201의 #702를 부모로 참조한다. 슬롯 누락과 Reorg, 생성과 최종 확정을 분리한다.
- 완료 시 3206/V07/0초가 시작되며, 앞의 6개 슬롯 결과와 함께 시간은 계속 진행된다는 설명을 표시한다.
- 슬롯 클릭: 상태·시간·제안자·블록 번호·부모를 같은 창에서 확인. 쉬운 용어 설명과 기존 접이식 기술 설명을 유지한다.

## 공식 근거와 단순화

[Blocks](https://ethereum.org/developers/docs/blocks/)의 slot/proposer_index/parent_root와 execution payload block_number를 구분했다. [Proof of stake](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)의 12초 슬롯·32슬롯 epoch 및 슬롯 누락을 기준으로 했다. 12×32=384초(6분24초).

이 장면은 실제 네트워크 기록이 아니다. 고정 제안자 순서와 슬롯 중간의 제안 시점은 교육용 연출이며 실제 제안 지연 분포를 의미하지 않는다. 미응답 외 모든 누락 원인을 재현하지 않는다. 블록의 유효성을 전제로 부모 관계를 보여 주며 실제 검증/서명/전체 클라이언트 실행이 아니다. 합의·확정과 Fork·Reorg의 로직은 이번 작업에서 변경하지 않았다.

## 실패와 수정

새 슬롯 전용 브라우저 테스트가 완료→되감기 시 숨겨진 미래 연결선의 d/stroke-dashoffset 잔류를 발견했다. 눈에 보이지 않아도 임의 탐색의 SVG가 완전히 재현되지 않았다. 미생성 블록의 연결선 속성을 매 프레임 초기화해 같은 시점의 정확한 SVG 일치를 회복했고 재검사 PASS했다.

Router 단발 요청은 요청 생성 전 agent identity/repository mismatch로 종료했다. 요청 ID·응답 없음, 재시도/하위 에이전트 없음.

## 재현

```sh
source .state/dev-env.sh
node experiments/blockchain-knowledge/server.mjs
# 별도 터미널
node --test tests/ethereum-learning*.test.mjs
node experiments/blockchain-knowledge/slot-browser-check.mjs
node experiments/blockchain-knowledge/beginner-browser-check.mjs
node experiments/blockchain-knowledge/browser-check.mjs
npm run check
```

http://127.0.0.1:54874/ · 비교: `docs/design/ethereum-learning/storyboard.html`.
작업 전 파일은 `.state/knowledge-slot-before/`, 전후 실제 캡처는 `docs/design/ethereum-learning/slots/`. 이전 storyboard는 `storyboard-beginner.html` 보존. 기존 미추적/수정 작업은 보존했고 commit/push 하지 않았다.

## 검증

- 모델 테스트 27 PASS. 새4건: 슬롯 경계/제안 후 시간 진행, 누락 확정 시점/부모, 선택 정보와 현재 KPI, 배속과 역방향 재구성.
- 슬롯 브라우저 PASS: 1440×900,1280×800,390×844,360×800. 시작/생성/미응답/누락/다음 슬롯/완료. KPI/설명/시간/블록 수/부모/선택 정보/0.5·1·2배속/역방향 SVG 일치. 데스크톱 세로 넘침과 SVG 잘림 없음, JS 오류0/외부 요청0.
- 세 모듈 브라우저 PASS: 실제 각24초 재생, 정지/재시작/이전다음/scrub, 세 모듈 상태 일치, 키보드/대화상자/초점 복귀, reduced-motion/no-JS 유지.
- 실제 headless Chrome 프레임 간격: 슬롯1505프레임·중앙16.7ms/p9516.7ms, 합의1505·16.7/16.8ms, Fork1506·16.7/16.8ms. 각25ms초과0. 다른 장비 성능 보장은 아니다.
- 기존 합의 전용 정상/오프라인 브라우저 회귀 PASS. protocol/engine/playback 파일은 작업 전과 바이트 동일, Fork 0~24초 0.1초 간격241개 snapshot 동일.
- 스크린샷 직접 검토: 1440 완료,1280 생성 중,360 누락/다음 슬롯, 작업 전 동일 장면. 사용자의 학습 효과를 실측한 사용자 조사 결과는 아니다.

최종 `npm run check` exit0: 본 검사835 PASS/기존8 SKIP, 보존 검사74 PASS. 합계 **909 PASS, 0 FAIL, 8 SKIP**. 전체 빌드 성공. `git diff --check`, 비교 페이지 로컬 링크, JS 구문 검사 PASS. 로컬 미리보기와 비교 페이지를 브라우저에 열었다.
