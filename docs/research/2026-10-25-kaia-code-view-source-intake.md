# Kaia JPYC 코드 보기 확인과 소스 취득 과정

사용자가 제공한 [Kaia JPYC 계약 페이지](https://kaiascan.io/ko/address/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29?tabId=contract&page=1)의 **코드 보기를 확인하고 프록시 Solidity 6파일·ABI·compiler 설정을 확보했다.** 정적 HTML에 소스가 없다는 결과를 사이트의 소스 미제공으로 일반화하면 안 된다. 이번에는 일반 브라우저가 불러온 공개 응답을 읽었으며 로그인/키·서명/거래·독립 체인 RPC·compiler 실행·배포 코드 대조는0이다. 사용자 결정에 따라 원본 배포 build/생성 이력 조사는 하지 않았다.

## 확인 결과

| 항목 | 이번에 확인한 내용 | 입증 경계 |
| --- | --- | --- |
| 토큰 주소 | chainId8217의 기존 후보 `0xe7c3d8c9a439fede00d2600032d5db0be71c3c29` 페이지 | 이번에 공식 발행사 목록/genesis/chain RPC를 재확인하지 않음 |
| 표시 계약 | `ERC1967Proxy`, UUPS | explorer snapshot의 표시 |
| 표시 compiler/설정 | `0.8.11+commit.d7f03943`, optimizer enabled/runs3000 | compiler 실행/독립 인증을 새로 하지 않음 |
| 프록시 자료 | Solidity6파일, import5연결/미해결0, ABI4항목 | 공개 응답의 소스/설정 간 일관성 확인. 새 함수/권한 분석이나 컴파일은 미실행 |
| 구현체 표시 | `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e`, `FiatTokenV1` | explorer 표시이며 이번 고정 블록 슬롯 관측이 아님 |
| explorer 일치 표시 | runtime/creation 모두 `partial`(부분 일치) | 독립 전체 byte 일치로 바꾸지 않음 |
| 구현체 페이지 | 표시 링크 한 단계의 계약 소스코드 화면을 확인. 계약 검증/사용자 정의 ABI 화면이며 소스 응답은 확보하지 못함 | 소스 부재나 검증 불가능을 단정하지 않음. Ethereum 소스를 대신 채우지 않음 |

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
