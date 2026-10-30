# ECB 환율 단발 수집: 연결 시간 초과로 종료

사용자가 ECB 최대1GET·64KiB·20초·재시도0·비용UNKNOWN, 기존 당일 소비 기록 보존과 단발 수집→기존 DB 반영→웹 확인 제안을 `좋아`로 승인했다. 새 키·endpoint 변경·자동수집/운영 배포 승인은 아니다. 공통 DB 구현은 [기존 기록](2026-10-30-shared-fx-database.md)과 [ADR0121](../adr/0121-shared-fx-database.md)을 따른다.

## 실행과 결과

기존 `.state/fx-store`에 UTC2026-10-30 claim/receipt가 없고 기존2026-10-23 원문/관측이 정상임을 확인했다. 새 사설 실행 marker를 기록하고 기존 `storeFX`의 당일 exclusive claim·fsync·고정 ECB endpoint·redirect:error·20초 timeout·64KiB 응답 제한을 그대로 사용했다. Node `--use-env-proxy`로 실행하고 관리형 proxy/NO_PROXY와 TLS 검증을 변경하지 않았다. 사설 wrapper는 요청 시도 횟수·정상 HTTP status·오류 code만 기록하며 키/연결정보/proxy 값을 기록하지 않는다.

`node --use-env-proxy .state/fx-refresh-20261030/collect.mjs`는 rc1/STOPPED로 종료했다.

- 송신 시도1, 정상 HTTP 응답0, 응답 본문 수신0. 오류는 `UND_ERR_CONNECT_TIMEOUT`이며 약10.5초에 종료했다. HTTP200/수집 성공으로 표시하지 않는다.
- HTTP 응답이나 proxy 거절 응답을 받지 못했으므로 관리형 proxy 정책 차단이라고 단정하지 않는다. 연결 시간 초과의 구체적인 네트워크 원인은 UNKNOWN이다. 기존 키/DB 권한 문제라고 재해석하지 않는다.
- 재시도0·redirect/브라우저/다른 endpoint/다른 proxy 전환0. 승인된 단발 시도는 소비 완료이며 재실행하지 않는다.
- UTC2026-10-30 claim은 보존한다. 같은 날 receipt와 새 snapshot은 생성되지 않았다. 기존 snapshot/XML 원문 hash·projection·원래 시각이 실행 전과 동일함을 오프라인으로 재대조했다. claim을 지우거나 새 root로 우회하지 않는다.
- 신규 DB import/migration/grant/write0. 새 환율을 확보하지 못했으므로 기존2026-10-22 기준 만료 환율을 유지했다. 실제 로컬 `/fx-data.json`은 HTTP503/고정 FX_UNAVAILABLE를 반환했다. 이 웹 조회는 기존 DB reader 읽기이며 추가 ECB 요청이 아니다.

승인·실행·실패 상세와 기존 자료 대조는 Git 제외 `.state/fx-refresh-20261030`에 보존한다. 원문·연결정보는 Git/웹에 게시하지 않는다. 동적 화면을 새로 검사하지 않았으며 실제 로컬 HTTP 응답 확인과 구분한다.

## 검증과 재현 경계

실행 후 읽기 전용 로컬 검사에서 이전 자료 동일, 당일 claim 존재, 당일 receipt/snapshot 부재를 확인했다. 기존 원문 검증에는 `storedFXInputs`를 사용했으며 freshness를 바꾸지 않았다. 기존 code를 변경하지 않았고 연구/승인/인계 문서만 추가했다.

`npm run check`: rc0/731+74=805pass/0fail/cancelled0/skipped0. `git diff --check`: rc0. 전체 검사는 사설/가상 경로이며 ECB 재요청이 아니다.

진단은 원문/claim을 보존한 오프라인 검토부터 진행한다. 실제 재조회는 새로 고정한 계획과 사용자 승인 전 시작하지 않으며 기존 root의 당일 미확정 claim을 삭제·재사용하지 않는다. 단순 timeout으로 proxy/TLS 설정을 바꾸거나 수집 경로를 전환하지 않는다. 운영 service/timer와 DB 자동 갱신 연결은 변경하지 않았다.
