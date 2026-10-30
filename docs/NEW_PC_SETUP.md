# 다른 PC에서 시작하기

코드와 개발 문서는 Git으로 공유한다. API 키, 환경파일, 관측 원본과 이동 파일은 각 PC에 별도로 둔다. 현재 구현과 다음 작업은 [개발 상태](DEVELOPMENT_STATUS.md)에 기록한다.

## Herdr 설정부터 옮기는 경우

현재 개발 방식의 핵심인 **Herdr의 router-impl / router-lead / 선택적 router-coord와 프로젝트 Router hook**은 [Herdr 새 PC 설정](ai/HERDR_NEW_PC_SETUP.md)을 따른다. 역할·검사·로컬 runtime 생성 도구는 Git으로 공유하며, 살아 있는 pane ID·Codex/Claude 인증·모델 가중치·전역 설정은 복사하지 않는다. 새 PC에서 `python3 tools/intelligent-router/adapters/setup.py check`로 다운로드/Agent 생성 없이 준비 상태를 확인한다.

## 1. 소스와 실행 환경

```sh
git clone git@github.com:eunsujeo/stablecoin-atlas.git
cd stablecoin-atlas
npm ci
npm run setup
npm run doctor
npm run ui
```

해당 PC의 GitHub SSH 인증을 먼저 준비한다. 현재 PC의 `github-new` 같은 별칭이나 SSH 개인키를 저장소에 복사하지 않는다. 다른 PC에 이미 인증된 별칭이 있다면 그 PC의 주소 형식을 사용한다. 기존 checkout에서는 작업 내용을 먼저 커밋하고 `git pull --ff-only`로 받는다.

Node.js24.5 이상과 npm이 필요하다. `.nvmrc`는24계열을 선택하며, nvm을 사용한다면 `nvm install`과 `nvm use` 후 진행할 수 있다. 실제 검증 버전은 [개발 상태](DEVELOPMENT_STATUS.md)에 별도로 기록한다. 기존 프록시 설정을 유지하며 설치 실패를 해결하려고 proxy/TLS 설정을 끄거나 다른 registry로 우회하지 않는다. Node의 환경 프록시 옵션은 [공식 CLI 안내](https://nodejs.org/api/cli.html#--use-env-proxy)를 참고한다.

asdf 등 다른 버전 관리자는 `.nvmrc`를 자동 적용하지 않을 수 있다. checkout 위치에 따라 상위 디렉터리 설정이나 전역 Node22가 선택되는 경우도 있으므로 `node --version`과 `npm run doctor`로 실제 버전을 확인한다. 사용하는 관리자로24.5 이상 버전을 설치·선택한 뒤 진행한다. `node: bad option: --use-env-proxy`는 지원 버전 선택을 먼저 확인한다. 다른 PC의 절대 설치 경로를 프로젝트 설정에 복사하지 않는다.

`http://127.0.0.1:4173`을 연다. UI 서버에는 키, Anvil, Java, Docker가 필요하지 않다. 포트가 사용 중이면 `npm run ui -- --port 4174`를 사용한다. 서버는 loopback에만 바인딩한다.

처음에는 저장된 실제 자료가 없다는 메시지가 정상이다. 아래 자료 이동을 완료하면 현재 시장 화면·검증 근거를 재구성할 수 있다. `Market preview`는 별도의 가상 자료이며 실제 관측을 대신하지 않는다.

## 2. 기존 PC의 자료 이동

기존 PC에서:

```sh
git pull --ff-only
npm ci
npm run workspace:export
```

명령이 `reports/transfers/atlas-reports-....json` 경로를 출력한다. 이 파일 하나를 신뢰하는 개인 전달 경로로 새 PC에 복사한다. 명령 자체는 외부 업로드를 하지 않는다. 파일은 평문 JSON/base64이며 암호화·전자서명이 아니다. 로컬0600 권한은 다른 전달 수단의 접근 권한을 대신하지 않는다.

새 PC에서:

```sh
npm run workspace:import -- --file /path/to/atlas-reports.json
npm run evidence:build
npm run market:build
npm run ui
```

가져오기는 원본 보고서14개만 대상으로 한다. 허용 파일명·길이·SHA-256·JSON과 지표/chain/식별자 관계를 검사하고, 임시 격리 디렉터리에서 두 publisher를 실행한 후 복사한다. 원본 바이트와 관측 시각·판정은 유지한다. 복원은 새로운 체인 조회나 실제 실행이 아니다. 해시는 내용 일치 확인용이며 작성자·자료의 진위를 인증하지 않는다.

대상 파일이 같으면 건너뛰고, 다르면 중단한다. 강제 덮어쓰기 옵션은 없다. 기존 작업이 있는 PC에서는 별도 checkout에 먼저 가져와 비교한다. 마지막 두 build는 새 원본을 읽어 웹용 자료를 생성하며 이전 실행 이력을 유지한다. 동시에 import/build를 실행하지 않는다.

이동 대상은 현재 publisher가 요구하는 고정 원본 집합이다. 과거 모든 파일·publish 이력·source-intake·로컬 인계문·환경파일·모델·키·개인 SSH 설정의 전체 백업은 아니다. 내보낼 원본이 없으면 명령은 실패한다. 원본이 없는 프로젝트에 새 공개망 요청을 자동 실행해 자료를 채우지 않는다.

## 3. 환경변수와 읽기 전용 CLI

`npm run setup`은 빈 `.env.example`로부터 `.env.local`을 새로 만들고, 기존 파일은 읽거나 덮어쓰지 않는다. 필요할 때 각 PC에서 자신의 키·읽기 전용 RPC를 입력한다. UI와 사설 Fixture 검사에는 이 설정이 없어도 된다.

허용 변수는 `RPC_URL`, `TRON_RPC_URL`, `SOLANA_RPC_URL`, `XRPL_RPC_URL`, `ARKM_API_KEY`, `DATABASE_URL`, `DATABASE_CA_FILE` 일곱 개다. shell의 기존 변수가 파일보다 우선하며, 다른 이름은 wrapper가 거부한다. 셸 명령이나 변수 확장은 실행하지 않는다. PATH와 관리형 proxy/NO_PROXY 등 상속 환경은 그대로 유지한다.

```sh
npm run with-env -- assess --network 1 --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --out reports/usdc-readonly.json
npm run with-env -- research:solana-mints --out reports/solana-mints.json
npm run with-env -- research:xrpl-issuers --out reports/xrpl-issuers.json
```

위 명령은 사용자가 실행할 때 외부 읽기 조회를 한다. 원래 `assess`/연구 명령은 기존처럼 shell 환경변수를 읽으며, `.env.local`을 자동으로 source하지 않는다. wrapper는 정해진 세 읽기 CLI만 지원한다. Arkham은 아래의 수동 단발 `market:collect`로 수집하며 키 입력만으로 주기 호출이 시작되지 않는다.

## 4. 개발 검사

```sh
npm run check:ui
npm run compiler:prepare
npm run doctor:full
npm run check
```

`check:ui`는 UI 모델·로컬 게시 경계·자료 이동을 검사하며 Anvil/JDK 없이 실행할 수 있다. 실제 브라우저 화면 검사는 별도다. 전체 `check`에는 Anvil과 JDK17 또는21의 `java`/`javac`가 필요하다. [Foundry 설치 안내](https://getfoundry.sh/introduction/installation/)를 참고한다. 선택적 사설 TRON TVM 실행의 Docker/ARM64 요구는 [별도 문서](TRON_TVM_RUNTIME.md)를 따른다. 다른 OS·CPU에서 실제로 검사하기 전까지 동일한 실행 결과를 보장하지 않는다.

TRON 컴파일 검사는 별도로 고정한0.8.26 compiler가 필요하다. `compiler:prepare`는 검증된 로컬 캐시가 없을 때 기존 로더의 고정 공식 URL에서 한 번 다운로드하고 SHA-256과 버전을 검증한다. 이 과정은 체인/API 조회나 거래가 아니다. 이후 전체 검사는 캐시를 사용한다. 다운로드가 실패하면 원인을 해결한 뒤 진행하며 다른 컴파일러로 대체하거나 검사를 생략하지 않는다. doctor는 고정 SHA-256으로 캐시를 읽기 전용 검사하여 누락·손상·정상을 구분한다. 준비 명령은 다운로드/검증과 로컬 컴파일까지 수행하며 배포·TVM 실행은 하지 않는다. 캐시는 각 PC의 `.state/tron-compiler`에 두고 Git/보고서 이동 파일에 넣지 않는다.

개발용 Router/Lead는 선택 도구다. Python/로컬 모델/Herdr는 제품·UI 실행 조건이 아니며 모델 가중치·설정·인증은 Git으로 이동하지 않는다. 프로젝트 hook 신뢰를 자동 승인하거나 시스템 모델 설정을 바꾸지 않는다. 해당 도구를 사용하는 개발자는 루트와 Router의 AGENTS.md를 따른다.

작업 전 `git pull --ff-only`, 작업 후 검사와 커밋·push를 수행한다. 서로 다른 PC에서 같은 미커밋 변경을 덮어쓰지 않는다. 현재 구조는 단일 writer 기준이며 병렬 데이터 import/build를 지원하지 않는다.

## 시장 자료의 수동 갱신

과거 연구 파일 없이도 `.env.local`의 `ARKM_API_KEY`를 설정하고 `npm run market:collect`를 실행하면3코인의 시장 자료를 한 번 수집할 수 있다. 최대7회 읽기이며 반복 수집은 시작하지 않는다. 완료 후 `npm run ui`로 `#live`를 확인한다. 기존14원본 이동 파일에는 새 `market-store/collected` 이력이 포함되지 않는다. 수집 중 다른 `market:collect`/`market:build`는 즉시 거부된다. 비정상 종료로 `.writer-lock`이 남으면 모든 writer가 종료되었는지 확인한 뒤 그 잠금만 수동 복구한다. 잠금을 시간만으로 지우지 않는다. [ADR0037](adr/0037-manual-market-collector.md).

## PostgreSQL 서버 CLI

DB 도구는 [실행 안내](POSTGRESQL_MARKET_CLI.md)를 따른다. DATABASE_URL은 서버 비밀이며 .env.local 또는 shell에서만 전달한다. 원격 TLS CA가 필요하면 DATABASE_CA_FILE을 지정한다. 일반 import/read는 전용 비관리자 로그인만 허용하며 init/partition/grant와 분리한다. UI/doctor/market:collect는 DB를 초기화하거나 이전하지 않는다.

npm run check:db는 Docker28+·캐시된 postgres:17-alpine으로 새 소유 loopback fixture를 만들어 실제 역할/저장을 검증하는 별도 검사다. Supabase/운영 DB에는 접속하지 않는다. 일반 npm run check도 그대로 실행한다. 기본 DB archive .state/market-db-artifacts는 원문이므로 별도 안전한 보관/이동이 필요하며 기존14보고서 export에 포함되지 않는다.

## 5분 자동 수집

사용자 승인된 제한 실행은 `npm run market:watch`이다. 기본12회 후 종료하며 오류 시 중단한다. 실행·중지·UI 확인은 [자동 수집 안내](MARKET_AUTO_COLLECTION.md)를 따른다. 명시 `--database` 저장은 [Supabase 설정](SUPABASE_SETUP.md)을 먼저 완료한다. 기본 웹은 저장 JSON이며 명시 DB 읽기 모드는 아래 절을 따른다.

## 같은 Supabase를 읽는 로컬 웹

2026-10-30 [Frankfurter 실제 반영 완료](research/2026-10-30-frankfurter-live-completion.md): 새 코드의 DB 환율 reader는 키 없는 Frankfurter USD/KRW를 선택한다. 추가 승인 조회와 실제 Supabase 스키마/자료 적용·reader/API200·브라우저 원화 표시를 완료했다. 다른 개발 PC는 기존 reader.env만 준비하면 되며 provider key나 FX 파일 복사는 필요 없다. 최초 실패는 보존하며 ECB 자동 fallback은 없다. 운영 배포/자동수집 활성화는 별도다.

현재 개발 화면은 기존 원격 Supabase의 전용 reader를 사용하는 DB 모드다. 기본 `npm run ui`의 저장 JSON 모드와 구분한다. 같은 코드만 받으면 인증이 자동 이전되지는 않는다.

새 PC에 `.state/market-db-secrets` 디렉터리를 만들고, 해당 PC에 제공된 기존 reader 전용 `DATABASE_URL`과 TLS CA 경로만 `reader.env`에0600으로 설정한다. 형식은 `deploy/reader.env.example`을 참고하되 `/etc/atlas-ca` 예시 경로를 해당 PC의 실제 CA 파일 위치로 바꾼다. 원문을 Git/터미널 로그/이슈에 올리지 않는다. writer/admin·공급자/RPC 키는 이 파일에 넣지 않는다. 비공개 연결정보/CA는 별도 안전한 전달 경로로 준비하며 새 키를 자동 발급하지 않는다.

```sh
npm run ui -- --database --database-env .state/market-db-secrets/reader.env
```

`http://127.0.0.1:4173/#overview`를 연다. 포트 충돌 시 기존 프로세스를 종료하지 말고 `--port 4174`를 추가한다. DB 모드 웹 시작/조회는 공급자 수집이나 DB migration/write를 실행하지 않는다. 공급량은 별도 일별 등록 수집기, 전송 활동은 별도 Arkham 수집기가 저장한 시각을 표시한다. 오래된 DB 자료를 새 PC 설치만으로 최신화하지 않는다. 환율도 같은 reader로 Supabase에서 읽으므로 DB 모드에는 `.state/fx-store` 복사가 필요하지 않다. 환율 기준일·원래 관측 시각과 7일 유효기간은 그대로이며, DB 자료가 없거나 만료되면 원화 참고값은 미확보다. 비공개 로컬 근거와 compiler cache는 이 reader 파일로 옮겨지지 않는다. 개발 PC에서 운영 수집기/timer를 켜지 않으며 기존 단발 소비·30일 공통 예산을 복제하지 않는다.
