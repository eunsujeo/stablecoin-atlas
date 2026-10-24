# JPYC Ethereum compiler 단발 취득 실패 기록

2026-10-25 KST 사용자가 [계획](2026-10-25-jpyc-compiler-plan.md)의 최대2GET compiler 취득·고정 profile 확장·저장 입력2개 오프라인 분석을 승인했다. [ADR0093](../adr/0093-bounded-jpyc-compiler-acquisition.md)에 이번 예외를 기록한다. **첫 metadata 요청이 실패하여 중단했으며 compiler 확보·profile 확장·대상 분석은 완료하지 못했다.**

## 시도와 결과

고정 `https://binaries.soliditylang.org/bin/list.json` GET을 2026-10-24T17:28:07.771126UTC에 시도했고 17:28:08.172207UTC에 실패를 저장했다(10/25 KST). Python urllib의 `HTTPError`를 관측했다. 상태 코드·오류 본문·서버/관리형 proxy 중 오류 발생 주체는 수집하지 못해 UNKNOWN이다. 인증·권한·파일 부재·rate limit·네트워크 원인으로 추정하지 않는다. 이 시도는 배포 경로가 제공되는지 확인한 성공 증거가 아니다.

| 항목 | 관측 |
| --- | --- |
| HTTP 시도 | metadata1 / artifact0 |
| 확보한 metadata/artifact bytes | 파일 없음 / 파일 없음 |
| 재시도·redirect 추종·endpoint 전환 | 0 / 0 / 0 |
| compiler SHA256·전체 runtime 버전 | UNKNOWN / NOT_TESTED |
| profile 등록·compiler/AST 실행·대상 분석 | 0 / 0 / NOT_TESTED |
| RPC·서명/거래·DB/UI 변경 | 0 |
| 현재 배포 binding | UNKNOWN 유지 |

실패한 요청의 오류 응답을 별도 보존하도록 구현하지 않아 사후 상태 코드를 확인할 수 없다. 기존 호출을 반복하거나 응답을 만들어 보충하지 않는다. 소모한 시도와 원래 UNKNOWN을 보존하며, 조건부 두 번째 artifact 요청은 실패 진단에 전용하지 않는다.

## 로컬 보존과 검증

비공개 `.state/jpyc-solc-0811-acquisition/consumed.json`은 첫 송신 전 배타적 생성·파일/디렉터리 fsync로 보존했다. `receipt.json`에 요청 시작/종료 시각·실패 유형·compiler 미실행을 기록했다. directory0700/file0600을 확인했다. `.state/acquire-jpyc-solc-once.py`는 신규 디렉터리 생성이 실패하면 송신 전에 종료하므로 같은 실행을 재소비하지 않는다. 스크립트·receipt·원문은 Git/웹에 추가하지 않았다.

검증 파일 `.state/agent-logs/jpyc-solc-acquisition-validation.json`은 요청1·artifact 부재·compiler 미실행·권한·원래 JPYC 입력2개 hash 불변과 실행 스크립트/receipt의 SHA256을 기록한다. 원래0.6.12 pin/cache·기존 보고서·시장 자료는 변경하지 않았다. Lead `8e4dc1011069469ba7b47b633ea33433`의 proceed 조건에 따라 검증된 compiler bytes가 없으면 실행/profile 등록을 하지 않았다.

## 다음 범위

승인된 단발 시도는 실패 종료했다. 추가 요청 없이 할 수 있는 기존 소스 수동 검토는 [이전 기록](2026-10-25-jpy-public-html-source-review.md)에 완료되어 있다. compiler profile/AST 분석을 완료하려면 검증 가능한0.8.11 bytes가 필요하다.

재시도를 원할 경우 오류 코드·제한된 오류 응답을 보존하는 별도 단발 계획을 먼저 승인받는다. 제안은 같은 고정 metadata1GET과 성공 시에만 고정 artifact1GET, 기존 크기/시간 한도·재시도0·전환0·검증 후 오프라인2입력이라는 범위다. 새 승인이 없으면 시작하지 않는다. 이번 실패를 새 계획의 허가나 compiler 미지원 확정으로 해석하지 않는다.

## 재시도 전 로컬 보완

사용자의 다음 대응 질문에 따라 기존 실행 스크립트/소비/receipt를 보존하고 `.state/acquire-jpyc-solc-once-v2.py`를 별도로 준비했다. HTTPError status와 최대64KiB 오류 body를 비공개 로컬에 기록하며 body 읽기 실패도 status와 구분한다. 오류 본문·응답 header·예외 문자열은 stdout에 출력하지 않는다. redirect 추종은 여전히0이고 새 전용 root를 사용한다. 실제 네트워크 재요청은 아직 승인받거나 실행하지 않았다.

가짜403/503/302/오류 body 읽기 timeout의4건에서 status 보존·64KiB 절단·실패 후 artifact 미취득·소비된 실행의 재호출 차단을 확인했다(pass4/fail0, 실제 network0). 결과는 `.state/agent-logs/jpyc-solc-v2-offline-tests.json`에 보존한다. 이 검증은 실제 다운로드 원인을 밝혔다는 증거가 아니다.

읽기 timeout 시험에서는 이미 받은4096바이트와 status를 함께 보존했다. 새 root의 소유자/권한을 확인하고 기존 root나 symlink는 배타 생성 단계에서 거절한다. Lead `78868b3a1e90421babbcf03f82a33146`의 proceed는 이 로컬 준비·검증만 허용하며 외부 재요청 승인이 아니다.
