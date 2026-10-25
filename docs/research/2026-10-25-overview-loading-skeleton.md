# 전체 현황 초기 스켈레톤 복구

현재 공급량·전송량 영역은 초기 HTML에서 숨겨져 있었고 기존 스켈레톤 대상은 숨겨진 이전 화면과 접힌 기술 검증 영역이었다. DB 조회 완료 전에는 기술 검증 현황 제목만 남았다. 현재 영역에 정적 스켈레톤과 읽기 상태를 추가하고 상세 이력이 준비되기 전까지 유지한다. 재조회에서는 기존 내용을 유지하며 완료·실패 시 aria-busy를 해제한다.

첫 지연 브라우저 검증에서 survey가 먼저 준비되면 history 완료 전에 스켈레톤이 제거되는 조건을 확인했다. 초기 유지 조건을 history 유무로 수정했다. 이전 정상 이력이 없는 첫 실패에서 이전 정상 자료를 표시한다는 잘못된 안내도 수정했다. 수집·DB 변경·새 외부 공급자 요청은 없다.

## 검증과 재현

- `.state/overview-initial-skeleton-browser.mjs`: Chrome 독립 임시 profile·CDP로 loopback 외 요청을 차단하고 JSON 응답을 보류했다. 초기 표시, survey 선완료/history 대기, 성공 후 제거/aria-busy 해제, 정상 자료 재조회, 첫 history/index 실패와 안내를 확인했다. rc0/PASS. 첫 실행 실패와 수정 후 최종 성공을 구분하며 최종 로그는 `.state/agent-logs/overview-initial-skeleton-browser.log`다. 임시 Chrome/profile은 종료·정리했다.
- 초기 화면 캡처는 `.state/overview-initial-skeleton.png`에 로컬 보존한다. 정적 HTML 검사와 Chrome 렌더링 검증을 구분했다.
- 전체 검사: 결과는 인계문의 검증 칸에 기록한다.
- `git diff --check`: rc0.

재현: 기존 읽기 전용 설정으로 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`를 실행하고 `node .state/overview-initial-skeleton-browser.mjs http://127.0.0.1:4173`을 실행한다. 연결 설정 값이나 DB 응답 원문은 기록하지 않는다. 현재 개발 서버는 PostgreSQL 읽기 전용 모드다. Lead `688c6bfbe2bb4a42982ce122d9d52e4a`: proceed, 지연/성공/실패/재조회와 전체 검사를 조건으로 검토했다.
