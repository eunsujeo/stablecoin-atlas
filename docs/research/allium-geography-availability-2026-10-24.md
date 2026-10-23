# Allium 지리 자료 — 공식 스키마와 직접 API 확인

확인: 2026-10-23 UTC / 2026-10-23~24 KST. 사용자 요청은 지원된 자료의 수집·UI 연결이며, 후속으로 문서 로그인과 API 접근을 구분해 미확보라도 직접 호출하라고 지시했다. 실행 경계·고정 SQL/hash·원문 보존은 [ADR0080](../adr/0080-bounded-allium-geographic-data.md)이 정본이다.

## 확인한 지원과 한계

| 자료 | 공식 근거 | 현재 확보 |
| --- | --- | --- |
| 국가·지역×토큰×체인 추정 보유 잔액 | [Aggregates — Geo Balances Daily](https://docs.allium.so/historical-data/identity/aggregates#geo-balances-daily)의 테이블·열·단위 확인 | 직접 실행 failed. 데이터 미확보·INCONCLUSIVE |
| 국가별 사용량·국가간 전송량 | [Identity](https://docs.allium.so/historical-data/identity)의 [Geo](https://docs.allium.so/historical-data/identity/geo) 링크는 로그인으로 이동 | 실행 가능한 상세 스키마 미확인·NOT_TESTED |
| 국가/체인/결제 corridor 분석 및 API | [공식 제품 안내](https://www.allium.so/use-case/payment)에 기능 설명 있음 | 개별 계정 접근·필드/coverage 인증 아님 |

공개 잔액 집계는 공급자가 지리를 귀속한 지갑만 포함한다. 국가 전체 보유량·국가별 사용량·결제량·국가간 송금량을 대신하지 않는다. 로그인 문서를 우회하지 않았으며 국가·주소 귀속 모델을 새로 구현하지 않았다.

## 실제 호출

| 별도 영속 슬롯 | 고정 대상 | 실제 HTTP | 결과 |
| --- | --- | --- | --- |
| discovery | ALLIUM_IDENTITY의 geo 관련 열 정의만 | 생성1·실행1·상태1 | 모두 HTTP200, run 상태 `failed` |
| balances | 공식 geo_balances_daily, 기존11배포, UTC2026-10-22 하루 | 생성1·실행1·상태1 | 모두 HTTP200, run 상태 `failed` |

합계2run/6HTTP·재시도0·결과 페이지 요청0·금액 관측0. 상태 응답은 `failed`였고 상세 오류는 제공되지 않았다. 이는 공급자 조회 실행 실패이며 프록시 차단·만료 키·권한 부재·테이블 부재 중 하나로 추정하지 않는다. 비용 통제/귀속·조직/타PC 배타성은 미확인이다. 기존 archive 및 앞선 실패 원문의 바이트 보존을 확인했다. 원문·계정 식별자·승인·키는 Git/웹에 게시하지 않는다.

## 후속 잔액 수집 요청의 실패 상세 확인

사용자의 “그정도도 우리에겐 좋은 자료야 수집해줘” 요청에 따라 [ADR0081](../adr/0081-geographic-balance-collection-diagnosis.md)의 별도 단발 GET으로 기존 balances 실행의 상세 오류를 확보했다. 공식 [Fetch latest query run](https://docs.allium.so/api/explorer/fetch-latest-query-run)의 query_id 필터를 사용하고 원래 query/run/SQL을 대조했다. HTTP200 응답의 오류는 `You used invalid tables: allium_identity.aggregates.geo_balances_daily`다. 기존 status-only 응답에는 이 상세가 없었으며 원래 실패 기록은 수정하지 않았다.

진단은1HTTP/0run·재시도0이며 실제 누적2run/7HTTP다. 이전 geography/legacy 바이트 보존을 확인했다. 오류 정보 확보와 금액 관측은 별개이며 실제 국가별 잔액은 계속 미확보다. 테이블 거절의 원인이 계정 권한인지 공개 경로 차이인지 확정하지 않는다. 같은 SQL의 새 실행은 하지 않았고 usage·공급자 전환도 없다. 재개에는 현재 계정에 제공되는 지리 잔액의 테이블/전달 경로와 접근 조건 확인이 필요하다.

## 로컬 표시

`npm run allium:geography -- publish --kind balances`는 저장된 원문 hash·authorization·intent를 오프라인 확인해 확보 상태만 발행한다. 기존 loopback UI의 ‘국가·지역별 스테이블코인’은 잔액의 직접 조회 실패와 다른 두 항목의 미실행을 구분한다. 웹 요청/다시 읽기/서버 시작은 공급자를 호출하지 않는다.

검토된 잔액 원문이 있는 경우의 정확 문자열 금액·null/명시0·누락 배포·국가/토큰/네트워크 필터·실패 시 마지막 정상 자료 보존은 가상 transport와 브라우저 주입으로만 검증했다. 가상 값은 실제 저장본·DB·UI 공급 자료에 발행하지 않았다. 이번 실제 결과에는 국가별 숫자/순위/차트가 없다. 두 슬롯은 소비됐으며 새 권한/스키마 근거 없이 반복하거나 추측 테이블로 확장하지 않는다.
