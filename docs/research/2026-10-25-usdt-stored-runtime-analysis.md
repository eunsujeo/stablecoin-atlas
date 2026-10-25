# USDT 저장 compiler 출력 오프라인 분석

사용자 후속 승인으로 [기존 USDT 오프라인 재컴파일](2026-10-25-usdt-offline-recompile.md)의 저장 compiler 출력만 [ADR0098](../adr/0098-legacy-runtime-omitted-immutable-ranges.md)의 보완 비교기로 분석했다. 구조 검사를 통과했고 결과는 `ADDRESS_NOT_OBSERVED`·matched null·binding `UNKNOWN`이다. 재컴파일·새 RPC·다운로드·실제 배포 대조는 수행하지 않았다. 기존 보고서와 제품 판정은 유지한다.

## 입력과 분석 시각

새 분석은 UTC `2026-10-25T00:56:48.356Z`~`2026-10-25T00:56:48.430Z`에 수행했다. 원래 컴파일/분석 시각은 UTC `2026-10-24T19:25:06.286Z`~`2026-10-24T19:25:06.890Z`다. 원래 보고서는 OFFLINE·archive null·관측 계약0이며 블록/hash 관측이 없다. chainId1·`0xdAC17F958D2ee523a2206206994597C13D831ec7`은 저장 입력의 식별자로만 사용한다.

저장 `source-0.compile-result.json`의 SHA256 `ed20b9809cddd888d90bf0a8dfb8d33a3fca03dd8ba476c83a72de3fa51efdc9`와 2381870바이트를 기존 artifact 목록과 대조했다. 함께 기록된 입력/실효요청 artifact도 hash/길이를 확인했다. 원래 입력 목록과 기존 출력 디렉터리·비교기/profile 코드를 포함한 고유25파일은 분석 전후 hash가 같았다. 이는 저장본 무변경 확인이며 원본 진위 인증은 아니다.

## 비교 결과

| 항목 | 이번 결과 | 의미 |
| --- | --- | --- |
| compiler | `0.4.18+commit.9cf6e910.Emscripten.clang` | 저장 출력/기존 보고서 버전 일치·고정 캐시 hash 확인. compiler 실행0회 |
| immutableReferences | 필드 자체 부재 유지 | 정확한 고정 버전에서만 내부 빈 범위로 해석. 원본 필드 합성 없음 |
| linkReferences | 빈 맵 | 이번 출력에 미해결 library 범위 없음 |
| runtime | 11075바이트·RAW_RUNTIME | metadata 포함 전체 바이트. 제거·마스킹 없음 |
| runtime Keccak | `0xc60427dda11e864272d53e4327226c4f1b67b81e36124a73e23f197649a8cc27` | 기존 컴파일 요약과 동일한 생성 코드 hash |
| 비교 결과 | `ADDRESS_NOT_OBSERVED`·matched null | 관측 hash를 제공하지 않아 실제 배포 일치/불일치 미판정 |
| 배포 연결 | `UNKNOWN` | 소스 연결·생성자/배포 증명·고정 hash 종료 재확인 없음 |

기존 보고서의 `INVALID_RELOCATION_DATA`·`PARTIAL`은 당시 도구의 결과로 보존한다. 이번 보조 보고서는 기존 TokenTechnicalReview 1.2를 재작성하거나 그 실행 상태를 성공으로 바꾸지 않는다. 과거 서비스 runtime과 저장 관측의 `MISMATCH`, 소스 provenance·정적 의미론 미증명, 제품 PASS/FAIL·SOURCE_REVIEWED도 그대로다. 생성 코드 hash를 실제 주소 관측으로 사용하지 않았다.

## 확보된 compiler

Compiler는 Solidity 소스를 코드로 바꾸는 버전별 도구이며 자산 전용 실행기가 아니다. 현재 고정 캐시3개의 SHA256 검증이 통과했다. 용도는 기존 연구에서의 사용 맥락이다.

| 기존 용도 | 고정 solc 전체 버전 | 이번 확인 |
| --- | --- | --- |
| USDC | `0.6.12+commit.27d51765.Emscripten.clang` | 캐시 hash 검증 통과 |
| JPYC 조사 | `0.8.11+commit.d7f03943.Emscripten.clang` | 캐시 hash 검증 통과 |
| USDT | `0.4.18+commit.9cf6e910.Emscripten.clang` | 캐시 hash 검증 통과 |
| 기본 설치 패키지 | `0.8.37` | 로컬 package.json 버전 확인 |

등록 정본은 `src/token-review/compiler-cache.mjs`다. 캐시 확보와 compiler의 독립 진위 인증, 실제 자산의 소스 확보·원래 설정 재현·배포 일치는 별개다. 이번에는 compiler를 실행하지 않았으며 캐시는 다른 PC에 자동 이전/다운로드되지 않는다.

## 비공개 산출물과 검증

`.state/usdt-stored-runtime-analysis-20261025/`에 별도 연구 schema `StoredCompilerRuntimeAnalysis/1.0`의 `report.json`, `report.md`, `input-hashes.json`, `validation.json`을 보존했다. 원문 runtime은 비공개 JSON에만 두었고 Git·웹에는 게시하지 않는다. 디렉터리0700·파일0600을 확인했다.

`node --import tsx .state/analyze-usdt-stored-runtime-20261025.mjs`는 rc0·PASS다. 기존3artifact hash/길이·25파일 불변·누락 필드 보존·새 결과·matched null·UNKNOWN·원래 보고서 보존·권한을 검증했다. fetch 거절 guard의 호출 시도0·compiler 실행0이며 DB/UI·키·외부 build script는 사용하지 않았다.

`npm run check > .state/agent-logs/usdt-stored-runtime-check.log 2>&1`은 rc0·tests551/pass551/fail0/cancelled0/skipped0이다. 별도 저장본 재독 검증도25파일 hash·보조 보고서 결과·0600을 확인했고 `git diff --check`는 rc0이다. 전체 회귀 검사 통과는 실제 배포 연결 확인과 별개다.

실제 배포 대조는 정확한 입력·허용 RPC/메서드·호출/시간 한도·새 고정hash 관측 계획의 별도 승인이 필요하다. 이 분석을 근거로 자동 실행하지 않는다.
