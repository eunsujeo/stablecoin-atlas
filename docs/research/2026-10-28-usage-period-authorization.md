# 운영 자동 수집 초기30일 예산 승인 반영

사용자는 직전의 초기30일 계획(하루최대18GET·총540GET·비용미확인) 제시에 “승인할께.”라고 응답했다. 정책/기간/상한을 바꾸지 않고 승인 artifact와 운영 config를 준비했다. 실제 서버 설치·timer 활성화·새 provider 호출·DB 조회/변경은0이다. 운영 Mac mini 직접 배포 금지 지시는 유지했다.

## 승인 범위

- UTC 2026-10-29 포함 ~ 2026-11-28 제외, 30일. 첫 timer 예정은10-29 00:20 UTC(한국09:20), 마지막은11-27이다.
- 기존 고정18조합, 직전7일창. policyHash `3f53df9d23f14ea4fb37de58bf6bd867043653f6ee5238f0914b914049283b0b` 유지.
- 하루18GET/36MiB·총540GET/1080MiB·실행420초·요청20초·간격1초·재시도/redirect/추가페이지0.
- 비용 UNKNOWN을 명시 수용했다. 요청/bytes 상한은 금전·전체 계정/조직 청구 상한이 아니다. usage/billing API를 추가로 호출하지 않았다.
- DB 날짜 선점/영속 소비/동일 날짜 중복 차단·기간 만료 거절·last-good 정책은 기존 구현을 유지한다. 기간/대상/한도 자동 확대는 없다.

`deploy/usage-authorization.20261029-20261127.json`은 기존 proposal의 kind와 costStatus만 승인 상태로 변경한 파일이다. 날짜·상한·policyHash는 proposal과 동일하다. 승인 파일SHA256 `a4c3e2c4f911ec38cc236ca632d9a05a4fc59ea887e15b27ca2d47f8e171f4ac`.

`deploy/usage.config.20261029-20261127.json`은 기존 운영 경로와 승인파일hash, 실제 기존 사설 reviewed-definers 검토본hash를 반영한다. 해당 검토본의 로컬 bytes hash도 대조했다. 실제 키/URI/원문/승인 대화는 Git에 게시하지 않았다. 승인 원문/문맥/원proposal hash 및 오프라인 검증은 `.state/usage-period-20261029`에 비공개 보존했다. 공개 config는 서버 경로·해시만 담으며 자격증명은 기존 비공개 운영 절차로 이동한다.

## 검증과 남은 운영 단계

실제 `operatingUsagePlan`으로30일 전체를 작성해 `validateUsageAuthorization`을 통과했고 10-28/11-28 두 경계 밖 날짜는 거절했다. 18×30=540, 일별/누적bytes도 일치했다. 외부/DB 없이 확인했으며 제품 시계나 실제 DB clock을 바꾸지 않았다. 당시 실패는 없었다.

기존 [운영 안내](../NETWORK_USAGE_AUTOCOLLECTION.md)에 승인된 두 파일을 바로 설치하도록 명령을 갱신했다. 같은 기간 예산을 다시 승인받을 필요는 없다. 운영 웹/수집기의 동일 새SHA 배포, 기존 자격증명·검토본의 비공개 배치, service/timer 설치와 활성화는 서버 운영 단계로 남아 있다. 이 작업에서 서버에 접속하거나 timer를 켜지 않았으므로 수집 실행/실소비 상태는 확인하지 않았다. 현재10-28은 승인 시작 전으로 check/run이 거절되는 것이 정상이며 날짜를 당겨 재실행하지 않는다.

완료 검증 결과와 commit/push 상태는 최종 기록을 따른다. 원proposal/이전 소비/기존DB/UI·시장/FX는 그대로 보존했다.

문서 갱신의 초기 Python stdin 인코딩 오류는 파일 변경 전 발생했다. Node의 UTF-8 파일 갱신으로 수정했고 승인 파일/검증/제품 동작에 영향은 없었다. Lead14115954e67c4ec9a25b201920a1e2dd는 승인파일/config hash 및30일/경계검증을 독립 확인하고 proceed를 반환했다. 이는 사용자 승인 원문을 대체하지 않는다.

최종검증: `npm run check` =754pass/0fail(일반680+net차단74), `git diff --check` 오류0. 예산 승인 파일/config와 설치 안내만 변경했으며 제품 실행 코드/DB/기존 소비는 그대로다. 새providerHTTP/DB접근·실서버배포/활성화는0이다.
