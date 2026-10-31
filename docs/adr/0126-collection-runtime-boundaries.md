# ADR 0126 — 수집 실행 검증과 설치 보안 점검의 분리

2026-10-31. 사용자가 모든 수집의 정상화를 요청했고, 추가 확인 없이 권장하는 검증 분리를 진행하도록 명시했다.

Arkham DB 수집은 HTTP 7건 모두 성공해도 누적 JSON 미리보기가 2MiB를 넘으면 DB 입력을 하지 못했다. 운영 저장본으로 previous 2,092,053bytes / next 2,101,780bytes / limit 2,097,152를 오프라인 재현했다. DB 모드의 JSON 미리보기만 최신 배치로 게시한다. 기존 로컬 파일 모드의 누적 동작은 유지한다. 모든 원본 projection·기존 snapshot 파일과 DB 이력·실패/소비 원장은 삭제하거나 덮어쓰지 않는다. 기존 레지스트리 식별자 불변 검사와 JSON 제한을 유지한다.

네트워크 활동의 일별 claim/import는 다른 공개 스키마 전체의 SECURITY DEFINER 검토 해시에 의존하지 않는다. reviewed-definers 파일은 init/grant/upgrade/boundary의 설치·권한 변경 점검에 사용한다. 설치·권한 변경 명령의 보수적인 간접 공개 경로 검사는 유지한다. 데이터 수집 경로에서는 특별 권한 함수·공개 스키마 전체의 고정 검토 파일을 요구하지 않는다. 기존 6필드 config도 읽되 두 review 필드는 런타임에서 사용하지 않으며 새 구성은 authorization/env/state 4필드로 가능하다.

런타임은 기존 비관리자 writer·최소 권한·RLS·테이블/trigger 구조·직접 공개 역할 접근 차단과 API 역할의 owner/private-role 도달 차단을 계속 검사한다. 인증·대상 18개·기존 30일 승인·일별 18GET/36MiB/420초·무재시도·DB의 일별 불변 claim·원문/hash·불변 snapshot은 유지한다. check는 동일 writer 검증을 읽기 전용 transaction에서 실행하고 외부 요청/DB 선점은 하지 않는다.

이 변경이 보장하는 것은 수집 경로의 권한/구조 검증이다. 공개 역할이 호출할 수 있는 임의 SECURITY DEFINER 함수의 의미 분석과 전체 공개 DB 노출 부재를 매 수집마다 보장한다고 표시하지 않는다. 이 검토는 별도 관리자 boundary 점검 범위다. 운영 DB DDL/GRANT/역할·비밀·provider endpoint·기간/예산을 바꾸지 않는다.
