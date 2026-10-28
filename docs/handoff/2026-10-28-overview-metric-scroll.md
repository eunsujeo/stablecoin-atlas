# 인계: 전송 지표 전환 스크롤 보존

사용자: “전송금액 추이에서 전송금액, 전송 건수 탭 바꿀때마다 포커스가 최상위로 올라가요.” web/supply-overview.js 동기render 중 root높이를 min-height로 잠시 유지하고 finally에서 원래 inline값/priority를 복원했다. 기존 aria-label focus preventScroll 유지. smooth CSS/강제scrollTo/데이터/캐시/수집/API/DB/운영변경0.

원코드는 공급량+전송차트/overflow-anchor:none 실제클릭에서 scrollY541→300, 수정본541→541. 초기전송차트만있는fixture는재현못했고 Chrome기본앵커링이문제를가렸다. CDP키보드text필드·리사이즈뒤낡은DOM참조를시험에서보완했다. 실패/재현로그보존. 실제Safari/iPhone/WebKit시험으로표현하지않는다.

tools/overview-scroll-browser-check.mjs 재현: 가상자료/소유Chrome프로필/loopback만사용·원격HTTP/DB0. 1440/390×light/dark×앵커none/auto8조건, 실제클릭/Enter반복64전환의scroll/focus/pressed/style검사PASS, 별도32px!important원복PASS, JS오류0. 최종npmruncheck754pass/0fail(680+네트워크차단74), diffcheck오류0. 세부결과는연구기록 docs/research/2026-10-28-overview-metric-scroll.md에기록한다. Lead9eac4d4b83394db5a9cd6e6052f76118 proceed. 추가agent위임없음.

로그 .state/overview-scroll-20261028. 로컬 http://127.0.0.1:4173/#overview 는기존소유PID5350(reader preview)에서서비스중이며이번재시작0. 사용자가새로고침해모듈을다시읽어야한다. 서버소유/명령/listener는다음세션에재확인한다. API/DB/자동수집예산·승인파일은변경하지않았다. 기존30일승인(10-29~11-27 UTC,540GET)은재승인요구하지않고운영서버활성화미실행상태유지. 직전 usage-period-authorization 인계문참조.

완료후commit/push승인유지. 기존별도untracked docs/handoff/2026-10-22-router-lead-review.md는미수정/미커밋. 원문/키/RPC URL게시금지.
