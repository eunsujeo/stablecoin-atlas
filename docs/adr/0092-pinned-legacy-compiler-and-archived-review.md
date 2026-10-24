# ADR 0092: 고정 legacy compiler와 저장 관측의 오프라인 대조

상태: 사용자 후속 진행 요청, 2026-10-25. Lead `5659acf4f95e4e7ea2547757aeb9fb42` proceed 조건 반영. [ADR0091](0091-offline-token-static-path-analysis.md)을 보강한다.

## Compiler profile

설치된 compiler와, 기존 연구 기록의 전체 버전·SHA256이 고정된 solc0.6.12 캐시만 선택한다. 사용자 설정으로 실행 파일 경로·URL·해시를 지정하거나 임의 compiler를 다운로드하지 않는다. token/주소별 분기를 추가하지 않으며 전체 compilerVersion으로 profile을 고른다.

캐시는 nofollow·nonblocking으로 연 regular file의 소유자와32MiB 한도를 검사하고 같은 fd에서 읽은 바이트의 SHA256을 확인한다. 검증한 바이트를 새 소유0700 임시 디렉터리/0600 CJS에 복사해 child가 hash와 버전을 재확인한 뒤 실행한다. 원본 파일을 hash 확인 후 경로로 재실행하지 않는다. Parent finally에서 성공/오류/timeout의 임시 파일을 정리한다. child는 NODE_OPTIONS/NODE_PATH 주입을 제거하며 관리형 proxy 변수는 그대로 상속한다. 외부 import callback·빌드 스크립트·package hook은 실행하지 않는다.

worker 한도는20초·V8 heap256MiB·입력2MiB·출력8MiB다. heap 한도는 전체 RSS 제한이나 보안 sandbox의 보장이 아니다. 기존 pin과의 byte identity는 확인하되 compiler 자체의 독립 인증은 NOT_TESTED로 보존한다. 캐시가 없거나 다르면 실행/다운로드/다른 compiler로 전환하지 않는다.

## 저장 관측

`--observations <report.json>`은 명시적 `--offline`에서만 사용한다. 32MiB·UTF8·구조/깊이·version별 schema·근거 참조·chainId/토큰·원래 블록/시각·헤더와 chain 재확인 기록·코드 hash 및 같은 EIP-1898 RPC 기록의 상호 일관성을 검사한다. 보고서 안의 파일 경로·지시·URL을 따라가지 않는다.

결과1.2의 archive 필드와 원문 artifact에 원래 시각/블록·입력 SHA256을 보존한다. 새 보고서는 OFFLINE이고 현재 블록·현재 계약/프록시 관측은 비어 있다. 저장 byte 비교가 전체 일치하더라도 현재 배포 binding은 UNKNOWN이다. 원문 hash는 진위 인증이 아니며 `SUPPLIED_REPORT_NOT_INDEPENDENTLY_ATTESTED`를 명시한다. 기존1.0/1.1 schema와 보고서·시각·소비 표식을 수정하지 않는다.

## 실제 적용과 검증

2026-10-24 USDC 관측을 새 RPC 없이 재사용한다. 원래 소스 후보는 미링크 library로 UNKNOWN이다. 기존 저장 서비스 입력의 명시 library 설정만 별도 빌드 후보에 반영하고 원래 소스 content/path는 유지한다. 서비스 입력 자체는 absolute source path 규칙에 맞지 않아 거절된 원본도 보존한다. 새로운 후보를 실제 배포 설정으로 인증하거나 runtime metadata를 교체/삭제하지 않는다. 결과는 [오프라인 검토 기록](../research/2026-10-25-usdc-offline-source-review.md)을 따른다.

캐시 변조/누락·symlink/타입·preload·timeout/정리·0.6.12 AST와 selector 미확보, archive identity/hash/헤더/근거 오류·무HTTP·원문 불변·구버전 보존을 검사한다. 새 RPC/다운로드/키·DB/UI 변경은 없다.
