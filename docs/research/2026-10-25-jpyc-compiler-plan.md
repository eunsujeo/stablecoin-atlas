# JPYC Ethereum 고정 compiler 확보·오프라인 분석 계획

2026-10-25 후속 요청으로 실행 대상을 구체화했다. **이 문서는 계획이며 다운로드·대상 compiler 실행·profile 변경·RPC 호출을 승인하거나 수행한 기록이 아니다.** 사용자가 승인한 이번 단계는 저장 입력·기존 코드 확인과 계획 작성이다. 기존 [공개 HTML 소스 검토](2026-10-25-jpy-public-html-source-review.md)의 연구 상태·원문은 유지한다.

## 고정 대상과 확인한 입력

대상은 저장 기록의 JPYC Ethereum, chainId `1`, 토큰 주소 `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`다. 이번에는 공식 주소를 외부에서 재확인하지 않았다. 표시 구현체는 저장 explorer 후보일 뿐 고정 블록의 직접 관측이 아니다.

입력 root는 비공개 `source-intake/jpy-public-html-20261024T170822Z/`다. 아래 파일을 로컬에서 다시 읽어 SHA256·크기·inline source 개수와 contract 선언 선택을 확인했다. 원문을 Git/웹에 추가하지 않는다.

| 입력 디렉터리 / 파일 | 선택 contract | 바이트 / Solidity 파일 | SHA256 |
| --- | --- | --- | --- |
| `jpyc-ethereum-extracted-2013723846ff/compiler-input.candidate.json` | `contracts/proxy/ERC1967Proxy.sol:ERC1967Proxy` | 22458 / 6 | `0865719818cc27e64bb979f9d7e570a14f62c7bf5f49b333f714a7c42ec05590` |
| `jpyc-ethereum-implementation-extracted-62ef84737596/compiler-input.candidate.json` | `contracts/v1/FiatTokenV1.sol:FiatTokenV1` | 85922 / 17 | `e757eaeb5caf9fc33530efa23e1b87215fd7d1ea2e79f03123c239fc4dc7745c` |

두 입력은 optimizer enabled/runs3000, libraries 빈 객체와 outputSelection을 제공한다. evmVersion/metadata/viaIR는 미제공 상태를 유지한다. compiler 기본값 사용은 원래 배포 설정의 증명이 아니다.

## 다음 승인 단위

아래는 추가 승인을 받아 수행할 제안이며 이번에는 시작하지 않는다.

1. 고정 후보 `https://binaries.soliditylang.org/bin/list.json`과 `https://binaries.soliditylang.org/bin/soljson-v0.8.11+commit.d7f03943.js`를 각 최대1GET로 저장한다. 이번에는 공식 안내·제공 상황·redirect를 네트워크로 확인하지 않았으므로 확인된 배포 출처로 표시하지 않는다. 다른 host/path로 자동 전환하거나 응답값으로 임의 URL을 조합하지 않는다.
2. metadata의 release0.8.11·build commit.d7f03943·정확한 path·longVersion·SHA256을 고정하고 artifact 수신 bytes와 대조한다. SHA256은 현재 UNKNOWN이며 추측값을 등록하지 않는다. 항목 누락·중복·불일치·비정상 응답·redirect·크기/시간 초과는 추가 요청 없이 종료한다. 동일 출처 metadata와 artifact의 hash 일치는 독립 진위 인증이 아니다.
3. metadata/artifact의 hash·취득 시각·출처를 보존하고 검증 완료 후에만 새 전용 cache/profile을 등록한다. 기존0.6.12 pin/cache·installed compiler·기존 보고서는 유지한다. 임의 path/URL/hash 실행 옵션은 추가하지 않는다. [ADR0092](../adr/0092-pinned-legacy-compiler-and-archived-review.md)의 현재0.6.12 제한 확장은 승인 후 새 ADR로 기록한다.
4. 새 profile 검증 후 위2개 입력만 오프라인 분석해 별도 보고서를 저장한다. 예상 runtime 전체 버전은 `0.8.11+commit.d7f03943.Emscripten.clang`이며 현재 NOT_TESTED다. 실측 버전 불일치 시 종료한다. compiler 초기 버전 확인과 실제 대상2건 compile만 허용하고 대상 자동 재실행은 하지 않는다. 가상/사설 Fixture 검증은 실제 대상과 구분한다.

## 취득·실행 한도

| 항목 | 제안하는 고정 경계 |
| --- | --- |
| HTTP | 최대2GET. metadata 성공·선택 검사 후 artifact1GET. 재시도0·redirect0·endpoint 전환0 |
| 응답 | metadata 최대2MiB·artifact 최대32MiB·합계34MiB. 실제 수신 bytes도 제한 |
| 시간 | 연결/요청 timeout20초·각 응답 읽기45초·취득 전체120초. 초과 시 중단하고 추가 요청하지 않음 |
| 저장 | 새 소유 로컬 영역·directory0700/file0600·배타적 생성·기존 cache/원문 덮어쓰기0 |
| cache | regular file·소유자·nofollow·32MiB·동일 fd bytes의 hash 검사 후 검증 bytes만 전용 임시 CJS로 staging |
| worker | child hash·전체 버전 재검사·NODE_OPTIONS/NODE_PATH 제거·각20초·V8 old-space256MiB·입력2MiB·출력8MiB·성공/오류/timeout 후 임시 정리 |
| 입력 | 기존 inline import content만 사용. outputSelection만 기존 AST/ABI/runtime용으로 교체하고 실효 입력 별도 저장 |

관리형 proxy 환경을 상속한다. V8 old-space 한도는 전체 RSS 상한이나 보안 sandbox 보장이 아니다. npm install/package hook·외부 import callback·build script·pragma 변경·자동 compiler 갱신은 포함하지 않는다. 기존 `src/token-review/compiler-cache.mjs`, `compiler.ts`, `compiler-worker.mjs`의 검증·staging 경계를 유지한다.

후속 구현 검증은 기존0.6.12 보존, 새 profile hash·소유자·symlink·버전 불일치 거절, child 검사·import 차단·실패/timeout 정리와 `npm run check`를 포함한다. 실패 시 compiler 대체나 한도 자동 확대는 하지 않는다.

## 출력과 판정

새1.2 OFFLINE JSON/Markdown·입력/실효 입력·compiler 근거·정적 분석을 비공개 별도 영역에 저장한다. 원래 HTML 취득 시각과 새 분석 시각을 구분한다. JPYC의 CLI 형식 고정 block runtime 관측은 없으므로 HTML을 `--observations`로 전달하거나 현재 배포 runtime을 비교하지 않는다.

컴파일 성공·정적 경로 추출·전체 권한 보장·배포 대응은 별개다. 배포 binding UNKNOWN·RPC/배포 runtime 비교 NOT_TESTED를 유지한다. 누락 설정·표시 구현체 후보·진위 미인증을 기록하며 기존 SOURCE_REVIEWED·PASS/FAIL·지원 범위를 바꾸지 않는다. 감사 자료 미제공을 미감사로 단정하지 않는다.

새 RPC·API 키·유료 API·거래/서명·DB/UI·시장 자료 변경은 포함하지 않는다. JPYSC0.8.34·JPYC 다른 체인·Kaia 소스 별도 취득도 제외한다. 실제 배포 비교는 정확한 대상과 RPC 호출 한도를 별도 확인한다.

## 이번 완료 범위

로컬 입력2개 재대조·기존 compiler 실행 경계 읽기·계획 문서화까지 완료했다. 대상 compiler/AST 실행이나 새 네트워크 증거는 없다. Lead `efdb7eca097147ffb6c43674a6bc1ff0`의 proceed는 계획 작성에 한정한다.

후속 확인 대상은 최대2GET compiler 취득·고정 profile 확장·두 입력 오프라인 분석이다. 기존 요청은 계획 구체화까지였고 AGENTS.md의 자동 compiler 다운로드 제외 및 외부 실행 범위 확인 규칙이 적용되므로 실행 승인은 별도로 받는다.
