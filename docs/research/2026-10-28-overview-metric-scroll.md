# 전송 지표 전환의 스크롤 위치 보존

사용자는 전체 현황의 전송금액/전송 건수 탭을 바꿀 때 화면이 최상위로 올라간다고 보고했다. UI의 동기 렌더링만 수정했다. 새 공급자/API/DB/Collector/FX/운영 배포 변경은0이다.

## 재현과 원인

전송 지표 클릭은 전체 overview root를 replaceChildren한 뒤 공급량/전송 차트와 비교표를 다시 만든다. 먼저 생성되는 공급량 차트가 clientWidth를 읽어 layout을 강제하면 전송 영역이 아직 없는 문서 높이가 계산되어 스크롤이 위로 clamp된다. 기존 aria-label 기반 focus({preventScroll:true})는 포커스를 복원하지만 이 문서 높이 축소를 막지 못했다.

처음 전송 차트만 넣은 fixture는 이 경로를 재현하지 못했다. 공급량 차트를 포함했고, Chrome의 기본 스크롤 앵커링이 문제를 보정하는 조건과 꺼진 조건을 나눴다. 원코드/동일 fixture의 overflow-anchor:none에서 실제 클릭 후 scrollY541→300을 재현했다. activeElement/선택 상태는 올바른 버튼이지만 viewport가 위로 이동했다. 실제Safari 원인·재현을 확인한 것으로 표현하지 않는다.

초기 CDP Enter 시험은 text 필드가 없어 버튼을 활성화하지 못했다. Enter의 실제 key/text 이벤트를 보완한 후 선택 상태를 함께 검사했다. 리사이즈 후 재생성되는 DOM의 오래된 버튼 참조도 현재 selector로 바꿨다. 초기 시험 로그를 사설 보존했다.

## 변경

web/supply-overview.js의 render 동안 기존 root의 높이를 임시 min-height로 유지한다. 부분 DOM의 layout이 강제되어도 문서가 순간적으로 짧아지지 않는다. try/finally에서 원래 inline min-height 값과 important 우선순위를 정확히 복구한다. 기존 선택 버튼 포커스 복원을 유지한다. 전역 smooth scrolling 설정이나 강제 scrollTo를 추가하지 않았으며 새 데이터/판정을 생성하지 않는다.

## 검증

`node tools/overview-scroll-browser-check.mjs`는 독립된 소유 Chrome profile과 loopback 서버·가상 공급량/전송 자료를 사용한다. 닫을 때 이 프로필/서버만 정리한다. 공급자/API/DB 읽기0, JS오류0이다.

- 1440/390px × light/dark × overflow-anchor none/auto의8조건, 마우스/Enter의 탭 왕복64회에서 scrollX/Y 오차2px이내·버튼 focus/aria-pressed 유지.
- 별도 기존 inline min-height:32px!important 복구와 정상 렌더링 후 임시 스타일 잔류없음 확인.
- 동일 재현 조건의 수정본은541→541로 유지했다.
- 전체 회귀 명령 `npm run check`, 결과는 최종 기록을 따른다. 기존 공급자/DB/금액/관측시각·브라우저캐시 정책은 변경하지 않았다.

Lead9eac4d4b83394db5a9cd6e6052f76118의 proceed와 재현/검증 조건을 확인했다. 실제iPhone/Safari/WebKit 기기 시험은 하지 않았다. 초기/재현/수정/최종 브라우저와 check 로그는 .state/overview-scroll-20261028에 비공개 보존한다. 현재 로컬 웹은 소유 서버가 정적 파일을 읽는 구조이므로 브라우저를 새로고침하면 수정된 모듈을 읽는다. 운영 서버 배포는 수행하지 않았다.

최종검증: `npm run check` =754pass/0fail(일반680+네트워크차단74). 브라우저행렬64전환과별도inline우선순위복구시험PASS, JS오류0/공급자0/DB0. `git diff --check` 오류0. 제품변경은render중높이보존5줄추가이며원본자료나운영설정은변경하지않았다.
