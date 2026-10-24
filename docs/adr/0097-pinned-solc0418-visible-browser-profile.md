# ADR 0097: 보이는 브라우저 취득 solc0.4.18 고정 profile

## 승인과 취득

사용자가 초기 탭 오류 수정 후 새 브라우저 단계 최대2GET/120초를 승인했다. [ADR0096](0096-browser-compiler-acquisition-guidance.md)의 최초 단계 소비는 유지하고 이번 추가 승인만 새 v2 root에 연결했다. [실행 결과](../research/2026-10-25-usdt-solc0418-browser-success.md)의 공식 metadata1GET·고정 artifact1GET은 모두 HTTP200이며 보이는 임시 Chrome에서 hash를 확인했다. 실제 USDT 재컴파일/배포 대조·새 RPC·서명/거래·DB/UI는 승인 범위에 없다.

artifact는7139666바이트, SHA256 `905e3d253406973f545666d79cd64c5c85985992f68fa35935f60249e311d74f`, Keccak `0x0478b43de978b1af1d6d6d8c09e84cdb2cc8ed76218d38f17b841b6e539742f0`다. 공식 metadata의 정확한 version/path/build/longVersion·유일성·두 hash를 검사했다. 같은 출처 hash 일치는 독립 진위 인증이 아니다.

## 고정 profile과 실행 경계

`usdtCompiler`의 전체 버전은 `0.4.18+commit.9cf6e910.Emscripten.clang`, 경로는 `.state/usdt-solc-0418-visible-browser-v2/soljson.js`다. runtime worker에서 이 전체 버전을 확인했고 사설 Fixture가 컴파일됐다. provenance는 `BROWSER_ACQUIRED_PINNED_CACHE`, 독립 인증은 NOT_TESTED다. 임의 경로/hash·자동 다운로드를 받지 않는다. 기존 소유자/regular file/nofollow/32MiB·hash 검사, private staging, worker 재검증·전체 버전·환경 정리·시간/출력 제한·종료 정리를 재사용한다. 기존0.6.12/0.8.11 pin/cache는 유지한다. 다른 PC에 cache가 없으면 미확보로 종료한다.

## 구버전 AST의 제한된 호환성

0.4.18 AST는 `kind` 대신 `isConstructor`와 `name`을 제공한다. 정확한 고정 전체 버전에만 생성자·명명 함수·익명 fallback 구분을 적용한다. 생성자는 실행 진입점에서 제외하고 fallback은 별도 보존한다. 함수별 AST selector가 없으면 선언 ID별로 유지한다. `evm.methodIdentifiers`의 존재를 AST 선언별 selector 연결로 추정하지 않는다. SELECTOR_NOT_ESTABLISHED·OVERRIDE_ENTRY_SELECTION_NOT_ESTABLISHED를 남기고 상속 override 제거/실제 진입 선택을 보장하지 않는다.

이 compiler의 require/assert/msg는 작은 양수 builtin 참조를 사용한다. 전체 source byId에 선언이 없고 정확한 이름/type 조합일 때만 내장으로 인식한다. 등록되지 않은 버전·범위 밖 참조·선언 ID 충돌·사용자 require/fake msg는 승격하지 않는다. OR 조건을 직접 caller 동등 조건으로 취급하지 않으며 기존 callerEqualityState의 REQUIRE 한정 의미를 유지한다. assert 구문 관측을 require 권한 조건으로 바꾸지 않는다. 원래 compiler AST를 덮어쓰거나 selector를 생성하지 않는다.

## 검증 범위

사설 소스의 ABI/runtime/AST·생성자/fallback/오버로드/상속·진짜/가짜 guard·오류/외부 import 거절·timeout 정리·전체 버전 mismatch와 기존 profile 회귀를 검증한다. compiler 취득/호환성 확인은 실제 USDT 소스의 원래 build 재현·고정 hash 관측·source binding이 아니다. 기존 MISMATCH/UNKNOWN·원본/소비·제품 판정을 보존한다.
