# Ethereum 합의·최종성 학습 확장

2026-11-01 · `design/ethereum-learning-prototype` · 운영과 별도 로컬 교육용 실험. 기존 작업 보존, 하위 에이전트·API/RPC·DB·배포·commit/push 없음.

## 경로와 구현

기존 controller/engine/protocol/narrative/presentation/renderer와 Epoch·Fork 모형 및 storyboard를 분석했다. `.state/knowledge-consensus-before/`에 코드 기준선을 보존하고 기존 합의 탭만 새 교육 흐름으로 연결했다. 같은 네 KPI, 장면/설명, 재생 컨트롤과 디자인 토큰을 사용한다. 기본 진입은 여전히 블록 생성이다.

`consensus.mjs`는 시간으로 상태를 재구성한다. Attestation의 Head/Source/Target, 서명→전파→관찰 노드 수신→체인 블록 반영, Epoch별 지분과 FFG 결과를 한 모델에서 파생한다. `consensus-renderer.mjs`는 투표 전파와 두 갈래, 체크포인트와 계속 생기는 후속 블록을 시각화한다. 단순한 투표자 수와 체인 길이로 선택하지 않는다. 기존 `chooseHead`/`latestMessages`/`ancestor` 구현은 바이트 그대로 `fork-choice.mjs`에 옮겨 두 모듈에서 재사용한다. 기존 Epoch의 FFG 함수와 Target 지지 검사도 재사용한다.

6단계는 투표의 세 대상 → 전파 → 지분과 Head → 정당화 → 다음 연결 → 최종 확정이다. 정상/일부 오프라인/투표·Finality 지연을 제공한다. 기존 pacing의 별도 consensus 구간은 총42초이며 Head 전환 전후와 정당화·확정 결과에 읽을 시간을 둔다. 기존 Slot/거래/Epoch/Fork pacing은 변경하지 않는다.

## 공식 근거와 한계

- [PoS](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)
- [Attestations](https://ethereum.org/developers/docs/consensus-mechanisms/pos/attestations/)
- [Gasper](https://ethereum.org/developers/docs/consensus-mechanisms/pos/gasper/)
- [Fork choice specification](https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/fork-choice.md)
- [FFG specification](https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/beacon-chain.md#justification-and-finalization)

Head 지지와 Target 지지를 구분한다. 검증자별 더 새로운 Target Epoch 메시지만 최신값을 대체하고 중복을 더하지 않는다. 가중치는 bigint이며 가상6명/5·2·2·1·1·1이다. 한 명의5가 세 명의4보다 크므로 짧은 B가 A→A2보다 우세해지는 장면이 있다. Head 선택은 2/3 문턱을 쓰지 않는다. 확정 경계와 정당화된 기준을 벗어난 후보는 선택하지 않는다.

초기 C99 정당화/C98 확정은 주어진 과거다. C100은 두 가지가 공유하는 블록 P를 참조한다. 두 가지의 Head 투표가 달라도 공통 Source/Target은 같을 수 있다. 투표가 관찰 노드에 도착하는 것과 체인에 반영되는 것은 별도다. Epoch101에서 C100 정당화, Epoch102에서 후속 지지와 연결 조건으로 C100 확정이 가능하다. FFG의4비트 상태와 네 최종화 조건을 재사용한다.

오프라인 V01은 서명하지 않으며, 지연 V01은 서명했지만 관찰 시간 내 도착하지 않는다. 나머지 다섯 명7/12로 블록 생성은 진행되지만 C99 정당화/C98 확정을 유지한다. 장기 장애·inactivity leak에 따른 최종성 회복은 범위 밖이며 영원한 정지를 뜻하지 않는다.

전체 클라이언트가 아니다. 유효성이 확인된 고정 입력, proposer boost가 없는 슬롯 이후 관점을 사용한다. 전체 Store의 후보 유효성 필터·unrealized checkpoint 갱신·BLS·RANDAO·실제 위원회 선정·보상/페널티는 구현하지 않는다. 번호와 지분은 실제 관측값이나 ETH 단위가 아니다. 미래 배정과 실제 서명은 구분하며, 아직 서명 전인 Head는 화면에서 대시로 표시한다. 중간 구간의 실제 표본 블록만 모델에 생성하고 모든 Slot에 블록이 있다는 주장은 하지 않는다.

## 발견과 수정

최초 모듈 공유 과정에서 ES module 순환 초기화 오류를 발견했다. Fork Choice 함수를 독립 공통 파일로 추출해 해결하고 기존 상태를 대조했다. 초기 시각 검토에서 Epoch 전환 후0으로 바뀐 지분이 확정 설명을 흐리는 문제를 발견했다. 결과 장면은 판단에 사용된 이전 Epoch를 명시하고 해당 지분을 유지하며 현재 Head는 별도로 갱신한다. 모바일·데스크톱에서 실제 캡처를 직접 확인했다.

키보드 검사에서 캡처/뷰포트 전환 중 SVG가 재구성되면 상세를 열었던 요소가 교체되어 포커스 복귀가 실패하는 경우를 재현했다. 원래 요소와 선택 식별자를 보존하고, close 후 현재 SVG의 같은 대상으로 복귀하도록 보완했다. 검사기는 비동기 close와 포커스 복귀 완료를 기다린다. 기존 다른 모듈도 같은 상세 창을 사용하므로 함께 회귀 검사한다.

## 재현과 산출물

`.state/dev-env.sh` Node 환경에서:

- `node --test tests/ethereum-learning*.test.mjs`
- `node experiments/blockchain-knowledge/consensus-browser-check.mjs`
- `node experiments/blockchain-knowledge/beginner-browser-check.mjs`
- `node experiments/blockchain-knowledge/epoch-browser-check.mjs`
- `npm run check`

미리보기 http://127.0.0.1:54874/ → 합의·확정. 서버는 `node experiments/blockchain-knowledge/server.mjs`이며 이미 동작 중이면 중복 실행하지 않는다. 비교 `docs/design/ethereum-learning/consensus/review.html`; 실제 캡처와 verification.json은 같은 폴더. 로그 `.state/agent-logs/knowledge-consensus-*`. 최종 수치는 검증 완료 후 아래에 기록한다.

## 확인된 검증 결과

- 새8개 포함 학습 테스트53 PASS. 기존 블록 정상/빈 거래/Fork/Epoch3종의1446시점 상태가 작업 전과 동일하며 핵심9파일 바이트 동일.
- 신규 합의 세 시나리오 각각42초 전체 재생 PASS. 1440×900,1280×800,390×844,360×800에서 KPI/상태·SVG bounds·패널 넘침 검사 PASS. 데스크톱 한 화면과 모바일 세로 구성의 실제 캡처를 직접 검토했다.
- 새 합의 브라우저의 프레임 간격 p95 16.7~16.8ms,25ms초과0. 현재 로컬 Chrome에서의 측정이며 다른 장비 성능이나 사용자 이해도 실측 연구를 뜻하지 않는다.
- 기존 블록·합의·Fork 전체 재생 및 Epoch3시나리오 전체 재생 회귀 PASS.
- 이후 최신 메시지와 판단용 이전 Epoch 투표의 상세 선택을 분리해 모델/최종 렌더 상세 검사 PASS. 결과 장면에 투표 Epoch를 명시해 현재 Epoch와 혼동하지 않도록 했다. 투표 이동은 각 메시지의 실제 모형 송신/도착 간격으로 보간한다.
- 비교 페이지 로컬 링크 및 `git diff --check` PASS. 전체 검사 최종 결과는 아래에 기록한다.

최종 `npm run check` exit0: 본 검사861 PASS/기존8 SKIP + 보존 검사74 PASS = **935 PASS, 0 FAIL, 8 SKIP**. 빌드 성공. 마지막 상세 선택 보완 후 학습53개 재검사와 실제 브라우저 최종 렌더/상세 검사도 PASS. 최종 정상42초 재생과 투표 도착 연출 검사 PASS. 기존 세 모듈 및 Epoch 세 시나리오 회귀 모두 PASS. 비교 페이지와 미리보기를 브라우저에 열었다. 자동 새 대화 예약 안 함 — 현재 세션에서 사용자 검토를 이어간다.
