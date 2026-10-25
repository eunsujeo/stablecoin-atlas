# Fedora ARM64 운영 배포 준비 기록

## 목표와 조사 경로

사용자는 기존 기능·판정·수집 정책·Supabase 스키마를 유지하면서 Mac mini M1/8GB·Fedora Asahi Remix44 Server의 Node/systemd/Cloudflare Tunnel 배포 준비를 요청했다. 실제 서버 배포와 준비를 구분한다.

코드 수정 전에 README·AGENTS·package.json·ui-preview·개발 상태·Supabase/Collector 문서·deploy의 기존 네 unit을 조사했다. 기존 웹은 loopback/고정 경로·TLS/reader 확인·오류 원문 생략을 이미 갖췄으나 외부 Host를 거부하고 mock/Evidence/사설 지리 저장본을 제공했다. Collector는 DB 예약·API 상한·동일 슬롯 중복 거절·receipt/원문 기반 복구와 기존 systemd/FX timer를 갖췄다. 이 계약을 재사용했다. Cloudflare 스킬과 공식 Tunnel origin/token-file·Fedora Node·systemd credential·PostgreSQL trigger 문서를 확인했다. 처음의 일부 옛 Cloudflare 문서 URL404는 공식 현재 경로로 확인했으며 사이트 자료 부재로 판단하지 않았다.

## 최종 구현

- 별도 `npm start`/production CLI: config·private reader env·정확 SHA 표식 필수, loopback 유지, 설정/권한 실패 시 시작 거절.
- 공통 HTTP의 명시 public 옵션: 모든 handler/redirect 이전에 고정 경로 제한, 정확 Host/HTTPS Origin·Forwarded 비신뢰, healthz, mock/private Evidence/저장 지리 차단. 운영 HTML은 목 화면/보고서/읽기 기록을 제거하고 전용 navigation/theme을 사용한다. 공개 정적 모듈 의존성도 허용 목록과 자동 대조한다.
- 기존 DB reader를 연결하되 private 로컬 상태 읽기/JSON fallback을 끄고 TLS·reader 등록·atlas_* 전체 schema의 쓰기/소유/컬럼/sequence/함수 경로를 확인한다. transitive MEMBER를 모두 검사해 NOINHERIT writer 역할도 거절한다. 웹 전체2연결·8대기/10초, 기존 query/transaction 제한을 유지한다.
- atlasweb/atlascollector/atlastunnel/atlasbuild와 credential·원문·public FX 디렉터리를 분리했다. FX 성공 후 검증된 JSON projection만 별도 게시하며 새 ECB 요청은 추가하지 않는다.
- SHA stage/activate/rollback: root 관리 고정 origin/main fetch(60초·비대화형)·테스트 SHA의 이력 확인·정확 archive, 비관리자 npm install/ignore-scripts, root 불변 release, root stage 잠금·원자적 독점 게시, 안전한 REVISION 생성, 웹만 전환/상태 확인/이전 버전 복귀. collector-current와 영속 자료는 웹 전환에서 바꾸지 않는다.
- systemd web/별도 cloudflared·기존 collector/FX drop-in·비밀 없는 환경 예제·수동 dispatch Actions를 준비했다. 실제 도메인/서버/runner 설정은 수행하지 않았다.

정본은 [운영 안내](../PRODUCTION_DEPLOYMENT.md)와 [ADR0105](../adr/0105-production-readiness.md)다. 전체 코드를 중복 설명하지 않는다.

## 실패·원인·수정

1. 사설 PG 시험의 최초 grantAccess 호출을 object 인자로 작성해 INVALID_IDENTIFIER가 발생했다. 기존 positional API로 수정했다. 제품 DB/스키마 문제로 판단하지 않았다.
2. 최초 함수 guard가 기존 schema의 invoker trigger 함수까지 막아 실제 reader 검사가 거절됐다. 공식 trigger 의미와 사설 PG의 직접 호출 실패를 확인하고 `prokind=f`, `returns pg_catalog.trigger`, `security_definer=false`를 모두 만족하는 경우만 제외했다. 일반 함수·procedure·event_trigger·definer trigger·DML/DDL/TRIGGER 권한 거절은 유지했다. 실제 Supabase에는 GRANT/DDL을 실행하지 않았다.
3. simulated HTTPS browser와 배포 health helper의 Node fetch가 지정 Host를 전달하지 않아403이 발생했다. curl/node:http의 전달 결과와 구분해, loopback 목적지 고정·명시 Host/Origin·전체 deadline·body 상한·중단 정리·redirect 미추적·hop header 제거의 공유 HTTP helper로 수정했다. 서버 Host 정책을 완화하지 않았다.
4. 첫 browser가 공용 계산 모듈 allium-dashboard-model404로 로딩을 끝내지 못했다. 이 정적 모델만 명시 허용하고 공개 모듈의 모든 static import를 검증하는 시험을 추가했다. 의존성 시험 작성 중 regex의 개행 문법 오류도 수정했다. 이후 민감 경로 검사의 넓은 evidence prefix가 안전한 evidence-model까지 잘못 세던 조건을 실제 endpoint/evidence.js와 구분했다. 도구 오류를 자료 부재/DB 실패로 판단하지 않았다.
5. 실제 렌더링을 열어 production 프로필 안내/테마 버튼 문구를 보완했다. 기존 로컬 화면과 판정은 바꾸지 않았다.
6. 최종 Lead 검토가 bash stage의 동일 SHA 동시 실행 시 mv가 기존 디렉터리 안에 temp를 중첩하는 경합을 찾았다. stage 전체를 root 소유 mkdir 잠금으로 감싸고, lstat(깨진 symlink 포함) 거절·게시 직전 mkdir 독점 확보·완성 트리 rename·자기 temp만 정리하도록 builtin-only Node helper로 옮겼다. 이전 pointer 해석은 deployment lock 안으로 옮겼다. 동일 SHA 동시/기존 대상/깨진 링크/prepare 실패/게시 직전 대상 생성 시험을 추가했다.
7. 자체 검토에서 REVISION 표식의 symlink 쓰기를 차단하도록 unlink+wx 생성·권한0644와 switch의 정규파일 확인을 추가했다. MEMBER 전체 역할로 NOINHERIT의 잠재 SET ROLE 쓰기도 거절했다. 표식 symlink의 외부 표본 불변과 private PG NOINHERIT 거절을 확인했다.

Lead 검토는 f1cdb34f3ac24391b95426cab342a62a(기본 경계), c47362cb25f3438e9979dd7cf9038b72(trigger 예외), a66f2136a6a74c239a4f563984606037(Host helper), db2457f45c4d45f782a650f0e5c76a18(stage 경합 revise), 2003b5e216a947ad8fcf3d2393fa1701(stage 보완 proceed), 2ca7446476e5440bbd79c679bc0a3eeb(MEMBER/표식 proceed), acca4a326f27441f8a4a50b442105e76(고정 origin/main·정확 SHA 경로 proceed)로 보존한다. 검토 의견을 실제 운영 실행 승인이나 검증 결과로 대신하지 않았다.

공개 전 자체 확인에서 Preview의 cross-site 전면 거부가 외부 링크로 들어오는 최상위 문서 navigation까지 막는 점도 구분했다. production의 고정 공개 문서에서 Origin 없는 navigate/document만 허용하고 cross-site API·iframe·다른 Origin·private 경로 거절을 유지했다. 관련 양성/음성 HTTP 시험에 iframe·mode 누락/변형·잘못된 Host·POST·문서별 query 경계도 추가했으며 개발 Preview 정책은 바꾸지 않았다. Lead 73b1d699119744f5adf329a9219627e0의 좁은 예외 proceed 조건을 확인했다.

## 실제 확보한 읽기 증거

기존 Git 제외 reader 파일만 사용해 Supabase TLS/reader guard·session default_transaction_read_only=on을 확인했다. 이를 위해 새 키를 생성하거나 writer/admin으로 연결하지 않았다. 로컬 production4401의 실제 market/registration/activity/reviewed-supply/survey endpoint는 모두200이었다. FX는 별도 public snapshot을 아직 게시하지 않아503이며, 실패 상태와 미확보를 유지했다. 이 한계는 새 FX 수집이나 private archive 접근으로 자동 해소하지 않았다. FX 성공 게시/실패 보존은 가상 XML을 사용하는 오프라인 시험으로 확인했다.

테스트 서버의 REVISION은 당시 작업 전 HEAD를 테스트 표식으로 사용했다. 작업 중 소스로 실행한 로컬 시험이며 그 SHA의 실제 운영 배포/binding 증명이 아니다. 실제 배포는 stage가 해당 SHA archive에 기록한 REVISION과 health/DB 읽기를 확인한다.

## 검증과 재현

검증은 macOS ARM64 개발 환경에서 수행했다. DB 시험은 프로그램이 생성·소유·정리한 독립 Linux ARM64 PostgreSQL17 컨테이너이며 운영 runtime에 Docker/PostgreSQL을 도입한 것이 아니다.

| 명령/확인 | 결과 | 범위 |
| --- | --- | --- |
| `npm run check:production` | rc0,9pass/0fail | 공개 HTTP·설정·연결 상한/실패 해제·SIGTERM 실제 child·rollback·FX 보존·static import·stage 경합/표식 |
| `node --test --test-concurrency=1 tests/postgres/production.test.mjs tests/postgres/preview.test.mjs` | rc0,2pass/0fail | reader RO·writer/직접/상속/NOINHERIT/PUBLIC/컬럼/소유/sequence/일반/definer/event 함수 거절·기존 DB preview snapshot/오류 보존 |
| `node --test web/preview.test.mjs tests/collector-deploy.test.mjs` | rc0,4pass/0fail | 기존 Preview와 collector 배포 doctor 계약 |
| `node tools/source-review-browser-check.mjs http://127.0.0.1:4399` | rc0 | 기존26프로필·검색/탭/상태·삭제 경로·dark/light/mobile·JS0/외부요청0 |
| `node tools/production-browser-check.mjs http://127.0.0.1:4401` | rc0 | simulated HTTPS→loopback Host 전달·실제 Supabase market200·비공개/mock 요청0·overview/profile·dark/light1440/390·JS0 |
| 기존 Supabase reader guard/로컬 deployment health helper | rc0 | TLS·reader·세션 RO·정확 테스트 표식/POSTGRESQL 응답, 실제 서버 배포 아님 |
| `bash -n deploy/atlas-release`·Node syntax·YAML parsing·`git diff --check` | rc0 | 정적 문법/공백, systemd/GitHub 실행 의미 검증 아님 |

첫 전체 `npm run check`는592통과, stage 시험 추가 후 실행은593통과였다. 최종 `npm run check` rc0 tests593/pass593/fail0/cancelled0/skipped0을 확인했다. 최종 로그는 `.state/agent-logs/production-check-complete.log`, 단위는 production-unit.log, DB는 production-postgres.log, Preview는 production-preview.log/production-preview-browser.log, 브라우저는 production-browser-final.log, 실제 reader는 production-supabase-reader.log, 로컬 배포 확인은 production-live-health.log다. 원문/접속 정보는 Git/웹에 넣지 않는다. production-profile-light-390.png를 수정 전후 실제 열어 확인했고 최종 화면도 같은 이름으로 저장했다. 최종 production4401을 SIGTERM으로 종료해 프로세스 rc0과 listener 제거를 확인했다. 기존4399 Preview는 유지했다.

로컬 재현은 비공개 reader 파일·테스트 hosts `["atlas.example.com"]`·별도 loopback port4401·절대 public FX 파일 경로·40자리 REVISION을 준비해 production CLI로 시작한다. browser 도구는 macOS Chrome과 synthetic HTTPS Host를 사용하며 실제 DNS/Tunnel을 만들지 않는다. 실제 서버 명령은 정본 운영 안내를 따른다.

## 미실행·남은 한계

Fedora Asahi44/aarch64에서 Node/npm production install·systemd-analyze/unit/hardening/부팅·실제 stage Git/SSH/npm 권한/롤백·Cloudflare package/Tunnel/DNS/외부 HTTPS·Actions/SSH runner·worker 이관/재시작/원문 복원·실제 FX timer/publication·8GB 부하/메모리·SELinux 정책 검증은 NOT_TESTED다. 준비 파일의 존재나 로컬 시험으로 성공을 주장하지 않는다. 원본 수집/복구 로직은 기존 시험으로 유지했지만 실제 운영 장애 복구를 새로 실행한 것은 아니다. 실제 도메인과 환경 파일을 배치하고 운영자가 서버 절차를 수행해야 한다.
