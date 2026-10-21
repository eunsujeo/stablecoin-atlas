# ADR 0014: ARM64 사설 TVM 기동·격리·정리 실행기

2026-10-19. 채택: 사용자 승인 범위 안에서 첫 사설 TVM 기동 관문을 구현한다. [ADR 0013](0013-private-tvm-fixture-preparation.md)의 준비 이후 사용자가 프로그램 생성·소유·격리가 확인된 신규 사설 TRON TVM Fixture 쓰기 예외와 구현 시작을 승인했다. 외부 RPC는 읽기 전용이다. 이번 구현은 토큰 배포·서명·전송·승인 시나리오까지 실행하지 않는다.

## 고정 런타임

[게시자 배포 정보](https://hub.docker.com/r/tronbox/tre)는 TRE 2.0.0에 ARM64 지원과 Java 17, TRE 전용 java-tron 4.8.2를 명시한다. 이전 TronBox quickstart의 Apple ARM 경고를 새 배포물의 실제 결과로 대신하지 않고 직접 기동을 검증한다.

- 이미지: `tronbox/tre:2.0.0`, 실행은 태그 대신 ARM64 child manifest digest `sha256:f0d34ad03198943fc0606d97916bea772fed1bb4050d3b6e6d5143f350f38de4`로 고정한다.
- manifest index: `sha256:f4332e11df12a9f360639a4546fd046593909630fda48af00b30410c144342f0`. registry의 linux/arm64 연결과 로컬 이미지 inspect의 플랫폼/RepoDigests/ID를 확인한다. 다른 아키텍처·latest로 자동 전환하지 않는다.
- 게시자가 밝힌 TRE build는 `GreatVoyage-v4.8.2-108-g05928c9b6d`다. 이는 공개 upstream과 동일한 소스 빌드임을 독립 검증한 기록이 아니다. 이미지의 immutable 참조가 빌드 소스·의존성 전체 라이선스 검토를 대체하지 않는다. 게시자는 java-tron LGPL-3.0을 연결하며 배포/재배포 준비 시 별도 확인이 필요하다.
- 토큰 compiler/TronWeb SDK는 아직 선택하거나 추가하지 않았다. 로컬 javac 17/21은 HTTP 검사기 컴파일용이며 TRON Solidity compiler가 아니다.

## 격리와 수명

[src/tron/lab/runtime.ts](../../src/tron/lab/runtime.ts)는 지정된 로컬 Docker Desktop Unix context를 확인하고, UUID 이름·owner label을 가진 internal bridge와 새 컨테이너를 생성한다. 고정 이미지·owner·단일 network·자원 제한·무게시·mount 없음·privileged/host namespace 없음·권한 제거·log none을 시작 전에 검사한다. 실행 후에는 실제 network ID와 상태를 다시 검사하고 검증한 full CID만 사용한다. 계정 옵션은 0/3으로 제한하며 중복 accounts 환경값을 허용하지 않는다.

호스트 포트는 게시하지 않는다. 처음 시도한 `127.0.0.1::9090`은 관측한 Desktop/internal bridge 구성에서 실제 binding이 비어 있어 중단했다. 이 결과를 모든 Docker 버전의 동작으로 일반화하지 않는다. internal 격리를 유지하며 컨테이너 내부 loopback으로 읽는다. 기존 관리형 프록시 변수/설정은 변경하지 않는다.

이미지에 curl이 없어 [작은 자체 Java 검사기](../../tools/tron-tvm/LocalReadProbe.java)를 사용한다. javac `--release 17 -g:none -proc:none`으로 외부 classpath 없이 컴파일하고 소스/class hash와 compiler 버전을 기록한다. 비밀 없는 bytecode만 임시 디렉터리에 둔다. 컨테이너의 cap-drop ALL을 유지하면서 읽을 수 있도록 해당 디렉터리는 0755, class는 0644로 복사한다. 키·계정 파일에는 이 처리를 하지 않는다.

검사기는 `/opt/java/bin/java`와 실행별 전용 classpath로 실행한다. 운영 entrypoint는 health/node/genesis/head의 네 operation만 받으며 URL/path/body/Java 옵션을 외부 입력으로 받지 않는다. 대상은 컨테이너의 고정 loopback이다. redirect 거부, 2xx 확인, 실제 읽은 1MiB 상한, UTF-8 검증, 연결/읽기/전체 시간 제한을 적용한다. Node 쪽에서도 Docker timeout/maxBuffer와 JSON/관측 필드 검사를 한다. proxy 속성·ProxySelector를 바꾸지 않는다.

시작과 head 관측은 총 60초 구간으로 제한한다. 정상·오류·abort에서 finally로 정리한다. 생성 응답이 유실돼도 미리 정한 이름으로 조회하고 ID/owner 일치 때만 회수한다. 부재·검사 실패·소유권 불일치·정리 실패를 구분한다. container 회수가 실패하면 network는 보존하고, network에 타 컨테이너가 있으면 제거하지 않는다. 정상 SIGTERM 종료와 삭제를 확인한다. SIGKILL/호스트 중단의 자동 복구까지 보장하는 것은 아니다.

## 준비 완료 조건과 관측

health만으로 READY를 주지 않는다. 다음 조건과 정리가 모두 필요하다.

1. 고정 배포물·소유권·network·무게시·권한·mount·자원 제한 검사.
2. Java 17 실행과 node codeVersion 4.8.2, 최초/종료 peer 목록 0.
3. 고정 genesis full ID 일치와 유효한 증가 head. 번호 생략은 명시적 genesis 또는 그와 full ID가 같은 head에만 허용한다.
4. 정상 종료와 소유 container/network 제거. 실행 중 확인한 값은 실패에서도 보존한다.

최초 genesis discovery는 `ERROR / GENESIS_UNPINNED`로 끝냈다. 관측된 `0000000000000000c93baa76a4a508f798a96f59156d9eb17ecede8ec845df2f`를 코드에 명시한 뒤 새 컨테이너로 확인한다. 이 값은 고정 TRE 배포물의 관측 기준이며 독립 합의/출처 검증이 아니다.

동일 코드·이미지·helper·자원·network·timeout으로 새 환경을 직렬 비교했다. accounts=0에서는 60초 동안 genesis에 머물러 HEAD_TIMEOUT이었다. accounts=3에서는 head 전진과 정상 정리가 확인돼 기본 요청값을 3으로 정했다. 같은 설정을 별도 새 컨테이너에서 재현한다. 계정 수가 정지 원인이라는 인과나 다른 버전의 동작까지 규명한 것은 아니다. 요청한 계정 수와 실제 계정 생성 검증은 구분하며 admin/accounts나 키/mnemonic/accounts.json은 읽지 않는다. 컨테이너 삭제로 해당 폐기 상태를 회수한다.

수집하는 자원량은 Docker 한 시점의 stats와 설정 한도·관측 시간이다. 사설망 최소 사양·성능 보증이 아니다. 결과는 별도 `TRON_PRIVATE_TVM_RUNTIME_SMOKE` envelope이며 Assessment/LabReport PASS가 아니다. 기존 TRON READ_ONLY UNKNOWN/INCONCLUSIVE/support, 실제 토큰 실행 NOT_TESTED는 유지한다. head 전진도 getter 응답을 특정 블록에 연결하지 않는다.

실행·검증 결과와 명령은 [사설 TVM 사용 문서](../TRON_TVM_RUNTIME.md)에 기록한다. 다음 관문은 TRON compiler/build 고정, 독립 정상 Fixture 배포와 receipt·이벤트·상태 증거다. 승인된 사설 범위를 유지하며 기존 EVM CLI/lab과 외부 read-only Adapter를 바꾸지 않는다.

Lead 요청 `298a671737c44657a05693e2157cc91f`, `c3af67b6835f419f9c7533e8a7c37130`, `fd17e644242d4efabb727afa66e1f581`, `61ab45a075284735acf4786b693a5e09`의 응답을 회수해 소유권·무게시·Java 읽기 제한·genesis 발견/고정·0/3 비교·오류 증거 보존 조건을 적용했다. 검토 응답을 실제 실행 증거로 대신하지 않는다.
