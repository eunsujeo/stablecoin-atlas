# 전체 현황 출처 선택 제거·Allium 표시/자동 요청 종료

사용자는 최초 이미지를 정정해 Arkham 수집 저장/Allium 기존 저장 출처 선택 영역을 제거하고 Allium 데이터를 보여주지 않아도 된다고 요청했다. 전송금액/전송 건수 지표 탭과 키보드 focus 표시는 유지했다. Canton 동의는 [별도 연구 범위](2026-10-28-canton-public-data-scope.md)로 정리했으며 실제수집/등록/기존예산을 확대하지 않았다.

## 변경 범위

supply-overview는 Arkham 입력만 사용하며 출처 picker와 Allium fallback을 제거했다. Arkham 실패 시 기존 Arkham last-good만 유지하고 없으면 미확보를 표시한다. old survey 객체를 전달해도 표시하지 않는다.

overview의 Allium survey/activity/reviewed-supply/geography import·초기화·표시·데이터 요청을 제거했고 index.html의 해당 과거 패널도 삭제했다. 캐시 상태와 갱신 이벤트도 현재 화면의 시장/등록/FX/Arkham/근거에 한정해 과거 Allium 상태가 다시 노출되거나 갱신을 유발하지 않게 했다.

productionDocument는 사라진 geography 절단 marker만 제거했다. 컨트랙트/실행 이력/근거 비공개 처리와 공개 경로 허용목록을 확대하지 않았다. 기존 Allium 원문/DB/파서/별도 읽기 API·정적 모듈은 보존한다. 이번 변경은 화면 표시와 자동 요청 제거이며 기존 API의 공개 종료나 과거 데이터 삭제가 아니다. 새 API/수집/DB변경/운영배포0이다.

## 실제 검증

관련 단위/생산 문서/화면 모델19회귀 통과. `web/arkham-only-overview.test.mjs`는 preview와production HTML의 Allium 패널 부재, 과거4종데이터 요청 부재, 출처picker삭제/지표탭유지를 검사한다.

`node tools/network-usage-browser-check.mjs`: 독립Chrome profile/loopback/가상응답에서1440/390×dark/light, Allium표시/요청0·출처picker0·old survey주입 시fallback0·Arkham API읽기1·외부HTTP0·JS오류0. LAST_GOOD/실패 표시와 지표 전환·원금액 정밀도를 유지했다. Safari stream API 없음은Chrome에뮬레이션이며 실제기기 시험은아니다.

`node tools/overview-scroll-browser-check.mjs`: 8조건64회전환의 기존 scroll/focus/pressed/style복원 회귀 통과. 이번요청을 포커스테두리삭제로 잘못 처리하지 않았다.

실제 Supabase reader의126행과 기대입력 canonical 전체를 대조한 로컬 전체앱에서도5자산/4화면조건 PASS, Allium관련요청0·표시0·외부HTTP0·JS오류0, Arkham API읽기1을 확인했다. 원문/DB를 수정하거나 공급자 API를 호출하지 않았다. 화면/요청 기록은 `.state/arkham-only-20261028`에 비공개 보존했다.

최초 편집 helper가 문자열 index 메서드 오타로 중단돼 아직 저장되지 않은 파일은 적용되지 않았다. indexOf로 수정한 뒤 문법/관련 회귀/실제화면을 확인했다. 초기오류요약과 결과를 사설 보존했다. Leadf6c48963950d4c52b18e18f84b504f2e의 publication 경계 proceed 조건을 확인했다. 전체 npm검사/최종결과는 아래 기록을 따른다.

최종검증: `npm run check` =755pass/0fail(일반681+네트워크차단74), 브라우저4화면/Allium표시·요청·fallback0/기존스크롤64회귀PASS, 실제reader126행 UI대조PASS, diffcheck오류0. 기존18대상·30일540GET 승인 정책도 현재계획 validator에서 동일/유효함을 오프라인 확인했다. 새Canton등록/수집·자동수집확대·운영배포는0이다.
