# ADR 0094: 브라우저 취득 solc0.8.11의 고정 profile

## 승인과 취득

사용자가 같은 host의 browser metadata 확인 후 compiler 파일1개 취득·hash 검증·profile 추가·JPYC Ethereum 저장2입력 오프라인 분석을 승인했다. Python 요청의 두 실패는 [ADR0093](0093-bounded-jpyc-compiler-acquisition.md)대로 보존하며 이번 브라우저 성공으로 소급 변경하지 않는다.

설치 Chrome의 새 임시 profile로 고정 metadata URL을1회 열어 HTTP200·JSON을 관측했다. metadata는 브라우저 렌더링 문자열이며 원시 HTTP bytes로 표시하지 않는다. 중복 key 거절 후0.8.11의 release/build/path/longVersion·유일성과 SHA256을 확인했다. 이후 별도 소비 기록의 고정 artifact URL1회에서 HTTP200·27,280,310바이트를 취득했다. 두 요청은 각각 사용자 승인된 범위이며 자동 재시도가 아니다.

artifact 탐색 전에 script 실행을 비활성화하고 CDP 요청/응답 interception을 설치했다. 정확한 URL·HTTP200만 수용하며 다른 page 요청/redirect를 차단했다. `Fetch.takeResponseBodyAsStream`과 `IO.read`의 base64 여부에 따라 응답 bytes를 저장했고32MiB/전체45초·요청20초 한도 안에서 완료했다. 원격 JS를 브라우저에서 실행하지 않았다. 임시 browser profile을 종료·삭제했다. 비공개 소비/receipt·artifact는 `.state/jpyc-solc-browser-artifact/`에 보존한다.

## 고정 profile과 기존 경계

- 전체 버전: `0.8.11+commit.d7f03943.Emscripten.clang`.
- SHA256: `64117d4b13bfc5bc6e5f80823519b140e753a0c09e99edd756772dc3029bc1f8`.
- id: `solc-0.8.11-pinned`; provenance: `BROWSER_ACQUIRED_PINNED_CACHE`; 독립 진위 인증: NOT_TESTED.

registry는 두 descriptor와 목록을 동결하며 cache 경로는 private 고정 map으로만 정한다. 기존0.6.12 descriptor/export·기본 inspect/stage API를 유지한다. 전체 version 또는 알려진 id로만 선택하며 임의 compiler 경로·URL·hash를 입력받지 않는다. descriptor 등록은 artifact bytes의 hash 검증 후 수행했다. 같은 출처 metadata/hash 일치는 독립 진위 인증이 아니다.

[ADR0092](0092-pinned-legacy-compiler-and-archived-review.md)의 regular file·소유자·nofollow·동일fd·32MiB 검증, 전용0700/0600 staging, child hash/전체version 재검사, preload 제거,20초·V8 old-space256MiB·입력2MiB/출력8MiB·임시 정리를 유지한다. 설치 compiler 외의 두 profile 모두 같은 staging 경로를 사용한다. compiler 자체의 다운로드/자동 업데이트·package hook·외부 import callback은 없다.

## 0.8.11 AST 호환성

사설 Fixture에서0.8.11이 내장 식별자의 음수 참조를 uint32로 표현함을 확인했다. 기존 음수 참조 처리는 유지하고 정확한0.8.11 전체 버전에 한해 정수·상위 uint32 범위·실제 선언 부재·Identifier 이름·typeIdentifier를 함께 확인한다. `require/assert/msg`만 이 예외를 적용하며 임의 양수나 다른 compiler 버전에는 적용하지 않는다. assert는 조건 관측만 하고 require 전용 caller equality 의미를 넓히지 않는다.

내장 require/assert/msg 양성, 사용자 정의 require·가짜 msg·OR 우회·잘못된 type/id/버전 음성, 기존 compiler 회귀를 확인한다. 이 구문 호환성 보완은 모든 경로의 권한 보장이나 현재 배포 인증이 아니다.

## 실제 분석 범위

저장 proxy/implementation 후보2개의 원래 hash를 확인하고 새 출력에 각1회 분석한다. 원문·누락 설정·원래 HTML 취득 시각을 보존하며 새 분석 시각과 구분한다. 새 RPC·archive/runtime 관측·서명/거래·다른 체인·DB/UI는 없다. 현재 배포 binding은 UNKNOWN이다. 실제 결과는 별도 연구 문서에 기록한다.

[실제 결과](../research/2026-10-25-jpyc-offline-source-review.md)는 컴파일2건 성공·39진입점 분석, immutable 값 미제공으로 PARTIAL이다. 시험541건 통과와 실제 배포 미확인을 구분한다.
