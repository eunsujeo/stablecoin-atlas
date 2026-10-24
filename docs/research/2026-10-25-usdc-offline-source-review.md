# USDC 저장 관측과 solc0.6.12 소스 후보의 오프라인 검토

[이전 실제 읽기](2026-10-24-usdc-token-review-live.md)의 compiler 미연결 항목을 보강했다. 새 RPC/HTTP·다운로드·키·DB/UI 변경 없이 기존 pin과 일치하는 로컬 solc0.6.12를 제한된 worker에서 실행하고, 블록26261502의 저장 관측을 별도 입력으로 사용했다. 기존 실제 보고서의 PARTIAL/NOT_RUN/UNKNOWN과 원문·시각·소비 상태는 수정하지 않았다.

## 실행과 결과

compiler 전체 버전 `0.6.12+commit.27d51765.Emscripten.clang`, SHA256 `3e1956c550ca48e289044c7c0bd892403081b4b5e17e77ce707c815ce6c4228f`가 기존 연구 기록과 일치했다. 이는 compiler의 독립 인증이 아니며 NOT_TESTED를 유지한다.

| 입력 | 소스/정적 분석 | 전체 runtime 대조 |
|---|---|---|
| 기존 고정 소스 후보 | 컴파일 성공, 함수91·진입43 | 미링크 library, UNKNOWN |
| 저장 서비스 입력 그대로 | 절대 source path 규칙으로 거절, 원문 보존 | 미실행 |
| 고정 소스 + 저장된 명시 library 설정의 별도 후보 | 컴파일 성공, 함수91·진입43 | RUNTIME_MISMATCH, 배포 연결 UNKNOWN |

별도 후보는 원래 소스의 content·가상 경로를 유지하고 libraries 설정만 저장된 입력에서 가져왔다. 이 설정은 실제 배포 설정이나 현재 library identity로 인증하지 않았다. 원래 입력/과거 source binding UNKNOWN도 보존했다. metadata 삭제·치환·부분 일치로 성공을 만들지 않았다. 전체 결과는 PARTIAL이며 안전성·취약점·지원 여부의 판정이 아니다.

정적 관계는 발행/소각, 주소 제한·정지, 역할/소유 설정 변경, 승인/반환, 관련 내부 호출·modifier와 저장값 변경 위치를 제공한다. 직접 caller 주소 비교 소스 구문12개가 진입 경로별로 기록됐다. 같은 조건 선언을 여러 진입점이 참조할 수 있으므로12명의 권한자나12개의 독립 기능을 뜻하지 않는다. 모든 경로의 권한 보장·실제 동작·키 보유 구조는 UNKNOWN이다.

새 보고서의 모드는 OFFLINE, 현재 블록/새 체인 관측은 없다. archive에는 원래 관측 종료 `2026-10-24T09:07:19.548Z`와 원본 hash·블록을 별도로 기록한다. 이 저장 관측은 독립적인 진위 인증을 받은 것이 아니다. 실제 기록 이후의 업그레이드나 설정 상태를 추정하지 않는다.

## 비공개 결과

- `.state/token-review-usdc-source-20261025/`: 원래 소스 후보, library 미연결 결과.
- `.state/token-review-usdc-service-input-20261025/output/`: 절대 경로를 포함한 입력의 거절 결과.
- `.state/token-review-usdc-linked-candidate-20261025/output/`: 별도 linked 후보의 JSON/Markdown·compiler 입출력·원래 관측 원문·SHA256 묶음.

원문·보고서 본문·제3자 source path는 Git/웹에 게시하지 않는다. [ADR0092](../adr/0092-pinned-legacy-compiler-and-archived-review.md)와 [실행 문서](../TOKEN_TECHNICAL_REVIEW.md)의 한도·상태 의미를 따른다.

남은 근거는 현재 배포의 정확한 원본 빌드 입력/metadata·library 대응, 감사 대상 버전/commit/범위와 배포의 연결이다. 준비자산·내부 키 관리·실제 권한 행사·지갑 시스템 검증을 완료조건으로 확대하지 않는다.
