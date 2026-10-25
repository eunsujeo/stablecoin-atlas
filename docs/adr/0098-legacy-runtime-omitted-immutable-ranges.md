# ADR 0098: 고정 legacy compiler의 immutable 범위 생략 처리

## 승인과 결정

2026-10-25 사용자가 solc0.4.18 출력 비교기의 호환성 보완과 사설 Fixture 검증을 승인했다. 외부 호출·다운로드·실제 USDT 재컴파일·배포 대조·기존 보고서 변경은 제외한다.

`compareRuntime`은 정확한 `0.4.18+commit.9cf6e910.Emscripten.clang`에서 `Object.hasOwn`으로 `immutableReferences` 자체가 없음을 확인한 경우만 내부 빈 범위로 해석한다. 원본 compiler 결과에 필드를 합성하지 않는다. 제품 경로는 기존 고정 SHA/worker 전체 버전 검사와 profile 일치 검사를 통과한 `compiled.compiler`를 전달한다. 비교기 인자 자체는 compiler 진위 인증 수단이 아니다.

다른/미지정 버전의 누락, 명시 undefined/null/배열/잘못된 맵과 linkReferences 누락은 계속 거절한다. 제출 immutable 값이 추가되면 기존 누락/초과 검사를 적용한다. 명시 범위 검증·미해결 library 처리·metadata 포함 전체 runtime hash 대조는 유지한다.

## 결과 의미와 보존

새 비교에서 관측이 없으면 `ADDRESS_NOT_OBSERVED`·matched null·binding UNKNOWN이다. 전체 일치 반환도 기존 고정 hash/종료 재확인 규칙을 거쳐야 하며, 사설 hash 일치 시험은 실제 토큰 배포 증거가 아니다. Schema와 기존 보고서는 변경하지 않는다. [USDT 오프라인 재컴파일](../research/2026-10-25-usdt-offline-recompile.md)의 INVALID_RELOCATION_DATA·PARTIAL·UNKNOWN과 기존 MISMATCH는 당시 결과로 유지한다.

## 검증

`tests/token-review-solc0418.test.mjs`에서 사설 소스의 실제 고정 compiler 출력 생략·원형 보존, 전체 hash 일치/마지막 바이트 불일치/미관측, 버전/필드/범위 음성 경로, 미해결 library와 초과 제출값을 검증한다. 오프라인 review 통합 시험은 저장 compiler artifact의 생략 보존, UNKNOWN과 JSON/Markdown 출력, HTTP0을 확인한다. cache 없는 PC의 새 compiler 의존 시험은 명시 skip하며 자동 취득하지 않는다.

Lead `738f3cced96b4d2d9e5a70f931b37ace`의 proceed 검토 조건을 반영했다. 검증 실행 결과는 [인계문](../handoff/2026-10-25-legacy-runtime-comparison.md)에 기록한다.
