# Mac mini Git Push 자동 배포 완료
- 목표: GitHub은형상관리만,Mac mini에서main Push감지→테스트→빌드→자동웹전환→health확정.
- 끝난 것: LOCAL_GIT/atlasbuild sandbox·SHA/manifest/cache/불변claim·고정root broker완성. 런타임권한/SQL자산·공개polkit규칙·PID1계정위임·동일UID cwd검사보완. 사용자가enable/웹전환·재시작/Push종단시험을승인했고활성화완료. 72b0a9c최초자동전환후별도Push81fbaa2의261tests/build/pack/health를timer만으로37.708초에SUCCESS/COMMITTED확정. 고정root제어면72b0a9c,웹81fbaa2(완료기록Push도자동반영대상). 보호11파일·Collector33973·FX/usage상태/시작시각·비웹pointer변경0. 기존release/backup/실패claim보존.
- 변경 파일: tools/deploy/service-child.mjs, tools/deploy/running-cwd.mjs, tools/deploy/system.mjs, tools/deploy/local-source.mjs, tools/deploy/trigger-rule.mjs, tools/deploy/trigger-rule-repair.mjs, tools/deploy/bootstrap.mjs, tests/deploy-service-child.test.mjs, tests/deploy-running-cwd.test.mjs, docs/research/2026-10-31-local-git-deployment.md, docs/AUTOMATED_DEPLOYMENT.md, docs/adr/0125-mac-mini-local-git-build-deployment.md
- 검증: npm run check rc0/875pass/0fail/8skip(기존compiler미보유). Mac mini gate261pass/0fail/0skip. install25301ms/rc0·전체broker sandbox source+13check READY/providerRequests0·verifyREADY·enable6177ms/rc0. 실제Push81fbaa2 자동deploy wall37.708초/rc0/SUCCESS/COMMITTED/reportedtrue.
- 기다리는 것: 없음
- 다음 행동: 완료기록이포함된최신main과latest.json·transaction.json의SUCCESS/COMMITTED를읽기전용대조한다. 새기능/운영변경은새사용자요청의범위를받은뒤착수한다.
- 사용자 확인 필요: 예 — 다음새작업의목표. 자동배포자체는승인/활성화/종단검증완료해enable재승인불필요. Collector/FX/DBschema/secret/Cloudflare/proxy/TLS변경은이번범위밖이다.
- 읽을 파일: docs/research/2026-10-31-local-git-deployment.md, docs/adr/0125-mac-mini-local-git-build-deployment.md, docs/AUTOMATED_DEPLOYMENT.md
- 접속: Herdr default 좌wC:p1/우wC:p2 rootSSH(보존). SSHmux ~/.ssh/atlas-deploy-control. 비대상새PC문서2개보존. 하위Agent0.
