# Frankfurter 추가 승인 조회와 실제 DB·웹 반영 완료

앞선 [전환 준비/첫 실패](2026-10-30-frankfurter-fx.md)는 그대로 보존한다. 사용자가 일반 터미널의 curl 성공을 제시했고, 이후 실행 환경의 curl에서는 프록시 접속 시간 초과와 정상HTTP200을 각각 관측했다. 이전 실패를 지속 장애나 공급자 장애로 단정하지 않는다. 두 시점의 경로/상태가 달라진 구체 원인은 UNKNOWN이며, 관리형 proxy/NO_PROXY/TLS 설정을 변경하지 않았다. 사용자 제공 JSON은 별도 사용자 관측으로 보존하고 실제 수집기 성공으로 대체하지 않았다.

## 추가 승인과 실제 수집

기존 실패 기록을 보존한 추가 단발1GET/64KiB/20초/재시도0, 기존 승인 DB·웹 반영을 재개하는 계획에 사용자가 `응 승인할께`로 동의했다. 새 키/endpoint/운영 활성화 승인은 아니다.

기존 `.state/frankfurter-fx-store` 아래 `additional-authorizations/user-additional-20261030-v1`에 별도 불변 authorization/claim을 기록하고 fsync 후1회 요청했다. 기존 당일 실패 claim hash를 승인/소비 기록에 연결했다. 기존 claim을 삭제·재사용하거나 정상 일별1회 한도를 자동 확대하지 않았다. 별도 추가 승인이 실제 추가1회에만 적용되며 반복/재시도/다른 날로 전용되지 않는다.

`node --use-env-proxy .state/frankfurter-additional-20261030/collect.mjs`: rc0/COMPLETE, 실제 agent 송신1/HTTP200/본문63bytes/재시도0. 고정 `https://api.frankfurter.dev/v2/rate/usd/krw`를 사용했다. 기준일2026-10-30, USD/KRW `1337.57`, 실제 fetchedAt=2026-10-30T08:33:02.261Z/importedAt=null을 확보했다. JSON 숫자는 원문 lexeme에서 십진 문자열로 보존했다. Frankfurter의 기본 혼합 참고환율이며 특정 기관의 고시환율로 바꾸지 않았다.

raw/projection/hash와 추가 승인·소비·결과는 위 기존 root의 추가 승인 디렉터리에 비공개로 보존한다. 일반 당일 실패 receipt/snapshot을 성공으로 덮어쓰지 않았다. 추가 자료는 명시 private apply로 입력했으며 일반 root의 날짜별 성공 receipt로 위장하지 않았다. ECB 원문/hash/원시각과 ECB/Frankfurter 기존 두 실패 claim은 전후 동일했다.

## 실제 Supabase 반영

기존 사용자 DB·웹 승인에 따라 사설 PG17/전체 검사로 검증한 동일 코드8126c75를 적용했다. Lead da959610edb846f3b64bf69ebfd734dc proceed를 회수했고, 이는 새 운영 권한이 아니라 기존 승인 범위의 검토다. 이전 capacity 오류/cancelled 요청8ff2246a7a484b8d946cee4676229874를 승인으로 취급하지 않는다.

`node --use-env-proxy .state/frankfurter-additional-20261030/apply.mjs`: rc0/COMPLETE.

1. 실제 수집 성공 receipt/63bytes/hash/원수집시각과 원문 재파싱 대조 후 입력을 고정했다. 기존 admin/writer/reader의 동일 DB/TLS와 기존 definer2개의 definition/schema hash pin을 확인했다.
2. 별도 private `atlas_fx_frankfurter` schema_version/access_grant/snapshot 3테이블을 초기화했다. 기존 writer는 snapshot INSERT/SELECT, 기존 reader는 SELECT만 사용하며 새 키/로그인 역할은 생성하지 않았다.
3. 실제 snapshot1건 입력·같은 자료 재입력0건. reader가 원래 기준일/수집시각·금액·canonical hash를 동일하게 반환했다. 현재 유효기간 검사도 통과했다.
4. production reader READER_READY, API4역할·PUBLIC/default ACL·상속/SET ROLE·view/definer 경계 VERIFIED_EFFECTIVE_ACCESS_DENIED. 대시보드의 exposed-schema 설정 자체는 UNKNOWN을 유지한다.
5. 기존12schema의 구조와77table 자료 지문이 전후 모두 동일했다. 원문·키·DB URL·세부 지문은 Git/웹에 게시하지 않았다.
6. 새 DB reader의 실제 loopback `/fx-data.json` HTTP200/projection 동일·raw JSON 비노출·로컬 파일 fallback 없음 확인. 만료/손상/부재503과 쓰기 차단은 기존 소유 PG17 시험 결과를 유지한다.

실제 DB apply 자체의 공급자GET/RPC는0이다. 이번 새 공급자 조회는 위 승인된 추가1GET만이며 기존 두 실패와 사용자 수동 curl을 동일 성공으로 합치지 않는다. 실제 운영 서버 접속/배포·systemd/timer·자동수집 활성화는0이다.

## 실제 로컬 웹·렌더링 확인

기존4173의 PID74489가 현재 저장소의 소유 Node UI/reader 프로세스임을 user/command/cwd로 확인하고 정상 SIGTERM 후 같은 명령으로 재시작했다.

```sh
npm run ui -- --database --database-env .state/market-db-secrets/reader.env
```

`node .state/frankfurter-additional-20261030/browser.mjs`: rc0/PASS. 새 소유 임시 Chrome profile/remote-debugging-pipe를 사용했고, page의 외부 요청을 차단했다. 현재 실제 DB 기반 `/?currency=KRW#overview`에서 다음 렌더링을 확인했다.

- `Frankfurter 일별 참고환율 · 기준일 2026-10-30 · 참고 환산`
- `가격 (KRW)`·5개 시장 행·원화 금액 표시, USD↔KRW 전환 성공
- 페이지 외부HTTP요청0·JavaScript오류0. 이 브라우저 확인은 새 공급자 조회가 아니다.

DOM 결과와 screenshot은 `.state/frankfurter-additional-20261030/browser.private.json` 및 `web.png`에 보존했다. 가상 HTTP/정적 코드 검사와 실제 DB/렌더링 검사를 구분했다. 임시 Chrome/profile은 정리했고 기존 사용자 브라우저와 상시 로컬 웹은 유지했다.

## 검증·인계

동일 제품 코드의 사전 검증: `npm run check` rc0/734+74=808pass/0fail; Frankfurter/기존FX/production 소유PG17 3pass/0fail; 관련 unit18pass/0fail. 실제 collection/apply/browser는 모두 rc0이다. 완료 문서 반영 후 전체 검사 결과와 인계는 [최신 인계문](../handoff/2026-10-30-frankfurter-live-completion.md)에 기록한다.

다른 개발 PC는 최신 main과 기존 reader.env의 DATABASE_URL/DATABASE_CA_FILE만 준비해 위 DB 모드로 실행한다. FX 원문 파일이나 공급자 키를 복사하지 않는다. 현재 읽기는 원래 기준일과 시각을 유지하며 웹이 외부 수집을 실행하지 않는다.

하루1회 운영 자동수집 연결·설치/활성화는 이번 완료에 포함하지 않는다. 기존 FX service/drop-in은 파일 게시 경로이며 Frankfurter DB 갱신을 자동 실행하지 않는다. 후속에는 승인 기간/일별1GET·총량·비용 조건과 기존 예산/claim 보존을 구체화하고 운영 적용 전 검증한다. 기존 고정 제어면/최초 bootstrap 경계는 유지한다.
