# ADR0107: 기존 수집 계약을 유지하는 FX 복구와 화면 장애 격리

상태: 구현. 사용자 요청2026-10-25. 실제 서버 활성화/외부 수집 승인은 포함하지 않는다.

## 결정

기존 collector의 DB405/407 session lock·예약·API 상한·영속 receipt/archive·독립 collector-current와 UTC00:10 FX timer를 재사용한다. DB/schema·예산·주기·unit 실행 인자를 바꾸거나 별도 운영 도구를 중복 구현하지 않는다. 서버 적용/상태 이관/원자적 collector 포인터 전환·롤백은 [운영 복구 절차](../COLLECTOR_PRODUCTION_RECOVERY.md)에 보강한다.

FX는 전체 저장본 이전을 우선하며 `fx-store.mjs check`가 생성·claim·네트워크 없이 원본 hash/재파싱·원래 관측시각·7일 유효기간을 검사한다. 부재·빈 저장소·만료·손상을 고정 코드로 구분한다. 존재하는 snapshot의 archive 누락은 손상으로 거절한다. XML만 새 시각에 import하는 것은 기존 저장본 이전을 대신하지 않는다. 실제 ECB 수집은 기존 collect를 사용하며 별도 승인 전 실행하지 않는다.

공개 FX는 명시 필드 projection만 제공하고 0바이트/잘못된 JSON/만료는503이다. 임시 파일 fsync·rename의 기존 게시를 유지하고 부모 디렉터리 sync를 추가한다. rename 전 실패는 기존 공개본을 보존하고 rename 후 sync 실패는 게시 완료/내구성 미확인으로 구분한다. 만료본은 파일을 보관하지만 환산에 쓰지 않는다.

Overview는 기존 allSettled와 마지막 정상값 보존을 유지한다. production이 조회하지 않는 비공개 지리 자료의 null 검증을 건너뛴다. FX 요청 실패/만료를 공통 안내에 포함하고 USD 표시·KRW 미확보와 다른 정상 자료를 유지한다. 렌더링 예외는 API 실패와 별도 고정 안내를 사용하며 내부 오류를 공개하지 않는다. Preview 지리 경로는 유지한다.

## 검증과 한계

[작업 기록](../research/2026-10-25-collector-fx-recovery.md)에 오프라인 fixture·Chrome 렌더링과 실제 Fedora/운영 관측을 구분한다. 이번 작업은 외부 데이터 호출·서버 배포·수집기 활성화·운영 DB 변경0이며 0바이트 파일을 생성한 운영 원인은 UNKNOWN이다.
