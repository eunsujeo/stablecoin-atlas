# Ethereum 학습 프로토타입: 근거·스토리보드

기존 Atlas/운영과 분리된 로컬 교육용 프로토타입. 실제 체인 데이터/실제 검증 결과가 아니다. 이번 검토는 Ethereum 첫 프로토타입이며 XRPL/TRON/Solana는 사용자 품질 승인 후 별도 합의 모델로 구현한다.

## 근거 (2026-11-01 열람)

- [Ethereum PoS](https://ethereum.org/developers/docs/consensus-mechanisms/pos/): 12초 slot,32slot epoch,배정된 proposer,블록 재실행·서명 검증.
- [Attestations](https://ethereum.org/developers/docs/consensus-mechanisms/pos/attestations/): head와 source/target 체크포인트 투표. 각 validator는 epoch당 배정된 slot에 참여하며 모든 validator가 매 slot 투표하지 않는다.
- [Gasper](https://ethereum.org/developers/docs/consensus-mechanisms/pos/gasper/): LMD-GHOST의 head 선택과 Casper FFG finality 구별. 연속 justified checkpoints의 충분한 지분 지지가 이전 checkpoint를 finalized로 만든다. finality는 중대한 합의 실패까지 불가능하다는 절대 보장이 아니다.
- [공식 합의 명세](https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/beacon-chain.md#justification-and-finalization): 유효 지분3× ≥ 총활성지분2× 판정, 중복참여 비가산. 본 모델은 정상 연속 두 epoch 경로만 보여주며 모든 FFG 분기 구현이 아니다.
- [mainnet preset](https://github.com/ethereum/consensus-specs/blob/master/presets/mainnet/phase0.yaml), [mainnet config](https://github.com/ethereum/consensus-specs/blob/master/configs/mainnet.yaml): slot/epoch 상수. Phase0의 validator 최대 잔액값을 현재 validator의 동일32ETH 가정으로 사용하지 않는다.

## 모델/생략

총활성지분을 12개의 동일 가중치 교육용 단위로 정규화한다(ETH 금액 아님). 정상12/12,장애7/12; 장애5/12는 1/3 초과. 분모는 온라인 노드 수가 아니라 전체 활성 지분이다. 8개 peer는 네트워크 전달의 표본이며 지분분포/위원회 크기를 나타내지 않는다. 슬롯 장면은3개 attester 표본만,epoch 막대는 전체 지분 집계로 별도 표현한다. 제안자 선택은 지분가중 의사난수 배정의 고정 예시를 보여주며 RANDAO를 실제 실행하지 않는다.

C98 finalized/C99 justified를 시작 전제로 두고 slot3200의C100을 추적한다. E100→E101 경계에서 충분한 source/target 투표로C100 justified/C99 finalized, E101→E102에서C101 justified/C100 finalized가 된다. 투표가 모이는 중간 시각에는 경계 처리 전에 finalized로 승격하지 않는다. 서명/BLS·EVM·fork-choice·네트워크 지연은 개념 모형이며 실제 계산/검증이 아니다. MEV/PBS,분기,slashing,inactivity leak 장기 회복은 제외. 오프라인을 slashing으로 표시하지 않는다.

## 24초 스토리보드

| 재생 | 장면 | 시각적 설명 |
|---|---|---|
|0–3초|제안자 배정|8개 peer 중 이미 배정된 proposer 강조. 선택은 네트워크 투표가 아님|
|3–6초|블록 조립|거래 조각→execution payload→서명된 beacon block의 겹 구조|
|6–9초|전파|의미 있는 payload 봉투가 여러 peer 경로로 전달,수신 상태 구분|
|9–12초|검증·attestation|execution 재실행과 consensus 검사를 두 줄로 표현,선택된 표본의 head/source/target|
|12–16초|epoch100 집계|장면 시간축 확대,12지분 단위가 누적.2/3선과 분모 고정|
|16–18초|justification|C100을 justified로만 표시,C99확정.장애에서는 기준 미달|
|18–22초|epoch101 집계|새C101과 두 번째 source/target 투표.첫 투표를 재사용하지 않음|
|22–24초|finality|C100 finalized와C101 justified를 별도 상태로 표시.장애는미확정 유지|

슬롯 상세는 실제 약4초,이후12분48초까지 비선형 압축한다. 화면의 재생시간과 프로토콜 시간을 함께 표기한다.12초는 목표slot 길이이며 매slot 블록생성이 보장되지 않는다.

## 설계

Protocol Model → 고정 입력/가중치/체크포인트 규칙, Simulation Engine → 정렬 이벤트를시간t까지fold하는 순수함수, Renderer → 미리생성 SVG의transform/opacity 갱신, Controller → 유일한rAF시계/seek/play/pause/speed, Narrative → 단계/선택객체의설명. 같은(t,scenario,selection)입력은 같은상태다. 외부조회/랜덤/Date.now를모델에서사용하지않는다.

시각 방향: 차콜 실험대#141b1e,상아색본문#edf0e8,검증민트#9dd6bb,제안앰버#ecc48b,투표블루#a9c9ef. 시스템산세리프와 숫자용monospace. 중앙의 블록 단면과주변 peer 작업대,하단 checkpoint rail로 ‘데이터 생성→여러관점의 확인→확정’을읽는다. 무의미한 입자/네온/회전은없다. SVG는고정소수요소라별도GSAP/Pixi의존성이필요없다.

아키텍처 Lead 요청은 기존 router agent identity/repository 불일치로 요청 생성 전 실패했다. 응답/승인으로 취급하지 않으며 하위 agent를 만들거나 재전송하지 않았다. 사용자 승인된 단독 로컬 구현과 직접 시험으로 진행한다.

## 구현 검토 및 결과

최종 구현에서는 packet 도착과 received 이벤트를 같은 DELIVERIES 일정으로 결합했다. 모든 경로는 송신자 수신 이후에 relay하며, 화면 중앙 artifact가 네트워크 허브인 듯 보이지 않도록 peer 사이의 gossip 경로로 표현했다. 첫 슬롯 이후 C100의 상태는 accepted/justified/finalized로 구분하고 후속 블록이 있는 동안 C100을 계속 head로 표시하지 않는다. 생성 직후와 두 epoch 경계 직전/직후를 별도로 검증한다.

892 tests 통과/8 기존compiler skip. 추가 모형시험10개와 브라우저 실제24초재생/정역seek동일SVG/속도/키보드/선택/모바일/축소모션/noJS설명 모두통과. 현재Mac headlessChrome에서1563frame 중앙값16.7ms,p9516.8ms,25ms초과0,렌더함수p950.3ms를측정했다. GPU표시/다른기기의성능보장은아니다. 확인자료는 docs/design/ethereum-learning/verification.json 및 storyboard.html.

사용자가 직접 보는 시각적·교육적 품질 평가는 아직 남아 있다. 이후 체인별 모델 확장과 대시보드 통합은 이 검토 결과를 받은 뒤 진행한다. 이번 작업은 코드동작검사를 사용자 품질승인으로 대체하지 않는다.

## UX 후속 검토 (2026-11-01)

화면 탐색은 6개 단계로 정리하되 실제 이벤트 경계는 유지했다. `presentation.mjs`는 동일 `stateAt`의 조회 전용 투영이며 별도 통계 시계/가상 관측 수치를 추가하지 않는다. 선정·수신·검증·표본 attestation·epoch 지분·C100 상태를 같은 시점으로 표현한다.

장애 시나리오에서 next epoch의 source를 미정당화 C100으로 표기하던 문제를 수정했다. 마지막 정당화 체크포인트 C99를 유지하며 C99→C101 지지 7/12로 표시한다. 이 사례는 전체 지분 2/3 미달이므로 정당화/최종 확정을 진행하지 않는다. 정상 경로의 연속 체크포인트 모델, 16/22초 조건 처리, C99 초기 정당화 전제는 유지한다. Gasper 공식 문서를 다시 대조했으며 전체 비연속 FFG 분기 구현으로 범위를 확대하지 않았다.

실제 렌더링/변경 과정/재현 명령은 `docs/handoff/2026-11-01-ethereum-learning-ux.md`, 동일 뷰포트 스크린샷은 `docs/design/ethereum-learning/storyboard.html`을 따른다.
