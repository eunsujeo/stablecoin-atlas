# ADR0121: 환율의 공통 Supabase 저장과 reader 연결

2026-10-30 사용자 승인. 기존 저장 환율 이관·별도 private 스키마·기존 writer/reader 권한 적용과 개발/운영 웹 코드 변경을 허용한다. 새 ECB 요청·수집 주기 변경·운영 배포는 수행하지 않는다.

DB 모드에서도 로컬 `.state/fx-store`를 읽던 의존성을 제거한다. `atlas_fx`의 별도 snapshot은 검증한 XML 원문 바이트, 십진 문자열 projection, 기준일, 원래 fetchedAt/importedAt, payload hash를 불변 저장한다. DB 저장 시각은 별도 stored_at이다. 원래 관측 시각으로 ID를 만들며 같은 ID의 다른 자료는 충돌로 거절한다. 동일 입력은 무삽입이고 snapshot별 transaction과 advisory lock으로 동시 입력과 실패 rollback을 보호한다. 기존 다른 스키마의 자료/구조는 변경하지 않는다.

정본 DDL은 새 소유 PG17에서 구조 hash를 pin한다. PUBLIC 및 Supabase API 역할을 차단하고 FORCE RLS와 기존 역할 검증을 사용한다. 기존 writer는 snapshot INSERT/SELECT, reader는 SELECT만 갖는다. 원문 XML은 private DB에 보관하며 웹은 기존 projection 필드만 응답한다. 기존 definer 검토 hash와 접근 경계 검사를 재사용한다.

개발 DB 모드와 production 웹은 동일 DB reader를 사용한다. 기준일 내림차순, 원래 관측 시각 내림차순으로 선택하므로 과거 자료의 늦은 이관이 최신 자료를 대체하지 않는다. DB 원문을 재파싱하고 hash/구조/권한을 검증한다. 손상·부재·미래 관측 시각·7일 초과 만료는 고정 FX_UNAVAILABLE/503이며 파일 fallback은 없다. 동시 진행 요청만 병합하고 후속 요청은 DB와 freshness를 재확인한다. JSON 모드의 오프라인 파일 읽기는 유지한다.

명시 `fx:db import`는 저장소의 원래 snapshot을 검사하고 만료 자료도 시각 변경 없이 이관한다. `stored`는 만료 자료의 대조용이고 `read`/웹의 freshness 검사와 구분한다. 각 snapshot은 원자적이며 여러 snapshot의 import 중 후속 실패는 선행 완료 snapshot을 취소하지 않는다. 재실행은 같은 자료를 중복 저장하지 않는다.

기존 FX collect/claim/receipt/원문과 service/timer는 보존한다. 이 변경은 새 수집과 운영 writer 전환을 시작하지 않는다. 기존 파일 게시 drop-in은 DB 갱신을 실행하지 않으므로 향후 운영 적용에는 이미 수집한 저장본의 명시 DB import 연결이 필요하다. 코드의 production reader 전환과 실제 서버의 적용 완료를 구분한다. 기존 web.json의 fxFile은 설정 호환 목적으로만 허용하며 읽지 않는다. 자동 배포 preflight는 공통 DB FX reader로 유효성을 확인한다.

실행·검증·실제 적용 결과는 [연구 기록](../research/2026-10-30-shared-fx-database.md)을 따른다.
