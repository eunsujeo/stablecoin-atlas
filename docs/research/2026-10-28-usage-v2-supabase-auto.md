# 18조합 Supabase·UI 반영과 운영 자동 수집 준비

사용자 요청: “supabase, ui 반영해줘. 추가로 운영배포에서 데이터 수집할수 있게 해줘”, 이어 “당연히 자동수집이지”. 실제 기존 Supabase 적용과 로컬 화면 확인은 완료했다. 운영 서버 설치/배포·timer 활성화·새 공급자 호출은0이다.

## 실제 저장 결과

원래 사설 통합검토본 hash21f32e127bc89237fa136b331c17cd8e4a1317eec1045f36e7d14191e99554fc를 대조해 v2 입력45967bytes/hash055b217c9ae1700de2c6eeb8494770d342dfcc460fca99ec9f57f236fc292408를 생성했다. 18자산×네트워크/126논리행 =124OBSERVED/2MISSING, 등록33 중15NOT_TESTED다. sourceReceipts 두 건과 각 행의 원래 시각/response hash/정수·십진 문자열을 보존했다. JPYSC의2026-10-24/25 부재를0으로 채우지 않았다.

사설PG17에서 기존v1을 만들고 정본002 DDL을 적용해 새 구조pin152b5e259f323e594dbfd52bf3208d9f0bb9ecf59c600f2a1b5a953a47b42f99를 산출했다. 실제 DB에는 기존snapshot/schema_version/access_grant를 수정하지 않고 upgrade_version/snapshot_v2/collection_day 세 불변 테이블만 추가했다. 기존 writer/reader의 SELECT와 필요한 INSERT만 새 테이블에 부여했다. 공개 역할에 권한을 추가하지 않았다.

실제 기존 Supabase에서 owner/TLS/기존두역할·기존definer2핀·유효 SQL API 차단을 확인한 뒤 명시 upgrade를 수행했다. v2 snapshot1건/126행을 append했고 동일 재입력0, reader 전체 canonical 일치/hash9f9e533eaedc013922a0ec20296bf66ac4f03283fa29b071df1e9b645e1e060a를 확인했다. production reader 경계도 통과했다. 비대상10schema 구조와 기존11schema/71table의 자료 지문이 전후 동일했다. 대상 새 구조는v2 pin으로 검증했다. 대시보드 노출 설정 자체의 미확인은 기존대로 보존한다.

사설적용기록 `.state/usage-v2-20261028/receipt.private.json`의 상태COMPLETE, providerHTTP/RPC0. 실제URL/키/원문은 Git·웹·로그에 싣지 않는다. 이번 작업은 기존 수집 원문의 재사용이며 소비한2/5/4/13GET을 다시 실행하지 않았다.

## UI 실제 대조

기존 로컬 reader preview를 소유 PID/명령/127.0.0.1:4173 listener 확인 후 재시작했다. 새 API의v2/126행과 기대입력을 canonical 전체 대조했다. USDC/USDT/RLUSD/JPYC/JPYSC 다섯 선택, 미수집 사유15쌍, USD/건수, Allium 기존저장과명시출처전환을 확인했다. 미수집행에 다른자산의시각/hash를 빌려 붙이지 않고, 응답누락행은 해당원문의조회시각/hash를 유지한다.

1440/390px × light/dark 네 조합에서 overflow 없이 표시됐고, 해당 새 API읽기1회/출처전환추가요청0/외부HTTP0/JS오류0이었다. Chrome에서 ReadableStream asyncIterator/AbortSignal.any를 없앤 호환성 시험이며 실제iPhone/WebKit 기기 시험은 아니다. 실제 화면/요청/결과는 같은 사설디렉터리에 보존했다. 운영 웹 화면을 직접 배포/확인한 것으로 표현하지 않는다.

## 운영 자동 수집

새CLI/계획/수집/원문검증·게시와 systemd service/timer를 준비했다. [운영 안내](../NETWORK_USAGE_AUTOCOLLECTION.md)에 정확한 배포/자격증명/기간승인/활성화 경로가 있다. UTC00:20(한국09:20) 하루1회18GET·직전7일·36MiB/420초/요청20초/간격1초·재시도0, 중단일 몰아수집0이다. 기존 시장·FX 주기/상한을 변경하지 않았다.

policyHash3f53df9d23f14ea4fb37de58bf6bd867043653f6ee5238f0914b914049283b0b에 정확18대상/한도/등록원본을 바인딩했다. 명시기간 authorization은 최대31일이며 일별/누적 상한과 비용UNKNOWN 수용을 검사한다. 제안 예제는2026-10-29~11-27의30일·540GET/1080MiB다. 예제는승인파일이아니며 실제기존키/승인원문/기간예산확인과운영자설정이필요하다. 만료는 자동갱신하지 않는다.

DB collection_day의 날짜PK/DB당일조건, 영속소비/공통송신lock으로 동일날짜는 다른PC/새root도 추가송신하지 못한다. 완결 원문은 같은날재시작에서0GET·중복입력0으로복구했다. partial/429/crash는 그날再조회하지않고이전정상값을유지한다. 영속intent 저장 중UTC자정/lease를넘겨도fetch직전검사로HTTP0을확인했다. 시간대가다른설정/고의적인시계조작/임의코드변경을통한조직전체비용통제를보장하지않는다.

운영에선 웹/수집기를 같은 검토SHA로배포한다. v1전용reader는대상스키마v2의구조를거절하므로옛reader를그대로운영하지않는다. 운영서버에는이번SHA reader/UI와새service/timer의설치·검토기간authorization설정·활성화가남아있다. 이작업에서SSH/운영Macmini/실timer를만지지않았다.

## 검증·실패/수정·재현

- v2모델/운영단위 관련8회귀 통과, 보존과정의 기존 모델 관련14회귀 통과.
- 사설PG 최신3회귀 통과: v1/자료/권한보존·v2append/중복0/충돌거절/reader/RLS/동시claim1개, 자동CLI→가상18응답→실제사설PG게시→재시작0GET/새root0GET 복구, 기존v1회귀.
- 영속화 후 lease 만료 사설추가시험: HTTP0/statusnull/소비유지 PASS.
- Supabase적용전 npm run check 총754pass/0fail(일반680+net차단74). 최종운영SQL 보완후 재검사 결과는아래추가기록을따른다.
- 실제reader/browser 대조 PASS, git diff --check 오류0.

초기pin fixture는 SQL API 경계 시험역할을 만들지 않아거절됐다. 새소유fixture에기존과동일한4역할을명시생성해검증했다. release symlink 시험은plan출력후state미정의에exit1을내던CLI처리를찾아수정했다. 검토는영속화후fetch직전UTC검사가필요함을지적해회귀와함께반영했다. 마지막DB당일predicate 보완의JS SQL인용오류는module검사/시험에서잡아고쳤고실DB데이터변경이나provider호출이없었다. 초기실패로그와수정후로그를모두비공개보존했다.

Leadceb63c7a0b72461e8b835127f8b30bc0 proceed, 7e8e24481eed40bbb70126b2b86275bd의수정요구후e83ceacb02c3486e85a4e9f150564e59 proceed와조건시험을확인했다. 검토응답은사용자승인을대체하지않는다.

재현: `npm run check`; `node --use-env-proxy --test --test-concurrency=1 tests/postgres/network-usage-v2.test.mjs tests/postgres/network-usage.test.mjs`. 새PG는고유소유label·loopback·전용network·종료정리를사용하며실DBURL은시험에사용하지않는다. 실제적용/화면자료는 `.state/usage-v2-20261028`에있다. apply의wx 시작표시를우회하거나무작정재실행하지않고receipt/read상태부터확인한다. preview실행은 npm run ui -- --database --database-env .state/market-db-secrets/reader.env, 본작업의소유PID5350/port4173이며새세션에선소유권/명령/listener를다시확인한다.

최종 배포용코드검사: `npm run check` verified-check.log =754pass/0fail(일반680+net차단74). `pg-release-verified.log` 사설PG3pass/0fail, 영속화후lease사설시험PASS, 실제SupabaseCOMPLETE/reader/UI PASS. 원자DB날짜SQL 보완후 코드로 재검사한 결과이며 초기실패를대체해숨기지않고함께보존했다. 운영서버새배포/timer설치·활성화/새API0이다.
