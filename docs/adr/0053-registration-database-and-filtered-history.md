# ADR0053: 확장 등록 DB와 코인·지표별 제한 조회

2026-10-22 · 사용자는 ADR0051 이후 다음 구현과 완료 후 commit/push를 승인했다.

ADR0050 §6의 기존 core/history 확장 순서를 이번 단계에서는 별도 `atlas_registration` v1으로 대체한다. 실행 중인 기존3코인 수집기/reader가 registry와 schema fingerprint를 엄격히 검사하므로, 기존 DB migration·metadata·history001~004를 바꾸지 않고 새 경로를 먼저 검증한다. 기존 구조 hash 계산의 namespace 허용 목록만 확장한다. 이 영역의 설치는 기존 대시보드 활성화나 기술 검증 지원을 뜻하지 않는다.

owner만 원문 catalogue와 검토 metadata를 재검증해 불변 metadata revision·측정 계약과 일자별 선정 snapshot을 설치한다. 입력 planHash로 쓰기를 허용하지 않는다. metadata와 legacy registry hash·실제 DB 식별자·공급자 원문 hash·선정의 REQUEST 시각을 고정한다. 동일 metadata revision의 내용 변경과 과거 revision의 신규 설치를 거부한다. 같은 원문/선정일 재처리는 최초 저장 시각과 ID를 보존한다. 코인별 REVIEW_REQUIRED/미확보/상품 제한은 그대로 남는다.

owner의 상세 원문 수입은 provider id/symbol/gecko/peg·현재 상품/계약을 다시 검사하며 선정된 최대10개 네트워크만 사용한다. REVIEW_REQUIRED 선정은 수입하지 않는다. catalogue의 USD 가치는 순위 기준이며 일별 circulating/minted는 token 수량이다. JPY peg를 별도로 보존하고 minted를 당일 발행량으로 바꾸지 않는다. CLI는 내용 주소 기반 비공개 raw archive를 DB 게시 전에 보존하며 외부 HTTP를 실행하지 않는다.

daily_value는 metadata/측정 계약·코인·네트워크·UTCday·정규 수량으로 내용을 해시하여 재사용한다. coverage는 각 source의 정확한 day→value ID를 gzip 압축해 불변 보관한다. 동일 coverage도 재사용한다. daily_source는 raw hash·mapper·선정/metadata revision·구간·원래 fetchedAt·coverage hash를 고정한다. 최신 source는 selection+coin+metric 안에서 fetchedAt/ID 순으로 결정하므로 별도 가변 latest pointer가 없다. 과거 source 조회는 해당 coverage의 값만 재구성하며 새 정정값과 섞지 않는다. 원래 A의 단순 재수입은 시각을 갱신하지 않으며 새 원문에 의한 A→B→A는 source 이력과 기존 값 재사용으로 남긴다. 부분/미확보 자료에서 이전 네트워크 값을 이어 붙이거나0으로 바꾸지 않는다.

reader는 별도 명시 grant를 받은 기존 reader 역할만 사용한다. FORCE RLS·owner policy·SELECT policy, 실효 table/column/function 권한, PUBLIC/Supabase 공개 역할·REST schema 비노출와 구조/정책 hash를 검증한다. writer에는 새 권한을 주지 않는다. 등록 transaction의 advisory key는 `(18471234,406)`이며 기존 수집기의 session key405와 분리한다. 기존 worker lock을 유지한 채 설치/수입/조회하는 PG 회귀시험을 포함한다. 필터는 selection ID+coin+quantity metric+유효 날짜 범위가 필수이며 최대10×366점, 2MiB 응답, 1MiB 압축 blob/2MiB 압축 해제, SQL/transaction timeout으로 제한한다. repeatable-read read-only transaction에서 source/metadata/value를 함께 확인한다.

scope 변경마다 coverage hash 참조가 저장되므로 daily_value 중복 제거만으로 전체 DB 증가가 사라지지는 않는다. 실제 source/coverage/value/index 크기를 측정하고 보관·삭제/롤업 정책은 다음 배포 단계에서 정한다. 현재 runtime writer·정기 작업·UI는 새 경로로 전환하지 않으며, 다음은 기존 코인 최대10 네트워크 백필과 최소 권한 자동수집·화면 연결이다.
