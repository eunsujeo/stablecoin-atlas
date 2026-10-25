# ADR 0099: RLUSD·JPYSC 고정 compiler와 제한된 소스 묶음

## 승인과 취득

2026-10-25 사용자가 [고정 계획](../research/2026-10-25-rlusd-jpysc-compiler-plan.md)의 두 compiler 취득·profile/사설 검증·저장 입력3개의 오프라인 분석을 승인했다. 실제 배포 RPC는 포함하지 않는다.

버전별 직접 metadata1GET은 각각 HTTP403으로 종료했다. 기존 거절 시 브라우저 지시에 따라 각 새 보이는 임시 Chrome에서 같은 공식 metadata/artifact2GET을 수행해 모두 HTTP200이었다. 총6GET이며 버전/직접/브라우저별 소비·실패 원문·요청 intent·receipt를 분리 보존했다. 두 browser의 소유 프로세스 종료·임시 profile 정리를 확인했다. 동일 출처 metadata와 artifact의 두 hash 일치는 독립 진위 인증이 아니다.

| 전체 실행 버전 | artifact SHA256 | 바이트 | 전용 캐시 |
| --- | --- | ---: | --- |
| `0.8.29+commit.ab55807c.Emscripten.clang` | `87616a5fc7ab3551f4133bbd2c3e1be123eae219facc2a56f8f3a4366520c67b` | 9604078 | `.state/rlusd-solc-browser-20261025/soljson.js` |
| `0.8.34+commit.80d5c536.Emscripten.clang` | `c8649f8d57f81b3244c7d2dd662efc0620d1ae296f623b347a2c616a6cfd11d8` | 9595022 | `.state/jpysc-solc-browser-20261025/soljson.js` |

SHA256/Keccak·metadata release/path/build/longVersion·receipt/intent/소비 hash·권한을 재독 검증했다. 전체 실행 버전은 사설 compile worker에서 확인했다. 원문/compiler bytes는 Git·웹에 게시하지 않는다. 기존 세 pin과 기본 설치 compiler는 유지한다.

## 실행과 입력 경계

명시 registry profile만 허용하며 임의 compiler path/URL/hash 옵션·자동 다운로드를 추가하지 않는다. 소유 regular file/nofollow/32MiB·동일 fd hash·0700/0600 staging CJS·worker hash/전체 버전·NODE_OPTIONS/NODE_PATH 제거·각20초/heap256MiB/입력2MiB/출력8MiB·오류/timeout 정리는 기존 경계를 따른다. 캐시가 없거나 다르면 다운로드·다른 버전 대체 없이 종료한다.

기존 가상 소스 기본 상한32는 유지한다. 승인된 RLUSD35소스·JPYSC41소스 입력을 처리하도록 **정확한0.8.29 전체 버전에만35, 정확한0.8.34 전체 버전에만41**을 허용한다. 이 인자는 compiler 진위 인증이 아니며 실제 실행은 별도 profile/hash/worker 버전 검사도 통과해야 한다. `reviewToken → prepareInput → prepareSourceBundle`에서 명시 버전을 전달하고 감사 source snapshot도 비교 대상 입력의 동일 compiler version 한도를 적용한다. 감사 snapshot의 compiler 표기를 독립 신뢰 입력으로 받지 않는다. 파일1MiB/worker 입출력/시간/heap 등 나머지 제한은 확대하지 않는다.

사설 출력에서 두 버전의 require/assert/msg 참조가 uint32 양수 인코딩임을 확인했다. 기존0.8.11의 이름/type·선언 미존재 검사에 이 두 **정확한 전체 버전만** 추가한다. 소스 선언이 있거나 다른/축약 버전이면 builtin으로 간주하지 않는다. 정적 구문 관계와 전체 권한 보장을 구분한다.

## 검증과 판정

Lead `26b83d5389304111bc77824973dfb0e7`의 proceed 조건을 반영했다. 기본32/33·고정35/36·41/42·유사/축약/미등록 버전, 같은 버전 감사 snapshot, 사설 소스의 전체 버전/AST/guard/저장값 쓰기/false 반환/전체 runtime, shadow require와 잘못된 버전, import/timeout/정리·cache 변조/누락/symlink/크기 거절을 시험했다. 첫 사설 시험7개 중2개는 builtin 인코딩 인식 미지원으로 실패했고, 정확한 버전 보완 후7개 모두 통과했다. 첫 실패 로그도 보존한다. 전체 `npm run check`564개 통과 후 실제 저장 입력3개를 각1회 분석해 컴파일 성공·배포 연결 UNKNOWN을 확인했다. [결과와 제한](../research/2026-10-25-rlusd-jpysc-offline-source-review.md)을 따른다.

새 source/runtime 관측·RPC·기존 보고서 덮어쓰기·DB/UI·서명/거래는 없다. 후속 오프라인 결과의 binding UNKNOWN과 원본 진위/배포 설정·생성자·실제 dispatch 미확인은 유지한다. 확보 compiler/사설 Fixture 성공을 실제 자산의 지원·안전·배포 일치로 표시하지 않는다.
