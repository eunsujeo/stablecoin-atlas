# JPYC immutable 근거·빌드 입력 후속 조사

사용자는 새 RPC 없이 공식 공개 소스·배포·빌드 자료 조사와 저장 관측의 후속 오프라인 대조 계획 작성을 승인했다. **ID173의 선언·초기화 식은 확인했지만, 실제 배포에 사용한 입력과 immutable 제출값의 독립 근거는 확보하지 못했다.** 이번에는 compiler·대조 CLI를 다시 실행하거나 값을 제출하지 않았다. [기존 단발 관측](2026-10-25-jpyc-token-review-live.md)의 프록시 CONFIRMED·구현체 UNKNOWN·전체 PARTIAL과 소비 완료 상태를 유지한다.

## 자료와 취득 범위

조사일은 2026-10-25 KST다. 아래 원문 저장용 HTTPS GET4회는 2026-10-24T18:20:14.683046Z~18:20:16.271066Z에 각각 시작했고 모두 HTTP200이었다. 각1MiB/10초·재시도0·redirect 거절로 취득했다. 웹 읽기 도구의 검색·열람은 이4회와 별개다. 새 RPC·compiler 다운로드·빌드 스크립트 실행·DB/UI 변경은0이다.

| 자료 | 확인한 범위 | 미확인·제한 |
| --- | --- | --- |
| [JPYC 공식 조직](https://github.com/jpycoin), [조직 profile 원본](https://raw.githubusercontent.com/jpycoin/.github/main/profile/README.md) | Ethereum chainId1·프록시 `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` 표기를 재확인 | 조직 공개 목록은 `.github` 1개로 표시됐다. 이번에 본 목록에서 계약 소스를 확보하지 못했으며 다른 공개/비공개 저장소 부재를 단정하지 않는다. 공식 사이트에서 조직으로 향하는 역방향 연결은 이번 취득으로 확인하지 못했다. |
| [공식 개발 문서](https://faq.jpyc.co.jp/s/article/developer-documentation)·[공식 사이트](https://jpyc.co.jp) | 웹 도구에서 각각 CSS/렌더링 오류·403을 관측 | 빌드 입력을 읽지 못했다. 문서/소스 부재라는 뜻은 아니다. |
| [구현체 explorer](https://etherscan.io/address/0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e#code) | 웹 도구403 | 새 배포/생성자 자료 미확보. 기존 저장 explorer 제출본은 보존한다. |
| [과거 JPYCv2 README](https://raw.githubusercontent.com/jcam1/JPYCv2/main/README.md) | UUPS·0.8.11 설명과 별도 Avalanche 주소 표기 | 현행 Ethereum 배포를 연결하는 발행사 manifest로 사용하지 않는다. Prepaid/과거 세대 자료를 현행 상품과 합치지 않는다. |
| [과거 UUPS 소스](https://raw.githubusercontent.com/jcam1/JPYCv2/main/contracts/upgradeability/UUPSUpgradeable.sol) | `__self`의 선언 초기화 구문 | 해당 파일 유사성은 전체 closure·commit·현행 구현체 배포 연결의 증명이 아니다. |
| [과거 Hardhat 설정](https://raw.githubusercontent.com/jcam1/JPYCv2/main/hardhat.config.js) | 0.8.11 항목의 optimizer enabled/runs3000 | 저장 explorer 설정의 두 항목과 같지만 정확한 배포 build 증거는 아니다. 설정을 실행하지 않았다. 웹 도구의 `.ts`/`.js` 취득 오류를 파일 부재로 해석하지 않으며 실제 저장은 `.js` GET200이다. |

원문4개와 각 URL·취득 시작 UTC·HTTP 상태·SHA256·바이트 수 receipt를 Git 제외 `.state/jpyc-immutable-research-20261025/`에 보존했다(디렉터리0700/파일0600). 원문은 게시하지 않는다. `main` URL은 가변이며 commit은 UNKNOWN이다. 이번 저장 hash는 취득한 바이트의 식별자이고 발행사 진위나 원래 배포 버전의 인증이 아니다.

## ID173에서 확인한 사실

기존 고정 입력의 `contracts/upgradeability/UUPSUpgradeable.sol:23`과 저장 compiler AST에서 address형 immutable `__self`의 초기화 식 `address(this)`를 확인했다. AST ID173은 이 입력·compiler 결과의 식별자이며 다른 commit/입력의 전역 ID가 아니다. `onlyProxy`의 두 조건과 `notDelegated`의 조건도 해당 값을 참조한다. 전체 상속 권한 보장이나 실제 dispatch를 새로 판정하지 않았다.

[Solidity0.8.11 문서](https://docs.soliditylang.org/en/v0.8.11/contracts.html#constant-and-immutable-state-variables)는 immutable 값을 생성 시 평가하고 creation code가 반환할 runtime에 치환한다고 설명한다. 따라서 **제출 소스가 해당 인스턴스의 생성 코드로 실행됐다는 전제 아래**, `__self`는 생성되는 계약 자신의 주소라는 소스 의미를 가진다. 프록시 storage 초기화 인자나 일반 getter로 제출 근거를 대신하지 않는다. 소스 의미에서 실제 생성자 실행·생성 코드·배포 이력을 역으로 증명하지 않으며, 관측 구현 주소를 제출값으로 자동 채우지 않는다.

저장 UUPS 원문은4536바이트·CRLF118개·SHA256 `1d504b5ebe687b4bce46b5c017b6efaf83d8752753ebd9eead9ec4800a5c0e3a`, 이번 과거 저장소 원문은4418바이트·CRLF0개·SHA256 `690f6ee4eb249c7feacc557336a4e796ab2aa99597b9473c22a7d8c190eeffa4`다. CRLF→LF를 별도 진단한 경우에만 같은 바이트열이었다. **원본 바이트는 DIFFERENT**이며 원본 입력을 정규화·교체하지 않는다. 줄바꿈 차이도 metadata/소스 hash에 영향을 줄 수 있으므로 정확 재현에 과거 원문을 대입하지 않는다.

## 빌드 입력 현황

기존 구현체 standard JSON 입력 SHA256은 `e757eaeb5caf9fc33530efa23e1b87215fd7d1ea2e79f03123c239fc4dc7745c`다. 저장된 모든 가상 소스 경로/content와 optimizer enabled/runs3000·libraries 빈 객체는 보존됐다. evmVersion·metadata·viaIR 필드의 누락을 기본값 추정으로 보충하지 않는다. 저장 소스는 explorer 제출본이며 이번 공식 배포 원본으로 승격하지 않는다.

기존 사용 compiler는 `0.8.11+commit.d7f03943.Emscripten.clang`, 고정 캐시 SHA256 `64117d4b13bfc5bc6e5f80823519b140e753a0c09e99edd756772dc3029bc1f8`다. 캐시 검증·provenance의 제한은 [ADR0094](../adr/0094-pinned-solc-0811-browser-artifact.md)를 따른다. 이번에는 실행0이며 과거 저장소의 단축 version 표기를 원래 배포 compiler 전체 버전의 증명으로 쓰지 않는다. 발행사 commit·전체 원본 build 입력·생성 코드/배포 manifest·근거 동반 immutable 제출값은 미확보다.

## 후속 오프라인 대조 계획과 진입 조건

1. 후속 입력은 정확한 chainId1·구현체 주소·전체 standard JSON 소스/경로·설정·compiler 전체 버전과 연결된 출처/취득시각/hash를 갖춘 별도 제출물로 받는다. 제출물의 공식성·배포 연관성은 각각 확인/미확인으로 기록한다. 과거 저장소 한 파일로 전체 입력을 교체하지 않는다.
2. immutable 제출은 해당 고정 AST의 ID173에 대한 정확한32바이트 값과 산출/제출 근거를 함께 명시한다. 소스 식에서 도출한 조건부 값인지 배포/생성 자료로 뒷받침된 값인지 구분한다. 실제 주소·저장 runtime에서의 자동 추출/자동 채움과 누락 설정 추정은 하지 않는다.
3. 입력과 실행 범위가 정해진 뒤 별도 신규 config/output·hash 목록으로 계획한다. 원래 블록26264212·hash `0xc97488e9c325f4256e78cb2d686be7eb1b2b7f16fdcd1c40b6d624e7acb169b5`·UTC2026-10-24T18:10:32.964Z~18:10:36.188Z 저장 관측을 사용하고 새 분석 시각을 분리한다. 새 RPC나 원래 승인 재소비는 계획에 없다.
4. 허용 고정 compiler 캐시·소유/파일/hash·입력/근거를 검증하고 outputSelection 외 설정을 보존한다. immutable 위치/길이/범위·중첩·placeholder·누락/추가 입력과 전체 runtime을 비교하며 metadata를 제거하거나 부분 일치를 전체 일치로 바꾸지 않는다.
5. 결과는 별도1.2 오프라인 보고서로 보존한다. 제출값 조건부 일치도 생성자 실행·원래 배포·현재 시점 연결이나 실제 dispatch의 증명이 아니다. [기존 해석 규칙](../TOKEN_TECHNICAL_REVIEW.md#입력)에 따라 SUBMITTED_IMMUTABLE_VALUES와 배포 연결 UNKNOWN을 구분한다. 불일치/미확보도 원래 PARTIAL·원문/소비를 덮어쓰지 않는다.

이번 승인 범위의 조사·계획 작성은 완료했다. 위 진입 입력은 아직 충족되지 않아 대조 실행은 NOT_RUN이다. 같은 두 입력의 반복 분석·새 RPC·추가 취득은 이번 계획을 이유로 자동 시작하지 않는다. Lead `1f690816ecc141e0b750758c3f8e4a66`은 proceed로 위 조건을 확인했다.

## 검증

`npm run check > .state/agent-logs/jpyc-immutable-research-check.log 2>&1`은 rc0·tests541/pass541/fail0/cancelled0/skipped0이다. 공개 원문4개의 receipt/hash/길이·0700/0600 권한·기존 입력 hash·원본 바이트 차이/CRLF 진단을 오프라인 검사해 rc0 PASS를 확인했다(`.state/jpyc-immutable-research-20261025/validation.json`).

기존 bundle8개·오프라인 원본15파일 hash·기존 보고서 schema/판정·소비 및 hash pin 근거·권한/비밀 비노출 검증도 rc0 PASS다(`.state/agent-logs/jpyc-immutable-existing-validation.json`). 첫 기존 validator 호출은 고정 결과 파일의 wx/EEXIST로 rc1 종료했으며 기존 결과는 보존했다. 출력 경로만 별도 파일로 바꾼 로컬 복사본으로 검증했다. 새 RPC·compiler 실행·runtime 대조는 없다. `git diff --check`도 rc0이다.
