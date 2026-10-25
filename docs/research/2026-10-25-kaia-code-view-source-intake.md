# Kaia JPYC 코드 보기 확인과 소스 취득 과정

사용자가 제공한 [Kaia JPYC 계약 페이지](https://kaiascan.io/ko/address/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29?tabId=contract&page=1)의 **코드 보기를 확인하고 프록시 Solidity 6파일·ABI·compiler 설정을 확보했다.** 정적 HTML에 소스가 없다는 결과를 사이트의 소스 미제공으로 일반화하면 안 된다. 이번에는 일반 브라우저가 불러온 공개 응답을 읽었으며 로그인/키·서명/거래·독립 체인 RPC·compiler 실행·배포 코드 대조는0이다. 사용자 결정에 따라 원본 배포 build/생성 이력 조사는 하지 않았다.

**최신 결과:** 사용자의1~4 진행 승인과 Chrome 설정 허용 후, 정상 탭의 Input JSON 편집기 전체를 복사해 구현체 **17파일 원문 확보와 기존 JPYC 대조까지 완료**했다. 저장물81804바이트·17소스/26import이며 줄바꿈 진단 외 코드 차이는 없었다. [전체 취득 과정](#전체17파일-취득과-기존-jpyc-대조)과 [통합 결과](2026-10-25-token-review-source-summary.md)가 최신 상태다. 아래 별도 브라우저/API 실패·MHTML 표시분 단계는 당시 기록으로 보존한다.

## 확인 결과

| 항목 | 이번에 확인한 내용 | 입증 경계 |
| --- | --- | --- |
| 토큰 주소 | chainId8217의 기존 후보 `0xe7c3d8c9a439fede00d2600032d5db0be71c3c29` 페이지 | 이번에 공식 발행사 목록/genesis/chain RPC를 재확인하지 않음 |
| 표시 계약 | `ERC1967Proxy`, UUPS | explorer snapshot의 표시 |
| 표시 compiler/설정 | `0.8.11+commit.d7f03943`, optimizer enabled/runs3000 | compiler 실행/독립 인증을 새로 하지 않음 |
| 프록시 자료 | Solidity6파일, import5연결/미해결0, ABI4항목 | 공개 응답의 소스/설정 간 일관성 확인. 새 함수/권한 분석이나 컴파일은 미실행 |
| 구현체 표시 | `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e`, `FiatTokenV1` | explorer 표시이며 이번 고정 블록 슬롯 관측이 아님 |
| explorer 일치 표시 | runtime/creation 모두 `partial`(부분 일치) | 독립 전체 byte 일치로 바꾸지 않음 |
| 구현체 페이지 | 정상 탭에서 FiatTokenV1의 전체 Input JSON81804바이트·17소스 content 확보 | 기존 소스와의 원본/줄바꿈 진단을 구분하며 Ethereum 소스로 대신 채우지 않음 |

프록시 가상 소스 경로는 `contracts/proxy/{ERC1967Proxy,Proxy}.sol`, `contracts/upgradeability/{draft-IERC1822,ERC1967Upgrade}.sol`, `contracts/util/{Address,StorageSlot}.sol`이다. 별도 입력 JSON21427바이트·소스 content 합계19940바이트를 원본 그대로 저장했다. source-code 필드와 input JSON의 sources, compiler-settings 필드와 input JSON의 settings가 각각 일치했다.

저장 Ethereum 프록시 후보와 비교하면 6파일 모두 원본 바이트는 DIFFERENT다. CRLF→LF를 **별도 진단한 경우만**6파일 모두 같았고 settings 차이 필드는 outputSelection이었다. 입력 원문을 정규화/교체하지 않았으며 이 유사성은 Kaia 배포 동일성 증명이 아니다. 구현체 소스 미확보·독립 코드 관측 부재를 유지하므로 기존 UNKNOWN5/5·추가체인 포함8/8은 변하지 않는다.

## 수행 순서와 실패 원인

1. 웹 읽기 도구는 사용자 URL을 열지 못했다. 같은 URL의 직접 GET은 UTC `2026-10-25T01:53:27.506011+00:00`~`01:53:27.777005+00:00`에 HTTP200/251631바이트였다. HTML의 source/compiler 관련 문자열은 번역 문구였고 실제 source bundle은 없었다. 화면 JavaScript를 실행하지 않은 이 단계로 코드보기 내용을 판정할 수 없었다.
2. 사용자 지적 후 새 임시 profile의 보이는 Chrome을 열었다. 첫 도구는 first-party GET만 허용했고 정상적인 CORS 사전 OPTIONS를 막아 빈 DOM을 만들었다. 원문 응답200과 빈 화면을 구분해 저장했다.
3. 두 번째 브라우저 관측에서 요청 차단 host/method·네트워크 실패·console 예외를 추가 기록했다. `mainnet-api.kaiascan.io`에 대한 GET용 OPTIONS가 로컬 도구에 의해 차단된 사실을 확인했다. 이 실패는 Kaia 소스 미제공 증거가 아니다. 두 빈 화면에서 console 예외는 관측되지 않았다.
4. GET용 CORS OPTIONS만 같은 first-party 경계에 추가 허용했다. 쓰기/로그인/지갑 연결·외부 telemetry는 허용하지 않았다. 정상 DOM에서 **코드 보기 버튼을 클릭**했고 표시 계약/6파일 목록을 확인했다. 페이지가 실제 요청한 공개 `contract-codes` 응답230669바이트를 저장했다. API 경로를 추측해 직접 호출하지 않았다. 코드 editor의 화면 일부는 Loading 상태였지만 원본 응답에 소스·ABI·설정이 있었다.
5. 페이지의 구현 주소 링크를 한 단계 확인했다. 해당 주소의 같은 계약 탭에서는 소스 응답을 확보하지 못했다. 그 결과를 프록시 소스 취득과 별도로 남긴다. 실제 읽기/쓰기 버튼과 사용자 정의 ABI 기능은 실행하지 않았다.
6. 브라우저 소유 프로세스를 종료하고 각 임시 profile을 정리했다. 저장 응답에서 JSON만 파싱해 소스를 추출했다. HTML/script/Solidity/build 코드를 실행하거나 새 compiler를 취득하지 않았다.

| 브라우저 관측 | UTC 시작~종료(2026-10-25) | 허용 GET / OPTIONS | 결과 |
| --- | --- | ---: | --- |
| 첫 프록시 관측 | 01:55:54.506~01:56:08.118 | 59 / 0 | 사전 요청 차단, 빈 DOM |
| 원인 기록 추가 | 01:56:30.302~01:56:49.151 | 60 / 0 | OPTIONS 차단 기록 확보 |
| 프록시 코드 보기 | 01:56:59.757~01:57:18.700 | 110 / 10 | 소스 응답·DOM·화면 확보 |
| 구현체 링크 확인 | 01:57:50.896~01:58:09.873 | 107 / 8 | 계약 검증 화면, 소스 미확보 |

계수는 CDP에 연결한 페이지의 허용 요청이다. 합계336GET/18OPTIONS에는 정적 자산과 페이지 부수 요청이 포함되며 browser 전체 내부 통신의 전수 계수는 아니다. 각 탐색은 최대45초/허용120요청/관측32MiB 제한을 뒀고, 성공한 프록시 관측은120요청 한도에 도달했다. 이 한도로 차단된 부수 요청을 서비스 오류로 해석하지 않는다. 네 브라우저 관측의 Network.loadingFinished encodedDataLength 합계17364143바이트는 네트워크 관측값이며 압축 해제 소스 합계와 구분한다. 페이지의 비로그인 account 관련400은 계약 소스 응답200과 구분한다. 이전 A의8GET 계획/실패 소비를 재사용한 실행이 아니다.

## 보존과 재현

원문은 아래 Git 제외 root에만 보존했다. 디렉터리0700·파일0600이며 공개 문서에는 Solidity 원문·응답 본문·개인 정보/인증정보를 싣지 않는다.

- `.state/kaia-user-contract-page-20261025/`: 직접 GET HTML/receipt.
- `.state/kaia-code-view-browser-20261025/`, `-v2/`, `-v3/`: 실패/성공 관측의 receipt·페이지 응답·DOM·화면. v3의 `response-15.body`가 프록시 소스 응답이다.
- `.state/kaia-code-view-implementation-20261025/`: 구현체 페이지 응답·DOM·화면·receipt.
- `.state/kaia-code-view-extracted-20261025/`: 원본 input JSON·ABI·가상 경로별 소스·manifest. 기존134증거파일 hash 불변.

브라우저 harness는 `.state/inspect-kaia-code-view-20261025.mjs`, 오프라인 추출/검증은 `.state/extract-kaia-code-view-20261025.py`다. harness의 현재 대상은 마지막 구현체 관측이며 기존 root에 덮어쓰지 않는다. **재현을 위해 기존 스크립트를 그대로 재실행하지 않는다.** 향후 같은 UI 확인이 필요하면 사용자 지정 URL과 새 소유 profile/root를 사용하고, DOM과 페이지가 정상 요청한 응답을 함께 확인한다. first-party GET와 그 GET용 OPTIONS를 허용하되 서명/거래/로그인·추측 endpoint 조회로 넓히지 않는다. source-code 같은 단어가 정적 HTML에 있다는 이유만으로 소스를 확보했다고 판정하지 않는다.

Lead `f817a18f46de4c36b73c10eed6dd2a2d`는 proceed로 정상 페이지 리소스만 확인·관측과 원인 구분·추측 API/RPC 제외·원문 비공개·UNKNOWN 보존을 검토했다. 첫 요청 준비에서 비공개 `.state`를 관련 파일로 지정해 전달 전 거절됐고, 공개 연구 문서 경로로 준비를 수정해 이 id로 전달했다. 추가 권한이나 운영 변경 승인이 아니다.

## 사용자 정상 Chrome 탭에서 구현체 코드 표시 확인

이 절은 전체17파일 취득 전의 표시분 저장 단계를 기록한다. 후속 전체 취득 결과는 다음 절에 있다.

사용자는 정상 브라우저에서 가능한 동작을 도구도 할 수 있다고 다시 지적했다. 별도 profile/API의 실패를 전체 접근 가능성으로 일반화한 한계를 수정했다. 사용자 지정 Kaia URL이 이미 열린 Chrome 탭만 골라 확인하고 다른 사이트 탭의 내용은 읽지 않았다. 쿠키·인증정보·profile/cache는 추출하지 않았다.

1. 기존 Chrome의 해당 탭에서 공개 DOM을 읽으려 했지만 Apple Events JavaScript 실행이 꺼져 있었고, System Events 화면 제어도 보조 접근 권한 거절이었다. 이 설정을 켜거나 우회하지 않았다.
2. Chrome이 기본 지원하는 `save … as "only html"`은 원래 HTML251631바이트만 저장해 다시 화면 틀만 남겼다. **동적 페이지의 실제 화면 보존에는 이 방식이 충분하지 않았다.**
3. 같은 구현체 탭을 `save … as "single file"`로 저장했다. 새 탭 탐색이나 로그인 없이 MHTML1322210바이트를 얻었고, MIME의 주 HTML을 비실행 데이터로 파싱했다. 사용자 탭의 코드는 실제로 표시돼 있었다.
4. 저장 DOM에는 계약명 `FiatTokenV1`, 표시compiler `0.8.11+commit.d7f03943`, optimizer3000·부분 일치, **17개 Solidity 경로 목록**, 선택 파일 `contracts/v1/Blocklistable.sol`의 `blocklist/unBlocklist/updateBlocklister` 코드와 modifier 표시분이 있었다. 이전 별도 브라우저의 계약 검증 화면과 달랐다. 두 화면 차이의 정확한 서버/세션 원인은 이번 자료로 확정하지 않았다.
5. Chrome 기본 `select all`/`copy selection`도 같은 탭에서 시험했다. 일반 페이지 텍스트82823자를 얻었고, 원래 clipboard record는 메모리에만 보존했다가 즉시 복원했다. 이 방법도 전체 소스 파일의 다운로드는 아니었다.

**이 시점에 확인한 것은 코드 표시와 표시 목록이며 전체17파일 원문 추출은 아니었다.** MHTML의 Monaco 편집기는 현재 표시된 행만 포함한다. source 편집기28행과 ABI/settings/metadata/input/output 편집기 표시분을 보존했으며 나머지 행을 보충하거나 Ethereum 소스로 채우지 않았다. 렌더링 텍스트의 nbsp/줄바꿈은 원본 소스 바이트로 간주하지 않는다. compiler 실행·독립RPC·전체runtime대조0이고 배포 연결 UNKNOWN을 유지한다.

원문 MHTML·추출 HTML/표시 텍스트·편집기별 표시분·validation은 `.state/kaia-user-browser-save-20261025/`에0700/0600으로 보존했다. validation에는 원문 hash/크기·정확한 대상URL·17경로·표시 계약/설정·전체원문 추출0·기존134증거hash 불변을 기록했다. 사용자 기존 탭은 닫거나 새로고침하지 않았고, 브라우저 보안/접근 설정도 바꾸지 않았다.

MHTML 저장 파일의 수정시각 기준 UTC는 `2026-10-25T02:16:09.092860+00:00`, SHA256은 `e675f728bd82d1b9de64df814e7de51f4f90a6d75af1470d715e9967f48ac2b5`다. 이는 저장 snapshot의 시각/hash이며 과거 별도 브라우저 요청 시각·블록 관측이나 원본 소스 hash가 아니다. 별도 재독에서 파일별hash·권한·목록17/전체원문0·문서 링크와 Git 제외를 확인했다(rc0/PASS).

Lead `9277238ae5f04724b00e3be1992a3bcc`: proceed. 현재탭 snapshot·17목록/일부본문과 전체원문 미취득을 구분하고, 이전401/ERR_FAILED·UNKNOWN을 보존하며 세션 부수 자료를 포함할 수 있는 MHTML은 비공개로 유지하는 조건을 반영했다. 설정 변경/접근 제한 우회·추가 취득 승인이 아니다.

이 후속 작업의 `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/kaia-user-browser-snapshot-check.log`)。`git diff --check`: rc0.

향후 동적 공개 페이지는 사용자와 동일한 대상/탭에서 **기본 단일파일 저장으로 실제 표시 상태를 확인**한 뒤 자료 상태를 판단한다. 별도 profile의 실패만으로 사용자에게 파일 전달을 먼저 요구하지 않는다. 코드 표시·표시분 저장·전체 원본 취득을 별도 상태로 기록한다. 이전401/ERR_FAILED 원본도 삭제하거나 성공으로 바꾸지 않는다.

## 전체17파일 취득과 기존 JPYC 대조

사용자가 원문 취득·차이 검토·JPYSC 보완·통합 보고1~4를 모두 지시했고, Chrome의 Apple Events JavaScript 설정도 직접 허용했다. 이후에는 해당 사용자 탭의 공개 Input JSON 편집기만 조작했다. 설정을 도구가 바꾸거나 쿠키/키·profile/cache를 추출하지 않았다.

1. 먼저 새 소유 탭에서 과거 페이지가 실제 요청한 정확한 소스 URL을 단발 읽었다. 결과 MHTML1178바이트의 본문은 UNAUTHORIZED_ACCESS였다. 그 탭만 닫고 이 경로는 종료했다. native save가 비동기여서 초기 receipt에는 저장0바이트가 기록됐지만 후속 검증에 완료 크기/hash·오류 본문 상태를 따로 남겼다. 기존 receipt는 바꾸지 않았다.
2. 사용자 허용 후 현재 탭에서 공개 editor 모델 API를 읽으려 했지만 자동화 컨텍스트에서 모델을 얻지 못했다. 이후 정상 Copy/Download 조작을 점검했다. Input JSON 제목의 상위 요소도 같은 제목을 가져 첫 선택이 지나치게 넓은 패널을 가리키는 문제가 있었다. **자식 요소가 없는 정확한 제목·버튼2개·편집기1개**로 대상을 좁혔다. Chrome tab id는 text이므로 숫자 비교 대신 text 비교로 활성 탭을 선택했다.
3. 확실한 전체 선택을 위해 Input JSON의 textbox를 focus하고 Meta+A keydown/keyup을 전달했다. Monaco가 선택 동작을 처리했고, 이어 Chrome 기본 `copy selection`으로 전체 편집기 내용을 얻었다. 단순 페이지 전체 선택이나 MHTML의 표시 행을 사용한 것이 아니다. clipboard record는 메모리로만 보존했다가 각 시도 종료 시 복원했다.
4. 복사 결과81801문자/UTF8 81804바이트를 JSON으로 파싱했다. 중복키·위험 경로·빈 content·source 수를 검사하고 **17개 전체 content와26개 import 연결/미해결0**을 확인했다. 원문은 `.state/kaia-full-input-copy-user-tab-20261025/input-as-copied.json`에 저장했다. SHA256은 `40877009b3d3cde577548dbfd2e53d10a210b01ba29c2e2ec69c61235ecc81ab`이다. clipboard 저장물의 hash이며 원래 HTTP 응답 byte identity는 주장하지 않는다.
5. `.state/compare-kaia-jpyc-sources-20261025.py`로 기존 Ethereum 구현체 입력과 대조했다. 같은17경로의 content는 원본 바이트17개 모두 DIFFERENT, CRLF→LF 별도 진단에서는17개 모두 동일이다. 그 외 코드 차이는0이고 설정 차이는 outputSelection뿐이다. 원본 source content와 설정을 정규화/교체하지 않았다.
6. 기존 JPYC의 전송/승인·발행·소각·pause·blocklist·owner/UUPS·서명 기반 경로·외부 토큰 회수 조건 표를 이 텍스트 비교 근거로 재사용했다. Kaia의 실제 실행 결과나 전체 runtime 일치로 바꾸지 않았다.

완료 receipt·17소스·input hash/비교·문서 근거는 `.state/kaia-full-input-copy-user-tab-20261025/`와 `.state/kaia-jpyc-full-comparison-20261025/`에0700/0600으로 보존했다. 실패 경로는 `.state/kaia-full-source-native-20261025/`, `.state/kaia-full-input-user-tab-20261025/`에 따로 남겼다. 이 작업의 새 Solidity compiler/RPC/거래·배포 대조는0이며 기존134증거파일 SHA256도 같다.

재현 절차는 `.state/capture-kaia-input-editor-20261025.applescript`에 기록했다. **현재 탭/URL·활성 focus·Input JSON leaf 제목·해당 패널의 버튼 수를 먼저 확인하고 편집기 전체 선택 후 native Copy, JSON17/경로/content 검증을 수행**한다. 스크립트는 기존 출력 파일을 거절하며, 실제 재취득은 새 작업 범위/새 출력 경로에서만 수행한다. 저장된 실패를 재시도 소비로 바꾸거나 로그인/endpoint 추측으로 확장하지 않는다.

Lead `c0eb112dcf604d78ba9d758160e6acf2`의 proceed 조건(정확한 관측 URL·유한 읽기·거절 종료·17content/hash/설정 확인·기존 판정 보존·JPYSC source/AST 수동 보완)을 적용했다. 설정 허용 후에는 사용자 화면에 있는 공개 편집기의 내용을 복사했다. 새 API/RPC 실행 승인을 추가로 추론하지 않았다.

전체 취득/비교 후 별도 재독은 rc0/PASS(17소스 hash/26import·원본/CRLF 차이·설정·134원본불변·권한·문서 링크)다. `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/kaia-jpysc-four-tasks-check.log`)。`git diff --check`: rc0.

## 검증

### 구현체 소스 표시의 사용자 정정과 재관측

사용자는 [구현체의 같은 계약 탭](https://kaiascan.io/ko/address/0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e?tabId=contract&page=1)에 소스가 표시된다고 알려주었다. **사용자 화면의 소스 표시와 도구의 미취득을 구분한다.** 앞선 계약 검증 화면 관측은 소스 부재나 미공개를 확정한 결과가 아니다.

UTC `2026-10-25T02:07:33.637Z`~`02:08:01.138Z`에 새 비로그인 visible Chrome/profile로 같은 URL을 재관측했다. GET100/GET용OPTIONS8·관측encoded4553071바이트이며, 같은45초/120요청/32MiB 제한 안에서 종료했다. 이번 DOM에도 계약 소스코드 탭은 있지만 본문에는 계약 검증/사용자 정의 ABI만 관측됐고 코드 보기 버튼은 찾지 못했다. 쿠키 설정 모달도 표시됐다. 버튼/모달 존재와 Solidity 본문 확보 여부를 혼동하지 않는다.

페이지가 실제 요청한 해당 주소의 contract-codes GET은 브라우저에서 ERR_FAILED로 끝났다. preflight HTTP200은 소스 본문의200이 아니다. 이후 **그때 관측된 정확한 URL을 로그인/키 없이 직접1회** 읽은 결과는 UTC `02:08:26.628245+00:00`~`02:08:26.759761+00:00` HTTP401이었다. 이 결과로 로그인 필수·소스 부재·검증 불가능이나 사용자 화면의 오류를 단정하지 않는다. 두 조회 방식이 실패한 원인과 사용자 화면과의 차이는 미확인이다. 추가 로그인·키 취득·우회·RPC·다른 URL 추측은 진행하지 않았다.

원문/DOM/화면/receipt는 `.state/kaia-code-view-implementation-user-confirm-20261025/`에 비공개 보존했다. `receipt.json`의 networkResponses/bodyErrors는 상태와 본문 취득 실패를 따로 기록한다. harness가 동시 응답 저장에 같은 파일명을 선택할 가능성도 발견해 응답 번호를 await 전에 예약하도록 수정했다. 과거 파일/실패를 덮어쓰지 않았으며 이 보완만으로 이번 소스가 취득되지는 않았다. 마지막 사용자 확인 실행의 최초/최종 text 길이는1055이고 clicks는null이다. 이는 실제 코드 읽기 성공을 뜻하지 않는다. 소유 Chrome은 종료했고 임시 profile은 정리했다.

Lead `0ad66d135f1a41b3bddc2d52d50ce1ab`: proceed. 관측 차이·401/ERR_FAILED를 구분해 기록하고 추가 재시도 없이 종료하며, 사용자 화면에서 내려받은 원본 Solidity 또는 표준 입력 JSON/설정을 전달받는 경로를 검토했다. 제공 자료는 소스 검토에 사용하며 새 컴파일/배포 대조 승인으로 간주하지 않는다. 이전 프록시6파일 취득·기존 UNKNOWN·원본 build 필수 제외 결정은 그대로다.

이번 재관측의 Python 재독은 rc0/PASS(본문/버튼 상태·GET100/OPTIONS8·직접401·소스응답미확보·권한·기존134hash 불변)다. `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/kaia-implementation-recheck.log`)。`git diff --check`: rc0.

`python3 .state/extract-kaia-code-view-20261025.py`: rc0/PASS. 중복 JSON 키/위험 경로 거절, 응답→input/source/settings 일관성,6소스·5import·ABI4, Ethereum 원본 차이/CRLF 진단, 기존134파일 불변·0700/0600을 검증했다. 별도 Python 재독도 rc0/PASS로 소스/input hash·4개 임시 profile 정리 기록/파일 권한·기존134파일·문서 링크를 확인했다. 새 compiler/RPC/배포 대조0이다.

`npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/kaia-code-view-check.log`)。`git diff --check`: rc0. 사용자 후속 요청의 작업 과정 기록 원칙도 AGENTS.md에 반영했다.
