# ADR0114: 자산 기술 프로필과 기술 검증 현황의 공통 Supabase 스냅샷

## 승인

2026-10-26 사용자가 두 화면의 DB 저장 제안에 “네 실제 반영해줘.”라고 승인했다. 기존 검토26개·기능 확인179개를 별도 private 스키마에 저장하고 기존 Supabase의 명시 migration/grant/import/reader 확인과 로컬 UI 연결을 수행한다. 앞선 작업 완료 후 push 지시는 이 후속 작업에도 유지한다. 새 공급자/체인 RPC·키·소스 취득·compiler·실제 권한 행사·Collector/FX·운영 웹 배포/서비스 변경은 포함하지 않는다.

## 공통 자료와 경계

`atlas_asset_review` v1의 불변 snapshot 한 행이 검토 프로필26개와 원래 feature 상태179개를 함께 보존한다. 자산 프로필은 상세, 기술 검증 현황은 같은 snapshot의 집계를 읽는다. 최초 snapshot ID는 `asset-source-review-20261025-v1`, 원래 검토일은2026-10-25다. 입력 ID·프로필 ID 집합26개·각 프로필의 feature ID 집합·중복/필드/크기/파일 SHA256·저장 canonical SHA256을 검증한다. 같은 snapshot ID/같은 내용은 무변경, 다른 내용은 거절한다. DB 입력 시각은 검토일과 분리하며, 다음 검토는 새 ID로 append한다. 전체 snapshot 단위로 commit하므로 두 화면에 부분 입력 자료가 섞이지 않는다.

기존 SOURCE_REVIEWED/RESEARCH_SCOPE_REVIEWED·기능별 상태·deploymentBinding UNKNOWN·관측/바인딩 연구 문구·근거 식별자/hash/취득 시각·코인/체인/주소/issuer/mint 문자열을 원형대로 보존한다. 기능 상태를 제품 PASS/지원 여부나 실제 권한 인증으로 승격하지 않는다. 화면은 기존 로컬 소스·문서 검토 범위를 유지하고 과거 읽기 실패 이력을 다시 전면에 노출하지 않는다. EVM의 숫자 chainId/주소 형식을 모든 체인에 강제하지 않는다.

`atlas_catalog`는 등록 deployment 정수 ID와 별도 기본정보/공식 출처를 보관한다. 연구 프로필26개와 등록 기본정보의 범위는 같지 않으므로 FK를 맞추기 위해 미등록 연구 대상을 기본정보로 추가하거나 데이터를 복제하지 않는다. 기존 source profile ID·coinId·chainId/networkKey·체인별 식별자를 그대로 사용하고, catalog/등록 자료는 변경하지 않는다. 두 데이터의 지원 범위가 같다고 주장하지 않는다.

입력은 기존 공개 발췌 `source-review-data.js`/`source-review-top10-data.js`를 오프라인에서 명시 snapshot으로 만든 것뿐이다. runtime/소스/보고서 원문·키·RPC/DB URL·비공개 snapshot을 저장하지 않는다. 128프로필/262144바이트 상한과 엄격한 필드/문자열 검증을 적용한다. SQL은 필수 최상위 키·ID·검토일·프로필 수/크기만 보장하고 세부 판정/문구의 진위를 인증하지 않는다.

## 권한과 검증

ADR0113의 새 소유 PG17 DDL pin·owner 사전검사·기존 writer SELECT/snapshot INSERT·reader SELECT·FORCE RLS/불변 trigger·구조/정책/column 유효 권한 검사 방식을 사용한다. 새 스키마를 공통 구조/API경계 허용목록에 명시한다. 초기화 commit 전 및 권한/입력 전후 PUBLIC/default ACL·API역할의 직접/SET ROLE/view/SECURITY DEFINER 경로를 검사하며 미검토 경로는 중단한다. 기존 SOURCE_REVIEWED definer pin을 재사용할 수 있고 Dashboard exposed schemas 자체는 별도 미확인으로 남긴다. 권한 실패 시 endpoint/키/CA 경로 변경·자동 fallback 없이 종료한다.

사설 PG17의 권한 거부·경합/중복/충돌·누락/변조·rollback·기존 스키마 불변, 모델/CLI/API/캐시, 실제 Chrome의 두 화면 공통 snapshot/요청1회/로딩/503·기존26프로필/179항목·판정 유지, npm run check를 통과한 후 기존 Supabase에 명시 적용한다. 과정과 실제 결과는 연구 기록/인계문에 남긴다.

## 웹 읽기와 캐시

`/asset-review-data.json`만 제공하는 읽기 API에서 검토 snapshot을 읽고, 두 화면은 공통 브라우저 Promise와 동일 snapshot ID를 사용한다. 브라우저는 정적 프로필 자료를 fallback으로 import하지 않는다. 기본 로컬 JSON 모드는 같은 검토 snapshot을 서버가 명시 제공하고, DB 모드는 reader로 읽는다. 로딩바/스켈레톤/aria-busy는 성공/실패 양쪽에서 정리한다. DB 실패는503/명시 오류이며 부분 자료나 정적 자료로 대체하지 않는다. 웹 요청/서버 시작으로 migration/import/수집을 실행하지 않는다.

서버는 검증된 성공 snapshot을 1시간 보존하고 동시 갱신을 한 Promise로 합친다. 새 성공값은 검증 후 교체하며 실패한 갱신으로 이전 cache 객체/시각을 덮어쓰지 않지만 만료된 값을 정상 응답으로 제공하지 않는다. 페이지는 처음 받은 snapshot을 공유하며 새로고침 시 새 요청을 만든다. 즉시 DB 새 자료가 필요하면 로컬 UI를 재시작한다. HTTP/브라우저 no-store와 다른 시장/시계열 캐시는 유지한다.

기존 두 화면은 이미 production 준비 코드에 포함돼 있으므로 필요한 새 모델/store/API도 기존 publication allowlist와 reader wiring에 연결한다. production에서는 reader가 없으면503이고 정적 fallback하지 않는다. 이것은 준비 코드의 일관성 유지이며 실제 운영 웹 배포·프로세스 재시작·Tunnel/DNS 변경은 수행하지 않는다. 별도 컨트랙트 메뉴/자료의 production 제외는 유지한다.
