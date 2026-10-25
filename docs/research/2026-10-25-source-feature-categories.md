# 자산 프로필의 기능별 소스 검증 항목

## 요청과 근거

사용자가 기능별로 검증 항목을 나눠 어떤 기능이 있고 없는지 보자고 요청했다. 기존 기능1/권한1은 긴 문장을 번호로만 나눠 같은 기능을 자산별로 찾기 어려웠다. [소스 요약](2026-10-25-token-review-source-summary.md), [USDC 조건표](2026-10-25-usdc-offline-source-review.md#후보-소스의-항목별-검토), [JPYC/JPYSC 조건표](2026-10-25-jpy-public-html-source-review.md), [정본 매트릭스](../STABLECOIN_COMPATIBILITY_MATRIX.md)의 저장 소스 조건을 읽어 공통 항목에 수동 대응했다. 신규 공식 주소 인증이나 외부 조회는 하지 않았다.

## 기능과 표시 기준

공통14항목은 전송, 위임 전송, 승인, 승인 철회, 승인 전0 초기화 강제, 서명 승인, 발행, 소각, 일시정지/재개, 주소 차단/해제, 차단 자금 제어, 외부 토큰 회수, 구현 변경, 전송 수수료 차감이다. 각 행에는 기능군·유무·소스 조건·파일/함수 또는 저장 매트릭스 근거를 제공한다. 상태 필터와 개수를 제공하며 빈 상태는 빈 목록으로 표시한다.

- 있음(PRESENT): 선택 소스 경로에서 해당 기능/조건을 확인했다. 현재 설정값·실제 실행·제품 지원을 뜻하지 않는다.
- 없음(ABSENT_IN_REVIEWED_PATH): 검토한 특정 경로에 해당 조건/차감이 없다는 명시 근거가 있다. 전체 배포에 기능이 없다고 일반화하지 않는다. 표 바로 위에 이 범위를 고정 문구로 제공한다.
- 추가 검토(NOT_REVIEWED): 해당 기능에 대한 저장 검토 결론이 부족하다. 실패/미기재를 없음으로 바꾸지 않는다.

예: USDT의 deprecated=false local approve/철회/zero-reset과 전달 대상의 조건은 별개다. USDC/RLUSD의 선택 전송 경로 수수료 차감 없음은 전체 배포 수수료 부재 인증이 아니다. RLUSD의 계정 pause는 기능적 주소 제한이며 blacklist라는 함수명의 존재로 표시하지 않는다. USDT deprecate와 UUPS, 차단 자금 파기·강제 이전·외부 ERC20 회수는 조건에서 구분한다. JPYC4네트워크는 기존 등록 소스 프로필 범위만 재사용한다.

| 자산 | 있음 | 없음(검토 경로) | 추가 검토 |
| --- | ---: | ---: | ---: |
| USDC | 10 | 2 | 2 |
| USDT | 12 | 0 | 2 |
| RLUSD | 11 | 2 | 1 |
| JPYC(각 등록 네트워크) | 11 | 1 | 2 |
| JPYSC | 11 | 1 | 2 |

이 목록은 모든 callable 함수의 완전 목록이나 새 Assessment가 아니다. 기존 sourceReviewProfiles의 원문 조건·진단·배포 연결과 원본 보고서는 변경하지 않았다. 생성 공개 발췌 HTML에는 기능 표를 추가했으며 기존 관측/한계/근거를 보존했다. 자산 프로필의 제거된 과거 진단 UI는 복원하지 않았다.

## 수행 경로·검토와 검증

web/source-review-data.js에 기능 catalog/수동 근거/3상태와 sourceFeaturesFor를 추가했다. 명시 coinId/chainId가 등록된 프로필일 때만 반환하며 잘못된 네트워크에는 빈 배열을 반환한다. UI/공개 발췌 생성기가 같은 분류를 사용한다. 새 RPC/API/compiler/키/DB 변경0.

로컬 Lead 9eadbf0ef92341dc945975ac952c0910은 revise_plan: 부재 범위 표시, USDT deprecated=false local 경계, RLUSD 계정 pause/blacklist와 USDT deprecate/UUPS 구분, JPYC 등록 범위와 전체 검증 유지 조건을 제시했다. 이를 표시 문구와 소스 데이터에 반영했다. 구현 위임/모델 전환은 없다.

`node tools/source-review-notes.mjs`로 발췌를 오프라인 재생성했다. `node --test web/source-review.test.mjs`는 3/3통과(rc0): 경로 부재와 근거 부족 구분, USDT local 조건, 계정 pause/blacklist 및 deprecate/UUPS 구분, 잘못된 chain 차단, 반환 객체 변경 격리와 기존 생성 문서 동기화를 검사했다. 구문/단위/브라우저 검사는 첫 실행부터 통과했고 취득 실패는 없다.

`node tools/source-review-browser-check.mjs http://127.0.0.1:4173`은 실제 Chrome에서 기본/Atlas8프로필의14행·조건/근거/상태·4필터·빈 결과·기존 소스 선택/키보드/검색·근거503·과거 진단 DOM없음·비교와 전체현황 회귀·다크/라이트1440/390px·JS오류0/외부요청0을 검증했다. 정적 HTML 응답과 구분한다. 캡처 `.state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png`, 로그 `.state/agent-logs/feature-categories-{unit,browser,check}.log`. 최종 npm run check·구문 검사·git diff --check 결과는 [인계문](../handoff/2026-10-25-source-feature-categories.md)에 기록한다. 사용자용4173은 유지한다.
