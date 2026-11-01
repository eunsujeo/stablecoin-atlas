# Ethereum Epoch 학습 확장

2026-11-01 · 로컬 교육용 프로토타입. 기존 작업과 운영 환경 보존, 하위 에이전트·운영 접근·API·DB·배포·commit/push 없음.

## 수행 경로

기존 Slot/Block/Transaction, pacing, controller와 storyboard를 확인하고 `.state/knowledge-epoch-before/`에 작업 전 파일을 보존했다. 기존 기본 화면을 교체하지 않고 `Epoch·투표` 독립 탭과 기존 Epoch 표시의 진입 링크를 추가했다. `epochs.mjs`는 순수 시간 기반 모형과 설명, `epoch-renderer.mjs`는 SVG, 기존 controller는 입력과 동일 모형의 KPI를 담당한다. 추가 라이브러리는 없다.

Epoch 100~102, 12초 Slot·32 Slot·384초 Epoch를 표현한다. 1× 교육 재생36초와 프로토콜960초를 구분하며 경계 전환에3초를 배정했다. 기본 화면은 현재 Epoch의 주변7슬롯, 전체32슬롯은 선택 상세로 제공한다. 정상/누락/최종성 지연을 같은 재생 시간에서 비교한다. 누락된3232의 체크포인트는 유효한 이전3231 블록을 참조한다. 체크포인트는 별도 생성 블록이 아니다.

## 정확성 및 범위

공식 자료와 consensus-specs의 stable Fulu 및 상속되는 Phase0/Altair 규칙을 확인했다.

- https://ethereum.org/developers/docs/consensus-mechanisms/pos/
- https://ethereum.org/developers/docs/consensus-mechanisms/pos/attestations/
- https://ethereum.org/developers/docs/consensus-mechanisms/pos/gasper/
- https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/beacon-chain.md
- https://github.com/ethereum/consensus-specs/blob/master/specs/altair/beacon-chain.md
- https://github.com/ethereum/consensus-specs/blob/master/specs/fulu/beacon-chain.md

독립적으로 구현한 FFG 경계 함수는 이전/현재 target 지지와4비트 justification 상태, 네 finalization 조건을 평가한다. 시간만으로 확정하지 않는다. 지분은 bigint이며 검증자6명의 가상 가중치5/2/2/1/1/1이다. 다섯 명의 참여도7/12이면 부족하다. 같은 검증자 집합의 역할표만 바뀐다. 대상 root/source, epoch, 중복·슬래시·포함 시점·서명 유효 전제를 검사한다. Head 투표와 Target 지지를 혼동하지 않는다.

초기 C99 정당화/C98 확정은 이미 발생한 과거 조건이다. 정상은 Epoch102 진입 시 C100 확정, 지연은 C99 정당화/C98 확정을 유지한다. 종료 화면은 Epoch102 중간이므로 C102가 충분한 지지를 모아도 다음 경계 처리를 아직 실행하지 않는다. 이전 Epoch의 평가 결과와 현재 진행 중 지지율을 구분했다.

완전한 합의 클라이언트가 아니다. 서명 유효성은 표본의 전제이며 BLS를 실행하지 않는다. RANDAO·실제 위원회 선정·활성 집합 변동·보상/페널티·inactivity leak은 구현하지 않는다. A/B는 설명용 attestation 역할이며 sync committee가 아니다. 수치와 블록·검증자 배정은 관측 데이터나 실제 ETH 단위가 아니다.

## 검증 및 수정

새8개를 포함한 학습 모형45개 PASS. FFG 네 조건, 지분 부족, 잘못된 source/target·중복·서명·포함 시점, 누락과 부모 연결, 경계와 되감기를 확인했다. 기존 핵심7파일 바이트 동일 및 기존 정상/빈 거래/Fork 723개 상태 snapshot 동일.

브라우저 1440×900/1280×800/390×844/360×800에서 세 시나리오, 경계 전후, KPI·root·역할·지분 동기화, 역방향 탐색,32슬롯 상세, 키보드·포커스 복귀, 축소 모션을 검사했다. 세 시나리오 각각36초 실제 재생 PASS, 프레임 간격 p95 16.7~16.8ms/25ms초과0 (이 로컬 Chrome 측정이며 모든 장비 성능 보장은 아님). 기존 세 모듈 전체 재생 회귀도 PASS. 1280과 모바일 이미지를 직접 확인했다.

초기 브라우저 검사기의 숫자 attribute selector 인용 오류를 고쳤다. 제품 오류는 아니며 재실행 통과했다. 시각 검토에서 이전 Epoch 지지와 현재 지지 혼동을 발견해 문구를 분리했다. Source/Target은 키보드로 선택할 수 있는 상세 설명으로 연결했다. 최종 별도 렌더 검사도 PASS. 사용자 이해도를 실측한 연구는 수행하지 않았다.

## 재현

`.state/dev-env.sh`의 Node 환경에서:

- `node experiments/blockchain-knowledge/server.mjs` (기존 서버가 있으면 재실행 불필요)
- `node --test tests/ethereum-learning*.test.mjs`
- `node experiments/blockchain-knowledge/epoch-browser-check.mjs`
- `node experiments/blockchain-knowledge/beginner-browser-check.mjs`
- `npm run check`

미리보기 http://127.0.0.1:54874/ → Epoch·투표. 비교 `docs/design/ethereum-learning/epoch/review.html`, 실제 캡처 및 verification.json은 같은 디렉터리. 원래 storyboard에서 비교 페이지에 연결했다. 전체 검사 로그 `.state/agent-logs/knowledge-epoch-check.log`; 브라우저 회귀·최종 렌더 로그도 같은 디렉터리의 knowledge-epoch-* 파일이다.

전체 `npm run check` exit0: 본 검사853 PASS/기존8 SKIP + 보존 검사74 PASS = **927 PASS, 0 FAIL, 8 SKIP**. 빌드 성공. `git diff --check` 및 비교 페이지 로컬 링크 검사 PASS. 미리보기와 비교 페이지를 브라우저에 열었다.
