# 인계: Supabase/UI 실제반영·운영자동수집 준비

후속: 초기30일 예산도 추가 사용자 승인으로 확정했다. [승인 파일·운영 설정 인계](2026-10-28-usage-period-authorization.md)를 따른다. 아래 기간승인 미생성은 당시 준비 기록이다. 실제 운영활성화는 여전히 미실행이다.

사용자요청 “supabase, ui 반영해줘. 추가로 운영배포에서 데이터 수집할수 있게 해줘”, “당연히 자동수집이지”. 실제DB/로컬UI완료, 운영서버배포·timer활성화·새provider호출0이다. 사용자완료후commit/push승인유지. subagent금지. 운영Macmini직접배포금지유지.

## 실제DB/화면

기존v1/35행불변snapshot/schema_version/access_grant보존. additive002 SQL로upgrade_version/snapshot_v2/collection_day 추가, 기존writerINSERT/readerSELECT/RLS·FORCERLS·불변trigger/공개경계유지. 정본PG17pin152b5e259f323e594dbfd52bf3208d9f0bb9ecf59c600f2a1b5a953a47b42f99. 기존비대상10schema구조/기존11schema71table자료지문동일.

실제v2 snapshot1건/126행(124OBSERVED/2MISSING)/33availability(15NOT_TESTED), 재입력0, reader/APIcanonical전체동일. 원래JPYSC2026-10-24/25누락/원시각·sourcehash·십진문자열보존. inputSHA055b217c9ae1700de2c6eeb8494770d342dfcc460fca99ec9f57f236fc292408(45967bytes), canonicalSHA9f9e533eaedc013922a0ec20296bf66ac4f03283fa29b071df1e9b645e1e060a. 기존공급자2/5/4/13소비재실행0. 실제DB적용/원본/검토/화면증거는.state/usage-v2-20261028, apply receipt상태COMPLETE. blindly apply재실행금지, 먼저receipt/reader상태확인.

로컬preview소유PID15166명령/listener확인후종료하고새PID5350/127.0.0.1:4173로시작(npm run ui -- --database --database-env .state/market-db-secrets/reader.env), execsession24792. 새세션에서항상소유권/명령/listener재확인. 5coin·USD/건수·Allium기존출처전환·미수집사유, 1440/390×dark/light, API126행/expected전체hash동일. 외부HTTP0/JS오류0/새API읽기1/출처전환추가0. Safari API없음은Chrome에뮬레이션이며실기기아님. 운영화면직접확인/배포아님.

## 운영자동수집

`collector:usage` plan/check/run, usage-operating-{plan,collector,project,cli}.mjs. 18정확주소/직전7일/UTC00:20(한국09:20)하루1회18GET/36MiB/420초/요청20초/간격1초/재시도redirect페이지0/첫실패종료. 원래시장/FX동작유지. DB collection_day PKday+DB현재UTC predicate·commonlock·영속root로타PC/새root/재시작중복차단. complete아카이브0GET게시복구/불완전원문재호출0/last-good보존. intent영속화후fetch직전에day와lease재검사. CLIrelease symlink지원.

운영 service/timer와config/authorization proposal, docs/NETWORK_USAGE_AUTOCOLLECTION.md. Persistent=false/Restart=no, 만료자동갱신0. authorization은최대31일·policyHash/기간/일별·누적상한/비용UNKNOWN_ACCEPTED/hash대조필수. 제안은2026-10-29~11-27의30일540GET/1080MiB이며실제승인파일생성/실행은하지않았다. policyHash3f53df9d23f14ea4fb37de58bf6bd867043653f6ee5238f0914b914049283b0b. 기존키/writer와reviewed-definers사설이동/기간예산승인·config설정·운영설치/활성화가남았다. 새API/자동운영활성화는단발소비를재사용하지않는다.

중요: 기존v1전용reader는v2스키마를거절한다. 운영웹/수집기를같은새SHA로배포해야한다. 이작업은운영서버에접속하지않았으므로서버의기존배포버전/실제활성상태는미확인이다. 준비를운영배포완료로표현하지않는다.

## 검증/실패

Supabase적용전 npmcheck754pass(680+net차단74), 관련8회귀, 사설PG최신3회귀(v1보존/v2/동시claim1개/자동CLI18가상응답→실PG게시→0GET복구·새root0GET), 영속화후lease만료0GET사설추가시험PASS. 최종quote보완후verified-check.log도754pass/0fail, pg-release-verified.log3pass/0fail, 실제reader/browser PASS를확인했다. 사설PG는고유소유/전용network/loopback/종료정리, 실DBURL미사용.

초기PGpin시험역할미생성경계거절수정, planCLI stdout정상인데state미정의로exit1수정, intent저장중자정넘김검사추가, 원자DB날짜predicate의JS SQL인용문법오류를시험에서잡아수정. 실제DB/원문/로컬확인화면에해당시험실패영향없음. 로그보존. Lead ceb63c7... proceed, 7e8e244... revise후e83ceac... proceed+조건시험통과. 실제승인은사용자원문이며Lead가대체안함.

상세 docs/research/2026-10-28-usage-v2-supabase-auto.md, ADR0119. docs/handoff/2026-10-22-router-lead-review.md는별도untracked로건드리지않는다. CLAUDE.md생성/모델변경/외부키·원문게시금지.
