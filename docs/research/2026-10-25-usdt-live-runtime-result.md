# USDT 고정 해시 코드 대조 단발 실행 결과

사용자가 [고정 계획](2026-10-25-usdt-live-runtime-plan.md)의 기존 RPC·단일 주소·최대6회/120초 범위를 명시 승인했다. 실행은 첫 `eth_chainId` 송신 시도에서 읽기 실패로 **1회에 종료·소비 완료**했다. 기준 블록/hash·코드는 확보하지 못했고 **관측 INCONCLUSIVE·대조 ADDRESS_NOT_OBSERVED·matched null·binding UNKNOWN**이다. 생성 runtime과 실제 배포의 일치/불일치를 판정하지 않았다.

## 실행과 실패 경계

- 실행 UTC `2026-10-25T01:12:04.984Z`~`2026-10-25T01:12:05.351Z`. chainId1·`0xdAC17F958D2ee523a2206206994597C13D831ec7`은 고정 계획의 기대 식별자이며 이번 체인 검증 결과가 아니다.
- HTTP/RPC 송신 시도1·검증된 정상 반환0. 이 계수는 transport 호출 시도이며 공급자 도달·과금 여부는 UNKNOWN이다. 전체6회 중 나머지5회는 실행하지 않았다. `eth_getCode`·EIP-1898·종료 재확인은 NOT_TESTED다.
- 실패 원문/endpoint/인증정보를 기록하지 않았다. wrapper가 실패를 일반 코드 `USDT_FIXED_READ_FAILED`로 보존하므로 HTTP 상태·RPC 오류·네트워크/프록시 원인의 구분은 이번 증거로 UNKNOWN이다. 원인 확인용 외부 조회나 endpoint 전환을 추가하지 않았다.
- 새 `.state/usdt-live-runtime-20261025/`의 plan과 fsync한 `wx` 소비 marker를 최초 송신 전에 작성했다. root0700·파일0600, 동일 슬롯 재사용 거절이다. `--use-env-proxy`로 Node 관리형 환경 proxy 경로를 활성화했으며 proxy를 통한 실제 공급자 도달은 미확인이다.
- 재시도·다른 endpoint·숫자tag/latest 대체·getter·storage·프록시/구현체 탐색·compiler 실행·다운로드·서명/거래·DB/UI 변경은0이다. 남은 한도로 자동 재실행하지 않는다.

## 저장 출력과 결과 보존

고정 compiler 출력의 SHA256/2381870바이트·전체 버전·runtime11075바이트를 확인했다. 관측 hash 없이 [ADR0098](../adr/0098-legacy-runtime-omitted-immutable-ranges.md) 비교기를 사용했으므로 생성 runtime Keccak `0xc60427dda11e864272d53e4327226c4f1b67b81e36124a73e23f197649a8cc27`·ADDRESS_NOT_OBSERVED를 기록했다. 기존 누락 필드·원본 artifact·INVALID_RELOCATION_DATA/PARTIAL·과거 MISMATCH와 제품 판정을 유지한다. 이는 재컴파일이나 배포 대조 성공이 아니다.

별도 연구 schema `StoredRuntimeLiveComparison/1.0`의 report.json/report.md와 plan/소비/validation은 위 비공개 root에 보존했다. 이전 보고서·비교기·RPC/실행 도구를 포함한31파일의 hash를 실행 전후 확인했다. 원시 소스/runtime/URL/키는 Git·웹에 게시하지 않았다. 이번에는 관측 부재로 비교기의 PENDING_CHAIN_RECHECK 분기가 발생하지 않았다.

## 검증

Lead `febfe2b210024fd795f279036e6d8f27`의 proceed 조건에 따라 전체 검사와 `git diff --check` 통과 후 한 번만 실행했다. `tests/usdt-runtime-once.test.mjs`의 로컬 가상 transport6개 시험은 rc0/pass6/fail0이다. 성공 순서·hash/주소 고정, 체인/높이/종료 불일치·빈 코드·HTTP/RPC/envelope/timeout/크기 실패, 호출한도·기한·동시소비/재사용 거절을 확인했다. 가상 성공을 실제 토큰 관측으로 사용하지 않는다.

`npm run check > .state/agent-logs/usdt-runtime-once-check.log 2>&1`은 rc0·tests557/pass557/fail0/cancelled0/skipped0이다. `node --use-env-proxy --import tsx tools/research/usdt-runtime-once.mjs`는 rc0으로 실패 관측 보고서를 정상 생성했다. validation PASS는31파일 불변·권한·소비/요청수의 검증이며 실제 관측 성공을 뜻하지 않는다. 전체 토큰 현황과 다음 입력은 [잔여 작업 집계](2026-10-25-token-review-remaining-work.md)를 따른다.
