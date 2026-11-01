# Ethereum 초보자 학습: 슬롯·블록·Fork·Reorg

2026-11-01. 기존 합의 실험과 한 화면 레이아웃을 보존하고 독립된 블록 생성 및 Fork 장면을 추가했다. 전부 교육용 고정 표본이며 실시간 관측·RPC·DB·서명/거래 실행을 하지 않는다.

## 공식 근거

- [Ethereum PoS](https://ethereum.org/developers/docs/consensus-mechanisms/pos/): 12초 슬롯, 제안자/검증자 역할.
- [Blocks](https://ethereum.org/developers/docs/blocks/): 부모 해시를 통한 연결, 슬롯과 실제 블록의 차이.
- [Attestations](https://ethereum.org/developers/docs/consensus-mechanisms/pos/attestations/): head와 source/target, 위원회 배정.
- [Gasper](https://ethereum.org/developers/docs/consensus-mechanisms/pos/gasper/): 미확정 head 선택과 FFG 정당화/최종 확정의 구별.
- [Consensus fork-choice specification](https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/fork-choice.md): `get_head`, `get_weight`, `update_latest_messages`, `validate_on_attestation`을 대조했다. 최신 target epoch 메시지, 후손에 대한 지분 합, 같은 가중치의 root 순서, attestation 슬롯 이후 적용, justified/finalized 경계, proposer boost를 구분한다.

V는 Validator, C는 Checkpoint, B는 이 모형의 블록 이름이다. #번호는 execution block height이며 beacon slot 번호와 다르다. Checkpoint는 별도 블록을 만드는 것이 아니라 epoch와 기존 block root를 묶는 기준점이다. 경계 슬롯이 비면 그 이하 마지막 블록을 참조할 수 있다. 이 차이를 용어 창에 설명한다.

## 생성 장면

재생 24초=실제 72초(3배 압축). 초기 B700(#700, slot3199) 위에 slot3200~3205의 6차례를 관찰한다. 제안자는 고정 V01~V06이며 실제 RANDAO 계산을 주장하지 않는다. 슬롯 중간에 블록을 제안하되 V03은 오프라인이다. slot3202 종료 시 skipped를 기록하고 다음 B703(slot3203)은 B702를 부모로 참조한다. 최종 6슬롯/5블록/1 skipped이며 끝 시점은 다음 slot3206의 시작이다. 에포크100의 32칸(3200~3231)을 동시에 표시하고 6분24초 관계를 설명한다.

## Fork 장면

초기 F=checkpoint C122(slot3904, execution#404)는 finalized, H3936=C123은 justified라는 전제를 둔다. F부터 P(slot4000,#500,C125)까지 97개 실제 모형 노드를 연결해 놓고 그림에서는 중간 95개를 생략한다. 부모 정보는 모형과 상세 설명에 보존한다.

| 재생 시각 | 사건 |
| --- | --- |
| 3초 | A(slot4001,#501,parent P)가 관찰 노드에 도착. 송금 T 포함 |
| 6초 | V03·V05·V06의 A 메시지 수신, 지분2+1+1=4 |
| 7초 | A를 못 본 다음 제안자가 B(slot4002,#501,parent P) 생성. 관찰 노드는 아직 미수신 |
| 10초 | A 위에 A2(slot4003,#502) 도착 |
| 12초 | 관찰 노드에 B 도착, 아직 A 가지 지지가 큼 |
| 16초 | B에 대한 V01의 메시지 수신, B 지분3 |
| 18초 | B에 대한 V02의 메시지 수신, B 지분6. A의 4보다 커서 Head를 B로 변경 |
| 22~24초 | A·A2 제외/B 선택, T는 정식 체인에서 제외됨을 설명. F는 보존 |

지분은 정규화한 교육 단위(bigint)이며 실제 ETH가 아니다. V01/02=3, V03/04=2, V05/06=1, 합12. V04의 attestation은 미도착이다. 3명의 A 지분4보다 2명의 B 지분6이 크며, 두 블록인 A 가지보다 한 블록인 B 가지를 선택한다. 6/12는 2/3가 아니지만 head 선택은 FFG 임계값 판정이 아니다.

서로 다른 검증자가 같은 epoch에 각각 한 번 투표한다. 동일 검증자의 같은 target epoch 메시지를 표 변경이나 추가 표로 처리하지 않는다. 관찰 노드에 반영할 때 attestation slot보다 현재 slot이 늦은지 확인한다. 비교가 일어나는 slot4004에서는 각 후보의 proposer boost가 만료된 상태다. 두 후보는 같은 checkpoint target P와 justified source를 가진 유효 후보로 전제한다.

## 모형 경계

- 최신 메시지, 지분 가중 후손 합, root tie-break, 고정 justified/finalized 조상 경로만 구현한다. 실제 BLS/EVM/데이터 가용성/전체 viability·공격 대응·동적 FFG/boost 계산을 구현한 클라이언트가 아니다.
- FFG 장면은 기존 연속 체크포인트 모형을 그대로 사용한다. Fork 장면에서 새 finality를 만들지 않는다.
- T는 A에만 있는 가상 거래다. reorg 후 현재 체인에서 제외되며 mempool 복귀·재포함·실패 여부를 자동으로 단정하지 않는다.
- 정상적인 미확정 reorg와 finalized 블록의 취소를 구분한다. 후자는 중대한 합의 실패와 slashable 위반의 문제이며 절대 불변이라고 단정하지 않는다.

## 구현과 검증 위치

`lessons.mjs`(모형/투영), `lesson-renderer.mjs`(시간 기반 SVG), `glossary.mjs`(쉬운/기술 설명), 기존 controller/transport를 재사용한다. 기존 합의 protocol/engine/playback은 변경하지 않았다. 브라우저/전체 검사와 실패·수정 경로는 [인계](../handoff/2026-11-01-ethereum-beginner-lessons.md), 캡처는 [비교](../design/ethereum-learning/storyboard.html)를 따른다.
