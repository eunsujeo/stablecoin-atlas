# 금융 데이터 대시보드 위계 정정 — 2026-11-01

사용자는 serif Atlas의 잡지형 인상, 평평해진 KPI, 흐린 패널 경계를 정정 요청했다. 기존 design/atlas-interface-renewal 브랜치와 작업 디렉터리를 보존하고 하위 에이전트 없이 진행했다.

## 구현과 판단

- 브랜드와 데이터 서체를 기존 한글 지원 시스템 산세리프 스택으로 통일했다. Stablecoin 12px/550, Atlas 40px/650과 좁은 자간을 사용하며 모바일·접힌 탐색에도 같은 계열을 적용했다. 폰트 다운로드·심벌 추가는 없다.
- 두 KPI를 독립된 1px 경계/10px 반경 카드로 복원했다. 청록·보라 7% 표면 색조, 짧은 상단 표식, 44px/650 수치, 보조 단위, 구분된 네트워크·기준일을 사용한다. 모바일의 29px 수치와 단위 전용 행, 동일한 하단 정보 높이는 유지했다.
- 경계 토큰을 #343a49로 명확히 하고 얕은 안쪽 하이라이트와 그림자를 공통 토큰으로 묶었다. 분석 패널 내부는 분할선으로 구분해 중첩 카드가 되지 않게 했다.
- 메뉴 선택의 색조·경계 대비를 높이고 하단 관측 자료 안내를 구분선·작은 점·2단 텍스트로 정리했다.
- 기능·API·수치·원래 기준일·배포 구성은 변경하지 않았다. 운영 서버에 접속하거나 서비스를 변경하지 않았다.

## 렌더링

기존 로컬 DB reader preview와 설치 Chrome을 사용했다. 운영 HTML 변환을 로컬에서 렌더링한 화면과 개발 모드를 각각 검사했다. 실제 데이터의 전체 현황·프로필·시장 상세를 1600/1280/900/768/390/360px에서 확인했다. 데스크톱 다크·라이트와 모바일 스크린샷을 직접 검토해 로고 서체, 독립 KPI 경계, 숫자/기준일 정렬, 패널 대비가 요청한 방향으로 보이는지 확인했다.

브라우저 검사 두 모드 PASS: 가로 넘침 없음, JS 오류 0, 브라우저 외부 HTTP 요청 0, 메뉴 접힘/재로드·모바일 메뉴·Escape·검색·popover·키보드 focus·reduced motion·로딩·실패 상태 통과. 서버의 기존 DB reader 조회는 사용하며 공급자 수집은 실행하지 않았다. 개발용 원문 보고서 미보유에 따른 기존 evidence 503은 그대로다.

스크린샷은 docs/design/atlas-interface에 갱신했다. Chrome viewport 에뮬레이션이며 실물 모바일/Safari 검증은 아니다.

## 재현

- source .state/dev-env.sh
- npm run check
- ATLAS_DESIGN_SCREENSHOTS=.state/dashboard-refinement node tools/ui-design-browser-check.mjs http://127.0.0.1:54871
- ATLAS_DESIGN_SCREENSHOTS=.state/dashboard-refinement/development node tools/ui-design-browser-check.mjs http://127.0.0.1:54871 --development
- git diff --check

검증 로그는 비공개 .state/agent-logs/dashboard-refinement-*에 보존한다.

## 최종 검증 결과

npm run check 종료 0. 본 검사 805 pass / 0 fail / 기존 compiler 관련 8 skip, 보존 경로 검사 74 pass / 0 fail: 총 879 pass. git diff --check 통과. 별도 디자인 브랜치에만 커밋·Push하며 운영 배포는 하지 않는다.
