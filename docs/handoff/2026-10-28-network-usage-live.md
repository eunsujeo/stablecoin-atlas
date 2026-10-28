# Arkham 실제 수집·Supabase·로컬 UI 완료 인계

- 사용자 고정5GET·실제DB반영 승인을 받아 [실제 결과](../research/2026-10-28-network-usage-live.md)를 완료했다. [준비 인계](2026-10-28-network-usage-pipeline.md)의 승인 대기는 해소됐고, 같은 승인을 다시 묻거나 수집을 재실행하지 않는다.
- USDT Ethereum/TRON/Solana, USDC Ethereum/Solana의2026-10-21~27 요청 범위. 실제5GET 모두HTTP200·2535bytes·35관측/누락0/partial0·재시도/페이지/전환0. 이전 전체 archive manifest 동일. 비용 UNCONFIRMED·집계 시간대 UNKNOWN·일말 하위 초 경계 미확인을 유지한다. 원 providerTime/요청시각/숫자 문자열을 보존한다.
- 신규 private atlas_network_usage 실제init·기존writer SELECT/INSERT·reader SELECT grant·검토snapshot1건 저장/35관측·같은입력재import추가0·reader전체canonical일치·READER_READY·Data API유효차단 확인을 완료했다. 기존10schema/68table의 구조·데이터 지문은 전후 동일하다. Dashboard노출설정 자체는 UNKNOWN, 변경하지 않았다.
- snapshot id: arkham-usage-5fc80be803202bf088797b6e137d404b3753b7ca52b692300c8f0f441cdd80cd. 입력 SHA256 f11fab536f9735354ec15cf401a0cd4919162de778bb91a4cc465e7b8aa75e70, canonical payload SHA256 72d4bf732a28b063bc03c1ecf265ab24ba9bab276b8f9cfe7279579ce40d2685.
- 원문/승인/intent/수집receipt는 .state/allium-executor/arkham-network-usage-20261028-v1, 검토입력/적용receipt/실제화면기록은 .state/network-usage-live-20261028에 비공개 보존한다. 전체URL/키/원문/승인을 Git/웹에 게시하지 않는다.
- 로컬 미리보기 http://127.0.0.1:4173/#overview 를 사용자 검토용으로 유지했다. 새 소유 Node PID15166, 도구session74641, 명령 npm run ui -- --database --database-env .state/market-db-secrets/reader.env. 재사용/정리 시 PID와 실제명령/listener를 다시 확인하고 다른 프로세스를 종료하지 않는다. 운영Macmini/SSH/Cloudflare 배포는 하지 않았다.
- 실제Chrome에서 DB reader/API35관측과 입력 hash를 대조하고 USDC2/USDT3 네트워크·날짜·금액·건수·tx미지원/평균·Arkham/Allium명시출처·1440/390px·두테마를 확인했다. 최종검사의 새API읽기1회·출처전환추가요청0·외부HTTP/JS오류0. Safari API부재 조건 모사이며 실제 iPhone/WebKit은 미검증이다.
- 실제화면harness의 Promise미await로{}비교, data:image를외부HTTP로오분류한 오류를 수정했다. 실패로그를 보존했고 provider 재조회/DB재쓰기 없이 readonly화면만 재검사해 통과했다. Lead b74a5b2d7fa64b049832d91991790825는 보고서 검토 proceed. 독립적인 실제 재실행을 뜻하지 않는다.
- 최종 npm run check는715개 통과/실패0(rc0). 로그 .state/network-usage-live-20261028/check.log. 실제 적용은 추가 제품 코드 변경 없이 준비된 경로로 수행했다.
- 재현은 저장 원문/receipt의 오프라인 검증과 DB reader/로컬 화면 readonly 대조로 한다. collect/apply script를 재실행하지 않는다. 새 기간/지표·자동반복은 새 고정 범위이며 이번에 추가하지 않았다. 기존 무관한 docs/handoff/2026-10-22-router-lead-review.md는 건드리지 않는다.
