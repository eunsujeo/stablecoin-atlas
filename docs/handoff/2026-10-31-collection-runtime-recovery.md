# 수집 정상화·필수 검증 분리
- 목표: Arkham DB 저장 실패를 해결하고 네트워크 활동 일별 수집을 기존 승인 한도 안에서 실행한다.
- 끝난 것: 사용자 요청·권장안 진행 승인에 따라 ADR0126 구현. DB mirror만 최신 배치로 제한(파일 모드 누적/원본/DB 이력 보존). Usage의 별도 definer 파일은 설치/권한 점검에만 사용하고 writer·스키마/RLS·공개 역할/membership·예산/중복 방지는 유지. 완결 저장자료23건/414관측을0GET으로DB복구·재입력0. 실제 mirror12,975bytes/18관측·과거2MiB파일보존. Arkham만재시작/PID69372·collector-current8c4b7f5. 실제06:00정규슬롯7GET/7완료/게시true/DB STORED/13KiB/rc0확인. Usage 첫run에서기존URL조립오류ERR_INVALID_URL/HTTP응답0/수신0을확인해고정host URL을claim전에구성/검증하도록수정. usage-current0716954/readonlyREADY/기존policyHash3f53…일치. 오늘claim/receipt보존·재실행0·timer활성/다음11-01 09:20KST. 보호11파일과FX/등록PID·상태변경0. DBschema/secret/proxy/TLS/Cloudflare변경0·원본/release/backup/실패claim삭제0·하위Agent0.
- 변경 파일: tools/market-store.mjs, tools/market-collect.mjs, tools/market-db/collect.mjs, tools/market-db/network-usage.mjs, tools/usage-operating-cli.mjs, tools/usage-operating-collector.mjs, tools/deploy/config.mjs, tools/deploy/runtime-probe.mjs, web/market-collector.test.mjs, tests/usage-operating.test.mjs, docs/adr/0126-collection-runtime-boundaries.md, docs/research/2026-10-31-collection-runtime-recovery.md
- 검증: npm run check rc0/879pass/0fail/8skip(기존compiler미보유). 관련74pass/0fail·URL7pass/0fail. 서버readonly Arkham MATCH/등록CHECKED/FX READY/Usage READY/0GET. 11월DBpartition READY/0GET. API health/market/networkusage/FX 모두200. 웹0716954 자동배포SUCCESS/COMMITTED·wall45.381초. Docker27은사설PGfixture28요건미달로요건변경/다운로드0.
- 기다리는 것: 없음 — Arkham정규실행watcher rc0완료. Usage첫실제18GET은11-01 00:20UTC timer실행후확인할미래운영결과다.
- 다음 행동: 최신웹SHA의자동SUCCESS를읽기전용으로확인한다. Usage는11-01 00:20UTC실행후receipt/latestDBsnapshot을readonly확인한다. 오늘claim재사용/추가호출금지. 새개발/범위확대는새사용자요청에따른다.
- 사용자 확인 필요: 아니오 — 권장안/운영수집정상화승인완료. 검토파일추가제공불필요. 기존한도확대/비밀·DBschema변경은승인범위밖.
- 읽을 파일: docs/research/2026-10-31-collection-runtime-recovery.md, docs/adr/0126-collection-runtime-boundaries.md, docs/NETWORK_USAGE_AUTOCOLLECTION.md
- 접속: Herdr default 좌wC:p1/우wC:p2 rootSSH보존. SSHmux ~/.ssh/atlas-deploy-control. root제어면72b0a9c유지. 비대상새PC문서2개보존.
