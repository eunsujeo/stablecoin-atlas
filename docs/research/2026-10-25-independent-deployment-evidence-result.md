# 독립 배포 근거 취득 A 결과

사용자가 [계획 A](2026-10-25-independent-deployment-evidence-plan.md)의 실행을 승인했다. **첫 GET이 HTTP403으로 실패해 전체 실행을 종료했다.** 최대8건 중 시도1·정상 본문 취득0·나머지7건 NOT_TESTED다. 재시도·브라우저 전환·추가 URL·RPC·compiler·immutable 제출·runtime 대조는0이다. 이 소비는 종료됐으며 남은 예산을 재실행에 사용하지 않는다.

요청 대상은 계획 순서1의 JPYC 공식 사이트다. 시작 UTC `2026-10-25T01:42:35.923554+00:00`, 종료 `2026-10-25T01:42:36.194760+00:00`이다. HTTP403은 취득 거절이며 자료 부재나 발행사 build 부재의 증명이 아니다. 독립 자료 미확보·비용 UNKNOWN·기존 배포 연결 UNKNOWN5/5 및 추가체인 포함8/8을 유지한다. 이번에 공식 주소를 재확인하지 못했다.

비공개 `.state/independent-deployment-evidence-20261025-a/`에 고정 plan·최초 송신 전 wx 소비·intent·정제 receipt·전체 결과·검증을 보존했다(0700/0600). 오류 본문·인증정보를 저장하거나 게시하지 않았다. 기존134파일과 직전 참조표 evidence까지135파일의 SHA256이 실행 전후 같다. `.state/acquire-independent-deployment-evidence-20261025.py`는 이 단발 실행의 로컬 wrapper이며 제품 자동 수집 기능을 추가하지 않았다.

로컬 가상 transport 검증11건은 모두 통과했다. 고정8요청 순서·주소/조직 gate로 explorer3건 건너뛰기·기존 root 재사용 거절·HTTP403/redirect 첫 실패 종료·timeout·wire/해제/합계 크기 제한·redirect handler·파일 권한을 확인했다. 실제 실행 후 별도 Python 재독으로 plan/소비 hash·135파일 불변·403 1회/미송신7건·본문 미저장·권한을 확인했다(rc0/PASS).

사용자 후속 지적에 따라 이 미확인을 프로젝트 전체의 필수 잔여 작업처럼 설명하지 않는다. [ADR0026](../adr/0026-source-based-compatibility-scope.md)의 고정 소스 기반 호환성 범위와 실제 배포 기술 검토의 입증 범위를 구분한다. 향후 실제 배포에 대한 분석은 대상/프록시/구현체와 소스 대응을 먼저 확인하고 기존 소스 분석을 재사용한다. 불명확한 연결만 보완하며 같은 자료의 반복 분석을 완료조건으로 삼지 않는다. 신규 외부 실행 B나 추가 취득은 이번 실행에서 시작하지 않았다.

`npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/independent-deployment-evidence-a-check.log`)。`git diff --check`: rc0。검사 성공은 외부 취득 성공이나 배포 연결 인증이 아니다.
