# Allium 다중 체인 저장 조사

[ADR0067](adr/0067-offline-multichain-survey-storage.md)의 별도 `atlas_survey` CLI와 Overview 저장 조사 표다. 대상과 한계는 [실제 조사 결과](research/allium-samples/survey-2026-10-23.md)가 정본이다. 기존 atlas_supply14행·atlas_activity60행과 기본 공급량 그래프는 유지한다.

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

## 로컬 표시

`npm run ui -- --database --database-env .state/market-db-secrets/reader.env`의 Overview에서 **Allium 다중 체인 · 저장 조사**를 본다. 고정10/16~22의11배포를 자료/토큰/네트워크로 필터링한다. 관측 행의 필드 null은 `—`, 해당 날짜 행 부재는 `미확보`, Kaia JPYC의 공급자 미일치는 `INCONCLUSIVE`다. XRPL은 조회하지 않은 NOT_TESTED이며 선택 가능한 조사 대상에 포함하지 않는다.

공급량6개 필드는 tokens/USD와 세 정의를 각각 표시한다. 전송량은 지갑 간 이동량이며 매매 거래량과 다르다. 합산·환산·기본 공급자 전환은 하지 않는다. 관측 근거에서 원래 UTC 조회시각·원문 SHA·공급자 native/조정 제공 플래그를 확인한다. 집계 시간대 UNKNOWN과 최소 단위 정밀도 미검증을 유지한다.

표의77일 중 Kaia의7일 표시는 미일치1행의 기간 상태이며7개 관측행이 아니다. 실제 저장 row 수와 관측 개수는 조사 정본을 따른다. 화면 재조회는 저장 DB만 읽으며 공급자 호출·수집·파일 생성은 실행하지 않는다.

## 실제 저장 검증

기존 비공개 DB에2개 snapshot(공급량70관측+미일치1행, 전송량67관측+미일치1행)을 입력하고 재입력 추가0·전체137관측의 정확한 값/null/시각/hash 대조를 완료했다. 기존6개 schema 구조·보안과 시장 표본180건·전송량60건·공급량14건의 값/hash는 전후 동일했다. archive 원문/검토/receipt의 바이트·600권한을 확인했고 새 공급자 요청은0이다. Data API 유효 권한·역할 전환·view/definer 경계 검사를 통과했으며 Dashboard 노출 설정은 계속 UNKNOWN이다. 시험·브라우저 결과와 로컬 미리보기 주소는 이번 인계문을 따른다.
