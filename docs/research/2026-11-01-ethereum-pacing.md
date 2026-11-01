# Ethereum 교육 재생 구간 조정

2026-11-01 · 별도 로컬 프로토타입만 수정. 운영 서비스/배포/DB/수집 변경 없음. 하위 에이전트·commit/push 없음.

## 확인한 문제

변경 전 실제 브라우저에서 거래/빈 거래 전체를 재생하고 상태 프레임을 캡처했다 (`.state/knowledge-pacing-before/`, `knowledge-pacing-before.log`). 기존 거래 선택/실행 이벤트 간격은0.1~0.4초, 블록 포함 이동은 각0.2초였다. 중요한 설명을 읽기 전에 다음 상태가 나타났다. 렌더링 지연이 아니라 교육용 타이밍 문제였다.

## 수정

새 `pacing.mjs`에서 기존 모형 시간0~24와 교육 재생 시간 사이의 연속·단조·역변환 가능한 구간별 선형 매핑을 정의했다. 정상 거래43.8초, 빈 거래28.3초. 첫 proposer/거래 선택/실행 결과/전파/검증 확인에1.5~2초, 순차 거래 이동에0.9초를 배정했다. 후반16~24 모형 구간은 기존8초를 유지한다. 전체 시간에 동일 배율을 곱한 변경이 아니다.

`playback.mjs`의 tick은 교육 시간을 진행한 뒤 같은 모형 시간으로 역변환한다. `controller.mjs`는 slider/output에 교육 시간을, 슬롯/KPI/거래/블록에는 기존 모형 시간을 사용한다. 임의 위치 탐색·단계 이동·재시작·배속·시나리오 전환도 같은 함수로 변환한다. 독립 CSS 타이머나 이벤트 대기열을 추가하지 않는다. 1.5×를 기존 select에 추가하고0.5/1/1.5/2배속을 검증했다.

프로토콜 슬롯12초와 전체72초는 그대로다. footer/교육 타임라인 라벨에 장면별 표시 시간이 다름을 명시했다. 중요한 순간에 충분한 시간을 주고 계속 재생하도록 했으므로 별도의 자동 정지 옵션이나 UI 패널은 추가하지 않았다. 높은 배속을 직접 선택하면 표시 시간도 그 배속에 따라 짧아진다.

## 보존과 검증

- 렌더러3종, protocol,engine,transactions 파일은 작업 전과 바이트 동일. CSS 변경 없음.
- 정상/빈 거래/Fork 각각0~24초0.1초 간격241개, 총723개 모형 snapshot 동일.
- 모델 테스트37 PASS(기존33+시간 매핑4). 중요 상태 길이, 후반 속도 보존, 역변환/경계/임의 탐색,4배속,일시정지/재시작/완료/분할 tick을 검사했다.
- 실제 거래 브라우저 PASS:4뷰포트, 정상43.8초·빈 거래28.3초 연속 재생, 상태/카운트/목록/Receipt/키보드/축소 모션/4배속/rewind 일치. 프레임 간격 정상2629프레임/중앙16.7ms/p9516.7ms, 빈거래1699/16.7/16.7ms,25ms초과0.
- 별도 pacing 브라우저 PASS:1× 전체를 수동 정지 없이 관측,25구간 실측. TX01/02 선택 각각1.50초, TX03 선택1.57초, 실패 Receipt1.99초, 이동0.91/0.91/0.83초, 전파1.50초, 검증2.00초, 후반반복7.99초. 관측 간격 약80ms이며 모든 구간이 목표±0.35초 이내. 사용자 이해도 실측 연구는 아니다.
- 1440×900/1280×800 화면 높이·SVG 잘림,360×800 모바일,교육시간/슬롯시간 표시,footer와 view 일치,역방향 snapshot/SVG 일치 검사. 최종1280 Receipt 프레임 직접 검토.
- 작업 전 CSS 백업을 만들지 않아 최초 보존 비교 명령이 파일 부재로 종료했다. 해당 바이트 비교는 제외하고 실제 보존한 렌더러/모형 파일 및723개 상태를 재검사해 PASS했다. 제품 오류로 해석하지 않는다.

## 재현

```sh
source .state/dev-env.sh
node experiments/blockchain-knowledge/server.mjs
node --test tests/ethereum-learning*.test.mjs
node experiments/blockchain-knowledge/transaction-browser-check.mjs
node experiments/blockchain-knowledge/pacing-browser-check.mjs
node experiments/blockchain-knowledge/beginner-browser-check.mjs
npm run check
```

미리보기 http://127.0.0.1:54874/ · 구간별 비교/실측 `docs/design/ethereum-learning/pacing/review.html`, 원시 결과 `verification.json`. 기존 기능 비교는 `docs/design/ethereum-learning/storyboard.html`.

최종 `npm run check` exit0: 본 검사845 PASS/기존8 SKIP + 보존 검사74 PASS = **919 PASS, 0 FAIL, 8 SKIP**. 빌드 성공. `git diff --check`·비교 페이지 링크 PASS, 기존 제품/배포 추적 파일 변경0. 미리보기와 구간별 비교 페이지를 브라우저에 열었다.
