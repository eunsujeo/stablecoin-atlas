# Stablecoin Atlas 인터페이스 리뉴얼

브랜치: `design/atlas-interface-renewal`. 운영 배포와 main 병합은 하지 않는다.

## 워드마크 방향 정정

후속 사용자 지시에 따라 소문자 a 심벌을 제거했다. 기하학적 A, 육각형, 네트워크 노드 등 대체 심벌을 만들지 않는다. 작은 산세리프 Stablecoin과 큰 Georgia 세리프 Atlas를 함께 배치하고, 자간·크기·기준선·명암으로 브랜드를 표현한다. 접힌 사이드바에도 Atlas 단어를 유지하며 모바일은 같은 두 서체를 한 줄로 배치한다. 폰트는 설치된 시스템 글꼴이며 새 다운로드는 없다.

메뉴에는 장식 아이콘을 추가하지 않았다. 자산 선택 목록의 반복되는 이니셜도 제거했다. 메뉴 열기·접기처럼 기능이 명확한 조작 기호는 유지한다. 사이드바의 구획과 선택 표면을 다듬고 KPI는 미세한 색조 차이, 큰 수치, 가는 선, 네트워크·기준일 하단 영역으로 깊이를 만들었다. 모바일에서는 단위를 별도 행에 놓아 두 지표의 하단 정보가 같은 높이에 정렬된다.

다크/라이트·접힌 탐색·모바일 실제 렌더링을 재검토했고 첫 시안의 모바일 KPI 기준일 높이 차이를 수정했다. 브라우저 검증에 워드마크 텍스트·심벌 부재·모바일 하단 정보 정렬 조건을 반영했다. 아래 스크린샷은 이 정정본으로 갱신했다(변경 전 화면은 역사 기록으로 보존).

## 디자인 방향과 토큰

공급량·전송 활동·기술 근거를 읽는 분석 환경이다. 주인공은 가격·수량·날짜이며, 보라색은 브랜드와 선택 위치를 표현한다. 배경과 구획의 밝기 차이, 숫자와 보조 정보의 크기 차이로 정보의 깊이를 만든다.

| 역할 | 다크 기본값 | 적용 |
| --- | --- | --- |
| Canvas | `#101218` | 페이지 배경 |
| Navigation | `#13151d` | 탐색 영역 |
| Surface | `#181b24` | 분석 영역 |
| Separator | `#2b303d` | 데이터 구획 |
| Ink | `#ecedf3` | 본문·수치 |
| Brand | `#bda5f5` | 선택 위치·링크 |

라이트 모드는 같은 위계를 밝은 중립색으로 반전한다. `--muted`, `--surface-raised`, `--control`, `--hover`, 의미별 색상, 간격·radius·서체·글자 크기는 `web/styles.css`의 토큰을 공유한다. 시스템 글꼴을 사용해 한글과 숫자의 렌더링을 맞추며 외부 폰트를 다운로드하지 않는다. 숫자는 tabular figures, 원 주소·근거 식별자는 기존 표현을 유지한다.

구조는 왼쪽의 지속적인 탐색 영역, 위쪽의 제목·작업, 통화·자산 선택, 숫자 요약, 차트와 네트워크 비교, 기술 근거 순서다. 처음 구상에서 모든 것을 개별 카드로 나누는 방식을 제외했다. 지표는 하나의 숫자 구획, 차트와 비교 목록은 하나의 분석 영역, 기술 검토 요약은 행 목록으로 달리 구성했다. 둥근 모서리와 보라색을 반복하는 대신 기능에 따라 정보의 밀도를 바꾼다.

## 변경

- WORKSPACE·탐색용 장식 아이콘·굵은 왼쪽 선택선을 제거했다. 간결한 메뉴와 작은 선택점, 224px/76px 데스크톱 사이드바, 저장되는 접힘 상태를 제공한다.
- 모바일은 56px 상단 탐색과 문서 흐름 안에서 열리는 메뉴를 사용한다. 메뉴 선택 후 본문으로 포커스를 옮기고 Escape로 닫으면 열기 버튼에 포커스를 돌려준다.
- 전체 현황의 그라디언트 KPI를 제거했다. 단위와 기준일을 분리하고 차트·범례·네트워크 순위를 연결했다. 로그 축과 결측 표현·원래 수치·시각·출처는 변경하지 않았다.
- 기술 현황의 반복 카드를 행 목록으로 바꿨다. 자산 디렉터리는 프로필 수로 간결하게 표시하고 네트워크 선택·정확 검색·기능 필터·근거 탭은 유지했다.
- 시장 상세에도 같은 숫자 구획·표면·버튼·글꼴을 적용했다. 테이블·select·검색·popover·오류·빈 화면·로딩·키보드 focus·reduced motion을 함께 정리했다.
- 시장 상세의 모바일 차트는 실제 영역 폭으로 SVG를 구성한다. 축 날짜는 두 개로 줄이고 눈금만 짧게 표시하며 원래 정밀 수치·관측 시각과 키보드/포인터 상세는 유지한다.
- 자산 프로필의 중간 제목을 h3으로 정리해 h2에서 h4로 건너뛰는 구조를 수정했다.

새 UI 라이브러리·폰트·공급자 요청·수집 실행·DB 변경은 없다. API·금액 모델·라우트·원래 캐시 정책·공개 경계·배포 설정은 유지한다. 원래 작업 디렉터리에 있던 별도의 새 PC 문서 두 개도 보존한다.

## 렌더링과 검증

기존 Supabase reader로 제공되는 저장 자료를 로컬 loopback에서 렌더링했다. 브라우저의 외부 HTTP 요청은 차단하며 실제 공급자 수집은 하지 않았다. 운영 화면은 기존 `productionDocument()` 변환 HTML을 로컬 preview에 적용해 검증했다. 운영 서버에 접속하거나 배포해 촬영한 화면이 아니다.

- `npm run check`: 종료 0, 879 pass / 0 fail / 기존 compiler 미보유 관련 8 skip.
- `npm run check:ui`: 종료 0, 119 pass / 0 fail.
- `node tools/ui-design-browser-check.mjs http://127.0.0.1:54871`: PASS. 운영 HTML, 전체 현황·자산 프로필·시장 상세, 다크/라이트, 1600·1280·900·768·390·360px, 접힘 상태 재로드, 메뉴 선택·Escape·포커스 복귀, 실제 검색 선택, popover, Tab·skip link, reduced motion, 로딩·503·빈 상태, 가로 넘침 없음·JS 오류 0·외부 요청 0.
- 같은 도구의 `--development` 검사도 PASS. 개발용 저장 보고서 원본이 없는 환경의 기존 evidence API 503은 개발 경로의 기존 상태로 구분했다. 운영 화면은 이 API를 요청하지 않는다.
- 다크의 기본·보조·강조 텍스트/Surface 대비는 각각 14.72:1 / 7.43:1 / 8.08:1, 라이트는 14.93:1 / 5.98:1 / 7.04:1이다. 이 검사는 기본 토큰 대비이며 WCAG 전체 인증을 뜻하지 않는다.
- `git diff --check`: 통과. 모바일 검사는 설치된 Chrome의 뷰포트 에뮬레이션이며 실제 iPhone/Safari 검사는 아니다.

화면 검토 중 자산 목록의 긴 네트워크 나열, 기술 집계 마지막 항목의 CSS 우선순위, 모바일 범례의 숫자 간격을 수정했다. 시장 상세를 별도로 렌더링해 남아 있던 기존 그라디언트와 큰 radius도 정리했다. 브라우저 도구의 문서 재탐색/렌더링 대기와 CDP 세션 지정 문제는 검증 도구에서 고쳐 제품 오류와 구분했다.

## 화면

- [변경 전 로컬 개발 화면](atlas-interface/before-overview.png): 기존 로컬 보고서 미보유 알림 포함.
- [전체 현황 · 다크](atlas-interface/overview-desktop-dark.png), [라이트](atlas-interface/overview-desktop-light.png), [접힌 탐색](atlas-interface/overview-desktop-collapsed.png).
- [모바일 · 다크](atlas-interface/overview-mobile-dark.png), [라이트](atlas-interface/overview-mobile-light.png), [탐색 메뉴](atlas-interface/navigation-mobile.png).
- [자산 프로필](atlas-interface/assets-desktop-dark.png), [모바일 프로필](atlas-interface/assets-mobile-dark.png), [기술 현황](atlas-interface/technical-desktop.png).
- [시장 상세](atlas-interface/market-desktop-dark.png), [모바일 시장 상세](atlas-interface/market-mobile-dark.png), [지표 설명](atlas-interface/metric-popover.png), [키보드 focus](atlas-interface/keyboard-focus.png).
- [로딩](atlas-interface/overview-loading.png), [자료 조회 실패·빈 상태](atlas-interface/overview-unavailable.png).

## 재현

기존 비공개 reader.env와 CA 설정을 그대로 사용한다. 비밀값을 Git이나 명령 출력에 넣지 않는다.

```sh
source .state/dev-env.sh
npm run ui -- --port 54871 --database --database-env <비공개-reader.env-경로>
node tools/ui-design-browser-check.mjs http://127.0.0.1:54871
ATLAS_DESIGN_SCREENSHOTS=.state/design-review/development node tools/ui-design-browser-check.mjs http://127.0.0.1:54871 --development
```

설치된 Chrome을 사용하며 다른 경로는 `ATLAS_CHROME_BIN`으로 지정한다. 도구는 다운로드를 수행하지 않는다. 스크린샷 기본 경로는 `.state/design-review`다. 운영 배포는 별도 사용자 검토 후에만 진행한다.
