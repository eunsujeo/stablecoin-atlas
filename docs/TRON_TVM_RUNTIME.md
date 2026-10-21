# 사설 TRON TVM 런타임 smoke

사용자가 승인한 신규 사설 TRON TVM의 첫 기동·격리·정리 관문이다. 정상 TRC-20 Fixture 하나의 배포·영수증·초기 상태 검증도 구현했다. 정상 Fixture의 전송/승인 시나리오도 별도 명령으로 구현했다. 설계·범위·한계는 [ADR 0014](adr/0014-private-tvm-runtime-smoke.md)에 있다.

## 실행

현재 대상은 Apple ARM64 호스트의 로컬 Docker Desktop `desktop-linux` Unix context다. Node 24.5 이상과 로컬 JDK 17 또는 21(javac/java)이 필요하다. 다른 context/원격 Docker/아키텍처로 자동 전환하지 않는다. 이미지 취득과 모든 외부 요청은 관리형 프록시 정책을 따른다.

```sh
docker pull --platform linux/arm64 tronbox/tre@sha256:f0d34ad03198943fc0606d97916bea772fed1bb4050d3b6e6d5143f350f38de4
npm run tvm:smoke -- --out reports/tron-tvm-runtime-smoke.json
```

runner는 내려받은 이미지의 참조/플랫폼을 확인하며 자동 pull이나 공개 RPC fallback은 없다. 외부 RPC_URL/TRON_RPC_URL이나 운영 키를 받지 않는다. 결과는 지정한 파일(0600), 미지정 시 stdout JSON에 기록하며 요약은 stderr로 보낸다. READY는 종료 코드 0, 오류/정리 실패는 1이다. 이 envelope는 자산 AssessmentReport가 아니다.

매 실행마다 internal network와 새 컨테이너를 생성한다. host port·host volume·Docker socket을 연결하지 않고 log driver는 none이다. smoke는 컨테이너 내부 loopback의 네 읽기 API만 Java helper로 조회한다. 배포/실행 명령은 별도의 고정 deploy/trigger/broadcast/receipt/contract/constant/account/block operation을 사용한다. 자동 생성 계정 수는 3을 요청하지만 계정/키 정보는 조회하지 않는다. 전용 writable layer와 helper 임시 파일은 종료 시 회수한다. 보고서의 resources와 cleanup에서 잔여 소유 자원을 확인한다. UNVERIFIED/FAILED/RETAINED는 정리 완료가 아니며 전체 prune으로 해결하지 않는다.

## 실제 실행 기록

- `reports/tron-tvm-runtime-discovery.json`: 고정 전 genesis를 관측해 GENESIS_UNPINNED로 종료. 같은 실행을 자동 학습해 READY로 바꾸지 않았다.
- `reports/tron-tvm-runtime-accounts-0.json`: 계정 0 요청, head 0→0, HEAD_TIMEOUT. 정상 종료/삭제 확인.
- `reports/tron-tvm-runtime-accounts-3.json`: 다른 조건을 유지한 신규 환경에서 계정 3 요청, head 0→1, READY와 정리 확인.
- `reports/tron-tvm-runtime-smoke.json`: 선택 설정을 또 다른 새 환경에서 재현한 결과.

보고서는 Git 제외 대상이다. 자원 stats는 단일 시점 표본이고, image/genesis pin은 독립 source 재현 빌드나 Mainnet 검증이 아니다. 정확한 실행 시각과 head full ID는 각 JSON에 있다. 실제 계정 생성은 `accountGenerationVerified=false`로 명시한다.

## 자동 검증

[수명 테스트](../tests/tron-tvm-runtime.test.ts)는 Docker 응답을 모사해 소유권/이미지·network·무게시·mount·자원·계정 옵션, 응답 유실, 잘못된 block, peer, timeout/abort와 정리 실패를 검증한다. [HTTP 검사기 테스트](../tests/tron-tvm-probe.test.ts)는 소유한 loopback 임시 HTTP 서버와 실제 컴파일한 Java class를 사용해 redirect 후속 요청 없음, 오류/잘린 응답/비JSON/잘못된 UTF-8/크기 제한/느린 응답·timeout과 운영 operation 제한을 확인한다. 기본 `npm run check`는 Docker를 기동하지 않지만 이 검사기 검증에 JDK를 사용한다. 실제 Docker smoke는 위 명령으로 별도 실행한다.

기존 EVM lab과 TRON read-only 보고서의 판정은 그대로다. 여기서 READY가 나와도 TRC-20 전송·승인·수수료·최종성이 검증된 것은 아니다. 배포/receipt 경로와 한계는 [ADR 0015](adr/0015-private-tvm-fixture-deployment.md)에 있다.

최종 검증: `npm run check`에서 타입 검사와 전체 **55개 테스트 통과**, 실패·skip 0. 실제 smoke는 2026-10-19T05:25:15.893Z→2026-10-19T05:25:27.379Z에 head 0→1, Java 17.0.19, codeVersion 4.8.2, peer 0, host 게시 포트 0, SIGTERM 종료 코드 143, container/network REMOVED를 기록했다. 파일 0600·당시 helper 소스 hash 일치·소유 자원 잔여 없음과 문서 링크를 확인했다.

해당 실행의 단일 Docker stats 표본은 CPU 1.59%, 메모리 464.5MiB / 2GiB였다. 장기/최소 자원 요구량이나 처리량으로 해석하지 않는다. writable disk 사용량·장기 실행은 후속 항목이다.

## 정상 Fixture 배포

```sh
npm run tvm:deploy -- --out reports/tron-tvm-fixture-deployment.json
```

공식 TRON compiler를 최초 한 번 내려받아 게시 SHA-256을 대조하고 이후에도 캐시 해시를 검사한다. 매번 새 폐기 계정/격리 환경을 만들며 외부 RPC·키 입력은 없다. mnemonic은 제한된 임시 파일과 컨테이너 환경에 일시 존재하고 삭제된다. OBSERVED(종료 코드 0)는 배포/포함/runtime code/초기 상태 확인이며 AssessmentReport 판정은 아니다. 오류·정리 실패는 종료 코드 1이다.

실제 실행은 runtime code 일치, metadata TVMF/6, totalSupply와 ownerBalance `340282366920938463463374607431768211456`, owner-self allowance `0`을 확인했다. 이 배포 전용 명령의 getter 블록은 UNKNOWN이며 전송·approve·transferFrom을 실행하지 않는다. 후속 실행 명령은 아래와 같다.

배포 단계 최종 검증: `npm run check` **63개 통과**, 실패·skip 0. 실제 최종 배포는 2026-10-19T08:40:06.667Z→08:40:19.511Z, 포함 블록 2, receipt SUCCESS, runtime code 일치, container/network REMOVED다. 보고서 0600·helper 소스 해시 일치·소유 자원 잔여 없음도 확인했다. `npm audit --omit=dev`의 알려진 취약점은 0개였다.

## 정상 토큰 전송·승인 실행

```sh
npm run tvm:exercise -- --out reports/tron-tvm-token-scenarios.json
```

기존 배포·코드 검증 뒤 owner/recipient/spender 3계정으로 전송, 승인, transferFrom, 재승인, 철회, 미승인 REVERT를 직렬 검증한다. 성공 receipt/블록 내 호출 본문·bool 반환·정확한 이벤트와 표본 상태 변화를 함께 확인한다. 실행하지 못한 후속 항목은 NOT_TESTED다. 실제 정리까지 성공해야 전체 OBSERVED/종료 코드 0이다. 새 [ADR 0016](adr/0016-private-tvm-token-scenarios.md)에 보안 경계·검증 조건·한계가 있다. UNKNOWN getter 블록과 읽기 전용 Adapter 판정은 유지한다.

정상 토큰 실행 최종 검증(2026-10-20 KST): `npm run check` **70개 통과**, 실패·skip 0. 새 사설 환경의 실제 실행은 2026-10-19T23:10:43.378Z→23:11:12.380Z(UTC)에 6개 항목 모두 OBSERVED, 포함 블록 3~8을 기록했다. 앞의 5개는 SUCCESS, 마지막 미승인 호출은 REVERT이며 토큰 상태 무변화를 확인했다. 보고서는 0600, 현재 helper 소스 hash 일치, container/network REMOVED와 소유 자원 잔여 없음을 확인했다. 이후 0 금액·잔액·승인량 경계 프로필을 추가했다(아래). 비표준/실패 Fixture·자원 한도 평가는 남아 있다.

## 정상 Fixture 경계 실행

```sh
npm run tvm:boundary -- --out reports/tron-tvm-token-boundaries.json
```

정상 프로필과 별개의 새 환경에서 양수 대조, transfer(0)·승인량 0의 transferFrom(0), 잔액 부족 transfer, 승인량 부족 transferFrom, 충분한 승인을 가진 잔액 부족 transferFrom 및 마지막 승인 철회를 검증한다. 세팅 승인까지 총 11개 항목이다. 매 호출 전 새 표본으로 조건을 확인하며 충분한 승인량의 잔액 부족 호출에서는 allowance rollback도 요구한다. [ADR 0017](adr/0017-private-tvm-boundary-scenarios.md)에 조건·해석 한계가 있다. 기존 120초 제한과 finally 자원 정리는 유지한다.

경계 단계 실제 실행: 2026-10-20T00:01:46.673Z→00:02:31.996Z(UTC), 블록 3~13의 **11개 항목 모두 OBSERVED**(SUCCESS 8, 기대 REVERT 3). 두 0값 호출의 반환·Transfer 0·토큰 상태 불변과, 충분한 승인량을 가진 잔액 부족 호출의 allowance 전체 rollback을 확인했다. 보고서 0600·helper 소스 hash 일치·container/network REMOVED·잔여 소유 자원 없음을 확인했다. 최종 `npm run check`는 **74개 통과**, 실패·skip 0이다.

## 결함 Fixture 대조 실행

```sh
npm run tvm:negative -- --out reports/tron-tvm-negative-fixtures.json
```

정상 대조, false 반환, malformed bool 2 반환, Transfer 이벤트 누락을 각각 새 격리 환경에서 실행한다. 정상 대조의 수용과 결함별 정확한 거부 코드를 확인한다. 결함 Fixture의 `fixtureVerdict=FAIL`과 검증기 회귀의 `EXPECTED_REJECTION_OBSERVED`를 분리하며, 예상 결함을 모두 검출하고 자원 정리까지 끝나면 명령은 종료 코드 0이다. 인프라/정리 실패는 ERROR와 종료 코드 1, 후속 미실행은 NOT_TESTED다. [ADR 0018](adr/0018-private-tvm-negative-fixtures.md)에 단일 결함 정의·증거·해석 한계가 있다. 일반 토큰 평가나 AssessmentReport FAIL은 아니다.

결함 Fixture 최종 검증: `npm run check` **78개 통과**, 실패·skip 0. 실제 실행은 2026-10-20T00:08:33.930Z→00:09:37.598Z(UTC)에 서로 다른 새 환경 4개에서 완료했다. 정상 대조는 canonical true/Transfer 한 건으로 수용됐고, false와 malformed 2는 RETURN_MISMATCH, 이벤트 누락은 LOG_MISMATCH로 정확히 거부됐다. 네 호출 모두 실제 SUCCESS·정확한 잔액 변화·supply/allowance 유지와 build/runtime code 연결을 확인했다. 각 환경 container/network REMOVED, 보고서 0600·소스/helper 해시 일치·잔여 소유 자원 없음을 확인했다. 결함 Fixture의 FAIL은 의도한 transfer 기대 위반이며 검증 실행 실패와 구분한다.

## 보고서 v1 계약과 오프라인 검사

새 실행 출력은 `schemaVersion: "1.0"`을 포함하며 저장/stdout 공개 전에 [별도 TVM 계약](adr/0019-private-tvm-report-contract.md)을 검증한다. 기존 AssessmentReport와 혼합하지 않는다.

```sh
npm run tvm:validate -- --file reports/new-v1-report.json
npm run tvm:validate -- --file reports/tron-tvm-negative-fixtures.json --legacy
```

첫 명령은 새 v1 파일에 사용한다. 두 번째는 버전 필드 없이 이미 저장된 과거 파일을 변경 없이 검사한다. valid는 저장된 요약의 구조·일관성 결과이며 체인 재검증이나 자산 판정이 아니다. 종료 코드 0은 검사 통과, 1은 오류/검사 미통과다. 새 거래나 네트워크 조회를 수행하지 않는다.

과거 주요 파일 5개의 읽기 전용 검사에서 runtime/배포/경계/결함 suite 4개는 LEGACY 요약 검사를 통과했다. 예전 정상 시나리오 보고서 1개는 미승인 호출의 명시적 사전조건 기록 등이 부족해 통과하지 못했다. 오래된 build metadata가 없는 파일은 누락 필드를 별도로 표시한다. 모두 원본 해시를 유지했으며 이 결과를 v1 승격으로 취급하지 않는다. 로컬 검사 기록은 `.state/tvm-report-legacy-inspection.json`이다.

보고서 계약 단계 최종 검증: `npm run check` **85개 통과**, 실패·skip 0. 정상/경계/결함 suite·부분 ERROR/NOT_TESTED 합성 표본과 금액·호출·로그·판정·중복 ID·cleanup 변이를 검사했고, 불법 보고서의 기존 파일 보존과 검증 CLI 오류의 원문 비노출도 확인했다. 주요 과거 보고서 5개의 해시가 그대로임을 확인했다. 이 단계에서 새 TVM 네트워크/거래를 실행하지 않았다.

## 후속 승인 프로브 준비

[approve/transferFrom 결함 프로브 준비](TRON_ALLOWANCE_PROBE_PREPARATION.md)에서 별도9종 소스·compiler allowlist와 순수 receipt/state 검증기를 추가했다. 실행 전 단계는 합성/컴파일 검증으로 남기고, 후속 [별도 실행 경로](TRON_ALLOWANCE_PROBE_EXECUTION.md)에서 신규 소유 runtime과 승인 setup·증거 재검증·정리를 연결한다. 기존 tvm:negative의4종 transfer 실행 범위와 TVM v1 보고서는 그대로다.
