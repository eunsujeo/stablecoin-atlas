# ADR0063 — Allium 표본 설치와 API 권한 경계 관측

## 범위와 설치 결과

[ADR0062](0062-offline-allium-supply-storage.md)의 기존 비공개 DB 설치를 완료했다. `atlas_supply`만 추가하고 기존 최소 reader/writer에 해당 schema 접근을 부여했다. 검토된 Ethereum USDC/USDT 2026-10-16~22 원문14행을 입력하고 재생0·수량/null/원래 queried_at/hash 대조14행을 확인했다. 최신 필터와 미확보 날짜도 CLI로 검증했다. 새 공급자 자료 조회·UI·수집기 변경은0이다.

설치 전후 기존5개 schema의 구조·owner·ACL·정책 해시가 같았다. 고정된 기존 시장 표본180건과 기존 전송량60건의 값/연결 레코드도 해시로 대조했다. 시장 표본은 최초14개 import manifest에 연결된 legacy observation과 원래 observation의 범위이며 전체 운영 이력의 감사로 확대하지 않는다. 원문 archive의 바이트/hash와600권한을 확인했다. 실제 역할명·접속 문자열·원문·DB 검증 receipt는 비공개 `.state`에만 둔다.

## Dashboard 설정과 DB 권한의 구분

실제 `authenticator`/DB/global의 영속 `pgrst.db_schemas` override는 확보되지 않았다. 관리 API 자격이나 Dashboard 설정 원문도 없으므로 **Dashboard exposed schemas는 UNKNOWN**이다. 세션 `current_setting`이나 override 부재를 비노출 설정의 증거로 바꾸지 않는다. 공식 [Supabase 설명](https://supabase.com/kb/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema)은 role override와 Dashboard 설정을 구분한다. 전역/API 설정은 변경하지 않았다.

별도로 실제 DB의 `anon`/`authenticated`/`authenticator`/`service_role`4개 역할에 대해 schema/table/column/function 유효 권한, PUBLIC/default ACL과 owner/superuser 및 private owner/reader/writer로의 상속·SET ROLE 경로를 검사했다. 정상적인 authenticator→API 역할 전환을 금지하지 않는다. BYPASSRLS 역할1개가 있음을 보존하며 FORCE RLS만으로 이를 차단했다고 주장하지 않는다. 접근 가능한 view의 공급량 관계 의존성도 검사한다. 이 검사는 현재 DB 권한·검토 소스에 대한 관측이며 실제 HTTP 요청의 비노출 인증이나 미래의 권한 변경 보장은 아니다.

## SECURITY DEFINER 소스 검토와 변경 감지

처음에는 접근 가능한 privileged SECURITY DEFINER가 있으면 입력을 차단했다. 이 경로에서 빈 schema 설치 후 grant/import 전에 중단했고 실패 기록을 보존했다. 실제 대상은 Supabase Vault0.3.1의 `vault.create_secret`/`vault.update_secret` 두 함수였다. 이 기능의 존재를 취약점으로 판정하지 않는다.

함수 정의와 메타데이터만 읽어 [공식 Vault SQL](https://github.com/supabase/vault/blob/main/sql/supabase_vault--0.3.0.sql)과 대조했다. 현재 정의는 빈 search_path, 고정된 Vault 관계와 암호 루틴을 사용하며 임의 관계명/동적 SQL을 받지 않는다. view·열/default·index 정의와 Vault의 native 암호 루틴3개·extension version 및 trigger0을 확인했다. Vault 데이터·비밀·키는 조회하거나 생성/수정하지 않았다. native library의 바이너리 무결성이나 Vault 전반의 안전성을 새로 인증한 것은 아니다.

`boundary`는 기본적으로 미검토 definer를 차단한다. 사람이 검토한 `SOURCE_REVIEWED` record를 명시할 때만 정확한 namespace/name/identity arguments·전체 함수 정의 SHA와 schema fingerprint v2를 대조한다. namespace나 함수 이름만으로 예외를 두지 않는다. fingerprint는 함수·view·열/default·index·constraint·trigger·**rewrite rule의 정의/활성 상태/소유 관계**·정책·owner/ACL·extension 메타데이터를 포함한다. rule이 schema 밖의 비-system 함수/객체에 의존하면 거부한다. 이 source pin은 SQL 안전성 자동 분석기가 아니며 검토한 외부 의존성과 신뢰 범위를 대신 인증하지 않는다. 이번 Vault 정의의 schema 밖 호출은 기본 PostgreSQL 함수이며 native 루틴은 기존 관리형 extension 신뢰 범위다.

PG17 Fixture에서 column/PUBLIC/default ACL, NOINHERIT를 포함한 private-role 경로, view·미검토 definer, 본문·의존 정의 변경, CREATE RULE·DISABLE/ENABLE RULE, schema 밖 rule 함수 의존성의 거부를 확인했다. 원상복구 때 정상 검증도 확인했다. hash 생성과 대조는 동일한 READ ONLY transaction/search_path 문맥에서 수행한다.

## 검토와 실행 경계

재개 검토 `7f711110c2ca4fc586dd47d7c59e8246`의 proceed, Dashboard UNKNOWN을 보존하는 조건부 검토 `d32f308e8f064f51bb8e728d09613c99`의 proceed를 받았다. 소스 pin 검토 `2f0724be7997422189b9b5766fd518ea`는 rewrite rule 누락을 지적해 revise_plan을 반환했다. 해당 누락을 보강하고 요구한 PG 시험·전체 check를 통과한 뒤 v2 fingerprint와 실제 boundary를 다시 검사했다. 검토 판단을 사용자 권한 확대나 모델 자동 변경 승인으로 취급하지 않았다.

실제 설치에서는 입력 전과 grant 후 경계를 확인하고 검토된 두 definer만 정확히 일치할 때14행을 입력했다. 실패했던 이전 기록·원문과 새 검증 receipt를 보존한다. 조사 SQL 실행의 계정 과금 조건은 [ADR0061](0061-bounded-allium-survey-executor.md)대로 별도이며, 기본 UI·보조 연결·일별 수집은 다음 작업이다.
