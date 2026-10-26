# ADR0113: 컨트랙트 검토 요약의 Supabase 저장과 로컬 웹 읽기

## 사용자 승인과 범위

2026-10-26 사용자가 최신 Multicall3 검토 요약의 로컬 웹 반영에 동의하고 DB 반영을 요청했으며, 대상 확인에 **“supabase 반영까지야.”**라고 답했다. 기존 Supabase의 전용 비공개 스키마 생성·기존 writer/reader 권한 추가·검토 요약 입력·reader 재조회와 로컬 화면 연결을 진행한다. 앞선 운영 DB 변경 제외에서 이 저장 경로만 예외다. 운영 웹 배포·Mac mini 서비스·Collector/FX·기존 스키마/수집 주기/판정·새 체인 RPC/공급자 API/키는 변경하지 않는다.

## 저장과 판정

`atlas_contract_review` v1의 `schema_version`·`access_grant`·`report`를 명시 초기화한다. 정본 DDL 구조 hash는 새 소유 loopback PG17 Fixture에서 고정한다. 최초 실패 요약과 v3 고정 블록 관측 요약을 별도 ID의 불변 행으로 저장하며 웹은 최신 관측부터 표시한다. 원래 관측 시각, 분석 기준일과 DB 입력 시각을 분리한다. 같은 ID/동일 payload는 무변경, 같은 ID/다른 payload는 전체 입력 transaction을 rollback한다. 입력 전체 SHA256을 CLI에서 명시하고 연결 전에 검증하며 저장 payload의 canonical SHA256을 재조회 때 검증한다. 테이블/필드별 제한과 최대32보고서/128KiB를 적용한다.

저장은 검토된 `web/contract-review-reviewed.js`의 공개 발췌만 대상으로 한다. 비공개 snapshot/report·RPC URL·DB URL·키·runtime 원문·소스 원문은 입력하지 않는다. 엄격한 필드 허용목록과 문자열 검사를 사용한다. 원문 자동 발견/추출·소비 재실행·웹 요청의 import는 없다. JSON 문구는 저장·렌더링 전에 검증하고 DOM은 textContent로 렌더링한다. DB CHECK는 필수 최상위 키·핵심 식별자/시각 일치·UNKNOWN·형식/크기만 보장하며 전체 내용의 검토 적절성/진위를 SQL로 인증하지 않는다. 세부 구조/판정 분리 검증은 importer/reader에서 수행한다. writer 자격은 신뢰된 수동 importer에만 사용한다.

전체 UNKNOWN과 고정 블록 artifact equality PASS·runtime OBSERVED를 분리한다. compiler NOT_RUN·소스 진위 UNKNOWN·실제 Proxy/권한 NOT_TESTED·비용 UNKNOWN·최초 실패 UNKNOWN/v2 TLS_FAILURE·사설 개별 PASS를 보존한다. 최신 관측은 2026-10-26의 고정 블록 근거이며 현재 체인 상태 인증이 아니다.

## 권한과 실행

기존 관리자 설정은 명시 migration/grant에만 사용한다. 기존 시장 스키마 owner/권한 검증을 요구하고 기존 writer에는 SELECT와 report INSERT, reader에는 SELECT만 부여한다. UPDATE/DELETE/TRUNCATE/DDL·함수 직접 실행·grant 수정은 허용하지 않는다. FORCE RLS·역할별 정책·불변 trigger를 검증하며 현재 구조/정책/유효 table/column 권한이 다르면 중단한다. 운영 웹의 reader 검사도 그대로 통과해야 한다.

각 초기화/권한 추가/입력 transaction에 기존 API 경계 검증기를 연결해 PUBLIC/default ACL·anon/authenticated/authenticator/service_role의 직접/SET ROLE 경로·view·SECURITY DEFINER 우회를 확인한다. 초기화는 새 스키마 생성 후 commit 전에 검사한다. 미검토 definer나 hash 변화는 중단하며 fallback/임의 allowlist 확대를 하지 않는다. 기존 SOURCE_REVIEWED definer의 정의/스키마 closure pin을 사용할 수 있다. 이 DB 관측만으로 Dashboard의 exposed schemas를 확인했다고 주장하지 않는다.

로컬 `npm run ui -- --database --database-env ...reader.env`에서 `/contract-review-data.json`을 기존 reader 설정으로 읽는다. 기본 로컬 모드는 같은 검토 요약을 고정 자료에서 제공한다. DB 오류는503/명시 오류 화면이며 정적 자료로 자동 전환하지 않는다. 읽기 요청/서버 시작은 DDL/import/분석을 실행하지 않는다. production 메뉴·화면·전용 자산/API는 계속 제외한다.

## 적용 순서와 복구

사설 PG17의 권한 거부·중복/경합·충돌 rollback·누락 payload·변조 hash·읽기/API/브라우저 및 `npm run check`를 검증한 뒤 실제 Supabase에 명시 init → 기존 두 역할 grant → 고정 입력 import → 중복 무변경 확인 → reader/API/브라우저 재조회를 수행한다. TLS 검증과 기존 env 파일을 사용한다. DB 연결 오류/검증 실패 시 새 endpoint/키/CA 경로로 자동 전환하지 않는다. 실제 실행 기록은 별도 연구/인계에 남긴다.

이 migration은 기존 데이터의 down migration을 수행하지 않는다. 실패한 transaction은 rollback하며 이미 commit한 단계는 기록해 보존한다. import 응답 유실 시 고정 ID/hash의 reader 재조회로 상태를 확인한 뒤 같은 입력만 명시 재입력할 수 있다. 같은 ID의 수정을 요구하면 기존 행을 삭제/수정하지 않고 새 검토 ID를 만든다. UI 복구는 DB 모드 연결을 해제하거나 마지막 검증 SHA로 되돌리되 저장 행은 보존한다.

## 후속 사용자 표시 정정 (2026-10-26)

사용자가 이전 이력 제거와 로컬 검토 범위를 재확인했다. 웹 표시 projection은 chainId+정규화 주소별 최신 관측 한 건만 선택하며, 동률은 완료 시각/ID로 결정한다. DB의 불변 행/근거 상태를 수정하지 않는다. 저장 소스 조건 검토와 사설 시험의 개별 완료를 표시하고 전체 UNKNOWN을 작업 완료의 상태 배지로 사용하지 않는다. 원본 compiler NOT_RUN·소스 진위 UNKNOWN·실제 Proxy/권한 NOT_TESTED는 근거·검토 범위에 유지하고 추가 실행을 새 필수조건으로 요구하지 않는다. 이전 실패 이력은 화면에 표시하지 않는다.

## 로딩과 요약 캐시 (후속 사용자 요청)

컨트랙트 조회에는 기존 beginLoading/skeleton과 indeterminate progress를 사용하고 성공/오류 양쪽에서 aria-busy와 로딩바를 정리한다. 진행률 숫자를 추정하지 않는다. 변경이 드문 저장 검토 요약의 서버 성공 캐시는 1시간이며 동시 요청은 한 번의 DB 읽기로 합친다. 만료 시 다음 요청에서 재조회하고 실패 시 만료 자료나 정적 요약으로 자동 전환하지 않는다. 서버 재시작 시 캐시는 비워진다. 브라우저/HTTP는 no-store를 유지해 사용자별 오래된 브라우저 캐시와 서버 캐시를 중첩하지 않는다. 변경 반영은 최대1시간 지연될 수 있고, 즉시 반영이 필요하면 로컬 미리보기를 재시작한다. 다른 시장/시계열 캐시·DB 스키마·Collector는 변경하지 않는다.
