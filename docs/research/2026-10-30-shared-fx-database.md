# 환율의 공통 Supabase 저장과 개발 PC 파일 의존 제거

사용자가 PC별 환율 파일 의존을 지적했고, 별도 DB 저장·개발/운영 공통 reader·사설 PG 검증 후 실제 Supabase 스키마/기존 역할 grant/저장 환율 이관을 제안했다. 사용자의 `진행해`로 이 범위를 승인받았다. 새 ECB 요청·운영 배포는 제외했다. 정본 결정은 [ADR0121](../adr/0121-shared-fx-database.md)이다.

## 수행 경로와 수정

`tools/ui-preview.mjs`의 DB 모드도 FX reader를 주입하지 않아 `.state/fx-store`를 읽었다. 운영 웹은 `readPublicFX(config.fxFile)`을 읽었고 배포 preflight도 공개 파일을 요구했다. 별도 `atlas_fx`와 공통 `databaseFXReader`로 연결하고 공개 파일 요구를 제거했다. 기존 설정의 fxFile은 호환용으로 허용하지만 읽지 않는다. Node/환경변수/reader 연결 형식은 변경하지 않았다. 새 PC 안내와 기존 운영 파일 복구 문서에 현재 경계를 반영했다.

정본 DDL을 소유 PG17에서 pin할 때 최초 `structureHash` 호출은 새 스키마가 공통 허용목록에 없어 INVALID_IDENTIFIER로 실패했다. 소유 Fixture를 정리하고 `atlas_fx`를 허용목록에 추가한 뒤 새 Fixture에서 pin/검증했다. 실제 DB 실패나 공급자 실패가 아니다. 새 DDL은 기존 스키마를 참조/수정하지 않으며 RLS·불변 trigger·PUBLIC/API 차단과 기존 역할 확인을 재사용한다. 저장 XML을 hash/재파싱해 원래 projection과 대조한다.

Lead b6a235150ea44a55bb4f741907c6b8fc는 설계 proceed, c23f721369b24bac935d21b76e6612f5는 구현 proceed를 반환했다. 새 권한으로 사용하지 않았으며 실제 적용은 사용자 승인에 근거했다. Lead가 요청한 원 시각·십진 문자열·부재/만료/미래/손상·역할 접근/우회 차단·동일 입력 0삽입·동시성/rollback·기존 지문 보존을 검사했다.

## 실제 Supabase 적용 결과

`node --use-env-proxy .state/fx-db-20261030/apply.mjs` rc0/COMPLETE. 이 스크립트는 Git 제외 사설 실행 기록이며 재실행 금지 marker를 보존한다. 입력·기존 definer 검토 hash와 역할/TLS/대상 일치를 먼저 검사하고 init→기존 writer grant→기존 reader grant→import→동일 import→reader/HTTP→접근경계→기존 지문 순서로 진행했다. 기존 definer 2개 pin은 유지됐다.

- 별도 `atlas_fx`의 schema_version/access_grant/snapshot 3테이블을 추가했다. 기존 writer는 snapshot INSERT/SELECT, 기존 reader는 SELECT다. 신규 키/로그인 역할 생성은 없다.
- 원본 환율 snapshot 1건 이관, 재입력 0건. 기준일 2026-10-22, fetchedAt=null, 원래 importedAt=2026-10-23T01:46:21.297Z를 보존했다. DB stored_at은 별개다. XML 원문과 십진 문자열 projection을 재대조했다.
- 실제 기존 11schema 구조/74table 자료 지문 전후 일치. 이전 인계문의 71table은 당시 기록이며 이번 실제 측정은 74table이다. 비대상 자료를 변경하지 않았다.
- 기존 reader의 운영 읽기 권한 검사 READER_READY, API 4역할·PUBLIC/default ACL·역할 상속/SET ROLE·view/definer 경계 VERIFIED_EFFECTIVE_ACCESS_DENIED. 대시보드의 exposed-schema 설정 자체는 UNKNOWN을 유지한다.
- 실제 reader 왕복과 실제 loopback `/fx-data.json`을 확인했다. 환율은 현재 7일 유효기간 초과이므로 HTTP503/고정 FX_UNAVAILABLE가 정상 결과다. 로컬 파일 fallback은 없다. 정상 자료의 HTTP200과 개발/production 동일 응답·XML 비노출은 사설 PG17에서 확인했다.
- 공급자 HTTP/RPC 0, 새 환율 수집 0, 실제 서버 접속/배포·service/timer 변경 0. 실제 브라우저 렌더링 검사는 수행하지 않았으며 정적 코드/실제 HTTP 응답 검사와 구분한다.

사설 receipt·입력 원문·구조/자료 상세 지문·연결정보는 `.state/fx-db-20261030` 및 기존 비공개 저장소에 보존하고 Git/웹에 게시하지 않는다. 실행 요약 로그는 `.state/agent-logs/fx-db-live.log`다.

## 검증

| 명령 | 결과 |
|---|---|
| `npm run check` | rc0, 731+74=805pass/0fail, cancelled/skipped0 |
| `node --use-env-proxy --import tsx --test tests/fx-db.test.mjs tests/production.test.mjs tests/deploy-automation.test.mjs` | rc0, 60pass/0fail |
| `node --test --test-concurrency=1 tests/postgres/fx.test.mjs tests/postgres/production.test.mjs tests/postgres/asset-review.test.mjs tests/postgres/deployment-gate.test.mjs` | rc0, 4pass/0fail |
| `node --use-env-proxy --import tsx --test tests/production.test.mjs tests/fx-store.test.mjs` | rc0, 15pass/0fail |
| `python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py'` | rc0, 56pass/0fail |
| `git diff --check` | rc0 |

기존 CI PG17 job에도 `tests/postgres/fx.test.mjs`를 추가했다. 실제 hosted CI 결과는 후속 검증으로 구분한다.

## 다른 개발 PC의 재현

최신 main을 받은 뒤 Node24.5 이상에서 `npm ci`, `npm run setup`, `npm run doctor`를 실행한다. 기존 reader 전용 DATABASE_URL과 해당 PC의 DATABASE_CA_FILE을 `.state/market-db-secrets/reader.env`에0600으로 준비한다. 환율 파일은 복사하지 않는다.

```sh
npm run ui -- --database --database-env .state/market-db-secrets/reader.env
```

`http://127.0.0.1:4173/#overview`에서 기존 DB 자료를 읽는다. 새 API 키는 필요 없다. 기본 JSON 모드 `npm run ui`는 오프라인 파일 읽기를 유지하므로 DB 모드와 구분한다. 보존 환율이 만료된 현재 원화 참고값은 미확보이며 자료 날짜를 바꾸거나 0을 넣지 않는다.

사용자의 웹 실행 요청으로 위 DB 모드 서버를4173에서 시작하고 기본 브라우저를 열었다. 실제 로컬 응답은 `/`200, `/network-usage-data.json`200, `/fx-data.json`503을 확인했다. 브라우저를 연 것과 렌더링 후 화면을 검사한 것은 구분하며, 후자는 이번 검증에 포함하지 않았다.

유효한 승인 수집 저장본을 향후 DB에 이관할 때는 검토한 writer와 definer 파일/hash로 다음 명시 CLI를 사용한다. 이 명령은 새 ECB 호출을 하지 않는다. `stored`는 만료 허용 대조 전용이고 `read`는 웹과 같은 유효기간 검사를 한다. 최초 init/grant는 이미 완료했으므로 다른 PC에서 다시 실행할 필요가 없다.

```sh
npm run fx:db -- import --directory <기존-fx-store> --env-file <기존-writer.env> --reviewed-definers <검토본.json> --reviewed-sha256 <검토본-hash>
npm run fx:db -- stored --env-file <reader.env>
npm run fx:db -- read --env-file <reader.env>
```

## 후속 경계

신규 ECB 조회와 운영 배포는 이번 승인에 포함되지 않는다. 기존 FX service/drop-in은 파일 게시 경로 그대로이므로 향후 DB 갱신을 자동 수행하지 않는다. 운영 적용 전에는 기존 수집 성공 후 위 오프라인 import를 실행하는 연결·writer/definer 파일 준비를 검증해야 한다. 수집 주기·원문·claim/receipt·소비를 변경하거나 새 개발 PC에서 timer를 켜지 않는다. 고정 배포 제어면과 workflow 변경도 운영자의 새 검토/설치가 필요하며 서버의 기존 제어면이 자동 갱신됐다고 간주하지 않는다.
