# ADR0123: 운영 런타임 아티팩트 축소와 완성 ZIP 캐시

- 상태: 구현·로컬 검증. 실제 Hosted ARM64 CI/운영 반영은 별도 관측이다.
- 요청: 2026-10-31 사용자 보고의 본문 전송 병목 개선. 180초 연장이 아닌 전송량 감소·검증된 재사용·안전 계측을 구현하고 검사 후 commit/push한다.

## 빌드 범위

기존 빌더는 reports 외 추적 파일 대부분과 전체 production node_modules를 포함했다. 운영 웹/Collector/FX/Usage/Bootstrap/고정 broker의 import를 로컬 읽기 전용 환경에서 추적한 결과 외부 런타임 root는 pg다. runtime-files.mjs는 운영 tools의 JS/JSON/SQL, web 자산(시험 제외), data, deploy, package/lock, Bootstrap이 직접 대조하는 production.yml과 기존 mock JSON 하나만 포함한다. 개발 소스/컴파일러·Router·연구 도구·문서/스크린샷·시험/Fixture·비공개 자료는 런타임으로 게시하지 않는다. 개발 저장소의 원본과 package/lock은 변경하지 않는다.

pg부터 설치된 dependencies/optionalDependencies/peerDependencies를 Node의 중첩 패키지 해석 순서로 추적한다. 필수 누락, dev-only/미고정/version 불일치, symlink는 거부한다. 선택 패키지 내부 파일은 자르지 않고 license·sidecar·.node/.so 등 native 자원까지 유지한다. 선택된 중첩 패키지는 별도로 포함한다. 기존 Linux ARM64/Node24 빌드 경계와 native 존재 시 Node ABI binding은 유지한다. 선택 범위를 넓히는 새 외부 import는 별도 runtimeRoots 변경과 검증이 필요하다.

upload-artifact 고정 버전은 유지하고 압축 수준만9로 변경한다. 빌드 JSON은 파일/패키지 수, 원시 source/dependency/payload byte, deflate9 추정량, native 수를 출력하고 CI summary에 보존한다. deflate 추정은 실제 GitHub ZIP byte/digest가 아니다. 실제 ZIP size는 기존 GitHub artifact metadata와 본문 수신 byte에서 관측한다. CI는 추출한 아티팩트 내부만 읽을 수 있는 child에서 운영 진입점8개를 import한다. main/probe/run은 실행하지 않고 fetch를 명시적으로 차단하며 Node permission의 쓰기/child/network 허용도 추가하지 않는다. 원본 checkout의 node_modules를 참조해 누락을 숨기지 않는다.

## 검증된 완성 ZIP 캐시

Bootstrap inspect/install와 고정 apply client에 `/var/lib/atlas-deploy/artifacts`를 연결한다. 현재 main/run/attempt/workflow/repository/expired/digest metadata 검증은 매번 기존 API로 수행한다. 캐시는 이 독립 digest로만 조회하며 저장한 서명 URL이나 인증을 사용하지 않는다. 사용 직전에도 SHA256, ZIP 크기/해제 상한, manifest/SHA/run/attempt/platform/ABI/policy/내용 검증 전체를 반복한다.

운영에서는 root 전용0700 디렉터리/0600 regular file이다. 모든 조상 경로의 소유권·쓰기권한·symlink를 검증하고 file은 nofollow handle·nlink1·bounded read/hash로 검사한다. 기존 보호된 state 부모가 없으면 캐시는 unavailable로 끝내며 부모/운영 구성을 만들지 않는다. 읽기 경로가 unsafe/손상된 경우 네트워크로 자동 우회하거나 원문을 덮어쓰지 않고 차단한다.

네트워크 ZIP은 기존180초·96MiB·허용 HTTPS host·credential 미전달·redirect:error·무재시도를 유지한다. EOF와 전체 보안 검증 후에만 임시0600 파일→fsync→atomic rename으로 게시한다. cache write 실패는 검증을 끝낸 릴리스의 결과를 바꾸지 않으며 고정 진단으로 구분한다. 완성 ZIP은 최대2개(각96MiB), 같은 디렉터리의 `.partial`은 조회/재개하지 않는다. 기존 broker flock의 직렬 실행을 유지하며 동시에 실행한 관리 명령 전체의 디스크 quota나 crash로 남은 임시 파일 자동 삭제를 보장하지 않는다. 캐시는 릴리스 디렉터리/원장/claim/DB의 대체 저장소가 아니다.

## 부분 재개를 구현하지 않는 이유

[GitHub artifacts API](https://docs.github.com/en/rest/actions/artifacts#download-an-artifact)는 리다이렉트 URL의1분 만료를 명시한다. 이번 범위에서 새 서명 URL 사이의 Range/ETag/바이트 연속성에 대한 검증된 계약은 확보하지 못했다. 이를 가정한 재개/자동 URL 갱신/추가 요청을 구현하지 않는다. 미완료/취소/timeout/손상 본문은 캐시에 게시하지 않으며 후속 호출은 새 현재 후보를 검증한 별도 단발이다. 본문180초 실패의 원인이 서명 URL 만료라고 단정하지 않는다.

## 계측과 운영 경계

stderr ARTIFACT_DISCOVERY는 metadata 시간/크기, ARTIFACT_DOWNLOAD는 stage/source·receivedBytes/artifactBytes·본문 elapsedMs(EOF에서 고정)·totalElapsedMs(조회/검증/cache 포함)·bytesPerSecond·HTTP status·고정 실패 코드를 출력한다. progress는 청크 도착 시5초 또는8MiB 간격이며 새 타이머/요청/재시도를 만들지 않는다. DEPLOY_OPERATION은 CLI bootstrap/apply 전체 소요 시간을 기록한다. 완료 단계는 측정 완료이며 운영 서비스 건강/배포 성공 판정을 대신하지 않는다. URL·서명 쿼리·토큰·헤더·본문·원래 오류문은 출력하지 않는다.

이번 변경은 workflow blob과 고정 제어면 코드에 영향을 준다. 기존 설치는 기존 workflow/control-plane pin을 유지하며 자동으로 신뢰 범위를 갱신하지 않는다. 운영 반영에는 검토된 SHA/새 workflow blob의 기존 bootstrap 설치·검증 절차가 필요하다. 현재 작업에서 Mac mini·Collector·FX·Supabase·Cloudflare·서비스/timer·TLS/proxy 설정은 변경하지 않는다. 결과/수치/미확인은 [연구 기록](../research/2026-10-31-runtime-artifact-optimization.md)을 따른다.
