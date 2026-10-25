# ADR0105: 개인 서버 운영 배포 준비

일자: 2026-10-25. 상태: 사용자 요청으로 구현·로컬 검증. 실제 서버 배포/공개는 미실행.

## 결정

기존 Preview/DB reader/collector를 재사용하며 별도 production CLI와 명시 publication policy를 둔다. loopback4173·공개 Host/HTTPS Origin 허용 목록·Forwarded 비신뢰·생존 health와 commit/DB 배포 확인을 사용한다. 운영 shell과 route 허용 목록에서 mock·private Evidence·저장 지리 연구를 제외하고 검토된 정적 소스 발췌·DB projection만 제공한다. 개발 기능과 원본 판정은 유지한다.

production의 reader credential은 별도 파일/systemd credential이며 writer/admin/공급자 키를 받지 않는다. 원격 TLS 검증과 기존 역할/스키마 읽기를 유지하며 모든 atlas_* schema의 쓰기·소유·상속/PUBLIC·컬럼/sequence·함수 경로를 확인한다. 직접 일반 호출이 불가능한 security-invoker trigger 반환형만 좁게 구분하고 다른 callable 경로는 거절한다. 세션 read-only와 웹 전체2연결/8대기 제한을 추가한다. 이는 DB GRANT/스키마 변경을 수행하지 않는다.

웹/수집/터널 계정·환경·영속 경로를 분리한다. 기존 worker 예약·상한·실패/복구·FX 시각을 바꾸지 않는다. FX 성공 후 같은 저장 projection만 공개 파일로 게시한다. SHA release/current와 collector-current는 분리하고 웹 배포/롤백은 웹 서비스만 재시작한다. 실제 Tunnel은 Dashboard 관리와 token-file/systemd credential을 사용한다. GitHub Actions는 기존 캐시가 준비된 별도 runner의 수동 dispatch로만 준비한다.

배포 경로·명령·공개 범위·운영 전 미검증은 [운영 안내](../PRODUCTION_DEPLOYMENT.md), 실패/수정·근거·재현·검증 결과는 [연구 기록](../research/2026-10-25-production-readiness.md)을 따른다. Fedora ARM64/systemd/실제 Tunnel/collector 전환/Actions 실행을 로컬 검사 성공으로 대신하지 않는다.
