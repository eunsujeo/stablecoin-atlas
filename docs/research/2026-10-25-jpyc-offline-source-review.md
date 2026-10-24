# JPYC Ethereum 브라우저 compiler 취득·오프라인 소스 분석

**승인된 compiler 취득·고정 profile 구현과 저장 proxy/implementation2입력의 오프라인 컴파일·정적 분석을 완료했다.** 두 컴파일은 성공했지만 보고서는 구현체 immutable 값 미제공으로 PARTIAL이다. 현재 배포 연결은 둘 다 UNKNOWN이며 새 RPC·거래/서명·DB/UI 변경은0이다. 이 PARTIAL은 자동 테스트 실패나 JPYC 취약점 판정이 아니다.

대상은 저장 식별자의 JPYC Ethereum chainId1·proxy `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`와 explorer 표시 구현체 후보 `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e`다. 이번에는 공식 주소를 새로 조사하거나 고정 블록의 proxy dispatch를 관측하지 않았다. 이전 [공개 HTML 선택 소스 검토](2026-10-25-jpy-public-html-source-review.md)의 SOURCE_REVIEWED·원문·판정을 보존한다.

## 취득과 고정 compiler

앞선 [Python 단발 실패](2026-10-25-jpyc-compiler-acquisition.md)는 그대로 보존한다. 이후 각각의 사용자 승인으로 설치 Chrome의 새 임시 profile을 사용해 같은 host의 metadata와 compiler 파일을 확보했다. 실제 GUI 세션·사용자 로그인 profile을 사용하지 않은 headless Chrome146.0.7680.165 관측이다. Python 실패를 모든 브라우저의 실패로 일반화하지 않는다.

| 단계 | UTC 시각(2026-10-24; KST10/25) | 관측 |
| --- | --- | --- |
| browser metadata | 17:45:51.077~17:45:52.755 | 대상 탐색1·HTTP200·렌더링 JSON1,077,540바이트, duplicate key 거절·release/build/path/longVersion·유일성 검사 |
| browser compiler artifact | 17:50:25.307~17:50:27.714 | 대상 요청1·HTTP200·원래 응답27,280,310바이트·SHA256 일치 |
| 새 오프라인 분석 | 17:57:16.033~17:57:18.066 | 실제 저장 입력2개 각1회, fetch 시도0·RPC0 |

고정 metadata는 `https://binaries.soliditylang.org/bin/list.json`, artifact는 `https://binaries.soliditylang.org/bin/soljson-v0.8.11+commit.d7f03943.js`다. metadata 증거는 DOM 렌더링 문자열이고 원시 HTTP bytes가 아니다. compiler는 탐색 전 script 실행 비활성화와 CDP interception을 설정한 뒤 response stream을 읽었다. base64 여부를 반영한 원래 artifact bytes를 hash 대조했으며 원격 JS를 브라우저에서 실행하지 않았다. 다른 page 요청·redirect를 차단하고 임시 browser profile을 정리했다. 이번에도 재시도·endpoint 전환은0이다.

SHA256은 `64117d4b13bfc5bc6e5f80823519b140e753a0c09e99edd756772dc3029bc1f8`, compiler 실측 전체 버전은 `0.8.11+commit.d7f03943.Emscripten.clang`이다. 동일 출처 목록/hash 일치는 독립 진위 인증이 아니므로 NOT_TESTED를 유지한다. 고정 profile·검증/staging·0.8.11 AST 호환성은 [ADR0094](../adr/0094-pinned-solc-0811-browser-artifact.md)를 따른다. cache가 없는 PC에서 자동 다운로드하지 않는다.

## 입력 보존과 컴파일 결과

[고정 입력 계획](2026-10-25-jpyc-compiler-plan.md)의 두 후보 hash를 실행 직전에 확인하고 새 로컬 디렉터리에 바이트 동일하게 복사했다. 제공 optimizer enabled/runs3000·libraries 빈 객체는 유지했다. evmVersion/metadata/viaIR 누락은 보충하지 않았으며 outputSelection만 기존 CLI의 AST/ABI/runtime용으로 변경해 실효 입력도 따로 저장했다. 원래 HTML 취득17:08:22~17:09:35UTC·추출 시각과 이번17:57UTC 분석 시각을 구분한다.

| 입력 | Solidity 파일 | 컴파일 | 함수 inventory / 명시 진입점 | binding 이유 |
| --- | --- | --- | --- | --- |
| ERC1967Proxy | 6 | SUCCEEDED | 13 / 2 | ADDRESS_NOT_OBSERVED |
| FiatTokenV1 | 17 | SUCCEEDED | 68 / 37 | IMMUTABLE_VALUES_MISSING_OR_EXTRA |

함수 inventory에는 상속/내부 선언이 포함되며 ABI 공개 함수 수로 해석하지 않는다. 명시 진입점 그래프는 자동 getter를 포함하지 않는다. entry/state 한도는 도달하지 않았다. 전체 findings221·artifacts6·분석 실패 기록1건이며, 실패 기록은 구현체 runtime 비교의 immutable 입력 누락이다. 출력은 TokenTechnicalReview1.2/OFFLINE·현재 block null·archive null이다.

compiler의 immutable AST ID173은 address형 `__self`이며 runtime에32바이트 치환 위치5개가 있다. 값을 제출하지 않았으므로 추측하거나 표시 구현체 주소로 자동 채우지 않았다. immutable 문제를 해소하더라도 현재 배포 bytes·정확한 빌드 설정·proxy dispatch를 확보한 것은 아니다. 저장 HTML을 archive runtime 관측으로 사용하지 않았다.

## AST에서 추가 확인한 범위

아래는 이번 compiler AST의 선언 관계·조건/저장값 쓰기 관측이다. 전체 권한 보장·실제 동작·배포 인증은 아니다. 수동 함수 조건의 설명은 [이전 소스 검토](2026-10-25-jpy-public-html-source-review.md#jpyc-선택-소스-조건)를 정본으로 유지한다.

| 선택 경로 | AST 관측 | 남는 한계 |
| --- | --- | --- |
| transfer/transferFrom/approve | paused·blocklisted 조건 참조, balances/allowed 쓰기 연결 | 인자 치환·virtual dispatch·modifier 실행 순서 미증명 |
| mint/burn | paused·blocklisted·minters 조건 참조, balances·totalSupply_ 쓰기와 mint 한도 쓰기 | mapping 조건을 caller equality guard로 바꾸지 않음; 모든 경로 권한 UNKNOWN |
| configureMinter/removeMinter | minterAdmin과 msg.sender의 직접 equality require, minterAllowed/minters 쓰기; configure만 paused 조건 참조 | modifier 순서·미해결 호출을 보존 |
| blocklist/unBlocklist | blocklister equality require·blocklisted 쓰기 | 역할 계정의 현재 값/권한 행사 미실행 |
| pause/unpause | pauser equality require·paused 쓰기 | 정지 범위 전체 보장 아님 |
| upgradeTo/upgradeToAndCall | __self·구현/rollback slot 참조와 상속 선언 연결 | assembly·외부 호출·virtual dispatch·미해결 쓰기·BODY_UNAVAILABLE 보존 |

전체39진입점은 authorityConclusion UNKNOWN, coverage semantics NOT_PROVEN이다. 직접 equality로 인식되지 않은 경로를 무권한 경로로 단정하지 않는다. owner getter·호출 인자·동적/외부 효과를 임의로 증명하지 않았다. 감사 자료 입력0은 미감사라는 판정이 아니다.

## 구현·검증과 비공개 결과

profile 선택은 token/주소 분기가 아니라 정확한 compiler version으로 수행한다. 기존0.6.12·installed compiler 동작을 유지한다. 사설0.8.11 Fixture에서 발견한 uint32 내장 식별자 차이는 버전·이름·타입·선언 부재 조건으로만 처리했다. 실제 내장 require/assert/msg, shadow require·가짜 msg·OR 우회·잘못된 타입/id/버전, cache 누락/변조/symlink/소유자/크기, worker 전체 버전 불일치와 정상 대조군, 외부 import 거절·timeout 정리를 검증했다.

`npm run check > .state/agent-logs/jpyc-pinned-compiler-check.log 2>&1`: rc0, tests541/pass541/fail0/cancelled0/skipped0. `node --use-env-proxy --import tsx .state/run-jpyc-offline-once.mjs`: rc0이며 보고서 execution은 위 사유로 PARTIAL이다. 실제 대상은 각1회만 분석했고 재실행하지 않았다.

- `.state/jpyc-solc-chrome-check/`: metadata 브라우저 관측·선택 기록.
- `.state/jpyc-solc-browser-artifact/`: 원래 compiler bytes·소비·receipt.
- `.state/token-review-jpyc-ethereum-20261025/`: 바이트 동일 입력·출처/시각 연결·config·분석 소비·별도1.2 JSON/Markdown·compiler 입출력·SHA256 묶음.

원문·실제 보고서 본문·compiler bytes는 Git/웹에 게시하지 않는다. 이번 승인 범위는 완료했다. 현재 배포 대조를 진행하려면 정확한 빌드/immutable 값의 근거와 RPC 대상·호출 한도를 먼저 구체화해야 한다. 새 chain 실행·역할 계정 수집·실제 권한 행사·다른 토큰 분석은 자동으로 시작하지 않는다.
