# 운영 수집기 및 FX 장애 복구 개선 기록

## 요청과 기존 충족 범위

사용자는 Mac mini M1/8GB·Fedora Asahi44/aarch64에서 웹/Cloudflare Tunnel/Supabase Seoul Reader 정상, 5API200·FX503, 공개 fx.json0바이트, collector/FX timer 미설치를 보고했다. 웹 SHA는094a225cd95d6cbd74053e7eda065a3e339b0df6이다. 사용자 관측을 이 작업의 직접 운영 관측으로 바꾸지 않는다. 요청은 코드 수정·Git push이며 서버 배포·활성화·실제 외부 수집은 제외한다.

먼저 COLLECTOR_SERVICE·PRODUCTION_DEPLOYMENT·base unit4개와 production drop-in3개·collector-deploy/worker·FX store/publisher·production-web·Overview를 분석했다.

| 요구 | 기존 구현과 판단 |
|---|---|
| 수집 예약/상한·동일DB 중복 방지 | scheduler의405·registration-scheduler의407 session advisory lock과 영속 예약을 재사용. 코드 변경 불필요 |
| 주기·영속 receipt/archive/state | base unit·CLI의 기존5분/일별 예산·고정 외부 영속 경로를 유지. DB/schema 변경 불필요 |
| Web/collector 독립 release | production drop-in3개의 collector-current는 Web current와 분리돼 있음. 새 배포 도구/포인터 구현 불필요 |
| 사용자/파일 격리 | atlasweb reader와 atlascollector writer/원문 분리·공개 setgid2750/파일0640 설계가 이미 있음. 실제 서버 UID/ACL은 미검증 |
| FX atomic rename·실패 보존 | 검증 후 임시파일 fsync/rename은 기존 구현. 부모 디렉터리 내구성과 rename 후 실패 안내만 보완 |
| 부분 API 장애 격리 | allSettled/마지막 정상값/독립 USD 표시가 기존 구현. 다만 아래 실제 rendering 예외와 FX 안내 누락이 존재 |

## 실제 결함과 최소 수정

1. `web/overview.js`: production은 비공개 geography를 조회하지 않아 fulfilled(null)을 넣지만 geographyChoice가 이를 검증해 INVALID_GEOGRAPHY_AVAILABILITY를 발생시켰다. 렌더링 직전 catch로 빠져 FX와 별도로 Overview 갱신을 막았다. production에서만 해당 검증을 건너뛰고 Preview 경로를 유지한다. FX rejected/만료는 오류 안내에 포함하며 renderer 예외는 별도 고정 문구다.
2. `tools/production-web.mjs`: 공개 JSON은 형태만 검증해 만료 FX도200이었다. 공용 `readPublicFX`로7일 유효기간을 검사해503으로 처리하고 허용9필드만 노출한다. 빈 파일/잘못된 JSON도 고정503이며 원문 오류·경로·비밀을 반환하지 않는다.
3. `tools/fx-store.mjs`: readFX 자체는 snapshot의 archive 누락 ENOENT를 거절했지만, storeFX의 이전 자료 조회 catch가 이를 저장소 부재와 함께 허용했다. 누락 원문을 FX_INVALID로 구분해 손상된 이전 자료를 무시하고 새 snapshot 저장을 진행하지 않도록 한다. 기존 readFX/parseFX 대조를 재사용하는 check CLI로 부재·빈 snapshot 저장소·만료·손상을 구분한다. check는 DB/HTTP/claim/파일 생성0이며 원래 날짜·관측/import 시각을 유지한다.
4. `tools/publish-production-fx.mjs`: rename 이후 부모 디렉터리 fsync가 없었다. 이를 추가하고 sync 실패는 file replaced/durability unconfirmed로 구분한다. 검증/rename 전 실패는 마지막 공개본을 보존한다. 원문은 공개하지 않는다.
5. 운영 문서는 최초 FX seed의 실제 검증/전체 트리 이전·게시 순서와 collector 포인터 롤백이 구체적이지 않았다. [운영 복구 절차](../COLLECTOR_PRODUCTION_RECOVERY.md)에 실행 가능한 경로/계정/권한/doctor/선정/설치/검증/별도 승인 활성화/롤백을 기록하고 기존 문서에서 연결한다. unit·예산·schema는 바꾸지 않는다.

0바이트 파일을 누가 만들었는지는 UNKNOWN이다. 기존 publisher는 rename 전 대상 파일을 비우지 않으므로 파일 크기만으로 원인을 단정할 수 없다. 정상 저장본이 없으면 별도 ECB 요청 승인 필요이며 임의 값으로 대체하지 않는다.

이 개발 PC의 기존 `.state/fx-store`를 check로 읽은 결과 rc0/READY/providerRequests0이었다. 기준일2026-10-22·원래 importedAt2026-10-23T01:46:21.297Z를 확인했다. 이는 선택 snapshot의 XML/hash/형식/현재 유효기간 확인이며 원출처 진위 인증이나 서버 이관/공개 게시 실행은 아니다. 원문은 Git/웹에 추가하지 않았다. 이관 시점에도 재검사하며 만료되면 새 시각으로 바꾸지 않는다.

## 실패 경로와 수정

- 최초 Chrome의5API200/FX503 fixture에서 예상 FX 안내 대신 공통 renderer 오류를 재현했다. 임시 로컬 fixture 진단으로 위 geography null 검증 stack을 확인하고 조건을 수정했다. 임시 stack 기록 코드는 제거했다. 운영 데이터/외부 사이트 자료는 사용하지 않았다.
- Browser 시험의 제거/복원 DOM selector는 실제 table class와 부모 노드 참조를 사용하도록 수정했다. renderer 오류를 의도적으로 주입한 경우와 HTTP503을 분리해 확인한다.
- fixture는 실제 저장/수집 증거가 아니며 브라우저 응답은 로컬 생성 데이터다. 정적 HTML 제공만으로 rendering 성공을 주장하지 않고 실제 Chrome DOM·통화 변경·재조회·네트워크 상태를 검사했다.
- Router Lead f2ef0f2a296341ad99d023ed9b55227a는 proceed. check 무변경·날짜/hash 유지·명시 projection·rename 후 sync 상태 구분·FX 장애 격리·별도 승인 활성화 경계를 조건으로 검토했다. 추가 Agent는 생성하지 않았다.

## 검증

로그는 `.state/agent-logs/collector-fx-*.log`이며 Git/웹에 게시하지 않는다.

| 명령 | 결과 | 범위 |
|---|---|---|
| `npm run check` | rc0·600 tests/pass600/fail0/cancelled0/skipped0 | 전체 build/unit/fixture·Preview 회귀 |
| `npm run check:production` | rc0·15 tests/pass15/fail0/cancelled0/skipped0 | 공개 정책·자격증명·release 전환·FX 실제 HTTP |
| `node tools/production-browser-check.mjs --fx-isolation` | rc0 | 오프라인 Chrome·5API200/FX503·USD·KRW 미확보/회복/마지막 정상값·renderer 예외 구분·private/mock 요청0·JS 미처리 오류0 |
| `node --use-env-proxy --test --test-concurrency=1 tests/postgres/{collector,persistent-collector,registered-collector,production,preview}.test.mjs` | rc0·5 tests/pass5/fail0/cancelled0/skipped0 | 기존 새 소유 PG17 fixture·운영DB 접속0 |
| `git diff --check` | rc0 | 공백 오류 없음 |

`tests/collector-deploy.test.mjs`는 base/production drop-in의 경로·사용자·영속 경로·FX 게시 인자/타이머를 정적 검사한다. 실제 Fedora systemd-analyze 실행을 대신하지 않는다. DB 시험은 기존 fixture만 사용하며 Mac mini에 Docker/PG를 도입하지 않는다. FX 시험은 빈 파일·잘못된 JSON·만료·누락 원문·변경 없는 check·rename 실패/임시파일 정리·이전 공개본 보존·실제 HTTP503→200과 고정 오류를 확인한다. FileHandle sync의 디렉터리 실패를 주입해 rename 이후에는 파일이 교체되고 PUBLIC_FX_DURABILITY_UNCONFIRMED가 반환됨도 확인했다. 실제 전원 차단의 fsync 내구성은 미검증이다.

## 재현과 후속 범위

[ADR0107](../adr/0107-collector-fx-recovery.md)·[서버 적용 절차](../COLLECTOR_PRODUCTION_RECOVERY.md)를 따른다. 변경 파일은 FX store/publisher/production-web·Overview, 대응 시험/오프라인 browser fixture/harness와 연결 문서다. 재현에는 키·외부 RPC·운영DB가 필요 없다. 전체 개발 check는 기존 Anvil/JDK/compiler 환경, 사설 DB 시험은 기존 소유 PG17 fixture 환경을 사용한다.

실제 Fedora ARM64 Node/merged unit·UID/ACL/SELinux·공개 file group·부팅/timer·collector 중복 차단·영속 이관/receipt 복구·server SHA 전환/롤백·8GB 부하·백업 복원·6API/화면을 직접 확인하지 않았다. Supabase schema/data·운영키·운영 파일·과거 receipt/archive 변경0, 외부 공급자/ECB 호출0, 실제 서버 배포/서비스 시작0이다. Git push는 요청된 코드 전달이며 배포 성공이나 수집 승인으로 간주하지 않는다.
