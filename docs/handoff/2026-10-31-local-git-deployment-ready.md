# Mac mini 자동 배포 최초 성공·Push 종단 확인
- 목표: GitHub main Push를Mac mini가테스트/빌드/자동웹배포·health확인한다.
- 끝난 것: LOCAL_GIT/atlasbuild sandbox·불변claim/manifest/cache·고정root broker구축. 런타임directory/SQL자산·polkit공개rule0644·PID1계정위임·같은UID running-cwd검증보완. 제어면72b0a9c 설치/전체sandbox source+13check READY·verify READY·승인받은enable완료. timer가웹을72b0a9c로전환하고14.583초/SUCCESS/COMMITTED확정. 웹64063/Collector33973. 보호11파일과Collector/FX/usage운영상태변경0. 이전release/backup/claim보존.
- 변경 파일: tools/deploy/service-child.mjs, tools/deploy/running-cwd.mjs, tools/deploy/system.mjs, tools/deploy/local-source.mjs, tools/deploy/trigger-rule.mjs, tools/deploy/bootstrap.mjs, docs/research/2026-10-31-local-git-deployment.md, docs/adr/0125-mac-mini-local-git-build-deployment.md, docs/AUTOMATED_DEPLOYMENT.md
- 검증: npm run check rc0/875pass/0fail/8skip(기존compiler미보유),target4pass/0fail. Mac mini install25301ms/rc0·fullsandbox13check READY/providerRequests0·verify READY·enable6177ms/rc0·timer autoapply14583ms/rc0/SUCCESS.
- 기다리는 것: 이기록의새main Push에대한timer test/build/health종단확인. rootjournal/var/lib/atlas-deploy/latest.json·transaction.json·versions.json에서확인한다.
- 다음 행동: 새commit/push SHA를timer가감지하고test/build/pack/health후SUCCESS·COMMITTED가되는지확인한다. 보호11파일/Collector33973·FX상태유지를다시대조하고최종기록한다. rootapply수동호출금지.
- 사용자 확인 필요: 아니오 — enable/웹전환·재시작/실제Push종단시험은명시승인됐다. Collector/FX/DBschema/secret/Cloudflare/proxy/TLS 변경은제외.
- 읽을 파일: docs/research/2026-10-31-local-git-deployment.md, docs/adr/0125-mac-mini-local-git-build-deployment.md, docs/AUTOMATED_DEPLOYMENT.md
- 접속: Herdr default wC:p2 rootSSH(보존),좌wC:p1. SSHmux ~/.ssh/atlas-deploy-control. 비대상새PC문서2개보존. 하위Agent0.
