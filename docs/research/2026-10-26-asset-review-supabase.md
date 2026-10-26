# 자산 프로필·기술 검증 현황 Supabase 연결 기록

## 승인과 입력

사용자가 두 화면을 DB로 연결하는 제안에 “네 실제 반영해줘.”라고 승인했다. [ADR0114](../adr/0114-asset-review-supabase-snapshot.md)·[안내](../ASSET_REVIEW_STORAGE.md)·AGENTS.md에 범위를 기록했다. 기존 공개 발췌26프로필/179기능을 원래2026-10-25 검토일과 source/feature 상태·주소·scope·근거 식별자/hash·취득 시각 그대로 보존한다. 기존 catalog 기본정보/지원/토큰 판정을 대체하지 않는다.

입력 snapshot `asset-source-review-20261025-v1`의 명시 pretty JSON SHA256은 `eabb4538ee1ee0e9a45701501de1bf46887f5ec0be1a606e9bddec07c952c234`, canonical SHA256은 `df6a2ed05933c6828af28eaedd84a992a5c99e204481d50c613ba43f5bd752f9`다. 새 소유 PG17에서 정본 DDL 구조 hash `f007ae3a3f19a603b912e04d4269b4c45280c28f37e1c834b19f1001f0b23bda`를 고정했다. SQL CHECK는 snapshot 필수키/ID/검토일/수/크기, 모델/importer는 exact 프로필/feature ID 집합·세부 필드/상태·hash를 검증한다.

## 구현 경로

기존 contract-review 저장 경계/CLI/reader 패턴을 새 `atlas_asset_review` 스키마에 격리 적용했다. snapshot 한 행으로26개를 원자적으로 입력하고 같은 ID/동일 내용은 무변경, 다른 내용은 거절한다. 새 버전은 새 ID를 사용한다. 기존 RLS/정책/권한 검사와 공통 API경계의 새 namespace 허용목록을 적용했다. 현재 catalog는 정수 deployment ID를 갖는 등록 기본정보이며 연구26개와 범위가 같지 않아 FK를 맞추려고 미등록 연구 대상을 추가/복제하지 않았다. 기존 profile/coin/chain/network/주소 식별자를 그대로 사용한다.

클라이언트는 정적 profile import 대신 공통 asset-review-store의 한 Promise를 읽는다. 자산 상세와 전체 현황 집계는 같은 snapshot ID/내용을 사용한다. 기존 vocabulary/helpers는 순수 모델로 옮기고 이전 data 모듈에서 호환 re-export했다. 기술 현황과 저장 읽기 등급의 비동기 도착 순서가 달라도 동작하도록 등급 DOM 갱신을 보호했다. 두 영역의 로딩바/스켈레톤/aria-busy·503 오류를 연결하고 성공 snapshot의 1시간 서버 캐시·동시 요청 합치기를 적용했다. 정적 문서 fallback은 없다.

이미 production 준비 코드에 있던 두 화면의 새 모델/store/API 경로와 reader wiring을 맞췄다. 실제 운영 웹/서비스/Tunnel/DNS 배포는 하지 않는다. 컨트랙트 메뉴의 production 제외는 유지한다. 기존 CLI·catalog·Collector/FX/스케줄·원본·토큰 판정과 외부 호출 소비는 변경하지 않는다.

Local Router 추천은 제공돼 재호출하지 않았다. 구조/권한 변경에 대해 Lead `8b9f959d3556434a8fa4a02fa2c04f2b`를 요청해 proceed/검증 조건을 회수했다. exact 입력·공통 snapshot·최소권한·경계·시험·판정 보존을 반영했다. Lead 판단은 운영 변경의 추가 승인으로 사용하지 않았다. 하위 Agent/임시 pane은 없다.

## 실패·원인·수정

- 첫 모델 연결에서 feature ID를 소문자 전용으로 검증해 기존 transferFrom/zeroReset을 거절했다. 원본 ID는 보존하고 feature ID 검증에 camelCase를 허용했다.
- Host 거부 시험의 Node fetch가 Host override를 그대로 송신하지 않아 정상 Host의200을 반환했다. native HTTP request로 바꿔 실제 잘못된 Host의403을 검증했다. 서버 경계 완화는 없다.
- Chrome 시험 보강 중 selector 인용부호 구문 오류를 고쳤다. 이어 문서 전체의 tab/tabpanel을 찾는 기존 시험이 비동기로 먼저 로딩된 숨은 컨트랙트 탭까지 집계해 실패했다. 시험 selector를 자산 프로필 영역에 한정해 기존26프로필을 검증했다. 제품의 탭/판정을 임의 변경하지 않았다.

위 실패는 구현/로컬 시험 단계다. 의도한 거부/rollback Fixture와 실제 외부 실패로 혼동하지 않는다. 외부 공급자/체인 조회는0이다.

## 사설·화면 검증

- `node .state/agent-logs/asset-review-schema-pin.mjs`: rc0, 새 소유 loopback PG17 DDL pin 산출 후 소유 container/network 정리. `.state/agent-logs/asset-review-schema-pin.log`.
- `node --test tests/asset-review-db.test.mjs web/source-review.test.mjs tests/postgres/asset-review.test.mjs`: rc0 tests8/pass8/fail0. 기존26 ID/179 feature 내용·상태 보존, 누락/중복/변조/hash/필드·CLI 연결 전 거부·TTL3599999/3600000·API GET/HEAD/Host/메서드/오류·사설 PG의 경합/중복/충돌/주입 rollback·reader 쓰기/DDL·writer 변경/함수·PUBLIC/API/SET ROLE/default ACL·trigger/column 권한/내용 변조 거부·기존 스키마 구조를 확인했다. `.state/agent-logs/asset-review-targeted-final.log`.
- `node --test tests/postgres/asset-review.test.mjs tests/production*.test.mjs`: rc0 tests24/pass24/fail0. 기존 production 경계/reader·배포 준비와 공개 browser import 허용목록을 확인했다. `.state/agent-logs/asset-review-pg-production.log`.
- `node .state/agent-logs/asset-review-browser-local.mjs`: rc0. 실제 Chrome에서 두 영역 로딩 중 첫 응답 보류·공통 snapshot ID/요청1회·26개/179항목·8/26 소스 확인 집계·검색/체인/탭/필터/근거 링크·다크/라이트/모바일·기존 읽기 등급/판정 분리·evidence 장애 독립성·asset API503 오류와 로딩 정리·정적 profile fallback import0을 확인했다. JS 오류0/외부 요청0. 정적 HTML만으로 동적 화면 성공을 주장하지 않는다. `.state/agent-logs/asset-review-browser-local.log`.

실제 Supabase 적용/reader 결과와 전체 검사는 완료 후 아래와 인계문에 기록한다.

## 실제 Supabase 적용

2026-10-26T10:04:19.380Z~10:04:25.704Z에 기존 admin/writer/reader 설정과 인증서 검증 TLS로 명시 적용했다. 동일 대상/기존 역할·새 스키마 부재·기존 SOURCE_REVIEWED definer2개의 정의/closure pin을 확인한 뒤 진행했다. 실제 적용 실패0·자동 재시도/endpoint·키·CA 경로 변경0이다.

| 항목 | 실제 결과 |
| --- | --- |
| 전용 저장 | atlas_asset_review v1 INITIALIZED |
| 기존 역할 | writer SELECT/snapshot INSERT, reader SELECT GRANTED |
| 입력 | 불변 snapshot1개에26프로필/179기능 IMPORTED |
| 동일 입력 | UNCHANGED / 추가0 |
| reader 대조 | snapshot ID·원래 검토일2026-10-25·26개 ID·179기능 및 전체 canonical 내용 일치 |
| API 경계 | 입력 전후 VERIFIED_EFFECTIVE_ACCESS_DENIED, API역할4/우회RLS역할1/검토definer2 |
| 기존 reader | READER_READY |
| 기존 구조 | market/scheduler/catalog/history/registration/activity/supply/survey/contract_review 9스키마 구조 hash 불변 |

Dashboard exposed schemas 자체는 별도 확인하지 않아 UNKNOWN을 유지한다. 위 경계 검사는 DB의 유효 직접/SET ROLE/view/definer/default ACL 경로 관측이다. 원본 소스/runtime/report·키·RPC/DB URL은 저장/게시하지 않았다. 실제 운영 웹 배포와 Collector/FX/수집 주기·기존 데이터에 대한 UPDATE/DELETE는 수행하지 않았다.

비공개 `.state/asset-review-supabase-20261026/`0700의 `reviewed-input.json`/`receipt.private.json`0600에 입력/11단계 결과를 보존했다. receipt SHA256은 `d7c487b1b6a2d928d6af892f0d34c17cb094d0bc975159c73b61e28b10f01bfd`다. 실행 스크립트/로그는 `.state/agent-logs/asset-review-supabase-apply.{mjs,log}`다. 완료 디렉터리를 재사용하지 않으므로 해당 스크립트를 다시 실행하지 않는다.

## 최종 실제 화면과 인계

- `npm run check > .state/agent-logs/asset-review-check.log 2>&1`: rc0 tests660/pass660/fail0/cancelled0/skipped0.
- 실제 Supabase reader의 로컬 `/asset-review-data.json` GET200/HEAD200·전체 자료 일치 확인. `.state/agent-logs/asset-review-supabase-http.json`.
- `node tools/source-review-browser-check.mjs http://127.0.0.1:4173`: rc0. 실제 reader 화면의 같은 snapshot/요청1회·26프로필/179기능/8/26 집계·로딩/오류·검색/탭/필터/기존 판정·테마/모바일을 확인했다. JS 오류0/브라우저 외부 요청0. `.state/agent-logs/asset-review-browser-db.log`. 서버의 승인된 native Supabase SQL 읽기는 브라우저 외부 요청0과 구분한다.
- `git diff --check`: rc0.

기존 소유 Node PID33076의 정확한 명령/4173 listener를 확인해 정상 종료하고 같은 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`로 재시작했다. 현재 Node PID58493/exec session87252를 사용자 검토용으로 유지한다. `.state/agent-logs/asset-review-preview.log`. 자산 프로필 `http://127.0.0.1:4173/#assets`, 기술 현황 `http://127.0.0.1:4173/#overview`에서 확인할 수 있다.

재확인은 [CLI/로컬 읽기 안내](../ASSET_REVIEW_STORAGE.md)를 따른다. 초기화/권한/입력을 자동 반복하지 않고 새 source 취득/원문 게시/운영 배포로 이어가지 않는다. 사용자 완료 후 commit/push 지시에 따라 이번 작업만 main에 커밋하고 origin/main으로 push한다. 실제 Git 결과는 `.state/agent-logs/asset-review-git.json` 및 최종 응답을 확인한다. [인계문](../handoff/2026-10-26-asset-review-supabase.md).
