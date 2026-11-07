# Yahoo 참고 환율·웹 가용성 분리

## 요청과 실제 원인
사용자가 Yahoo 라이브러리 대안을 질문한 뒤 수집/마지막 정상 표시/환율 장애의 배포 분리를 모두 승인했다. 기존 웹은 Frankfurter DB를 읽고, timer는 ECB 파일을 갱신하고 있었다. 7일 초과 Frankfurter가 배포 필수 gate를 실패시켰다. 추가로 실제 렌더링에서 가격 표가 `overview-previous-data[hidden]` 안에 있어 화면에 보이지 않는 환율이 배포를 막았음을 확인했다.

## 구현
ADR0131에 따라 별도 Yahoo store/단일 고정 요청/원문/hash/불변 일별 claim/오프라인 publish, schemaVersion3, 마지막 정상 환율+기준일/갱신 지연, 환율 없음 시 USD 표시를 구현했다. 기존 가격 표만 숨겨진 이전 데이터 영역 밖으로 옮겼으며 현재 공급량·전송량 그래프/KPI는 유지했다. 웹 요청은 저장본만 읽는다. 기존 DB/수집기 코드/스키마/자료·Frankfurter 실패는 변경0이다.

FX 503은 보조 기능 미확보로 health report에 남기며 웹 배포를 차단하지 않는다. malformed200/다른503/핵심DB/자산hash/SHA는 계속 실패한다. Bootstrap 고정 런타임도 같은 정책으로 갱신이 필요하다.

## 실제 조회와 수정
- 새 Yahoo 호출1GET/HTTP200/1677bytes, 재시도0. 원문은 `.state/yahoo-fx-store/archive`에 사설 보존했다.
- 요청은 KRW=X, 실제 응답의 symbol은 USDKRW=X. 최초 정확 이름 검사에서 YAHOO_FX_INVALID로 종료했다. 두 정확한 별칭과 currency/instrumentType를 검증하도록 수정하고 기존 claim/원문만 오프라인 재해석했다. 실패 기록을 지우지 않았으며 추가 GET0.
- 실제 관측 기준일2026-11-06, 수집2026-11-07T00:49:14.260Z. rate는 원문 숫자 lexeme의 십진 문자열로 보존했다. 미래 날짜였던 별도 Frankfurter 원문을 수정하지 않았다.
- 새 패키지 다운로드/키0. 신규 DB DDL/DB쓰기0.

## 검증 및 재현
- `npm run check`: 최종994pass/0fail/8skip (`.state/yahoo-fx-check-final.log`).
- `node --import tsx --test tests/deploy-automation.test.mjs tests/yahoo-fx.test.mjs web/fx-model.test.mjs`: 초기63pass/0fail, 이후 body abort/timeout 회귀 추가.
- `node --import tsx --test tests/yahoo-fx.test.mjs web/fx-model.test.mjs`: 6pass/0fail.
- `ATLAS_YAHOO_FX_FILE=$PWD/.state/yahoo-fx-store/yahoo-fx.json node --use-env-proxy tools/ui-preview.mjs --database --database-env .state/market-db-secrets/reader.env --port 54879`
- `node tools/fx-browser-check.mjs`: 실제 DB 시장 자료 + 실제 저장 Yahoo 응답. 오래된 환율/503은 의도적 브라우저 검증 Fixture.1440×900·390×844에서 표/환율 문구/통화전환 확인. 초기 DOM 검사는 숨겨진 표를 통과시켜 스크린샷 검토에서 발견했고, 실제 표시되도록 수정 후 checkVisibility 검증 추가. 결과 `.state/yahoo-fx-browser/verification.json`와6스크린샷. `tools/atlas-navigation-browser-check.mjs`로5체인×3뷰포트 복귀·이전 Wallet Flow 404·JS오류0도 PASS (`.state/yahoo-fx-navigation`).

## 운영 상태
SSH 재접속은 정상. `sudo -n true`는 password required다. 운영 웹/Collector/Usage/timer 변경0. 아직 운영 반영 완료로 보고하지 않는다. 코드 테스트·CI 완료 후 기존 Bootstrap install/verify/enable과 새 Yahoo unit 설치에 필요한 정확한 sudo 실행을 요청한다. 같은 실패 SHA 자동재시도 불가하므로 Bootstrap 갱신 후 새 검증 SHA로 기존 LOCAL_GIT 배포를 진행한다. 승인된 통상 배포/롤백 경로를 보존한다.
