# 현재 개발 상태

기준: 2026-10-23. 이 문서는 다른 PC/새 작업 세션이 읽는 Git 공유 인계다. 로컬 `.state`나 API 키가 없어도 코드의 범위와 다음 행동을 파악할 수 있도록 유지한다.

## 완료 범위

- 2026-10-25 사용자 요청1~4의 [최종 소스 검토 요약](research/2026-10-25-token-review-source-summary.md)을 완료했다. Kaia 사용자 탭에서 Input JSON81804바이트·구현체 전체17소스/26import를 확보하고 기존 JPYC와 대조했다(원본17개 DIFFERENT·CRLF 진단 모두 동일·settings 차이 outputSelection). [JPYSC initialize 수동 보완](research/2026-10-25-jpysc-initialize-manual-review.md)으로 선언42/참조60·역할8개의0주소 검사·3쌍 분리를 확인했다. 기존 자동 절단/UNKNOWN·134증거hash는 보존하고 새 Solidity compiler/RPC0이다. 취득 실패/설정 허용/정확한 editor 선택/native Copy/차이 검증 과정을 근거 문서에 기록했다.

- 2026-10-25 [사용자 정상 Chrome 탭 확인](research/2026-10-25-kaia-code-view-source-intake.md#사용자-정상-chrome-탭에서-구현체-코드-표시-확인)으로 Kaia 구현체 `FiatTokenV1`·17파일 목록·실제 Solidity 표시분·0.8.11/optimizer3000을 확인했다. JavaScript/보조접근 설정 변경 없이 기본 MHTML 저장을 사용했다. 앞선401/별도브라우저 미취득과 구분하며 소스 부재로 설명하지 않는다. MHTML은 편집기 표시 행만 포함하므로 전체17파일 원문 추출과 구분해 보존했고 새 컴파일/독립RPC0·UNKNOWN을 유지한다.

- 2026-10-25 사용자에게 Kaia 구현체 소스가 표시된다는 후속 정정을 받았다. [재관측 과정](research/2026-10-25-kaia-code-view-source-intake.md#구현체-소스-표시의-사용자-정정과-재관측)에서 같은 페이지의 비로그인 브라우저 ERR_FAILED·관측된 소스URL 직접1회401을 기록했다. 사용자 화면의 소스 표시와 도구의 미취득을 구분하며 소스 부재/로그인 필수를 단정하지 않는다. 프록시6파일·기존 UNKNOWN은 보존했고 새 컴파일/RPC0이다.

- 2026-10-25 사용자 제공 Kaia URL의 [코드 보기 확인·소스 취득 과정](research/2026-10-25-kaia-code-view-source-intake.md)을 기록했다. 브라우저 도구의 GET용 OPTIONS 차단을 수정한 뒤 프록시6소스·ABI4·0.8.11/settings를 확보했다. 표시 구현체는 같은0xafac 주소이며 해당 구현체 페이지 소스는 미확보다. explorer 부분 일치와 독립 배포 관측을 구분하고 UNKNOWN을 유지한다. 새 compiler/독립 RPC/거래0·기존134파일 불변이며 실패/수정/성공 과정과 비공개 원문·재현 경로를 남겼다.

- 2026-10-25 사용자 결정으로 실제 배포 원본 build 자료 확인을 필수 범위에서 제외했다. [현재 기술 검토 범위](TOKEN_TECHNICAL_REVIEW.md#현재-검토-범위)에 따라 원본 build/manifest·생성/배포 이력·이를 전제로 한 immutable 근거 취득을 완료조건으로 요구하지 않는다. 기존 소스/관측을 재사용하고 UNKNOWN·불일치·미관측은 보존하며 새 외부 실행은 시작하지 않는다. [자산별 현황](research/2026-10-25-token-review-remaining-work.md)을 이 기준으로 정리했다.

- 2026-10-25 사용자 승인 [독립 근거 취득 A 결과](research/2026-10-25-independent-deployment-evidence-result.md): 첫 JPYC 공식 사이트 GET이 HTTP403으로 실패해 전체 종료했다. 시도1/취득0·미송신7·135파일 hash 불변이며 재시도/RPC/컴파일0이다. 배포 UNKNOWN은 별도 입증 상태이고 ADR0026 호환성 범위의 필수 미완료 수가 아니다. 향후 실제 배포 분석은 코드/소스 대응을 먼저 확인하고 기존 분석을 재사용한다.

- 2026-10-25 [독립 배포 근거 취득 계획](research/2026-10-25-independent-deployment-evidence-plan.md)을 오프라인 작성했다. JPYC 우선 공개 GET8건(A)을 승인 요청 대상으로 고정하고 RLUSD/JPYSC RPC16건(B)·immutable 제출/대조와 분리했다. 신규 외부 호출/컴파일0·기존 UNKNOWN 유지이며 계획은 실행 승인이 아니다.

- 2026-10-25 [저장 immutable 소스 참조표](research/2026-10-25-stored-immutable-source-map.md)를 완료했다. RLUSD ID650·JPYSC ID1623·JPYC ID173의 선언 초기화·생성자·onlyProxy/notDelegated 참조를 저장 AST/소스에서 확인했다. 기존107파일 포함134파일 불변·외부 조회/재컴파일/값 제출/대조0이며 독립 배포 근거 미확보·UNKNOWN 집계를 유지한다.
- 2026-10-25 승인된 [RLUSD·JPYSC 고정 compiler/오프라인 분석](research/2026-10-25-rlusd-jpysc-offline-source-review.md)을 완료했다. 직접 metadata 각각403 후 보이는 임시 Chrome에서 각각 metadata/artifact200, 총6GET·두 hash·전체 버전 확인·소유 창/프로필 정리를 검증했다. [ADR0099](adr/0099-pinned-rlusd-jpysc-compilers.md)의 두 pin·기본32 유지/정확한 두 버전35/41소스·builtin 인코딩을 사설 검증했다. RLUSD 구현체 및 JPYSC proxy/구현체3컴파일 성공·새 RPC0·기존107파일 불변. 구현체 immutable 미제출/코드 미관측으로 모두 UNKNOWN·두 보고서 PARTIAL이며 JPYSC initialize의 CALL_LIMIT/DECLARATION_LIMIT을 보존했다. 전체564검사 통과, UNKNOWN 자산 집계5/5(추가체인 포함8/8)는 유지한다.

- 2026-10-25 정확한6RPC/120초 계획 승인에 따라 [USDT 단발 읽기](research/2026-10-25-usdt-live-runtime-result.md)를 실행했다. 첫 eth_chainId 송신 시도1·정상 반환0에서 INCONCLUSIVE로 종료·소비 완료했으며 block/code 미관측·ADDRESS_NOT_OBSERVED·matched null·binding UNKNOWN이다. 재시도/전환/컴파일0, 원본31파일 hash 불변·권한 검증, 경계6개/전체557개 검사 통과. 다른 토큰은 RLUSD35소스/settings 후보 준비·JPYC6입력 바이트 동일성·JPYSC2입력을 오프라인 확인했다(54입력 불변·새 RPC/컴파일0). [잔여 작업](research/2026-10-25-token-review-remaining-work.md): Ethereum 핵심5토큰의 전체 소스·배포 연결 UNKNOWN5/5, JPYC3개 추가 체인을 포함하면8/8이며 JPYC Ethereum 프록시1개 고정 블록 일치는 별도다.

- 2026-10-25 후속 진행 승인으로 [USDT 신규 고정 해시 코드 대조 계획](research/2026-10-25-usdt-live-runtime-plan.md)을 구체화했다. 저장 compiler 출력 재사용·chainId1 단일 주소·기존 RPC_URL·최대6RPC/120초·재시도/전환0·종료 재확인·새 소비·별도 연구 보고서를 제안한다. 저장 입력25파일 hash를 확인했으며 새 RPC/컴파일/다운로드/실제 대조0이다. 정확한 외부 실행 범위의 사용자 확인 전 실행하지 않는다.

- 2026-10-25 사용자 후속 승인으로 [USDT 저장 compiler 출력 분석](research/2026-10-25-usdt-stored-runtime-analysis.md)을 완료했다. 보완 비교기의 구조 검사는 통과했지만 관측 hash가 없어 ADDRESS_NOT_OBSERVED·matched null·binding UNKNOWN이다. 별도 연구 보조 JSON/Markdown을 보존하고 기존 INVALID_RELOCATION_DATA/PARTIAL·MISMATCH·원문25파일을 유지했다. 고정 compiler 캐시3개의 hash도 확인했으며 재컴파일·RPC·다운로드·배포 대조는0회다.
- 2026-10-25 사용자 승인으로 [ADR0098](adr/0098-legacy-runtime-omitted-immutable-ranges.md)의 고정 solc0.4.18 비교기 호환성을 보완했다. 정확한 전체 버전·필드 자체 생략만 내부 빈 범위로 해석하며 compiler 원본은 보존한다. 사설 Fixture의 전체 runtime 대조/음성 경로·무HTTP 오프라인 보고서를 검증했다. 실제 USDT 재컴파일·배포 대조·외부 호출·다운로드·기존 보고서 변경은 수행하지 않았다.

- 2026-10-25 사용자 승인 [USDT 오프라인 재컴파일](research/2026-10-25-usdt-offline-recompile.md)을 완료했다. 저장된 standard JSON 후보를 고정 solc0.4.18로1회 컴파일해 runtime11075바이트·소스 함수31개·정적 entry29개를 얻었다. 새 RPC/다운로드0이며 원본7파일·후보·compiler cache3개 불변을 확인했다. 구버전 출력의 immutableReferences 누락을 보충하지 않아 별도1.2 보고서는 INVALID_RELOCATION_DATA·PARTIAL, 배포 연결 UNKNOWN이다. 기존 전체 MISMATCH/판정은 유지하며 실제 배포 대조는 이번 범위에서 실행하지 않았다.

- 2026-10-25 추가 승인 [solc0.4.18 보이는 브라우저 취득·사설 검증](research/2026-10-25-usdt-solc0418-browser-success.md)을 완료했다. metadata/artifact 각1GET·HTTP200·7139666바이트의 두 hash와 worker 전체 버전을 확인하고 [ADR0097](adr/0097-pinned-solc0418-visible-browser-profile.md)의 고정 profile을 추가했다. 구버전 생성자/fallback·selector 없는 ID별 선언·작은 양수 builtin의 제한된 AST 호환성과 guard/실패/정리를 사설 Fixture로 검증했다. 이전 두 실패·원본7파일·기존0.6.12/0.8.11 cache는 보존했다. 실제 USDT 재컴파일/새 RPC0이며 기존 source binding/판정은 변경하지 않았다.

- 2026-10-25 [USDT 보이는 Chrome 준비 실패·로컬 회귀 수정](research/2026-10-25-usdt-browser-preflight.md)을 기록했다. 실제 브라우저는 초기 탭 제어 오류로 공식 Document GET0에서 종료했다. 초기 탭을 추가 target으로 오분류해 닫는 문제를 수정하고 창 준비 helper·회귀2건과 보이는 Chrome loopback4종을 검증했다. 가상 artifact는 실제 compiler가 아니며0.4.18 취득/profile/사설 컴파일은 미완료다. 종료된 소비·deadline을 재사용하지 않았고 새 RPC/실제 USDT 재컴파일0이다.

- 2026-10-25 사용자 지시로 [공식 compiler 거절 시 브라우저 가이드](COMPILER_BROWSER_ACQUISITION.md)·[ADR0096](adr/0096-browser-compiler-acquisition-guidance.md)와 AGENTS 규칙을 반영했다. 후속 취득 작업에서 같은 공식 버전/파일을 보이는 임시 창으로 확인하며 방식 변경만으로 같은 승인을 반복 요청하지 않는다. 직접/브라우저 별도 소비·각2GET·hash/전체 버전·사설 검증과 거절 시 중단을 유지한다. 이번 변경은 문서만이며 브라우저 송신/추가 다운로드0, 현재0.4.18 compiler 확보·검증 미완료 상태를 보존한다.

- 2026-10-25 사용자 승인 [USDT solc0.4.18 단발 취득](research/2026-10-25-usdt-compiler-acquisition.md)을 [ADR0095](adr/0095-bounded-usdt-solc0418-acquisition.md)의 경계로 시도했으나 첫 metadata1GET이 HTTP403·응답 코드1010으로 실패 종료했다. 소비/오류/receipt·원본7파일 불변을 보존했고 artifact/compiler/profile/새RPC0이다. **0.4.18 사설 호환성 검증은 미완료/NOT_TESTED**이며 기존 MISMATCH/UNKNOWN을 유지한다. 실패 시도 기록이 검증 완료를 뜻하지 않는다. 남은 요청 수 재사용·다른 경로 전환은 하지 않았다.

- 2026-10-25 사용자 승인 [Ethereum USDT 기술 입력 준비](research/2026-10-25-usdt-technical-input-preparation.md)를 완료했다. 저장7파일 불변과 단일 소스/metadata/ABI 연결·16011바이트 standard JSON 후보를 확인했다. 서비스 재컴파일↔과거 관측 전체 코드는11075바이트 중31바이트 차이로 MISMATCH를 유지한다. 차이는 서비스 CBOR 표시 구간 안이지만 원인/배포 연결 증명으로 승격하지 않는다. 실행에 부족한 것은 허용 solc0.4.18 profile과 현재 archive 규칙의 고정 hash 관측이다. 새 외부 요청·대상 compiler·기술 검토 CLI 실행0, 기존 UNKNOWN/판정/원문 보존이다.

- 2026-10-25 사용자 승인 [JPYC immutable·빌드 입력 후속 조사](research/2026-10-25-jpyc-immutable-input-research.md)를 완료했다. 공식 주소 재확인·공개 원문4GET 저장·고정 AST ID173의 `__self=address(this)` 구문을 확인했다. 과거 UUPS 원문은 CRLF 차이로 바이트 DIFFERENT이며 현행 배포 원본으로 승격하지 않는다. 실제 배포 build/immutable 제출 근거는 미확보이고, 새 RPC·compiler 실행·대조 실행0이다. 후속 오프라인 입력·검증 계획만 작성했으며 기존 구현체 UNKNOWN·전체 PARTIAL·소비 완료를 유지한다.

- 2026-10-25 사용자 승인 [JPYC Ethereum 단발 읽기](research/2026-10-25-jpyc-token-review-live.md)를 RPC13회로 완료·소비했다. chainId1·블록26264212의 hash pin/종료 재확인과 EIP-1967 구현체 포인터/코드를 관측했다. 저장2입력 컴파일 성공, 프록시 전체 runtime 일치로 해당 블록 소스 연결 CONFIRMED·구현체 immutable 미제공 UNKNOWN·전체 PARTIAL이다. getter/재시도/전환/다운로드0·비용 UNKNOWN·기존 오프라인15파일 불변, 원문/DB/UI·기존 판정 보존. 이는 실제 dispatch·전체 구현체 배포 대응·지원/안전 인증이 아니다.

- 2026-10-25 [JPYC Ethereum 오프라인 소스 분석](research/2026-10-25-jpyc-offline-source-review.md)을 완료했다. 사용자 승인 Chrome metadata/artifact 각1회는 HTTP200이며 solc0.8.11의 고정 hash·전체 버전을 확인하고 [ADR0094](adr/0094-pinned-solc-0811-browser-artifact.md) profile과 좁은 AST 호환성을 추가했다. 저장 proxy/implementation2입력 컴파일 성공·명시 진입점39개 분석, 구현체 immutable 값 미제공으로1.2 보고서는 PARTIAL·배포 binding UNKNOWN이다. 새 RPC/DB/UI0·기존 실패/원문/판정 유지, 검사541개 통과. 다른 PC의 cache 자동 취득은 없다.

- 2026-10-25 별도 승인된 [JPYC compiler v2 취득](research/2026-10-25-jpyc-compiler-acquisition.md#사용자-승인-후-v2-실제-실행)은 metadata1GET에서 HTTP403·오류 코드1010을 확보하고 실패 종료했다. 원래 실패와 분리했으며 artifact/compiler/profile/대상 분석·RPC0이다. 거부 주체/정책은 UNKNOWN, 다른 배포 경로는 새 승인 전 미실행이다.

- 2026-10-25 사용자 승인에 따른 [JPYC Ethereum compiler 단발 취득](research/2026-10-25-jpyc-compiler-acquisition.md)은 첫 metadata1GET의 HTTPError로 실패 종료했다. 재시도·artifact 취득·compiler 실행·profile 변경·대상 분석·RPC0이다. HTTP 상태 코드/원인 UNKNOWN과 기존 배포 binding UNKNOWN을 유지한다. [ADR0093](adr/0093-bounded-jpyc-compiler-acquisition.md)의 이번 예외는 소비 완료이며 추가 취득은 새 승인 대상이다.

- 2026-10-25 [JPYC Ethereum compiler 후속 계획](research/2026-10-25-jpyc-compiler-plan.md)을 구체화했다. 저장 후보2개 hash·Solidity6/17개를 재확인하고 solc0.8.11 취득 최대2GET·고정 profile·오프라인 분석의 제안 한도를 정했다. 계획만 완료했으며 다운로드·대상 compiler 실행·profile 변경·RPC0이다. 실제 취득·실행은 추가 사용자 승인 후 진행한다.

- 2026-10-25 사용자 후속 지시에 따라 [JPYC/JPYSC 공개 HTML 취득·선택 소스 검토](research/2026-10-25-jpy-public-html-source-review.md)를 수행했다. 공식2·계약5·표시 구현체4페이지를 비공개 저장하고4배포의 proxy/implementation8묶음·Solidity119파일·import161연결/미해결0을 확보했다. Kaia는 HTML만 확보해 추출 불가/INCONCLUSIVE를 유지한다. 수동 함수/modifier 검토는 별도 SOURCE_REVIEWED이며 compiler/AST·RPC·배포 비교·권한 행사0, 제품 지원·기존 판정/원문·DB/UI 변경0이다. 앞선 로컬 입력 미확보 기록은 과거 결과로 보존한다.

- 2026-10-25 [JPYC/JPYSC 5배포 로컬 기술 입력 점검](research/2026-10-25-jpy-technical-input-inventory.md)을 완료했다. 저장 주소·chainId와 시장 원문 hash 연결은 확인했으나 실제 계약 소스·의존 closure·전체 compiler/settings·소스 provenance 연결은 미확보다. 이름이 발견된 사설 smoke Fixture는 제외하고 NOT_TESTED/UNKNOWN을 유지했다. 새 외부 조회·컴파일·DB/UI 변경은 없으며 다음 기술 검토 대상과 제공 입력 확인이 필요하다.

- 2026-10-25 [5코인 네트워크별 저장 근거 현황표](research/2026-10-25-five-coin-network-evidence.md)를 작성했다. 등록 후보33·당시 공급량 선정27·기존 기술 프로필8·선택 토큰 소스 검토4를 구분하고 공급량/전송량·직접 체인 관측·배포 연결을 별도 열로 연결했다. 상세 기술 검토 CLI 실제 실행은 Ethereum USDC1배포이며 전 네트워크 완료로 확대하지 않는다. Kaia 미일치·JPYSC 누락·XRPL 직접 연구/공통 Adapter 미완료·기존 UNKNOWN/NOT_TESTED를 보존했다. 새 외부 호출·원문/DB 재검사·키·DB/UI 변경은 없다.

- 2026-10-25 기존 pin의 solc0.6.12를 고정 cache profile로 연결하고 USDC 저장 관측을 RPC0회로 오프라인 분석했다. 소스 컴파일·함수91/진입43 추적은 성공했으나, 명시 library 설정을 반영한 별도 후보도 전체 runtime이 불일치해 배포 연결 UNKNOWN·PARTIAL을 유지한다. 기존 실제 보고서/소비·원문·1.0/1.1을 보존한다. 후속 후보 소스 검토표에 발행/소각·정지/제한·역할·승인/서명 경로·초기화/복구를 정리했으며 V2_2 override를 반영했다. SOURCE_REVIEWED는 후보 소스만의 연구 상태이고 proxy 업그레이드·감사 대응은 UNKNOWN이다. [ADR0092](adr/0092-pinned-legacy-compiler-and-archived-review.md), [구체적 결과](research/2026-10-25-usdc-offline-source-review.md).

- 2026-10-24 사용자 동의로 Ethereum USDC 기술 검토 CLI의 실제 단발 읽기를 수행했다. RPC20회·getter7개 관측과 고정 블록/해시 재확인은 성공했다. 소스는 solc0.6.12가 제품 경로에 연결되지 않아 NOT_RUN/배포 연결 UNKNOWN, 전체 PARTIAL이다. 재시도·추가 compiler 실행·새 키·DB/UI 변경은 없으며 비공개 원문을 보존했다. [실제 범위와 한계](research/2026-10-24-usdc-token-review-live.md).

- 2026-10-24 후속 승인으로 기술 검토1.1을 추가했다. 진입 함수별 상속/modifier/내부 호출·조건·저장값 변경, 직접 caller 비교의 소스 구문, 타입 기반 동작 후보, 명시 library 링크·제출 immutable의 조건부 전체 runtime 대조, 감사 source snapshot의 경로/바이트/설정 대조와 무HTTP `--offline`을 제공한다. 권한 보장·생성자 재현·감사 진위/배포 대응은 자동 확정하지 않으며 기존1.0과 실제 저장 근거를 보존한다. [ADR0091](adr/0091-offline-token-static-path-analysis.md). 외부 실제 토큰·다른 compiler 준비는 미실행이다.

- 2026-10-24 사용자 새 기준의 읽기 전용 EVM 토큰 기술 검토 CLI를 추가했다. 명시 chainId/주소·EIP-1898 해시 조회·소스 재현/전체 runtime 비교·AST 검토 자료·getter·감사 원문·별도 JSON/Markdown·SHA256 묶음을 제공한다. 기존 PASS/FAIL·SOURCE_REVIEWED·UI/DB를 변경하지 않는다. 사설 두 EVM 체인/시험 토큰으로 검증하며 실제 다섯 토큰의 외부 배포 검증, 권한 의미/감사 대응 자동 증명, AI/Slither는 미실행이다. [ADR0090](adr/0090-readonly-token-technical-review.md), [실행·미지원 범위](TOKEN_TECHNICAL_REVIEW.md).

- 2026-10-24 사용자 참고 이미지에 따라 Overview 전체를 실제 수치 카드2개, 공급량 추이/네트워크 순위, 전송량 추이/도넛의 공통 그리드로 정리했다. USD/JPY·단일 토큰, 공급량1Y/3M/30D·규모/증감률과 전송량7D·개념 툴팁을 유지한다. 도넛은 동일 집계일의 표시 네트워크 관측량만 사용하고 날짜·원본·누락을 보존한다. 출처/긴 설명은 재추가하지 않았으며 새 수집·API·키·DB 변경은 없다. [ADR0089](adr/0089-balanced-stored-overview.md), 기존 읽기 경로는 [ADR0088](adr/0088-yearly-token-network-overview.md).

- 2026-10-24 사용자 UI 복원 요청으로 `/`·`/index.html`의 기본 화면을 기존 legacy 대시보드로 되돌렸다. `/legacy.html`도 같은 UI이며 다크·라이트와 기존 기능을 유지한다. 통합 분석 화면은 `/atlas.html`에서 별도로 열 수 있다. 외부 수집·DB 변경은 없다.

- 2026-10-24 후속 요청으로 Atlas 기본 화면의 코인·지표·체인·기간을 URL과 공통 모델로 연결했다. KPI/추이/체인 비교/정렬·페이지 상세 표·관측 선택·공백·수집 상태와 오류 후 마지막 정상값을 제공한다. 기존 실제 저장본/수집 CLI를 재사용하며 신규 외부 수집·반복 예약·DB 접속·연구 원문 공개는 없다. 출처 표시는 제외한다. [ADR0086](adr/0086-unified-stored-observation-dashboard.md), [실행·참고·제한](ATLAS_DASHBOARD.md). 실제 검증은 이번 인계문을 따른다.

- 2026-10-24 사용자 승인으로 저장 자료 중심 로컬 재설계 시안 `/atlas.html`을 추가했다. 공급량·전송량·가격·조사 범위를 분리하고 기존 공개용 projection만 재사용한다. 새 연구 표본의 값·비공개 원문·DB 입력은 추가하지 않는다. [설계와 가격 표시 계약](ui/ATLAS_REDESIGN.md), [ADR0085](adr/0085-stored-data-ui-redesign.md). 후속 사용자 승인으로 `/`·`/index.html`을 Atlas로 전환하고 기존 화면은 `/legacy.html`에 보존했다. `/atlas.html` 별칭과 수집 경로는 유지한다. 후속 승인으로 조사 범위에 자산 프로필·비교 진입점과 기술 검증·보고서 탐색을 배치하고 기존 근거 화면에서 조사 범위로 돌아오도록 연결했다. 다음 연속 진행으로 Atlas 내부 프로필·비교 화면도 구현하여 기존 공개용 index/근거 모델만 재사용한다. 실제 검증은 이번 인계문을 따른다.

- 대시보드는 실제 자산의 저장 조회만 표시한다. 개발용 Fixture는 UI 집계/목록에서 제외하고 원본·CLI 검사는 보존한다. 이 PC의 UI는8보고서/111항목, 원본 저장소는15보고서/202항목이다.

- Overview 자산별/네트워크별 검증 랭킹: SCENARIO_SUCCESS_V1의 통과 점수·판정 완료 비율을 항목 수로 합산하고 정렬 기준을 선택한다. 미산정은 순위 없음, 정확한 동점은 공동 순위다. 시장 지표와 분리한다. [ADR0043](adr/0043-overview-asset-network-rankings.md), 최종 검토 상태는 최신 인계문을 따른다.
- 기본 Overview: 일반 이용자를 위한 토큰·네트워크별 공급량 추이·네트워크별 공급량 비교·시장 비교표를 먼저 표시한다. 기술 검증은 기본 접힌 전문가용 보조 영역에 두고 검토한 자산/네트워크 수·통과 점수·판정 완료 범위·항목 이동을 제공한다. 기존 집계 공식은 [ADR0038](adr/0038-overview-scenario-results.md), 현재 화면 범위는 ADR0043을 따른다.
- EVM/ERC-20·TRON 읽기와 프로그램이 생성한 격리 사설 Fixture 검사.
- Solana mint/명시 Token Account, XRPL issuer/명시 holder trust-line의 공통 읽기. 공개망 거래·서명·실제 관리자 권한 행사는 없다.
- 로컬 저장 근거의 항목별 현황, 자산 프로필·비교, 보고서 문서. 소스 확인과 실제 실행 판정을 구분한다.
- 실제 저장 시장 자료 화면 `#live`: 코인 전체 유통량 순위, 같은 코인의 체인별 총공급량, 관측 이력·원본 수량·출처, 공급자 네트워크 상태. UI는 다크/라이트·모바일을 지원하며 순위 행 선택으로 비교 대상을 바꾼다.
- 시장 그래프: 가격·유통량·코인 전체 총공급량의 영역형 차트, 순위별 작은 추세선, 기간 선택·포인터/키보드 관측 선택·원본 출처 연결. 의미와 저장 이력 제한은 [그래프 안내](MARKET_CHARTS.md)를 따른다.
- 등록 모델: coin/network/deployment ID, 계약·mint·issuer+currency 식별. 현재3코인/4네트워크/8발행 자산. 등록은 Adapter 지원 인증과 별도다.
- Arkham 체인별 `totalSupply`와 전체 `circulatingSupply`를 분리한다. XRPL `gateway_balances.obligations`는 별도 범주이며 순위·합계에 섞지 않는다.
- 서버 수동 단발 Arkham 수집(`npm run market:collect`): 최대7회 읽기·실패 중단·공통 writer 잠금·원자적 발행·별도 수집 상태. 웹 요청은 외부 호출을 실행하지 않는다. [ADR0037](adr/0037-manual-market-collector.md).
- 5분 자동 수집 CLI(`npm run market:watch`): 기본12회·최대84 GET 후 종료, 단조 시계·중복 잠금·실패 중단·UI 실행 기록. [실행 안내](MARKET_AUTO_COLLECTION.md), [ADR0041](adr/0041-five-minute-market-collection.md). 웹은 계속 저장본만 읽는다.
- 새 PC 환경 진단·빈 설정 생성·키를 출력하지 않는 읽기 CLI wrapper·고정14보고서 로컬 이동. [설정 순서](NEW_PC_SETUP.md).

원본 집합을 가진 PC에서는15보고서/202항목을 복원할 수 있다. ADR0038 이후 원본5개 시장 입력의 기초 관측은18개이며, 초기 단발 수집 자료와 합친 기초 관측은30개였다. 이후5분 수집 이력은 계속 추가되므로 현재 수량은 최신 인계문과 실제 DB/화면을 따른다. 과거 입력의 시각과 기존 XRPL의2개 관측은 그대로다. 새 PC에서의 새 관측·새 실행으로 해석하지 않는다. 원본 집합은 Git에서 제외한다. 웹60초 갱신은 저장본만 읽는다.

## PostgreSQL 설계와 로컬 CLI

- 확장 등록 DB: [ADR0053](adr/0053-registration-database-and-filtered-history.md)의 별도 atlas_registration v1에 검토 metadata/측정 계약·상위10 선정·불변 일별 source/coverage/value를 보관한다. owner 수입과 reader의 coin/metric/selection/날짜 제한 조회를 제공하며 기존 수집기/대시보드는 유지한다. 실행은 [등록 안내](MARKET_REGISTRATION.md), 실제 Supabase 적용·행 수·검증은 최신 인계문을 따른다.
- 추가 네트워크 백필: USDT10/USDC10/RLUSD2 조합에 일별 유통량·발행 잔액13,206개 값을 저장하고 원문/DB 대조와 재수입 추가0을 확인했다. JPY를 포함한 총15,000개 값이며 [날짜별 확보 범위](TOP10_NETWORK_BACKFILL.md)는 시리즈마다 다르다. 그래프 연결은 ADR0054를 따르며 새 영역의 일별 자동수집은 ADR0055를 따른다.
- 확장 공급량 UI: [ADR0054](adr/0054-registered-supply-overview.md)의 별도 index/history read-only endpoint로 Overview에5코인·최대10개 네트워크를 연결했다. 기존 시세/검증 랭킹과 분리하며 짧은 이력·날짜 공백·JPY 단위·발행 잔액을 구분한다. [ADR0055](adr/0055-registered-daily-collection.md)에서 검토된 선정에 고정한5코인 일별 수집·최소 권한 writer·코인별 예약/실패 격리를 추가했다. 매일 상위10 재선정·서비스 자동 재시작은 후속이다.

사용자가 Supabase/PostgreSQL과 다수 스테이블코인·네트워크 확장을 전제로 설계를 요청했다. [ADR0039](adr/0039-postgresql-market-storage-design.md)의 후보 DDL·범위/지표별 시계열·공통 요청 근거·legacy 이전·용량/조회 설계를 작성했다. 로컬 격리 PostgreSQL17.11에서 제약 시험과 합성30코인×3지표×1440분의129,600관측을 측정했다. 메타데이터/인덱스 포함 약42MB/일이며 원문·backup은 별도다. 정본은 [저장 설계](design/POSTGRESQL_MARKET_STORAGE.md), 실제 수행/미검증 구분은 [검증 기록](design/POSTGRESQL_MARKET_VALIDATION.md)이다. [ADR0040](adr/0040-postgresql-market-import-and-query.md)의 명시적 init/partition/grant/import·저장/제한 조회 CLI와 서버 환경 연결을 구현했다. 격리 로컬 DB에서 기존30관측/네트워크6행 이전·legacy/바이트/시각 보존과 재이전, 실제 비관리자 역할/RLS·동시성·rollback을 검증했다. [실행 안내](POSTGRESQL_MARKET_CLI.md). 실제 Supabase PostgreSQL17.11에 인증서를 검증하는 TLS로 연결하여 초기화·2026-10/11 파티션·writer/reader 전용 로그인과 권한을 준비했다. 명시적 웹 DB 읽기 모드는 ADR0044로 추가했으며 공개 배포는 아직 하지 않았다. ADR0042의 `market:watch --database`와 읽기 전용 `market:db:check`를 구현했으며, 소유 로컬 DB로 저장/접속 점검/복구를 검증했다. 실제 원격 writer/reader의 두 달 읽기 전용 READY 점검을 완료했고 .env.local은 writer로 전환했다. 관리자/reader 접속 정보는 Git 제외 비공개 설정으로 보관한다. 실제 원격으로 기존18파일의246관측/42네트워크 이력을 이전하고18파일 재이전이 모두 UNCHANGED임을 확인했다. 5분 수집은 명시 DB 모드로 전환해 새 projection/JSON과 DB의 원본 hash 및 행 수를 대조했다. 이후 누적 수량은 최신 실행 기록을 따른다. [새 프로젝트 설정](SUPABASE_SETUP.md).

- 공급량 화면 개선: [ADR0056](adr/0056-supply-scale-and-source-cache.md)의 자동 로그 눈금/실제0 분리, 최대10개 목록 높이 제한, 같은 일별 source 재사용/조건부 HTTP, 확장 코인 기본정보 hover를 추가했다.

- 코인 시장 비교표: [ADR0057](adr/0057-global-coin-market-comparison.md)의 등록 v3에 상세 응답의 전체 유통량·USD 가격을 저장한다. Overview는5코인을 연동 통화별로 묶고 기존3코인의 Arkham 지표와 엔화2코인의 일별 지표를 명시적으로 선택한다. 총공급량/24시간 거래량 부재는0으로 대체하지 않는다. 같은 수집 응답을 재사용하며 추가 API 호출은 없다. 실제 적용·검증 상태는 최신 인계문을 따른다.

- 원화 가격·시장표 밀도: [ADR0058](adr/0058-reference-krw-prices.md)에 따라 USD/KRW 선택·ECB 기준일 표시·BigInt 참고 환산을 추가한다. 토큰 정보를 한 줄로 묶고 미확인 거래량 열을 숨겨 여백을 줄인다. 환율은 private 일별 snapshot이며 웹 요청이 수집하지 않는다. 실제 원격 FX timer 설치는 미실행이다.

Allium은 [Explorer 표본](research/allium-samples/README.md)에 이어 [최근 전송량·공급량 차이](research/allium-samples/followup.md)를 분석했다. Ethereum 5코인 전송량 60행의 최신 관측일은 10/21이며 10/22 누락은 0으로 바꾸지 않는다. USDC·USDT 7일 공급량 비교는 날짜 경계와 브리지/준비금 정의 차이를 보여주지만 브리지 원문 상세만으로는 잔차가 남는다. 원본 수치형·실제 마감 시각·다른 체인 지원은 추가 확인 대상이다. 실패 SQL과 교정 실행을 보존했다. 연구 후 전송량 저장·UI는 아래 단계로 연결했으며 공급량 기본 전환·Allium 자동 수집은 미구현이다.

## 토큰 기본정보

- [Allium 다중 체인 저장 조사](ALLIUM_SURVEY_DATA.md): ADR0067의 별도 atlas_survey에 고정11배포·7일 공급량70행·전송량67행과 미일치2행을 snapshot2개로 저장하고 Overview의 종류·토큰·네트워크 필터 표에 연결했다. 재입력0·137관측의 값/null/시각/hash 대조와 기존6개 schema/자료 보존을 확인했다. 누락/미일치와 기존 Ethereum 표본을 보존한다. 시험·화면 검증 결과는 이번 인계문을 따른다. 새 공급자 호출·자동 수집·기본 공급량 전환은 없다.

- [일별 전송량 DB·UI](ACTIVITY_DATA.md): Allium Ethereum5코인 60행을 별도 atlas_activity에 저장하고 전체 현황에 최신 기준일과 표시했다. 같은 원문 replay0·최소 권한·수정 이력·구시각 import·동시성·원자성 검증. 기존 schema와 공급량은 유지한다. Allium 기본/DeFiLlama 보조 방향은 ADR0059이며 공급량 전환·실제 보조 연결·Allium 자동 수집은 후속이다.
- [Allium 조사 계획·단발 실행기](ALLIUM_COLLECTION_PLAN.md): ADR0060/0061의 고정11배포·7일 조사와 영속 예약을 구현했다. 후속 사용자 승인 ADR0065/0066의 수동 예외·GET 지수 백오프·개별 SQL echo 검토로 실제 SQL3회/17HTTP를 완료했다. [실제 결과](research/allium-samples/survey-2026-10-23.md)는 등록11·공급량70·전송량67 OBSERVED이며 Kaia JPYC 일별 미일치·JPYSC 전송량3일 미확보를 구분한다. meta 비용 합계0.13373333333333335EU, 과금 한도 UNCONFIRMED·DB/스케줄 변경0. XRPL2개 NOT_TESTED·공급량 기본 전환·일별 수집 미구현은 유지한다.
- [Allium 별도 공급량 저장·조회](ALLIUM_SUPPLY_DATA.md): ADR0062/0063의 오프라인 CLI·atlas_supply를 기존 비공개 DB에 설치하고 검토 Ethereum USDC/USDT14행 입력·대조·재생0을 확인했다. 기존5개 schema·권한/정책·시장 표본180건·전송량60건 보존. API 역할의 DB 권한·전환 경로와 source pin을 검사했으며 Dashboard exposed schemas는 UNKNOWN이다. [ADR0064](adr/0064-reviewed-allium-supply-preview.md)로 DB 읽기 모드 Overview의 별도 과거 표본 표를 연결했다. 기존 공급량의 기본 전환·실제11배포 지원·일별 수집으로 표시하지 않는다.

- 공급량 차트는 축 눈금에 `눈금 (tokens)`를 표시하고 `1,000억`처럼 정리한다. 가장 큰 네트워크의 최신 실제 값은 선 끝에 별도 색상으로 표시하며 hover/키보드 tooltip 중에는 숨겨 겹침을 줄인다. 로그 축·원본 공급량·증감률 계산은 유지한다.

[ADR0045](adr/0045-token-profile-catalog-and-popovers.md)의 별도 private DB catalog에8개 deployment의 표준·설명·식별자·공식 출처/확인시각을 revision으로 저장하고 reader API로 조회한다. Overview와 시장에서 마우스·키보드·모바일 정보 패널을 제공한다. 실제 Supabase8개 등록/재등록/조회와 기존462관측/78네트워크 이력 보존을 확인했다. 이는 기본정보이며 지원/검증 PASS와 별도다.

## 아직 구현하지 않은 것

- 공급자 계정의 실제 rate/credit 계약 확인, 보관기간 정책, 자동 재시도/backoff, 자동 공급자 전환. 앱의 날짜별 호출 상한과 재시작 가능한 worker는 ADR0048로 구현했다.
- 다수 시리즈의 선택/페이지 조회·롤업/보관기간 정리·서비스 배포·공개 호스팅. 실제 Supabase 이전과 제한된5분 수집 저장은 완료했다.
- 실제 안전성 점수/등급. Overview의 시나리오 통과 점수는 별도 집계다. 가상 `Market preview`의 점수는 제품 판정이 아니다.
- 네이티브/브리지별 중복 제거, 서로 다른 공급자의 공급량 정의 통일, registry v2/기존 화면의 동일 coin/network 복수 deployment 매핑(DB schema는 허용).
- 거래량 순위: totalVolume 기간·단위 확인 전 비교를 보류한다.
- Arkham WebSocket. 현재 목표에는 도입하지 않기로 했다.

## 다음 개발 단위

2026-10-24 저장된 Allium 가격3종의 [오프라인 필드 계약](research/provider-data-use-priorities-2026-10-24.md#재사용-가능한-가격-검토)과 [Arkham 시장·가격 이력 검토](research/provider-data-use-priorities-2026-10-24.md#arkham-시장가격-이력의-오프라인-필드-관측)를 구현했다. 고정 receipt/요청/source hash·숫자 lexeme·UTC/기간·누락/오류를 검사하고 실제5종의 FIELD_CONTRACT_OBSERVED 비공개 보고서를 생성했다. Arkham 시장14개 숫자 필드와 이력1225점을 관측했으며 전체 코인 유통량/총공급량과 체인별 공급량을 구분한다. Arkham 응답 자체 자산 식별·시장 기준시각, 가격 통화·완전성·공급자 정의는 UNKNOWN, 기존 원본/판정/시각을 유지한다. 새 API·키·DB/UI·소비 슬롯·기본 공급자 변경은 없다.

이어 [Allium 공급량·전송량 오프라인 대조](research/provider-data-use-priorities-2026-10-24.md#allium-저장-공급량전송량의-오프라인-대조)를 완료했다. 기존4개 snapshot의274관측을 당시 DB 조회본과 비교해 차이0·입력42파일 불변을 확인했다. Kaia 미일치/JPYSC3일 누락·십진 문자열/null·정밀도/집계 시간대 미확인을 유지하며 probe_id 접근 표본6건은 제외했다. 현재 DB/브라우저 재검사는 하지 않았다.

[토큰 기본정보·등록·보유자 표본 검토](research/provider-data-use-priorities-2026-10-24.md#토큰-기본정보등록보유자-표본의-오프라인-검토)도 완료했다. 저장4응답의 receipt/고정 요청/원문 hash와 로컬 Ethereum USDC 식별을 대조하고100개 중복 없는 상위 주소 표본의 숫자 문자열을 보존했다. 공급량 정의·전체 보유자 분포·기관 목록 완전성·최소 단위 정확성은 미확인이며 새 API/DB/UI 변경은0이다.

[전송·지갑형·포지션·시장 목록 검토](research/provider-data-use-priorities-2026-10-24.md#전송지갑형포지션시장-목록의-오프라인-검토)로 우선순위1~5의 오프라인 검토를 완료했다. 저장4응답·입력9파일 불변을 확인했다. Arkham 전송은 BLUR1건이며 Allium 거래의 전송 자산도 USDC와 다르다. Allium 포지션4개는 USDC 컨트랙트 주소에 대한 공급자 응답이고 시장1개는 USDC quote의 perp 목록이므로 고객 보유/활동·스테이블코인 전송·배포 지원으로 해석하지 않는다. 거래/시장 문자열 cursor와 포지션 null cursor/total·누락·단위 UNKNOWN을 보존했다. API/DB 접속·기존 DB/UI 변경0이며 다음 제품 활용 범위는 사용자 확인이 필요하다.

[ADR0080](adr/0080-bounded-allium-geographic-data.md)의 Allium 지리 자료 수집/UI 요청과 후속 직접 호출 지시를 진행했다. 브라우저 HTML에서 Geo 링크를 확보했지만 문서 로그인이 필요했다. 계정 지리 메타데이터와 공개 공식 geo_balances_daily를 각각 직접1회 조회했으며 합계2run/6HTTP는 HTTP200 뒤 provider `failed`·UNKNOWN으로 종료됐다. 상세 사유는 미확인이다. UI에는 직접 조회한 잔액 INCONCLUSIVE/미확보·사용량/국가간 흐름 NOT_TESTED를 연결했다. 검토된 잔액 집계 표/필터 경로는 가상 자료로만 확인했으며 실제 국가별 숫자는 **미확보**다. 두 슬롯을 재소비하지 않으며 기존 live-once·원문·공급량/전송량을 보존했다. 근거는 [조사 결과](research/allium-geography-availability-2026-10-24.md)를 따른다.

[ADR0078](adr/0078-windowed-survey-storage.md)의 동적7일 기간 저장·조회·표시를 완료했다. 개발 DB의 비파괴 v2 upgrade 후 기존4source/version1·137관측·6schema 보존을 확인했다. 후속 [ADR0079](adr/0079-finite-offline-schedule-simulation.md)는 가상 자료·새 소유 PG17에서 유한 UTC tick 반복 실행과 중복/재시작·ACK 유실·누적 예산·시간 경계를 검증한다. 실제 timer/스케줄·새 공급자/usage 호출·기존 DB 변경은 없다. 실제 반복 실행·비용·예약 범위는 별도 사용자 확인이 필요하며 소비된 live-once를 재사용하지 않는다.

[ADR0077](adr/0077-offline-live-survey-storage.md)로 실제 수집 저장본의 오프라인 입력·기존 표 연결을 완료했다. [저장 현황](ALLIUM_SURVEY_DATA.md)의 source2→4·최신137관측·원래 시각/미일치/누락 보존·기존6schema 불변을 확인했다. 새 Allium 호출·DB schema/권한 변경·일별 자동 수집은 없다. 다음 동적 기간/자동 수집 범위는 사용자 확인 후 결정한다.

[ADR0076](adr/0076-user-authorized-local-live-collection.md)의 사용자 명시 실제 호출 선택으로 로컬 수동 1회 supply/volume CLI와 같은 lease의 개별 echo 검토 checkpoint를 추가했다. [실제 수집](research/allium-samples/live-2026-10-23.md)은 SQL2회/12HTTP 모두200·공급량70/전송량67 OBSERVED이며 Kaia 미일치·JPYSC 전송량3일 미확보를 보존했다. 두 echo 원문별 SOURCE_REVIEWED·최종 SUCCEEDED·legacy 불변을 확인했다. 계정 증거 없이 허용한 실행 예외이며 실제 비용 인증·조직 예산 전환·일별 자동 예약·DB/UI 연결 완료를 뜻하지 않는다. 검증 결과는 해당 인계문을 따른다.

[Allium 실제 비용 증거 제공 가능성 조사](research/allium-cost-evidence-availability-2026-10-23.md)를 완료했다. 공개 CSV/한도 기능 설명은 확인했지만 계정별 설정·요청별 비용 귀속/최종성은 미확인이다. 실제 전환은 계속 차단하며 후속 계정 자료의 비공개 오프라인 검토 범위는 사용자 확인이 필요하다.

Allium 일별 수집의 [설계·비용 통제 검토](adr/0068-daily-allium-design-and-cost-controls.md)를 완료했다. 권고는 비활성 daily 계획·조직 공통 예산 원장부터 검증하는 것이며, 실제 일별 수집은 DISABLED다. 기존 manual-once·고정 조사·UNKNOWN을 유지하고 공급자 강제 한도·초과 과금 설정은 UNCONFIRMED로 남긴다. 이번 검토에서 공급자 API/usage/SQL·DB·스케줄 변경은 없다. 구현과 실제 실행은 별도 후속이다.

후속 사용자 승인으로 [ADR0069의 비활성 일별 Lab](adr/0069-offline-daily-allium-ledger-lab.md)을 구현했다. 1~3단계의 계획·가상 authorization·정확 EU 계산·새 소유 PG Fixture의 조직 공통 append-only 예약/usage/intent/가상응답과 장애 검증이다. 실제 공급자 호출·운영 DB 설치·기존 예약 전환·동적 DB/UI·스케줄은 없다. 대사 차감은 c_i=0으로 닫아 두며 trusted checkpoint 없는 꼬리 삭제 검출은 보장하지 않는다. 다음 범위는 기존 예약/소비 전환 계획과 checkpoint/대사 검토다.

[ADR0070의 전환·영속 checkpoint/대사 검토](adr/0070-legacy-allium-transition-and-checkpoint-review.md)에서 기존 로컬18개 intent/response·3개 UNKNOWN/검토 연결과 전후 원본 무변경을 읽기 확인했다. 실제 전환은 TRANSITION_BLOCKED다. 저장 usage는 run 전 자료이며 할당기간·안정 조직 연결·비용 상한/귀속이 미확인이다. 별도 비공개 검토 JSON만 보존했고 새 호출/예약·운영DB 변경은 없다. 다음 권고는 가상 자료/새 소유 PG Fixture의 영속 checkpoint publisher·복원 대사 검증이며 실제 비용 차감/legacy 이관은 포함하지 않는다.

후속 사용자 승인으로 [ADR0071의 영속 publisher Fixture](adr/0071-offline-durable-checkpoint-fixture.md)를 구현했다. 불변 record·exclusive publisher/CAS·별도 trusted head·pin된 가상 송신 gate와 DB/저장소/공동복원·ACK/commit 유실·옛 intent 차단을 검증한다. 기준까지 함께 복원되는 경우의 freshness는 인증하지 않는다. 실제 legacy는 계속 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0이며 운영 연결/호출/스케줄은 추가하지 않았다. 최신 시험 결과는 이번 인계문을 따른다.

후속 승인으로 [ADR0072의 가상 원문 보존·import-only 복구 Fixture](adr/0072-offline-response-evidence-import-fixture.md)를 구현했다. 원문 바이트와 송신 ancestry를 결합하고 중복 import/commit ACK 유실·복원 오류를 검증한다. 복구 API는 읽기/import/게시만 제공하며 원래 UNKNOWN·예약·c_i=0을 유지한다. 실제 공급자 호출·legacy 이관·비용 차감·운영 연결은 없다. 검증 결과는 이번 인계문을 따른다.

후속 진행으로 [ADR0073의 오프라인 대사 준비 검토 보고서 Fixture](adr/0073-offline-reconciliation-review-fixture.md)를 추가했다. 별도 review-only factory는 publisher를 DB read-only transaction/commit까지 pin하고 exact published head와 원문을 확인한다. 미송신·미import·일반 응답·import 검토와 result 내용을 구분하며 비용 귀속/최종성은 UNKNOWN·c_i=0으로 보존한다. 실제 차감/전환/호출·스케줄·웹 연결은 추가하지 않았다. 다음 범위는 별도 사용자 확인이 필요하다.

[ADR0074의 비용 귀속·최종성 증거 계약](adr/0074-cost-attribution-evidence-contract.md) 설계를 완료했다. 필요한 증거와 향후 시험 기준의 정본이며 공급자 지원·실제 최종성은 미확인이다. 현재 API와 c_i=0을 유지한다. 후속 읽기 전용 가상 증거 검토 구현은 ADR0075를 따른다.

후속 승인으로 [ADR0075의 읽기 전용 가상 비용 증거 검토 Fixture](adr/0075-read-only-synthetic-cost-evidence-review.md)를 구현했다. 조직/키·기간/UTC 경계·정확 EU·operation/송신·포함/최종성 참조·중복 후보·버전/정정 차단 사유를 검토한다. PG reader 조회는 기존 pin/read-only 경계를 유지한다. 가상 일관성만 판정하고 실제 귀속/최종성 UNKNOWN·c_i=0을 유지하며 공급자 호출·실제 배분/전환은 없다. 다음 범위는 별도 사용자 확인이 필요하다.

[ADR0044](adr/0044-read-only-database-market-preview.md)의 DB 읽기 전용 시장 API/화면 연결을 구현했다. `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`로 실행하며 화면에 PostgreSQL 조회 완료와 조회 기간/표본 여부를 표시한다. DB 조회와 수집 상태는 별도다. 기본 `npm run ui`는 기존 JSON 모드다. `collector:registered -- status`로 reader 또는 최소 권한 writer가 일별5코인의 UTC 당일 결과·전체 미종료 예약 수·선정별 마지막 저장 시각·잠금407 관측을 읽기 전용으로 확인한다. 잠금은 건강 보장이 아니며 조회가 수집을 실행하지 않는다. Linux용 두 수집 서비스·코드 밖 영속 경로·로컬 구성 doctor·전환/백업/롤백 절차는 [수집 운영](COLLECTOR_SERVICE.md)에 준비했다. 실제 원격 설치·부팅/재시작·백업 복원 검증은 다음 단계다. 계정 예산·보관 정책·24시리즈 초과 조회 확장도 남았다. 기존 market:watch의 프로세스12회 상한은 유지한다. 후속 ADR0048/0049의 worker는 UTC 하루288회 상한과 DB 예약으로 계속 실행하며 공개 배포는 별도다.

새 PC는 `npm ci` → `npm run setup` → `npm run doctor`로 준비한다. 과거 근거는 별도 이동 파일을 가져와 두 publisher로 복원한다. 시장 자료만 새로 받으려면 `.env.local`의 ARKM_API_KEY를 설정하고 `npm run market:collect`를 명시적으로1회 실행한다. 새 collected 이력은 기존14원본 이동 파일에 포함되지 않는다.

무제한 운영 전 계정 한도·기간·요청별 크레딧을 확인해야 한다. 승인된 로컬 확인은 프로세스당 실행 상한을 적용한다. usage1회는 HTTP200 및 totalLimit10000이었으나 잔여량/기간/단가 계약은 미확인이다. 이번 실행은 usage1건과 자료7건이었다. 사용자 화면 수는 외부 요청 수를 늘리지 않는다.

2026-10-22 공식 문서 재확인에서도 거래량 기간·단위와 계정 한도 정의를 확보하지 못했다. 상세4문서는 Cloudflare HTTP403이었다. 당시 거래량 순위·주기 수집은 보류했고 새 인증 API 호출은 하지 않았다. 후속 승인에 따른 제한된5분 수집은 ADR0041로 확장했다. 조회별 결과와 재개 조건은 [조사 기록](research/arkham-volume-and-budget-review.md)을 따른다. 현재 PC의 doctor는 통과했으며 물리적으로 다른 PC 검증은 미실행이다.

수집 실패 시 마지막 정상값·원본 관측 시각·실패 상태를 보존한다. 누락·명시적0·메서드 오류·미지원은 다르다. XRPL과 Arkham의 다른 지표를 단순 fallback으로 서로 대체하지 않는다. 새 체인/토큰은 먼저 registry와 공급자 식별자 출처를 연결하고 미확보 범위를 표시한다.

후속 국가별 추정 잔액 수집 요청으로 [ADR0081](adr/0081-geographic-balance-collection-diagnosis.md)의 기존 실행 상세 GET1건을 수행해 `You used invalid tables: allium_identity.aggregates.geo_balances_daily`를 확보했다(실제 누적2run/7HTTP). 테이블 거절은 확인했으나 권한/공개 경로 원인은 미확인이다. 같은 SQL을 재송신하지 않았고 현재 계정의 지원 경로 확인이 필요하다. 실제 국가별 금액은 계속 미확보다.

국가-거래소 흐름 후보도 사용자 확인 요청으로 [ADR0082](adr/0082-bounded-country-exchange-flow-query.md)의 기존11배포/고정일 단발 조회를 수행했다. 생성·실행·상태·상세 모두 HTTP200이었지만 run failed이며 동일 query/run/SQL 오류는 `You used invalid tables: allium_identity.aggregates.cex_attributed_flows`다. 이번1run/4HTTP, 지리 조회/진단 누적3run/11HTTP, 실제 흐름 자료 미확보다. 기존 receipt/원문·잔액 화면은 유지했고 새 DB/UI·재시도·usage·공급자 전환은 없다. 상세 및 소비 경계는 ADR0082를 따른다.

[ADR0083](adr/0083-bounded-provider-capability-probe.md)의 사용자 승인 API 접근 표본45개를 검사했다. Arkham20: HTTP200 JSON14·인자오류3·응답크기초과2·HTTP500 1. Allium REST9: HTTP200 JSON7·인자오류1·HTTP500 1. Allium SQL16: 실행성공 표본6(5개 echo 개별검토)·Identity 테이블 거절7·완료미확인3이다. 실제105HTTP/16run·기존 archive 보존, 추가 페이지/재시도/usage0이며 DB/UI는 유지했다. 전체 기능이 사용 불가인 상태가 아니며 자료군별 접근·오류·미검증을 [정본 결과표](research/provider-api-capabilities-2026-10-24.md)로 구분한다. 기존 두 지리 거절은 재호출하지 않았다.

2026-10-24 [API 인자 후속 조사](research/provider-api-argument-followup-2026-10-24.md) 후 사용자 승인으로 [ADR0084](adr/0084-single-allium-balance-array-probe.md)의 Allium 잔액 배열 요청1건을 실행했다. HTTP200 JSON·1HTTP/0run·283389bytes·재시도0이며 기존 원문/판정을 보존했다. Arkham 3건은 인자UNKNOWN으로 보류하고 추가 호출 없이 [저장 표본 활용 검토](research/provider-data-use-priorities-2026-10-24.md)로 넘어갔다. 가격3종의 토큰/체인/decimals·숫자 문자열/시각 모양을 확인했으며 통화·기간 완전성은 미확인이다. DB/UI는 변경하지 않았다.

## 검증 기준

직전 Git 체크포인트는 `c3e9557`이며 연구형 시장 화면과 기존 엔진 검사225개가 통과했다. 이동 기능과 새 checkout 보정 후231개가 통과했고, 단발 수집 검사 추가 후 전체236개가 통과했다(실패·취소·skip0). 키/보고서/의존성 없는 격리 소스에서 npm ci, 환경 진단,14원본 복원,15보고서/202항목·14시장 관측의 바이트/hash·시각/판정 일치, 두 화면의 Chrome 확인을 수행했다. 고정 TRON compiler는 공식 로더로 준비하고 무변경 재사용·손상 시 무실행/무재다운로드 거부를 확인했다. 초기 검사에서 실제 Solana 보고서와 TRON cache에 대한 숨은 의존성을 발견해 보정했다. 현 실행 환경은 macOS/ARM64, Node25.2.1이다. 같은 머신의 격리 checkout 검증과 물리적으로 다른 PC/OS에서의 검증을 구분한다.

큰 기술 결정은 [ADR0035](adr/0035-stored-market-observations.md), [ADR0036](adr/0036-portable-local-workspace.md), [ADR0037](adr/0037-manual-market-collector.md)를 따른다. 실제 키·환경변수 값·RPC URL·보고서 원문·개인 SSH 설정은 이 문서에 기록하지 않는다.

수집 실사용 검증은 Arkham 자료7회 모두 성공·관측14→26개·기존 XRPL 시각 유지였다. 브라우저에서는3코인·같은 코인 체인2/3/1순위, RLUSD의 실제2점 이력, 저장 재독/읽기 실패 유지, 다크/라이트·390px 화면·202개 근거 항목·프로필/비교를 확인했다. 기존 QA의 RLUSD1점 고정 가정은 새 실제 관측으로2점이 되어 실패했으며, 공급량을 바꾸지 않고 기대 관측 수를 갱신했다. 브라우저의 외부 요청은0건이었다.

Overview 보강은 기존 입력을 오프라인 재정규화하여 총공급량3개와 기간·단위 미확인 거래량1개 관측을 추가했다(26→30). 새 외부 조회나 새 과거 시각을 만들지 않았다. 현재 판정 규칙/순위 범위는 ADR0038을 따른다.

Overview 변경 후 전체 검사는241개 통과(실패·취소·skip0). Chrome에서 기본 Overview·#validation·#live, 범위 분리와 원시FAIL 이동, 다크/라이트·390px·읽기 실패 유지·외부 요청0건을 확인했다.

Overview 공급량 차트는 토큰 선택 시 확보한 네트워크를 공통 시간·0 기준 공급량 축에 서로 다른 색으로 표시한다. 개별 네트워크 선택도 유지한다. 하단은 실제 관측 업데이트 시각만 표시하고 원본 수량은 hover/키보드 툴팁에 둔다.

과거 일별 유통량은 [ADR0046](adr/0046-daily-network-circulation-history.md)으로 확장했다. 실제 Supabase의 private atlas_history에3자산·8네트워크·2928개 일별 값(2025-10-22~2026-10-22)을 별도 저장했다. 기존462시장/78네트워크 관측과8개 기본정보 및 두 schema fingerprint는 유지했다. Overview에서 DeFiLlama 일별 유통량1년/3개월과 Arkham 최근 총공급량을 구분해 선택한다. XRPL의 오늘 일별 값은 실시간 값이 아니다. 과거 자료는 이번 단발 import이며 이 단계에서는 자동 갱신을 추가하지 않았으며 후속 ADR0048로 일별 일정을 연결했다.

후속 [ADR0047](adr/0047-daily-minted-and-relative-comparison.md)으로 일별 발행량을 별도 저장했다. history v2 명시 upgrade 후6snapshot/16개 지표·네트워크 시계열/5856개 일별 값이다. 기존 circulating payload3개와 core 데이터는 유지했다. Overview는 일별 유통량/발행량만 선택하고 기본 증감률(%)·공급량 규모 전환을 제공한다. 화면에 ‘과거’ 수식어와 최근 Arkham 공급량 선택은 두지 않는다.

[ADR0048](adr/0048-durable-periodic-collection.md)은 history v3 정규화·DB 예약 기반 worker·최소 권한 writer·영속 원문/receipt 복구를 추가한다. 기존 불변 snapshot은 유지하고 같은 날짜/수량의 재저장을 방지한다. 후속 ADR0049에 따라 기본 Arkham5분/UTC일288회, DeFiLlama UTC일1회이며 Linux 배포 파일과 운영 방법은 [수집 서비스](COLLECTOR_SERVICE.md)를 따른다. 원격 서버 배포와 로컬 가동은 구분하며 최신 실제 상태/검사 수는 인계문을 따른다.

[ADR0049](adr/0049-continuous-five-minute-collection.md)은 사용자 요청대로 worker/서버 기본값을288회/UTC일로 변경한다. 명시 owner history v4 전환은 오늘의 기존12회 상한을 올리며 사용 횟수·슬롯·원문과 시장/일별 값은 유지한다.

[ADR0050](adr/0050-yen-and-top-ten-network-design.md)의 JPYC·JPYSC/기존3코인별 최대10개 네트워크 수집은 검토·설계 단계다. 공식 식별자·공급자 coverage와 USD 환산액/수량 차이를 확인했으며 [설계 정본](design/YEN_AND_TOP10_NETWORK_COLLECTION.md)에 구현 순서·DB/조회/예약 확장 조건을 정리했다. 실제 registry·수집기·DB 등록은 아직 하지 않았다.

후속 [ADR0051](adr/0051-registration-metadata-and-unit-preview.md)의 첫 구현으로 version2 등록 후보 metadata, 통화/지표 구분과 최대10네트워크 선정·일별 수량 preview CLI를 추가했다. [등록 계획 안내](MARKET_REGISTRATION.md). 기존 runtime registry·DB/수집기와 분리해 검증하며, 실제 DB 등록/새 코인 대시보드 연결은 다음 단계다.
