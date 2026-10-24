# Allium 다중 체인 저장 조사

[ADR0067](adr/0067-offline-multichain-survey-storage.md)의 별도 `atlas_survey` CLI와 Overview 저장 조사 표다. 대상과 한계는 [실제 조사 결과](research/allium-samples/survey-2026-10-23.md)가 정본이다. 기존 atlas_supply14행·atlas_activity60행과 기본 공급량 그래프는 유지한다.

[ADR0077](adr/0077-offline-live-survey-storage.md)은 [후속 실제 수집 저장본](research/allium-samples/live-2026-10-23.md)의 오프라인 입력을 추가한다. 같은 고정 기간의 원래 시각으로 두 snapshot을 덧붙이고, 기존 표가 종류별 최신 전체 snapshot을 읽는다. 새 공급자 호출·DB migration·권한 변경·자동 수집은 없다.

[ADR0078](adr/0078-windowed-survey-storage.md)은 다른 날짜의 검토 live 원문을 위한 v2 기간 저장을 추가한다. `npm run market:survey:db -- upgrade --env-file .state/market-db-secrets/admin.env`는 비파괴 명시 upgrade이며 init/import가 자동 실행하지 않는다. 기존 v1/4source는 유지한다. 새 날짜 import에는 `--day D`를 명시하고, `read --day D`로 그7일 창만 읽는다. 기본 읽기·로컬 표는 가장 최신 저장 window를 선택하며 다른 기간으로 빈 종류/날짜를 채우지 않는다. 새 날짜 가상 자료는 실제 DB에 넣지 않으며 이번 변경으로 수집을 추가 실행하지 않는다.

## 오프라인 입력

```sh
npm run market:survey:db -- init --env-file .state/market-db-secrets/admin.env
npm run market:survey:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_WRITER_ROLE --mode writer
npm run market:survey:db -- grant --env-file .state/market-db-secrets/admin.env --role EXISTING_READER_ROLE --mode reader
npm run market:survey:db -- boundary --env-file .state/market-db-secrets/admin.env \
  --reviewed-definers PRIVATE_REVIEWED_DEFINERS.json --reviewed-sha256 REVIEWED_MANIFEST_HASH
npm run market:survey:db -- import --env-file .state/market-db-secrets/writer.env \
  --kind supply --source PRIVATE_RAW_RESULT.json --expected-sha256 REVIEWED_RAW_HASH \
  --sql-review PRIVATE_SQL_REVIEW.json --reviewed-sql-review-sha256 REVIEWED_SQL_REVIEW_HASH \
  --review-receipt PRIVATE_ORIGINAL_UNKNOWN_RECEIPT.json --archive-dir .state/allium-survey-archive
npm run market:survey:db -- read --env-file .state/market-db-secrets/reader.env
```

역할 자리표시자는 기존 역할로 바꾼다. 전송량은 `--kind volume`과 해당 원문/검토/receipt를 사용한다. importer는 입력을 DB 연결 전에 재검증하며 SQL echo를 새로 승인하지 않는다. 같은 raw/검토/receipt 재입력은 추가0행이다. 수정 원문·다른 검토는 별도 근거이며 같은 종류/관측시각 충돌은 거부한다. archive 바이트는 Git/웹에 게시하지 않는다. boundary에서 접근 가능한 미검토 definer가 있으면 기존 방식대로 중단하며 함수와 schema hash가 모두 같은 개별 검토만 재사용한다.

ADR0076 live 저장본은 같은 import 명령에 `--execution-authorization PRIVATE_ORIGINAL_AUTHORIZATION.json --user-approval PRIVATE_ORIGINAL_USER_APPROVAL`을 함께 지정한다. `--sql-review`는 해당 live 개별 manifest, `--review-receipt`는 그 manifest가 가리킨 **검토 전 UNKNOWN receipt**다. 최종 SUCCEEDED receipt나 이전 조사 manifest로 대체하지 않는다. 원래 승인 bytes를 그대로 쓰며 현재 시각의 실행 lease·새 API 키·승인 재소비는 요구하지 않는다. 이 두 추가 원문도 비공개 archive에서 검증하고 보존한다.

## 로컬 표시

`npm run ui -- --database --database-env .state/market-db-secrets/reader.env`의 Overview에서 **Allium 다중 체인 · 저장 조사**를 본다. 최신 저장 window의11배포를 자료/토큰/네트워크로 필터링하고, 제목과11×7칸은 해당 기간으로 표시한다. 현재 실제 저장 기간은10/16~22다. 다른 window의 자료로 누락 종류/날짜를 채우지 않는다. 관측 행의 필드 null은 `—`, 해당 날짜 행 부재는 `미확보`, Kaia JPYC의 공급자 미일치는 `INCONCLUSIVE`다. XRPL은 조회하지 않은 NOT_TESTED이며 선택 가능한 조사 대상에 포함하지 않는다.

공급량6개 필드는 tokens/USD와 세 정의를 각각 표시한다. 전송량은 지갑 간 이동량이며 매매 거래량과 다르다. 합산·환산·기본 공급자 전환은 하지 않는다. 관측 근거에서 원래 UTC 조회시각·원문 SHA·공급자 native/조정 제공 플래그를 확인한다. 집계 시간대 UNKNOWN과 최소 단위 정밀도 미검증을 유지한다.

표의77일 중 Kaia의7일 표시는 미일치1행의 기간 상태이며7개 관측행이 아니다. 실제 저장 row 수와 관측 개수는 조사 정본을 따른다. 화면 재조회는 저장 DB만 읽으며 공급자 호출·수집·파일 생성은 실행하지 않는다.

## 실제 저장 검증

2026-10-24 [오프라인 재대조](research/provider-data-use-priorities-2026-10-24.md#allium-저장-공급량전송량의-오프라인-대조)는 최초/live의4개 snapshot을 원문·검토·receipt/archive에서 재구성해 당시 저장한 DB 조회본과 비교했다. 총274관측의 문자열/null·기간·원래 시각/hash가 같았고 Kaia 미일치와 JPYSC3일 누락도 유지됐다. 현재 DB 재접속·브라우저 재검사는 하지 않았다. probe_id만 있는 접근 표본6건은 시계열 입력에서 분리했다. 상세 정밀도·필드 null 및 비공개 검사 경로는 위 검토를 따른다.

ADR0078의 명시 v2 upgrade를 개발 DB에 적용했다. 새 소유 PG17 정본 DDL의 코드 고정 구조와 대조했고, 기존 version1행·source4개·최신137관측·원본 바이트·기존6schema 구조/보안·시장180/전송60/공급14건은 동일했다. source 추가·새 grant·공급자 호출은0이다. 실제로 비어 있는 다음 날짜 읽기는 다른 기간으로 보충하지 않고0snapshot을 반환한다. 브라우저의 새 기간/누락 kind 시험은 가상 DTO만 주입했으며 실제 DB에 입력하지 않았다. 기존 실제 표154날짜칸·필터·실패/복구·두테마/390px·외부요청0/JS오류0도 재확인했다. 결과 수와 미리보기 서비스는 이번 인계문을 따른다.

ADR0077 후속으로 live 공급량/전송량 두 snapshot을 추가하여 source는 **2→4개**다. 이전2개 행과 기존6schema 구조/보안·시장 표본180건·전송량60건·공급량14건의 값/hash를 보존했다. 최신 whole snapshot은 공급량 `2026-10-23T13:27:52.399871Z`, 전송량 `2026-10-23T13:33:40.559550Z`의 원래 queried_at을 사용한다. reader의137 OBSERVED·미일치2행과 모든 값/null/시각/hash를 원래 projection과 대조했고, 두 재입력은 추가0행이다. 실행 근거/승인 원문까지600 archive에서 바이트를 대조했으며 새 Allium 호출·migration/grant는0이다. 기존 Data API 유효 접근 차단을 재확인했고 Dashboard 노출 설정은 계속 UNKNOWN이다. Chrome에서154날짜칸·필터·미확보3일·실패/마지막정상/복구·두테마·390px·외부요청0/JS오류0을 확인했다. 실제 DB는 개발용 비공개 DB이며 브라우저 제공은 loopback이다. 명령·검사 수·미리보기 주소는 이번 인계문을 따른다.

기존 비공개 DB에2개 snapshot(공급량70관측+미일치1행, 전송량67관측+미일치1행)을 입력하고 재입력 추가0·전체137관측의 정확한 값/null/시각/hash 대조를 완료했다. 기존6개 schema 구조·보안과 시장 표본180건·전송량60건·공급량14건의 값/hash는 전후 동일했다. archive 원문/검토/receipt의 바이트·600권한을 확인했고 새 공급자 요청은0이다. Data API 유효 권한·역할 전환·view/definer 경계 검사를 통과했으며 Dashboard 노출 설정은 계속 UNKNOWN이다. 시험·브라우저 결과와 로컬 미리보기 주소는 이번 인계문을 따른다.
