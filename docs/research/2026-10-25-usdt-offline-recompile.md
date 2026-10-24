# Ethereum USDT 저장 소스 오프라인 재컴파일

사용자가 권장한 **저장 USDT 소스와 고정 compiler의 오프라인 재컴파일만** 승인했다. [입력 준비](2026-10-25-usdt-technical-input-preparation.md)의 후보를 [ADR0097](../adr/0097-pinned-solc0418-visible-browser-profile.md) profile로1회 컴파일했고 성공했다. 별도 TokenTechnicalReview1.2 JSON/Markdown을 비공개 로컬에 보존했다. 새 RPC·다운로드·getter·배포 대조는0회다. 기존 SOURCE_REVIEWED·제품 PASS/FAIL·MISMATCH·UNKNOWN을 변경하지 않았다.

대상 chainId1·`0xdAC17F958D2ee523a2206206994597C13D831ec7`은 저장 입력의 식별자다. 이번에 공식 주소나 현재 체인을 다시 확인한 결과가 아니다. Lead `632f3a9d419c450c9251ddc75f06536e`의 proceed 조건에 따라 원본·설정·버전 경계와 배포 연결 미확인을 유지했다.

## 실행과 입력 보존

분석 시각은 UTC `2026-10-24T19:25:06.286Z`~`19:25:06.890Z`(한국2026-10-25)다. 소스 취득 시각과 과거 블록/관측 시각은 [입력 준비 기록](2026-10-25-usdt-technical-input-preparation.md)을 그대로 따른다.

- 원본7파일·후보1개·compiler cache3개 총11파일의 SHA256이 실행 전후 동일했다. 후보16011바이트의 SHA256은 `ca52238c547cbe374fa06f077e568536287ec524fe4107835d14aac67c7dff25`다.
- 소스는 `TetherToken.sol:TetherToken`이며 후보의 소스 content·경로·설정은 유지했다. 기존 도구가 AST/ABI/runtime 반환을 위해 추가한 outputSelection만 실효 입력에 기록했다. optimizer/libraries/remappings를 보정하거나 생략 설정을 채우지 않았다.
- compiler artifact SHA256은 `905e3d253406973f545666d79cd64c5c85985992f68fa35935f60249e311d74f`이며 worker 사용 전체 버전은 `0.4.18+commit.9cf6e910.Emscripten.clang`이다. 기존 hash/소유·파일/staging/worker 경계를 사용했다. provenance의 독립 인증 NOT_TESTED는 유지한다.
- 새 비공개 config/output·영속 실행 marker를 사용했다. offline=true·probes0·observations 미지정이며 credential 환경을 제거했다. fetch 거절 guard를 두었고 RPC/RPC_ERROR 근거0·contracts0·archive null·기준 블록/hash null을 검증했다. 외부 빌드 스크립트·키·DB/UI·서명/거래는 사용하지 않았다.

## 결과와 제한

| 항목 | 결과 | 해석 |
| --- | --- | --- |
| 컴파일 | SUCCEEDED·diagnostics0 | 제출 후보의 컴파일 성공이며 원래 배포 build 인증이 아님 |
| 생성 runtime | 11075바이트·Keccak `0xc60427dda11e864272d53e4327226c4f1b67b81e36124a73e23f197649a8cc27` | metadata 포함 생성 바이트의 hash. 관측 코드와 이번에 비교하지 않음 |
| 소스 함수/정적 entry | 31개/29개 | 선택 컨트랙트의 명시 함수 범위. AST 선언·구문 경로 자료 |
| 절단 | entryLimitReached=false·stateVariableLimitReached=false | 전체 의미론·권한 보장 증명과 별도 |
| 배포 연결 | UNKNOWN·INVALID_RELOCATION_DATA | 구버전 출력의 immutableReferences 누락을 현재 비교기가 거절 |
| 전체 실행 상태 | PARTIAL·source-binding 실패 기록1개 | 컴파일 실패나 자산 취약성 판정이 아님 |

현재 비교기는 관측 hash가 없어도 relocation 구조부터 검사한다. 실제0.4.18 출력에는 linkReferences/object/opcodes/sourceMap이 있고 immutableReferences는 없다. 누락을 빈 객체로 합성하지 않았으며, 보고서 runtimeComparison의 matched는 null이다. 이 사유를 기능 부재·USDT 코드 결함·실제 배포 불일치로 해석하지 않는다. 이번에는 비교기 코드 변경이나 재컴파일을 추가하지 않았다.

정적 분석은 semantics=NOT_PROVEN이다. SELECTOR_NOT_ESTABLISHED·OVERRIDE_ENTRY_SELECTION_NOT_ESTABLISHED·VIRTUAL_DISPATCH_NOT_PROVEN·UNRESOLVED_CALL·BODY_UNAVAILABLE, 인자 치환/수정자 실행 순서/외부 효과 미증명 등이 남는다. 118개 finding은 분류·근거 자료 수이며 취약점 수가 아니다. 실제 권한 행사·역할 계정 수집은 완료조건으로 요구하지 않는다.

과거 서비스 제공 recompiled↔저장 관측의 전체 MISMATCH는 그대로다. 이번 생성 runtime을 과거 관측이나 서비스 runtime과 새로 대조하지 않았고, metadata 제거·부분 일치·원본 진위·현재/과거 배포 binding 확인으로 승격하지 않았다. 숫자tag 보고서를 고정hash 기술 review archive로 변환하지 않았다.

## 비공개 산출물과 검증

`.state/usdt-offline-recompile-20261025/`에 source-input/config/original-hashes/analysis-consumed·output/report.json/report.md/bundle.json·입력/실효요청/컴파일결과 artifact3개·execution-summary/validation을 보존했다. root0700·주요 파일0600을 확인했다. 소스·compiler bytes·보고서 원문은 Git/웹에 게시하지 않는다.

최초 실행의 컴파일과 보고서 생성은 성공했지만 사후 검증 스크립트가 runtimeComparison=null을 기대해 rc1로 종료했다. 실제로는 UNKNOWN 대조 객체가 있는 것이 현재 구현 동작이다. 첫 로그 `.state/agent-logs/usdt-offline-recompile-20261025.log`를 보존하고, 생성 보고서를 읽는 별도 검증으로 기대를 바로잡았다. compiler를 다시 실행하지 않았다.

`node --use-env-proxy --import tsx .state/validate-usdt-offline-recompile-20261025.mjs`는 rc0 PASS다. report 구조·원본11파일 불변·outputSelection 외 소스/설정 동일·누락 필드 보존·무관측·권한을 검사했다. artifact3개의 hash/바이트/0600도 별도로 확인했다.

`npm run check > .state/agent-logs/usdt-offline-recompile-check.log 2>&1`은 rc0·tests548/pass548/fail0/cancelled0/skipped0이다. `git diff --check`도 rc0이다. 이 회귀 검사 통과와 실제 보고서의 PARTIAL을 구분한다. 제품 코드·테스트는 변경하지 않았다.

## 다음 범위

이번 승인 단위는 완료했다. 실제 배포 대조는 정확한 입력·RPC 허용 목록/호출·시간 한도·새 고정hash 관측 계획의 추가 승인 전 실행하지 않는다. legacy 출력 비교기의 호환성 보완도 이 결과를 바탕으로 사설 Fixture 검증 범위를 먼저 구체화한다. 기존 보고서/소비를 덮어쓰거나 이 compiler 실행을 자동 반복하지 않는다.
