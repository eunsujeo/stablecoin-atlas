# RLUSD·JPYSC compiler 확보와 저장 소스 분석 제안

이 제안은 후속 사용자 승인으로 실행·소비 완료했다. 총6GET·compiler2종/입력3개 컴파일 성공·새 RPC0이며 [별도 결과와 제한](2026-10-25-rlusd-jpysc-offline-source-review.md)을 따른다. 아래는 승인 전 고정 계획 기록이며 재실행 권한이 아니다.

다른 토큰 진행 요청에 따라 저장 입력 준비까지 완료했다([잔여 작업](2026-10-25-token-review-remaining-work.md)). 다음은 새 compiler 취득을 위한 구체적 제안이며, 네트워크 요청·compiler 실행·profile 추가는 아직0이다. 기존0.6.12/0.8.11/0.4.18 pin·캐시·소비·보고서를 보존한다.

## 고정 대상

metadata URL은 두 버전 모두 `https://binaries.soliditylang.org/bin/list.json`이다. 아래 artifact URL만 사용한다. 이번 계획 작성 중 제공 상황/공식 안내/응답을 네트워크로 새로 확인하지 않았으므로 URL 표기를 취득 성공이나 독립 진위 확인으로 표현하지 않는다.

| 용도 | 저장 자료의 compiler 식별자 | 고정 artifact URL | 취득 후 허용할 자산 입력 |
| --- | --- | --- | --- |
| RLUSD Ethereum 구현체 후보 | `0.8.29+commit.ab55807c` | `https://binaries.soliditylang.org/bin/soljson-v0.8.29+commit.ab55807c.js` | `.state/other-token-inputs-20261025/rlusd-implementation.candidate.json` 1개 |
| JPYSC Ethereum proxy/implementation 후보 | `0.8.34+commit.80d5c536` | `https://binaries.soliditylang.org/bin/soljson-v0.8.34+commit.80d5c536.js` | `source-intake/jpy-public-html-20261024T170822Z/`의 JPYSC proxy9소스/implementation41소스 후보2개 |

metadata의 release·정확한 path/build commit·longVersion·SHA256/Keccak을 확인하고 받은 artifact의 두 hash를 확인한다. 예상 worker 전체 버전은 각각 `0.8.29+commit.ab55807c.Emscripten.clang`, `0.8.34+commit.80d5c536.Emscripten.clang`이며 실제 확인 전에는 NOT_TESTED다. SHA/Keccak은 현재 미확보이며 임의 pin을 만들지 않는다. 누락/중복/불일치면 해당 버전은 종료한다.

## 요청·저장·실행 한도

- 버전별 직접 단계: metadata1GET + 검증 성공 후 artifact1GET, 최대2GET/34MiB/120초. metadata2MiB/artifact32MiB, 요청각30초·실제 수신 bytes/전체 deadline 제한, 재시도/redirect/다른 host·버전 대체0.
- 직접 HTTPS가 거절될 때만 [사용자 지시의 새 보이는 임시 브라우저](../COMPILER_BROWSER_ACQUISITION.md) 단계로 동일 자료를 확인한다. 버전별 독립 새 소비로 최대2GET/34MiB/120초를 한 번만 허용한다. 페이지 갱신·하위 자원·예상 밖 target·redirect 차단, 관리형 proxy·격리 profile·디버깅 pipe·stream 저장 경계를 유지한다. 브라우저도 거절되면 종료한다.
- 두 버전 직접 단계 합계 최대4GET/68MiB/240초. 두 버전 모두 브라우저 단계가 필요할 때까지 포함한 **전체 최대8GET/136MiB/480초**다. 버전/단계별 한도를 교환·연장하거나 남은 요청을 재사용하지 않는다. 한 버전이 실패해도 다른 버전은 자신의 고정 계획만 실행한다.
- 각 버전/단계의 새 root0700·파일0600·plan/input hash·최초 송신 전 wx/fsync 소비·각 요청 intent·receipt를 보존한다. cache/artifact/원문 덮어쓰기0, URL 외 인증·쿠키·새 키·로그인·공급자/usage API·RPC는0이다. 비공개 compiler bytes/소스/상세 보고서를 Git·웹에 게시하지 않는다.
- 취득 성공한 artifact만 고정 registry profile로 연결한다. 소유 regular file/nofollow/32MiB·동일 fd hash·전용 staging CJS·worker hash/전체 버전 재검사·NODE_OPTIONS/NODE_PATH 제거·각20초/heap256MiB/입력2MiB/출력8MiB·실패/timeout 정리를 유지한다. 임의 경로/URL/hash 실행 옵션·자동 다운로드·외부 build/import 스크립트·설치 패키지 변경은 추가하지 않는다.
- 사설 Fixture로 profile/hash/버전/입출력·AST 지원/실패/timeout/정리 경계를 검증하고 `npm run check`를 통과한 뒤 위 자산 입력만 오프라인 분석한다. 실제 자산 compile은 성공한 버전의 각 입력당 최대1회(합계최대3회), 자동 재컴파일0이다. compiler 프로필·사설 검증의 버전 확인/Fixture 실행은 자산 컴파일과 별도로 기록한다. 미지원 AST/설정은 UNKNOWN/NOT_TESTED로 남기고 다른 compiler로 대체하지 않는다.

## 결과와 종료 조건

새 별도 JSON/Markdown에 source input/effective request/compiler 결과·hash·원래 취득 시각과 새 분석 시각을 보존한다. outputSelection 외 content/settings를 보정하지 않는다. JPYSC osaka/viaIR와 RLUSD cancun/viaIR를 유지한다. 감사 입력 미확보를 미감사로 표현하지 않는다.

새 RPC·배포 코드 관측은 이 제안에 포함하지 않으므로 소스·배포 binding UNKNOWN을 유지한다. compiler 확보·정적 소스 관계 추출과 원본 진위·배포 설정/생성자·전체 권한 보장은 별개다. 기존 SOURCE_REVIEWED·PASS/FAIL·실제 USDT 실패/소비를 변경하지 않는다. 이 고정 취득·profile/사설 검증·입력3개 오프라인 분석 범위를 사용자에게 확인받은 후 실행한다.
